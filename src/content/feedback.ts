import { SPECIALTIES } from './specialties';
import type { GameState } from '../game/types';

// Rückmeldungen von Testern. Ohne Server: Das Spiel baut eine fertige Nachricht,
// die der Tester per WhatsApp, E-Mail oder Kopieren an Chris schickt.

export const FEEDBACK_KINDS = [
  { id: 'fehler', label: 'Fehler' },
  { id: 'schwer', label: 'Zu schwer' },
  { id: 'leicht', label: 'Zu leicht' },
  { id: 'zaeh', label: 'Wird langweilig' },
  { id: 'idee', label: 'Idee' },
  { id: 'lob', label: 'Gefällt mir' },
] as const;

export type FeedbackKind = (typeof FEEDBACK_KINDS)[number]['id'];

export function feedbackMessage(s: GameState, version: string, kinds: FeedbackKind[], text: string, screen: string): string {
  const p = s.player;
  const st = s.stats;
  const found = Object.keys(s.bestiary).filter((k) => k !== 'dragon').length;
  const labels = FEEDBACK_KINDS.filter((k) => kinds.includes(k.id)).map((k) => k.label).join(', ');
  const device = typeof window !== 'undefined' && window.innerWidth < 700 ? 'Handy' : 'Computer';
  return [
    `Brackenwyrm-Rückmeldung (${version})`,
    labels ? `Art: ${labels}` : '',
    '',
    text.trim() || '(kein Text)',
    '',
    '— Spielstand —',
    `${p.name}, Stufe ${p.level}, ${SPECIALTIES[p.specialty].name}`,
    `Spieltag ${s.day}, an ${st.realDays} echten Tagen gespielt (seit ${st.firstPlayed || 'unbekannt'})`,
    `Drachenkills ${p.dragonKills}, Siege ${st.kills}, Tode ${st.deaths}, Meister ${st.masters}`,
    `Bestiarium ${found}/45, Waffe Stufe ${p.weaponTier}, Rüstung Stufe ${p.armorTier}`,
    `Bildschirm: ${screen}, Gerät: ${device}`,
  ].filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n');
}
