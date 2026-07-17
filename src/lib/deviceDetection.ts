import { DeviceInfo, DeviceSessionLog } from "../types";
import { db } from "./db";
import { dbRealtime } from "./firebase";
import { ref, push, set } from "firebase/database";

/**
 * Utilitas global untuk mendeteksi spesifikasi dan kategori perangkat pengguna
 * Memanfaatkan navigator.userAgentData (Modern Chromium) dan fallback ke navigator.userAgent
 */
export function detectUserDevice(): DeviceInfo {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      os: "Server / SSR",
      browser: "Unknown",
      category: "Unknown",
    };
  }

  const ua = navigator.userAgent || "";
  const anyNavigator = navigator as any;

  // 1. Deteksi OS (Operating System)
  let os = "Unknown OS";
  if (anyNavigator.userAgentData && anyNavigator.userAgentData.platform) {
    os = anyNavigator.userAgentData.platform;
  } else if (/Windows NT 10.0/i.test(ua)) {
    os = "Windows 10 / 11";
  } else if (/Windows NT 6.3/i.test(ua)) {
    os = "Windows 8.1";
  } else if (/Windows NT 6.2/i.test(ua)) {
    os = "Windows 8";
  } else if (/Windows NT 6.1/i.test(ua)) {
    os = "Windows 7";
  } else if (/Android/i.test(ua)) {
    const match = ua.match(/Android\s([0-9\.]+)/i);
    os = match ? `Android ${match[1]}` : "Android";
  } else if (/iPhone|iPad|iPod/i.test(ua)) {
    const match = ua.match(/OS\s([0-9_]+)/i);
    os = match ? `iOS ${match[1].replace(/_/g, ".")}` : "iOS / iPadOS";
  } else if (/Mac OS X/i.test(ua)) {
    const match = ua.match(/Mac OS X\s([0-9_]+)/i);
    os = match ? `macOS ${match[1].replace(/_/g, ".")}` : "macOS";
  } else if (/Linux/i.test(ua)) {
    os = "Linux";
  }

  // 2. Deteksi Browser
  let browser = "Unknown Browser";
  if (anyNavigator.userAgentData && Array.isArray(anyNavigator.userAgentData.brands)) {
    const brandObj = anyNavigator.userAgentData.brands.find(
      (b: any) => !/Not|A|Brand/i.test(b.brand)
    );
    if (brandObj) {
      browser = `${brandObj.brand} ${brandObj.version}`;
    }
  }
  
  if (browser === "Unknown Browser" || !browser) {
    if (/Edg\//i.test(ua)) {
      const match = ua.match(/Edg\/([0-9]+)/i);
      browser = match ? `Microsoft Edge ${match[1]}` : "Microsoft Edge";
    } else if (/Chrome\//i.test(ua) && !/Chromium|OPR|Edg/i.test(ua)) {
      const match = ua.match(/Chrome\/([0-9]+)/i);
      browser = match ? `Google Chrome ${match[1]}` : "Google Chrome";
    } else if (/Safari\//i.test(ua) && !/Chrome|Chromium|OPR|Edg/i.test(ua)) {
      const match = ua.match(/Version\/([0-9\.]+)/i);
      browser = match ? `Apple Safari ${match[1]}` : "Apple Safari";
    } else if (/Firefox\//i.test(ua)) {
      const match = ua.match(/Firefox\/([0-9]+)/i);
      browser = match ? `Mozilla Firefox ${match[1]}` : "Mozilla Firefox";
    } else if (/OPR\/|Opera/i.test(ua)) {
      browser = "Opera";
    } else if (/UCBrowser/i.test(ua)) {
      browser = "UC Browser";
    }
  }

  // 3. Deteksi Kategori Perangkat (Mobile vs Desktop vs Tablet)
  let category: "Mobile" | "Desktop" | "Tablet" | "Unknown" = "Desktop";
  if (anyNavigator.userAgentData && typeof anyNavigator.userAgentData.mobile === "boolean") {
    category = anyNavigator.userAgentData.mobile ? "Mobile" : "Desktop";
    if (!anyNavigator.userAgentData.mobile && /iPad|Tablet/i.test(ua)) {
      category = "Tablet";
    }
  } else {
    if (/iPad|Tablet|(Android(?!.*Mobile))/i.test(ua)) {
      category = "Tablet";
    } else if (/Mobile|iPhone|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
      category = "Mobile";
    } else {
      category = "Desktop";
    }
  }

  const screenResolution =
    typeof window !== "undefined" && window.screen
      ? `${window.screen.width}x${window.screen.height}`
      : "Unknown";

  return {
    os,
    browser,
    category,
    rawUserAgent: ua,
    screenResolution,
  };
}

/**
 * Menyimpan log jejak perangkat dan aktivitas ke LocalStorage (dan Firebase secara background)
 */
export function recordDeviceSessionLog(
  logInput: Omit<DeviceSessionLog, "id" | "timestamp" | "device"> & {
    device?: DeviceInfo;
  }
): DeviceSessionLog {
  const device = logInput.device || detectUserDevice();
  const newLog: DeviceSessionLog = {
    id: `devlog-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    device,
    ...logInput,
  };

  try {
    // 1. Simpan di DB local
    db.addDeviceSessionLog(newLog);

    // 2. Sinkronisasi asinkron ke Firebase jika tersambung (tanpa melempar error jika offline)
    setTimeout(() => {
      try {
        const logRef = push(ref(dbRealtime, "deviceSessionLogs"));
        set(logRef, newLog).catch(() => {});
      } catch (err) {}
    }, 100);
  } catch (e) {
    console.error("Gagal merekam log perangkat:", e);
  }

  return newLog;
}
