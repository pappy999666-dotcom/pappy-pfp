import re, os

def fix(path):
    with open(path) as f:
        src = f.read()
    orig = src

    lines = src.split('\n')
    out = []
    for line in lines:
        s = line.strip()
        # Skip pure comments, pure JS code lines, require lines
        if s.startswith('//') or s.startswith('*') or ('require(' in s and 'caption' not in s and 'text' not in s):
            out.append(line)
            continue

        # Fix > blockquote in template literal strings (backtick strings)
        # Pattern: `...> text...` where > is at start of a line inside template
        line = re.sub(r'\\n> ([A-Za-z0-9📢💬🔐✅❌⚠️ℹ️🔄🖼📱👤🟢🔴⏳🎉📨⚙️⏰📸])',
                      r'\\n<blockquote>\1', line)

        # Fix *bold* in template literals and string concatenations
        # Only match *word* patterns that are clearly display text (not JS operators)
        line = re.sub(r'\*([A-Za-z][A-Za-z0-9 \-\'\.!,]{1,60})\*(?=[^*]|$)',
                      r'<b>\1</b>', line)

        # Fix _italic_ in strings
        line = re.sub(r'(?<![a-zA-Z_])_([A-Za-z][A-Za-z0-9 ]{2,40})_(?![a-zA-Z_])',
                      r'<i>\1</i>', line)

        # Fix remaining '> text' string array items not caught before
        line = re.sub(r"'> ([^'<]{2,80})'",
                      lambda m: "'<blockquote>" + m.group(1) + "</blockquote>'", line)

        out.append(line)

    src = '\n'.join(out)
    if src != orig:
        with open(path, 'w') as f:
            f.write(src)
        return True
    return False

files = [
    'src/handlers/groupPfpHandler.js',
    'src/handlers/pairingHandler.js',
    'src/handlers/accountHandler.js',
    'src/handlers/ownerSettingsHandler.js',
    'src/handlers/callbackRouter.js',
    'src/handlers/wallpaperHandler.js',
    'src/handlers/downloadHandler.js',
    'src/handlers/supportHandler.js',
    'src/handlers/pinterestHandler.js',
    'src/services/groupPfp.js',
    'src/services/wallpaper.js',
    'src/owner/ownerHandler.js',
    'src/commands/start.js',
    'src/app.js',
    'src/schedulers/autoChange.js',
]

for f in files:
    if os.path.exists(f):
        changed = fix(f)
        print(('FIXED ' if changed else 'ok    ') + f)
