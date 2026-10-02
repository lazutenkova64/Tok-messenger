import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

m = re.search(r'<script>\s*([\s\S]*?)\s*</script>', content)
js = m.group(1)

# Удаляем строковые литералы
js = re.sub(r'`(?:[^`\\]|\\.)*`', '""', js)
js = re.sub(r'"(?:[^"\\]|\\.)*"', '""', js)
js = re.sub(r"'(?:[^'\\]|\\.)*'", "''", js)
js = re.sub(r'//[^\n]*', '', js)
js = re.sub(r'/\*[\s\S]*?\*/', '', js)

# Подсчёт
opens = {'{': 0, '(': 0, '[': 0}
closes = {'}': 0, ')': 0, ']': 0}

for ch in js:
    if ch in opens:
        opens[ch] += 1
    elif ch in closes:
        closes[ch] += 1

print('Brace counts:')
for k in opens:
    diff = opens[k] - closes[k]
    status = 'OK' if diff == 0 else f'MISMATCH (+{diff})'
    print(f'  {k}: {opens[k]} open, {closes[k]} close -> {status}')
