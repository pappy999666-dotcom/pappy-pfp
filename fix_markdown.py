import os, re

def fix_file(path):
    with open(path) as f:
        content = f.read()
    original = content
    lines = content.split('\n')
    new_lines = []
    for line in lines:
        stripped = line.strip()
        if stripped.startswith('//') or stripped.startswith('*') or '<blockquote>' in line:
            new_lines.append(line)
            continue
        # '> text' string literals -> '<blockquote>text</blockquote>'
        line = re.sub(r"'> ([^'\\]+)'", lambda m: "'<blockquote>" + m.group(1) + "</blockquote>'", line)
        line = re.sub(r'">\s+([^"\\]+)"', lambda m: '"<blockquote>' + m.group(1) + '</blockquote>"', line)
        # \\n> text in strings
        line = re.sub(r"\\n> ([A-Za-z0-9\U0001F000-\U0001FFFF])", r"\\n<blockquote>\1", line)
        # *bold* -> <b>bold</b>
        line = re.sub(r"\*([A-Za-z0-9][A-Za-z0-9 '_\-]{1,60})\*", r"<b>\1</b>", line)
        # _italic_ -> <i>italic</i>
        line = re.sub(r"_([A-Za-z][A-Za-z0-9 ]{2,40})_", r"<i>\1</i>", line)
        new_lines.append(line)
    content = '\n'.join(new_lines)
    if content != original:
        with open(path, 'w') as f:
            f.write(content)
        return True
    return False

files = [
    './commands/start.js',
    './handlers/accountHandler.js',
    './handlers/callbackRouter.js',
    './handlers/downloadHandler.js',
    './handlers/groupPfpHandler.js',
    './handlers/imageGenHandler.js',
    './handlers/ownerSettingsHandler.js',
    './handlers/pairingHandler.js',
    './handlers/pinterestHandler.js',
    './handlers/supportHandler.js',
    './handlers/wallpaperHandler.js',
    './owner/ownerHandler.js',
    './schedulers/autoChange.js',
    './services/groupPfp.js',
    './services/support.js',
    './services/wallpaper.js',
]

for f in files:
    if os.path.exists(f):
        changed = fix_file(f)
        print(('FIXED ' if changed else 'ok    ') + f)
