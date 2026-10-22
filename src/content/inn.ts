import { ARMORS, WEAPONS } from './items';
import { masterForLevel } from './masters';
import { MONSTERS } from './monsters';
import { MAX_LEVEL, expNeeded, maxHp } from '../game/balance';
import type { GameState } from '../game/types';

// Gespräche im Gasthaus „Zum Schlafenden Wurm“.
// Frieda gibt Tipps, die zum Spielstand passen. Am Stammtisch reden drei Stammgäste über dich.

export const FRIEDA_TALKS_PER_DAY = 3;

const FRIEDA_LORE = [
  '„Moosgrund gab es schon, bevor der Wald so dicht wurde“, sagt Frieda. „Damals hieß es Moosgrund. Heute auch. Wir sind nicht sehr einfallsreich.“',
  '„Morwen fährt jeden, der im Wald fällt, bei Sonnenaufgang zurück. Sie nimmt kein Gold dafür. Sie nimmt das Gold, das du dabei hattest.“',
  '„Wenn du dich traust, such im Wald den Nervenkitzel. Gefährlicher, ja. Aber da liegt auch mehr Gold herum.“',
  '„Der Wyrm schläft in der Farnschlucht. Wer ihn weckt, sollte alle Meister auf dem Trainingsplatz besiegt haben. Alle vierzehn.“',
  '„Eulenbären sind halb Eule, halb Bär und ganz schlecht gelaunt. Lauf nicht weg, die sind schneller.“',
  '„Im Wald gibt es Moosfeen. Die mögen Edelsteine. Was sie dafür geben, weiß man vorher nie.“',
  '„Alrik gibt dir für alte Ausrüstung die Hälfte zurück. Mehr bekommst du von dem Geizhals nicht.“',
  '„Deine Fähigkeitspunkte kommen über Nacht wieder. Spar sie dir nicht für morgen auf, das bringt nichts. Und jeder Meister, den du besiegst, macht dich darin besser.“',
  '„Glühwürmchen? Wenn sie flüstern, hör zu.“',
  '„Ein Harzbier pro Tag. Mehr schenke ich nicht aus. Ich will hier keine Helden, die über ihre eigenen Füße stolpern.“',
];

/** Was Frieda dir beim n-ten Gespräch des Tages sagt (0, 1, 2 …). */
export function friedaSays(s: GameState, n: number): string {
  const p = s.player;
  const tips: string[] = [];
  const master = masterForLevel(p.level);
  if (s.stats.lastDeathDay && s.day - s.stats.lastDeathDay <= 1) {
    tips.push('„Morwen hat dich heute früh am Dorfrand abgesetzt, hab ich gehört. Iss erstmal was.“');
  }
  if (p.level < MAX_LEVEL && p.exp >= expNeeded(p.level) && !p.seenMaster && master) {
    tips.push(`„${master.name} hat nach dir gefragt. Ich glaube, du bist so weit. Der Trainingsplatz ist gleich um die Ecke.“`);
  }
  if (p.level >= MAX_LEVEL) {
    tips.push('„Du hast alle Meister geschlagen. Jetzt bleibt nur die Farnschlucht. Geh mit vollen Lebenspunkten, und nimm das Harzbier vorher.“');
  }
  const gearBehind = Math.min(p.weaponTier, p.armorTier) < p.level - 2;
  if (gearBehind) {
    const old = p.weaponTier <= p.armorTier ? WEAPONS[p.weaponTier].name : ARMORS[p.armorTier].name;
    tips.push(`„${old}? Damit gehst du noch in den Wald? Schau mal bei Alrik in der Schmiede vorbei.“`);
  }
  if (p.gold > 150 * p.level && p.bank < p.gold) {
    tips.push('„So viel Gold trägt man nicht spazieren. Bring es zu Ansgar ins Kontor, bevor es dir jemand im Wald abnimmt.“');
  }
  if (p.hp < maxHp(p) * 0.5) {
    tips.push('„Du blutest mir auf den Tisch. Mirla in der Kräuterhütte hat Salbe.“');
  }
  if (p.gems > 0 && !p.songToday) {
    tips.push('„Florian singt für einen Edelstein. Seine Lieder wirken, frag mich nicht wie.“');
  }
  if (!p.mount && p.gems >= 6) {
    tips.push(`„${p.gems} Edelsteine in der Tasche und immer noch zu Fuß? Merten im Pferdestall hat ein Pony für sechs. Mit Reittier schaffst du mehr im Wald.“`);
  }
  if (p.dragonKills > 0) {
    tips.push('„Ein Drachentöter in meiner Stube. Das erste Bier geht aufs Haus. Nein, Moment, doch nicht.“');
  }
  const lore = FRIEDA_LORE[(s.day + n) % FRIEDA_LORE.length];
  return tips[n] ?? lore;
}

