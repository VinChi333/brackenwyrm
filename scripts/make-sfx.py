# Erzeugt die Klangeffekte des Spiels: Kampfklänge per Klangsynthese, Oberflächenklänge aus Kenneys
# "Interface Sounds" (CC0, art-source/sfx-kenney). Ergebnis: src/assets/sfx/<name>.mp3
# Aufruf: python3 scripts/make-sfx.py   (braucht numpy, scipy und ffmpeg)
import os, subprocess, tempfile
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

SR = 44100
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'src', 'assets', 'sfx')
KENNEY = os.path.join(ROOT, 'art-source', 'sfx-kenney')
rng = np.random.default_rng(7)

def t(sec): return np.arange(int(SR * sec)) / SR
def env(n, a=0.005, d=0.2, curve=4.0):
    x = np.arange(n) / SR
    att = np.clip(x / max(a, 1e-4), 0, 1)
    dec = np.exp(-np.maximum(x - a, 0) * curve / max(d, 1e-4))
    return att * dec
def noise(sec): return rng.uniform(-1, 1, int(SR * sec))
def bp(x, lo, hi, order=2): return sosfilt(butter(order, [lo, hi], 'bandpass', fs=SR, output='sos'), x)
def lp(x, f, order=2): return sosfilt(butter(order, f, 'lowpass', fs=SR, output='sos'), x)
def hp(x, f, order=2): return sosfilt(butter(order, f, 'highpass', fs=SR, output='sos'), x)
def sweep_sine(f0, f1, sec):
    f = np.geomspace(f0, f1, int(SR * sec)); return np.sin(2 * np.pi * np.cumsum(f) / SR)
def bell(freq, sec, partials=((1, 1), (2.76, 0.5), (5.4, 0.25), (8.93, 0.12)), decay=1.5):
    x = t(sec); y = np.zeros_like(x)
    for r, a in partials: y += a * np.sin(2 * np.pi * freq * r * x) * np.exp(-x * decay * r ** 0.5 * 3 / sec)
    return y
def reverb(x, sec=1.2, mix=0.25):
    n = int(SR * sec); ir = rng.normal(0, 1, n) * np.exp(-np.arange(n) / SR * 5 / sec)
    ir = lp(ir, 5000); wet = np.convolve(x, ir)
    wet = wet / (np.max(np.abs(wet)) + 1e-9) * np.max(np.abs(x))
    dry = np.concatenate([x, np.zeros(len(wet) - len(x))])
    return dry * (1 - mix) + wet * mix
def place(total, parts):
    y = np.zeros(int(SR * total))
    for start, sig in parts:
        i = int(SR * start); j = min(len(y), i + len(sig)); y[i:j] += sig[: j - i]
    return y
def norm(x, peak=0.85):
    x = x - np.mean(x); return x / (np.max(np.abs(x)) + 1e-9) * peak

def whoosh(sec=0.28, lo=500, hi=2600):
    n = noise(sec); x = np.linspace(0, 1, len(n))
    a = bp(n, lo, hi, 2) * np.sin(np.pi * x) ** 2
    return a

