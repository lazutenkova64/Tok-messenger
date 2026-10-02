const fs = require('fs');
const lines = fs.readFileSync('F:/Tok-messenger-new/index.html', 'utf8').split('\n');

// Track brace depth with line numbers
let depth = 0;
let stack = []; // stores {line, context}

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Remove single-line comments
    let processed = '';
    let inString = false;
    let stringCh = '';
    let inTpl = false;
    let inComment = false;
    
    for (let j = 0; j < line.length; j++) {
        const ch = line[j];
        const next = line[j + 1];
        
        // Handle multi-line comments
        if (!inString && !inTpl && ch === '/' && next === '*') {
            inComment = true;
            j++;
            continue;
        }
        if (inComment) {
            if (ch === '*' && next === '/') {
                inComment = false;
                j++;
            }
            continue;
        }
        
        // Skip single-line comments
        if (!inString && !inTpl && ch === '/' && next === '/') {
            break;
        }
        
        // Handle template literals
        if (ch === '`' && !inString) {
            inTpl = !inTpl;
            processed += ch;
            continue;
        }
        if (inTpl) {
            processed += ch;
            continue;
        }
        
        // Handle strings
        if ((ch === "'" || ch === '"') && !inString) {
            inString = true;
            stringCh = ch;
            processed += ch;
            continue;
        }
        if (inString && ch === stringCh) {
            // Check escape
            let escaped = false;
            let k = j - 1;
            while (k >= 0 && line[k] === '\\') { escaped = !escaped; k--; }
            if (!escaped) {
                inString = false;
            }
        }
        
        if (ch === '{' || ch === '}' || ch === '(' || ch === ')' || ch === '[' || ch === ']') {
            processed += ch;
        }
    }
    
    // Count braces in processed line
    for (let j = 0; j < processed.length; j++) {
        const ch = processed[j];
        if (ch === '{') {
            depth++;
            stack.push({ line: i + 1, context: line.trim().substring(0, 60) });
        } else if (ch === '}') {
            if (depth > 0) {
                depth--;
                stack.pop();
            }
        }
    }
}

console.log('Total lines:', lines.length);
console.log('Final brace depth:', depth);

if (stack.length > 0) {
    console.log('\nUnclosed braces (' + stack.length + '):');
    stack.forEach(s => {
        console.log('  Line ' + s.line + ': ' + s.context);
    });
}
