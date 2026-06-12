const fs = require('fs');
const html = fs.readFileSync('public/index.html', 'utf8');
const lines = html.split('\n');
let depth = 0;
lines.forEach((line, i) => {
    const o = (line.match(/<div\b[^>]*>/g) || []).length;
    const c = (line.match(/<\/div>/g) || []).length;
    depth += o - c;
    if (line.includes('class="section"')) {
        console.log(`Line ${i+1}: ${line.trim()} (Depth before processing this line: ${depth - o + c}, Depth after: ${depth})`);
    }
});
console.log(`Final Depth (should be 0 for perfect balance if we count from top): ${depth}`);
