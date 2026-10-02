import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

m = re.search(r'<script>\s*([\s\S]*?)\s*</script>', content)
if not m:
    print('No script tag found')
    exit(0)

js = m.group(1)

# Удаляем строковые литералы и комментарии
js = re.sub(r'`(?:[^`\\]|\\.)*`', '""', js)
js = re.sub(r'"(?:[^"\\]|\\.)*"', '""', js)
js = re.sub(r"'(?:[^'\\]|\\.)*'", "''", js)
js = re.sub(r'//[^\n]*', '', js)
js = re.sub(r'/\*[\s\S]*?\*/', '', js)

stack = []
lines = js.split('\n')

for i, line in enumerate(lines):
    for j, ch in enumerate(line):
        if ch in '{([':
            stack.append((ch, i + 1, line.strip()[:80]))
        elif ch in '})]':
            if not stack:
                pass  # ignore extra
            else:
                stack.pop()

print(f'Remaining unclosed: {len(stack)}')
for s in stack:
    print(f'  {s[0]} at line {s[1]}: {s[2]}')
