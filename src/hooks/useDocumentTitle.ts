import { useEffect } from 'react';
import { db } from '../lib/db';

export function useDocumentTitle(pageTitle?: string) {
  useEffect(() => {
    const school = db.getSchool();
    const baseName = school.name ? `${school.name} - ABDI Presensi` : 'ABDI Absen Digital';
    document.title = pageTitle ? `${pageTitle} • ${baseName}` : baseName;
  }, [pageTitle]);
}
