import type { PartnerId } from '../game/types';

import { t } from '../i18n';
import { news } from '../i18n/news';

// Flirten und Heiraten im Gasthaus.
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
      { label: t('Frieda zuzwinkern'), hint: t('harmlos'), ok: t('Du zwinkerst Frieda über den Tresen zu. Sie zwinkert zurück und zapft vor lauter Ablenkung ein Bier zu viel.'), fail: t('Du zwinkerst Frieda zu. Sie reicht dir wortlos ein sauberes Tuch. „Fliege im Auge?“') },
      { label: t('Ihr beim Tragen helfen'), hint: t('ein wenig mutiger'), ok: t('Du nimmst Frieda das volle Tablett ab und trägst es zum Stammtisch, ohne einen Tropfen zu verlieren. „Endlich mal einer, der mit anpackt“, sagt sie und klopft dir auf die Schulter.'), fail: t('Du willst Frieda das Tablett abnehmen und stößt dabei drei Krüge um. Sie drückt dir wortlos einen Wischmopp in die Hand.') },
      { label: t('Ihr einen Waldstrauß schenken'), hint: t('mutig'), ok: t('Du legst Frieda einen Strauß aus Farn und Waldveilchen auf den Tresen. Sie stellt ihn in einen leeren Bierkrug und summt den ganzen Abend vor sich hin.'), fail: t('Du reichst Frieda deinen Waldstrauß. Sie niest dreimal und gibt ihn zurück. „Lieb gemeint. Aber da ist Brennnessel drin.“') },
      { label: t('Sie zum Tanz auffordern'), hint: t('gewagt'), ok: t('Als Florian ein schnelles Lied anstimmt, ziehst du Frieda zwischen die Tische. Ihr dreht euch, bis euch schwindlig ist, und am Ende lacht die ganze Stube mit.'), fail: t('Du forderst Frieda zum Tanz auf. „Siehst du, wie voll es hier ist?“ Sie lässt dich mitten in der Stube stehen. Der alte Ambros klatscht spöttisch.') },
      { label: t('Ihr ein Gedicht aufsagen'), hint: t('sehr gewagt'), ok: t('Du steigst auf die Bank und trägst ein Gedicht über Friedas Augen vor. Es reimt sich kaum. Frieda schaut dich trotzdem an, als hättest du ihr den Mond geschenkt.'), fail: t('Du steigst auf die Bank und reimst „Frieda“ auf „Lieder“. Die ganze Stube lacht. Frieda auch. Nicht mit dir, über dich.') },
      { label: t('Sie zu einem Mondscheinspaziergang entführen'), hint: t('nur für Mutige'), ok: t('Du flüsterst Frieda etwas ins Ohr. Sie bindet die Schürze ab, nimmt deine Hand, und ihr verschwindet durch die Hintertür in die Nacht. Erst im Morgengrauen kommst du zurück, mit Moos im Haar und einem Lächeln, das nicht mehr weggeht.'), fail: t('Du flüsterst Frieda etwas ins Ohr. Zur Antwort leert sie dir einen Krug Wasser über den Kopf. „Kühl dich ab, Held.“') },
      { label: t('Um ihre Hand anhalten'), hint: t('Heiratsantrag'), ok: '', fail: '' },
    ],
    married: {
      happy: [t('Frieda schließt die Stube eine Stunde früher. Ihr teilt euch am Kamin einen Apfelkuchen, und du gehst mit warmem Bauch und leichtem Herzen.'), t('Frieda hat dir ein Brot mit dick Butter eingepackt, mit einem Kuss obendrauf. So lässt es sich kämpfen.')],
      grumpy: [t('Frieda zählt gerade die offenen Rechnungen der Stammgäste und ist nicht zu sprechen. Als du sie umarmen willst, schreibt sie dich gleich mit auf die Liste.'), t('Frieda hat heute schlechte Laune. „Du hast deine Stiefel wieder auf den Tisch gelegt“, sagt sie und dreht sich weg.')],
    },
    proposalYes: t('Du wartest, bis die letzten Gäste gegangen sind. Dann holst du den Ring aus geflochtenem Wurzelholz hervor, den du seit Tagen mit dir herumträgst. Frieda schlägt die Hände vor den Mund, dann fällt sie dir um den Hals. „Natürlich will ich, du Dummkopf!“ Am nächsten Abend feiert ganz Moosgrund im Schlafenden Wurm.'),
    proposalNo: t('Du hältst Frieda den Ring aus Wurzelholz hin. Sie schließt deine Hand sanft darum. „Frag mich noch einmal, wenn du mehr von der Welt gesehen hast.“ Mit schwerem Herzen bleibst du am Kamin sitzen. In den Wald gehst du heute nicht mehr.'),
    stairsNews: (n) => news('stairsFrieda', n),
    weddingNews: (n) => news('weddingFrieda', n),
    leftNews: (n) => news('leftFrieda', n),
    leftLetter: (n, f) => t`Als du aufwachst, steckt ein Zettel im Türrahmen: „${f ? t('Liebe') : t('Lieber')} ${n}, ich habe lange überlegt. Wir zwei passen wie Bier und Milch, und das schmeckt keinem. Ich wünsch dir alles Gute im Wald. Frieda.“`,
    buffName: t('Friedas Liebe'),
    notToday: t('Frieda hat heute genug von dir. Versuch es morgen wieder.'),
    looks: t('Frieda'),
  },
  florian: {
    id: 'florian', name: t('Florian'), pron: 'er',
    intro: t('Florian sitzt in der Ecke und stimmt seine Laute. Er summt eine Melodie, die du noch nie gehört hast. Als er aufschaut, bleibt sein Blick einen Moment an dir hängen.'),
    moves: [
      { label: t('Florian zuzwinkern'), hint: t('harmlos'), ok: t('Du zwinkerst Florian zu. Er verspielt sich und grinst verlegen.'), fail: t('Du zwinkerst Florian zu. Er zählt gerade halblaut Silben für ein neues Lied ab und merkt nichts.') },
      { label: t('Ihm eine Blume ans Barett stecken'), hint: t('ein wenig mutiger'), ok: t('Du steckst Florian eine Waldrose an sein Barett. Er tastet danach, lächelt und spielt danach ein bisschen schöner.'), fail: t('Du steckst Florian eine Blume ans Barett. Er niest. Er ist allergisch.') },
      { label: t('Ihm einen Kuss stehlen'), hint: t('mutig'), ok: t('Als Florian eine Pause macht, beugst du dich zu ihm und küsst ihn kurz. Er braucht drei Anläufe, um sein nächstes Lied zu beginnen.'), fail: t('Du beugst dich zu Florian. Er hält dir freundlich die Laute hin. „Willst du mal versuchen?“') },
      { label: t('Dir ein Lied über dich wünschen'), hint: t('gewagt'), ok: t('Du wünschst dir ein Lied über deine Heldentaten. Florian dichtet aus dem Stegreif eine Strophe über dich, und die ganze Stube singt den Kehrreim mit.'), fail: t('Du wünschst dir ein Lied über dich. Florian spielt es, singt deinen Namen aber absichtlich falsch. Viermal.') },
      { label: t('Ihm ein Liedchen singen'), hint: t('sehr gewagt'), ok: t('Du nimmst Florian die Laute ab und singst ihm ein Lied. Es ist schief, aber es ist ehrlich. Florian schaut dich an, als wärst du die schönste Ballade, die er je gehört hat.'), fail: t('Du singst Florian ein Lied vor. Er hört höflich zu und sagt dann: „Ich glaube, du solltest bei den Schwertern bleiben.“') },
      { label: t('Ihn zu einem Mondscheinspaziergang entführen'), hint: t('nur für Mutige'), ok: t('Du stellst Florians Laute in die Ecke und ziehst ihn hinaus in die Nacht. Ihr kommt erst zurück, als die Vögel singen, und Florian pfeift eine Melodie, die noch keiner kennt.'), fail: t('Du willst Florian hinausziehen. Er hält sich mit beiden Händen am Tisch fest. „Ich bin Künstler, kein Gepäck!“') },
      { label: t('Um seine Hand anhalten'), hint: t('Heiratsantrag'), ok: '', fail: '' },
    ],
    married: {
      happy: [t('Florian spielt nur für dich ein neues Lied, und du verlässt das Gasthaus mit einem Leuchten im Gesicht.'), t('Du und Florian sitzt eine Stunde am Kamin. Er schreibt ein Gedicht über dich. Es ist fast gut.')],
      grumpy: [t('Florian hat eine Schreibblockade und lässt es an dir aus. „Du bist keine Muse, du bist eine Ablenkung!“'), t('Du willst Florian umarmen, aber er übt gerade. „Nicht jetzt, ich bin bei der dritten Strophe!“')],
    },
    proposalYes: t('Du wartest, bis Florian sein letztes Lied gespielt hat. Dann hältst du ihm einen Ring aus geflochtenem Wurzelholz hin. Zum ersten Mal fehlen ihm die Worte. Er nickt nur, immer wieder, und noch in derselben Nacht dichtet er drei Lieder über euch.'),
    proposalNo: t('Du hältst Florian den Ring hin. Er streicht über die Saiten, ohne zu spielen. „Ein Barde gehört der Straße“, sagt er leise. Mit schwerem Herzen bleibst du am Kamin sitzen. In den Wald gehst du heute nicht mehr.'),
    stairsNews: (n) => news('stairsFlorian', n),
    weddingNews: (n) => news('weddingFlorian', n),
    leftNews: (n) => news('leftFlorian', n),
    leftLetter: (n, f) => t`Als du aufwachst, steckt ein Zettel im Türrahmen: „${f ? t('Liebe') : t('Lieber')} ${n}, die Straße ruft, und ein Barde muss ihr folgen. Unsere schönsten Tage nehme ich als Lieder mit. Florian.“`,
    buffName: t('Florians Liebe'),
    notToday: t('Florian hat heute genug von dir. Versuch es morgen wieder.'),
    looks: t('Florian'),
  },
};

