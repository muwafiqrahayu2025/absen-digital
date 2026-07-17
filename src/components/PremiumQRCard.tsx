import React, { useEffect, useRef } from "react";
import QRCodeStyling from "qr-code-styling";

export interface PremiumQRCardProps {
  /** Real-time dynamic token/payload string */
  value: string;
  /** Nama sesi atau judul utama kartu */
  sessionName?: string;
  /** Tanggal, rentang waktu, atau siklus QR */
  dateOrCycle?: string;
  /** URL logo instansi yang akan diposisikan di tengah QR */
  logoUrl?: string;
  /** Tipe presensi: "check_in" atau "check_out" */
  qrType?: "check_in" | "check_out" | string;
  /** Ukuran QR canvas dalam pixel — berfungsi sebagai ukuran maksimum (default: 280) */
  size?: number;
  /** Keterangan tambahan di bawah teks SCAN ME */
  subtitle?: string;
  /** Tambahan class untuk container kartu */
  className?: string;
  /** Callback saat instance QRCodeStyling siap (untuk keperluan download PNG dll) */
  onInstanceReady?: (instance: QRCodeStyling) => void;
}

/**
 * Komponen Kartu QR Code Premium Reusable (Standardized for Admin Generate QR & Live Kiosk Display)
 *
 * Fitur Utama:
 * 1. Container kartu vertikal dengan gradasi linier biru cerah ke ungu pekat (#3b82f6 -> #4f46e5 -> #581c87).
 * 2. Styling QR presisi tinggi menggunakan `qr-code-styling` dengan rendering Vektor SVG yang sangat tajam tanpa buram.
 * 3. Warna elemen dalam QR Code (pola titik & finder patterns extra-rounded) 100% hitam pekat (#000000) demi kontras maksimal.
 * 4. Logo instansi terpusat sempurna di dalam satu bantalan putih murni (#FFFFFF) tunggal tanpa border atau shadow abu-abu (seamless center pad).
 * 5. Teks putih rata tengah "SCAN ME" di area gradasi bagian bawah kartu.
 * 6. Sinkronisasi dinamis real-time (no mock data) via properti `value` yang memicu `.update()` tanpa re-mount berlebih.
 * 7. Adaptive sizing via ResizeObserver — QR selalu proporsional di semua lebar layar tanpa overflow.
 */
