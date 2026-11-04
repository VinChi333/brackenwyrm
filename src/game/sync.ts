// Entscheidet, wie der Spielstand auf diesem Gerät und der auf dem Server abgeglichen werden.
// Reine Logik ohne Netzwerk, damit sie sich testen lässt.

export type SyncDecision = 'none' | 'push' | 'pull' | 'conflict';

export interface SyncInput {
  local: number | null;   // savedAt des Spielstands auf diesem Gerät (null = keiner)
  remote: number | null;  // savedAt des Spielstands auf dem Server (null = keiner)
  lastSynced: number;     // savedAt, bei dem beide zuletzt gleich waren (0 = noch nie)
}

export function decideSync({ local, remote, lastSynced }: SyncInput): SyncDecision {
  if (local === null && remote === null) return 'none';
  if (remote === null) return 'push';
  if (local === null) return 'pull';
  if (local === remote) return 'none';
  // Nur auf Gleichheit prüfen, nicht auf "größer": savedAt stammt von der Uhr des jeweiligen Geräts.
  // Geht die Uhr am Laptop nach, wäre ein neuer lokaler Stand sonst "älter" als der zuletzt abgeglichene,
  // und es käme bei jeder Aktion wieder die Frage nach den zwei Spielständen.
  const localChanged = local !== lastSynced;
  const remoteChanged = remote !== lastSynced;
  if (localChanged && !remoteChanged) return 'push';
  if (remoteChanged && !localChanged) return 'pull';
  // Beide Seiten haben seit dem letzten Abgleich weitergespielt (oder es gab noch keinen):
  // Das darf nicht still entschieden werden, sonst geht ein Spieltag verloren.
  return 'conflict';
}
