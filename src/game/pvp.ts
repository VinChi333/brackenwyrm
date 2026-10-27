// Spieler gegen Spieler, auf der Spielseite: Ergebnis vom Server anwenden und als Kampfbericht darstellen.
// Gerechnet wird auf dem Server (server/supabase-2-dorf.sql), hier wird nur übernommen und erzählt.

import { say } from '../content/fighttext';
import { WEAPONS } from '../content/items';
import { SPECIALTIES, normalizeSpecialty } from '../content/specialties';
import { normalizeRace } from '../content/races';
import { maxSoul } from './balance';
import type { PvpEvent, PvpResult } from './cloud';
import type { Fight, GameState, LogLine } from './types';

import { t } from '../i18n';

const PLACE: Record<string, string> = { felder: t('auf den Feldern'), gasthaus: t('in Friedas Gasthaus') };

/** Was beim Schlafen passiert ist. Gibt Meldungen für die Neuigkeiten zurück. */
export function applyPvpEvents(s: GameState, events: PvpEvent[]): string[] {
  const p = s.player;
  const out: string[] = [];
  for (const ev of events) {
    const where = PLACE[ev.place] ?? t('im Schlaf');
    if (ev.kind === 'transfer') {
      p.bank += ev.gold;
      out.push(t`${ev.other_name} hat dir ${ev.gold} Gold aufs Konto im Kontor überwiesen.`);
      continue;
    }
    if (ev.kind === 'haunted') {
      p.hauntedBy = ev.other_name;
      out.push(t`Der Geist von ${ev.other_name} hat dich heimgesucht. Morgen früh wirst du müde aufwachen.`);
      continue;
    }
    if (ev.kind === 'slain') {
      const lostGold = Math.min(p.gold, ev.gold);
      p.gold -= lostGold;
      p.exp = Math.max(0, p.exp - ev.exp);
      if (p.alive) {
        p.alive = false;
        p.hp = 0;
        p.soul = maxSoul(p);
        p.buffs = [];
        s.fight = null;
        s.stats.deaths += 1;
        s.stats.lastDeathDay = s.day;
      }
      out.push(t`Während du ${where} geschlafen hast, hat ${ev.other_name} dich überfallen und besiegt. Du verlierst ${lostGold} Gold und ${ev.exp} Erfahrung.`);
    } else {
      p.gold += ev.gold;
      p.exp += ev.exp;
      out.push(t`${ev.other_name} wollte dich ${where} im Schlaf überfallen und ist an dir gescheitert. Du bekommst ${ev.gold} Gold und ${ev.exp} Erfahrung.`);
    }
  }
  s.news.push(...out);
  return out;
}

/** Baut aus dem Server-Ergebnis einen Kampf zum Anzeigen und wendet Gewinn oder Verlust an. */
export function applyPvpResult(s: GameState, res: PvpResult, place: 'felder' | 'gasthaus'): Fight {
  const p = s.player;
  const foe = res.foe;
  const weapon = WEAPONS[Math.max(0, Math.min(WEAPONS.length - 1, foe.weapon_tier))]?.name ?? t('Waffe');
  const names = { a: foe.name, N: foe.name, hits: t`schlägt im Halbschlaf mit ${weapon} zu`, move: SPECIALTIES[p.specialty].name };
  const log: LogLine[] = [{
    t: place === 'gasthaus'
      ? t`Frieda zwinkert dir zu und dreht sich weg. Du schleichst die Treppe hinauf zu ${foe.name}s Zimmer. ${foe.name} fährt aus dem Schlaf hoch!`
      : t`Du schleichst über die Felder vor dem Stadttor. Dort liegt ${foe.name} im Gras und schnarcht. Als du näher kommst, öffnet ${foe.name} ein Auge.`,
    k: 'warn', r: 0,
  }];
  let foeHp = foe.max;
  let heroHp = res.hero.max;
  let last: [number, number] = [0, 0];
  res.rounds.forEach(([hd, fd], i) => {
    const r = i + 1;
    foeHp = Math.max(0, foeHp - hd);
    log.push(hd ? { t: say.heroHit(names, hd, hd / foe.max), k: 'good', r } : { t: say.heroMiss(names), k: 'info', r });
    if (foeHp > 0) {
      heroHp = Math.max(0, heroHp - fd);
      log.push(fd ? { t: say.foeHit(names, fd, fd / res.hero.max), k: 'bad', r } : { t: say.foeMiss(names), k: 'info', r });
    }
    last = [hd, fd];
  });
  const r = res.rounds.length;
  if (res.won) {
    p.gold += res.gold;
    p.exp += res.exp_win;
    p.hp = Math.max(1, res.hero.hp);
    log.push({ t: t`${foe.name} sinkt zurück ins ${place === 'gasthaus' ? t('Kissen') : t('Gras')} und rührt sich nicht mehr. Morwen wird sich freuen.`, k: 'info', r });
    log.push({ t: t`Du nimmst ${res.gold} Gold an dich und lernst ${res.exp_win} Erfahrung aus dem Kampf.`, k: 'gold', r });
    if (res.bounty && res.bounty > 0) {
      p.gold += res.bounty;
      log.push({ t: t`Veit Galgenstrick tritt aus dem Schatten und drückt dir einen Beutel in die Hand: das Kopfgeld auf ${foe.name}, ${res.bounty} Gold!`, k: 'gold', r });
    }
  } else {
    const lostGold = p.gold;
    p.gold = 0;
    p.exp = Math.max(0, p.exp - res.exp_lose);
    p.hp = 0;
    p.alive = false;
    p.soul = maxSoul(p);
    p.buffs = [];
    s.stats.deaths += 1;
    s.stats.lastDeathDay = s.day;
    log.push({ t: t`${foe.name} war wacher, als du dachtest. Dir wird schwarz vor Augen …`, k: 'bad', r });
    log.push({ t: t`Du verlierst ${lostGold} Gold und ${res.exp_lose} Erfahrung. ${foe.name} schläft zufrieden weiter.`, k: 'bad', r });
  }
  const f: Fight = {
    kind: 'pvp', monsterId: `pvp:${foe.name}`, foe: { name: foe.name, level: foe.level, hp: res.won ? 0 : foeHp, maxHp: foe.max, atk: 0, def: 0 },
    expReward: res.exp_win, goldReward: res.gold, round: r, log, over: res.won ? 'win' : 'lose', bound: 0,
    lastHeroDmg: last[0], lastFoeDmg: last[1], lastHeroMiss: last[0] === 0, lastFoeMiss: last[1] === 0, lastCrit: false, lastSpecial: false,
    seq: 1, foeSpec: normalizeSpecialty(foe.specialty), foeRace: normalizeRace(foe.race), foeGender: foe.gender, pvpPlace: place,
    topHit: Math.max(0, ...res.rounds.map((x) => x[0])),
  };
  s.fight = f;
  return f;
}
