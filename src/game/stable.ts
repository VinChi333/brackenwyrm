// Mertens Stall: Reittiere kaufen, tauschen, füttern und verkaufen. Regeln wie im Original (stables.php).

import { MOUNTS, MOUNT_ATK, mountRepay } from '../content/mounts';
import type { Buff, GameState, MountId, Player } from './types';

import { t } from '../i18n';

export function mountBuff(id: MountId): Buff {
  const m = MOUNTS[id];
  return { id: 'mount', name: m.buffName, atkMult: MOUNT_ATK, rounds: m.rounds, wearOff: t`${m.yourNom} ist müde und trottet nur noch hinter dir her.` };
}

/** Was ein Tausch kostet: Preis des neuen Tiers minus zwei Drittel des alten (kann negativ sein = man bekommt etwas zurück). */
export function tradeCost(p: Player, id: MountId): number {
  return MOUNTS[id].gems - mountRepay(p.mount);
}

export function feedPrice(p: Player): number {
  if (!p.mount) return 0;
  const full = p.level * MOUNTS[p.mount].feedCost;
  const b = p.buffs.find((x) => x.id === 'mount');
  return b && b.rounds > MOUNTS[p.mount].rounds * 0.5 ? Math.round(full / 2) : full;
}

export function buyMount(s: GameState, id: MountId): string {
  const p = s.player;
  const m = MOUNTS[id];
  if (p.mount === id) return id === 'pony' ? t('Du hast doch schon ein Pony.') : t`Du hast doch schon einen ${m.name}.`;
  const cost = tradeCost(p, id);
  if (p.gems < cost) return t`„Na, da fehlt no was“, brummt Merten. ${m.name === 'Pony' ? t('Das Pony') : t`Der ${m.name}`} kostet ${m.gems} Edelsteine${p.mount ? t`, für dein jetziges Tier gibt er dir ${mountRepay(p.mount)}` : ''}.`;
  const old = p.mount;
  p.gems -= cost;
  p.mount = id;
  p.mountFed = false;
  p.buffs = p.buffs.filter((b) => b.id !== 'mount');
  p.buffs.push(mountBuff(id));
  const trade = old ? t`Merten nimmt ${MOUNTS[old].yourAcc} am Zügel und gibt dir dafür ${mountRepay(old)} Edelsteine zurück. ` : '';
  return t`${trade}Du schnallst deine Waffe an die Satteltaschen und tätschelst ${m.yourAcc}. Ab morgen bringt ${m.name === 'Pony' ? 'es' : 'er'} dir jeden Tag ${m.fights} Waldkämpfe mehr, und ${m.name === 'Pony' ? 'es' : 'er'} kämpft ${m.rounds} Runden an deiner Seite.`;
}

export function sellMount(s: GameState): string {
  const p = s.player;
  if (!p.mount) return t('Du hast kein Reittier.');
  const m = MOUNTS[p.mount];
  const back = mountRepay(p.mount);
  p.gems += back;
  p.mount = '';
  p.buffs = p.buffs.filter((b) => b.id !== 'mount');
  return t`Mit Tränen in den Augen gibst du Merten die Zügel. ${m.yourNom} schaut dir nach, bis du um die Ecke bist. Du bekommst ${back} Edelsteine.`;
}

export function feedMount(s: GameState): { text: string; ok: boolean } {
  const p = s.player;
  if (!p.mount) return { text: t('Du hast kein Reittier.'), ok: false };
  const m = MOUNTS[p.mount];
  if (p.mountFed) return { text: t`„${m.yourNom} is scho voll bis obenhin“, sagt Merten. „Morgen wieder.“`, ok: false };
  const b = p.buffs.find((x) => x.id === 'mount');
  if (b && b.rounds >= m.rounds) return { text: t`${m.yourNom} schnuppert am Hafer und dreht den Kopf weg. Satt.`, ok: false };
  const price = feedPrice(p);
  if (p.gold < price) return { text: t`Das Futter kostet ${price} Gold. So viel hast du nicht dabei. Merten meint, im Wald gibt es Gras umsonst.`, ok: false };
  const half = b && b.rounds > m.rounds * 0.5;
  p.gold -= price;
  p.mountFed = true;
  p.buffs = p.buffs.filter((x) => x.id !== 'mount');
  p.buffs.push(mountBuff(p.mount));
  return {
    text: half
      ? t`${m.yourNom} frisst etwa die Hälfte und lässt den Rest stehen. Merten gibt dir die Hälfte zurück, das Futter kostet nur ${price} Gold.`
      : t`${m.yourNom} schlingt das Futter hinunter und sucht dann Mertens Taschen nach mehr ab. Das kostet ${price} Gold. ${m.yourNom} ist wieder voller Kraft.`,
    ok: true,
  };
}

/** Beim neuen Tag: Reittier ist ausgeruht und kämpft wieder mit. */
export function mountNewDay(s: GameState): string[] {
  const p = s.player;
  p.mountFed = false;
  if (!p.mount) return [];
  p.buffs = p.buffs.filter((b) => b.id !== 'mount');
  p.buffs.push(mountBuff(p.mount));
  return [t`Du schnallst deine Waffe an die Satteltaschen und ziehst mit ${MOUNTS[p.mount].yourDat} los.`];
}
