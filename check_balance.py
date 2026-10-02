import sys

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Extract script content
import re
script_match = re.search(r'<script>([\s\S]*?)</script>', content)
if not script_match:
    print("No script tag found")
    sys.exit(1)

js = script_match.group(1)
lines = js.split('\n')

depth = 0
last_open_line = -1
last_open_depth = 0
errors = []

for i, line in enumerate(lines):
    prev_depth = depth
    for ch in line:
        if ch == '{':
            depth += 1
            if depth > last_open_depth:
                last_open_line = i
                last_open_depth = depth
        elif ch == '}':
            depth -= 1
            if depth < 0:
                errors.append(f"Line {i+1}: Negative depth {depth}")
    
    if depth < 0:
        errors.append(f"Line {i+1}: depth={depth}, line={line[:80]}")

print(f"Final depth: {depth}")
if errors:
    for e in errors:
        print(f"ERROR: {e}")
else:
    print("No negative depths found")

if depth != 0:
    print(f"Unclosed braces: {depth}")
    print(f"Last open at line {last_open_line + 1} (depth {last_open_depth})")
    start = max(0, last_open_line - 3)
    end = min(len(lines), last_open_line + 10)
    for j in range(start, end):
        marker = " <-- LAST OPEN" if j == last_open_line else ""
        print(f"  {j+1}: {lines[j]}{marker}")
