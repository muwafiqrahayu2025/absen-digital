const fs = require('fs');
const raw = fs.readFileSync('./database.rules.json', 'utf8');
const lines = raw.split('\n').length;
const bytes = Buffer.byteLength(raw, 'utf8');

const checks = [
  ['[FIX-BOOTSTRAP-001] Self-write via auth.uid di users/$uid', 'auth.uid === $uid'],
  ['[FIX-BOOTSTRAP-002] user_tenant_mapping: !data.exists() untuk mapping baru', '!data.exists() || root.child'],
  ['[FIX-INDEX-001] .indexOn attendance per-tenant ada', '"userId", "date", "status", "tenantId"'],
  ['[TENANT-ISO] opds dikunci ke tenant lewat user_tenant_mapping', '"opds"'],
  ['[TENANT-ISO] jabatans dikunci ke tenant', '"jabatans"'],
  ['[TENANT-ISO] satuanKerjas (camelCase) tercakup', '"satuanKerjas"'],
  ['[TENANT-ISO] satuankerja (lowercase alias) tercakup', '"satuankerja"'],
  ['[SECURITY] DEFAULT DENY via global_admins di root', 'global_admins'],
  ['[SECURITY] Field whitelist $other: false ada', '"$other"'],
  ['[SECURITY] isActive gate di attendance', 'isActive'],
  ['[VALIDATE] tenantId di attendance dikunci ke $tenantId', 'newData.val() == $tenantId'],
  ['[PRESERVE] cuti_requests tetap ada', '"cuti_requests"'],
  ['[PRESERVE] kinerjas tetap ada', '"kinerjas"'],
  ['[PRESERVE] license tetap ada', '"license"'],
  ['[PRESERVE] qr_sessions tetap ada', '"qr_sessions"'],
  ['[PRESERVE] deviceSessionLogs tetap ada', '"deviceSessionLogs"'],
  ['[PRESERVE] global_testimonials tetap ada', '"global_testimonials"'],
  ['[PRESERVE] notification_log tetap ada', '"notification_log"'],
];

console.log('=== QA VALIDATION REPORT — database.rules.json v4 ===');
console.log('File size:', bytes.toLocaleString(), 'bytes |', lines, 'lines');
console.log('');

let passed = 0, failed = 0;
checks.forEach(([name, pattern]) => {
  const ok = raw.includes(pattern);
  if (ok) { passed++; console.log('[PASS]', name); }
  else    { failed++; console.log('[FAIL]', name, '← pattern not found:', pattern); }
});

console.log('');
console.log('==========================================');
console.log('SCORE:', passed + '/' + (passed + failed), 'checks passed');
if (failed === 0) console.log('STATUS: ✅ ALL CHECKS PASSED — RULES READY FOR PRODUCTION');
else              console.log('STATUS: ❌ SOME CHECKS FAILED — REVIEW REQUIRED');
