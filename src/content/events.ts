import { MAX_LEVEL, expPerKill, maxHp, specialUsesPerDay } from '../game/balance';
import { chance, roll } from '../game/rng';
import type { LogLine, Player } from '../game/types';

// Kleine Begegnungen im Wald statt eines Kampfes. Jede kostet einen Waldkampf.
// Manche passieren einfach (run), bei anderen entscheidet der Spieler (prompt + choices).

export interface EventChoice {
  id: string;
  label: string;
  key: string;
  hint?: (p: Player) => string;
  available?: (p: Player) => boolean;
  run: (p: Player) => LogLine[];
}

export interface ForestEvent {
  id: string;
  weight: number;
  minLevel?: number;
  run?: (p: Player) => LogLine[];
  prompt?: (p: Player) => LogLine[];
  choices?: EventChoice[];
}

const hurt = (p: Player, share: number): number => {
  const d = Math.max(1, Math.round(maxHp(p) * share));
  p.hp = Math.max(1, p.hp - d);
  return d;
};
const mend = (p: Player, share: number): number => {
  const before = p.hp;
  p.hp = Math.min(maxHp(p), p.hp + Math.round(maxHp(p) * share));
  return p.hp - before;
};

export const FOREST_EVENTS: ForestEvent[] = [
  // ---------- Einfach passiert ----------
  { id: 'eichhoernchen', weight: 12, run: (p) => {
    const g = roll(5, 15) * p.level;
    p.gold += g;
    return [{ t: `Ein Eichhörnchen hat in einem hohlen Baum Gold versteckt. Es hätte besser aufpassen sollen. Du findest ${g} Gold.`, k: 'gold' }];
  } },
  // Wie der alte Mann mit dem Stock im Original: ein Schlag macht hübscher oder hässlicher.
  { id: 'kauz', weight: 6, run: (p) => {
    if (chance(0.5)) {
      p.charm += 1;
      return [{ t: 'Ein alter Kauz springt hinter einem Baum hervor und haut dir mit einem knorrigen Stock auf den Kopf. „Der Schönheitsstock!“, kichert er und verschwindet. Du fühlst dich tatsächlich etwas hübscher. (+1 Charme)', k: 'good' }];
    }
    const lost = p.charm > 0;
    if (lost) p.charm -= 1;
    return [{ t: `Ein alter Kauz springt hinter einem Baum hervor und haut dir mit einem krummen Stock auf den Kopf. „Der Hässlichkeitsstock!“, kichert er und verschwindet.${lost ? ' Du fühlst dich weniger ansehnlich. (−1 Charme)' : ' Viel kaputt machen konnte er nicht mehr.'}`, k: 'bad' }];
  } },
  { id: 'edelstein', weight: 5, run: (p) => {
    p.gems += 1;
    return [{ t: 'Zwischen den Wurzeln einer alten Buche glitzert etwas: ein Edelstein!', k: 'gold' }];
  } },
  { id: 'moosquelle', weight: 8, run: (p) => {
    p.hp = maxHp(p);
    return [{ t: 'Du findest eine Moosquelle. Das Wasser schmeckt nach Regen und schließt deine Wunden.', k: 'good' }];
  } },
  { id: 'dornen', weight: 8, run: (p) => {
    const d = hurt(p, 0.1);
    return [{ t: `Du stolperst in einen Brombeerstrauch. Er ist nicht so freundlich, wie Brombeeren schmecken. ${d} Schaden.`, k: 'bad' }];
  } },
  { id: 'pilzring', weight: 7, run: (p) => {
    if (chance(0.5)) {
      p.forestFights += 1;
      return [{ t: 'Du trittst in einen Pilzring. Die Zeit fühlt sich plötzlich länger an. Du erhältst einen zusätzlichen Waldkampf.', k: 'good' }];
    }
    p.forestFights = Math.max(0, p.forestFights - 1);
    return [{ t: 'Du trittst in einen Pilzring und tanzt eine Stunde lang, ohne es zu wollen. Du verlierst einen Waldkampf.', k: 'warn' }];
  } },
  { id: 'koehler', weight: 7, run: (p) => {
    const e = expPerKill(p.level);
    p.exp += e;
    return [{ t: `Ein alter Köhler erzählt dir von seinen Kämpfen. Die Hälfte davon ist gelogen, aber du lernst trotzdem etwas. ${e} Erfahrung.`, k: 'good' }];
  } },
  { id: 'loch', weight: 5, run: (p) => {
    const g = Math.floor(p.gold * 0.1);
    if (g < 1) return [{ t: 'Dein Geldbeutel hat ein Loch. Zum Glück war nichts drin.', k: 'info' }];
    p.gold -= g;
    return [{ t: `Dein Geldbeutel hat ein Loch. Irgendwo im Wald liegen jetzt ${g} Gold.`, k: 'bad' }];
  } },
  { id: 'gluehwuermchen', weight: 6, run: (p) => {
    if (p.specialUses >= specialUsesPerDay(p) + 2) {
      return [{ t: 'Glühwürmchen umschwirren dich. Du fühlst dich schon randvoll mit Kraft.', k: 'info' }];
    }
    p.specialUses += 1;
    return [{ t: 'Glühwürmchen umschwirren dich und flüstern dir etwas zu. Du kannst deine Fähigkeit einmal mehr einsetzen.', k: 'good' }];
  } },
  { id: 'igel', weight: 7, run: () => [
    { t: 'Etwas raschelt im Unterholz. Es ist ein Igel. Er sieht dich vorwurfsvoll an, bis du weitergehst.', k: 'info' },
  ] },
  { id: 'kraeuter', weight: 7, run: (p) => {
    const h = mend(p, 0.3);
    if (!h) return [{ t: 'Du findest Wundkraut. Du brauchst es gerade nicht, aber es riecht gut.', k: 'info' }];
    return [{ t: `Am Bachrand wächst Wundkraut. Du kaust ein paar Blätter. Bitter, aber es hilft: ${h} Lebenspunkte.`, k: 'good' }];
  } },
  { id: 'waldlaeufer', weight: 6, run: (p) => {
    const e = Math.round(expPerKill(p.level) * 0.6);
    p.exp += e;
    return [{ t: `Eine Waldläuferin zeigt dir, wie man sich lautlos durchs Farnkraut bewegt. Du trittst trotzdem auf jeden Ast. ${e} Erfahrung.`, k: 'good' }];
  } },
  { id: 'raeuber', weight: 5, run: (p) => {
    if (p.level >= 8) {
      const g = roll(10, 20) * p.level;
      p.gold += g;
      return [{ t: `Drei Wegelagerer springen aus dem Gebüsch, sehen dich an und überlegen es sich anders. Einer lässt vor Schreck ${g} Gold fallen.`, k: 'gold' }];
    }
    const g = Math.floor(p.gold * 0.2);
    if (g < 1) return [{ t: 'Wegelagerer durchsuchen dich, finden nichts und geben dir aus Mitleid einen Apfel.', k: 'info' }];
    p.gold -= g;
    return [{ t: `Wegelagerer! Sie sind schneller als du und nehmen ${g} Gold mit. Das Kontor wäre sicherer gewesen.`, k: 'bad' }];
  } },
  { id: 'spuren', weight: 4, minLevel: 10, run: (p) => {
    const e = expPerKill(p.level);
    p.exp += e;
    return [{ t: p.level >= MAX_LEVEL
      ? 'Riesige Krallenspuren führen nach Norden, zur Farnschlucht. Sie sind frisch. Der Wyrm ist wach.'
      : `Du findest einen Abdruck im Lehm, so groß wie ein Wagenrad. Du lernst etwas über Demut. ${e} Erfahrung.`, k: 'warn' }];
  } },

  // ---------- Mit Entscheidung ----------
  { id: 'moosfee', weight: 5,
    prompt: () => [{ t: 'Eine winzige Moosfee landet auf deiner Schulter. „Hast du einen Edelstein für mich?“, fragt sie und klimpert mit den Wimpern.', k: 'warn' }],
    choices: [
      { id: 'geben', label: 'Edelstein schenken', key: 'e', hint: () => '1 Edelstein', available: (p) => p.gems > 0, run: (p) => {
        p.gems -= 1;
        if (chance(0.5)) {
          p.baseMaxHp += 1;
          p.hp += 1;
          return [{ t: 'Die Fee küsst dich auf die Stirn. Ein warmes Kribbeln. Deine Lebenskraft steigt dauerhaft um 1.', k: 'gold' }];
        }
        p.forestFights += 2;
        p.hp = maxHp(p);
        return [{ t: 'Die Fee streut Glitzer über dich. Du fühlst dich ausgeruht wie nach einem Sonntag: volle Lebenspunkte und 2 zusätzliche Waldkämpfe.', k: 'gold' }];
      } },
      { id: 'nein', label: 'Höflich ablehnen', key: 'a', run: () => [
        { t: '„Geizhals“, murmelt die Fee und fliegt beleidigt davon.', k: 'info' },
      ] },
    ] },
  { id: 'truhe', weight: 6,
    prompt: () => [{ t: 'Halb im Moos versunken steht eine alte Truhe. Das Schloss ist verrostet, der Deckel klemmt ein wenig.', k: 'warn' }],
    choices: [
      { id: 'auf', label: 'Truhe aufbrechen', key: 'a', run: (p) => {
        const r = roll(1, 100);
        if (r <= 55) {
          const g = roll(20, 40) * p.level;
          p.gold += g;
          return [{ t: `Der Deckel springt auf. Darin: ${g} Gold und eine sehr alte Socke. Du nimmst das Gold.`, k: 'gold' }];
        }
        if (r <= 75) {
          p.gems += 1;
          return [{ t: 'In der Truhe liegt, eingewickelt in Samt, ein Edelstein.', k: 'gold' }];
        }
        const d = hurt(p, 0.2);
        return [{ t: `Die Truhe beißt zu! Es ist ein Truhenschnapper, und er ist hungrig. ${d} Schaden, bevor er ins Unterholz hoppelt.`, k: 'bad' }];
      } },
      { id: 'weg', label: 'Lieber liegen lassen', key: 'l', run: () => [
        { t: 'Du gehst weiter. Hinter dir klappert der Deckel. Vielleicht war das klug.', k: 'info' },
      ] },
    ] },
  { id: 'brunnen', weight: 5,
    prompt: (p) => [{ t: `Zwischen den Bäumen steht ein moosbewachsener Wunschbrunnen. Auf dem Rand ist eingeritzt: „${5 * p.level} Gold für einen Wunsch.“`, k: 'warn' }],
    choices: [
      { id: 'werfen', label: 'Gold hineinwerfen', key: 'g', hint: (p) => `${5 * p.level} Gold`, available: (p) => p.gold >= 5 * p.level, run: (p) => {
        p.gold -= 5 * p.level;
        const r = roll(1, 3);
        if (r === 1) {
          p.gems += 1;
          return [{ t: 'Aus der Tiefe plätschert es zurück. Am Eimer klebt ein Edelstein.', k: 'gold' }];
        }
        if (r === 2) {
          p.buffs.push({ name: 'Brunnenglück', atkMult: 1.2, rounds: 12 });
          return [{ t: 'Das Wasser leuchtet kurz auf. Du fühlst dich, als könnte heute nichts schiefgehen. (Brunnenglück: mehr Angriff für 12 Runden)', k: 'good' }];
        }
        return [{ t: 'Plopp. Nichts passiert. Brunnen sind auch nur Löcher mit gutem Ruf.', k: 'info' }];
      } },
      { id: 'weg', label: 'Weitergehen', key: 'w', run: () => [{ t: 'Du behältst dein Gold. Der Brunnen gluckert enttäuscht.', k: 'info' }] },
    ] },
  { id: 'pilz', weight: 5,
    prompt: () => [{ t: 'Auf einem Baumstumpf wächst ein Pilz, der leise leuchtet. Er riecht nach Honig und ein bisschen nach Abenteuer.', k: 'warn' }],
    choices: [
      { id: 'essen', label: 'Pilz essen', key: 'e', run: (p) => {
        if (chance(0.5)) {
          p.hp = maxHp(p);
          p.specialUses += 1;
          return [{ t: 'Köstlich! Deine Wunden schließen sich, und du fühlst dich hellwach. Volle Lebenspunkte, Fähigkeit +1.', k: 'good' }];
        }
        const d = hurt(p, 0.15);
        p.forestFights = Math.max(0, p.forestFights - 1);
        return [{ t: `Die Bäume fangen an zu singen. Leider falsch. Du verbringst eine Stunde im Farn: ${d} Schaden und ein Waldkampf weniger.`, k: 'bad' }];
      } },
      { id: 'nein', label: 'Stehen lassen', key: 's', run: () => [{ t: 'Mirla hat immer gesagt: Was leuchtet, isst man nicht. Du hältst dich daran.', k: 'info' }] },
    ] },
  { id: 'schrein', weight: 5,
    prompt: () => [{ t: 'Unter einer uralten Eiche liegt ein kleiner Schrein aus Feldsteinen. Jemand hat Blumen hingelegt, andere eine Münze.', k: 'warn' }],
    choices: [
      { id: 'beten', label: 'Kurz innehalten', key: 'k', run: (p) => {
        const h = mend(p, 0.25);
        return [{ t: h ? `Der Wind rauscht in der Eiche. Du fühlst dich ruhiger und heiler: ${h} Lebenspunkte.` : 'Der Wind rauscht in der Eiche. Du fühlst dich ruhiger.', k: 'good' }];
      } },
      { id: 'opfern', label: 'Edelstein opfern', key: 'e', hint: () => '1 Edelstein', available: (p) => p.gems > 0, run: (p) => {
        p.gems -= 1;
        p.hp = maxHp(p);
        p.buffs.push({ name: 'Segen der Eiche', atkMult: 1.3, rounds: 20 });
        return [{ t: 'Der Edelstein versinkt im Moos. Grünes Licht fließt dir in die Arme. (Segen der Eiche: viel mehr Angriff für 20 Runden, volle Lebenspunkte)', k: 'gold' }];
      } },
      { id: 'weg', label: 'Weitergehen', key: 'w', run: () => [{ t: 'Du nickst dem Schrein zu und gehst weiter.', k: 'info' }] },
    ] },
  { id: 'soeldner', weight: 5,
    prompt: () => [{ t: 'An einen Baum gelehnt schnarcht ein Söldner. Neben ihm liegt ein prall gefüllter Geldbeutel.', k: 'warn' }],
    choices: [
      { id: 'wecken', label: 'Ihn wecken', key: 'w', run: (p) => {
        const e = Math.round(expPerKill(p.level) * 0.8);
        p.exp += e;
        return [{ t: `Der Söldner schreckt hoch, bedankt sich und zeigt dir zum Dank einen gemeinen Trick mit dem Ellbogen. ${e} Erfahrung.`, k: 'good' }];
      } },
      { id: 'klauen', label: 'Den Beutel nehmen', key: 'b', run: (p) => {
        if (chance(0.6)) {
          const g = roll(15, 30) * p.level;
          p.gold += g;
          return [{ t: `Er schläft weiter. Im Beutel sind ${g} Gold. Dein Gewissen zwickt ein wenig.`, k: 'gold' }];
        }
        const d = hurt(p, 0.25);
        return [{ t: `Er schläft nicht. Eine Faust, groß wie ein Brotlaib, trifft dich: ${d} Schaden.`, k: 'bad' }];
      } },
      { id: 'weg', label: 'Leise weitergehen', key: 'l', run: () => [{ t: 'Du schleichst vorbei. Er murmelt etwas von Wurstbroten.', k: 'info' }] },
    ] },
  { id: 'wanderer', weight: 5,
    prompt: () => [{ t: 'Ein verletzter Wanderer sitzt am Wegrand und hält sich das Bein. „Ein Eulenbär“, stöhnt er. „Hast du etwas Verbandszeug?“', k: 'warn' }],
    choices: [
      { id: 'helfen', label: 'Ihn verbinden', key: 'v', run: (p) => {
        const d = hurt(p, 0.1);
        const e = Math.round(expPerKill(p.level) * 1.5);
        p.exp += e;
        return [{ t: `Du reißt dein Hemd in Streifen (${d} Schaden durch die Kälte, sagen wir). Er erzählt dir dafür alles über Eulenbären. ${e} Erfahrung.`, k: 'good' }];
      } },
      { id: 'weg', label: 'Keine Zeit', key: 'k', run: () => [{ t: 'Du gehst weiter. Er ruft dir etwas nach, das man in Moosgrund nicht laut sagt.', k: 'info' }] },
    ] },
];

function eligible(p: Player): ForestEvent[] {
  return FOREST_EVENTS.filter((e) => !e.minLevel || p.level >= e.minLevel);
}

export function pickEvent(p: Player): ForestEvent {
  const list = eligible(p);
  const total = list.reduce((s, e) => s + e.weight, 0);
  let r = roll(1, total);
  for (const e of list) {
    r -= e.weight;
    if (r <= 0) return e;
  }
  return list[0];
}

export function eventById(id: string): ForestEvent | undefined {
  return FOREST_EVENTS.find((e) => e.id === id);
}
