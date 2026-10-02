const fs = require('fs');
const content = fs.readFileSync('F:/Tok-messenger-new/index.html', 'utf8');
const lines = content.split('\n');

// Check for unclosed template literals
let inTemplate = false;
let templateLine = 0;
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Count backticks (excluding those in HTML comments)
    let backticks = 0;
    let inComment = false;
    for (let j = 0; j < line.length; j++) {
        if (line[j] === '`') backticks++;
    }
    if (backticks % 2 !== 0) {
        console.log(`Line ${i+1}: odd number of backticks (${backticks}): ${line.trim().substring(0, 80)}`);
    }
}

// Check for unclosed strings (simple check)
let inString = false;
let stringChar = '';
let stringLine = 0;
let inTemplateLiteral = false;
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let j = 0;
    while (j < line.length) {
        const ch = line[j];
        
        // Handle template literals
        if (ch === '`' && !inString) {
            if (inTemplateLiteral) {
                inTemplateLiteral = false;
            } else {
                inTemplateLiteral = true;
            }
            j++;
            continue;
        }
        
        if (inTemplateLiteral) {
            j++;
            continue;
        }
        
        // Handle comments
        if (ch === '/' && line[j+1] === '/') break;
        if (ch === '/' && line[j+1] === '*') {
            let commentEnd = line.indexOf('*/', j + 2);
            if (commentEnd === -1) {
                // Multi-line comment - skip to end
                break;
            }
            j = commentEnd + 2;
            continue;
        }
        
        // Handle strings
        if (ch === "'" || ch === '"') {
            if (inString && ch === stringChar) {
                // Check for escape
                let escaped = false;
                let k = j - 1;
                while (k >= 0 && line[k] === '\\') { escaped = !escaped; k--; }
                if (!escaped) inString = false;
            } else if (!inString) {
                inString = true;
                stringChar = ch;
                stringLine = i + 1;
            }
        }
        j++;
    }
}

// Count all braces, parens, brackets
let braces = 0, parens = 0, brackets = 0;
let inTpl = false;
for (let i = 2775; i < lines.length; i++) {
    const line = lines[i];
    let ci = line.indexOf('//');
    if (ci >= 0) line = line.substring(0, ci);
    
    for (let j = 0; j < line.length; j++) {
        const ch = line[j];
        if (ch === '`') { inTpl = !inTpl; continue; }
        if (inTpl) continue;
        if (ch === '{') braces++;
        else if (ch === '}') braces--;
        else if (ch === '(') parens++;
        else if (ch === ')') parens--;
        else if (ch === '[') brackets++;
        else if (ch === ']') brackets--;
    }
}

console.log('\n=== Balance check (from line 2776) ===');
console.log('Braces { :', braces);
console.log('Parens ( :', parens);
console.log('Brackets [ :', brackets);

if (braces !== 0) console.log(`BRACE MISMATCH: ${braces > 0 ? 'missing }' : 'extra }'}`);
if (parens !== 0) console.log(`PAREN MISMATCH: ${parens > 0 ? 'missing )' : 'extra )'}`);
if (brackets !== 0) console.log(`BRACKET MISMATCH: ${brackets > 0 ? 'missing ]' : 'extra ]'}`);
