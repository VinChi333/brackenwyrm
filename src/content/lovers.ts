import type { PartnerId } from '../game/types';

import { t } from '../i18n';
import { news } from '../i18n/news';

// Flirten und Heiraten im Gasthaus, nach dem Original (Violet und Seth in der Taverne).
// Helden umwerben Wirtin Frieda, Heldinnen Barde Florian. In den Einstellungen lässt sich das umstellen.

export interface FlirtMove {
  label: string;
  hint: string;
  ok: string;
  fail: string;
}

export interface Partner {
  id: PartnerId;
  name: string;
  /** "sie"/"er" für kurze Sätze */
  pron: string;
  intro: string;
  moves: FlirtMove[];   // 7 Stufen, von harmlos bis Heiratsantrag
  married: { happy: string[]; grumpy: string[] };
  proposalYes: string;
  proposalNo: string;
  stairsNews: (name: string) => string;
  weddingNews: (name: string) => string;
  leftNews: (name: string) => string;
  leftLetter: (name: string, female: boolean) => string;
  buffName: string;
  notToday: string;
  /** Wenn man diese Person fragt, wie man aussieht (Freund statt Schwarm) */
  looks: string;
}

export const PARTNERS: Record<PartnerId, Partner> = {
  frieda: {
    id: 'frieda', name: t('Frieda'), pron: 'sie',
    intro: t('Frieda balanciert vier Krüge Harzbier durch die Stube. Als sie sich über einen Tisch beugt, fällt ihr eine Haarsträhne ins Gesicht. Sie pustet sie weg und schaut kurz zu dir herüber. Oder bildest du dir das ein?'),
    moves: [
      { label: t('Frieda zuzwinkern'), hint: 'harmlos', ok: t('Du zwinkerst Frieda zu. Sie lächelt warm zurück und stößt dabei fast einen Krug um.'), fail: t('Du zwinkerst Frieda zu. Sie fragt, ob du etwas im Auge hast.') },
      { label: t('Ihre Hand küssen'), hint: 'ein wenig mutiger', ok: t('Du nimmst Friedas Hand und küsst sie sanft. Sie wird rot, streicht sich eine Strähne hinters Ohr und schaut dir nach, als du gehst.'), fail: t('Du greifst nach Friedas Hand. Sie zieht sie zurück und drückt dir stattdessen einen Lappen hinein. „Wenn du schon da bist, wisch den Tisch.“') },
      { label: t('Ihr einen Kuss stehlen'), hint: 'mutig', ok: t('Du lehnst an der Säule und rufst Friedas Namen. Sie kommt näher, ein Lächeln im Mundwinkel, und du gibst ihr einen schnellen Kuss. Am Stammtisch pfeift jemand.'), fail: t('Du rufst Friedas Namen. Sie lächelt entschuldigend: „Nicht jetzt, die Stube ist voll.“') },
      { label: t('Sie auf deinen Schoß ziehen'), hint: 'gewagt', ok: t('Als Frieda an deinem Tisch vorbeikommt, ziehst du sie auf deinen Schoß. Sie lacht, legt dir die Arme um den Hals und haut dir dann auf die Brust. „Ich muss arbeiten, du Holzkopf!“'), fail: t('Du greifst nach Friedas Hüfte. Sie dreht sich elegant weg, ohne einen Tropfen zu verschütten. Der alte Ambros applaudiert ihr.') },
      { label: t('Ihr ein Gedicht aufsagen'), hint: 'sehr gewagt', ok: t('Du steigst auf die Bank und trägst ein Gedicht über Friedas Augen vor. Es reimt sich kaum. Frieda schaut dich trotzdem an, als hättest du ihr den Mond geschenkt.'), fail: t('Du steigst auf die Bank und reimst „Frieda“ auf „Lieder“. Die ganze Stube lacht. Frieda auch. Nicht mit dir, über dich.') },
      { label: t('Sie die Treppe hinauftragen'), hint: t('nur für Mutige'), ok: t('Wie ein Wirbelwind fegst du durch die Stube, hebst Frieda hoch, und sie legt dir die Arme um den Hals. Die Tür oben fällt ins Schloss. Später kommst du die Treppe herunter und grinst von einem Ohr zum anderen.'), fail: t('Du willst Frieda hochheben. Sie gibt dir eine Ohrfeige, die man bis zum Stadttor hört. „Was glaubst du eigentlich, wer ich bin?“') },
      { label: t('Um ihre Hand anhalten'), hint: t('Heiratsantrag'), ok: '', fail: '' },
    ],
    married: {
      happy: [t('Du und Frieda nehmt euch eine Stunde für euch. Du verlässt das Gasthaus und strahlst über das ganze Gesicht.'), t('Frieda stellt dir einen Teller hin, setzt sich zu dir und erzählt dir den neuesten Klatsch. Du gehst gestärkt in den Tag.')],
      grumpy: [t('Du willst Frieda umarmen, aber sie murmelt etwas von „diesen Schweinen, die nie zahlen“ und schiebt dich weg. Du stapfst beleidigt hinaus.'), t('Frieda hat heute schlechte Laune. „Du hast deine Stiefel wieder auf den Tisch gelegt“, sagt sie und dreht sich weg.')],
    },
    proposalYes: t('Frieda nimmt dir die Krüge aus der Hand. Du kniest dich hin, nimmst ihre Hand und stellst die Frage, von der du nie gedacht hättest, dass du sie einmal stellst. Ihr Gesicht leuchtet. „Ja!“, ruft sie. „Ja, ja, ja!“ Die nächsten Tage sind ein einziges Fest im Schlafenden Wurm.'),
    proposalNo: t('Du kniest vor Frieda nieder und stellst die große Frage. Sie schaut dich traurig an. „Nein“, sagt sie. „Ich bin noch nicht so weit.“ Dir ist die Lust auf den Wald für heute vergangen.'),
    stairsNews: (n) => news('stairsFrieda', n),
    weddingNews: (n) => news('weddingFrieda', n),
    leftNews: (n) => news('leftFrieda', n),
    leftLetter: (n, f) => t`Als du aufwachst, liegt ein Zettel neben dir: „${f ? t('Liebe') : t('Lieber')} ${n}, trotz vieler schöner Küsse fühle ich mich nicht mehr so zu dir hingezogen wie früher. Nenn mich launisch, aber ich muss weiterziehen. Es gibt noch andere Helden im Land. Nichts für ungut. Frieda.“`,
    buffName: t('Friedas Liebe'),
    notToday: t('Du solltest dein Glück bei Frieda heute nicht mehr herausfordern.'),
    looks: t('Frieda'),
  },
  florian: {
    id: 'florian', name: t('Florian'), pron: 'er',
    intro: t('Florian sitzt in der Ecke und stimmt seine Laute. Er summt eine Melodie, die du noch nie gehört hast. Als er aufschaut, bleibt sein Blick einen Moment an dir hängen.'),
    moves: [
      { label: t('Florian zuzwinkern'), hint: 'harmlos', ok: t('Du zwinkerst Florian zu. Er verspielt sich und grinst verlegen.'), fail: t('Du zwinkerst Florian zu. Er ist zu sehr mit seiner Laute beschäftigt, um es zu bemerken.') },
      { label: t('Ihm eine Blume ans Barett stecken'), hint: 'ein wenig mutiger', ok: t('Du steckst Florian eine Waldrose an sein Barett. Er tastet danach, lächelt und spielt danach ein bisschen schöner.'), fail: t('Du steckst Florian eine Blume ans Barett. Er niest. Er ist allergisch.') },
      { label: t('Ihm einen Kuss stehlen'), hint: 'mutig', ok: t('Als Florian eine Pause macht, beugst du dich zu ihm und küsst ihn kurz. Er braucht drei Anläufe, um sein nächstes Lied zu beginnen.'), fail: t('Du beugst dich zu Florian. Er hält dir freundlich die Laute hin. „Willst du mal versuchen?“') },
      { label: t('Dich auf seinen Schoß setzen'), hint: 'gewagt', ok: t('Du setzt dich Florian einfach auf den Schoß, mitsamt Laute. Er lacht, legt einen Arm um dich und spielt weiter, als wäre nichts.'), fail: t('Du willst dich auf Florians Schoß setzen, aber da liegt die Laute. Es klingt nicht gut. Für keinen von euch.') },
      { label: t('Ihm ein Liedchen singen'), hint: 'sehr gewagt', ok: t('Du nimmst Florian die Laute ab und singst ihm ein Lied. Es ist schief, aber es ist ehrlich. Florian schaut dich an, als wärst du die schönste Ballade, die er je gehört hat.'), fail: t('Du singst Florian ein Lied vor. Er hört höflich zu und sagt dann: „Ich glaube, du solltest bei den Schwertern bleiben.“') },
      { label: t('Ihn die Treppe hinaufziehen'), hint: t('nur für Mutige'), ok: t('Du packst Florian am Kragen und ziehst ihn lachend die Treppe hinauf. Die Laute bleibt unten stehen. Später kommst du herunter und summst seine Melodie.'), fail: t('Du packst Florian am Kragen. Er befreit sich empört. „Ich bin Künstler, kein Möbelstück!“') },
      { label: t('Um seine Hand anhalten'), hint: t('Heiratsantrag'), ok: '', fail: '' },
    ],
    married: {
      happy: [t('Florian spielt nur für dich ein neues Lied, und du verlässt das Gasthaus mit einem Leuchten im Gesicht.'), t('Du und Florian sitzt eine Stunde am Kamin. Er schreibt ein Gedicht über dich. Es ist fast gut.')],
      grumpy: [t('Florian hat eine Schreibblockade und lässt es an dir aus. „Du bist keine Muse, du bist eine Ablenkung!“'), t('Du willst Florian umarmen, aber er übt gerade. „Nicht jetzt, ich bin bei der dritten Strophe!“')],
    },
    proposalYes: t('Du nimmst Florian die Laute aus der Hand und kniest dich vor ihn. Als du die große Frage stellst, wird es ganz still in der Stube. Dann springt er auf. „Ja! Ja, ja, ja!“ Er schreibt noch am selben Abend drei Lieder über eure Hochzeit.'),
    proposalNo: t('Du kniest vor Florian nieder und stellst die große Frage. Er schaut auf seine Laute. „Nein“, sagt er leise. „Ich bin noch nicht so weit.“ Dir ist die Lust auf den Wald für heute vergangen.'),
    stairsNews: (n) => news('stairsFlorian', n),
    weddingNews: (n) => news('weddingFlorian', n),
    leftNews: (n) => news('leftFlorian', n),
    leftLetter: (n, f) => t`Als du aufwachst, liegt ein Zettel neben dir: „${f ? t('Liebe') : t('Lieber')} ${n}, trotz vieler schöner Küsse fühle ich mich nicht mehr so zu dir hingezogen wie früher. Nenn mich launisch, aber ein Barde muss weiterziehen. Nichts für ungut. Florian.“`,
    buffName: t('Florians Liebe'),
    notToday: t('Du solltest dein Glück bei Florian heute nicht mehr herausfordern.'),
    looks: t('Florian'),
  },
};

