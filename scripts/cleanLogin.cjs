const fs = require('fs');

let content = fs.readFileSync('src/pages/Login.tsx', 'utf8');

// Remove demo imports
content = content.replace(/import\s+\{\s*seedDemoUsers,\s*DEMO_EMAIL_MAP\s*\}\s*from\s*"\.\.\/lib\/seedDemoUsers";\r?\n?/g, '');

// Remove DEMO_FALLBACK_PROFILES
content = content.replace(/\/\/ --- Pemetaan username demo[\s\S]*?};\r?\n?\r?\n?/g, '');

// Inside handleLogin
// Remove: const isDemoAccount = Object.prototype.hasOwnProperty.call(DEMO_EMAIL_MAP, currentUsername);
content = content.replace(/const isDemoAccount\s*=\s*Object\.prototype\.hasOwnProperty\.call\(DEMO_EMAIL_MAP,\s*currentUsername\);\r?\n?/g, '');

// Replace the if (isDemoAccount) block
content = content.replace(/if\s*\(isDemoAccount\)\s*\{\s*loginEmail\s*=\s*DEMO_EMAIL_MAP\[currentUsername\];\s*\}\s*else\s*if/g, 'if');

// Remove fallback block
content = content.replace(/\/\/ 5\. Fallback untuk akun demo[\s\S]*?\} else if \(!userProfile && !isDemoAccount\)/g, '// 5. Verifikasi profil\n      if (!userProfile)');

// Remove Panel Demo Akun
content = content.replace(/\{\/\*\s*--\s*Panel Demo Akun\s*--\s*\*\/\}[\s\S]*?\{\/\*\s*Tombol Inisialisasi Database Demo[\s\S]*?\}\s*\)\}\r?\n?\s*<\/div>\r?\n?/g, '');

fs.writeFileSync('src/pages/Login.tsx', content, 'utf8');