export const PremiumQRCard: React.FC<PremiumQRCardProps> = ({
  value,
  sessionName,
  dateOrCycle,
  logoUrl,
  qrType = "check_in",
  size = 280,
  subtitle = "Arahkan kamera atau pemindai ke Kode QR",
  className = "",
  onInstanceReady,
}) => {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const qrContainerRef = useRef<HTMLDivElement | null>(null);
  const qrInstanceRef = useRef<QRCodeStyling | null>(null);
  const onInstanceReadyRef = useRef(onInstanceReady);
  const prevDataRef = useRef({ value: "", logoUrl: "", size: 0 });

  // ── Adaptive QR size: menggunakan lebar kartu aktual, bukan size prop hardcoded
  const [adaptiveSize, setAdaptiveSize] = React.useState<number>(size);
  const adaptiveSizeRef = useRef<number>(size);

  useEffect(() => {
    onInstanceReadyRef.current = onInstanceReady;
  }, [onInstanceReady]);

  const [processedLogo, setProcessedLogo] = React.useState<string | undefined>(undefined);

  // Memproses logo instansi menjadi satu kesatuan gambar beresolusi tinggi dengan bantalan putih murni (#FFFFFF) bersudut melengkung halus
  useEffect(() => {
    if (!logoUrl) {
      setProcessedLogo(undefined);
      return;
    }
    let isMounted = true;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = logoUrl;
    img.onload = () => {
      if (!isMounted) return;
      try {
        const sz = 320;
        const canvas = document.createElement("canvas");
        canvas.width = sz;
        canvas.height = sz;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, sz, sz);

          // Gambar bantalan latar belakang putih murni (#FFFFFF) berbentuk persegi dengan sudut melengkung halus
          const r = 76;
          ctx.fillStyle = "#FFFFFF";
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(0, 0, sz, sz, r);
          } else {
            ctx.moveTo(r, 0);
            ctx.lineTo(sz - r, 0);
            ctx.quadraticCurveTo(sz, 0, sz, r);
            ctx.lineTo(sz, sz - r);
            ctx.quadraticCurveTo(sz, sz, sz - r, sz);
            ctx.lineTo(r, sz);
            ctx.quadraticCurveTo(0, sz, 0, sz - r);
            ctx.lineTo(0, r);
            ctx.quadraticCurveTo(0, 0, r, 0);
          }
          ctx.closePath();
          ctx.fill();

          // Gambar logo instansi terpusat presisi di dalam bantalan putih melengkung
          const pad = 36;
          const targetW = sz - pad * 2;
          const targetH = sz - pad * 2;
          const aspect = img.width / (img.height || 1);
          let drawW = targetW;
          let drawH = targetH;
          if (aspect > 1) {
            drawH = targetW / aspect;
          } else {
            drawW = targetH * aspect;
          }
          const drawX = (sz - drawW) / 2;
          const drawY = (sz - drawH) / 2;

          ctx.drawImage(img, drawX, drawY, drawW, drawH);
          setProcessedLogo(canvas.toDataURL("image/png", 1.0));
        }
      } catch (e) {
        setProcessedLogo(logoUrl);
      }
    };
    img.onerror = () => {
      if (isMounted) setProcessedLogo(logoUrl);
    };
    return () => {
      isMounted = false;
    };
  }, [logoUrl]);

  // ── ResizeObserver: auto-update QR size saat lebar container berubah ──
  useEffect(() => {
    if (!cardRef.current) return;
    let rAF: number;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const containerWidth = entry.contentRect.width;
      const computed = Math.min(Math.floor(containerWidth * 0.96), size);
      const clamped = Math.max(Math.min(computed, containerWidth - 20), 120); // presisi zero overflow di semua ukuran layar
      if (Math.abs(clamped - adaptiveSizeRef.current) >= 8) {
        rAF = requestAnimationFrame(() => {
          adaptiveSizeRef.current = clamped;
          setAdaptiveSize(clamped);
        });
      }
    });
    observer.observe(cardRef.current);
    return () => {
      observer.disconnect();
      if (rAF) cancelAnimationFrame(rAF);
    };
  }, [size]);

  // Helper opsional untuk memperhalus galian SVG jika diperlukan
  const injectSmoothCenterPad = React.useCallback((container: HTMLElement | null) => {
    if (!container) return;
    const svgEl = container.querySelector("svg");
    if (!svgEl) return;
    const imageEl = svgEl.querySelector("image");
    if (!imageEl) return;

    let rectEl = svgEl.querySelector("#qr-center-pad") as SVGRectElement | null;
    if (!rectEl) {
      rectEl = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rectEl.setAttribute("id", "qr-center-pad");
      imageEl.parentNode?.insertBefore(rectEl, imageEl);
    }

    const imgX = parseFloat(imageEl.getAttribute("x") || "0");
    const imgY = parseFloat(imageEl.getAttribute("y") || "0");
    const imgW = parseFloat(imageEl.getAttribute("width") || "0");
    const imgH = parseFloat(imageEl.getAttribute("height") || "0");

    if (imgW > 0 && imgH > 0) {
      const pad = 6;
      rectEl.setAttribute("x", String(imgX - pad));
      rectEl.setAttribute("y", String(imgY - pad));
      rectEl.setAttribute("width", String(imgW + pad * 2));
      rectEl.setAttribute("height", String(imgH + pad * 2));
      rectEl.setAttribute("rx", "22");
      rectEl.setAttribute("ry", "22");
      rectEl.setAttribute("fill", "#FFFFFF");
    }
  }, []);

  // ── MutationObserver: pastikan viewBox & center pad terpasang setiap SVG diupdate oleh QRCodeStyling
  useEffect(() => {
    if (!qrContainerRef.current) return;
    const observer = new MutationObserver(() => {
      const svgEl = qrContainerRef.current?.querySelector("svg");
      if (svgEl) {
        if (!svgEl.getAttribute("viewBox")) {
          svgEl.setAttribute("viewBox", `0 0 ${adaptiveSize} ${adaptiveSize}`);
        }
        svgEl.style.width = "100%";
        svgEl.style.height = "100%";
        svgEl.style.maxWidth = "100%";
        svgEl.style.display = "block";
      }
      injectSmoothCenterPad(qrContainerRef.current);
    });
    observer.observe(qrContainerRef.current, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [adaptiveSize, injectSmoothCenterPad]);

  // ── Inisialisasi awal atau pembaruan instance QRCodeStyling ──────────────
  // Menggunakan adaptiveSize agar QR selalu proporsional dengan container aktual
  useEffect(() => {
    const qrSize = adaptiveSize;

    if (!qrInstanceRef.current) {
      // ── CREATE instance baru
      const instance = new QRCodeStyling({
        width: qrSize,
        height: qrSize,
        type: "svg", // Vektor SVG menjamin presisi rendering 100% tajam tanpa buram di semua resolusi
        data: value || "https://abdi.sch.id",
        image: processedLogo || undefined,
        margin: 0,
        qrOptions: {
          errorCorrectionLevel: "H",
        },
        imageOptions: {
          crossOrigin: "anonymous",
          hideBackgroundDots: true,
          imageSize: 0.34,
          margin: 10,
          saveAsBlob: true,
        },
        dotsOptions: {
          type: "dots",
          color: "#000000", // Hitam pekat solid untuk kontras maksimal
        },
        backgroundOptions: {
          color: "#FFFFFF",
        },
        cornersSquareOptions: {
          type: "extra-rounded",
          color: "#000000",
        },
        cornersDotOptions: {
          type: "dot",
          color: "#000000",
        },
      });

      qrInstanceRef.current = instance;
      prevDataRef.current = { value, logoUrl: processedLogo || "", size: qrSize };

      if (qrContainerRef.current) {
        qrContainerRef.current.innerHTML = "";
        instance.append(qrContainerRef.current);
        const svgEl = qrContainerRef.current.querySelector("svg");
        if (svgEl) {
          svgEl.setAttribute("viewBox", `0 0 ${qrSize} ${qrSize}`);
          svgEl.style.width = "100%";
          svgEl.style.height = "100%";
          svgEl.style.maxWidth = "100%";
          svgEl.style.display = "block";
        }
        injectSmoothCenterPad(qrContainerRef.current);
      }
      if (onInstanceReadyRef.current) {
        onInstanceReadyRef.current(instance);
      }
    } else {
      // ── UPDATE instance yang sudah ada — hanya jika data benar-benar berubah (mencegah blink)
      if (
        prevDataRef.current.value !== value ||
        prevDataRef.current.logoUrl !== (processedLogo || "") ||
        prevDataRef.current.size !== qrSize
      ) {
        prevDataRef.current = { value, logoUrl: processedLogo || "", size: qrSize };
        qrInstanceRef.current.update({
          width: qrSize,
          height: qrSize,
          type: "svg",
          data: value || "https://abdi.sch.id",
          image: processedLogo || undefined,
          margin: 0,
          imageOptions: {
            crossOrigin: "anonymous",
            hideBackgroundDots: true,
            imageSize: 0.34,
            margin: 10,
            saveAsBlob: true,
          },
          dotsOptions: {
            type: "dots",
            color: "#000000",
          },
          backgroundOptions: {
            color: "#FFFFFF",
          },
          cornersSquareOptions: {
            type: "extra-rounded",
            color: "#000000",
          },
          cornersDotOptions: {
            type: "dot",
            color: "#000000",
          },
        });
        const svgEl = qrContainerRef.current?.querySelector("svg");
        if (svgEl) {
          svgEl.setAttribute("viewBox", `0 0 ${qrSize} ${qrSize}`);
          svgEl.style.width = "100%";
          svgEl.style.height = "100%";
          svgEl.style.maxWidth = "100%";
          svgEl.style.display = "block";
        }
        injectSmoothCenterPad(qrContainerRef.current);
      }
    }
  }, [value, processedLogo, adaptiveSize]);

  return (
    <div
      ref={cardRef}
      className={`flex flex-col items-center justify-between p-5 sm:p-7 lg:p-9 rounded-[2.2rem] sm:rounded-[2.8rem] shadow-[0_25px_65px_rgba(0,0,0,0.55)] border border-white/20 relative overflow-hidden transition-all duration-300 font-sans select-none max-w-full min-w-0 ${className}`}
      style={{
        background: "linear-gradient(180deg, #3b82f6 0%, #4f46e5 48%, #581c87 100%)",
      }}
    >
      {/* Decorative Ambient Lighting Overlays */}
      <div className="absolute -top-24 -left-24 w-56 h-56 bg-cyan-400/25 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-56 h-56 bg-purple-400/25 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Section */}
      <div className="w-full flex flex-col items-center justify-center text-center mb-3 sm:mb-4 z-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 sm:py-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/25 text-white text-[11px] sm:text-xs font-black tracking-wider uppercase shadow-sm">
          <span
            className={`w-2 h-2 rounded-full ${
              qrType === "check_in" ? "bg-emerald-400 animate-pulse" : "bg-amber-400 animate-pulse"
            }`}
          />
          <span>
            {qrType === "check_in"
              ? "📥 PRESENSI MASUK"
              : qrType === "check_out"
              ? "📤 PRESENSI PULANG"
              : "🟢 LIVE QR REAL-TIME"}
          </span>
        </div>

        {sessionName && (
          <h2 className="text-base sm:text-xl font-black text-white tracking-wide uppercase mt-2 sm:mt-3 drop-shadow-md line-clamp-1 px-2 leading-tight">
            {sessionName}
          </h2>
        )}

        {dateOrCycle && (
          <p className="text-blue-100 font-bold text-xs sm:text-[13px] tracking-wider mt-1 opacity-95">
            {dateOrCycle}
          </p>
        )}
      </div>

      {/* Center Section: Viewfinder Frame + QR Code */}
      <div className="relative my-2 sm:my-3 w-[92%] sm:w-[88%] max-w-[260px] sm:max-w-[300px] aspect-square flex items-center justify-center z-10 group mx-auto p-2.5 sm:p-3.5">
        {/* L-Shaped Scanner Frame Brackets (mengunci presisi di 4 sudut terluar tepat mengelilingi latar putih QR) */}
        <div className="absolute top-0 left-0 w-8 h-8 sm:w-10 sm:h-10 border-t-[5px] sm:border-t-[6px] border-l-[5px] sm:border-l-[6px] border-white rounded-tl-[1.6rem] shadow-[0_0_15px_rgba(255,255,255,0.95)] pointer-events-none transition-transform duration-300 group-hover:-translate-x-0.5 group-hover:-translate-y-0.5 z-30" />
        <div className="absolute top-0 right-0 w-8 h-8 sm:w-10 sm:h-10 border-t-[5px] sm:border-t-[6px] border-r-[5px] sm:border-r-[6px] border-white rounded-tr-[1.6rem] shadow-[0_0_15px_rgba(255,255,255,0.95)] pointer-events-none transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 z-30" />
        <div className="absolute bottom-0 left-0 w-8 h-8 sm:w-10 sm:h-10 border-b-[5px] sm:border-b-[6px] border-l-[5px] sm:border-l-[6px] border-white rounded-bl-[1.6rem] shadow-[0_0_15px_rgba(255,255,255,0.95)] pointer-events-none transition-transform duration-300 group-hover:-translate-x-0.5 group-hover:translate-y-0.5 z-30" />
        <div className="absolute bottom-0 right-0 w-8 h-8 sm:w-10 sm:h-10 border-b-[5px] sm:border-b-[6px] border-r-[5px] sm:border-r-[6px] border-white rounded-br-[1.6rem] shadow-[0_0_15px_rgba(255,255,255,0.95)] pointer-events-none transition-transform duration-300 group-hover:translate-x-0.5 group-hover:translate-y-0.5 z-30" />

        {/* QR Code White Cushion Box (mutlak pas di dalam empat bingkai L tanpa melebar keluar) */}
        <div className="relative w-full h-full bg-white rounded-[1.3rem] p-3 sm:p-4 shadow-[0_20px_50px_rgba(0,0,0,0.6)] flex items-center justify-center overflow-hidden transition-transform duration-300 group-hover:scale-[1.01]">
          {/* QR Code Canvas Target — proporsional & fluid di semua ukuran */}
          <div
            ref={qrContainerRef}
            className="w-full h-full flex items-center justify-center aspect-square z-10"
          />
        </div>
      </div>

      {/* Bottom Section: Centered White "SCAN ME" Text */}
      <div className="mt-3 sm:mt-4 text-center z-10 w-full">
        <p className="text-white font-black text-lg sm:text-2xl tracking-[0.25em] sm:tracking-[0.28em] uppercase drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]">
          SCAN ME
        </p>
        {subtitle && (
          <p className="text-blue-100 font-semibold text-[10px] sm:text-[13px] mt-1 sm:mt-1.5 opacity-90 max-w-xs mx-auto leading-snug">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
};
