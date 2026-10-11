import { User } from '../types';
import { db } from './db';
import { toast } from 'react-hot-toast';
import { ref, get } from 'firebase/database';
import { dbRealtime } from './firebase';
// [FASE-3-SECURITY] Import proxy client — Key tidak pernah menyentuh frontend
import { callSendWhatsApp } from './functionsProxy';
export type NotificationEvent = 'OTP_CODE' | 'SECURITY_LOCK' | 'PASSWORD_RESET' | 'LOGIN_SUCCESS' | 'ATTENDANCE_RECORDED' | 'ATTENDANCE_REMINDER' | 'LEAVE_SUBMITTED' | 'LEAVE_STATUS_UPDATED' | 'MONTHLY_ATTENDANCE_SUMMARY' | 'BROADCAST_MESSAGE';
interface NotificationData {
  appName?: string;
  ipAddress?: string;
  browser?: string;
  time?: string;
  location?: string;
  extraInfo?: string;
}

export const NotificationService = {
  /**
   * Mengirim notifikasi (simulasi) ke WhatsApp dan Email pengguna.
   * Di lingkungan production, fungsi ini akan memanggil API (seperti Wablas, Fonnte, SendGrid).
   */
  send: async (user: User, eventType: NotificationEvent, data: NotificationData = {}) => {
    const school = ({ name: (JSON.parse(localStorage.getItem("active_session_user") || "{}")).satuanKerja || (JSON.parse(localStorage.getItem("active_session_user") || "{}")).opd || "Instansi", radius: 120, address: "", kopSurat: null, latitude: 0, longitude: 0 });
    const appName = data.appName || 'Sistem ABDI Absen Digital';
    const currentTime = data.time || new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
    
    // [FASE-3-SECURITY] Key TIDAK lagi diambil dari RTDB di sisi frontend.
    // Pengambilan key dilakukan server-side oleh Cloud Function proxy.
    // Variabel berikut hanya digunakan untuk email (GAS) dan fallback UI.
    let gasEmailUrl = "";
    try {
      const apiRef = ref(dbRealtime, 'global_settings/apiKeys/notif');
      const snapshot = await get(apiRef);
      if (snapshot.exists()) {
        const notifData = snapshot.val();
        // Hanya ambil GAS URL (non-secret) — waToken TIDAK diambil lagi
        gasEmailUrl = notifData.gasWebAppUrl || "";
      }
    } catch (e) {
      console.warn("[notifications] Gagal fetch config GAS:", e);
    }
    
    // Tentukan tenantId dari user session
    const sessionUser = JSON.parse(localStorage.getItem("active_session_user") || "{}");
    const tenantId: string = sessionUser.tenantId || user.tenantId || "";
    
    const waFooter = `\n\n---\n🏢 *${school.name}*\n_Powered by Alpha Project_`;
    
    const emailFooter = `
            <div style="background-color: #f8fafc; padding: 25px 20px; text-align: center; border-top: 1px solid #e2e8f0; border-radius: 0 0 12px 12px;">
              <div style="margin-bottom: 15px;">
                <span style="background-color: #e2e8f0; color: #475569; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Pesan Otomatis</span>
              </div>
              <p style="font-size: 13px; color: #64748b; margin: 0 0 5px 0; font-weight: 500;">
                Email ini dikirim otomatis oleh sistem, mohon untuk tidak membalas.
              </p>
              <p style="font-size: 12px; color: #94a3b8; margin: 0;">
                &copy; ${new Date().getFullYear()} <strong>Alpha Project</strong> &bull; ${appName}
              </p>
            </div>
    `;

    let waMessage = '';
    let emailSubject = '';
    let emailBody = '';

    switch (eventType) {
      case 'OTP_CODE':
        waMessage = `🛡️ *ABDI ABSEN DIGITAL*\n\n`
          + `Halo *${user.name}*,\n`
          + `Berikut adalah kode otentikasi Anda:\n\n`
          + `*${data.extraInfo}*\n\n`
          + `Kode ini berlaku selama 15 menit dan hanya dapat digunakan satu kali.\n\n`
          + `_Tolong jangan berikan kode ini kepada siapapun._\n\n`
          + `Terima kasih,\nAlpha Project`;

        emailSubject = `Kode otentikasi ABDI Absen Digital Anda: ${data.extraInfo}`;
        emailBody = `
          <div style="font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px;">
            <div style="text-align: center; margin-bottom: 24px;">
              <img src="https://cdn-icons-png.flaticon.com/512/3108/3108167.png" alt="Logo" width="48" height="48" style="display: inline-block; filter: grayscale(100%); opacity: 0.9;" />
            </div>
            <h2 style="color: #24292f; font-size: 24px; font-weight: 400; text-align: center; margin-bottom: 24px;">
              Silakan verifikasi identitas Anda, <strong>${user.username || user.name.split(' ')[0]}</strong>
            </h2>
            
            <div style="border: 1px solid #d0d7de; border-radius: 6px; padding: 32px; text-align: left;">
              <p style="font-size: 14px; color: #57606a; margin-top: 0; margin-bottom: 16px;">
                Berikut adalah kode otentikasi ABDI Absen Digital Anda:
              </p>
              
              <div style="text-align: center; margin: 24px 0;">
                <span style="font-family: ui-monospace,SFMono-Regular,SF Mono,Menlo,Consolas,Liberation Mono,monospace; font-size: 32px; font-weight: 600; letter-spacing: 8px; color: #24292f;">${data.extraInfo}</span>
              </div>
              
              <p style="font-size: 14px; color: #57606a; margin-bottom: 16px;">
                Kode ini berlaku selama <strong>15 menit</strong> dan hanya dapat digunakan satu kali.
              </p>
              
              <p style="font-size: 14px; color: #24292f; font-weight: 600; margin-bottom: 24px;">
                Tolong jangan berikan kode ini kepada siapapun: kami tidak akan pernah meminta kode ini melalui telepon, email, atau pesan singkat.
              </p>
              
              <p style="font-size: 14px; color: #57606a; margin: 0;">
                Terima kasih,<br>
                Alpha Project
              </p>
            </div>
            
            ${emailFooter}
          </div>
        `;
        break;

      case 'SECURITY_LOCK':
        waMessage = `🚨 *PERINGATAN KEAMANAN* 🚨\n\n`
          + `Halo *${user.name}*,\n`
          + `Sistem kami mendeteksi percobaan masuk yang mencurigakan (gagal berkali-kali) ke akunmu!\n\n`
          + `🕒 *Waktu:* ${currentTime}\n`
          + `👤 *Akun:* ${user.username}\n\n`
          + `Akun kamu kami *kunci sementara* ya demi keamanan. Kalau ini bukan kamu, segera lapor ke tim Admin! 🛡️`
          + waFooter;

        emailSubject = `🚨 Peringatan Keamanan: Upaya Masuk Mencurigakan - ${school.name}`;
        emailBody = `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid #f0f0f0;">
            <div style="background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%); padding: 30px 20px; text-align: center;">
              <h2 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">Peringatan Keamanan 🚨</h2>
            </div>
            <div style="padding: 30px 20px;">
              <p style="font-size: 16px; color: #374151; margin-top: 0;">Halo <strong>${user.name}</strong>,</p>
              <p style="font-size: 15px; color: #4b5563; line-height: 1.6;">Sistem mendeteksi adanya upaya masuk yang gagal berkali-kali pada akun Anda.</p>
              
              <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; border-radius: 0 8px 8px 0; padding: 20px; margin: 25px 0;">
                <p style="margin: 5px 0; font-size: 14px; color: #991b1b;"><strong>🕒 Waktu:</strong> ${currentTime}</p>
                <p style="margin: 5px 0; font-size: 14px; color: #991b1b;"><strong>👤 Username:</strong> ${user.username}</p>
                <p style="margin: 15px 0 0 0; font-size: 14px; color: #b91c1c; font-weight: 600;">Akun Anda telah dikunci sementara. Jika ini bukan Anda, segera ubah sandi atau hubungi Administrator!</p>
              </div>
            </div>
${emailFooter}
          </div>
        `;
        break;

      case 'PASSWORD_RESET':
        waMessage = `Halo *${user.name}*! 🔑\n\n`
          + `Kata sandi akun kamu baru saja berhasil diatur ulang pada *${currentTime}*.\n\n`
          + `Jika kamu tidak merasa melakukan perubahan ini, segera lapor ke tim Admin ya!`
          + waFooter;

        emailSubject = `🔑 Kata Sandi Berhasil Diubah - ${school.name}`;
        emailBody = `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid #f0f0f0;">
            <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px 20px; text-align: center;">
              <h2 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">Kata Sandi Diperbarui 🔑</h2>
            </div>
            <div style="padding: 30px 20px;">
              <p style="font-size: 16px; color: #374151; margin-top: 0;">Halo <strong>${user.name}</strong>,</p>
              <p style="font-size: 15px; color: #4b5563; line-height: 1.6;">Kata sandi Anda berhasil diatur ulang pada <strong>${currentTime}</strong>.</p>
              <p style="font-size: 15px; color: #4b5563;">Anda sekarang dapat masuk ke aplikasi menggunakan kata sandi yang baru.</p>
            </div>
${emailFooter}
          </div>
        `;
        break;
      case 'LOGIN_SUCCESS':
        waMessage = `Halo *${user.name}*! 👋\n\n`
          + `Sistem mencatat ada *Login Baru* ke akunmu nih.\n\n`
          + `🕒 *Waktu:* ${currentTime}\n`
          + `💻 *Akses:* ${data.browser || 'Perangkat Baru'}\n\n`
          + `Aman kan? Kalau kamu nggak merasa login, buruan ganti password ya biar aman! 🕵️‍♂️`
          + waFooter;

        emailSubject = `👋 Ada Login Baru ke Akun Anda - ${school.name}`;
        emailBody = `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid #f0f0f0;">
            <div style="background: linear-gradient(135deg, #10b981 0%, #047857 100%); padding: 30px 20px; text-align: center;">
              <h2 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">Login Berhasil 👋</h2>
            </div>
            <div style="padding: 30px 20px;">
              <p style="font-size: 16px; color: #374151; margin-top: 0;">Halo <strong>${user.name}</strong>,</p>
              <p style="font-size: 15px; color: #4b5563; line-height: 1.6;">Sistem mendeteksi adanya akses login sukses ke akun Anda.</p>
              <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 25px 0;">
                <p style="margin: 5px 0; font-size: 14px; color: #64748b;"><strong>🕒 Waktu:</strong> <span style="color: #0f172a;">${currentTime}</span></p>
                <p style="margin: 5px 0; font-size: 14px; color: #64748b;"><strong>💻 Akses:</strong> <span style="color: #0f172a;">${data.browser || 'Perangkat'}</span></p>
              </div>
              <p style="font-size: 14px; color: #64748b;">Jika ini bukan Anda, segera hubungi Administrator untuk mengamankan akun Anda.</p>
            </div>
${emailFooter}
          </div>
        `;
        break;

      case 'ATTENDANCE_RECORDED':
        waMessage = `Halo, *${user.name}*! 👋\n\n`
          + `Absensi kamu hari ini sudah berhasil tercatat di sistem ya. ✅\n\n`
          + `📍 *Lokasi:* ${data.location || 'Area Instansi / Sekolah / Kampus'}\n`
          + `⏰ *Waktu:* ${currentTime}\n`
          + `📌 *Jenis:* ${data.extraInfo || 'Absen Reguler'}\n\n`
          + `Semangat beraktivitas dan semoga harimu menyenangkan! ✨`
          + waFooter;

        emailSubject = `🎉 Berhasil! Tanda Terima Absensi - ${school.name}`;
        emailBody = `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid #f0f0f0;">
            <div style="background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); padding: 30px 20px; text-align: center;">
              <h2 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">Hore! Absen Berhasil 🎉</h2>
            </div>
            <div style="padding: 30px 20px;">
              <p style="font-size: 16px; color: #374151; margin-top: 0;">Halo <strong>${user.name}</strong>,</p>
              <p style="font-size: 15px; color: #4b5563; line-height: 1.6;">Terima kasih sudah melakukan absensi hari ini. Kehadiranmu sangat berarti bagi kemajuan instansi / sekolah / kampus kita!</p>
              
              <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 25px 0;">
                <p style="margin: 5px 0; font-size: 14px; color: #64748b;"><strong>📍 Lokasi:</strong> <span style="color: #0f172a;">${data.location || 'Area Instansi / Sekolah'}</span></p>
                <p style="margin: 5px 0; font-size: 14px; color: #64748b;"><strong>⏰ Waktu:</strong> <span style="color: #0f172a;">${currentTime}</span></p>
                <p style="margin: 5px 0; font-size: 14px; color: #64748b;"><strong>📌 Jenis:</strong> <span style="color: #0f172a;">${data.extraInfo || 'Absen Reguler'}</span></p>
              </div>
              
              <p style="font-size: 15px; color: #4b5563; text-align: center; margin-bottom: 0;">Semangat terus dan <em>have a great day!</em> ✨</p>
            </div>
${emailFooter}
          </div>
        `;
        break;

      case 'ATTENDANCE_REMINDER':
        waMessage = `Halo *${user.name}*, selamat pagi! ☀️\n\n`
          + `Wah, sepertinya kamu belum absen hari ini nih. Yuk, segera lakukan presensi di aplikasi agar kehadiranmu tercatat! 🏃‍♂️💨\n\n`
          + `(Abaikan pesan ini jika kamu sedang cuti atau berhalangan hadir ya).`
          + waFooter;

        emailSubject = `☀️ Yuk, Jangan Lupa Absen Hari Ini! - ${school.name}`;
        emailBody = `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid #f0f0f0;">
            <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px 20px; text-align: center;">
              <h2 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">Pengingat Presensi ☀️</h2>
            </div>
            <div style="padding: 30px 20px;">
              <p style="font-size: 16px; color: #374151; margin-top: 0;">Halo <strong>${user.name}</strong>,</p>
              <p style="font-size: 15px; color: #4b5563; line-height: 1.6;">Sistem kami mencatat bahwa kamu <strong>belum melakukan presensi masuk</strong> untuk hari ini.</p>
              <p style="font-size: 15px; color: #4b5563; line-height: 1.6;">Yuk, segera buka aplikasi dan catat kehadiranmu sebelum terlambat! 🏃‍♂️💨</p>
              <p style="font-size: 13px; color: #94a3b8; margin-top: 20px;"><em>*Abaikan email ini jika Anda sedang cuti atau berhalangan hadir.</em></p>
            </div>
${emailFooter}
          </div>
        `;
        break;
        
      case 'LEAVE_SUBMITTED':
        waMessage = `Halo *${user.name}*! 📝\n\n`
          + `Pengajuan *${data.extraInfo || 'Izin/Cuti'}* kamu sudah kami terima dengan baik.\n\n`
          + `📅 *Tanggal:* ${data.time}\n`
          + `💬 *Alasan:* ${data.location || '-'}\n\n`
          + `Mohon bersabar ya, admin akan segera memproses pengajuanmu. Nanti kami kabari lagi hasilnya! ⏳`
          + waFooter;

        emailSubject = `📝 Pengajuan ${data.extraInfo || 'Izin/Cuti'} Sedang Diproses - ${school.name}`;
        emailBody = `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid #f0f0f0;">
            <div style="background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); padding: 30px 20px; text-align: center;">
              <h2 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">Pengajuan Diterima 📝</h2>
            </div>
            <div style="padding: 30px 20px;">
              <p style="font-size: 16px; color: #374151; margin-top: 0;">Halo <strong>${user.name}</strong>,</p>
              <p style="font-size: 15px; color: #4b5563; line-height: 1.6;">Pengajuan <strong>${data.extraInfo || 'Izin/Cuti'}</strong> Anda untuk tanggal <strong>${data.time}</strong> telah masuk ke dalam antrean sistem kami.</p>
              
              <div style="background-color: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                <p style="margin: 0; font-size: 14px; color: #0369a1;"><strong>💬 Alasan/Keterangan:</strong><br>${data.location || '-'}</p>
              </div>
              
              <p style="font-size: 14px; color: #64748b; line-height: 1.6;">Mohon bersabar ya, Kepala Sekolah / Rektor / Admin akan segera meninjau permohonan Anda. Anda akan menerima notifikasi otomatis ketika statusnya sudah berubah! ⏳</p>
            </div>
${emailFooter}
          </div>
        `;
        break;

      case 'LEAVE_STATUS_UPDATED':
        waMessage = `Halo *${user.name}*! 🔔\n\n`
          + `Ada *update* nih tentang pengajuan izin/cuti kamu untuk tanggal *${data.time}*.\n\n`
          + `Status saat ini: ${data.extraInfo === 'approved' ? '✅ *DISETUJUI*' : '❌ *DITOLAK*'}\n`
          + (data.location ? `📝 *Pesan Admin:* ${data.location}\n\n` : '\n')
          + `Cek detail selengkapnya di aplikasi ya. Terima kasih! 🙏`
          + waFooter;

        emailSubject = `🔔 Pembaruan Status Izin/Cuti: ${data.extraInfo === 'approved' ? 'DISETUJUI ✅' : 'DITOLAK ❌'} - ${school.name}`;
        emailBody = `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid #f0f0f0;">
            <div style="background: linear-gradient(135deg, ${data.extraInfo === 'approved' ? '#10b981 0%, #059669' : '#ef4444 0%, #b91c1c'} 100%); padding: 30px 20px; text-align: center;">
              <h2 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">Status Pengajuan ${data.extraInfo === 'approved' ? 'Disetujui ✅' : 'Ditolak ❌'}</h2>
            </div>
            <div style="padding: 30px 20px;">
              <p style="font-size: 16px; color: #374151; margin-top: 0;">Halo <strong>${user.name}</strong>,</p>
              <p style="font-size: 15px; color: #4b5563; line-height: 1.6;">Permohonan izin/cuti Anda untuk tanggal <strong>${data.time}</strong> telah selesai ditinjau oleh Admin / Pimpinan Instansi.</p>
              
              <div style="background-color: ${data.extraInfo === 'approved' ? '#ecfdf5' : '#fef2f2'}; border-radius: 8px; padding: 20px; margin: 25px 0; text-align: center; border: 1px solid ${data.extraInfo === 'approved' ? '#a7f3d0' : '#fecaca'};">
                <span style="display: inline-block; padding: 8px 16px; border-radius: 20px; background-color: ${data.extraInfo === 'approved' ? '#10b981' : '#ef4444'}; color: white; font-weight: bold; letter-spacing: 1px;">
                  ${data.extraInfo === 'approved' ? 'DISETUJUI' : 'DITOLAK'}
                </span>
              </div>
              
              ${data.location ? `
              <div style="background-color: #f8fafc; border-left: 4px solid #94a3b8; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                <p style="margin: 0; font-size: 14px; color: #475569;"><strong>📝 Catatan dari Admin:</strong><br>${data.location}</p>
              </div>` : ''}
              
              <p style="font-size: 14px; color: #64748b;">Silakan periksa aplikasi untuk informasi lebih detail.</p>
            </div>
${emailFooter}
          </div>
        `;
        break;
        
      case 'MONTHLY_ATTENDANCE_SUMMARY':
        waMessage = `*REKAPITULASI PRESENSI BULANAN - ${appName}*\n\n`
          + `Halo ${user.name},\n`
          + `Berikut adalah rangkuman kehadiran Anda untuk bulan *${data.time}*:\n\n`
          + `${data.extraInfo}\n\n`
          + `Terima kasih atas dedikasi dan kinerja Anda bulan ini. Tetap semangat!`
          + waFooter;

        emailSubject = `Rekapitulasi Kehadiran Bulanan - ${school.name}`;
        emailBody = `
          <div style="font-family: Arial, sans-serif; color: #333;">
            <h2 style="color: #6741d9;">Rekapitulasi Presensi Bulanan</h2>
            <p>Halo <strong>${user.name}</strong>,</p>
            <p>Berikut adalah laporan rangkuman kehadiran Anda untuk bulan <strong>${data.time}</strong>:</p>
            <div style="background: #f3f0ff; padding: 15px; border-left: 4px solid #6741d9; font-size: 14px; white-space: pre-line;">
              ${data.extraInfo}
            </div>
            <p>Terima kasih atas dedikasi Anda. Jika ada ketidaksesuaian data, mohon hubungi Administrator.</p>
${emailFooter}
          </div>
        `;
        break;

      case 'BROADCAST_MESSAGE':
        waMessage = `*📢 PENGUMUMAN SEKOLAH - ${appName}*\n\n`
          + `Halo ${user.name},\n`
          + `${data.extraInfo}`
          + waFooter;

        emailSubject = `📢 Pengumuman Penting - ${school.name}`;
        emailBody = `
          <div style="font-family: Arial, sans-serif; color: #333;">
            <h2 style="color: #e03131;">📢 Pengumuman Sekolah</h2>
            <p>Halo <strong>${user.name}</strong>,</p>
            <div style="background: #fff5f5; padding: 20px; border-left: 4px solid #e03131; font-size: 16px; white-space: pre-line;">
              ${data.extraInfo}
            </div>
            <p>Mohon agar pengumuman ini menjadi perhatian.</p>
${emailFooter}
          </div>
        `;
        break;

      default:
        waMessage = `*PEMBERITAHUAN - ${appName}*\n\nHalo ${user.name},\nAda pembaruan pada akun Anda.` + waFooter;
        emailSubject = `Pemberitahuan Sistem - ${school.name}`;
        emailBody = `<p>Halo ${user.name}, ada pembaruan pada akun Anda.</p>`;
    }

    // 1. Log System (Terekam di sistem admin)
    db.addSystemLog({
      type: 'notification',
      title: `Notifikasi: ${eventType}`,
      message: `Proses kirim WA & Email ke ${user.name} (${user.phone || '-'} | ${user.email || '-'})`,
      recipient: user.id
    });

    // 2. Kirim WhatsApp via Cloud Function (Proxy Server)

    if (eventType === 'OTP_CODE' && data?.extraInfo) {
      toast.success(`🔐 KODE OTP LOGIN ANDA: [ ${data.extraInfo} ]`, { duration: 30000, icon: '🔑' });
    }

    // [FASE-3-SECURITY] Ganti fetch langsung ke WA Gateway dengan Cloud Function proxy
    // Frontend tidak lagi memegang atau mengirim API Key ke luar
    if (user.phone && tenantId) {
      let cleanPhone = user.phone.replace(/\D/g, '');
      if (cleanPhone.startsWith('0')) cleanPhone = '62' + cleanPhone.substring(1);

      const toastWaId = eventType !== 'OTP_CODE' ? toast.loading(`Mengirim WhatsApp ke ${cleanPhone}...`) : undefined;

      callSendWhatsApp({ tenantId, phone: cleanPhone, message: waMessage })
        .then((res) => {
          if (res.success) {
            console.log("WA Proxy: Terkirim via", res.provider);
            if (toastWaId) toast.success(`WhatsApp terkirim ke ${user.name}! 📱`, { id: toastWaId });
          } else {
            console.error("WA Proxy Gagal:", res.message);
            if (toastWaId) toast.error(`WhatsApp Gagal: ${res.message} ❌`, { id: toastWaId });
            else toast.error(`WhatsApp Gagal: ${res.message} ❌`, { duration: 6000 });
          }
        })
        .catch((err) => {
          console.error("WA Proxy Error:", err);
          const errMsg = `WhatsApp Error: ${err?.message || 'Koneksi ke proxy gagal'} ❌`;
          if (toastWaId) toast.error(errMsg, { id: toastWaId });
          else toast.error(errMsg, { duration: 6000 });
        });
    } else if (eventType !== 'OTP_CODE') {
      let reasons: string[] = [];
      if (!tenantId) reasons.push("Tenant ID tidak ditemukan di sesi");
      if (!user.phone) reasons.push("No. WhatsApp Anda belum diisi di profil");
      toast.error(`WhatsApp tidak dikirim: ${reasons.join(" & ")} ⚠️`, { id: `wa_skip_${eventType}` });
    }

    // 3. Kirim Email via Google Apps Script (GAS) Web App
    if (gasEmailUrl && user.email) {
      const toastEmailId = eventType !== 'OTP_CODE' ? toast.loading(`Mengirim Email ke ${user.email}...`) : undefined;
      fetch(gasEmailUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8' 
        },
        body: JSON.stringify({
          to: user.email,
          subject: emailSubject,
          htmlBody: emailBody
        })
      }).then(res => res.json())
      .then(res => {
         if(res.status === 'success') {
           console.log("GAS: Email terkirim ke", user.email);
           if (toastEmailId) toast.success(`Email terkirim ke ${user.email}! ✉️`, { id: toastEmailId });
         } else {
           console.error("GAS Gagal:", res);
           if (toastEmailId) toast.error(`Email Gagal: ${res.message || 'Cek URL Web App'} ❌`, { id: toastEmailId });
         }
      })
      .catch(err => {
        console.error("GAS API Error:", err);
        if (toastEmailId) toast.error(`Email mungkin terkirim, cek inbox. (Info: ${err.message}) ⚠️`, { id: toastEmailId });
      });
    } else if (eventType !== 'OTP_CODE') {
      let reasons: string[] = [];
      if (!gasEmailUrl) reasons.push("URL Web App Google belum diisi");
      if (!user.email) reasons.push("Alamat Email Anda belum diisi di profil");
      toast.error(`Email tidak dikirim: ${reasons.join(" & ")} ⚠️`, { id: `email_skip_${eventType}` });
    }

    // Fallback UI Notification
    if (!gasEmailUrl && eventType !== 'OTP_CODE') {
       toast("🔔 API Notifikasi belum diatur. Pesan disimpan di Log.", { id: `notif_sim_${eventType}` });
    }

    return { waMessage, emailSubject, emailBody };
  }
};
