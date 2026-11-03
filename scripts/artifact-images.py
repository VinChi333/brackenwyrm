# Nur für die Vorschau auf claude.ai: Dort steckt das ganze Spiel in EINER Datei (höchstens 16 MB).
# Dieses Skript legt verkleinerte Kopien aller .webp-Bilder in .artifact-cache/ an; der Vorschau-Bau nimmt diese.
# Die Netlify-Version (npm run build) bleibt unberührt und nutzt die Bilder in voller Qualität.
import os, shutil
from PIL import Image
SRC, OUT, QUALITY = 'src/assets', '.artifact-cache', 58
total_in = total_out = 0
for root, _, files in os.walk(SRC):
    for f in files:
        if not f.endswith('.webp'): continue
        src = os.path.join(root, f); dst = os.path.join(OUT, os.path.relpath(src, SRC))
        total_in += os.path.getsize(src)
        if not os.path.exists(dst) or os.path.getmtime(dst) < os.path.getmtime(src):
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            im = Image.open(src)
            im.save(dst, 'WEBP', quality=QUALITY, method=6)
            if os.path.getsize(dst) >= os.path.getsize(src): shutil.copy(src, dst)  # nie größer als das Original
        total_out += os.path.getsize(dst)
print(f'Vorschau-Bilder: {total_in // 1024} KB -> {total_out // 1024} KB')
