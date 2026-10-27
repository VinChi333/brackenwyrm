// Spiellogik zum Einstieg für Neulinge (Texte in content/guide.ts).
import { GUIDE_OPEN_LEVEL, GUIDE_STEPS, PLACE_NAMES, PLACE_UNLOCK, type GuideStep } from '../content/guide';
import { maxHp } from './balance';
import type { GameState, Guide } from './types';

export function newGuide(): Guide {
  return { step: 0, flags: [], seen: [], open: false, lvl: 1, fresh: [] };
}

/** Wurde die Einführung ganz abgeschlossen (inkl. Abschlusstext gelesen) oder übersprungen? */
export function guideFinished(g: Guide | null | undefined): boolean {
  return !g || g.step > GUIDE_STEPS.length;
}

export function guideFlag(s: GameState, flag: string): void {
  const g = s.guide;
  if (g && !g.flags.includes(flag)) g.flags.push(flag);
}

export function currentStep(s: GameState): GuideStep | null {
  const g = s.guide;
  return g && g.step < GUIDE_STEPS.length ? GUIDE_STEPS[g.step] : null;
}

function stepDone(s: GameState, st: GuideStep): boolean {
  const p = s.player;
  const g = s.guide!;
  switch (st.id) {
    case 'wald': return s.stats.kills >= 1;
    case 'heilen': return g.flags.includes('heal') || (g.seen.includes('healer') && p.hp >= maxHp(p));
    case 'schmiede': return p.weaponTier > 0 || p.armorTier > 0;
    case 'kontor': return p.bank > 0;
    case 'meister': return p.level >= 2 || p.dragonKills > 0;
    case 'frieda': return g.flags.includes('talk');
  }
}

/** Ist dieser Menüpunkt für den Spieler schon sichtbar? */
export function placeOpen(s: GameState, act: string): boolean {
  const g = s.guide;
  if (!g || g.open) return true;
  return s.player.level >= (PLACE_UNLOCK[act] ?? 1);
}

/**
 * Nach jeder Aktion: erledigte Schritte abhaken und belohnen, neu freigeschaltete Orte melden.
 * Gibt die Meldungen zurück (leer, wenn sich nichts geändert hat).
 */
export function guideUpdate(s: GameState): string[] {
  const g = s.guide;
  if (!g) return [];
  const out: string[] = [];
  const p = s.player;
  while (g.step < GUIDE_STEPS.length && stepDone(s, GUIDE_STEPS[g.step])) {
    const st = GUIDE_STEPS[g.step];
    const r = st.reward;
    p.gold += r.gold ?? 0;
    p.gems += r.gems ?? 0;
    p.bank += r.bank ?? 0;
    p.forestFights += r.fights ?? 0;
    out.push(`✓ ${st.title}: ${st.done}`);
    g.step += 1;
  }
  if (!g.open && p.level > g.lvl) {
    const fresh = Object.entries(PLACE_UNLOCK).filter(([, l]) => l > g.lvl && l <= p.level).map(([a]) => a);
    if (fresh.length) {
      g.fresh.push(...fresh.filter((a) => !g.fresh.includes(a)));
      out.push(`Neu in Moosgrund: ${fresh.map((a) => PLACE_NAMES[a] ?? a).join(', ')}.`);
    }
  }
  g.lvl = Math.max(g.lvl, p.level);
  if (!g.open && p.level >= GUIDE_OPEN_LEVEL) g.open = true;
  return out;
}

/** Ort besucht: "neu"-Markierung weg. */
export function guideVisit(s: GameState, act: string): void {
  const g = s.guide;
  if (g && g.fresh.includes(act)) g.fresh = g.fresh.filter((x) => x !== act);
}

/** Einführung beenden: alle Orte zeigen, keine Aufgaben mehr. Ortshinweise bleiben. */
export function skipGuide(s: GameState): void {
  const g = s.guide;
  if (!g) return;
  g.step = GUIDE_STEPS.length + 1;
  g.open = true;
  g.fresh = [];
}

/** Abschlusstext gelesen. */
export function closeGuide(s: GameState): void {
  const g = s.guide;
  if (g && g.step >= GUIDE_STEPS.length) g.step = GUIDE_STEPS.length + 1;
}

export function sanitizeGuide(raw: unknown): Guide | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<Guide>;
  const strs = (v: unknown) => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string'))].slice(0, 60) : []);
  return {
    step: Math.max(0, Math.min(GUIDE_STEPS.length + 1, Math.floor(Number(r.step) || 0))),
    flags: strs(r.flags),
    seen: strs(r.seen),
    open: !!r.open,
    lvl: Math.max(1, Math.floor(Number(r.lvl) || 1)),
    fresh: strs(r.fresh),
  };
}
