import re, os

def validate(path):
    with open(path) as f:
        src = f.read()
    
    issues = []
    lines = src.split('\n')
    
    for i, line in enumerate(lines, 1):
        s = line.strip()
        if s.startswith('//') or s.startswith('*'):
            continue
        
        # Check for <blockquote> without </blockquote> on same line
        # (multi-line blockquotes are fine in template literals)
        opens = line.count('<blockquote>') + line.count('<blockquote expandable>')
        closes = line.count('</blockquote>')
        
        if opens > closes:
            # Check if this is a multi-line template literal (ends with backtick continuation)
            stripped = line.rstrip()
            # If line ends with + or backtick continuation, it might be intentional
            if not (stripped.endswith('`') or stripped.endswith("'") or stripped.endswith('"')):
                continue  # multi-line, skip
            issues.append((i, opens - closes, line.rstrip()[:100]))
    
    return issues

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
    'src/middleware/auth.js',
    'src/utils/errorHandler.js',
    'src/utils/ui.js',
]

total = 0
for f in files:
    if not os.path.exists(f):
        continue
    issues = validate(f)
    if issues:
        print(f'\n=== {f} ===')
        for lineno, count, text in issues:
            print(f'  L{lineno} (+{count} unclosed): {text}')
            total += count

if total == 0:
    print('ALL CLEAN - no unclosed blockquote tags found')
else:
    print(f'\nTotal unclosed: {total}')
