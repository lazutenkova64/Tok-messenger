# -*- coding: utf-8 -*-
import re

with open('F:/Tok-messenger-new/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

lines = content.split('\n')

# Track brace depth with line numbers
depth = 0
stack = []  # stores (line_number, context)

in_script = False
for i, line in enumerate(lines):
    line_num = i + 1
    
    # Check if we're inside a script tag
    if '<script>' in line and i > 100:
        in_script = True
        continue
    if '</script>' in line and in_script:
        in_script =        continue
    
    if not in_script:
        continue
    
    # Remove HTML comments
    line = re.sub(r'<!--.*?-->', '', line, flags=re.DOTALL)
    
    # Process character by character to handle template literals and strings
    j = 0
    while j < len(line):
        ch = line[j]
        next_ch = line[j + 1] if j + 1 < len(line) else ''
        
        # Handle multi-line comments
        if ch == '/' and next_ch == '*':
            # Skip until */
            end = line.find('*/', j + 2)
            if end == -1:
                break  # Rest of line is comment
            j = end + 2
            continue
        
        # Skip single-line comments
        if ch == '/' and next_ch == '/':
            break
        
        # Handle template literals
        if ch == '`':
            # Skip until closing backtick
            j += 1
            while j < len(line):
                if line[j] == '`':
                    j += 1
                    break
                if line[j] == '\\' :
                    j += 2  # Skip escaped character
                    continue
                j += 1
            continue
        
        # Handle strings
        if ch in ("'", '"'):
            j += 1
            while j < len(line):
                if line[j] == '\\':
                    j += 2  # Skip escaped character
                    continue
                if line[j] == ch:
                    j += 1
                    break
                j += 1
            continue
        
        # Count braces
        if ch == '{':
            depth += 1
            stack.append((line_num, line.strip()[:60]))
        elif ch == '}':
            if depth > 0:
                depth -= 1
                if stack:
                    stack.pop()
            else:
                print(f"Line {line_num}: Extra '}'")
        
        j += 1

print(f"Total lines: {len(lines)}")
print(f"Final brace depth: {depth}")

if stack:
    print(f"\nUnclosed braces ({len(stack)}):")
    for line_num, context in stack:
        print(f"  Line {line_num}: {context}")
else:
    print("All braces are balanced!")
