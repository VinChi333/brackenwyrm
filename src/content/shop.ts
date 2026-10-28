import { lang, t } from '../i18n';

// Vollversion: bis zum ersten Drachen gratis, danach einmal kaufen. Keine Abos, keine Käufe im Spiel.
// buyUrl: Link zum Kauf (z. B. ein Zahlungslink eines Shops). Solange er leer ist, zeigt das Spiel nur das Einlösen eines Codes.
export const SHOP = {
  priceDe: '7,99 €', // i18n-ignore
  priceEn: '€7.99', // i18n-ignore
  buyUrl: '',
};

export function priceText(): string {
  return lang === 'de' ? SHOP.priceDe : SHOP.priceEn;
}

export const FULL_TEXT = {
  title: t('Der Wyrm ist besiegt!'),
  lead: t('Du hast geschafft, wovon in Moosgrund jedes Kind träumt. Damit hast du die kostenlose Fassung von Brackenwyrm durchgespielt.'),
  more: t('Mit der Vollversion beginnt dein Held ein neues Leben: mit einem Drachenpunkt mehr, einem neuen Titel und allem, was danach kommt. Wyrme kehren nämlich wieder, und jeder ist stärker als der letzte.'),
  fair: t('Einmal bezahlen, für immer spielen. Keine Abos, keine Käufe im Spiel, keine Vorteile gegen Geld. Die Vollversion gilt für dein Spielerkonto, also auf allen deinen Geräten.'),
};
