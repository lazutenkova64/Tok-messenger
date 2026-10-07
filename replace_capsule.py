import re

# Read the new code
with open('F:/Tok-messenger-new/capsule_code.txt', 'r', encoding='utf-8') as f:
    new_code = f.read()

# Read the original file
with open('F:/Tok-messenger-new/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Find and replace minimizeCallWindow through restoreCallWindow
pattern = r'        function minimizeCallWindow\(\) \{[\s\S]*?        window\.restoreCallWindow = restoreCallWindow;'
content = re.sub(pattern, new_code.strip(), content)

# Write back
with open('F:/Tok-messenger-new/index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print('Done')