def make():
    s = {}
    # Schlag ins Leere
    s['miss'] = norm(whoosh(0.3, 400, 2200), 0.6)
    # Treffer: Schwung, dumpfer Aufprall, kurzer Klick
    thump = sweep_sine(150, 55, 0.18) * env(int(SR * 0.18), 0.002, 0.12)
    crack = lp(noise(0.06), 3500) * env(int(SR * 0.06), 0.001, 0.03)
    s['hit'] = norm(place(0.35, [(0, whoosh(0.12, 700, 3000) * 0.5), (0.09, thump), (0.09, crack * 0.8)]))
    # Volltreffer: härter, mit metallischem Nachklang
    ring = bell(1180, 0.7, ((1, 1), (1.58, 0.7), (2.25, 0.5), (3.1, 0.3)), decay=2.2)
    s['crit'] = norm(reverb(place(0.8, [(0, whoosh(0.12, 900, 4000) * 0.6), (0.09, thump * 1.3), (0.09, crack), (0.1, ring * 0.45)]), 0.8, 0.3))
    # Held wird getroffen: tief und dumpf
    s['hurt'] = norm(place(0.35, [(0, sweep_sine(110, 45, 0.25) * env(int(SR * 0.25), 0.003, 0.18)), (0, lp(noise(0.12), 900) * env(int(SR * 0.12), 0.002, 0.06) * 0.8)]), 0.75)
    # Gegner fällt: kurzes, zufriedenes Zweiklang-Signal
    s['win'] = norm(reverb(place(0.7, [(0, bell(660, 0.5) * 0.7), (0.12, bell(990, 0.6))]), 1.0, 0.3), 0.6)
    # Tod: tiefer, fallender Ton mit Hall
    drone = sum(sweep_sine(f, f * 0.55, 1.6) for f in (110, 110 * 1.19, 165)) * env(int(SR * 1.6), 0.05, 1.2, 2.5)
    s['death'] = norm(reverb(lp(drone, 1200), 1.5, 0.4), 0.7)
    # Münzen: mehrere kleine metallische Klänge
    coins = [(0.0, bell(3200, 0.25, ((1, 1), (1.47, 0.6), (2.09, 0.4)), 3) * 0.8)]
    for k, st in enumerate([0.06, 0.11, 0.19, 0.24]):
        coins.append((st, bell(2600 + rng.uniform(-300, 900), 0.22, ((1, 1), (1.47, 0.6), (2.09, 0.4)), 3) * rng.uniform(0.4, 0.8)))
    s['coins'] = norm(hp(place(0.55, coins), 900), 0.55)
    # Stufenaufstieg: aufsteigender Dreiklang
    notes = [523.25, 659.25, 783.99, 1046.5]
    s['levelup'] = norm(reverb(place(1.4, [(i * 0.11, bell(f, 1.0, decay=1.2) * (0.7 + i * 0.1)) for i, f in enumerate(notes)]), 1.4, 0.35), 0.7)
    # Neue Karte: funkelnder Lauf nach oben
    sparkle = [(i * 0.05, bell(1200 * 2 ** (i / 7), 0.4, decay=2) * 0.5) for i in range(9)]
    s['card'] = norm(reverb(place(1.0, sparkle + [(0, hp(noise(0.6), 6000) * env(int(SR * 0.6), 0.2, 0.4) * 0.15)]), 1.0, 0.35), 0.6)
    # Dunkle Künste: tiefes Raunen, dissonant
    dark = sum(np.sin(2 * np.pi * f * t(1.0)) for f in (73.4, 77.8, 110)) * env(int(SR * 1.0), 0.25, 0.7, 2.5)
    whisper = bp(noise(1.0), 1500, 4000) * env(int(SR * 1.0), 0.3, 0.6, 2.5) * 0.35
    s['dunkel'] = norm(reverb(dark * 0.6 + whisper, 1.2, 0.4), 0.7)
    # Mystische Kräfte: Funkenregen und Knistern
    crackle = np.zeros(int(SR * 0.9))
    for _ in range(40):
        i = rng.integers(0, len(crackle) - 400); crackle[i:i + 400] += hp(noise(400 / SR), 2500) * env(400, 0.0005, 0.004) * rng.uniform(0.3, 1)
    rise = sweep_sine(300, 1800, 0.6) * env(int(SR * 0.6), 0.2, 0.4) * 0.35
    s['mystik'] = norm(reverb(place(0.9, [(0, crackle), (0, rise)] + [(0.1 + i * 0.06, bell(1500 + i * 220, 0.3, decay=2.5) * 0.3) for i in range(6)]), 0.9, 0.3), 0.7)
    # Diebeskünste: schneller Doppelschwung und Klinge
    shing = bp(noise(0.45), 3500, 9000) * env(int(SR * 0.45), 0.002, 0.3) * 0.6 + bell(2400, 0.45, ((1, 1), (2.7, 0.4)), 3) * 0.25
    s['dieb'] = norm(place(0.6, [(0, whoosh(0.14, 900, 4000)), (0.11, whoosh(0.14, 1200, 5000)), (0.2, shing)]), 0.65)
    return s

def kenney(name):
    sr, x = wavfile.read(os.path.join(KENNEY, name + '.wav'))
    x = x.astype(np.float64)
    if x.ndim > 1: x = x.mean(axis=1)
    x /= np.max(np.abs(x)) + 1e-9
    if sr != SR: x = np.interp(np.arange(int(len(x) * SR / sr)) * sr / SR, np.arange(len(x)), x)
    return x

def write(name, x, vol=1.0):
    os.makedirs(OUT, exist_ok=True)
    # Stille am Ende abschneiden, weich ausblenden
    idx = np.where(np.abs(x) > 0.008 * np.max(np.abs(x)))[0]
    end = min(len(x), (idx[-1] if len(idx) else len(x)) + int(0.03 * SR))
    x = x[:end].copy(); fade = min(len(x), int(0.04 * SR)); x[-fade:] *= np.linspace(1, 0, fade)
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f:
        wavfile.write(f.name, SR, (np.clip(x * vol, -1, 1) * 32767).astype(np.int16))
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', f.name, '-ac', '1', '-codec:a', 'libmp3lame', '-b:a', '96k', os.path.join(OUT, name + '.mp3')], check=True)
        os.unlink(f.name)

if __name__ == '__main__':
    for k, v in make().items(): write(k, v)
    # Oberfläche (Kenney, CC0)
    for name, src, vol in [('click', 'click_002', 0.5), ('gem', 'glass_004', 0.8), ('event', 'question_001', 0.6), ('letter', 'scroll_002', 0.8), ('buy', 'drop_002', 0.7), ('open', 'open_002', 0.6)]:
        write(name, norm(kenney(src)), vol)
    print('ok', sorted(os.listdir(OUT)))
