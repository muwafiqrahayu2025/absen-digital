/**
 * Skrip utilitas untuk mengonversi serviceAccountKey.json menjadi Base64 string.
 * Berguna untuk di-copy-paste ke Environment Variables (misal Vercel/Railway).
 */
const fs = require('fs');
const path = require('path');

const keyPath = path.join(__dirname, '..', 'api', 'serviceAccountKey.json');

if (!fs.existsSync(keyPath)) {
  console.error('⛔ Error: File serviceAccountKey.json tidak ditemukan di:', keyPath);
  console.log('Pastikan Anda sudah menaruh file tersebut di folder backend/api/');
  process.exit(1);
}

try {
  const fileContent = fs.readFileSync(keyPath, 'utf8');
  
  // Validasi apakah ini JSON yang valid
  JSON.parse(fileContent);
  
  // Konversi ke Base64
  const base64Str = Buffer.from(fileContent).toString('base64');
  
  console.log('✅ Konversi Berhasil!\n');
  console.log('Copy string di bawah ini dan paste sebagai value untuk FIREBASE_SERVICE_ACCOUNT_BASE64 di dashboard hosting Anda:\n');
  console.log('================================================================================');
  console.log(base64Str);
  console.log('================================================================================\n');
  console.log('PENTING: Jangan berikan string ini kepada siapa pun karena ini adalah kredensial admin.');
} catch (error) {
  console.error('⛔ Error saat memproses file (pastikan formatnya JSON yang valid):', error.message);
}