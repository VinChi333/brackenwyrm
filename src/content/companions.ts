import { t } from '../i18n';
// Söldnerlager am Waldrand (Original: Mercenary Camp mit Begleitern).
// Ein Begleiter zur Zeit. Er kämpft im Wald und in der Feste mit. Nicht beim Meister, nicht gegen den Wyrm,
// nicht im Schattenreich und nicht gegen andere Helden.

export type CompanionId = 'kaempfer' | 'heilerin' | 'schild';

export interface CompanionDef {
  id: CompanionId;
  name: string;           // Eigenname
  role: string;           // was er tut
  costPerLevel: number;   // Anheuern: so viel Gold je Stufe
  hpBase: number;
  hpPerLevel: number;
  blurb: string;
  hire: string;
  hit: string;            // {d} = Schaden / Heilung, {N} = Gegner
  fall: string;
}

export const COMPANIONS: CompanionDef[] = [
  { id: 'kaempfer', name: t('Rauf Eisenfaust'), role: t('Kämpfer'), costPerLevel: 40, hpBase: 20, hpPerLevel: 7,
    blurb: t('Schlägt jede Runde mit zu. Nicht hell im Kopf, aber hart in der Faust.'),
    hire: t('Rauf spuckt in die Hände, schultert seine Axt und grinst. „Wo ist was zum Hauen?“'),
    hit: t('Rauf haut {N} mit der Axt eins über: {d} Schaden.'), fall: t('Rauf geht zu Boden und bleibt schnarchend liegen. Für heute ist er raus.') },
  { id: 'heilerin', name: t('Schwester Linnea'), role: t('Heilerin'), costPerLevel: 50, hpBase: 14, hpPerLevel: 5,
    blurb: t('Flickt dich mitten im Kampf zusammen, Runde für Runde.'),
    hire: t('Linnea packt Verbände, Salben und einen erstaunlich großen Knüppel ein. „Nur für Notfälle.“'),
    hit: t('Linnea legt dir die Hand auf. Du heilst um {d} Lebenspunkte.'), fall: t('Linnea bricht erschöpft zusammen. Sie muss sich erst erholen.') },
  { id: 'schild', name: t('Bodo der Breite'), role: t('Schildträger'), costPerLevel: 45, hpBase: 30, hpPerLevel: 9,
    blurb: t('Springt mit seinem Türschild vor dich und fängt Treffer ab.'),
    hire: t('Bodo hebt einen Schild, so groß wie eine Scheunentür. „Hinter mich. Immer hinter mich.“'),
    hit: t('Bodo wirft sich mit seinem Schild dazwischen und fängt den Hieb ab ({d} Schaden für ihn).'), fall: t('Bodos Schild ist zersplittert, er selbst liegt daneben. Für heute ist er fertig.') },
];

export function companionDef(id: string | undefined): CompanionDef | undefined {
  return COMPANIONS.find((c) => c.id === id);
}

export const COMPANION_TEXT = {
  intro: t('Am Waldrand, hinter einer Palisade aus angespitzten Stämmen, lagern die Söldner. Rauch steigt von den Feuern auf, irgendwo schärft jemand eine Klinge. Der Lagermeister, ein einäugiger Mann namens Hagen, mustert dich. „Begleitung gefällig? Wir sind nicht billig, aber wir bleiben, bis du den Drachen erledigt hast.“'),
  rules: t('Ein Begleiter zur Zeit. Er bleibt, bis du den Drachen erschlägst, und kommt mit in den Wald und in die Feste. Beim Meister, im Schattenreich und gegen andere Helden kämpfst du allein. Und in die Farnschlucht zum Wyrm traut sich keiner von Hagens Leuten, egal für wie viel Gold. Über Nacht erholt er sich um die Hälfte seiner Lebenspunkte, im Lager heilt Hagen ihn gegen Gold.'),
  dismiss: t('Du zahlst aus und trennst dich im Guten. Hagen nickt nur.'),
};
