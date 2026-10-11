/**
 * ════════════════════════════════════════════════════════════════
 * ABDI — Cloud Functions Proxy Client
 * ════════════════════════════════════════════════════════════════
 *
 * File ini menjadi jembatan antara frontend dan Cloud Functions
 * proxy. Dengan cara ini, API Key WhatsApp dan Gemini TIDAK PERNAH
 * terekspos di sisi klien.
 *
 * Penggunaan:
 *   import { callSendWhatsApp, callGemini } from '../lib/functionsProxy';
 *
 *   // Kirim WA
 *   const res = await callSendWhatsApp({ tenantId, phone, message });
 *
 *   // Panggil Gemini
 *   const res = await callGemini({ tenantId, prompt });
 */

import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebase';

// Inisialisasi Firebase Functions (region asia-southeast1 sesuai project)
const functions = getFunctions(app, 'asia-southeast1');

// ── Type Definitions ─────────────────────────────────────────────────────────

export interface WhatsAppProxyRequest {
  tenantId: string;
  phone: string;
  message: string;
}

export interface WhatsAppProxyResponse {
  success: boolean;
  provider: string;
  message: string;
}

export interface GeminiProxyRequest {
  tenantId: string;
  prompt: string;
  model?: 'gemini-2.0-flash' | 'gemini-2.0-flash-lite' | 'gemini-1.5-flash' | 'gemini-1.5-pro';
}

export interface GeminiProxyResponse {
  success: boolean;
  text: string;
  model: string;
  usage: Record<string, unknown>;
}

// ── Callable References ──────────────────────────────────────────────────────

const _sendWhatsAppProxy = httpsCallable<WhatsAppProxyRequest, WhatsAppProxyResponse>(
  functions,
  'sendWhatsAppProxy'
);

const _sendGeminiProxy = httpsCallable<GeminiProxyRequest, GeminiProxyResponse>(
  functions,
  'sendGeminiProxy'
);

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Kirim pesan WhatsApp melalui Cloud Function proxy.
 * API Key TIDAK pernah terekspos ke client.
 *
 * @param params - tenantId, phone, message
 * @returns Promise<WhatsAppProxyResponse>
 * @throws Firebase HttpsError jika gagal
 */
export async function callSendWhatsApp(
  params: WhatsAppProxyRequest
): Promise<WhatsAppProxyResponse> {
  const result = await _sendWhatsAppProxy(params);
  return result.data;
}

/**
 * Panggil Gemini AI melalui Cloud Function proxy.
 * Gemini API Key TIDAK pernah terekspos ke client.
 *
 * @param params - tenantId, prompt, model (opsional)
 * @returns Promise<GeminiProxyResponse>
 * @throws Firebase HttpsError jika gagal
 */
export async function callGemini(
  params: GeminiProxyRequest
): Promise<GeminiProxyResponse> {
  const result = await _sendGeminiProxy(params);
  return result.data;
}
