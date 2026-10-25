// Musik und Klangeffekte über die Web Audio API.
// Effekte stecken im Spiel selbst (klein, src/assets/sfx). Musik liegt als eigene Dateien daneben
// (public/audio/music/musik-<name>.mp3), wird erst beim Betreten eines Ortes geladen und sanft übergeblendet.
// Fehlt ein Musikstück, bleibt es einfach still.

const SFX_FILES = import.meta.glob('../assets/sfx/*.mp3', { eager: true, import: 'default' }) as Record<string, string>;
const SFX_URL: Record<string, string> = Object.fromEntries(
  Object.entries(SFX_FILES).map(([path, url]) => [path.split('/').pop()!.replace(/\.mp3$/, ''), url]),
);

export type SfxId = 'hit' | 'crit' | 'miss' | 'hurt' | 'win' | 'death' | 'coins' | 'gem' | 'levelup' | 'card'
  | 'dunkel' | 'mystik' | 'dieb' | 'click' | 'event' | 'letter' | 'buy' | 'open';

export type TrackId = 'titel' | 'dorf' | 'wald' | 'kampf' | 'gasthaus' | 'schattenreich' | 'drache' | 'feste';

export interface SoundPrefs { musicVol: number; sfxVol: number; muted: boolean }

interface Track { id: TrackId; el: HTMLAudioElement; gain: GainNode; retired: boolean; blocked: boolean }

const MUSIC_BASE = 'audio/music/';
const FADE = 1.6;

class SoundSystem {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private current: Track | null = null;
  private wanted: TrackId | null = null;
  private missing = new Set<string>();
  private prefs: SoundPrefs = { musicVol: 0.5, sfxVol: 0.8, muted: false };
  private duckUntil = 0;

