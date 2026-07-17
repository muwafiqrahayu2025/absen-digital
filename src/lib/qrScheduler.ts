/**
 * Modul Otomatisasi Token Keamanan & Siklus Masa Berlaku QR Code
 * Mengelola siklus Harian (1 hari), Mingguan (7 hari), dan Bulanan (30 hari).
 * Dilengkapi dengan background automated logic (cron scheduler) yang otomatis
 * memperbarui token keamanan setiap pukul 00:00 malam hari.
 */

export type QrCycleType = "daily" | "weekly" | "monthly";

export interface QrPayloadData {
  session: string;
  date: string;
  type: "check_in" | "check_out";
  token: string;
  timestamp: number;
  cycle?: QrCycleType;
  cycleStart?: string;
  cycleEnd?: string;
  masterToken?: string;
}

/**
 * Menghitung tanggal akhir siklus dari tanggal mulai dan tipe siklus
 */
export function calculateCycleEndDate(startDateStr: string, cycle: QrCycleType): string {
  const start = new Date(startDateStr);
  if (isNaN(start.getTime())) return startDateStr;

  if (cycle === "daily") {
    return startDateStr;
  } else if (cycle === "weekly") {
    const end = new Date(start);
    end.setDate(end.getDate() + 6); // 7 hari total (hari mulai + 6 hari)
    return end.toISOString().slice(0, 10);
  } else if (cycle === "monthly") {
    const end = new Date(start);
    end.setDate(end.getDate() + 29); // 30 hari total
    return end.toISOString().slice(0, 10);
  }
  return startDateStr;
}

/**
 * Menghasilkan hash/token unik deterministik atau random untuk keamanan QR
 */
export function generateSecureToken(prefix = "TOKEN"): string {
  const randomPart = Math.random().toString(36).substring(2, 10).toUpperCase();
  const timePart = Date.now().toString(36).slice(-4).toUpperCase();
  return `${prefix}-${randomPart}${timePart}`;
}

/**
 * Menghasilkan turunan token harian dari master token untuk siklus mingguan/bulanan
 */
export function generateDailyDerivedToken(masterToken: string, dateStr: string): string {
  let hash = 0;
  const combined = `${masterToken}_${dateStr}_SECURE_SALT`;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  const hashHex = Math.abs(hash).toString(16).toUpperCase().padStart(8, "0");
  return `DY-${hashHex.slice(0, 8)}`;
}

/**
 * Memperoleh data QR aktif saat ini atau menginisialisasi yang baru jika kedaluwarsa.
 * Fungsi ini dipanggil setiap hari atau oleh cron job jam 00:00.
 */
export function syncAndAutoRefreshDailyQrToken(): {
  isRefreshed: boolean;
  activeQr: QrPayloadData | null;
  message?: string;
} {
  const todayStr = new Date().toISOString().slice(0, 10);
  const storedStr = localStorage.getItem("current_active_qr");

  if (!storedStr) return { isRefreshed: false, activeQr: null };

  try {
    const stored: QrPayloadData = JSON.parse(storedStr);
    const cycle = stored.cycle || "daily";
    const cycleStart = stored.cycleStart || stored.date;
    const cycleEnd = stored.cycleEnd || stored.date;

    // Jika hari ini masih di tanggal yang sama dengan penyimpanan terakhir, tidak perlu ubah
    if (stored.date === todayStr) {
      return { isRefreshed: false, activeQr: stored };
    }

    // Hari telah berganti (misal jam 00:00). Cek siklusnya:
    if (cycle === "weekly" || cycle === "monthly") {
      // Periksa apakah hari ini masih dalam masa berlaku siklus (between cycleStart and cycleEnd)
      if (todayStr >= cycleStart && todayStr <= cycleEnd) {
        // Siklus MASIH AKTIF! Kita otomatis perbarui/regenerasi token keamanan harian
        // meskipun admin memilih paket mingguan atau bulanan agar kode QR tetap aman.
        const masterToken = stored.masterToken || stored.token;
        const newDailyToken = generateDailyDerivedToken(masterToken, todayStr);

        const updatedQr: QrPayloadData = {
          ...stored,
          date: todayStr,
          token: newDailyToken,
          masterToken: masterToken,
          timestamp: Date.now(),
        };

        localStorage.setItem("current_active_qr", JSON.stringify(updatedQr));
        return {
          isRefreshed: true,
          activeQr: updatedQr,
          message: `Siklus ${cycle === "weekly" ? "Mingguan" : "Bulanan"} aktif (${cycleStart} s.d. ${cycleEnd}). Token keamanan harian otomatis diperbarui untuk ${todayStr}.`,
        };
      } else {
        // Masa berlaku siklus mingguan/bulanan telah habis. Buat siklus baru untuk hari ini.
        const newToken = generateSecureToken("TOKEN");
        const newCycleEnd = calculateCycleEndDate(todayStr, cycle);
        const updatedQr: QrPayloadData = {
          session: stored.session || "Absensi Harian",
          date: todayStr,
          type: stored.type || "check_in",
          token: newToken,
          timestamp: Date.now(),
          cycle: cycle,
          cycleStart: todayStr,
          cycleEnd: newCycleEnd,
          masterToken: newToken,
        };

        localStorage.setItem("current_active_qr", JSON.stringify(updatedQr));
        return {
          isRefreshed: true,
          activeQr: updatedQr,
          message: `Masa berlaku siklus ${cycle} sebelumnya telah habis. QR Code baru diperbarui untuk ${todayStr} s.d. ${newCycleEnd}.`,
        };
      }
    } else {
      // Siklus Harian (daily): Otomatis perbarui token untuk hari baru jam 00:00
      const newToken = generateSecureToken("TOKEN");
      const updatedQr: QrPayloadData = {
        ...stored,
        date: todayStr,
        token: newToken,
        timestamp: Date.now(),
        cycle: "daily",
        cycleStart: todayStr,
        cycleEnd: todayStr,
      };

      localStorage.setItem("current_active_qr", JSON.stringify(updatedQr));
      return {
        isRefreshed: true,
        activeQr: updatedQr,
        message: `Hari berganti! Token QR Harian otomatis tergenerate ulang untuk keamanan hari ini (${todayStr}).`,
      };
    }
  } catch (e) {
    console.error("Error refreshing daily QR token:", e);
    return { isRefreshed: false, activeQr: null };
  }
}

