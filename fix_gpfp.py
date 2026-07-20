import re

path = 'src/handlers/groupPfpHandler.js'
with open(path) as f:
    c = f.read()
orig = c

# Fix *bold* in template literals and strings
c = re.sub(r'\*([A-Za-z][A-Za-z0-9 \-\'\.\!,]{1,60})\*', r'<b>\1</b>', c)

# Fix backtick code in display strings -> <code>
c = re.sub(r'`(https?://[^`\n]{5,80})`', r'<code>\1</code>', c)

if c != orig:
    with open(path, 'w') as f:
        f.write(c)
    print("FIXED groupPfpHandler.js")
else:
    print("no change")
