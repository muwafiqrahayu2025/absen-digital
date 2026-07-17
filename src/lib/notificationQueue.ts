/**
 * ============================================================
 * ABDI Absen Digital — Notification Queue & Offline Retry Engine
 * ============================================================
 * Sistem antrean latar belakang untuk pengiriman notifikasi
 * WhatsApp (Wablas/Fonnte) dan Email (Google Apps Script).
 *
 * Jika jaringan sedang tidak tersedia atau server gateway down,
 * pesan disimpan di localStorage dan otomatis dikirim ulang
 * saat koneksi pulih.
 * ============================================================
 */

export interface QueuedNotification {
  id: string;
  createdAt: string;
  retryCount: number;
  lastAttemptAt?: string;
  status: 'pending' | 'sending' | 'failed' | 'sent';
  type: 'whatsapp' | 'email';
  recipient: string; // nomor WA atau alamat email
  payload: {
    // WhatsApp
    apiUrl?: string;
    token?: string;
    message?: string;
    provider?: 'wablas' | 'fonnte';
    // Email
    gasUrl?: string;
    subject?: string;
    htmlBody?: string;
  };
  eventType: string;
  userName: string;
}

const QUEUE_KEY = 'abdi_notification_queue';
const MAX_RETRY = 5;
const RETRY_DELAY_MS = [5000, 15000, 30000, 60000, 120000]; // Backoff eksponensial

// ─────────────────────────────────────────────────────────────
// OPERASI ANTREAN (localStorage-backed, sync)
// ─────────────────────────────────────────────────────────────

export function getQueue(): QueuedNotification[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedNotification[]): void {
  try {
    // Batasi maksimum 100 item antrean agar tidak membanjiri localStorage
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-100)));
  } catch (e) {
    console.warn('[NotifQueue] Gagal menyimpan antrean:', e);
  }
}

/**
 * Menambahkan notifikasi WhatsApp ke antrean.
 */
export function enqueueWhatsApp(params: {
  recipient: string;
  apiUrl: string;
  token: string;
  message: string;
  provider: 'wablas' | 'fonnte';
  eventType: string;
  userName: string;
}): string {
  const queue = getQueue();
  const id = `wa_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const item: QueuedNotification = {
    id,
    createdAt: new Date().toISOString(),
    retryCount: 0,
    status: 'pending',
    type: 'whatsapp',
    recipient: params.recipient,
    payload: {
      apiUrl: params.apiUrl,
      token: params.token,
      message: params.message,
      provider: params.provider,
    },
    eventType: params.eventType,
    userName: params.userName,
  };
  queue.push(item);
  saveQueue(queue);
  console.log(`[NotifQueue] WA enqueued: ${id} → ${params.recipient}`);
  return id;
}

/**
 * Menambahkan notifikasi Email ke antrean.
 */
export function enqueueEmail(params: {
  recipient: string;
  gasUrl: string;
  subject: string;
  htmlBody: string;
  eventType: string;
  userName: string;
}): string {
  const queue = getQueue();
  const id = `email_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const item: QueuedNotification = {
    id,
    createdAt: new Date().toISOString(),
    retryCount: 0,
    status: 'pending',
    type: 'email',
    recipient: params.recipient,
    payload: {
      gasUrl: params.gasUrl,
      subject: params.subject,
      htmlBody: params.htmlBody,
    },
    eventType: params.eventType,
    userName: params.userName,
  };
  queue.push(item);
  saveQueue(queue);
  console.log(`[NotifQueue] Email enqueued: ${id} → ${params.recipient}`);
  return id;
}

// ─────────────────────────────────────────────────────────────
// PROCESSOR — Kirim ulang item antrean
// ─────────────────────────────────────────────────────────────

async function sendWhatsApp(item: QueuedNotification): Promise<boolean> {
  const { apiUrl, token, message, provider } = item.payload;
  if (!apiUrl || !token || !message) return false;

  let fetchUrl: string;
  let reqHeaders: Record<string, string>;
  let reqBody: string;

  if (provider === 'wablas') {
    fetchUrl = `${apiUrl}/api/send-message`;
    reqHeaders = { Authorization: token, 'Content-Type': 'application/json' };
    reqBody = JSON.stringify({ phone: item.recipient, message });
  } else {
    // Fonnte
    fetchUrl = 'https://api.fonnte.com/send';
    reqHeaders = { Authorization: token };
    const formData = new URLSearchParams();
    formData.append('target', item.recipient);
    formData.append('message', message);
    reqBody = formData.toString();
    reqHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
  }

  const response = await fetch(fetchUrl, {
    method: 'POST',
    headers: reqHeaders,
    body: reqBody,
    signal: AbortSignal.timeout(12000),
  });

  const res = await response.json();
  return res.status === true ||
    res.detail === 'success' ||
    res.message === 'success' ||
    String(res.message).toLowerCase().includes('success');
}

