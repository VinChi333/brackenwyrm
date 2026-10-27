import { MAX_LEVEL, expPerKill, maxHp, specialUsesPerDay } from '../game/balance';
import { chance, roll } from '../game/rng';
import { SPECIALTIES } from './specialties';
import { FESTE_TEXT } from './feste';
import type { GameState, LogLine, Player } from '../game/types';

import { t } from '../i18n';
import { news } from '../i18n/news';

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
  /** Nur wenn das zutrifft (z. B. Feste noch nicht gefunden) */
  when?: (p: Player) => boolean;
  run?: (p: Player, ctx: EventCtx) => LogLine[];
  prompt?: (p: Player, ctx: EventCtx) => LogLine[];
  choices?: EventChoice[];
  /** Keine Wahl hervorheben (z. B. beim Rätsel, sonst verrät der goldene Knopf nichts, wirkt aber so) */
  neutral?: boolean;
}

/** Rätsel des alten Baums. right = Index der richtigen Antwort. */
const RIDDLES: { q: string; a: [string, string, string]; right: number }[] = [
  { q: t('Je mehr du davon nimmst, desto mehr lässt du zurück. Was ist es?'), a: [t('Gold'), t('Schritte'), t('Zeit')], right: 1 },
  { q: t('Ich habe ein Bett, aber schlafe nie, einen Mund, aber esse nie. Was bin ich?'), a: [t('Ein Wyrm'), t('Ein Fluss'), t('Ein Brunnen')], right: 1 },
  { q: t('Ich habe Städte, aber keine Häuser, Wälder, aber keine Bäume, Wasser, aber keine Fische. Was bin ich?'), a: [t('Ein Traum'), t('Eine Landkarte'), t('Ein Spiegel')], right: 1 },
  { q: t('Was wird nasser, je mehr es trocknet?'), a: [t('Ein Handtuch'), t('Moos'), t('Ein Schwamm im Regen')], right: 0 },
  { q: t('Je mehr davon da ist, desto weniger siehst du. Was ist es?'), a: [t('Moos'), t('Gold'), t('Dunkelheit')], right: 2 },
  { q: t('Was gehört dir, wird aber von anderen viel öfter benutzt als von dir?'), a: [t('Dein Gold'), t('Dein Pferd'), t('Dein Name')], right: 2 },
  { q: t('Ich bin immer vor dir, aber du kannst mich nie sehen. Was bin ich?'), a: [t('Die Zukunft'), t('Dein Schatten'), t('Der Wald')], right: 0 },
  { q: t('Was hat einen Hals, aber keinen Kopf?'), a: [t('Ein Schwert'), t('Eine Flasche'), t('Ein Wurm')], right: 1 },
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
    return [{ t: t`Ein Eichhörnchen hat in einem hohlen Baum Gold versteckt. Es hätte besser aufpassen sollen. Du findest ${g} Gold.`, k: 'gold' }];
  } },
  // Wie der alte Mann mit dem Stock im Original: ein Schlag macht hübscher oder hässlicher.
  { id: 'kauz', weight: 6, run: (p) => {
    if (chance(0.5)) {
      p.charm += 1;
      return [{ t: t('Ein alter Kauz springt hinter einem Baum hervor und haut dir mit einem knorrigen Stock auf den Kopf. „Der Schönheitsstock!“, kichert er und verschwindet. Du fühlst dich tatsächlich etwas hübscher. (+1 Charme)'), k: 'good' }];
    }
    const lost = p.charm > 0;
    if (lost) p.charm -= 1;
    return [{ t: t`Ein alter Kauz springt hinter einem Baum hervor und haut dir mit einem krummen Stock auf den Kopf. „Der Hässlichkeitsstock!“, kichert er und verschwindet.${lost ? t(' Du fühlst dich weniger ansehnlich. (−1 Charme)') : t(' Viel kaputt machen konnte er nicht mehr.')}`, k: 'bad' }];
  } },
  { id: 'edelstein', weight: 5, run: (p) => {
    p.gems += 1;
    return [{ t: t('Zwischen den Wurzeln einer alten Buche glitzert etwas: ein Edelstein!'), k: 'gold' }];
  } },
  { id: 'moosquelle', weight: 8, run: (p) => {
    p.hp = maxHp(p);
    return [{ t: t('Du findest eine Moosquelle. Das Wasser schmeckt nach Regen und schließt deine Wunden.'), k: 'good' }];
  } },
  { id: 'dornen', weight: 8, run: (p) => {
    const d = hurt(p, 0.1);
    return [{ t: t`Du stolperst in einen Brombeerstrauch. Er ist nicht so freundlich, wie Brombeeren schmecken. ${d} Schaden.`, k: 'bad' }];
  } },
  { id: 'pilzring', weight: 7, run: (p) => {
    if (chance(0.5)) {
      p.forestFights += 1;
      return [{ t: t('Du trittst in einen Pilzring. Die Zeit fühlt sich plötzlich länger an. Du erhältst einen zusätzlichen Waldkampf.'), k: 'good' }];
    }
    p.forestFights = Math.max(0, p.forestFights - 1);
    return [{ t: t('Du trittst in einen Pilzring und tanzt eine Stunde lang, ohne es zu wollen. Du verlierst einen Waldkampf.'), k: 'warn' }];
  } },
  { id: 'koehler', weight: 7, run: (p) => {
    const e = expPerKill(p.level);
    p.exp += e;
    return [{ t: t`Ein alter Köhler erzählt dir von seinen Kämpfen. Die Hälfte davon ist gelogen, aber du lernst trotzdem etwas. ${e} Erfahrung.`, k: 'good' }];
  } },
  { id: 'loch', weight: 5, run: (p) => {
    const g = Math.floor(p.gold * 0.1);
    if (g < 1) return [{ t: t('Dein Geldbeutel hat ein Loch. Zum Glück war nichts drin.'), k: 'info' }];
    p.gold -= g;
    return [{ t: t`Dein Geldbeutel hat ein Loch. Irgendwo im Wald liegen jetzt ${g} Gold.`, k: 'bad' }];
  } },
  { id: 'gluehwuermchen', weight: 6, run: (p) => {
    if (p.specialUses >= specialUsesPerDay(p) + 2) {
      return [{ t: t('Glühwürmchen umschwirren dich. Du fühlst dich schon randvoll mit Kraft.'), k: 'info' }];
    }
    p.specialUses += 1;
    return [{ t: t('Glühwürmchen umschwirren dich und flüstern dir etwas zu. Du bekommst einen Fähigkeitspunkt dazu.'), k: 'good' }];
  } },
  { id: 'igel', weight: 7, run: () => [
    { t: t('Etwas raschelt im Unterholz. Es ist ein Igel. Er sieht dich vorwurfsvoll an, bis du weitergehst.'), k: 'info' },
  ] },
  { id: 'kraeuter', weight: 7, run: (p) => {
    const h = mend(p, 0.3);
    if (!h) return [{ t: t('Du findest Wundkraut. Du brauchst es gerade nicht, aber es riecht gut.'), k: 'info' }];
    return [{ t: t`Am Bachrand wächst Wundkraut. Du kaust ein paar Blätter. Bitter, aber es hilft: ${h} Lebenspunkte.`, k: 'good' }];
  } },
  { id: 'waldlaeufer', weight: 6, run: (p) => {
    const e = Math.round(expPerKill(p.level) * 0.6);
    p.exp += e;
    return [{ t: t`Eine Waldläuferin zeigt dir, wie man sich lautlos durchs Farnkraut bewegt. Du trittst trotzdem auf jeden Ast. ${e} Erfahrung.`, k: 'good' }];
  } },
  { id: 'raeuber', weight: 5, run: (p) => {
    if (p.level >= 8) {
      const g = roll(10, 20) * p.level;
      p.gold += g;
      return [{ t: t`Drei Wegelagerer springen aus dem Gebüsch, sehen dich an und überlegen es sich anders. Einer lässt vor Schreck ${g} Gold fallen.`, k: 'gold' }];
    }
    const g = Math.floor(p.gold * 0.2);
    if (g < 1) return [{ t: t('Wegelagerer durchsuchen dich, finden nichts und geben dir aus Mitleid einen Apfel.'), k: 'info' }];
    p.gold -= g;
    return [{ t: t`Wegelagerer! Sie sind schneller als du und nehmen ${g} Gold mit. Das Kontor wäre sicherer gewesen.`, k: 'bad' }];
  } },
  { id: 'spuren', weight: 4, minLevel: 10, run: (p) => {
    const e = expPerKill(p.level);
    p.exp += e;
    return [{ t: p.level >= MAX_LEVEL
      ? t('Riesige Krallenspuren führen nach Norden, zur Farnschlucht. Sie sind frisch. Der Wyrm ist wach.')
      : t`Du findest einen Abdruck im Lehm, so groß wie ein Wagenrad. Du lernst etwas über Demut. ${e} Erfahrung.`, k: 'warn' }];
  } },

  // ---------- Mit Entscheidung ----------
  { id: 'moosfee', weight: 5,
    prompt: () => [{ t: t('Eine winzige Moosfee landet auf deiner Schulter. „Hast du einen Edelstein für mich?“, fragt sie und klimpert mit den Wimpern.'), k: 'warn' }],
    choices: [
      { id: 'geben', label: t('Edelstein schenken'), key: 'e', hint: () => t('1 Edelstein'), available: (p) => p.gems > 0, run: (p) => {
        p.gems -= 1;
        if (chance(0.5)) {
          p.baseMaxHp += 1;
          p.hp += 1;
          return [{ t: t('Die Fee küsst dich auf die Stirn. Ein warmes Kribbeln. Deine Lebenskraft steigt dauerhaft um 1.'), k: 'gold' }];
        }
        p.forestFights += 2;
        p.hp = maxHp(p);
        return [{ t: t('Die Fee streut Glitzer über dich. Du fühlst dich ausgeruht wie nach einem Sonntag: volle Lebenspunkte und 2 zusätzliche Waldkämpfe.'), k: 'gold' }];
      } },
      { id: 'nein', label: t('Höflich ablehnen'), key: 'a', run: () => [
        { t: t('„Geizhals“, murmelt die Fee und fliegt beleidigt davon.'), k: 'info' },
      ] },
    ] },
  { id: 'truhe', weight: 6,
    prompt: () => [{ t: t('Halb im Moos versunken steht eine alte Truhe. Das Schloss ist verrostet, der Deckel klemmt ein wenig.'), k: 'warn' }],
    choices: [
      { id: 'auf', label: t('Truhe aufbrechen'), key: 'a', run: (p) => {
        const r = roll(1, 100);
        if (r <= 55) {
          const g = roll(20, 40) * p.level;
          p.gold += g;
          return [{ t: t`Der Deckel springt auf. Darin: ${g} Gold und eine sehr alte Socke. Du nimmst das Gold.`, k: 'gold' }];
        }
        if (r <= 75) {
          p.gems += 1;
          return [{ t: t('In der Truhe liegt, eingewickelt in Samt, ein Edelstein.'), k: 'gold' }];
        }
        const d = hurt(p, 0.2);
        return [{ t: t`Die Truhe beißt zu! Es ist ein Truhenschnapper, und er ist hungrig. ${d} Schaden, bevor er ins Unterholz hoppelt.`, k: 'bad' }];
      } },
      { id: 'weg', label: t('Lieber liegen lassen'), key: 'l', run: () => [
        { t: t('Du gehst weiter. Hinter dir klappert der Deckel. Vielleicht war das klug.'), k: 'info' },
      ] },
    ] },
  { id: 'brunnen', weight: 5,
    prompt: (p) => [{ t: t`Zwischen den Bäumen steht ein moosbewachsener Wunschbrunnen. Auf dem Rand ist eingeritzt: „${5 * p.level} Gold für einen Wunsch.“`, k: 'warn' }],
    choices: [
      { id: 'werfen', label: t('Gold hineinwerfen'), key: 'g', hint: (p) => t`${5 * p.level} Gold`, available: (p) => p.gold >= 5 * p.level, run: (p) => {
        p.gold -= 5 * p.level;
        const r = roll(1, 3);
        if (r === 1) {
          p.gems += 1;
          return [{ t: t('Aus der Tiefe plätschert es zurück. Am Eimer klebt ein Edelstein.'), k: 'gold' }];
        }
        if (r === 2) {
          p.buffs.push({ name: t('Brunnenglück'), atkMult: 1.2, rounds: 12 });
          return [{ t: t('Das Wasser leuchtet kurz auf. Du fühlst dich, als könnte heute nichts schiefgehen. (Brunnenglück: mehr Angriff für 12 Runden)'), k: 'good' }];
        }
        return [{ t: t('Plopp. Nichts passiert. Brunnen sind auch nur Löcher mit gutem Ruf.'), k: 'info' }];
      } },
      { id: 'weg', label: t('Weitergehen'), key: 'w', run: () => [{ t: t('Du behältst dein Gold. Der Brunnen gluckert enttäuscht.'), k: 'info' }] },
    ] },
  { id: 'pilz', weight: 5,
    prompt: () => [{ t: t('Auf einem Baumstumpf wächst ein Pilz, der leise leuchtet. Er riecht nach Honig und ein bisschen nach Abenteuer.'), k: 'warn' }],
    choices: [
      { id: 'essen', label: t('Pilz essen'), key: 'e', run: (p) => {
        if (chance(0.5)) {
          p.hp = maxHp(p);
          p.specialUses += 1;
          return [{ t: t('Köstlich! Deine Wunden schließen sich, und du fühlst dich hellwach. Volle Lebenspunkte und ein Fähigkeitspunkt dazu.'), k: 'good' }];
        }
        const d = hurt(p, 0.15);
        p.forestFights = Math.max(0, p.forestFights - 1);
        return [{ t: t`Die Bäume fangen an zu singen. Leider falsch. Du verbringst eine Stunde im Farn: ${d} Schaden und ein Waldkampf weniger.`, k: 'bad' }];
      } },
      { id: 'nein', label: t('Stehen lassen'), key: 's', run: () => [{ t: t('Mirla hat immer gesagt: Was leuchtet, isst man nicht. Du hältst dich daran.'), k: 'info' }] },
    ] },
  { id: 'schrein', weight: 5,
    prompt: () => [{ t: t('Unter einer uralten Eiche liegt ein kleiner Schrein aus Feldsteinen. Jemand hat Blumen hingelegt, andere eine Münze.'), k: 'warn' }],
    choices: [
      { id: 'beten', label: t('Kurz innehalten'), key: 'k', run: (p) => {
        const h = mend(p, 0.25);
        return [{ t: h ? t`Der Wind rauscht in der Eiche. Du fühlst dich ruhiger und heiler: ${h} Lebenspunkte.` : t('Der Wind rauscht in der Eiche. Du fühlst dich ruhiger.'), k: 'good' }];
      } },
      { id: 'opfern', label: t('Edelstein opfern'), key: 'e', hint: () => t('1 Edelstein'), available: (p) => p.gems > 0, run: (p) => {
        p.gems -= 1;
        p.hp = maxHp(p);
        p.buffs.push({ name: t('Segen der Eiche'), atkMult: 1.3, rounds: 20 });
        return [{ t: t('Der Edelstein versinkt im Moos. Grünes Licht fließt dir in die Arme. (Segen der Eiche: viel mehr Angriff für 20 Runden, volle Lebenspunkte)'), k: 'gold' }];
      } },
      { id: 'weg', label: t('Weitergehen'), key: 'w', run: () => [{ t: t('Du nickst dem Schrein zu und gehst weiter.'), k: 'info' }] },
    ] },
  { id: 'soeldner', weight: 5,
    prompt: () => [{ t: t('An einen Baum gelehnt schnarcht ein Söldner. Neben ihm liegt ein prall gefüllter Geldbeutel.'), k: 'warn' }],
    choices: [
      { id: 'wecken', label: t('Ihn wecken'), key: 'w', run: (p) => {
        const e = Math.round(expPerKill(p.level) * 0.8);
        p.exp += e;
        return [{ t: t`Der Söldner schreckt hoch, bedankt sich und zeigt dir zum Dank einen gemeinen Trick mit dem Ellbogen. ${e} Erfahrung.`, k: 'good' }];
      } },
      { id: 'klauen', label: t('Den Beutel nehmen'), key: 'b', run: (p) => {
        if (chance(0.6)) {
          const g = roll(15, 30) * p.level;
          p.gold += g;
          return [{ t: t`Er schläft weiter. Im Beutel sind ${g} Gold. Dein Gewissen zwickt ein wenig.`, k: 'gold' }];
        }
        const d = hurt(p, 0.25);
        return [{ t: t`Er schläft nicht. Eine Faust, groß wie ein Brotlaib, trifft dich: ${d} Schaden.`, k: 'bad' }];
      } },
      { id: 'weg', label: t('Leise weitergehen'), key: 'l', run: () => [{ t: t('Du schleichst vorbei. Er murmelt etwas von Wurstbroten.'), k: 'info' }] },
    ] },
  { id: 'wanderer', weight: 5,
    prompt: () => [{ t: t('Ein verletzter Wanderer sitzt am Wegrand und hält sich das Bein. „Ein Eulenbär“, stöhnt er. „Hast du etwas Verbandszeug?“'), k: 'warn' }],
    choices: [
      { id: 'helfen', label: t('Ihn verbinden'), key: 'v', run: (p) => {
        const d = hurt(p, 0.1);
        const e = Math.round(expPerKill(p.level) * 1.5);
        p.exp += e;
        return [{ t: t`Du reißt dein Hemd in Streifen (${d} Schaden durch die Kälte, sagen wir). Er erzählt dir dafür alles über Eulenbären. ${e} Erfahrung.`, k: 'good' }];
      } },
      { id: 'weg', label: t('Keine Zeit'), key: 'k', run: () => [{ t: t('Du gehst weiter. Er ruft dir etwas nach, das man in Moosgrund nicht laut sagt.'), k: 'info' }] },
    ] },
  // ---------- Nach dem Original (LoGD-Waldereignisse), in die Welt von Moosgrund übertragen ----------
  // Waldkämpfe zählen doppelt so viel wie im Original, weil unser Tag 20 statt 10 hat.

  // Glowing Stream: Trinken kann alles bedeuten, vom Tod bis zur vollen Heilung.
  { id: 'leuchtbach', weight: 5,
    prompt: () => [{ t: t('Du findest einen kleinen Bach, dessen Wasser schwach leuchtet. Es plätschert über runde, schneeweiße Steine. Du spürst eine seltsame Kraft darin. Ein Schluck könnte dir ungeahnte Stärke geben, oder dich zum Krüppel machen.'), k: 'warn' }],
    choices: [
      { id: 'trinken', label: t('Trinken'), key: 't', run: (p) => {
        const r = roll(1, 10);
        const head = { t: t('Du kniest dich ans Ufer und nimmst einen langen Schluck. Wärme breitet sich in deiner Brust aus …'), k: 'info' as const };
        if (r === 1) {
          p.alive = false;
          return [head, { t: t('… gefolgt von einer klammen, schrecklichen Kälte. Du sinkst ans Ufer und merkst erst jetzt, dass die weißen Steine gebleichte Schädel sind. Dir wird schwarz vor Augen.'), k: 'bad' },
            { t: t('Die Tiere des Waldes meiden diesen Ort, darum behältst du dein Gold. Und die Lehre wiegt die Erfahrung auf, die du sonst verloren hättest.'), k: 'info' }];
        }
        if (r === 2) {
          const lost = Math.min(2, p.forestFights);
          p.forestFights -= lost;
          p.hp = Math.max(1, Math.min(p.hp, Math.round(maxHp(p) * 0.1)));
          return [head, { t: t('… gefolgt von eisiger Kälte. Schon wird dir schwarz vor Augen, da hörst du ein Kichern: Eine winzige Fee streut dir Feenstaub ins Gesicht, und du kommst wieder auf die Beine.'), k: 'warn' },
            { t: t`Knapp überlebt. Du verlierst die meisten Lebenspunkte${lost ? t` und ${lost} Waldkämpfe` : ''}.`, k: 'bad' }];
        }
        if (r === 3) { p.hp = Math.max(p.hp, maxHp(p)); p.forestFights += 2; return [head, { t: t('Du fühlst dich BELEBT! Volle Lebenspunkte und Kraft für 2 weitere Waldkämpfe.'), k: 'good' }]; }
        if (r === 4) { p.gems += 1; return [head, { t: t('Du fühlst dich WACHSAM! Unter einem der Kiesel glitzert etwas: ein Edelstein!'), k: 'gold' }]; }
        if (r <= 7) { p.forestFights += 2; return [head, { t: t('Du fühlst dich VOLLER TATENDRANG! 2 zusätzliche Waldkämpfe.'), k: 'good' }]; }
        p.hp = Math.max(p.hp, maxHp(p));
        return [head, { t: t('Du fühlst dich GESUND! Deine Lebenspunkte sind wieder voll.'), k: 'good' }];
      } },
      { id: 'nicht', label: t('Nicht trinken'), key: 'n', run: () => [{ t: t('Die unheimliche Kraft im Wasser ist dir nicht geheuer. Du lässt den Bach leuchten und gehst weiter.'), k: 'info' }] },
    ] },

  // Gold Mine: Graben kostet Zeit, bringt Gold und Edelsteine, manchmal einen Einsturz.
  { id: 'stollen', weight: 5, minLevel: 2,
    prompt: () => [{ t: t('Tief im Wald stößt du auf einen alten, verlassenen Stollen. Davor liegt rostiges Werkzeug. Graben würde dich Zeit für 2 Waldkämpfe kosten, und an den Wänden siehst du Spuren alter Einstürze.'), k: 'warn' }],
    choices: [
      { id: 'graben', label: t('Nach Gold und Edelsteinen graben'), key: 'g', available: (p) => p.forestFights > 0, hint: () => t('2 Waldkämpfe'), run: (p, ctx) => {
        const r = roll(1, 20);
        const tired = () => { p.forestFights = Math.max(0, p.forestFights - 2); };
        if (r <= 5) { tired(); return [{ t: t('Nach Stunden harter Arbeit findest du nur wertlose Steine und einen Schädel.'), k: 'info' }]; }
        if (r <= 10) { const g = roll(p.level * 5, p.level * 20); p.gold += g; tired(); return [{ t: t`Nach Stunden harter Arbeit findest du ${g} Gold!`, k: 'gold' }]; }
        if (r <= 15) { const n = roll(1, Math.round(p.level / 7) + 1); p.gems += n; tired(); return [{ t: t`Nach Stunden harter Arbeit findest du ${n === 1 ? t('einen Edelstein') : t`${n} Edelsteine`}!`, k: 'gold' }]; }
        if (r <= 18) {
          const g = roll(p.level * 10, p.level * 40); const n = roll(1, Math.round(p.level / 3) + 1);
          p.gold += g; p.gems += n; tired();
          ctx.announce(news('mineRich', p.name));
          return [{ t: t`Du hast die Hauptader gefunden! ${n === 1 ? t('Ein Edelstein') : t`${n} Edelsteine`} und ${g} Gold!`, k: 'gold' }];
        }
        // Einsturz: Zwerge kennen sich unter Tage aus, ein Reittier kann dich herausziehen.
        const lines: LogLine[] = [{ t: t('Du glaubst, einen riesigen Edelstein und Gold zu sehen. Gierig holst du mit der Spitzhacke weit aus … und die Decke gibt nach!'), k: 'warn' }];
        const saved = (p.race === 'zwerg' && chance(0.5)) ? 'zwerg' : (p.mount && chance(0.3)) ? 'mount' : chance(0.2) ? 'luck' : '';
        if (saved) {
          p.forestFights = 0;
          lines.push({ t: saved === 'zwerg' ? t('Dein Zwergenblut warnt dich im letzten Moment. Du springst zur Seite, bevor die Felsen fallen.') : saved === 'mount' ? t('Dein Reittier zerrt dich im letzten Moment am Kragen heraus!') : t('Mit purem Glück entkommst du dem Einsturz.'), k: 'good' });
          lines.push({ t: t('Der Schreck sitzt so tief, dass du dich heute keinem Gegner mehr stellen kannst.'), k: 'warn' });
          return lines;
        }
        const exp = Math.round(p.exp * 0.1);
        const lostGold = Math.round(p.gold / 2);
        p.exp += exp; p.gold -= lostGold;
        p.alive = false;
        ctx.announce(news('mineBuried', p.name));
        lines.push({ t: t`Tonnen von Fels begraben dich. Immerhin hast du etwas übers Graben gelernt (${exp} Erfahrung). ${lostGold} Gold bleiben unter dem Geröll.`, k: 'bad' });
        return lines;
      } },
      { id: 'weg', label: t('Zurück in den Wald'), key: 'w', run: () => [{ t: t('Für so eine mühsame Art, reich zu werden, hast du keine Zeit. Du lässt den Stollen hinter dir.'), k: 'info' }] },
    ] },

  // Die verrückte Hulda (Original: Crazy Audrey): drei Körbe, drei Kätzchen. Gleiche Farben bringen Salbe (Waldkämpfe).
  { id: 'hulda', weight: 4,
    prompt: () => [
      { t: t('Auf einer stillen Lichtung stehen drei fest verschlossene Körbe. Aus einem hörst du ein leises Miauen. Kaum greifst du nach dem Deckel, springt die verrückte Hulda aus dem Gebüsch und reißt die Körbe an sich.'), k: 'warn' },
      { t: t('„Drei Körbe hab ich, das ist wahr, vier Kätzchen drin, ein buntes Paar. Kommen zwei gleiche Farben raus, geb ich dir Salbe für den Strauß. Sind alle drei verschieden bunt, gehst du heut früher in den Grund.“'), k: 'info' },
    ],
    choices: [
      { id: 'spielen', label: t('Huldas Spiel spielen'), key: 's', run: (p) => {
        const colors = [t('getigertes'), t('schwarzes'), t('rotes'), t('weißes')];
        let c = [roll(0, 3), roll(0, 3), roll(0, 3)];
        const hedgehogs = roll(1, 20) === 1;
        if (hedgehogs) c = [4, 4, 4];
        const name = (i: number) => (i === 4 ? t('ein Igel') : t`ein ${colors[i]} Kätzchen`);
        const lines: LogLine[] = [{ t: t`Hulda klopft auf den ersten Korb: ${name(c[0])} schaut heraus. Der zweite: ${name(c[1])}. Aus dem dritten hüpft ${name(c[2])} und klettert Hulda auf die Schulter.`, k: 'info' }];
        if (c[0] === c[1] && c[1] === c[2]) {
          if (hedgehogs) { p.forestFights += 10; lines.push({ t: t('„Igel? IGEL?? Hahaha, IGEL!“ Hulda schnappt sie sich und rennt jubelnd in den Wald. Sie hat einen ganzen Beutel Salbe fallen lassen! 10 zusätzliche Waldkämpfe.'), k: 'gold' }); }
          else { p.forestFights += 4; lines.push({ t: t('„Ihr seid ALLE ganz böse Kätzchen!“, schimpft Hulda. „Weil alle gleich waren, kriegst du ZWEI Salben.“ Du reibst sie dir zwischen die Zehen. 4 zusätzliche Waldkämpfe.'), k: 'good' }); }
        } else if (c[0] === c[1] || c[1] === c[2] || c[0] === c[2]) {
          p.forestFights += 2;
          lines.push({ t: t('„Ihr verrückten Kätzchen, was wisst ihr schon!“ Trotzdem gibt Hulda dir eine Salbe. 2 zusätzliche Waldkämpfe.'), k: 'good' });
        } else if (p.forestFights > 0) {
          p.forestFights = Math.max(0, p.forestFights - 2);
          lines.push({ t: t('„Gut gemacht, meine Schätzchen!“ Das Kätzchen auf ihrer Schulter springt dich an. Es abzuwehren kostet dich Kraft. 2 Waldkämpfe weniger.'), k: 'bad' });
        } else {
          if (p.charm > 0) p.charm -= 1;
          lines.push({ t: t('„Gut gemacht, meine Schätzchen!“ Das Kätzchen springt dich an und hinterlässt einen hässlichen Kratzer im Gesicht. (−1 Charme)'), k: 'bad' });
        }
        return lines;
      } },
      { id: 'weg', label: t('Vor Hulda davonlaufen'), key: 'w', run: () => [{ t: t('Du rennst, sehr schnell, weg von dieser verrückten Frau.'), k: 'info' }] },
    ] },

  // Foilwench: Für einen Edelstein wird man besser in seiner Fähigkeit.
  { id: 'lehrmeisterin', weight: 4,
    prompt: (p) => [{ t: t`In einer schiefen Hütte sitzt eine alte, narbige Kriegerin. „Ich bin Gerlinde, Meisterin aller Künste. Ich bringe dir mehr ${SPECIALTIES[p.specialty].name} bei. Unter zwei Bedingungen.“ „Zwei Bedingungen?“, fragst du. „Erstens: ein Edelstein. Zweitens: Hör auf, alles als Frage zu wiederholen!“`, k: 'warn' }],
    choices: [
      { id: 'geben', label: t('Ihr einen Edelstein geben'), key: 'e', hint: () => t('1 Edelstein'), available: (p) => p.gems > 0, run: (p) => {
        p.gems -= 1;
        p.skill += 1;
        const lines: LogLine[] = [{ t: t`Gerlinde gibt dir ein Stück Pergament mit Anweisungen. Du lernst es auswendig und isst es dann auf, damit es niemand findet. „Das hättest du nicht essen müssen …“ ${SPECIALTIES[p.specialty].name} steigt auf Stufe ${p.skill}.`, k: 'good' }];
        if (p.skill % 3 === 0) { p.specialUses += 1; lines.push({ t: t('Du bekommst einen Fähigkeitspunkt mehr pro Tag!'), k: 'gold' }); }
        return lines;
      } },
      { id: 'nein', label: t('Keinen Edelstein geben'), key: 'k', run: () => [{ t: t('„Wenn du reich werden willst, musst du das schon selbst schaffen“, sagst du und stapfst davon.'), k: 'info' }] },
    ] },

  // Dark Horse Tavern: ein verstecktes Wirtshaus im Nebel, ein alter Mann will würfeln.
  { id: 'dunklesross', weight: 3,
    prompt: (p) => [{ t: t`Eine Baumgruppe kommt dir bekannt vor. Nebel kriecht heran, dein Kopf summt${p.mount ? t(', aber dein Reittier scheint den Weg zu kennen') : ''}. Als er sich lichtet, steht vor dir eine Blockhütte mit rauchendem Schornstein. Über der Tür: „Zum Dunklen Ross“. Drinnen ist es still. In der Ecke spielt ein alter Mann mit Würfeln. „Ein Abenteurer hat mir fast mein ganzes Geld abgenommen“, seufzt er. „Gibst du mir eine Chance, etwas zurückzugewinnen?“`, k: 'warn' }],
    choices: [
      { id: 'wuerfeln', label: t('Mit dem Alten würfeln'), key: 'w', hint: (p) => t`${p.level * 10} Gold Einsatz`, available: (p) => p.gold >= p.level * 10, run: (p) => {
        const bet = p.level * 10;
        const me = roll(1, 6) + roll(1, 6);
        const him = roll(1, 6) + roll(1, 6);
        if (me > him) { p.gold += bet; return [{ t: t`Du würfelst ${me}, der Alte ${him}. Er schiebt dir brummend ${bet} Gold hin.`, k: 'gold' }]; }
        if (me < him) { p.gold -= bet; return [{ t: t`Du würfelst ${me}, der Alte ${him}. Er kichert und steckt deine ${bet} Gold ein. „Danke, Kindchen.“`, k: 'bad' }]; }
        return [{ t: t`Ihr würfelt beide ${me}. „Unentschieden“, murmelt der Alte. „Das zählt nicht.“`, k: 'info' }];
      } },
      { id: 'schnaps', label: t('Beim Wirt einen Kräuterschnaps trinken'), key: 's', hint: (p) => t`${p.level * 5} Gold`, available: (p) => p.gold >= p.level * 5, run: (p) => {
        p.gold -= p.level * 5;
        const h = mend(p, 0.5);
        return [{ t: t`Der Wirt, ein Hänfling von einem alten Mann, schenkt dir etwas Grünes ein. Es brennt bis in die Zehen. ${h ? t`+${h} Lebenspunkte.` : t('Gesund warst du schon vorher, aber gut war er trotzdem.')}`, k: 'good' }];
      } },
      { id: 'weg', label: t('Den Ort verlassen'), key: 'v', run: () => [{ t: t('Der Nebel kommt zurück. Als er sich lichtet, stehst du wieder dort, wo alles anfing. Wie du hingekommen bist, weißt du nicht mehr.'), k: 'info' }] },
    ] },

  // Stonehenge: Wer in den Steinkreis tritt, erlebt eine Überraschung.
  { id: 'steinkreis', weight: 4,
    prompt: () => [{ t: t('Mitten im Wald stehen bemooste Steine im Kreis, höher als drei Männer. In der Mitte summt die Luft. Die Alten sagen, wer hineintritt, kommt verändert wieder heraus.'), k: 'warn' }],
    choices: [
      { id: 'hinein', label: t('In den Kreis treten'), key: 'k', run: (p, ctx) => {
        const r = roll(1, 20);
        if (r === 1) {
          p.alive = false;
          ctx.announce(news('stoneCircle', p.name));
          return [{ t: t('Die Steine beginnen zu singen. Der Boden unter dir wird zu Nebel, und du fällst … direkt in Morwens Boot. „Na so was“, sagt sie.'), k: 'bad' }];
        }
        if (r <= 4) { p.charm += 1; return [{ t: t('Ein warmes Licht hüllt dich ein. Du fühlst dich schöner. (+1 Charme)'), k: 'good' }]; }
        if (r <= 6) { if (p.charm > 0) p.charm -= 1; return [{ t: t('Ein Windstoß zerzaust dich so gründlich, dass es wohl Tage dauert, bis du wieder ordentlich aussiehst. (−1 Charme)'), k: 'bad' }]; }
        if (r <= 10) { p.forestFights += 2; return [{ t: t('Die Steine summen, und eine seltsame Frische fährt dir in die Glieder. 2 zusätzliche Waldkämpfe.'), k: 'good' }]; }
        if (r <= 13) { const lost = Math.min(2, p.forestFights); p.forestFights -= lost; return [{ t: t`Du wanderst im Kreis, stundenlang, und kommst nicht mehr heraus. Als es endlich klappt, ist der halbe Tag vorbei.${lost ? t` (−${lost} Waldkämpfe)` : ''}`, k: 'bad' }]; }
        if (r <= 16) { p.hp = Math.max(p.hp, maxHp(p)); return [{ t: t('Das Moos unter deinen Füßen leuchtet. Deine Wunden schließen sich.'), k: 'good' }]; }
        if (r <= 19) { p.gems += 1; return [{ t: t('Am Fuß des größten Steins liegt ein Edelstein, als hätte jemand ihn für dich hingelegt.'), k: 'gold' }]; }
        p.baseMaxHp += 1;
        p.hp += 1;
        return [{ t: t('Ein Blitz aus heiterem Himmel fährt in den mittleren Stein und von dort in dich. Du überlebst. Mehr noch: Du fühlst dich dauerhaft zäher. (+1 maximale Lebenspunkte, für immer)'), k: 'gold' }];
      } },
      { id: 'weg', label: t('Lieber außen herum gehen'), key: 'w', run: () => [{ t: t('Du machst einen großen Bogen um die Steine. Man muss ja nicht alles ausprobieren.'), k: 'info' }] },
    ] },

  // Damsel in distress: Jemand ruft aus einem alten Turm um Hilfe.
  // Der Weg zur versunkenen Feste (wie das verlassene Schloss im Original): einmal gefunden, immer im Waldmenü.
  { id: 'feste', weight: 15, minLevel: 5, when: (p) => !p.festeFound,
    run: (p) => {
      p.festeFound = true;
      return [{ t: FESTE_TEXT.found, k: 'gold' }, { t: t('Ab jetzt findest du den Weg zur versunkenen Feste im Wald wieder.'), k: 'good' }];
    } },

  // Die Plumpsklos im Wald (Original: Outhouse). Danach: Hände waschen oder nicht?
  { id: 'klo', weight: 3,
    prompt: (p) => [{ t: t`Ein strenger Geruch kündigt sie an: Moosgrund hält seine Plumpsklos hier draußen im Wald, weil der Gestank die Monster fernhält. Es gibt ein feines Häuschen mit Herz in der Tür (${p.level * 5} Gold, ein Klogeist kassiert) und ein öffentliches Loch hinter einem Busch.`, k: 'warn' }],
    choices: [
      { id: 'fein', label: t('Das feine Häuschen'), key: 'f', hint: (p) => t`${p.level * 5} Gold`, available: (p) => p.gold >= p.level * 5, run: (p, ctx) => {
        p.gold -= p.level * 5;
        ctx.s.pendingEvent = { id: 'klo2', lines: [{ t: t('Du zahlst den Klogeist, und er dreht sich höflich um. Das sauberste Plumpsklo im ganzen Land! Es gibt sogar weiches Moos statt Blättern. Neben der Tür steht ein Waschtrog.'), k: 'info' }], data: 1 };
        return [];
      } },
      { id: 'loch', label: t('Das öffentliche Loch'), key: 'o', run: (_p, ctx) => {
        ctx.s.pendingEvent = { id: 'klo2', lines: [{ t: t('Der Gestank ist so stark, dass dir die Augen tränen und die Nasenhaare sich kräuseln. Du hockst dich über das Loch und rutschst beinahe hinein. So schnell wie möglich bist du fertig. Neben dem Busch steht ein Waschtrog.'), k: 'info' }], data: 0 };
        return [];
      } },
      { id: 'weiter', label: t('Einhalten und weitergehen'), key: 'w', run: () => [{ t: t('Du hältst die Luft an und gehst schnell weiter. Es geht auch so.'), k: 'info' }] },
    ] },
  { id: 'klo2', weight: 0, when: () => false,
    neutral: true,
    choices: [
      { id: 'waschen', label: t('Hände waschen'), key: 'h', run: (p, ctx) => {
        const lines: LogLine[] = [{ t: t('Hände waschen ist immer gut. Du richtest dich im Spiegelbild des Wassers her und gehst weiter.'), k: 'info' }];
        if (chance(0.6)) { const g = p.level * (ctx.data ? 4 : 2); p.gold += g; lines.push({ t: t`Die Waschtrog-Fee segnet dich! Für so viel Sauberkeit bekommst du ${g} Gold.`, k: 'gold' }); }
        if (chance(0.25)) { p.gems += 1; lines.push({ t: t('Und an der Türschwelle liegt ein Edelstein. Glückspilz!'), k: 'gold' }); }
        return lines;
      } },
      { id: 'nicht', label: t('Ach was, einfach weiter'), key: 'w', run: (p) => {
        if (chance(0.5) && p.gold > 0) {
          const g = Math.min(p.gold, p.level * 3);
          p.gold -= g;
          return [{ t: t`Deine Hände stinken fürchterlich. Hat dir deine Mutter nichts beigebracht? Der Klogeist wirft dich auf den schmierigen Boden und nimmt dir zur Strafe ${g} Gold ab. Wenigstens steht das nicht in den Neuigkeiten.`, k: 'bad' }];
        }
        return [{ t: t('Du wischst dir die Hände an der Hose ab und gehst weiter. Niemand hat es gesehen. Hoffentlich.'), k: 'info' }];
      } },
    ] },

  { id: 'turm', weight: 4,
    prompt: (p) => [{ t: t`Aus einem efeubewachsenen Turm ruft jemand um Hilfe. Am Fenster siehst du ${p.gender === 'f' ? t('einen jungen Mann') : t('eine junge Frau')} winken. Die Tür ist mit einem dicken Riegel verschlossen.`, k: 'warn' }],
    choices: [
      { id: 'retten', label: t('Den Riegel aufbrechen'), key: 'r', run: (p, ctx) => {
        const r = roll(1, 20);
        if (r <= 12) {
          const n = roll(1, 2);
          p.gems += n; p.charm += 1;
          ctx.announce(news('towerRescue', p.name));
          return [{ t: t`Mit einem Ruck gibt der Riegel nach. Dankbar fällt man dir um den Hals und drückt dir ${n === 1 ? t('einen Edelstein') : t`${n} Edelsteine`} in die Hand. (+1 Charme)`, k: 'gold' }];
        }
        if (r <= 17) {
          const d = hurt(p, 0.3);
          return [{ t: t`Kaum ist die Tür offen, steht da ein grinsender Waldtroll in einem Kleid. Eine Falle! Er haut dir eine runter und verschwindet lachend im Wald. ${d} Schaden.`, k: 'bad' }];
        }
        return [{ t: t('Die Tür springt auf. Der Turm ist leer, nur ein Spatz fliegt heraus. Hat er um Hilfe gerufen?'), k: 'info' }];
      } },
      { id: 'weg', label: t('Weitergehen'), key: 'w', run: () => [{ t: t('Du rufst, dass bestimmt gleich jemand anderes vorbeikommt, und gehst weiter.'), k: 'info' }] },
    ] },

  // Riddles: Ein alter Waldgeist stellt ein Rätsel.
  { id: 'raetsel', weight: 4,
    prompt: (_p, ctx) => {
      const i = roll(0, RIDDLES.length - 1);
      ctx.data = i;
      const q = RIDDLES[i];
      return [
        { t: t('Ein knorriger Baum öffnet die Augen. „Halt, Wanderer! Löse mein Rätsel, dann sollst du belohnt werden. Liegst du falsch, hältst du mich lange auf.“'), k: 'warn' },
        { t: t`„${q.q}“`, k: 'info' },
      ];
    },
    neutral: true,
    choices: (['A', 'B', 'C'] as const).map((letter, n) => ({
      id: letter.toLowerCase(), label: t`Antwort ${letter}`, labelFor: (d?: number) => `${letter} · ${RIDDLES[d ?? 0].a[n]}`, key: letter.toLowerCase(), run: (p: Player, ctx: EventCtx) => {
        const q = RIDDLES[ctx.data ?? 0];
        if (n === q.right) {
          if (chance(0.5)) { p.gems += 1; return [{ t: t(`„Richtig!“ Der Baum lässt einen Edelstein aus seinen Wurzeln kullern.`), k: 'gold' }]; }
          const e = Math.round(expPerKill(p.level) * 2);
          p.exp += e;
          return [{ t: t`„Richtig!“ Der Baum erzählt dir uralte Geschichten aus dem Wald. Du lernst ${e} Erfahrung.`, k: 'good' }];
        }
        const lost = Math.min(2, p.forestFights);
        p.forestFights -= lost;
        return [{ t: t`„Falsch! Die Antwort war: ${q.a[q.right]}.“ Der Baum erklärt dir sehr, sehr ausführlich, warum.${lost ? t` (−${lost} Waldkämpfe)` : ''}`, k: 'bad' }];
      },
    })),
  },

  // Waterfall: Hinter dem Wasserfall liegt manchmal ein Schatz.
  { id: 'wasserfall', weight: 4,
    prompt: () => [{ t: t('Du hörst einen Wasserfall rauschen. Hinter dem Wasservorhang meinst du eine Höhle zu erkennen. Die Felsen davor sind glitschig vom Moos.'), k: 'warn' }],
    choices: [
      { id: 'klettern', label: t('Hinter den Wasserfall klettern'), key: 'k', run: (p) => {
        const r = roll(1, 10);
        if (r <= 4) { const g = roll(p.level * 10, p.level * 30); p.gold += g; return [{ t: t`In der Höhle liegt der verrottete Rucksack eines Abenteurers. Darin: ${g} Gold.`, k: 'gold' }]; }
        if (r <= 6) { p.gems += 1; return [{ t: t('An der Höhlenwand glitzert ein Edelstein. Mit etwas Mühe brichst du ihn heraus.'), k: 'gold' }]; }
        const d = hurt(p, 0.2);
        return [{ t: t`Du rutschst auf dem Moos aus und landest im eiskalten Becken. Prustend kletterst du heraus. ${d} Schaden, und nass bist du auch.`, k: 'bad' }];
      } },
      { id: 'weg', label: t('Weitergehen'), key: 'w', run: () => [{ t: t('Nasse Füße hast du schon genug. Du gehst weiter.'), k: 'info' }] },
    ] },

  // Find potion: Eine reisende Kräuterhändlerin verkauft Heiltränke.
  { id: 'haendlerin', weight: 4,
    prompt: (p) => [{ t: t`Eine Kräuterhändlerin mit einem Karren voller Fläschchen kommt dir entgegen. „Heiltrank gefällig? Frisch gebraut, wirkt sofort. Nur ${p.level * 12} Gold.“`, k: 'warn' }],
    choices: [
      { id: 'kaufen', label: t('Einen Heiltrank kaufen'), key: 'k', hint: (p) => t`${p.level * 12} Gold`, available: (p) => p.gold >= p.level * 12, run: (p) => {
        p.gold -= p.level * 12;
        const h = mend(p, 1);
        return [{ t: h ? t`Der Trank schmeckt nach Waldmeister und Rost. Deine Wunden schließen sich. +${h} Lebenspunkte.` : t('Du trinkst ihn, obwohl du gar nicht verletzt bist. Er schmeckt trotzdem nach Waldmeister.'), k: 'good' }];
      } },
      { id: 'nein', label: t('Danke, nein'), key: 'n', run: () => [{ t: t('Die Händlerin zuckt mit den Schultern und zieht weiter.'), k: 'info' }] },
    ] },

  // Remains: Überreste eines unglücklichen Abenteurers.
  { id: 'gebeine', weight: 5, run: (p) => {
    const g = roll(p.level * 5, p.level * 25);
    p.gold += g;
    return [{ t: t`Unter einem Farn liegen die Gebeine eines Abenteurers, der weniger Glück hatte als du. In seinem Beutel stecken noch ${g} Gold. Er braucht sie nicht mehr.`, k: 'gold' }];
  } },

  // Quicksand: Sumpfloch kostet Zeit oder Gold.
  { id: 'sumpfloch', weight: 4, run: (p) => {
    if (chance(0.5) && p.gold > 0) {
      const g = Math.ceil(p.gold * 0.15);
      p.gold -= g;
      return [{ t: t`Du gerätst in ein Sumpfloch und sinkst bis zur Hüfte ein. Beim Herausstrampeln rutscht dir der Geldbeutel auf. ${g} Gold versinken im Schlamm.`, k: 'bad' }];
    }
    const lost = Math.min(2, p.forestFights);
    p.forestFights -= lost;
    return [{ t: t`Du gerätst in ein Sumpfloch. Es dauert ewig, bis du dich an einer Wurzel herausgezogen hast.${lost ? t` (−${lost} Waldkämpfe)` : ''}`, k: 'bad' }];
  } },
];

function eligible(p: Player): ForestEvent[] {
  return FOREST_EVENTS.filter((e) => (!e.minLevel || p.level >= e.minLevel) && (!e.when || e.when(p)));
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
