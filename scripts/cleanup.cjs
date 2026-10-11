const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else { 
            if (file.endsWith('.ts') || file.endsWith('.tsx')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk('./src');

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // Remove imports from demoGuard
    content = content.replace(/import\s+\{?[^}]*\}?\s+from\s+['"]\.{1,2}\/lib\/demoGuard['"];?\r?\n?/g, '');
    content = content.replace(/import\s+\{?[^}]*\}?\s+from\s+['"]\.\/demoGuard['"];?\r?\n?/g, '');
    
    // Replace safeSet, safeRemove, etc.
    content = content.replace(/safeSet\(\s*set\s*,\s*(.*?),\s*(.*?)\)/g, 'set($1, $2)');
    content = content.replace(/safeRemove\(\s*remove\s*,\s*(.*?)\)/g, 'remove($1)');
    content = content.replace(/safeUpdate\(\s*update\s*,\s*(.*?),\s*(.*?)\)/g, 'update($1, $2)');
    content = content.replace(/safePush\(\s*push\s*,\s*(.*?),\s*(.*?)\)/g, 'push($1, $2)');
    content = content.replace(/demoGet\(\s*get\s*,\s*(.*?)\)/g, 'get($1)');

    // In firebaseSync.ts, remove demoGuard interceptions
    if (file.includes('firebaseSync.ts')) {
        content = content.replace(/if\s*\(\s*isDemoSession\(\)\s*\)\s*\{\s*(?:console\.(?:warn|info|log)\([^\)]+\);\s*)?return\s*(?:true|false|null)?;\s*\}/g, '');
        content = content.replace(/if\s*\(\s*isDemoSession\(\)\s*\)\s*return;/g, '');
        content = content.replace(/if\s*\(\s*isDemoSession\(\)\s*\)\s*\{\s*console\.info\([^)]+\);\s*return\s*\[\];\s*\}/g, '');
        content = content.replace(/export\s+\{\s*isDemoSession,\s*demoGet\s*\};\r?\n?/g, '');
    }

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        console.log('Modified:', file);
    }
});