const REGULARS = { wilma: 'Jägerin Wilma', hannes: 'Holzknecht Hannes', ambros: 'der alte Ambros' };

interface TableLine { who: string; t: string }

/** Drei Sätze vom Stammtisch, passend zum Spielstand und gleich für den ganzen Tag. */
export function regularsSay(s: GameState): TableLine[] {
  const p = s.player;
  const lines: TableLine[] = [];
  const found = Object.keys(s.bestiary).filter((k) => k !== 'dragon').length;

  if (p.dragonKills > 0) lines.push({ who: REGULARS.hannes, t: `„Da ist ${p.name}! ${p.dragonKills === 1 ? 'Hat den Wyrm erschlagen' : `Hat den Wyrm schon ${p.dragonKills}-mal erschlagen`}. Und kommt trotzdem jeden Tag wieder.“` });
  if (s.stats.lastDeathDay && s.day - s.stats.lastDeathDay <= 1) lines.push({ who: REGULARS.ambros, t: '„Wieder bei Morwen gewesen? Grüß sie von mir. Sie schuldet mir noch eine Fahrt.“' });
  if (p.level <= 2 && p.dragonKills === 0) lines.push({ who: REGULARS.hannes, t: '„Ein neues Gesicht! Fang bei den Moosratten an. Die beißen, aber nur ein bisschen.“' });
  if (p.level >= 8) lines.push({ who: REGULARS.wilma, t: `„Stufe ${p.level}. Die Trolle reden schon über dich, ${p.name}. Nicht nett, aber sie reden.“` });
  if (found >= 5) lines.push({ who: REGULARS.wilma, t: `„${found} verschiedene Viecher hast du schon erlegt? Ich jage seit zwanzig Jahren und hab nicht so viele gesehen.“` });

  const top = Object.entries(s.bestiary).filter(([k]) => k !== 'dragon').sort((a, b) => b[1] - a[1])[0];
  if (top && top[1] >= 10) {
    const m = MONSTERS.find((x) => x.id === top[0]);
    if (m) lines.push({ who: REGULARS.ambros, t: `„${m.name}, ${top[1]}-mal besiegt? Die erzählen sich im Wald schon Gruselgeschichten über dich.“` });
  }

  const banter: TableLine[] = [
    { who: REGULARS.hannes, t: '„Ich hab heute einen Baum gefällt. Er war größer als gestern. Der Wald wächst nachts, sag ich euch.“' },
    { who: REGULARS.ambros, t: '„Zu meiner Zeit gab es keine Edelsteine im Wald. Wir mussten sie selbst schleifen. Aus Kieseln.“' },
    { who: REGULARS.wilma, t: '„Wer hat meinen Pfeil im Wirtshausschild stecken lassen? Ach, das war ich.“' },
    { who: REGULARS.ambros, t: '„Der Wyrm? Hab ihn mal gesehen. Von weitem. Durch ein Astloch. Mit geschlossenen Augen.“' },
    { who: REGULARS.hannes, t: '„Frieda, noch eins! … Gut, dann Wasser. Mit Schaum, bitte.“' },
    { who: REGULARS.wilma, t: '„Die Galgenkrähen klauen alles, was glänzt. Gestern meinen Löffel. Ich ess jetzt mit dem Messer.“' },
    { who: REGULARS.ambros, t: '„Florian, spiel das Lied vom Bergtrollkönig! Nein, nicht das traurige. Das andere traurige.“' },
  ];
  const start = s.day % banter.length;
  const pool = [...lines.slice(0, 2)];
  for (let i = 0; pool.length < 3; i++) pool.push(banter[(start + i) % banter.length]);
  return pool;
}
