import { useEffect } from 'react';
import { db } from '../lib/db';
import { format, isSaturday, isSunday } from 'date-fns';
import { toast } from 'react-hot-toast';

export function useAttendanceEmailNotification() {
  useEffect(() => {
    const checkAttendance = () => {
      const school = ({ name: (JSON.parse(localStorage.getItem("active_session_user") || "{}")).satuanKerja || (JSON.parse(localStorage.getItem("active_session_user") || "{}")).opd || "Instansi", radius: 120, address: "", kopSurat: null, latitude: 0, longitude: 0 } as any);
      const limitTime = school.operationalCheckInLimit || '08:00';
      const adminEmail = school.adminEmail;

      if (!adminEmail) return;

      const now = new Date();
      
      // Skip weekends
      if (isSaturday(now) || isSunday(now)) return;

      // Check holidays
      const holidays = db.getHolidays();
      const isHoliday = holidays.some(h => h.date === format(now, 'yyyy-MM-dd'));
      if (isHoliday) return;

      const [limitHour, limitMinute] = limitTime.split(':').map(Number);
      
      // Wait until limit time passes
      if (now.getHours() < limitHour || (now.getHours() === limitHour && now.getMinutes() < limitMinute)) {
        return;
      }

      // We only want to send this once per day
      const todayString = format(now, 'yyyy-MM-dd');
      const lastSentDate = localStorage.getItem('lastEmailNotificationDate');
      
      if (lastSentDate === todayString) return;

      // Find users who have not checked in today
      const users = db.getUsers().filter(u => u.role === 'guru' || u.role === 'staf_sekolah');
      const todayAttendance = db.getAttendance().filter(a => a.date === todayString);

      const missingTeachers = users.filter(user => {
        return !todayAttendance.some(a => a.userId === user.id);
      });

      if (missingTeachers.length > 0) {
        // Send alert simulation
        const missingNames = missingTeachers.map(m => m.name).join(', ');
        
        console.log(`[EMAIL SENDING SIMULATION] to: ${adminEmail}`);
        db.addSystemLog({
          type: "email_alert",
          title: `Peringatan Absensi Guru/Staf - ${todayString}`,
          message: `Terdapat ${missingTeachers.length} guru/staf belum melakukan absensi setelah batas waktu operasional (${limitTime}): ${missingNames}.`,
          recipient: adminEmail
        });

        // Update attendance to Alpha for those users
        const updatedAttendance = db.getAttendance();
        missingTeachers.forEach(t => {
          updatedAttendance.push({
            id: Date.now().toString() + Math.random().toString(),
            userId: t.id,
            date: todayString,
            status: 'Alpha' // Mark as Alpha explicitly
          });
        });
        db.setAttendance(updatedAttendance);

        // [BUG-009 FIX] Kunci localStorage yang benar adalah 'active_session_user'
        // bukan 'auth_user'. Sebelumnya toast admin tidak pernah tampil karena
        // currentUser selalu {} (kunci tidak ditemukan).
        const currentUser = JSON.parse(localStorage.getItem('active_session_user') || '{}');
        if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'kepala_sekolah')) {
          toast.error(`Sistem Otomatis: Email notifikasi absensi telah dikirim ke ${adminEmail}. (Terdapat ${missingTeachers.length} guru/dosen/staf Alpha).`, {
            duration: 8000,
            position: 'bottom-right'
          });
        }

        // Mark as sent
        localStorage.setItem('lastEmailNotificationDate', todayString);
      } else {
        // Everyone was present, but let's just mark it as checked today
        localStorage.setItem('lastEmailNotificationDate', todayString);
      }
    };

    // Run immediately and then every minute
    checkAttendance();
    const interval = setInterval(checkAttendance, 60000);
    
    return () => clearInterval(interval);
  }, []);
}