/** Ehrliche Meinung eines Freundes zu deinem Aussehen, nach Charme gestaffelt. */
export function looksVerdict(charm: number, female: boolean): string {
  const lots = female ? t('Frauen') : t('Männer');
  if (charm <= 0) return t('Ehrlich? Wenn du in den Wald gehst, laufen die Eulenbären nicht vor deinem Schwert davon, sondern vor deinem Gesicht.');
  if (charm <= 3) return t`Sagen wir so: Du hast ein Gesicht, das nur eine Mutter lieben kann. Und deine überlegt noch.`;
  if (charm <= 6) return t('Mit Kapuze geht es eigentlich.');
  if (charm <= 9) return t('Du siehst aus wie jemand aus Moosgrund. Nicht mehr, nicht weniger.');
  if (charm <= 12) return t('Du machst durchaus etwas her. Lass es dir nur nicht zu Kopf steigen.');
  if (charm <= 15) return t('Wenn du durchs Dorf gehst, drehen sich die Leute nach dir um. Im guten Sinn!');
  if (charm <= 18) return t`Im ganzen Land gibt es kaum ${lots}, die so gut aussehen wie du.`;
  return t('Es ist fast unverschämt, wie gut du aussiehst. Stell dich bitte nicht neben mich, wenn Gäste kommen.');
}

/** Wer der Schwarm ist, wenn nichts eingestellt wurde: das andere Geschlecht. */
export function defaultPartner(gender: 'm' | 'f'): PartnerId {
  return gender === 'f' ? 'florian' : 'frieda';
}
