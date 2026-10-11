/**
 * ════════════════════════════════════════════════════════════════
 * ABDI ABSEN DIGITAL — API Proxy Cloud Functions
 * ════════════════════════════════════════════════════════════════
 *
 * Tujuan:
 *   Menjembatani panggilan dari frontend ke API eksternal
 *   (WhatsApp Gateway & Gemini AI) tanpa mengekspos API Key
 *   di sisi klien (client-side). Key disimpan di RTDB node
 *   yang hanya bisa dibaca oleh Cloud Functions (server-side)
 *   melalui Firebase Admin SDK.
 *
 * Prinsip Keamanan:
 *   - Frontend TIDAK PERNAH menyentuh/melihat API Key
 *   - Key diambil server-side via Admin SDK (bypass security rules)
 *   - Frontend hanya kirim payload pesan & nomor tujuan
 *   - Autentikasi wajib (request.auth !== null)
 *   - Rate limiting: maxInstances = 10
 *
 * Endpoint:
 *   - sendWhatsAppProxy  : POST → WA Gateway (Wablas/Fonnte)
 *   - sendGeminiProxy    : POST → Google Gemini AI API
 */

import {onCall, HttpsError} from "firebase-functions/v2/https";
import {defineSecret} from "firebase-functions/params";
import * as admin from "firebase-admin";
import * as https from "https";
import * as http from "http";
import {URL} from "url";

const db = admin.database();

// ── Define Firebase Secrets ──────────────────────────────────────────────────
// Nilai ini akan disimpan secara aman di Google Cloud Secret Manager
// dan disuntikkan ke runtime saat function berjalan.
const geminiSecret = defineSecret("GEMINI_API_KEY");
const whatsappSecret = defineSecret("WHATSAPP_API_KEY");

// ── Helper: HTTP request sederhana tanpa dependensi axios ────────────────────
function httpRequest(
  urlStr: string,
  method: string,
  headers: Record<string, string>,
  body: string
): Promise<{status: number; data: unknown}> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(urlStr);
    const isHttps = parsedUrl.protocol === "https:";
    const lib = isHttps ? https : http;

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method,
      headers: {
        ...headers,
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = lib.request(options, (res) => {
      let rawData = "";
      res.on("data", (chunk) => {
        rawData += chunk;
      });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(rawData);
          resolve({status: res.statusCode || 0, data: parsed});
        } catch {
          resolve({status: res.statusCode || 0, data: rawData});
        }
      });
    });

    req.on("error", reject);
    req.setTimeout(15000, () => {
      req.destroy(new Error("Request timeout setelah 15 detik"));
    });

    if (body) req.write(body);
    req.end();
  });
}