async function sendEmail(item: QueuedNotification): Promise<boolean> {
  const { gasUrl, subject, htmlBody } = item.payload;
  if (!gasUrl || !subject || !htmlBody) return false;

  const response = await fetch(gasUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ to: item.recipient, subject, htmlBody }),
    signal: AbortSignal.timeout(15000),
  });

  const res = await response.json();
  return res.status === 'success';
}

/**
 * Memproses semua item antrean yang pending/failed.
 * Dipanggil secara otomatis saat koneksi online pulih.
 *
 * @returns Jumlah pesan yang berhasil dikirim
 */
export async function processNotificationQueue(): Promise<number> {
  if (!navigator.onLine) return 0;

  const queue = getQueue();
  const pending = queue.filter(
    (item) => (item.status === 'pending' || item.status === 'failed') && item.retryCount < MAX_RETRY
  );

  if (pending.length === 0) return 0;

  let successCount = 0;
  const now = Date.now();

  for (const item of pending) {
    // Periksa backoff delay sebelum mencoba ulang
    if (item.lastAttemptAt) {
      const delay = RETRY_DELAY_MS[Math.min(item.retryCount, RETRY_DELAY_MS.length - 1)];
      const elapsed = now - new Date(item.lastAttemptAt).getTime();
      if (elapsed < delay) continue;
    }

    // Update status menjadi 'sending'
    const idx = queue.findIndex((q) => q.id === item.id);
    if (idx < 0) continue;
    queue[idx].status = 'sending';
    queue[idx].lastAttemptAt = new Date().toISOString();
    saveQueue(queue);

    try {
      let success = false;
      if (item.type === 'whatsapp') {
        success = await sendWhatsApp(item);
      } else {
        success = await sendEmail(item);
      }

      if (success) {
        queue[idx].status = 'sent';
        successCount++;
        console.log(`[NotifQueue] ✅ Terkirim: ${item.id} (${item.type}) → ${item.recipient}`);
      } else {
        queue[idx].status = 'failed';
        queue[idx].retryCount++;
        console.warn(`[NotifQueue] ❌ Gagal: ${item.id}, retry #${queue[idx].retryCount}`);
      }
    } catch (e: any) {
      queue[idx].status = 'failed';
      queue[idx].retryCount++;
      console.warn(`[NotifQueue] ⚠️ Error: ${item.id} — ${e.message}, retry #${queue[idx].retryCount}`);
    }

    saveQueue(queue);

    // Tunda antar pengiriman untuk menghindari rate limit API
    await new Promise((resolve) => setTimeout(resolve, 800));
  }

  // Hapus item yang sudah terkirim atau sudah melebihi batas retry
  const cleaned = queue.filter(
    (item) => item.status !== 'sent' && item.retryCount < MAX_RETRY
  );
  saveQueue(cleaned);

  return successCount;
}

// ─────────────────────────────────────────────────────────────
// AUTO-PROCESSOR — Jalankan otomatis saat koneksi pulih
// ─────────────────────────────────────────────────────────────

let _processorActive = false;
let _retryIntervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Inisialisasi processor antrean notifikasi.
 * Dipanggil sekali saat aplikasi dimuat.
 * Secara otomatis mengirim ulang antrean saat online.
 */
export function initNotificationQueueProcessor(): void {
  if (_processorActive) return;
  _processorActive = true;

  // Proses saat pertama kali online
  window.addEventListener('online', () => {
    console.log('[NotifQueue] Koneksi pulih — memproses antrean notifikasi...');
    setTimeout(() => processNotificationQueue(), 2000);
  });

  // Proses setiap 3 menit sebagai background job
  _retryIntervalId = setInterval(() => {
    if (navigator.onLine) {
      processNotificationQueue();
    }
  }, 3 * 60 * 1000);

  // Proses langsung saat init jika sudah online
  if (navigator.onLine) {
    setTimeout(() => processNotificationQueue(), 5000);
  }

  console.log('[NotifQueue] Notification Queue Processor aktif ✅');
}

/**
 * Mendapatkan statistik antrean untuk ditampilkan di UI.
 */
export function getQueueStats(): {
  total: number;
  pending: number;
  failed: number;
  sent: number;
} {
  const queue = getQueue();
  return {
    total: queue.length,
    pending: queue.filter((q) => q.status === 'pending' || q.status === 'sending').length,
    failed: queue.filter((q) => q.status === 'failed').length,
    sent: queue.filter((q) => q.status === 'sent').length,
  };
}

/**
 * Membersihkan seluruh antrean notifikasi (gunakan hati-hati).
 */
export function clearNotificationQueue(): void {
  localStorage.removeItem(QUEUE_KEY);
  console.log('[NotifQueue] Antrean notifikasi dibersihkan.');
}
