import os, re

def fix_corrupted(path):
    with open(path) as f:
        content = f.read()
    original = content

    # Restore corrupted callback_data and step identifiers
    # Pattern: o<i>settings</i>drops -> o_settings_drops
    # Pattern: o<i>set</i>wm -> o_set_wm
    content = re.sub(r'<i>([a-z]+)</i>', r'_\1_', content)

    # Fix double underscores that may result: o__settings__drops -> o_settings_drops
    content = re.sub(r'__+', '_', content)

    # Fix broken regex patterns like /WA_AUTO_JOIN_CHANNEL=.*/
    # The script turned _AUTO_ into <i>AUTO</i> inside regex strings too
    # Already handled by the <i> fix above

    if content != original:
        with open(path, 'w') as f:
            f.write(content)
        return True
    return False

files = [
    'src/handlers/ownerSettingsHandler.js',
    'src/handlers/accountHandler.js',
    'src/handlers/callbackRouter.js',
    'src/handlers/downloadHandler.js',
    'src/handlers/groupPfpHandler.js',
    'src/handlers/imageGenHandler.js',
    'src/handlers/pairingHandler.js',
    'src/handlers/pinterestHandler.js',
    'src/handlers/supportHandler.js',
    'src/handlers/wallpaperHandler.js',
    'src/owner/ownerHandler.js',
    'src/schedulers/autoChange.js',
    'src/services/groupPfp.js',
    'src/services/wallpaper.js',
    'src/commands/start.js',
    'src/app.js',
    'src/middleware/auth.js',
    'src/middleware/rateLimit.js',
    'src/utils/errorHandler.js',
]

for f in files:
    if os.path.exists(f):
        changed = fix_corrupted(f)
        print(('FIXED ' if changed else 'ok    ') + f)
