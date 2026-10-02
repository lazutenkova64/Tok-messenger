import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Извлекаем только содержимое между <script> и </script>
m = re.search(r'<script>\s*([\s\S]*?)\s*</script>', content)
if not m:
    print('No script tag found')
    exit(0)

js = m.group(1)
stack = []  # list of (char, line_number)
errors = []
lines = js.split('\n')

for i, line in enumerate(lines):
    for j, ch in enumerate(line):
        if ch in '{([':
            stack.append((ch, i + 1))
        elif ch in '})]':
            if not stack:
                errors.append(f'Extra {ch} at line {i + 1}')
            else:
                top = stack.pop()
                pairs = {'}': '{', ')': '(', ']': '['}
                if top[0] != pairs[ch]:
                    errors.append(f'Mismatch: {ch} at line {i+1} col {j+1}, expected closing for {top[0]} at line {top[1]}')

print(f'Remaining unclosed: {len(stack)}')
for e in errors[-30:]:
    print(e)
if stack:
    print('\nUnclosed brackets:')
    for s in stack[-15:]:
        print(f'  {s[0]} at line {s[1]}')