  /** Browser erlauben Ton erst nach einer Berührung: beim ersten Tippen aufrufen. */
  unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.musicBus = this.ctx.createGain();
      this.sfxBus = this.ctx.createGain();
      this.musicBus.connect(this.master);
      this.sfxBus.connect(this.master);
      this.master.connect(this.ctx.destination);
      this.applyVolumes();
      document.addEventListener('visibilitychange', () => {
        if (!this.ctx) return;
        if (document.hidden) void this.ctx.suspend(); else void this.ctx.resume();
      });
    }
    if (this.ctx.state === 'suspended' && !document.hidden) void this.ctx.resume();
    if (this.current?.blocked) this.start(this.current);
    else if (this.wanted && !this.current) this.music(this.wanted);
  }

  get ready(): boolean { return !!this.ctx; }

  setPrefs(p: SoundPrefs): void {
    this.prefs = { ...p };
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.prefs.muted ? 0 : 1, now, 0.05);
    this.musicBus.gain.setTargetAtTime(this.prefs.musicVol * (this.ctx.currentTime < this.duckUntil ? 0.25 : 1), now, 0.1);
    this.sfxBus.gain.setTargetAtTime(this.prefs.sfxVol, now, 0.05);
  }

  private load(id: string): Promise<AudioBuffer | null> {
    let p = this.buffers.get(id);
    if (!p) {
      const url = SFX_URL[id];
      p = !url || !this.ctx ? Promise.resolve(null)
        : fetch(url).then((r) => r.arrayBuffer()).then((b) => this.ctx!.decodeAudioData(b)).catch(() => null);
      this.buffers.set(id, p);
    }
    return p;
  }

  /** Effekt abspielen. delay in Sekunden, volume 0–1, rate für leichte Abwechslung. */
  play(id: SfxId, opts: { delay?: number; volume?: number; vary?: boolean } = {}): void {
    if (!this.ctx || this.prefs.muted || this.prefs.sfxVol <= 0) return;
    void this.load(id).then((buf) => {
      if (!buf || !this.ctx) return;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      if (opts.vary) src.playbackRate.value = 0.94 + Math.random() * 0.12;
      const g = this.ctx.createGain();
      g.gain.value = opts.volume ?? 1;
      src.connect(g).connect(this.sfxBus);
      src.start(this.ctx.currentTime + (opts.delay ?? 0));
    });
  }

  /** Musik für den aktuellen Ort. Gleiches Stück läuft einfach weiter. */
  music(id: TrackId | null): void {
    this.wanted = id;
    if (!this.ctx) return;
    if (this.current?.id === id) {
      if (this.current.blocked) this.start(this.current);
      return;
    }
    const old = this.current;
    this.current = null;
    if (old) this.retire(old);
    if (!id || this.missing.has(id)) return;
    const el = new Audio();
    el.loop = true;
    el.preload = 'auto';
    el.crossOrigin = 'anonymous';
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    try {
      this.ctx.createMediaElementSource(el).connect(gain);
    } catch {
      return;
    }
    gain.connect(this.musicBus);
    const entry: Track = { id, el, gain, retired: false, blocked: false };
    // Nur ein echter Ladefehler (Datei fehlt) sperrt das Stück, nicht das absichtliche Anhalten beim Ortswechsel.
    el.addEventListener('error', () => {
      if (entry.retired) return;
      this.missing.add(id);
      if (this.current === entry) this.current = null;
    });
    el.src = `${MUSIC_BASE}musik-${id}.mp3`;
    this.current = entry;
    this.start(entry);
  }

  private start(entry: Track): void {
    entry.blocked = false;
    entry.el.play().then(() => {
      if (!this.ctx || entry.retired || this.current !== entry) return;
      const t = this.ctx.currentTime;
      entry.gain.gain.cancelScheduledValues(t);
      entry.gain.gain.setValueAtTime(entry.gain.gain.value, t);
      entry.gain.gain.linearRampToValueAtTime(1, t + FADE);
    }).catch((e: unknown) => {
      // Vom Browser blockiert (noch keine Berührung): beim nächsten Tippen erneut versuchen.
      if (!entry.retired && (e as { name?: string })?.name === 'NotAllowedError') entry.blocked = true;
    });
  }

  /** Altes Stück ausblenden und danach aufräumen. */
  private retire(old: Track): void {
    old.retired = true;
    const t = this.ctx!.currentTime;
    old.gain.gain.cancelScheduledValues(t);
    old.gain.gain.setValueAtTime(old.gain.gain.value, t);
    old.gain.gain.linearRampToValueAtTime(0, t + FADE);
    window.setTimeout(() => {
      old.el.pause();
      old.el.removeAttribute('src');
      old.el.load();
      old.gain.disconnect();
    }, FADE * 1000 + 100);
  }

  /** Für Tests: was gerade läuft. */
  status(): { track: string | null; playing: boolean; missing: string[] } {
    const c = this.current;
    return { track: c?.id ?? null, playing: !!c && !c.el.paused && !c.blocked, missing: [...this.missing] };
  }

  /** Kurzes Musikstück darüber (Siegesfanfare): die laufende Musik wird solange leiser. */
  jingle(name: string): void {
    if (!this.ctx || this.missing.has(name)) return;
    const el = new Audio(`${MUSIC_BASE}musik-${name}.mp3`);
    el.crossOrigin = 'anonymous';
    try {
      // Direkt an den Hauptregler, damit die Fanfare selbst nicht mit leiser wird.
      const g = this.ctx.createGain();
      g.gain.value = this.prefs.musicVol;
      this.ctx.createMediaElementSource(el).connect(g).connect(this.master);
    } catch {
      return;
    }
    el.addEventListener('error', () => this.missing.add(name), { once: true });
    el.addEventListener('loadedmetadata', () => {
      if (!this.ctx) return;
      this.duckUntil = this.ctx.currentTime + (isFinite(el.duration) ? el.duration : 8);
      this.applyVolumes();
      window.setTimeout(() => this.applyVolumes(), (isFinite(el.duration) ? el.duration : 8) * 1000 + 200);
    }, { once: true });
    void el.play().catch(() => {});
  }
}

export const sound = new SoundSystem();
// Für Tests im Browser
(globalThis as unknown as { __bwSound?: SoundSystem }).__bwSound = sound;
