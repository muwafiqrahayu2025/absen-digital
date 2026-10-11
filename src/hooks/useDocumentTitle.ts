import { useEffect } from 'react';
import { db } from '../lib/db';

export function useDocumentTitle(pageTitle?: string) {
  useEffect(() => {
    const school = ({ name: (JSON.parse(localStorage.getItem("active_session_user") || "{}")).satuanKerja || (JSON.parse(localStorage.getItem("active_session_user") || "{}")).opd || "Instansi", radius: 120, address: "", kopSurat: null, latitude: 0, longitude: 0 } as any);
    const baseName = school.name ? `${school.name} - ABDI Presensi` : 'ABDI Absen Digital';
    document.title = pageTitle ? `${pageTitle} • ${baseName}` : baseName;
  }, [pageTitle]);
}
