const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');
const m = content.match(/<script>\s*([\s\S]*?)\s*<\/script>/);
if (!m) { console.log('No script'); process.exit(1); }
const js = m[1];
let stack = [];
const lines = js.split('\n');
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (let j = 0; j < line.length; j++) {
        const ch = line[j];
        if (ch === '{') stack.push({ ch, line: i + 1, col: j + 1 });
        else if (ch === '}') {
            if (stack.length === 0) {
                console.log('Extra } at line ' + (i + 1) + ' col ' + (j + 1));
            } else {
                const top = stack.pop();
                if (top.ch !== '{') {
                    console.log('Mismatch: } at line ' + (i + 1) + ' col ' + (j + 1) + ' expected ' + top.ch + ' at line ' + top.line);
                }
            }
        }
        else if (ch === '(') stack.push({ ch, line: i + 1, col: j + 1 });
        else if (ch === ')') {
            if (stack.length === 0) {
                console.log('Extra ) at line ' + (i + 1) + ' col ' + (j + 1));
            } else {
                const top = stack.pop();
                if (top.ch !== '(') {
                    console.log('Mismatch: ) at line ' + (i + 1) + ' col ' + (j + 1) + ' expected ' + top.ch + ' at line ' + top.line);
                }
            }
        }
    }
}
console.log('Remaining open: ' + stack.length);
if (stack.length > 0) {
    for (const s of stack.slice(-10)) {
        console.log('  Unclosed ' + s.ch + ' at line ' + s.line + ' col ' + s.col);
    }
}
