const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');
const scriptMatch = content.match(/<script>([\s\S]*?)<\/script>/);
if (scriptMatch) {
    const js = scriptMatch[1];
    // Use Acorn parser if available, otherwise basic check
    try {
        // Check if file ends with valid JS
        const testCode = js + '\n//# sourceURL=test';
        new Function(testCode);
        console.log('JS SYNTAX OK');
    } catch (e) {
        console.log('JS SYNTAX ERROR:', e.message);
        // Find line number
        const lines = js.substring(0, e.stack ? 0 : 0).split('\n');
        console.log('Error at position near end of file');
    }
} else {
    console.log('No script tag found');
}
