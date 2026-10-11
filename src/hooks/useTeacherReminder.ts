import { useEffect } from 'react';
import { db } from '../lib/db';
import { format, isSaturday, isSunday, differenceInMinutes } from 'date-fns';
import { toast } from 'react-hot-toast';
import { useAuth } from '../components/AuthContext';

export function useTeacherReminder() {
  const { user } = useAuth();

  useEffect(() => {
    // Only run this for teachers and staff members
    if (!user || (user.role !== 'guru' && user.role !== 'staf_sekolah')) return;

    const checkReminder = () => {
      const school = ({ name: (JSON.parse(localStorage.getItem("active_session_user") || "{}")).satuanKerja || (JSON.parse(localStorage.getItem("active_session_user") || "{}")).opd || "Instansi", radius: 120, address: "", kopSurat: null, latitude: 0, longitude: 0 } as any);
      const limitTime = school.operationalCheckInLimit || '08:00';
      const now = new Date();
      
      // Skip weekends
      if (isSaturday(now) || isSunday(now)) return;

      // Check holidays
      const holidays = db.getHolidays();
      const todayString = format(now, 'yyyy-MM-dd');
      const isHoliday = holidays.some(h => h.date === todayString);
      if (isHoliday) return;

      // Check if user has already checked in today
      const todayAttendance = db.getAttendance().filter(a => a.date === todayString && a.userId === user.id);
      if (todayAttendance.length > 0) return; // Already checked in or marked alpha/izin etc

      const [limitHour, limitMinute] = limitTime.split(':').map(Number);
      
      const limitDate = new Date();
      limitDate.setHours(limitHour, limitMinute, 0, 0);

      // We want to remind 15 minutes before
      const diffMins = differenceInMinutes(limitDate, now);
      
      // If time is within 15 minutes of deadline and hasn't passed
      if (diffMins <= 15 && diffMins > 0) {
        const lastReminderDate = localStorage.getItem(`lastTeacherReminder_${user.id}`);
        if (lastReminderDate !== todayString) {
          toast('Peringatan: 15 menit lagi batas absen masuk akan ditutup. Segera scan QR Code!', {
            icon: '⏰',
            duration: 10000,
            position: 'top-center'
          });
          
          if ("Notification" in window) {
            if (Notification.permission === "granted") {
              new Notification("Peringatan Absensi", {
                body: "15 menit lagi batas absen masuk akan ditutup. Segera scan QR Code!",
                icon: "/favicon.ico"
              });
            } else if (Notification.permission !== "denied") {
              Notification.requestPermission().then(permission => {
                if (permission === "granted") {
                  new Notification("Peringatan Absensi", {
                    body: "15 menit lagi batas absen masuk akan ditutup. Segera scan QR Code!",
                    icon: "/favicon.ico"
                  });
                }
              });
            }
          }

          localStorage.setItem(`lastTeacherReminder_${user.id}`, todayString);
        }
      }
    };

    checkReminder();
    const interval = setInterval(checkReminder, 60000); // Check every minute
    
    return () => clearInterval(interval);
  }, [user]);
}
