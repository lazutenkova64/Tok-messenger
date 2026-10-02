import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

m = re.search(r'<script>\s*([\s\S]*?)\s*</script>', content)
if not m:
    print('No script tag found')
    exit(0)

js = m.group(1)
print(f'JS block length: {len(js)} chars, {len(js.split(chr(10)))} lines')
print(f'First 200 chars: {repr(js[:200])}')
print(f'Last 200 chars: {repr(js[-200:])}')
print(f'\nLine 2330: {repr(js.split(chr(10))[2329])}')
print(f'Line 2331: {repr(js.split(chr(10))[2330])}')
print(f'Line 2332: {repr(js.split(chr(10))[2331])}')
