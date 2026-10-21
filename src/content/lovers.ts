import type { PartnerId } from '../game/types';

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
    id: 'frieda', name: 'Frieda', pron: 'sie',
    intro: 'Frieda balanciert vier Krüge Harzbier durch die Stube. Als sie sich über einen Tisch beugt, fällt ihr eine Haarsträhne ins Gesicht. Sie pustet sie weg und schaut kurz zu dir herüber. Oder bildest du dir das ein?',
    moves: [
      { label: 'Frieda zuzwinkern', hint: 'harmlos', ok: 'Du zwinkerst Frieda zu. Sie lächelt warm zurück und stößt dabei fast einen Krug um.', fail: 'Du zwinkerst Frieda zu. Sie fragt, ob du etwas im Auge hast.' },
      { label: 'Ihre Hand küssen', hint: 'ein wenig mutiger', ok: 'Du nimmst Friedas Hand und küsst sie sanft. Sie wird rot, streicht sich eine Strähne hinters Ohr und schaut dir nach, als du gehst.', fail: 'Du greifst nach Friedas Hand. Sie zieht sie zurück und drückt dir stattdessen einen Lappen hinein. „Wenn du schon da bist, wisch den Tisch.“' },
      { label: 'Ihr einen Kuss stehlen', hint: 'mutig', ok: 'Du lehnst an der Säule und rufst Friedas Namen. Sie kommt näher, ein Lächeln im Mundwinkel, und du gibst ihr einen schnellen Kuss. Am Stammtisch pfeift jemand.', fail: 'Du rufst Friedas Namen. Sie lächelt entschuldigend: „Nicht jetzt, die Stube ist voll.“' },
      { label: 'Sie auf deinen Schoß ziehen', hint: 'gewagt', ok: 'Als Frieda an deinem Tisch vorbeikommt, ziehst du sie auf deinen Schoß. Sie lacht, legt dir die Arme um den Hals und haut dir dann auf die Brust. „Ich muss arbeiten, du Holzkopf!“', fail: 'Du greifst nach Friedas Hüfte. Sie dreht sich elegant weg, ohne einen Tropfen zu verschütten. Der alte Ambros applaudiert ihr.' },
      { label: 'Ihr ein Gedicht aufsagen', hint: 'sehr gewagt', ok: 'Du steigst auf die Bank und trägst ein Gedicht über Friedas Augen vor. Es reimt sich kaum. Frieda schaut dich trotzdem an, als hättest du ihr den Mond geschenkt.', fail: 'Du steigst auf die Bank und reimst „Frieda“ auf „Lieder“. Die ganze Stube lacht. Frieda auch. Nicht mit dir, über dich.' },
      { label: 'Sie die Treppe hinauftragen', hint: 'nur für Mutige', ok: 'Wie ein Wirbelwind fegst du durch die Stube, hebst Frieda hoch, und sie legt dir die Arme um den Hals. Die Tür oben fällt ins Schloss. Später kommst du die Treppe herunter und grinst von einem Ohr zum anderen.', fail: 'Du willst Frieda hochheben. Sie gibt dir eine Ohrfeige, die man bis zum Stadttor hört. „Was glaubst du eigentlich, wer ich bin?“' },
      { label: 'Um ihre Hand anhalten', hint: 'Heiratsantrag', ok: '', fail: '' },
    ],
    married: {
      happy: ['Du und Frieda nehmt euch eine Stunde für euch. Du verlässt das Gasthaus und strahlst über das ganze Gesicht.', 'Frieda stellt dir einen Teller hin, setzt sich zu dir und erzählt dir den neuesten Klatsch. Du gehst gestärkt in den Tag.'],
      grumpy: ['Du willst Frieda umarmen, aber sie murmelt etwas von „diesen Schweinen, die nie zahlen“ und schiebt dich weg. Du stapfst beleidigt hinaus.', 'Frieda hat heute schlechte Laune. „Du hast deine Stiefel wieder auf den Tisch gelegt“, sagt sie und dreht sich weg.'],
    },
    proposalYes: 'Frieda nimmt dir die Krüge aus der Hand. Du kniest dich hin, nimmst ihre Hand und stellst die Frage, von der du nie gedacht hättest, dass du sie einmal stellst. Ihr Gesicht leuchtet. „Ja!“, ruft sie. „Ja, ja, ja!“ Die nächsten Tage sind ein einziges Fest im Schlafenden Wurm.',
    proposalNo: 'Du kniest vor Frieda nieder und stellst die große Frage. Sie schaut dich traurig an. „Nein“, sagt sie. „Ich bin noch nicht so weit.“ Dir ist die Lust auf den Wald für heute vergangen.',
    stairsNews: (n) => `${n} und Wirtin Frieda wurden zusammen auf der Treppe zu den Gästezimmern gesehen.`,
    weddingNews: (n) => `${n} und Wirtin Frieda haben heute geheiratet! Im Schlafenden Wurm gab es Freibier. Fast.`,
    leftNews: (n) => `Frieda hat ${n} verlassen, um „anderen Interessen“ nachzugehen.`,
    leftLetter: (n, f) => `Als du aufwachst, liegt ein Zettel neben dir: „${f ? 'Liebe' : 'Lieber'} ${n}, trotz vieler schöner Küsse fühle ich mich nicht mehr so zu dir hingezogen wie früher. Nenn mich launisch, aber ich muss weiterziehen. Es gibt noch andere Helden im Land. Nichts für ungut. Frieda.“`,
    buffName: 'Friedas Liebe',
    notToday: 'Du solltest dein Glück bei Frieda heute nicht mehr herausfordern.',
    looks: 'Frieda',
  },
  florian: {
    id: 'florian', name: 'Florian', pron: 'er',
    intro: 'Florian sitzt in der Ecke und stimmt seine Laute. Er summt eine Melodie, die du noch nie gehört hast. Als er aufschaut, bleibt sein Blick einen Moment an dir hängen.',
    moves: [
      { label: 'Florian zuzwinkern', hint: 'harmlos', ok: 'Du zwinkerst Florian zu. Er verspielt sich und grinst verlegen.', fail: 'Du zwinkerst Florian zu. Er ist zu sehr mit seiner Laute beschäftigt, um es zu bemerken.' },
      { label: 'Ihm eine Blume ans Barett stecken', hint: 'ein wenig mutiger', ok: 'Du steckst Florian eine Waldrose an sein Barett. Er tastet danach, lächelt und spielt danach ein bisschen schöner.', fail: 'Du steckst Florian eine Blume ans Barett. Er niest. Er ist allergisch.' },
      { label: 'Ihm einen Kuss stehlen', hint: 'mutig', ok: 'Als Florian eine Pause macht, beugst du dich zu ihm und küsst ihn kurz. Er braucht drei Anläufe, um sein nächstes Lied zu beginnen.', fail: 'Du beugst dich zu Florian. Er hält dir freundlich die Laute hin. „Willst du mal versuchen?“' },
      { label: 'Dich auf seinen Schoß setzen', hint: 'gewagt', ok: 'Du setzt dich Florian einfach auf den Schoß, mitsamt Laute. Er lacht, legt einen Arm um dich und spielt weiter, als wäre nichts.', fail: 'Du willst dich auf Florians Schoß setzen, aber da liegt die Laute. Es klingt nicht gut. Für keinen von euch.' },
      { label: 'Ihm ein Liedchen singen', hint: 'sehr gewagt', ok: 'Du nimmst Florian die Laute ab und singst ihm ein Lied. Es ist schief, aber es ist ehrlich. Florian schaut dich an, als wärst du die schönste Ballade, die er je gehört hat.', fail: 'Du singst Florian ein Lied vor. Er hört höflich zu und sagt dann: „Ich glaube, du solltest bei den Schwertern bleiben.“' },
      { label: 'Ihn die Treppe hinaufziehen', hint: 'nur für Mutige', ok: 'Du packst Florian am Kragen und ziehst ihn lachend die Treppe hinauf. Die Laute bleibt unten stehen. Später kommst du herunter und summst seine Melodie.', fail: 'Du packst Florian am Kragen. Er befreit sich empört. „Ich bin Künstler, kein Möbelstück!“' },
      { label: 'Um seine Hand anhalten', hint: 'Heiratsantrag', ok: '', fail: '' },
    ],
    married: {
      happy: ['Florian spielt nur für dich ein neues Lied, und du verlässt das Gasthaus mit einem Leuchten im Gesicht.', 'Du und Florian sitzt eine Stunde am Kamin. Er schreibt ein Gedicht über dich. Es ist fast gut.'],
      grumpy: ['Florian hat eine Schreibblockade und lässt es an dir aus. „Du bist keine Muse, du bist eine Ablenkung!“', 'Du willst Florian umarmen, aber er übt gerade. „Nicht jetzt, ich bin bei der dritten Strophe!“'],
    },
    proposalYes: 'Du nimmst Florian die Laute aus der Hand und kniest dich vor ihn. Als du die große Frage stellst, wird es ganz still in der Stube. Dann springt er auf. „Ja! Ja, ja, ja!“ Er schreibt noch am selben Abend drei Lieder über eure Hochzeit.',
    proposalNo: 'Du kniest vor Florian nieder und stellst die große Frage. Er schaut auf seine Laute. „Nein“, sagt er leise. „Ich bin noch nicht so weit.“ Dir ist die Lust auf den Wald für heute vergangen.',
    stairsNews: (n) => `${n} und Barde Florian wurden zusammen auf der Treppe zu den Gästezimmern gesehen.`,
    weddingNews: (n) => `${n} und Barde Florian haben heute geheiratet! Florian hat seine eigene Hochzeit selbst besungen.`,
    leftNews: (n) => `Florian hat ${n} verlassen, um „anderen Interessen“ nachzugehen.`,
    leftLetter: (n, f) => `Als du aufwachst, liegt ein Zettel neben dir: „${f ? 'Liebe' : 'Lieber'} ${n}, trotz vieler schöner Küsse fühle ich mich nicht mehr so zu dir hingezogen wie früher. Nenn mich launisch, aber ein Barde muss weiterziehen. Nichts für ungut. Florian.“`,
    buffName: 'Florians Liebe',
    notToday: 'Du solltest dein Glück bei Florian heute nicht mehr herausfordern.',
    looks: 'Florian',
  },
};

