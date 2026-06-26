import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.alphaproject.absen',
  appName: 'ABDI Absen Digital',
  webDir: 'dist',
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
  server: {
    cleartext: false, // Memaksa semua lalu lintas lokal menggunakan protokol aman (jika memungkinkan) atau HTTPS di luar
  }
};

export default config;
