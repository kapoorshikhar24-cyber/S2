const fs = require('fs');
const lines = fs.readFileSync('public/index.html', 'utf8').split('\n');
let depth = 0;
for(let i=394; i<530; i++) {
    const l = lines[i] || '';
    const o = (l.match(/<div\b[^>]*>/g)||[]).length;
    const c = (l.match(/<\/div>/g)||[]).length;
    depth += o - c;
    console.log(`${i+1}: D[${depth}] +${o} -${c} | ${l.trim()}`);
}
