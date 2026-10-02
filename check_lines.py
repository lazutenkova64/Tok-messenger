import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

m = re.search(r'<script>\s*([\s\S]*?)\s*</script>', content)
js = m.group(1)
lines = js.split('\n')

print(f'Line 2331: {repr(lines[2330][:100])}')
print(f'Line 2332: {repr(lines[2331][:100])}')
print(f'Line 2335: {repr(lines[2334][:100])}')
print(f'Line 2336: {repr(lines[2335][:100])}')
print(f'Total lines: {len(lines)}')
print(f'Last 5 lines:')
for l in lines[-5:]:
    print(f'  {repr(l[:100])}')
