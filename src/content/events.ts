import { MAX_LEVEL, expPerKill, maxHp, specialUsesPerDay } from '../game/balance';
import { chance, roll } from '../game/rng';
import { SPECIALTIES } from './specialties';
import type { GameState, LogLine, Player } from '../game/types';

// Kleine Begegnungen im Wald statt eines Kampfes. Jede kostet einen Waldkampf.
// Manche passieren einfach (run), bei anderen entscheidet der Spieler (prompt + choices).

/** Was ein Ereignis außer dem Helden noch braucht: Spielstand, Tagesneuigkeiten, gemerkte Daten. */
export interface EventCtx {
  s: GameState;
  announce: (text: string) => void;
  /** Beim Stellen der Frage setzen (z. B. Rätselnummer), bei der Antwort wieder lesen. */
  data?: number;
}

export interface EventChoice {
  id: string;
  label: string;
  /** Beschriftung, die von der gemerkten Frage abhängt (Rätsel) */
  labelFor?: (data?: number) => string;
  key: string;
  hint?: (p: Player) => string;
  available?: (p: Player) => boolean;
  run: (p: Player, ctx: EventCtx) => LogLine[];
}

export interface ForestEvent {
  id: string;
  weight: number;
  minLevel?: number;
  run?: (p: Player, ctx: EventCtx) => LogLine[];
  prompt?: (p: Player, ctx: EventCtx) => LogLine[];
  choices?: EventChoice[];
  /** Keine Wahl hervorheben (z. B. beim Rätsel, sonst verrät der goldene Knopf nichts, wirkt aber so) */
  neutral?: boolean;
}

