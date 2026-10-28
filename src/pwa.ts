// Brackenwyrm als App: Service Worker anmelden und den Installieren-Knopf möglich machen.

interface InstallEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

let deferred: InstallEvent | null = null;
let onChange: () => void = () => {};

export function initPwa(changed: () => void): void {
  onChange = changed;
  const env = import.meta.env;
  const local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if ('serviceWorker' in navigator && env.PROD && env.MODE !== 'artifact' && (location.protocol === 'https:' || local)) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => { /* ohne App-Modus geht es auch */ }); });
  }
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e as InstallEvent; onChange(); });
  window.addEventListener('appinstalled', () => { deferred = null; onChange(); });
}

/** Läuft das Spiel schon als installierte App? */
export function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches // i18n-ignore
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** Kann der Browser direkt installieren (Chrome, Edge, Android)? */
export function canInstall(): boolean { return deferred !== null; }

/** iPhone oder iPad (dort geht es nur über "Zum Home-Bildschirm"). */
export function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export async function install(): Promise<boolean> {
  if (!deferred) return false;
  const d = deferred;
  deferred = null;
  await d.prompt();
  const r = await d.userChoice.catch(() => ({ outcome: 'dismissed' }));
  onChange();
  return r.outcome === 'accepted';
}
