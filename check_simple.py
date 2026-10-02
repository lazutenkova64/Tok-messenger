import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

m = re.search(r'<script>\s*([\s\S]*?)\s*</script>', content)
js = m.group(1)

# Удаляем строки
js = re.sub(r'`(?:[^`\\]|\\.)*`', '""', js)
js = re.sub(r'"(?:[^"\\]|\\.)*"', '""', js)
js = re.sub(r"'(?:[^'\\]|\\.)*'", "''", js)
js = re.sub(r'//[^\n]*', '', js)
js = re.sub(r'/\*[\s\S]*?\*/', '', js)

opens = js.count('{')
closes = js.count('}')
parens_open = js.count('(')
parens_close = js.count(')')
brackets_open = js.count('[')
brackets_close = js.count(']')

print(f'{{ : {opens} open, {closes} close, diff={opens-closes}')
print(f'( : {parens_open} open, {parens_close} close, diff={parens_open-parens_close}')
print(f'[ : {brackets_open} open, {brackets_close} close, diff={brackets_open-brackets_close}')