/** Ehrliche Meinung eines Freundes zu deinem Aussehen, nach Charme gestaffelt (wie im Original). */
export function looksVerdict(charm: number, female: boolean): string {
  const lots = female ? t('Frauen') : t('Männer');
  if (charm <= 0) return t('Was du da trägst, lässt wenig Raum für Fantasie. Manches denkt man besser gar nicht. Kauf dir bitte etwas weniger Durchsichtiges, als Dienst an der Allgemeinheit.');
  if (charm <= 3) return t`Ich habe in meinem Leben einige hübsche ${lots} gesehen. Du gehörst leider nicht dazu.`;
  if (charm <= 6) return t('Ich habe schon Schlimmeres gesehen. Allerdings nur hinter einem Pferd.');
  if (charm <= 9) return t('Du siehst ziemlich durchschnittlich aus, mein Freund.');
  if (charm <= 12) return t('Du kannst dich wirklich sehen lassen. Werd nur nicht eingebildet, ja?');
  if (charm <= 15) return t('Du bist deutlich hübscher als der Durchschnitt!');
  if (charm <= 18) return t`Nur wenige ${lots} können mit dir mithalten!`;
  return t(`Ich hasse dich. Du bist einfach einer der schönsten Menschen, die je durch diese Tür gekommen sind!`);
}

/** Wer der Schwarm ist, wenn nichts eingestellt wurde: wie im Original das andere Geschlecht. */
export function defaultPartner(gender: 'm' | 'f'): PartnerId {
  return gender === 'f' ? 'florian' : 'frieda';
}
