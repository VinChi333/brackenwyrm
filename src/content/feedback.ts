import { SPECIALTIES } from './specialties';
import type { GameState } from '../game/types';

import { t } from '../i18n';

// Rückmeldungen von Testern. Ohne Server: Das Spiel baut eine fertige Nachricht,
// die der Tester per WhatsApp, E-Mail oder Kopieren an Chris schickt.

export const FEEDBACK_KINDS = [
  { id: 'fehler', label: t('Fehler') },
  { id: 'schwer', label: t('Zu schwer') },
  { id: 'leicht', label: t('Zu leicht') },
  { id: 'zaeh', label: t('Wird langweilig') },
  { id: 'idee', label: t('Idee') },
  { id: 'lob', label: t('Gefällt mir') },
] as const;

export type FeedbackKind = (typeof FEEDBACK_KINDS)[number]['id'];

export function feedbackMessage(s: GameState, version: string, kinds: FeedbackKind[], text: string, screen: string): string {
  const p = s.player;
  const st = s.stats;
  const found = Object.keys(s.bestiary).filter((k) => k !== 'dragon').length;
  const labels = FEEDBACK_KINDS.filter((k) => kinds.includes(k.id)).map((k) => k.label).join(', ');
  const device = typeof window !== 'undefined' && window.innerWidth < 700 ? t('Handy') : t('Computer');
  return [
    t`Brackenwyrm-Rückmeldung (${version})`,
    labels ? t`Art: ${labels}` : '',
    '',
    text.trim() || t('(kein Text)'),
    '',
    t('— Spielstand —'),
    t`${p.name}, Stufe ${p.level}, ${SPECIALTIES[p.specialty].name}`,
    t`Spieltag ${s.day}, ${st.realDays} Spieltage gespielt (seit ${st.firstPlayed || 'unbekannt'})`,
    t`Drachenkills ${p.dragonKills}, Siege ${st.kills}, Tode ${st.deaths}, Meister ${st.masters}`,
    t`Bestiarium ${found}/45, Waffe Stufe ${p.weaponTier}, Rüstung Stufe ${p.armorTier}`,
    t`Bildschirm: ${screen}, Gerät: ${device}`,
  ].filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n');
}