/** Ehrliche Meinung eines Freundes zu deinem Aussehen, nach Charme gestaffelt (wie im Original). */
export function looksVerdict(charm: number, female: boolean): string {
  const lots = female ? 'Frauen' : 'Männer';
  if (charm <= 0) return 'Was du da trägst, lässt wenig Raum für Fantasie. Manches denkt man besser gar nicht. Kauf dir bitte etwas weniger Durchsichtiges, als Dienst an der Allgemeinheit.';
  if (charm <= 3) return `Ich habe in meinem Leben einige hübsche ${lots} gesehen. Du gehörst leider nicht dazu.`;
  if (charm <= 6) return 'Ich habe schon Schlimmeres gesehen. Allerdings nur hinter einem Pferd.';
  if (charm <= 9) return 'Du siehst ziemlich durchschnittlich aus, mein Freund.';
  if (charm <= 12) return 'Du kannst dich wirklich sehen lassen. Werd nur nicht eingebildet, ja?';
  if (charm <= 15) return 'Du bist deutlich hübscher als der Durchschnitt!';
  if (charm <= 18) return `Nur wenige ${lots} können mit dir mithalten!`;
  return `Ich hasse dich. Du bist einfach einer der schönsten Menschen, die je durch diese Tür gekommen sind!`;
}

/** Wer der Schwarm ist, wenn nichts eingestellt wurde: wie im Original das andere Geschlecht. */
export function defaultPartner(gender: 'm' | 'f'): PartnerId {
  return gender === 'f' ? 'florian' : 'frieda';
}
