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
  // Die Elster: macht dich hübscher oder zerzaust dich.
  { id: 'kauz', weight: 6, run: (p) => {
    if (chance(0.5)) {
      p.charm += 1;
      return [{ t: t('Eine Elster landet auf deiner Schulter, zupft dir die Haare zurecht und poliert mit dem Schnabel deine Gürtelschnalle. Dann fliegt sie zufrieden davon. Du siehst tatsächlich besser aus. (+1 Charme)'), k: 'good' }];
    }
    const lost = p.charm > 0;
    if (lost) p.charm -= 1;
    return [{ t: t`Eine Elster stürzt sich auf dich und reißt dir ein Büschel Haare für ihr Nest aus.${lost ? t(' Du siehst jetzt aus, als hätte dich ein Sturm frisiert. (−1 Charme)') : t(' Viel schlimmer konnte es nicht mehr werden.')}`, k: 'bad' }];
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
      { id: 'weg', label: t('Leise weitergehen'), key: 'l', run: () => [{ t: t('Du schleichst vorbei. Er murmelt im Schlaf: „Noch fünf Minuten, Mama.“'), k: 'info' }] },
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
  // ---------- Größere Ereignisse mit Wahl ----------

  // Der Silberbach: Trinken kann alles bedeuten, vom Tod bis zur vollen Heilung.
  { id: 'leuchtbach', weight: 5,
    prompt: () => [{ t: t('Zwischen Farnwedeln rieselt ein Bach, dessen Wasser wie flüssiges Mondlicht schimmert. Die Rehe trinken nicht daraus, sie machen einen Bogen darum. Ein Schluck kann Wunder wirken. Oder das Gegenteil.'), k: 'warn' }],
    choices: [
      { id: 'trinken', label: t('Trinken'), key: 't', run: (p) => {
        const r = roll(1, 10);
        const head = { t: t('Du schöpfst mit beiden Händen und trinkst. Das Wasser schmeckt nach Eisen und Sternen …'), k: 'info' as const };
        if (r === 1) {
          p.alive = false;
          return [head, { t: t('… und dann wird es still in dir. Ganz still. Das Letzte, was du siehst, ist dein Spiegelbild, das dir traurig zuwinkt.'), k: 'bad' },
            { t: t('Weil die Tiere den Bach meiden, rührt niemand dein Gold an. Und was du hier gelernt hast, nimmt dir keiner: Du verlierst keine Erfahrung.'), k: 'info' }];
        }
        if (r === 2) {
          const lost = Math.min(2, p.forestFights);
          p.forestFights -= lost;
          p.hp = Math.max(1, Math.min(p.hp, Math.round(maxHp(p) * 0.1)));
          return [head, { t: t('… und dann wird dir eiskalt. Gerade als dir die Knie nachgeben, stupst dich ein Reh mit der Schnauze an, und irgendwie kommst du wieder hoch.'), k: 'warn' },
            { t: t`Mit knapper Not überlebt. Die meisten Lebenspunkte sind weg${lost ? t`, dazu ${lost} Waldkämpfe` : ''}.`, k: 'bad' }];
        }
        if (r === 3) { p.hp = Math.max(p.hp, maxHp(p)); p.forestFights += 2; return [head, { t: t('Ein warmes Prickeln läuft dir bis in die Fingerspitzen. Volle Lebenspunkte und Kraft für 2 weitere Waldkämpfe.'), k: 'good' }]; }
        if (r === 4) { p.gems += 1; return [head, { t: t('Deine Augen werden scharf wie die eines Falken. Im Bachbett entdeckst du einen Edelstein!'), k: 'gold' }]; }
        if (r <= 7) { p.forestFights += 2; return [head, { t: t('Dein Herz schlägt wie eine Kriegstrommel. Du könntest Bäume ausreißen: 2 zusätzliche Waldkämpfe.'), k: 'good' }]; }
        p.hp = Math.max(p.hp, maxHp(p));
        return [head, { t: t('Alle Schmerzen sind wie weggespült. Deine Lebenspunkte sind wieder voll.'), k: 'good' }];
      } },
      { id: 'nicht', label: t('Nicht trinken'), key: 'n', run: () => [{ t: t('Was die Rehe nicht trinken, trinkst du auch nicht. Du gehst weiter.'), k: 'info' }] },
    ] },

  // Der alte Stollen: Graben kostet Zeit, bringt Gold und Edelsteine, manchmal einen Einsturz.
  { id: 'stollen', weight: 5, minLevel: 2,
    prompt: () => [{ t: t('Ein Stollen führt schräg in den Hang. An den Balken hängen Spinnweben, am Eingang lehnt eine Spitzhacke, als hätte jemand gerade Pause gemacht. Eine Weile graben würde dich 2 Waldkämpfe kosten. Die Balken knarren bedenklich.'), k: 'warn' }],
    choices: [
      { id: 'graben', label: t('Mit der Spitzhacke graben'), key: 'g', available: (p) => p.forestFights > 0, hint: () => t('2 Waldkämpfe'), run: (p, ctx) => {
        const r = roll(1, 20);
        const tired = () => { p.forestFights = Math.max(0, p.forestFights - 2); };
        if (r <= 5) { tired(); return [{ t: t('Du hackst und schaufelst, bis dir der Rücken wehtut. Ausbeute: ein rostiger Löffel und sehr viel Staub.'), k: 'info' }]; }
        if (r <= 10) { const g = roll(p.level * 5, p.level * 20); p.gold += g; tired(); return [{ t: t`Plötzlich klingt die Spitzhacke anders. Zwischen dem Geröll blinken ${g} Gold!`, k: 'gold' }]; }
        if (r <= 15) { const n = roll(1, Math.round(p.level / 7) + 1); p.gems += n; tired(); return [{ t: t`Im Fels steckt etwas Funkelndes. Vorsichtig klopfst du ${n === 1 ? t('einen Edelstein') : t`${n} Edelsteine`} heraus!`, k: 'gold' }]; }
        if (r <= 18) {
          const g = roll(p.level * 10, p.level * 40); const n = roll(1, Math.round(p.level / 3) + 1);
          p.gold += g; p.gems += n; tired();
          ctx.announce(news('mineRich', p.name));
          return [{ t: t`Eine goldene Ader zieht sich quer durch die Wand! Du stopfst dir die Taschen voll: ${n === 1 ? t('Ein Edelstein') : t`${n} Edelsteine`} und ${g} Gold!`, k: 'gold' }];
        }
        // Einsturz: Zwerge kennen sich unter Tage aus, ein Reittier kann dich herausziehen.
        const lines: LogLine[] = [{ t: t('Hinter einem Felsbrocken glitzert es verheißungsvoll. Du holst mit der Spitzhacke weit aus … und über dir knackt ein Balken!'), k: 'warn' }];
        const saved = (p.race === 'zwerg' && chance(0.5)) ? 'zwerg' : (p.mount && chance(0.3)) ? 'mount' : chance(0.2) ? 'luck' : '';
        if (saved) {
          p.forestFights = 0;
          lines.push({ t: saved === 'zwerg' ? t('Zwerge hören, wenn ein Berg seufzt. Du bist draußen, bevor der erste Stein fällt.') : saved === 'mount' ? t('Dein Reittier wiehert, packt dich am Kragen und zerrt dich ins Freie!') : t('Ein Felsbrocken verfehlt dich um Haaresbreite, und du stolperst ins Tageslicht.'), k: 'good' });
          lines.push({ t: t('Deine Knie zittern noch Stunden später. Für heute kämpfst du gegen niemanden mehr.'), k: 'warn' });
          return lines;
        }
        const exp = Math.round(p.exp * 0.1);
        const lostGold = Math.round(p.gold / 2);
        p.exp += exp; p.gold -= lostGold;
        p.alive = false;
        ctx.announce(news('mineBuried', p.name));
        lines.push({ t: t`Der Stollen stürzt über dir ein. Dein letzter Gedanke: Holzbalken sollte man öfter prüfen. (${exp} Erfahrung für diese Lektion) ${lostGold} Gold bleiben im Geröll.`, k: 'bad' });
        return lines;
      } },
      { id: 'weg', label: t('Zurück in den Wald'), key: 'w', run: () => [{ t: t('Graben ist was für Maulwürfe. Du lässt den Stollen hinter dir.'), k: 'info' }] },
    ] },

  // Hulda und ihre Leuchtkäfer: drei Gläser, gleiche Farben bringen Salbe (Waldkämpfe), selten drei Mondfalter.
  { id: 'hulda', weight: 4,
    prompt: () => [
      { t: t('Auf einem Baumstumpf hockt die alte Hulda, eine Pfeife im Mundwinkel, vor drei zugebundenen Einmachgläsern. In jedem summt und leuchtet etwas. „Ein Spielchen, Wanderer?“'), k: 'warn' },
      { t: t('„Ich schüttle meine Gläser, und die Käfer leuchten auf. Haben zwei dieselbe Farbe, kriegst du von meiner Salbe. Sind alle drei verschieden, hab ich gewonnen, und meine Käfer dürfen dich ein bisschen ärgern.“'), k: 'info' },
    ],
    choices: [
      { id: 'spielen', label: t('Mit Hulda spielen'), key: 's', run: (p) => {
        const colors = [t('grün'), t('golden'), t('blau'), t('rot')];
        let c = [roll(0, 3), roll(0, 3), roll(0, 3)];
        const hedgehogs = roll(1, 20) === 1;
        if (hedgehogs) c = [4, 4, 4];
        const name = (i: number) => (i === 4 ? t('ein silberner Mondfalter') : t`ein Käfer, der ${colors[i]} leuchtet`);
        const lines: LogLine[] = [{ t: t`Hulda schüttelt das erste Glas: ${name(c[0])}. Im zweiten: ${name(c[1])}. Im dritten: ${name(c[2])}.`, k: 'info' }];
        if (c[0] === c[1] && c[1] === c[2]) {
          if (hedgehogs) { p.forestFights += 10; lines.push({ t: t('Drei Mondfalter! Hulda fällt vor Staunen die Pfeife aus dem Mund. Sie drückt dir einen ganzen Tiegel Salbe in die Hand und tanzt mit ihren Gläsern davon. 10 zusätzliche Waldkämpfe.'), k: 'gold' }); }
          else { p.forestFights += 4; lines.push({ t: t('„Alle drei gleich? Das hatte ich noch nie!“ Hulda gibt dir zwei Döschen Salbe. Du reibst dir die Waden ein und fühlst dich wie neu. 4 zusätzliche Waldkämpfe.'), k: 'good' }); }
        } else if (c[0] === c[1] || c[1] === c[2] || c[0] === c[2]) {
          p.forestFights += 2;
          lines.push({ t: t('„Na gut, gewonnen“, brummt Hulda und schiebt dir ein Döschen Salbe hin. 2 zusätzliche Waldkämpfe.'), k: 'good' });
        } else if (p.forestFights > 0) {
          p.forestFights = Math.max(0, p.forestFights - 2);
          lines.push({ t: t('„Meine Runde!“ Hulda lässt einen Käfer frei, und er summt dir so lange um den Kopf, bis du nicht mehr weißt, wo der Wald aufhört. 2 Waldkämpfe weniger.'), k: 'bad' });
        } else {
          if (p.charm > 0) p.charm -= 1;
          lines.push({ t: t('„Meine Runde!“ Ein Käfer verheddert sich in deinen Haaren, und als du ihn endlich draußen hast, siehst du aus wie ein Vogelnest. (−1 Charme)'), k: 'bad' });
        }
        return lines;
      } },
      { id: 'weg', label: t('Freundlich ablehnen'), key: 'w', run: () => [{ t: t('Du winkst ab und gehst weiter. Hinter dir kichert Hulda und klopft an ihre Gläser.'), k: 'info' }] },
    ] },

  // Gerlinde: Für einen Edelstein wird man besser in seiner Fähigkeit.
  { id: 'lehrmeisterin', weight: 4,
    prompt: (p) => [{ t: t`Vor einer Hütte aus Treibholz sitzt eine Frau mit Augenklappe und schärft drei Klingen gleichzeitig. „Gerlinde“, sagt sie, ohne aufzusehen. „Ich lehre ${SPECIALTIES[p.specialty].name}. Für einen Edelstein zeige ich dir etwas, das in keinem Buch steht.“`, k: 'warn' }],
    choices: [
      { id: 'geben', label: t('Ihr einen Edelstein geben'), key: 'e', hint: () => t('1 Edelstein'), available: (p) => p.gems > 0, run: (p) => {
        p.gems -= 1;
        p.skill += 1;
        const lines: LogLine[] = [{ t: t`Gerlinde zeigt dir einen Kniff, auf den du nie selbst gekommen wärst, und lässt ihn dich hundertmal wiederholen. Beim hundertsten Mal sitzt er. ${SPECIALTIES[p.specialty].name} steigt auf Stufe ${p.skill}.`, k: 'good' }];
        if (p.skill % 3 === 0) { p.specialUses += 1; lines.push({ t: t('Du bekommst einen Fähigkeitspunkt mehr pro Tag!'), k: 'gold' }); }
        return lines;
      } },
      { id: 'nein', label: t('Keinen Edelstein geben'), key: 'k', run: () => [{ t: t('„Billiger lernt man es nur durch Schmerzen“, ruft Gerlinde dir nach. Du gehst trotzdem.'), k: 'info' }] },
    ] },

  // Zur Nassen Socke: eine Schenke auf Stelzen im Moor, die nur im Nebel auftaucht. Ein Troll will würfeln.
  { id: 'dunklesross', weight: 3,
    prompt: (p) => [{ t: t`Nebel steigt auf, so dicht, dass du deine eigenen Stiefel nicht mehr siehst${p.mount ? t(', aber dein Reittier trottet unbeirrt weiter') : ''}. Als er aufreißt, stehst du vor einer windschiefen Schenke auf Stelzen, mitten im Moor. Über der Tür baumelt ein Schild: „Zur Nassen Socke“. Drinnen sitzt ein einzelner Troll vor einem Würfelbecher und grinst dich an. „Eine Runde? Wer mehr Augen hat, gewinnt.“`, k: 'warn' }],
    choices: [
      { id: 'wuerfeln', label: t('Mit dem Troll würfeln'), key: 'w', hint: (p) => t`${p.level * 10} Gold Einsatz`, available: (p) => p.gold >= p.level * 10, run: (p) => {
        const bet = p.level * 10;
        const me = roll(1, 6) + roll(1, 6);
        const him = roll(1, 6) + roll(1, 6);
        if (me > him) { p.gold += bet; return [{ t: t`Du würfelst ${me}, der Troll ${him}. Er grunzt beleidigt und schiebt dir ${bet} Gold hin.`, k: 'gold' }]; }
        if (me < him) { p.gold -= bet; return [{ t: t`Du würfelst ${me}, der Troll ${him}. Er lacht, dass die Stelzen wackeln, und steckt deine ${bet} Gold ein.`, k: 'bad' }]; }
        return [{ t: t`Ihr würfelt beide ${me}. Der Troll kratzt sich am Kopf. „Gleich? Das ist zu viel Rechnen für heute.“`, k: 'info' }];
      } },
      { id: 'schnaps', label: t('Bei der Moorwirtin einen Kräutersud trinken'), key: 's', hint: (p) => t`${p.level * 5} Gold`, available: (p) => p.gold >= p.level * 5, run: (p) => {
        p.gold -= p.level * 5;
        const h = mend(p, 0.5);
        return [{ t: t`Die Moorwirtin stellt dir einen dampfenden Becher hin. Es riecht nach Sumpf und schmeckt nach Minze. ${h ? t`+${h} Lebenspunkte.` : t('Gesund warst du schon vorher, aber jetzt ist dir auch noch warm.')}`, k: 'good' }];
      } },
      { id: 'weg', label: t('Den Ort verlassen'), key: 'v', run: () => [{ t: t('Du trittst vor die Tür, der Nebel verschluckt dich, und als er sich lichtet, ist von der Schenke keine Spur mehr. Nur deine Stiefel sind nass.'), k: 'info' }] },
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

  // Die Badestube des Köhlers: heißes Bad gegen Gold oder kalter Teich umsonst.
  { id: 'badestube', weight: 3,
    prompt: (p) => [{ t: t`Zwischen den Bäumen steigt Dampf auf. Der alte Köhler hat neben seinem Meiler eine Badestube gezimmert. Ein heißes Bad kostet ${p.level * 5} Gold. Gleich daneben liegt ein Teich, kalt, grün und umsonst.`, k: 'warn' }],
    choices: [
      { id: 'bad', label: t('Ein heißes Bad nehmen'), key: 'b', hint: (p) => t`${p.level * 5} Gold`, available: (p) => p.gold >= p.level * 5, run: (p) => {
        p.gold -= p.level * 5;
        p.hp = Math.max(p.hp, maxHp(p));
        const lines: LogLine[] = [{ t: t('Du lässt dich ins dampfende Wasser sinken, bis nur noch die Nase herausschaut. Der Köhler reicht dir einen Becher Tee. Alle Wunden sind vergessen.'), k: 'good' }];
        if (chance(0.4)) { p.charm += 1; lines.push({ t: t('Frisch geschrubbt und duftend wie eine Wiese gehst du weiter. (+1 Charme)'), k: 'good' }); }
        return lines;
      } },
      { id: 'teich', label: t('In den Teich springen'), key: 't', run: (p) => {
        const r = roll(1, 10);
        if (r <= 5) { p.charm += 1; return [{ t: t('Das Wasser ist so kalt, dass du laut quiekst. Aber danach glühst du rosig und wach. (+1 Charme)'), k: 'good' }]; }
        if (r <= 8) return [{ t: t('Du planschst eine Weile herum. Ein Frosch sieht dir dabei sehr kritisch zu.'), k: 'info' }];
        const d = hurt(p, 0.1);
        return [{ t: t`Als du herauskletterst, hängen drei Blutegel an deinen Waden. Bis du sie los bist, hast du ${d} Lebenspunkte weniger.`, k: 'bad' }];
      } },
      { id: 'weiter', label: t('Weitergehen'), key: 'w', run: () => [{ t: t('Baden kannst du auch nach dem Drachen noch. Du gehst weiter.'), k: 'info' }] },
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

  // ---------- Neu in 0.58: kleine Begegnungen ----------
  { id: 'pilzsammlerin', weight: 5, run: (p) => {
    const g = roll(3, 8) * p.level;
    p.gold += g;
    return [{ t: t`Eine kurzsichtige Pilzsammlerin hält dich für einen besonders großen Steinpilz und will dich in ihren Korb packen. Als sie ihren Irrtum bemerkt, ist ihr das so peinlich, dass sie dir ${g} Gold in die Hand drückt.`, k: 'gold' }];
  } },
  { id: 'wildschweine', weight: 5, run: (p) => {
    if (p.mount) return [{ t: t('Eine Rotte Wildschweine stürmt durchs Unterholz. Dein Reittier macht einen Satz zur Seite, und die Schweine donnern an euch vorbei.'), k: 'info' }];
    const d = hurt(p, 0.12);
    return [{ t: t`Eine Rotte Wildschweine stürmt durchs Unterholz, und du stehst genau im Weg. Danach weißt du, wie sich ein Acker fühlt. ${d} Schaden.`, k: 'bad' }];
  } },
  { id: 'eule', weight: 5, run: (p) => {
    const e = Math.round(expPerKill(p.level) * 0.5);
    p.exp += e;
    return [{ t: t`Eine alte Uhu-Dame sitzt auf einem Ast und ruft „Schuhu“. Du verstehst kein Wort, aber du hörst trotzdem höflich zu. Irgendwie fühlst du dich danach klüger. ${e} Erfahrung.`, k: 'good' }];
  } },
  { id: 'fallgrube', weight: 4, run: (p) => {
    if (p.specialty === 'dieb') {
      const g = roll(5, 12) * p.level;
      p.gold += g;
      return [{ t: t`Das Laub vor dir liegt zu ordentlich. Eine Fallgrube! Du machst einen Bogen darum und findest dafür das Versteck des Fallenstellers: ${g} Gold.`, k: 'gold' }];
    }
    const lost = Math.min(1, p.forestFights);
    p.forestFights -= lost;
    return [{ t: t`Der Boden gibt nach, und du landest in einer Fallgrube. Unten liegt schon ein Dachs, der dich genauso vorwurfsvoll ansieht wie du ihn.${lost ? t(' Bis du draußen bist, ist eine Stunde vergangen. (−1 Waldkampf)') : ''}`, k: 'bad' }];
  } },
  { id: 'stiefel', weight: 4, run: (p) => {
    const d = hurt(p, 0.05);
    return [{ t: t`Während du kurz rastest, bindet dir ein Wurzelgnom die Schnürsenkel zusammen. Beim ersten Schritt küsst du den Waldboden. ${d} Schaden und ein Gelächter aus dem Farn.`, k: 'bad' }];
  } },
  { id: 'honig', weight: 5, run: (p) => {
    const h = mend(p, 0.25);
    const d = Math.max(1, Math.round(maxHp(p) * 0.04));
    p.hp = Math.max(1, p.hp - d);
    return [{ t: t`In einer hohlen Eiche summt ein wilder Bienenstock. Du holst dir eine Wabe Honig. Die Bienen finden das nicht gut. Unterm Strich: ${h} Lebenspunkte vom Honig, ${d} Schaden von den Stichen.`, k: h > d ? 'good' : 'info' }];
  } },
  { id: 'wegweiser', weight: 4, run: (p) => {
    if (p.race === 'elf') return [{ t: t('Jemand hat den Wegweiser verdreht. Elfen lassen sich davon nicht täuschen: Du liest den Weg am Moos der Bäume ab und gehst weiter.'), k: 'info' }];
    const lost = Math.min(1, p.forestFights);
    p.forestFights -= lost;
    return [{ t: t`Jemand hat den Wegweiser verdreht, vermutlich die Wurzelgnome. Du läufst eine Stunde im Kreis, bis du wieder an derselben Stelle stehst.${lost ? t(' (−1 Waldkampf)') : ''}`, k: 'bad' }];
  } },
  { id: 'raben', weight: 4, run: (p) => {
    if (chance(0.35)) {
      p.gems += 1;
      return [{ t: t('Ein Rabe von der Rabenklippe kreist über dir und lässt etwas fallen. Es klickt auf deinem Helm: ein Edelstein! Den hat er wohl irgendwo geklaut.'), k: 'gold' }];
    }
    const g = Math.floor(p.gold * 0.05);
    if (g < 1) return [{ t: t('Ein Rabe landet neben dir und durchsucht deine Taschen. Er findet nichts Glänzendes und krächzt beleidigt.'), k: 'info' }];
    p.gold -= g;
    return [{ t: t`Ein Rabe stößt herab, schnappt sich ein paar glänzende Münzen aus deinem Beutel und fliegt zur Rabenklippe. ${g} Gold sind weg.`, k: 'bad' }];
  } },
  { id: 'spielmann', weight: 4, run: (p) => {
    p.buffs.push({ id: 'spielmann', name: t('Florians Lied'), atkMult: 1.1, rounds: 15 });
    const lines: LogLine[] = [{ t: t('Auf einer Lichtung übt Florian, der Barde, ein neues Heldenlied. Er singt es dir zur Probe vor. Es handelt nicht von dir, aber es klingt so. (Florians Lied: etwas mehr Angriff für 15 Runden)'), k: 'good' }];
    if (p.marriedTo === 'florian') { p.charm += 1; lines.push({ t: t('Zum Schluss gibt er dir einen Kuss und steckt dir eine Waldblume ins Haar. (+1 Charme)'), k: 'good' }); }
    return lines;
  } },
  { id: 'schuppe', weight: 3, minLevel: 12, run: (p) => {
    const g = roll(20, 40) * p.level;
    p.gold += g;
    return [{ t: t`Im Farn liegt eine Schuppe, so groß wie ein Schild, schwarzgrün und noch warm. Der Wyrm häutet sich. Ein Händler in Moosgrund wird dir dafür ${g} Gold zahlen, so viel ist sicher. Du hast es schon mal eingesteckt.`, k: 'gold' }];
  } },
  { id: 'mohn', weight: 4, run: (p) => {
    const lost = Math.min(1, p.forestFights);
    p.forestFights -= lost;
    p.hp = Math.max(p.hp, maxHp(p));
    return [{ t: t`Du kommst an einer Wiese voller Mohn vorbei und legst dich nur ganz kurz hin. Als du aufwachst, steht die Sonne woanders. Dafür bist du ausgeruht: volle Lebenspunkte.${lost ? t(' (−1 Waldkampf)') : ''}`, k: 'info' }];
  } },
  { id: 'hirsch', weight: 4, run: () => [
    { t: t('Ein riesiger Hirsch tritt aus dem Nebel, sieht dich lange an und verschwindet wieder. Du weißt nicht, was das bedeuten soll. Der Hirsch wahrscheinlich auch nicht.'), k: 'info' },
  ] },
  { id: 'nebelstimmen', weight: 3, run: (p) => [
    { t: p.level >= 10
      ? t('Aus dem Nebel flüstern Stimmen deinen Namen. Früher hätte dir das Angst gemacht. Heute rufst du zurück: „Später!“ Die Stimmen sind beleidigt.')
      : t('Aus dem Nebel flüstern Stimmen deinen Namen. Du gehst schneller. Viel schneller.'), k: 'info' },
  ] },
  { id: 'goldkaefer', weight: 4, run: (p) => {
    const g = roll(4, 10) * p.level;
    p.gold += g;
    return [{ t: t`Ein Käfer mit goldenem Panzer krabbelt vor dir her. Du folgst ihm aus Neugier bis zu einem umgestürzten Karren. Zwischen den Brettern liegen noch ${g} Gold.`, k: 'gold' }];
  } },

  // ---------- Neu in 0.58: mit Entscheidung ----------
  { id: 'zwergenhaendler', weight: 4,
    prompt: (p) => [{ t: t`Ein Zwerg mit einer Lupe im Auge sitzt auf einem Baumstumpf. „Edelsteine? Ich kaufe Edelsteine. ${gemPrice(p)} Gold für einen guten Stein, und ich sehe, du hast welche.“ Er sieht es tatsächlich, obwohl sie in deiner Tasche stecken.`, k: 'warn' }],
    choices: [
      { id: 'verkaufen', label: t('Einen Edelstein verkaufen'), key: 'v', hint: (p) => t`${gemPrice(p)} Gold`, available: (p) => p.gems > 0, run: (p) => {
        const g = gemPrice(p);
        p.gems -= 1;
        p.gold += g;
        return [{ t: p.race === 'zwerg'
          ? t`„Ach, ein Landsmann!“ Unter Zwergen zahlt man anständig: ${g} Gold für deinen Stein.`
          : t`Der Zwerg beißt auf den Stein, nickt und zählt dir ${g} Gold ab. Zweimal, weil er sich beim ersten Mal „verzählt“ hat.`, k: 'gold' }];
      } },
      { id: 'nein', label: t('Behalten'), key: 'b', run: () => [{ t: t('„Wie du meinst“, brummt der Zwerg. „Steine werden auch nicht billiger.“'), k: 'info' }] },
    ] },
  { id: 'brueckentroll', weight: 4,
    prompt: (p) => [{ t: t`Über einen reißenden Bach führt eine Holzbrücke. Darunter wohnt ein Troll, der sie für seine hält. „${p.level * 8} Gold Brückenzoll“, grollt er.`, k: 'warn' }],
    choices: [
      { id: 'zahlen', label: t('Brückenzoll zahlen'), key: 'z', hint: (p) => t`${p.level * 8} Gold`, available: (p) => p.gold >= p.level * 8, run: (p) => {
        p.gold -= p.level * 8;
        return [{ t: t('Der Troll beißt in jede Münze und lässt dich durch. Er winkt dir sogar nach. Geschäft ist Geschäft.'), k: 'info' }];
      } },
      { id: 'drohen', label: t('Ihm drohen'), key: 'd', run: (p) => {
        if (chance(p.race === 'troll' ? 0.8 : 0.5)) {
          const g = roll(5, 10) * p.level;
          p.gold += g;
          return [{ t: p.race === 'troll'
            ? t`Du grollst lauter als er. Unter Trollen ist das ein Argument. Er rückt seine Zolleinnahmen heraus: ${g} Gold.`
            : t`Du ziehst die Waffe und machst ein grimmiges Gesicht. Der Troll erschrickt so sehr, dass er dir seine Zolleinnahmen gibt: ${g} Gold.`, k: 'gold' }];
        }
        const d = hurt(p, 0.25);
        return [{ t: t`Der Troll lacht, packt dich am Gürtel und wirft dich in den Bach. ${d} Schaden und eine sehr nasse Hose.`, k: 'bad' }];
      } },
      { id: 'waten', label: t('Durch den Bach waten'), key: 'w', run: (p) => {
        const lost = Math.min(1, p.forestFights);
        p.forestFights -= lost;
        return [{ t: t`Du suchst dir eine flache Stelle, ziemlich weit flussaufwärts. Der Troll ruft dir Beleidigungen hinterher.${lost ? t(' (−1 Waldkampf)') : ''}`, k: 'info' }];
      } },
    ] },
  { id: 'verirrtes_kind', weight: 3,
    prompt: () => [{ t: t('Unter einem Farn sitzt ein kleines Mädchen aus Moosgrund und weint. Es wollte nur ganz kurz Beeren pflücken, und jetzt sehen alle Bäume gleich aus.'), k: 'warn' }],
    choices: [
      { id: 'heim', label: t('Es heim ins Dorf bringen'), key: 'h', hint: () => t('2 Waldkämpfe'), run: (p, ctx) => {
        const lost = Math.min(2, p.forestFights);
        p.forestFights -= lost;
        const g = roll(8, 15) * p.level;
        p.gold += g;
        p.charm += 1;
        ctx.announce(news('lostChild', p.name));
        return [{ t: t`Du trägst die Kleine auf den Schultern bis nach Moosgrund. Die Mutter weint vor Glück, der Vater drückt dir ${g} Gold in die Hand, und am Brunnen erzählt man sich von dir. (+1 Charme)`, k: 'gold' }];
      } },
      { id: 'weg', label: t('Ihr den Weg zeigen'), key: 'w', run: () => [{ t: t('Du zeigst ihr, wo die Sonne steht und dass das Dorf hinter dem großen Felsen liegt. Sie nickt tapfer und rennt los. Hoffentlich.'), k: 'info' }] },
    ] },
  { id: 'fuchsfalle', weight: 4,
    prompt: () => [{ t: t('Ein junger Fuchs hängt mit der Pfote in einer rostigen Falle. Er fiept, sieht dich an und fletscht dann sicherheitshalber doch die Zähne.'), k: 'warn' }],
    choices: [
      { id: 'befreien', label: t('Den Fuchs befreien'), key: 'b', run: (p) => {
        const d = hurt(p, 0.05);
        if (chance(0.35)) {
          p.gems += 1;
          return [{ t: t`Er beißt dich zum Dank in die Hand (${d} Schaden) und verschwindet. Kurz darauf ist er wieder da und legt dir etwas vor die Füße: einen Edelstein. Wo er den wohl herhat?`, k: 'gold' }];
        }
        const e = Math.round(expPerKill(p.level) * 0.7);
        p.exp += e;
        return [{ t: t`Er beißt dich zum Dank in die Hand (${d} Schaden) und humpelt davon. Du lernst etwas über Dankbarkeit und Fallen. ${e} Erfahrung.`, k: 'good' }];
      } },
      { id: 'weg', label: t('Weitergehen'), key: 'w', run: () => [{ t: t('Du gehst weiter. Das Fiepen hörst du noch eine ganze Weile.'), k: 'info' }] },
    ] },
  { id: 'ruestung', weight: 4,
    prompt: () => [{ t: t('An einem Baum lehnt das Gerippe eines Ritters, noch in voller Rüstung. Die Rüstung sieht besser aus als der Ritter. Sie hätte deine Größe.'), k: 'warn' }],
    choices: [
      { id: 'anziehen', label: t('Die Rüstung anlegen'), key: 'a', run: (p) => {
        if (chance(0.6)) {
          p.buffs.push({ id: 'ritterruestung', name: t('Rittersrüstung'), atkMult: 1, defMult: 1.25, rounds: 25 });
          return [{ t: t('Sie passt wie angegossen und klappert nur ein bisschen. (Rittersrüstung: viel mehr Verteidigung für 25 Runden, dann rostet sie dir vom Leib)'), k: 'good' }];
        }
        const d = hurt(p, 0.12);
        return [{ t: t`Kaum steckst du drin, merkst du, dass ein Ameisenvolk darin wohnt. Du tanzt dich wieder heraus. ${d} Schaden und eine Menge Würde.`, k: 'bad' }];
      } },
      { id: 'begraben', label: t('Den Ritter begraben'), key: 'g', run: (p) => {
        p.favor += 5;
        return [{ t: t('Du schaufelst ein Grab unter dem Baum und legst den Ritter samt Rüstung hinein. Irgendwo im Schattenreich nickt Morwen anerkennend. (+5 Gunst bei Morwen)'), k: 'good' }];
      } },
      { id: 'weg', label: t('In Ruhe lassen'), key: 'r', run: () => [{ t: t('Du lässt den Ritter in seiner Rüstung. Er sieht aus, als hätte er sich das so ausgesucht.'), k: 'info' }] },
    ] },
  { id: 'nussschalen', weight: 4, neutral: true,
    prompt: (p) => [{ t: t`An einer Wegkreuzung hat ein Gaukler mit spitzem Hut drei Nussschalen auf einem Fass. Unter einer liegt eine Erbse. Er schiebt die Schalen flink hin und her. „${p.level * 10} Gold Einsatz. Findest du die Erbse, kriegst du dreimal so viel zurück.“`, k: 'warn' }],
    // „Nicht spielen“ zuerst: am Handy steht es dann breit unten, die drei Schalen nebeneinander darüber.
    choices: [
      { id: 'nein', label: t('Nicht spielen'), key: 'n', run: () => [{ t: t('„Kluges Kind“, sagt der Gaukler und sucht sich den Nächsten.'), k: 'info' }] },
      ...(['links', 'mitte', 'rechts'] as const).map((where, n): EventChoice => ({
        id: where,
        label: [t('Linke Schale'), t('Mittlere Schale'), t('Rechte Schale')][n],
        key: ['1', '2', '3'][n],
        hint: (p) => t`${p.level * 10} Gold`,
        available: (p) => p.gold >= p.level * 10,
        run: (p) => {
          const bet = p.level * 10;
          const sharp = p.specialty === 'dieb' && chance(0.5);
          if (sharp || roll(1, 3) === 1) {
            p.gold += bet * 2;
            return [{ t: sharp
              ? t`Du kennst den Trick, du hast ihn selbst schon gemacht. Du tippst auf die Schale, unter die er die Erbse gerade geschoben hat. Er zahlt mit saurem Gesicht: ${bet * 2} Gold Gewinn.`
              : t`Die Erbse liegt genau da! Der Gaukler zahlt dir murrend ${bet * 2} Gold Gewinn.`, k: 'gold' }];
          }
          p.gold -= bet;
          return [{ t: t`Leer. Der Gaukler hebt die anderen Schalen an. Auch leer. Wo ist die Erbse? Sicher nicht mehr auf dem Fass, und deine ${bet} Gold auch nicht.`, k: 'bad' }];
        },
      })),
    ] },
  { id: 'irrlicht', weight: 4,
    prompt: () => [{ t: t('Zwischen den Bäumen tanzt ein bläuliches Licht. Es bleibt stehen, als würde es auf dich warten, und hüpft dann ein Stück weiter. „Komm“, scheint es zu sagen.'), k: 'warn' }],
    choices: [
      { id: 'folgen', label: t('Dem Licht folgen'), key: 'f', run: (p) => {
        const r = roll(1, 10);
        if (r <= 4) { p.gems += 1; return [{ t: t('Das Licht führt dich zu einem Grabhügel und erlischt über einem Stein. Darunter liegt ein Edelstein. Danke, kleines Licht.'), k: 'gold' }]; }
        if (r <= 8) {
          const lost = Math.min(2, p.forestFights);
          p.forestFights -= lost;
          return [{ t: t`Das Licht führt dich mitten ins Moor und geht aus. Bis du wieder festen Boden unter den Füßen hast, ist es Nachmittag.${lost ? t` (−${lost} Waldkämpfe)` : ''}`, k: 'bad' }];
        }
        return [{ t: t('Das Licht führt dich bis an die Kante der Rabenklippe und kichert. Du drehst ganz langsam wieder um.'), k: 'warn' }];
      } },
      { id: 'weg', label: t('Nicht folgen'), key: 'n', run: () => [{ t: t('Lichter, die im Wald herumhüpfen, haben nie etwas Gutes vor. Das weiß in Moosgrund jedes Kind.'), k: 'info' }] },
    ] },
  { id: 'einsiedler', weight: 4,
    prompt: () => [{ t: t('In einer Felsnische wohnt ein Einsiedler mit einem Bart bis zu den Knien. „Ich war einmal ein großer Kämpfer“, sagt er. „Hilf mir Holz hacken, und ich zeige dir, wie man richtig steht.“ Das würde dich 2 Waldkämpfe kosten.'), k: 'warn' }],
    choices: [
      { id: 'lernen', label: t('Holz hacken und lernen'), key: 'h', hint: () => t('2 Waldkämpfe'), available: (p) => p.forestFights >= 2, run: (p) => {
        p.forestFights -= 2;
        const e = Math.round(expPerKill(p.level) * 2.5);
        p.exp += e;
        return [{ t: t`Ihr hackt Holz bis zum Mittag. Zwischen zwei Scheiten schiebt er dir mit dem Stiefel den Fuß zurecht. Plötzlich stehst du wie ein Baum. ${e} Erfahrung.`, k: 'good' }];
      } },
      { id: 'nein', label: t('Lieber nicht'), key: 'n', run: () => [{ t: t('„Die Jugend“, seufzt der Einsiedler und hackt allein weiter.'), k: 'info' }] },
    ] },
  { id: 'duell', weight: 4,
    prompt: (p) => [{ t: t`Ein fahrender Ritter in einer Rüstung voller Dellen versperrt dir den Weg. „Ein Duell! Nur zur Übung, bis einer ins Moos fällt!“ ${p.level >= 12 ? t('Er sieht ziemlich müde aus.') : t('Er sieht ziemlich entschlossen aus.')}`, k: 'warn' }],
    choices: [
      { id: 'annehmen', label: t('Das Duell annehmen'), key: 'a', run: (p) => {
        if (chance(0.55)) {
          const e = Math.round(expPerKill(p.level) * 1.5);
          p.exp += e;
          p.charm += 1;
          return [{ t: t`Nach drei Hieben liegt der Ritter im Moos und lacht. Er schenkt dir eine Ehrenschleife für den Gürtel. ${e} Erfahrung. (+1 Charme)`, k: 'good' }];
        }
        const d = hurt(p, 0.3);
        return [{ t: t`Der Ritter ist besser, als seine Rüstung aussieht. Du landest im Moos, er hilft dir höflich auf. ${d} Schaden.`, k: 'bad' }];
      } },
      { id: 'nein', label: t('Ablehnen'), key: 'l', run: () => [{ t: t('„Schade!“, ruft der Ritter und reitet weiter, um jemand anderen zu fragen.'), k: 'info' }] },
    ] },
  { id: 'nymphe', weight: 3,
    prompt: () => [
      { t: t('Du beugst dich über einen Waldsee, um zu trinken, und deine Waffe rutscht dir aus dem Gürtel ins Wasser. Platsch.'), k: 'warn' },
      { t: t('Da steigt eine Nymphe aus dem See. In der einen Hand hält sie ein goldenes Schwert, in der anderen ein silbernes. „Welches hast du verloren?“'), k: 'info' },
    ],
    choices: [
      { id: 'gold', label: t('„Das goldene!“'), key: 'g', run: (p) => {
        const g = Math.floor(p.gold * 0.1);
        p.gold -= g;
        return [{ t: t`Die Nymphe zieht eine Augenbraue hoch und taucht mit beiden Schwertern wieder ab. Deine eigene Waffe holst du dir selbst aus dem Schlamm. Dabei rutschen dir ${g} Gold aus der Tasche.`, k: 'bad' }];
      } },
      { id: 'silber', label: t('„Das silberne!“'), key: 's', run: (p) => {
        const g = Math.floor(p.gold * 0.1);
        p.gold -= g;
        return [{ t: t`„Bescheiden gelogen ist auch gelogen“, sagt die Nymphe und taucht ab. Deine eigene Waffe holst du dir selbst aus dem Schlamm. Dabei rutschen dir ${g} Gold aus der Tasche.`, k: 'bad' }];
      } },
      { id: 'ehrlich', label: t('„Keins davon. Meins war verbeult.“'), key: 'k', run: (p) => {
        p.gems += 1;
        p.charm += 1;
        return [{ t: t('Die Nymphe lächelt und reicht dir deine verbeulte Waffe. „Ehrliche Leute sind selten im Brackenwald.“ Dazu legt sie dir einen Edelstein in die Hand. (+1 Charme)'), k: 'gold' }];
      } },
    ] },
  { id: 'bettlerin', weight: 3,
    prompt: (p) => [{ t: t`Am Wegrand sitzt eine Gestalt in einem grauen Umhang und hält dir eine knochige Hand hin. „Eine Münze für eine alte Frau? ${p.level * 3} Gold, mehr will ich nicht.“ Ihre Stimme klingt seltsam vertraut.`, k: 'warn' }],
    choices: [
      { id: 'geben', label: t('Ihr Gold geben'), key: 'g', hint: (p) => t`${p.level * 3} Gold`, available: (p) => p.gold >= p.level * 3, run: (p) => {
        p.gold -= p.level * 3;
        p.favor += 10;
        return [{ t: t('Sie nimmt die Münzen, und für einen Augenblick siehst du unter der Kapuze kein Gesicht, nur Nebel. Dann ist sie fort. Am Nebelfluss wird man sich an dich erinnern. (+10 Gunst bei Morwen)'), k: 'good' }];
      } },
      { id: 'nein', label: t('Weitergehen'), key: 'w', run: () => [{ t: t('Du gehst weiter. Als du dich umdrehst, ist der Wegrand leer. Dir wird ein bisschen kalt.'), k: 'info' }] },
    ] },
  { id: 'holzfaeller', weight: 4,
    prompt: (p) => [{ t: t`Drei Holzfäller mühen sich mit einem Stamm ab, der quer über dem Weg liegt. „Pack mit an!“, rufen sie. ${p.race === 'troll' ? t('Für einen Troll ist das eine Kleinigkeit.') : t('Das sieht nach einer Stunde Arbeit aus.')}`, k: 'warn' }],
    choices: [
      { id: 'helfen', label: t('Mit anpacken'), key: 'a', hint: (p) => (p.race === 'troll' ? '' : t('1 Waldkampf')), run: (p) => {
        if (p.race !== 'troll') p.forestFights = Math.max(0, p.forestFights - 1);
        const g = roll(6, 12) * p.level;
        const e = Math.round(expPerKill(p.level) * 0.6);
        p.gold += g;
        p.exp += e;
        return [{ t: p.race === 'troll'
          ? t`Du hebst den Stamm allein an und wirfst ihn ins Gebüsch. Die Holzfäller starren dich an und geben dir ihren Tageslohn: ${g} Gold. ${e} Erfahrung.`
          : t`Hau ruck! Gemeinsam rollt ihr den Stamm vom Weg. Die Holzfäller teilen ihr Brot und ihren Lohn mit dir: ${g} Gold. ${e} Erfahrung.`, k: 'gold' }];
      } },
      { id: 'weg', label: t('Außen herum gehen'), key: 'w', run: () => [{ t: t('Du kletterst über das Gestrüpp neben dem Weg. Die Holzfäller rufen dir etwas Unfreundliches nach.'), k: 'info' }] },
    ] },
];

/** Was der Zwerg im Wald für einen Edelstein zahlt (Zwerge bekommen mehr). */
function gemPrice(p: Player): number {
  return Math.round((60 + 25 * p.level) * (p.race === 'zwerg' ? 1.25 : 1));
}

function eligible(p: Player): ForestEvent[] {
  return FOREST_EVENTS.filter((e) => (!e.minLevel || p.level >= e.minLevel) && (!e.when || e.when(p)));
}

/** Für den Spielrechner (scripts/rechner.ts): meldet, welches Ereignis gezogen wurde. Im Spiel leer. */
export const eventTrace: { onPick?: (id: string) => void } = {};

export function pickEvent(p: Player): ForestEvent {
  const list = eligible(p);
  const total = list.reduce((s, e) => s + e.weight, 0);
  let r = roll(1, total);
  let hit = list[0];
  for (const e of list) {
    r -= e.weight;
    if (r <= 0) { hit = e; break; }
  }
  eventTrace.onPick?.(hit.id);
  return hit;
}

export function eventById(id: string): ForestEvent | undefined {
  return FOREST_EVENTS.find((e) => e.id === id);
}
