import { useEffect, useRef, useState } from 'react';
import { getDatabase, ref, query, orderByChild, startAt, onChildAdded, off } from 'firebase/database';
import { useAuth } from '../components/AuthContext';

export function useRealtimeNotifications() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>(Notification.permission);
  const [showSoftPrompt, setShowSoftPrompt] = useState(false);
  const isListenerAttached = useRef(false);

  // Periksa apakah pengguna belum pernah ditanya dan butuh prompt
  useEffect(() => {
    if (user && (user.role === 'admin' || user.role === 'principal')) {
      const savedPref = localStorage.getItem('abdi_notification_pref');
      if (!savedPref && Notification.permission === 'default') {
        setShowSoftPrompt(true);
      }
    }
  }, [user]);

  const requestPermission = async () => {
    if (!('Notification' in window)) {
      alert("Browser Anda tidak mendukung Web Notifications.");
      return;
    }
    const result = await Notification.requestPermission();
    setPermission(result);
    localStorage.setItem('abdi_notification_pref', result);
    setShowSoftPrompt(false);
  };

  const dismissPrompt = () => {
    setShowSoftPrompt(false);
    localStorage.setItem('abdi_notification_pref', 'dismissed');
  };

  useEffect(() => {
    // Hanya aktifkan listener jika izin diberikan dan pengguna adalah admin/kepala sekolah
    if (permission !== 'granted' || !user || (user.role !== 'admin' && user.role !== 'principal')) {
      return;
    }

    if (isListenerAttached.current) return;
    
    const db = getDatabase();
    // Path ke entitas absensi
    const activeSession = JSON.parse(localStorage.getItem('active_session_user') || '{}');
    const tenantId = activeSession.tenantId || 'default';
    const attendanceRef = ref(db, `tenants/${tenantId}/attendance`);

    // Hanya dengarkan data absensi HARI INI berdasarkan string date (karena timestamp mungkin Unix atau Date)
    // Berdasarkan FirebaseSync, kita bisa gunakan timestamp (ms)
    // Waktu mounting (detik saat komponen mulai dirender)
    const mountTime = new Date().getTime();

    const q = query(
      attendanceRef,
      orderByChild('timestamp'), 
      startAt(mountTime - (1000 * 60)) // Tarik dari 1 menit lalu (amannya)
    );

    const handleNewAttendance = (snapshot: any) => {
      const data = snapshot.val();
      if (!data) return;

      // Filter: Hanya notifikasi jika data baru (timestamp > waktu mount komponen)
      // Ini mencegah spam notifikasi untuk data lama saat aplikasi baru dimuat.
      if (data.timestamp && data.timestamp > mountTime) {
        if (data.status === 'Terlambat' || data.isOutRadius) {
          const title = "Peringatan Anomali Absensi";
          const body = `${data.userName || 'Pegawai'} presensi dengan status: ${data.status} ${data.isOutRadius ? '(Di Luar Radius)' : ''}`;
          
          new Notification(title, {
            body,
            icon: '/logo.png', // Ganti dengan path logo aplikasi jika perlu
            tag: `absensi_${data.id || data.timestamp}` // Mencegah duplikasi notifikasi yang sama
          });
        }
      }
    };

    // Pasang listener
    onChildAdded(q, handleNewAttendance);
    isListenerAttached.current = true;

    // Cleanup memori (sangat penting untuk mencegah Memory Leak)
    return () => {
      off(q, 'child_added', handleNewAttendance);
      isListenerAttached.current = false;
    };
  }, [permission, user]);

  return {
    permission,
    showSoftPrompt,
    requestPermission,
    dismissPrompt
  };
}