// ════════════════════════════════════════════════════════════════
// PROXY #1: WhatsApp Gateway (Wablas / Fonnte)
// ════════════════════════════════════════════════════════════════
//
// Request dari frontend:
//   { tenantId: string, phone: string, message: string }
//
// Alur:
//   1. Verifikasi auth (wajib login)
//   2. Verifikasi user adalah member dari tenantId tersebut
//   3. Ambil API Key dari RTDB via Admin SDK (server-side, aman)
//   4. Forward request ke WA Gateway tanpa mengekspos key ke client
//   5. Return hasil (sukses/gagal) ke frontend
// ════════════════════════════════════════════════════════════════
export const sendWhatsAppProxy = onCall(
  {maxInstances: 10, timeoutSeconds: 30, secrets: [whatsappSecret]},
  async (request) => {
    // ── Step 1: Verifikasi Autentikasi ───────────────────────────
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Harus login untuk menggunakan fitur notifikasi."
      );
    }

    const uid = request.auth.uid;
    const {tenantId, phone, message} = request.data as {
      tenantId: string;
      phone: string;
      message: string;
    };

    // ── Step 2: Validasi Input ───────────────────────────────────
    if (!tenantId || !phone || !message) {
      throw new HttpsError(
        "invalid-argument",
        "Parameter tenantId, phone, dan message wajib diisi."
      );
    }

    if (message.length > 4096) {
      throw new HttpsError(
        "invalid-argument",
        "Pesan terlalu panjang (maksimal 4096 karakter)."
      );
    }

    // Sanitasi nomor telepon
    let cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.startsWith("0")) cleanPhone = "62" + cleanPhone.substring(1);
    if (!cleanPhone.startsWith("62") || cleanPhone.length < 10) {
      throw new HttpsError(
        "invalid-argument",
        "Format nomor telepon tidak valid."
      );
    }

    // ── Step 3: Verifikasi Keanggotaan Tenant ────────────────────
    const mappingSnap = await db.ref(`user_tenant_mapping/${uid}`).get();
    const userTenantId = mappingSnap.val();
    const isGlobalAdmin = (
      await db.ref(`global_admins/${uid}`).get()
    ).val() === true;

    if (!isGlobalAdmin && userTenantId !== tenantId) {
      throw new HttpsError(
        "permission-denied",
        "Anda tidak memiliki akses ke tenant ini."
      );
    }

    // ── Step 4: Ambil API Key dari Firebase Secret Manager ──────
    // Menggunakan Cloud Secret Manager (Pilar Keamanan Fase 3)
    let waToken = whatsappSecret.value() || "";
    let waProvider = "wablas";
    let wablasServer = "https://smg.wablas.com";

    // Cek override konfigurasi (Provider/Server URL) dari RTDB (non-secret config)
    try {
      const globalKeySnap = await db.ref("global_settings/apiKeys/notif").get();
      if (globalKeySnap.exists()) {
        const gk = globalKeySnap.val();
        if (gk.waGatewayProvider) waProvider = gk.waGatewayProvider;
        if (gk.wablasServerUrl) wablasServer = gk.wablasServerUrl;
      }

      // Opsional: Jika tenant punya override apiKey khusus di RTDB, kita bisa ambil
      // Tapi prioritas utama adalah Secret Manager untuk global key.
      const tenantKeySnap = await db.ref(`tenants/${tenantId}/school`).get();
      if (tenantKeySnap.exists()) {
        const tk = tenantKeySnap.val();
        if (tk.whatsappApiKey) waToken = tk.whatsappApiKey; // Fallback to tenant specific
        if (tk.waGatewayProvider) waProvider = tk.waGatewayProvider;
        if (tk.wablasServerUrl) wablasServer = tk.wablasServerUrl;
      }
    } catch (err) {
      console.warn("[sendWhatsAppProxy] Gagal mengambil konfigurasi override RTDB:", err);
    }

    if (!waToken) {
      throw new HttpsError(
        "failed-precondition",
        "API Key WhatsApp belum dikonfigurasi (Secret belum diset)."
      );
    }

    // ── Step 5: Bersihkan token Wablas (format token.secret) ─────
    let wablasSecret = "";
    let finalToken = waToken.trim();
    if (waProvider === "wablas") {
      const parts = finalToken.split(/[.\s,]+/);
      if (parts.length > 1) {
        finalToken = `${parts[0]}.${parts[1]}`;
        wablasSecret = parts[1];
      }
    }

    // ── Step 6: Forward ke WA Gateway ───────────────────────────
    const isWablas = waProvider === "wablas";
    const fetchUrl = isWablas ?
      `${wablasServer.replace(/\/$/, "")}/api/v2/send-message` :
      "https://api.fonnte.com/send";

    const reqHeaders: Record<string, string> = {
      Authorization: finalToken,
    };

    let reqBody: string;
    if (isWablas) {
      reqHeaders["Content-Type"] = "application/json";
      reqBody = JSON.stringify({
        data: [{phone: cleanPhone, message, secret: wablasSecret || false}],
      });
    } else {
      reqHeaders["Content-Type"] = "application/x-www-form-urlencoded";
      reqBody = new URLSearchParams({
        target: cleanPhone,
        message,
        countryCode: "62",
      }).toString();
    }

    try {
      const result = await httpRequest(fetchUrl, "POST", reqHeaders, reqBody);
      const resData = result.data as Record<string, unknown>;
      const isSuccess =
        resData.status === true ||
        resData.detail === "success" ||
        (typeof resData.message === "string" &&
          resData.message.toLowerCase().includes("success"));

      return {
        success: isSuccess,
        provider: waProvider,
        message: isSuccess ?
          "Pesan WhatsApp berhasil dikirim." :
          `Gagal: ${resData.reason || resData.message || "Perangkat WA Gateway tidak terhubung"}`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[sendWhatsAppProxy] Request error:", msg);
      throw new HttpsError("internal", `Koneksi ke WA Gateway gagal: ${msg}`);
    }
  }
);

