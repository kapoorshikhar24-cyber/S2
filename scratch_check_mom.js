const fs = require('fs');
const path = require('path');

function searchDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (file !== 'node_modules' && file !== '.git' && file !== '.vercel') {
                searchDir(fullPath);
            }
        } else {
            if (file.endsWith('.js') || file.endsWith('.html') || file.endsWith('.py')) {
                const content = fs.readFileSync(fullPath, 'utf8');
                let matches = [];
                const lines = content.split('\n');
                lines.forEach((line, idx) => {
                    if (line.toLowerCase().includes('mom.html') || line.toLowerCase().includes('mom_meetings') || (line.includes('MOM') && !line.includes('moment'))) {
                        matches.push(`${idx + 1}: ${line.trim()}`);
                    }
                });
                if (matches.length > 0) {
                    console.log(`\nFile: ${fullPath}`);
                    matches.slice(0, 10).forEach(m => console.log(m));
                    if (matches.length > 10) console.log(`... and ${matches.length - 10} more`);
                }
            }
        }
    }
}

searchDir('.');
