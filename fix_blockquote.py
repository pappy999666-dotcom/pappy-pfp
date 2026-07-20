import re, os

def check_and_fix(path):
    with open(path) as f:
        src = f.read()
    orig = src

    # Find string literals (template literals and quoted strings) with unclosed blockquote
    # Pattern: <blockquote> without matching </blockquote> in same string segment
    
    lines = src.split('\n')
    out = []
    changed = False
    
    for line in lines:
        # Fix: '<blockquote>text\n> more' pattern — missing closing tag
        # These come from the old fix script that added <blockquote> but forgot </blockquote>
        
        # Pattern 1: '\\n<blockquote>text' without closing — add </blockquote> at end of string
        # This catches: '\n<blockquote>Some text' + more concatenation
        if re.search(r"'\\n<blockquote>[^<']+$", line) or re.search(r'"\\n<blockquote>[^<"]+$', line):
            # Add closing tag before the quote
            line = re.sub(r"('\\n<blockquote>)([^<']+)(')", r"\1\2</blockquote>\3", line)
            line = re.sub(r'("\\n<blockquote>)([^<"]+)(")', r'\1\2</blockquote>\3', line)
            changed = True

        # Pattern 2: standalone string '<blockquote>text' without </blockquote>
        if re.search(r"'<blockquote>[^<']+(?<!>)'", line):
            line = re.sub(r"'(<blockquote>)([^<']+)(?<!>)'", r"'\1\2</blockquote>'", line)
            changed = True
        if re.search(r'"<blockquote>[^<"]+(?<!>)"', line):
            line = re.sub(r'"(<blockquote>)([^<"]+)(?<!>)"', r'"\1\2</blockquote>"', line)
            changed = True

        # Pattern 3: template literal with <blockquote> but no </blockquote> on same line
        # and line ends with backtick or + 
        if '<blockquote>' in line and '</blockquote>' not in line and '<blockquote expandable>' not in line:
            # Count opens vs closes
            opens = line.count('<blockquote>') + line.count('<blockquote expandable>')
            closes = line.count('</blockquote>')
            if opens > closes:
                # Add missing closing tags
                for _ in range(opens - closes):
                    # Insert before the closing quote/backtick/+
                    line = re.sub(r"(</b>|</i>|</code>)?(['\"`]|$|\s*\+\s*$)", 
                                  lambda m: (m.group(1) or '') + '</blockquote>' + m.group(2), 
                                  line, count=1)
                changed = True

        out.append(line)
    
    src = '\n'.join(out)
    if src != orig:
        with open(path, 'w') as f:
            f.write(src)
        return True
    return False

# Also do a simpler targeted fix for the most common pattern
def simple_fix(path):
    with open(path) as f:
        src = f.read()
    orig = src
    
    # Fix: '\n<blockquote>TEXT' (no closing) -> '\n<blockquote>TEXT</blockquote>'
    src = re.sub(
        r"((?:'+|`)[^'`]*\\n<blockquote>)([^<'`\n]+)(?!</blockquote>)([^<'`\n]*(?:'|`))",
        lambda m: m.group(1) + m.group(2) + '</blockquote>' + m.group(3),
        src
    )
    
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
    'src/middleware/auth.js',
    'src/utils/errorHandler.js',
]

for f in files:
    if os.path.exists(f):
        c = simple_fix(f)
        print(('FIXED ' if c else 'ok    ') + f)