// ════════════════════════════════════════════════════════════════
// PROXY #2: Google Gemini AI
// ════════════════════════════════════════════════════════════════
//
// Request dari frontend:
//   { tenantId: string, prompt: string, model?: string }
//
// Alur:
//   1. Verifikasi auth (wajib login)
//   2. Verifikasi keanggotaan tenant
//   3. Ambil Gemini API Key dari RTDB via Admin SDK
//   4. Forward request ke Gemini API
//   5. Return respons AI ke frontend (tanpa mengekspos key)
// ════════════════════════════════════════════════════════════════
export const sendGeminiProxy = onCall(
  {maxInstances: 10, timeoutSeconds: 60, secrets: [geminiSecret]},
  async (request) => {
    // ── Step 1: Verifikasi Autentikasi ───────────────────────────
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Harus login untuk menggunakan fitur AI."
      );
    }

    const uid = request.auth.uid;
    const {tenantId, prompt, model = "gemini-2.0-flash"} = request.data as {
      tenantId: string;
      prompt: string;
      model?: string;
    };

    // ── Step 2: Validasi Input ───────────────────────────────────
    if (!tenantId || !prompt) {
      throw new HttpsError(
        "invalid-argument",
        "Parameter tenantId dan prompt wajib diisi."
      );
    }

    if (prompt.length > 32000) {
      throw new HttpsError(
        "invalid-argument",
        "Prompt terlalu panjang (maksimal 32.000 karakter)."
      );
    }

    // Whitelist model yang diizinkan
    const allowedModels = [
      "gemini-2.0-flash",
      "gemini-2.0-flash-lite",
      "gemini-1.5-flash",
      "gemini-1.5-pro",
    ];
    if (!allowedModels.includes(model)) {
      throw new HttpsError("invalid-argument", `Model '${model}' tidak didukung.`);
    }

    // ── Step 3: Verifikasi Keanggotaan Tenant ────────────────────
    const mappingSnap = await db.ref(`user_tenant_mapping/${uid}`).get();
    const userTenantId = mappingSnap.val();
    const isGlobalAdmin = (
      await db.ref(`global_admins/${uid}`).get()
    ).val() === true;

    if (!isGlobalAdmin && userTenantId !== tenantId) {
      throw new HttpsError(
        "permission-denied",
        "Anda tidak memiliki akses ke tenant ini."
      );
    }

    // ── Step 4: Ambil Gemini API Key dari Secret Manager ─────────
    // Pilar Keamanan Fase 3 — Key tersimpan aman di GCP Secret Manager
    let geminiApiKey = geminiSecret.value() || "";

    try {
      // Coba override dengan key milik tenant jika ada di node /school
      const tenantSchoolSnap = await db
        .ref(`tenants/${tenantId}/school`)
        .get();
      if (tenantSchoolSnap.exists()) {
        const ts = tenantSchoolSnap.val();
        const tenantKey = ts.geminiApiKey || ts.aiCsApiKey || ts.aiApiKey || "";
        if (tenantKey) geminiApiKey = tenantKey;
      }
    } catch (err) {
      console.warn("[sendGeminiProxy] Gagal mengambil override key tenant:", err);
    }

    if (!geminiApiKey) {
      throw new HttpsError(
        "failed-precondition",
        "API Key Gemini belum dikonfigurasi (Secret belum diset)."
      );
    }

    // ── Step 5: Forward ke Gemini API ────────────────────────────
    const geminiUrl =
      `https://generativelanguage.googleapis.com/v1beta/models/${model}` +
      `:generateContent?key=${geminiApiKey}`;

    const requestBody = JSON.stringify({
      contents: [{parts: [{text: prompt}]}],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      },
    });

    try {
      const result = await httpRequest(
        geminiUrl,
        "POST",
        {"Content-Type": "application/json"},
        requestBody
      );

      if (result.status !== 200) {
        const errData = result.data as Record<string, unknown>;
        const errMsg =
          (errData.error as Record<string, unknown>)?.message ||
          `HTTP ${result.status}`;
        console.error("[sendGeminiProxy] Gemini API error:", errData);
        throw new HttpsError("internal", `Gemini API error: ${errMsg}`);
      }

      // Extract teks dari respons Gemini
      const responseData = result.data as Record<string, unknown>;
      const candidates = responseData.candidates as Array<{
        content: {parts: Array<{text: string}>};
      }>;
      const text = candidates?.[0]?.content?.parts?.[0]?.text || "";

      return {
        success: true,
        text,
        model,
        usage: (responseData.usageMetadata as Record<string, unknown>) || {},
      };
    } catch (err: unknown) {
      if (err instanceof HttpsError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[sendGeminiProxy] Request error:", msg);
      throw new HttpsError("internal", `Koneksi ke Gemini gagal: ${msg}`);
    }
  }
);