/** Rätsel des alten Baums. right = Index der richtigen Antwort. */
const RIDDLES: { q: string; a: [string, string, string]; right: number }[] = [
  { q: 'Je mehr du davon nimmst, desto mehr lässt du zurück. Was ist es?', a: ['Gold', 'Schritte', 'Zeit'], right: 1 },
  { q: 'Es hat Wurzeln, die niemand sieht, ist höher als jeder Baum, wächst aber nie. Was ist es?', a: ['Ein Berg', 'Ein Wyrm', 'Der Himmel'], right: 0 },
  { q: 'Ich habe Städte, aber keine Häuser, Wälder, aber keine Bäume, Wasser, aber keine Fische. Was bin ich?', a: ['Ein Traum', 'Eine Landkarte', 'Ein Spiegel'], right: 1 },
  { q: 'Was wird nasser, je mehr es trocknet?', a: ['Ein Handtuch', 'Moos', 'Ein Schwamm im Regen'], right: 0 },
  { q: 'Ohne Stimme schreit es, ohne Flügel flattert es, ohne Zähne beißt es, ohne Mund murmelt es. Was ist es?', a: ['Ein Geist', 'Der Wind', 'Feuer'], right: 1 },
  { q: 'Was gehört dir, wird aber von anderen viel öfter benutzt als von dir?', a: ['Dein Gold', 'Dein Pferd', 'Dein Name'], right: 2 },
  { q: 'Ich bin immer vor dir, aber du kannst mich nie sehen. Was bin ich?', a: ['Die Zukunft', 'Dein Schatten', 'Der Wald'], right: 0 },
  { q: 'Was hat einen Hals, aber keinen Kopf?', a: ['Ein Schwert', 'Eine Flasche', 'Ein Wurm'], right: 1 },
];

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
    return [{ t: 'Glühwürmchen umschwirren dich und flüstern dir etwas zu. Du bekommst einen Fähigkeitspunkt dazu.', k: 'good' }];
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
          return [{ t: 'Köstlich! Deine Wunden schließen sich, und du fühlst dich hellwach. Volle Lebenspunkte und ein Fähigkeitspunkt dazu.', k: 'good' }];
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
  // ---------- Nach dem Original (LoGD-Waldereignisse), in die Welt von Moosgrund übertragen ----------
  // Waldkämpfe zählen doppelt so viel wie im Original, weil unser Tag 20 statt 10 hat.

  // Glowing Stream: Trinken kann alles bedeuten, vom Tod bis zur vollen Heilung.
  { id: 'leuchtbach', weight: 5,
    prompt: () => [{ t: 'Du findest einen kleinen Bach, dessen Wasser schwach leuchtet. Es plätschert über runde, schneeweiße Steine. Du spürst eine seltsame Kraft darin. Ein Schluck könnte dir ungeahnte Stärke geben, oder dich zum Krüppel machen.', k: 'warn' }],
    choices: [
      { id: 'trinken', label: 'Trinken', key: 't', run: (p) => {
        const r = roll(1, 10);
        const head = { t: 'Du kniest dich ans Ufer und nimmst einen langen Schluck. Wärme breitet sich in deiner Brust aus …', k: 'info' as const };
        if (r === 1) {
          p.alive = false;
          return [head, { t: '… gefolgt von einer klammen, schrecklichen Kälte. Du sinkst ans Ufer und merkst erst jetzt, dass die weißen Steine gebleichte Schädel sind. Dir wird schwarz vor Augen.', k: 'bad' },
            { t: 'Die Tiere des Waldes meiden diesen Ort, darum behältst du dein Gold. Und die Lehre wiegt die Erfahrung auf, die du sonst verloren hättest.', k: 'info' }];
        }
        if (r === 2) {
          const lost = Math.min(2, p.forestFights);
          p.forestFights -= lost;
          p.hp = Math.max(1, Math.min(p.hp, Math.round(maxHp(p) * 0.1)));
          return [head, { t: '… gefolgt von eisiger Kälte. Schon wird dir schwarz vor Augen, da hörst du ein Kichern: Eine winzige Fee streut dir Feenstaub ins Gesicht, und du kommst wieder auf die Beine.', k: 'warn' },
            { t: `Knapp überlebt. Du verlierst die meisten Lebenspunkte${lost ? ` und ${lost} Waldkämpfe` : ''}.`, k: 'bad' }];
        }
        if (r === 3) { p.hp = Math.max(p.hp, maxHp(p)); p.forestFights += 2; return [head, { t: 'Du fühlst dich BELEBT! Volle Lebenspunkte und Kraft für 2 weitere Waldkämpfe.', k: 'good' }]; }
        if (r === 4) { p.gems += 1; return [head, { t: 'Du fühlst dich WACHSAM! Unter einem der Kiesel glitzert etwas: ein Edelstein!', k: 'gold' }]; }
        if (r <= 7) { p.forestFights += 2; return [head, { t: 'Du fühlst dich VOLLER TATENDRANG! 2 zusätzliche Waldkämpfe.', k: 'good' }]; }
        p.hp = Math.max(p.hp, maxHp(p));
        return [head, { t: 'Du fühlst dich GESUND! Deine Lebenspunkte sind wieder voll.', k: 'good' }];
      } },
      { id: 'nicht', label: 'Nicht trinken', key: 'n', run: () => [{ t: 'Die unheimliche Kraft im Wasser ist dir nicht geheuer. Du lässt den Bach leuchten und gehst weiter.', k: 'info' }] },
    ] },

  // Gold Mine: Graben kostet Zeit, bringt Gold und Edelsteine, manchmal einen Einsturz.
  { id: 'stollen', weight: 5, minLevel: 2,
    prompt: () => [{ t: 'Tief im Wald stößt du auf einen alten, verlassenen Stollen. Davor liegt rostiges Werkzeug. Graben würde dich Zeit für 2 Waldkämpfe kosten, und an den Wänden siehst du Spuren alter Einstürze.', k: 'warn' }],
    choices: [
      { id: 'graben', label: 'Nach Gold und Edelsteinen graben', key: 'g', available: (p) => p.forestFights > 0, hint: () => '2 Waldkämpfe', run: (p, ctx) => {
        const r = roll(1, 20);
        const tired = () => { p.forestFights = Math.max(0, p.forestFights - 2); };
        if (r <= 5) { tired(); return [{ t: 'Nach Stunden harter Arbeit findest du nur wertlose Steine und einen Schädel.', k: 'info' }]; }
        if (r <= 10) { const g = roll(p.level * 5, p.level * 20); p.gold += g; tired(); return [{ t: `Nach Stunden harter Arbeit findest du ${g} Gold!`, k: 'gold' }]; }
        if (r <= 15) { const n = roll(1, Math.round(p.level / 7) + 1); p.gems += n; tired(); return [{ t: `Nach Stunden harter Arbeit findest du ${n === 1 ? 'einen Edelstein' : `${n} Edelsteine`}!`, k: 'gold' }]; }
        if (r <= 18) {
          const g = roll(p.level * 10, p.level * 40); const n = roll(1, Math.round(p.level / 3) + 1);
          p.gold += g; p.gems += n; tired();
          ctx.announce(`${p.name} hat im alten Stollen eine reiche Ader gefunden.`);
          return [{ t: `Du hast die Hauptader gefunden! ${n === 1 ? 'Ein Edelstein' : `${n} Edelsteine`} und ${g} Gold!`, k: 'gold' }];
        }
        // Einsturz: Zwerge kennen sich unter Tage aus, ein Reittier kann dich herausziehen.
        const lines: LogLine[] = [{ t: 'Du glaubst, einen riesigen Edelstein und Gold zu sehen. Gierig holst du mit der Spitzhacke weit aus … und die Decke gibt nach!', k: 'warn' }];
        const saved = (p.race === 'zwerg' && chance(0.5)) ? 'zwerg' : (p.mount && chance(0.3)) ? 'mount' : chance(0.2) ? 'luck' : '';
        if (saved) {
          p.forestFights = 0;
          lines.push({ t: saved === 'zwerg' ? 'Dein Zwergenblut warnt dich im letzten Moment. Du springst zur Seite, bevor die Felsen fallen.' : saved === 'mount' ? 'Dein Reittier zerrt dich im letzten Moment am Kragen heraus!' : 'Mit purem Glück entkommst du dem Einsturz.', k: 'good' });
          lines.push({ t: 'Der Schreck sitzt so tief, dass du dich heute keinem Gegner mehr stellen kannst.', k: 'warn' });
          return lines;
        }
        const exp = Math.round(p.exp * 0.1);
        const lostGold = Math.round(p.gold / 2);
        p.exp += exp; p.gold -= lostGold;
        p.alive = false;
        ctx.announce(`${p.name} wurde im alten Stollen verschüttet.`);
        lines.push({ t: `Tonnen von Fels begraben dich. Immerhin hast du etwas übers Graben gelernt (${exp} Erfahrung). ${lostGold} Gold bleiben unter dem Geröll.`, k: 'bad' });
        return lines;
      } },
      { id: 'weg', label: 'Zurück in den Wald', key: 'w', run: () => [{ t: 'Für so eine mühsame Art, reich zu werden, hast du keine Zeit. Du lässt den Stollen hinter dir.', k: 'info' }] },
    ] },

  // Crazy Audrey: drei Körbe, drei Kätzchen. Gleiche Farben bringen Salbe (Waldkämpfe).
  { id: 'hulda', weight: 4,
    prompt: () => [
      { t: 'Auf einer stillen Lichtung stehen drei fest verschlossene Körbe. Aus einem hörst du ein leises Miauen. Kaum greifst du nach dem Deckel, springt die verrückte Hulda aus dem Gebüsch und reißt die Körbe an sich.', k: 'warn' },
      { t: '„Drei Körbe hab ich, das ist wahr, vier Kätzchen drin, ein buntes Paar. Kommen zwei gleiche Farben raus, geb ich dir Salbe für den Strauß. Sind alle drei verschieden bunt, gehst du heut früher in den Grund.“', k: 'info' },
    ],
    choices: [
      { id: 'spielen', label: 'Huldas Spiel spielen', key: 's', run: (p) => {
        const colors = ['getigertes', 'schwarzes', 'rotes', 'weißes'];
        let c = [roll(0, 3), roll(0, 3), roll(0, 3)];
        const hedgehogs = roll(1, 20) === 1;
        if (hedgehogs) c = [4, 4, 4];
        const name = (i: number) => (i === 4 ? 'ein Igel' : `ein ${colors[i]} Kätzchen`);
        const lines: LogLine[] = [{ t: `Hulda klopft auf den ersten Korb: ${name(c[0])} schaut heraus. Der zweite: ${name(c[1])}. Aus dem dritten hüpft ${name(c[2])} und klettert Hulda auf die Schulter.`, k: 'info' }];
        if (c[0] === c[1] && c[1] === c[2]) {
          if (hedgehogs) { p.forestFights += 10; lines.push({ t: '„Igel? IGEL?? Hahaha, IGEL!“ Hulda schnappt sie sich und rennt jubelnd in den Wald. Sie hat einen ganzen Beutel Salbe fallen lassen! 10 zusätzliche Waldkämpfe.', k: 'gold' }); }
          else { p.forestFights += 4; lines.push({ t: '„Ihr seid ALLE ganz böse Kätzchen!“, schimpft Hulda. „Weil alle gleich waren, kriegst du ZWEI Salben.“ Du reibst sie dir zwischen die Zehen. 4 zusätzliche Waldkämpfe.', k: 'good' }); }
        } else if (c[0] === c[1] || c[1] === c[2] || c[0] === c[2]) {
          p.forestFights += 2;
          lines.push({ t: '„Ihr verrückten Kätzchen, was wisst ihr schon!“ Trotzdem gibt Hulda dir eine Salbe. 2 zusätzliche Waldkämpfe.', k: 'good' });
        } else if (p.forestFights > 0) {
          p.forestFights = Math.max(0, p.forestFights - 2);
          lines.push({ t: '„Gut gemacht, meine Schätzchen!“ Das Kätzchen auf ihrer Schulter springt dich an. Es abzuwehren kostet dich Kraft. 2 Waldkämpfe weniger.', k: 'bad' });
        } else {
          if (p.charm > 0) p.charm -= 1;
          lines.push({ t: '„Gut gemacht, meine Schätzchen!“ Das Kätzchen springt dich an und hinterlässt einen hässlichen Kratzer im Gesicht. (−1 Charme)', k: 'bad' });
        }
        return lines;
      } },
      { id: 'weg', label: 'Vor Hulda davonlaufen', key: 'w', run: () => [{ t: 'Du rennst, sehr schnell, weg von dieser verrückten Frau.', k: 'info' }] },
    ] },

  // Foilwench: Für einen Edelstein wird man besser in seiner Fähigkeit.
  { id: 'lehrmeisterin', weight: 4,
    prompt: (p) => [{ t: `In einer schiefen Hütte sitzt eine alte, narbige Kriegerin. „Ich bin Gerlinde, Meisterin aller Künste. Ich bringe dir mehr ${SPECIALTIES[p.specialty].name} bei. Unter zwei Bedingungen.“ „Zwei Bedingungen?“, fragst du. „Erstens: ein Edelstein. Zweitens: Hör auf, alles als Frage zu wiederholen!“`, k: 'warn' }],
    choices: [
      { id: 'geben', label: 'Ihr einen Edelstein geben', key: 'e', hint: () => '1 Edelstein', available: (p) => p.gems > 0, run: (p) => {
        p.gems -= 1;
        p.skill += 1;
        const lines: LogLine[] = [{ t: `Gerlinde gibt dir ein Stück Pergament mit Anweisungen. Du lernst es auswendig und isst es dann auf, damit es niemand findet. „Das hättest du nicht essen müssen …“ ${SPECIALTIES[p.specialty].name} steigt auf Stufe ${p.skill}.`, k: 'good' }];
        if (p.skill % 3 === 0) { p.specialUses += 1; lines.push({ t: 'Du bekommst einen Fähigkeitspunkt mehr pro Tag!', k: 'gold' }); }
        return lines;
      } },
      { id: 'nein', label: 'Keinen Edelstein geben', key: 'k', run: () => [{ t: '„Wenn du reich werden willst, musst du das schon selbst schaffen“, sagst du und stapfst davon.', k: 'info' }] },
    ] },

  // Dark Horse Tavern: ein verstecktes Wirtshaus im Nebel, ein alter Mann will würfeln.
  { id: 'dunklesross', weight: 3,
    prompt: (p) => [{ t: `Eine Baumgruppe kommt dir bekannt vor. Nebel kriecht heran, dein Kopf summt${p.mount ? ', aber dein Reittier scheint den Weg zu kennen' : ''}. Als er sich lichtet, steht vor dir eine Blockhütte mit rauchendem Schornstein. Über der Tür: „Zum Dunklen Ross“. Drinnen ist es still. In der Ecke spielt ein alter Mann mit Würfeln. „Ein Abenteurer hat mir fast mein ganzes Geld abgenommen“, seufzt er. „Gibst du mir eine Chance, etwas zurückzugewinnen?“`, k: 'warn' }],
    choices: [
      { id: 'wuerfeln', label: 'Mit dem Alten würfeln', key: 'w', hint: (p) => `${p.level * 10} Gold Einsatz`, available: (p) => p.gold >= p.level * 10, run: (p) => {
        const bet = p.level * 10;
        const me = roll(1, 6) + roll(1, 6);
        const him = roll(1, 6) + roll(1, 6);
        if (me > him) { p.gold += bet; return [{ t: `Du würfelst ${me}, der Alte ${him}. Er schiebt dir brummend ${bet} Gold hin.`, k: 'gold' }]; }
        if (me < him) { p.gold -= bet; return [{ t: `Du würfelst ${me}, der Alte ${him}. Er kichert und steckt deine ${bet} Gold ein. „Danke, Kindchen.“`, k: 'bad' }]; }
        return [{ t: `Ihr würfelt beide ${me}. „Unentschieden“, murmelt der Alte. „Das zählt nicht.“`, k: 'info' }];
      } },
      { id: 'schnaps', label: 'Beim Wirt einen Kräuterschnaps trinken', key: 's', hint: (p) => `${p.level * 5} Gold`, available: (p) => p.gold >= p.level * 5, run: (p) => {
        p.gold -= p.level * 5;
        const h = mend(p, 0.5);
        return [{ t: `Der Wirt, ein Hänfling von einem alten Mann, schenkt dir etwas Grünes ein. Es brennt bis in die Zehen. ${h ? `+${h} Lebenspunkte.` : 'Gesund warst du schon vorher, aber gut war er trotzdem.'}`, k: 'good' }];
      } },
      { id: 'weg', label: 'Den Ort verlassen', key: 'v', run: () => [{ t: 'Der Nebel kommt zurück. Als er sich lichtet, stehst du wieder dort, wo alles anfing. Wie du hingekommen bist, weißt du nicht mehr.', k: 'info' }] },
    ] },

  // Stonehenge: Wer in den Steinkreis tritt, erlebt eine Überraschung.
  { id: 'steinkreis', weight: 4,
    prompt: () => [{ t: 'Mitten im Wald stehen bemooste Steine im Kreis, höher als drei Männer. In der Mitte summt die Luft. Die Alten sagen, wer hineintritt, kommt verändert wieder heraus.', k: 'warn' }],
    choices: [
      { id: 'hinein', label: 'In den Kreis treten', key: 'k', run: (p, ctx) => {
        const r = roll(1, 20);
        if (r === 1) {
          p.alive = false;
          ctx.announce(`${p.name} ist im Steinkreis verschwunden. Morwen weiß mehr.`);
          return [{ t: 'Die Steine beginnen zu singen. Der Boden unter dir wird zu Nebel, und du fällst … direkt in Morwens Boot. „Na so was“, sagt sie.', k: 'bad' }];
        }
        if (r <= 4) { p.charm += 1; return [{ t: 'Ein warmes Licht hüllt dich ein. Du fühlst dich schöner. (+1 Charme)', k: 'good' }]; }
        if (r <= 6) { if (p.charm > 0) p.charm -= 1; return [{ t: 'Ein Windstoß zerzaust dich so gründlich, dass es wohl Tage dauert, bis du wieder ordentlich aussiehst. (−1 Charme)', k: 'bad' }]; }
        if (r <= 10) { p.forestFights += 2; return [{ t: 'Die Steine summen, und eine seltsame Frische fährt dir in die Glieder. 2 zusätzliche Waldkämpfe.', k: 'good' }]; }
        if (r <= 13) { const lost = Math.min(2, p.forestFights); p.forestFights -= lost; return [{ t: `Du wanderst im Kreis, stundenlang, und kommst nicht mehr heraus. Als es endlich klappt, ist der halbe Tag vorbei.${lost ? ` (−${lost} Waldkämpfe)` : ''}`, k: 'bad' }]; }
        if (r <= 16) { p.hp = Math.max(p.hp, maxHp(p)); return [{ t: 'Das Moos unter deinen Füßen leuchtet. Deine Wunden schließen sich.', k: 'good' }]; }
        if (r <= 19) { p.gems += 1; return [{ t: 'Am Fuß des größten Steins liegt ein Edelstein, als hätte jemand ihn für dich hingelegt.', k: 'gold' }]; }
        p.baseMaxHp += 1;
        p.hp += 1;
        return [{ t: 'Ein Blitz aus heiterem Himmel fährt in den mittleren Stein und von dort in dich. Du überlebst. Mehr noch: Du fühlst dich dauerhaft zäher. (+1 maximale Lebenspunkte, für immer)', k: 'gold' }];
      } },
      { id: 'weg', label: 'Lieber außen herum gehen', key: 'w', run: () => [{ t: 'Du machst einen großen Bogen um die Steine. Man muss ja nicht alles ausprobieren.', k: 'info' }] },
    ] },

  // Damsel in distress: Jemand ruft aus einem alten Turm um Hilfe.
  { id: 'turm', weight: 4,
    prompt: (p) => [{ t: `Aus einem efeubewachsenen Turm ruft jemand um Hilfe. Am Fenster siehst du ${p.gender === 'f' ? 'einen jungen Mann' : 'eine junge Frau'} winken. Die Tür ist mit einem dicken Riegel verschlossen.`, k: 'warn' }],
    choices: [
      { id: 'retten', label: 'Den Riegel aufbrechen', key: 'r', run: (p, ctx) => {
        const r = roll(1, 20);
        if (r <= 12) {
          const n = roll(1, 2);
          p.gems += n; p.charm += 1;
          ctx.announce(`${p.name} hat jemanden aus dem alten Turm im Brackenwald befreit.`);
          return [{ t: `Mit einem Ruck gibt der Riegel nach. Dankbar fällt man dir um den Hals und drückt dir ${n === 1 ? 'einen Edelstein' : `${n} Edelsteine`} in die Hand. (+1 Charme)`, k: 'gold' }];
        }
        if (r <= 17) {
          const d = hurt(p, 0.3);
          return [{ t: `Kaum ist die Tür offen, steht da ein grinsender Waldtroll in einem Kleid. Eine Falle! Er haut dir eine runter und verschwindet lachend im Wald. ${d} Schaden.`, k: 'bad' }];
        }
        return [{ t: 'Die Tür springt auf. Der Turm ist leer, nur ein Spatz fliegt heraus. Hat er um Hilfe gerufen?', k: 'info' }];
      } },
      { id: 'weg', label: 'Weitergehen', key: 'w', run: () => [{ t: 'Du rufst, dass bestimmt gleich jemand anderes vorbeikommt, und gehst weiter.', k: 'info' }] },
    ] },

  // Riddles: Ein alter Waldgeist stellt ein Rätsel.
  { id: 'raetsel', weight: 4,
    prompt: (_p, ctx) => {
      const i = roll(0, RIDDLES.length - 1);
      ctx.data = i;
      const q = RIDDLES[i];
      return [
        { t: 'Ein knorriger Baum öffnet die Augen. „Halt, Wanderer! Löse mein Rätsel, dann sollst du belohnt werden. Liegst du falsch, hältst du mich lange auf.“', k: 'warn' },
        { t: `„${q.q}“`, k: 'info' },
      ];
    },
    neutral: true,
    choices: (['A', 'B', 'C'] as const).map((letter, n) => ({
      id: letter.toLowerCase(), label: `Antwort ${letter}`, labelFor: (d?: number) => `${letter} · ${RIDDLES[d ?? 0].a[n]}`, key: letter.toLowerCase(), run: (p: Player, ctx: EventCtx) => {
        const q = RIDDLES[ctx.data ?? 0];
        if (n === q.right) {
          if (chance(0.5)) { p.gems += 1; return [{ t: `„Richtig!“ Der Baum lässt einen Edelstein aus seinen Wurzeln kullern.`, k: 'gold' }]; }
          const e = Math.round(expPerKill(p.level) * 2);
          p.exp += e;
          return [{ t: `„Richtig!“ Der Baum erzählt dir uralte Geschichten aus dem Wald. Du lernst ${e} Erfahrung.`, k: 'good' }];
        }
        const lost = Math.min(2, p.forestFights);
        p.forestFights -= lost;
        return [{ t: `„Falsch! Die Antwort war: ${q.a[q.right]}.“ Der Baum erklärt dir sehr, sehr ausführlich, warum.${lost ? ` (−${lost} Waldkämpfe)` : ''}`, k: 'bad' }];
      },
    })),
  },

  // Waterfall: Hinter dem Wasserfall liegt manchmal ein Schatz.
  { id: 'wasserfall', weight: 4,
    prompt: () => [{ t: 'Du hörst einen Wasserfall rauschen. Hinter dem Wasservorhang meinst du eine Höhle zu erkennen. Die Felsen davor sind glitschig vom Moos.', k: 'warn' }],
    choices: [
      { id: 'klettern', label: 'Hinter den Wasserfall klettern', key: 'k', run: (p) => {
        const r = roll(1, 10);
        if (r <= 4) { const g = roll(p.level * 10, p.level * 30); p.gold += g; return [{ t: `In der Höhle liegt der verrottete Rucksack eines Abenteurers. Darin: ${g} Gold.`, k: 'gold' }]; }
        if (r <= 6) { p.gems += 1; return [{ t: 'An der Höhlenwand glitzert ein Edelstein. Mit etwas Mühe brichst du ihn heraus.', k: 'gold' }]; }
        const d = hurt(p, 0.2);
        return [{ t: `Du rutschst auf dem Moos aus und landest im eiskalten Becken. Prustend kletterst du heraus. ${d} Schaden, und nass bist du auch.`, k: 'bad' }];
      } },
      { id: 'weg', label: 'Weitergehen', key: 'w', run: () => [{ t: 'Nasse Füße hast du schon genug. Du gehst weiter.', k: 'info' }] },
    ] },

  // Find potion: Eine reisende Kräuterhändlerin verkauft Heiltränke.
  { id: 'haendlerin', weight: 4,
    prompt: (p) => [{ t: `Eine Kräuterhändlerin mit einem Karren voller Fläschchen kommt dir entgegen. „Heiltrank gefällig? Frisch gebraut, wirkt sofort. Nur ${p.level * 12} Gold.“`, k: 'warn' }],
    choices: [
      { id: 'kaufen', label: 'Einen Heiltrank kaufen', key: 'k', hint: (p) => `${p.level * 12} Gold`, available: (p) => p.gold >= p.level * 12, run: (p) => {
        p.gold -= p.level * 12;
        const h = mend(p, 1);
        return [{ t: h ? `Der Trank schmeckt nach Waldmeister und Rost. Deine Wunden schließen sich. +${h} Lebenspunkte.` : 'Du trinkst ihn, obwohl du gar nicht verletzt bist. Er schmeckt trotzdem nach Waldmeister.', k: 'good' }];
      } },
      { id: 'nein', label: 'Danke, nein', key: 'n', run: () => [{ t: 'Die Händlerin zuckt mit den Schultern und zieht weiter.', k: 'info' }] },
    ] },

  // Remains: Überreste eines unglücklichen Abenteurers.
  { id: 'gebeine', weight: 5, run: (p) => {
    const g = roll(p.level * 5, p.level * 25);
    p.gold += g;
    return [{ t: `Unter einem Farn liegen die Gebeine eines Abenteurers, der weniger Glück hatte als du. In seinem Beutel stecken noch ${g} Gold. Er braucht sie nicht mehr.`, k: 'gold' }];
  } },

  // Quicksand: Sumpfloch kostet Zeit oder Gold.
  { id: 'sumpfloch', weight: 4, run: (p) => {
    if (chance(0.5) && p.gold > 0) {
      const g = Math.ceil(p.gold * 0.15);
      p.gold -= g;
      return [{ t: `Du gerätst in ein Sumpfloch und sinkst bis zur Hüfte ein. Beim Herausstrampeln rutscht dir der Geldbeutel auf. ${g} Gold versinken im Schlamm.`, k: 'bad' }];
    }
    const lost = Math.min(2, p.forestFights);
    p.forestFights -= lost;
    return [{ t: `Du gerätst in ein Sumpfloch. Es dauert ewig, bis du dich an einer Wurzel herausgezogen hast.${lost ? ` (−${lost} Waldkämpfe)` : ''}`, k: 'bad' }];
  } },
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
