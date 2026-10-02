const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');
const lines = content.split('\n');

let inScript = false;
let depth = 0;
let lastOpenLine = -1;
let lastOpenDepth = 0;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.includes('<script>') && !line.includes('src=')) {
        inScript = true;
        continue;
    }
    
    if (inScript && line.includes('</script>')) {
        console.log(`Final depth: ${depth}`);
        if (depth !== 0) {
            console.log(`Last open at line ${lastOpenLine + 1} when depth was ${lastOpenDepth - 1}`);
            const showStart = Math.max(0, lastOpenLine - 3);
            const showEnd = Math.min(lines.length - 1, lastOpenLine + 10);
            for (let j = showStart; j <= showEnd; j++) {
                const marker = j === lastOpenLine ? ' <-- LAST OPEN' : '';
                console.log(`  ${j + 1}: ${lines[j]}${marker}`);
            }
        }
        break;
    }
    
    if (inScript) {
        const prevDepth = depth;
        for (const ch of line) {
            if (ch === '{') {
                depth++;
                if (depth > lastOpenDepth) {
                    lastOpenLine = i;
                    lastOpenDepth = depth;
                }
            } else if (ch === '}') {
                depth--;
            }
        }
    }
}