/**
 * Menjalankan scheduler (background check setiap menit) untuk memantau waktu jam 00:00
 */
export function startQrSecurityCronJob(onTokenRefreshed?: (newQr: QrPayloadData, msg: string) => void): () => void {
  const initialCheck = syncAndAutoRefreshDailyQrToken();
  if (initialCheck.isRefreshed && initialCheck.activeQr && initialCheck.message && onTokenRefreshed) {
    onTokenRefreshed(initialCheck.activeQr, initialCheck.message);
  }

  const intervalId = setInterval(() => {
    const result = syncAndAutoRefreshDailyQrToken();
    if (result.isRefreshed && result.activeQr && result.message && onTokenRefreshed) {
      onTokenRefreshed(result.activeQr, result.message);
    }
  }, 60000);

  return () => clearInterval(intervalId);
}

/**
 * Memverifikasi apakah QR data yang dipindai (dari kamera atau link) valid dan aman
 */
export function verifyScannedQrSecurity(qrData: QrPayloadData, todayStr: string): { valid: boolean; reason?: string } {
  if (!qrData || !qrData.token) {
    return { valid: false, reason: "Token keamanan QR Code tidak ditemukan." };
  }

  const storedStr = localStorage.getItem("current_active_qr");
  if (!storedStr) {
    return { valid: true };
  }

  try {
    const activeQr: QrPayloadData = JSON.parse(storedStr);

    if (qrData.token === activeQr.token) {
      return { valid: true };
    }

    if (qrData.cycle === "weekly" || qrData.cycle === "monthly") {
      const cycleStart = qrData.cycleStart || qrData.date;
      const cycleEnd = qrData.cycleEnd || calculateCycleEndDate(cycleStart, qrData.cycle);

      if (todayStr >= cycleStart && todayStr <= cycleEnd) {
        if (
          qrData.token === activeQr.masterToken ||
          qrData.masterToken === activeQr.masterToken ||
          qrData.token === activeQr.token
        ) {
          return { valid: true };
        }
        if (activeQr.masterToken && generateDailyDerivedToken(activeQr.masterToken, todayStr) === activeQr.token) {
          if (qrData.token === activeQr.masterToken) return { valid: true };
        }
      } else {
        return {
          valid: false,
          reason: `Masa berlaku QR Code siklus ${qrData.cycle === "weekly" ? "Mingguan" : "Bulanan"} ini telah habis (${cycleStart} s.d. ${cycleEnd}). Harap gunakan QR terbaru dari admin.`,
        };
      }
    }

    if (qrData.date && qrData.date !== todayStr && qrData.date !== "universal") {
      return {
        valid: false,
        reason: `Kode QR ini adalah kode untuk tanggal ${qrData.date} dan sudah tidak berlaku hari ini (${todayStr}). Token keamanan telah diperbarui otomatis.`,
      };
    }

    if (activeQr.token && qrData.token !== activeQr.token && qrData.token !== activeQr.masterToken) {
      return {
        valid: false,
        reason: "Token keamanan QR Code sudah tidak aktif atau telah diganti oleh Administrator.",
      };
    }

    return { valid: true };
  } catch (e) {
    console.error("QR verification error:", e);
    return { valid: true };
  }
}
