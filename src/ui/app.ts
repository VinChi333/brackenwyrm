// Die Oberfläche im Aufbau von damals: Navigation links, Geschehen in der Mitte,
// Charakterwerte rechts. Gegner erscheinen als illustrierte Karten.

import { eventById } from '../content/events';
import { FEEDBACK_KINDS, feedbackMessage } from '../content/feedback';
import type { FeedbackKind } from '../content/feedback';
import { fameTable } from '../content/fame';
import { TITLE_KEYS, titleFor } from '../content/titles';
import { FULL_TEXT, SHOP, priceText } from '../content/shop';
import { canInstall, initPwa, install, isIos, isStandalone } from '../pwa';
import { PARTNERS } from '../content/lovers';
import { MERTEN, MOUNTS, MOUNT_ORDER, mountRepay } from '../content/mounts';
import { buyMount, feedMount, feedPrice, sellMount, tradeCost } from '../game/stable';
import { gameDayKey, untilNextDay, dayStartsLocal } from '../game/clock';
import { askLooks, flirt, friendOf, partnerOf, visitSpouse } from '../game/lovers';
import { forestFightsPerDay, restartGems, restartGold, FLAWLESS_GOLD } from '../game/balance';
import { FRIEDA_TALKS_PER_DAY, regularsSay } from '../content/inn';
import { ARMORS, WEAPONS, tradeIn } from '../content/items';
import { masterForLevel } from '../content/masters';
import { MONSTERS } from '../content/monsters';
import { SHADES } from '../content/shades';
import { SPECIALTIES, SPECIALTY_ORDER } from '../content/specialties';
import { RACES, RACE_ORDER, raceName } from '../content/races';
import { MAX_LEVEL, healCostPerHp } from '../game/balance';
import {
  announce, applyHaunt, HAUNT_FAVOR, attack, bankDeposit, bankWithdraw, buyItem, canChallengeMaster, canSeekDragon, checkRealDay, chooseDragonBonus,
  CHRONICLE_SIZE, closeFight, defense, bankBorrow, LOAN_PER_LEVEL, expNeeded, fightAction, forestSearch, harzbierCost, heal, healCost, maxHp,
  graveSearch, maxSoul, RESURRECT_FAVOR, restoreSoul, resurrect, soulRestoreCost,
  newGame, rentRoom, roomCost, requestSong, resolveEvent, startDragonFight, startMasterFight, startNewDay, talkToFrieda,
} from '../game/engine';
import type { FightAction, ForestMode } from '../game/engine';
import { deleteGame, exportCode, importCode, loadGame, loadPrefs, saveGame, savePrefs } from '../game/storage';
import { Cloud, CloudError } from '../game/cloud';
import type { AushangRow, BountyRow, CodeRow, GuildMember, GuildMine, GuildRow, DiceResult, FameCat, FameCatRow, JackpotInfo, BlockRow, MailRow, ModBanned, ModCheat, ModReport, ReportKind, WarriorRow } from '../game/cloud';
import { censor, isClean } from '../content/badwords';
import { datenschutzHtml, impressumHtml, legalIncomplete } from '../content/legal';
import { DIR_NAME, FESTE_COST, FESTE_MIN_LEVEL, SIZE as FESTE_SIZE, afterFesteFight, canEnterFeste, enterFeste, festeLight, exits, heirloomNames, leaveFeste, mazeFor, moveFeste, treasureNews, type Dir } from '../game/feste';
import { FESTE_FOES, FESTE_NAME, FESTE_TEXT, HEIRLOOMS, SCROLLS, heirloom } from '../content/feste';
import { COMPANION_TEXT, companionDef, type CompanionId } from '../content/companions';
import { COMPANIONS, companionCost, companionHealCost, companionMaxHp, dismissCompanion, healCompanion, hireCompanion } from '../game/engine';
import { GUIDE_END, GUIDE_STEPS, SCREEN_HINTS, type GuideStep } from '../content/guide';
import { closeGuide, currentStep, guideFinished, guideUpdate, guideVisit, placeOpen, skipGuide } from '../game/guide';
import { DRINKS, MAX_DRUNK, drinkCost, drunkWord, orderDrink, slur, type DrinkId } from '../game/tavern';
import { POTIONS, chooseNewRace, chooseNewSpecialty, drinkPotion, paySeer, seerCost, type PotionId } from '../game/shops';
import { AMBROS_GAMES_PER_DAY, AMBROS_TRIES, ambrosBets, guessAmbros, startAmbros, type AmbrosGame } from '../game/ambros';
import type { CommentRow, FameRow, NewsRow, PvpTarget, RemoteSave } from '../game/cloud';
import { decideSync } from '../game/sync';
import type { ChronicleEntry, DragonPoint, GameState, Gender, LogLine, MountId, RaceId, SpecialtyId } from '../game/types';
import { cardBack, cardFor, shadeBack, shadeCard, cardHtml, dragonCard, heroArt, heroPortrait, masterCard, monsterCard, mountCard, tierFor } from './art/cards';
import type { CardInfo } from './art/cards';
import { applyPvpEvents, applyPvpResult } from '../game/pvp';
import { sound, type TrackId } from './audio';

import { LANGS, lang, missing, switchLang, t } from '../i18n';
import { showNews } from '../i18n/news';
import { serverText } from '../i18n/server';

type Screen = 'title' | 'create' | 'village' | 'forest' | 'fight' | 'training' | 'healer' | 'smith'
  | 'bank' | 'inn' | 'bestiary' | 'fame' | 'chronicle' | 'feedback' | 'settings' | 'shadows' | 'dragonBonus' | 'syncConflict' | 'login' | 'fields' | 'innGuests' | 'news' | 'flirt' | 'stable' | 'warriors' | 'mail' | 'haunt' | 'bio' | 'ambros'
  | 'datenschutz' | 'impressum' | 'wache' | 'blocks' | 'deleteAccount'
  | 'quirin' | 'seer' | 'felsen' | 'garten' | 'feste' | 'heirlooms'
  | 'tresen' | 'dag' | 'fivesix' | 'aushang' | 'lager' | 'gilde' | 'vollversion';

// Titelbild: der schlafende Wyrm (art-source/titel-wyrm.png) und der Spruch darunter.
const TITLE_ART = (import.meta.glob('../assets/title/titel-wyrm.webp', { eager: true, import: 'default' }) as Record<string, string>)['../assets/title/titel-wyrm.webp'];
const TITLE_SPRUCH = t('Hier gibt’s nicht viel zu schnacken – such lieber den Wyrm in den Bracken.');
const VERSION = t('Testversion {0}', '0.48');

interface Ui {
  screen: Screen;
  flash: LogLine[];
  createName: string;
  createSpec: SpecialtyId;
  createGender: Gender;
  createRace: RaceId;
  dkRace: RaceId | null;
  skillMenu: boolean;
  warriors: WarriorRow[] | null;
  mail: MailRow[] | null;
  listErr: string;
  mailOpen: number | null;
  compose: { to: string; toName: string; subject: string; body: string } | null;
  unread: number;
  bio: WarriorRow | null;
  bioNews: NewsRow[] | null;
  statue: string | null;          // Name des letzten Drachentöters (Denkmal im Dorf)
  ambros: AmbrosGame | null;
  blocked: Set<string>;               // blockierte Spieler (ihre Beiträge und Briefe werden ausgeblendet)
  blocksList: BlockRow[] | null;
  isAdmin: boolean;                   // gehört zur Wache (Moderation)
  repConfirm: string;                 // "Wirklich melden?" für diesen Beitrag
  legalFrom: Screen;
  delMsg: string;
  bankMode: '' | 'loan' | 'transfer';
  bounties: BountyRow[] | null;
  dice: { info: JackpotInfo | null; last: DiceResult | null; err: string; busy: boolean };
  aushang: AushangRow[] | null;
  fameCat: FameCat;
  fameRows: FameCatRow[] | null | undefined;
  wache: { tab: 'reports' | 'banned' | 'cheats' | 'aushang' | 'vollversion'; reports: ModReport[] | null; banned: ModBanned[] | null; cheats: ModCheat[] | null; err: string; codes: CodeRow[] | null; newCodes: string[] };
  full: boolean | null;     // Vollversion: true/false, null = noch nicht geprüft
  fullMsg: string;
  unreadAt: number;            // Handy: Fähigkeiten statt Kampfbefehlen in der Leiste
  dkPoint: DragonPoint | null;   // Auswahl nach dem Drachenkill
  dkSpec: SpecialtyId | null;
  confirmDelete: boolean;
  confirmNew: boolean;
  importMsg: string;
  newCard: string | null;   // Karte, die gerade neu ins Bestiarium kam
  fullLog: boolean;         // Kampfbericht ganz aufgeklappt
  fbKinds: FeedbackKind[];  // Rückmeldung: gewählte Arten
  fbText: string;
  fbFrom: Screen;           // Bildschirm, von dem aus die Rückmeldung geöffnet wurde
  fbMsg: string;
  devTaps: number;
  menuOpen: boolean;        // Handy: Menü von unten aufgeklappt
  pvp: { targets: PvpTarget[] | null; loading: boolean; busy: boolean; error: string; fightsLeft: number | null; immune: boolean };
  squares: Record<ChatSection, { comments: CommentRow[] | null; loading: boolean; at: number; error: string }>;
  newsRows: NewsRow[] | null;
  sayText: string;
  acctEmail: string;        // Spielerkonto: eingegebene Adresse
  acctMsg: string;
  guild: { mine: GuildMine | null | undefined; list: GuildRow[] | null; err: string; confirmLeave: boolean; tags: Map<string, string> };
  resetStep: '' | 'email' | 'code';   // Passwort vergessen: Adresse eingeben, dann Code und neues Passwort
  conflict: RemoteSave | null;  // Server-Stand, wenn beide Geräte weitergespielt haben
  fame: FameRow[] | null;       // echte Spieler aus der Online-Ruhmeshalle
  guideToast: string[];         // Einstieg: gerade geschaffte Schritte / neue Orte
  hint: string;                 // Einstieg: Bildschirm, dessen Ersthinweis gerade gezeigt wird
  confirmGuide: boolean;
}

let state: GameState | null = loadGame();
const prefs = loadPrefs();
const cloud = new Cloud();
const ui: Ui = {
  screen: 'title', flash: [], createName: '', createSpec: 'dunkel', createGender: 'm', createRace: 'mensch', dkRace: null, skillMenu: false, warriors: null, mail: null, listErr: '', mailOpen: null, compose: null, unread: 0, unreadAt: 0, bio: null, bioNews: null, statue: null, ambros: null, blocked: new Set(), blocksList: null, isAdmin: false, repConfirm: '', legalFrom: 'title', delMsg: '', bankMode: '', bounties: null, dice: { info: null, last: null, err: '', busy: false }, aushang: null, fameCat: 'drachen', fameRows: null, wache: { tab: 'reports', reports: null, banned: null, cheats: null, err: '', codes: null, newCodes: [] }, full: null, fullMsg: '', dkPoint: null, dkSpec: null, confirmDelete: false, confirmNew: false, importMsg: '', newCard: null, fullLog: false, fbKinds: [], fbText: '', fbFrom: 'village', fbMsg: '', devTaps: 0, menuOpen: false, pvp: { targets: null, loading: false, busy: false, error: '', fightsLeft: null, immune: false }, squares: { dorfplatz: { comments: null, loading: false, at: 0, error: '' }, gasthaus: { comments: null, loading: false, at: 0, error: '' }, schattenreich: { comments: null, loading: false, at: 0, error: '' }, felsen: { comments: null, loading: false, at: 0, error: '' }, garten: { comments: null, loading: false, at: 0, error: '' }, gilde: { comments: null, loading: false, at: 0, error: '' } }, newsRows: null, sayText: '', acctEmail: '', acctMsg: '', resetStep: '', guild: { mine: undefined, list: null, err: '', confirmLeave: false, tags: new Map() }, conflict: null, fame: null, guideToast: [], hint: '', confirmGuide: false,
};
let root: HTMLElement;

// ---------- Bausteine ----------

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function pct(a: number, b: number): number {
  return Math.max(0, Math.min(100, Math.round((100 * a) / Math.max(1, b))));
}

interface Item { act: string; label: string; key?: string; hint?: string; disabled?: boolean; primary?: boolean; mobileOnly?: boolean; badge?: string; guided?: boolean }
interface Group { title: string; items: Item[]; dock?: boolean }

/** Tastenkürzel im Wort hervorheben, wie damals: "[W]ald" → W unterstrichen und farbig. */
function hotLabel(label: string, key?: string): string {
  if (!key) return esc(label);
  const i = label.toLowerCase().indexOf(key.toLowerCase());
  if (i < 0) return `<b class="hk">${key.toUpperCase()}</b> · ${esc(label)}`;
  return `${esc(label.slice(0, i))}<b class="hk">${esc(label[i])}</b>${esc(label.slice(i + 1))}`;
}

/**
 * Tastenkürzel passen zur deutschen Beschriftung. In anderen Sprachen sucht sich jeder Punkt einen Buchstaben
 * aus seinem eigenen Wort, der auf dem Bildschirm noch frei ist (Ziffern bleiben).
 */
function localKeys(groups: Group[]): Group[] {
  if (lang === 'de') return groups;
  const used = new Set<string>();
  const items = groups.flatMap((g) => g.items);
  const pick = new Map<Item, string>();
  for (const it of items) if (it.key && /^\d$/.test(it.key)) { used.add(it.key); pick.set(it, it.key); }
  // Drei Runden: erst Anfangsbuchstaben der Wörter, dann irgendein Buchstabe aus dem Wort, dann irgendeiner
  const rounds: ((it: Item) => string[])[] = [
    (it) => it.label.toLowerCase().split(/[^a-z]+/).filter(Boolean).map((w) => w[0]),
    (it) => [...it.label.toLowerCase().replace(/[^a-z]/g, '')],
    () => [...'abcdefghijklmnopqrstuvwxyz'],
  ];
  for (const cands of rounds) {
    for (const it of items) {
      if (!it.key || pick.has(it)) continue;
      const k = cands(it).find((c) => !used.has(c));
      if (k) { used.add(k); pick.set(it, k); }
    }
  }
  return groups.map((g) => ({ ...g, items: g.items.map((it) => (it.key ? { ...it, key: pick.get(it) } : it)) }));
}

function navHtml(groups: Group[]): string {
  return groups.map((g) => `<section class="nav-group"><h3>${esc(g.title)}</h3>
    ${g.items.map((it) => `<button type="button" class="nav-link ${it.primary ? 'primary' : ''} ${it.mobileOnly ? 'mobile-only' : ''} ${it.guided ? 'guided' : ''}" data-act="${it.act}" ${it.key ? `data-hotkey="${it.key}"` : ''} ${it.disabled ? 'disabled' : ''}>
      <span>${hotLabel(it.label, it.key)}${it.badge ? ` <em class="badge">${esc(it.badge)}</em>` : ''}</span>${it.hint ? `<small>${esc(it.hint)}</small>` : ''}</button>`).join('')}
  </section>`).join('');
}

function flashHtml(): string {
  if (!ui.flash.length) return '';
  return `<div class="flash log">${ui.flash.map((l) => `<p class="${l.k}">${esc(l.t)}</p>`).join('')}</div>`;
}

function say(t: string, k: LogLine['k'] = 'info'): void {
  ui.flash = [{ t, k }];
}

function bar(v: number, max: number, cls = ''): string {
  return `<div class="bar ${cls}"><i style="width:${pct(v, max)}%"></i></div>`;
}

function vital(s: GameState): string {
  const p = s.player;
  const sp = SPECIALTIES[p.specialty];
  const prev = p.level > 1 ? expNeeded(p.level - 1, p.dragonKills) : 0;
  const need = expNeeded(p.level, p.dragonKills);
  return `<aside class="vital" aria-label="${t`Charakter`}">
    <div class="vital-head">
      <div class="portrait">${heroPortrait(p.race, p.specialty, p.gender)}</div>
      <div>${t`<span class="v-title">${esc(titleFor(p.dragonKills, p.gender))}</span><strong class="v-name">${esc(p.name)}</strong><span class="v-sub">Stufe ${p.level} · ${raceName(p.race, p.gender)} · ${sp.name}</span>`}
        ${p.dragonKills ? `${t`<span class="v-dk">Drachentöter ${p.dragonKills}×</span>`}` : ''}
        ${p.marriedTo ? `${t`<span class="v-wed">♥ verheiratet mit ${PARTNERS[p.marriedTo].name}</span>`}` : ''}</div>
    </div>
    <dl class="vital-list">
      ${p.alive
        ? `<div class="v-row wide"><dt>${t`Lebenspunkte`}</dt><dd>${p.hp} / ${maxHp(p)}</dd>${bar(p.hp, maxHp(p), 'hp')}</div>`
        : `<div class="v-row wide"><dt>${t`Seelenkraft`}</dt><dd>${p.soul} / ${maxSoul(p)}</dd>${bar(p.soul, maxSoul(p), 'soul')}</div>
           <div class="v-row"><dt>${t`Gunst`}</dt><dd class="gem">${p.favor} / ${RESURRECT_FAVOR}</dd></div>
           <div class="v-row"><dt>${t`Schattenkämpfe`}</dt><dd>${p.graveFights}</dd></div>`}
      <div class="v-row wide"><dt>${t`Erfahrung`}</dt><dd>${p.level >= MAX_LEVEL ? t('max.') : `${p.exp} / ${need}`}</dd>${bar(p.exp - prev, need - prev, 'xp')}</div>
      <div class="v-row"><dt>${t`Angriff`}</dt><dd>${attack(p)}</dd></div>
      <div class="v-row"><dt>${t`Verteidigung`}</dt><dd>${defense(p)}</dd></div>
      <div class="v-row"><dt>${t`Gold`}</dt><dd class="gold">${p.gold}</dd></div>
      <div class="v-row"><dt>${t`Edelsteine`}</dt><dd class="gem">${p.gems}</dd></div>
      <div class="v-row"><dt>${t`Waldkämpfe`}</dt><dd>${p.forestFights}</dd></div>
      <div class="v-row"><dt>${sp.name}</dt><dd>${p.specialUses} ${p.specialUses === 1 ? t('Punkt') : t('Punkte')}</dd></div>
      <div class="v-row wide v-gear"><dt>${t`Waffe`}</dt><dd>${WEAPONS[p.weaponTier].name}</dd></div>
      <div class="v-row wide v-gear"><dt>${t`Rüstung`}</dt><dd>${ARMORS[p.armorTier].name}</dd></div>
      ${p.buffs.length ? `<div class="v-row wide v-gear"><dt>${t`Wirkung`}</dt><dd>${p.buffs.map((b) => `${b.name} (${b.rounds})`).join(', ')}</dd></div>` : ''}
    </dl>
  </aside>`;
}

function topbar(s: GameState | null): string {
  return `<header class="topbar">${t`<span class="logo">Brackenwyrm</span>`}
    ${s ? `${t`<span class="day">Spieltag ${s.day} ·`} ${s.player.alive ? t`${s.player.forestFights} Waldkämpfe übrig` : t('im Schattenreich')}</span>` : ''}</header>`;
}

/** Das Grundgerüst jeder Spielseite. */
/**
 * Aktionsleiste für das Handy: fest am unteren Rand, damit die wichtigsten Befehle nie verrutschen.
 * Standard: die erste Gruppe der Navigation (wenn kurz) plus "Zurück"; alles Weitere steckt im Menü.
 */
function dockItems(groups: Group[]): Item[] {
  const all = groups.flatMap((g) => g.items).filter((i) => i.act !== 'delete');
  const first = groups[0]?.items.filter((i) => i.act !== 'delete') ?? [];
  const picked = first.length <= 4 || groups[0]?.dock ? [...first] : [];
  const backItem = all.find((i) => i.act === 'go:village' || i.act === 'after:village');
  if (backItem && !picked.includes(backItem) && picked.length < 5) picked.push(backItem);
  return picked;
}

function dockHtml(items: Item[], needMenu: boolean): string {
  const btn = (it: Item, primary: boolean) => `<button type="button" class="dock-btn ${primary ? 'primary' : ''} ${it.guided ? 'guided' : ''}" data-act="${it.act}" ${it.disabled ? 'disabled' : ''}>
      <span>${hotLabel(it.label, it.key)}${it.badge ? ` <em class="badge">${esc(it.badge)}</em>` : ''}</span>${it.hint ? `<small>${esc(it.hint)}</small>` : ''}</button>`;
  const [main, ...rest] = items;
  const sec = rest.map((it) => btn(it, false));
  if (needMenu) sec.push(`<button type="button" class="dock-btn menu" data-act="menu" aria-expanded="${ui.menuOpen}">${t`☰ Menü`}</button>`);
  // Der Hauptbefehl steht immer ganz unten über die volle Breite: Angreifen, Weiter, Herumstreifen …
  // So bleibt er für den Daumen an derselben Stelle, egal wie viele andere Knöpfe es gibt.
  return `<div class="dock" role="toolbar" aria-label="${t`Aktionen`}">
    ${sec.length ? `<div class="dock-row">${sec.join('')}</div>` : ''}
    ${main ? btn(main, main.primary !== false) : ''}
  </div>`;
}

/** Einstieg: Ziel des aktuellen Schritts (wohin "Hinbringen" führt). */
function stepTarget(s: GameState, st: GuideStep): string {
  if (st.id === 'meister') return canChallengeMaster(s.player) === 'ok' ? 'go:training' : 'go:forest';
  return st.go;
}

/** Einstieg: Orte nach Stufe ausblenden, neue Orte und das aktuelle Ziel markieren. */
function guideGroups(s: GameState, groups: Group[]): Group[] {
  const g = s.guide;
  if (!g) return groups;
  const st = currentStep(s);
  const target = st && g.step >= 0 ? stepTarget(s, st) : '';
  return groups
    .map((gr) => ({ ...gr, items: gr.items.filter((i) => placeOpen(s, i.act)).map((i) => ({
      ...i,
      badge: g.fresh.includes(i.act) ? t('neu') : i.badge,
      guided: !!target && i.act === target && !i.disabled,
    })) }))
    .filter((gr) => gr.items.length);
}

/** Einstieg: geschaffte Schritte und der Hinweis beim ersten Besuch, gleich unter der Überschrift. */
function guideTop(): string {
  const parts: string[] = [];
  if (ui.guideToast.length) parts.push(`<div class="guide-toast" role="status">${ui.guideToast.map((m) => `<p>${esc(m)}</p>`).join('')}</div>`);
  const scr = currentScreen();
  const h = ui.hint === scr && !(scr === 'fight' && state?.fight?.over) ? SCREEN_HINTS[scr] : '';
  if (h) parts.push(`<aside class="first-hint"><span class="first-hint-icon" aria-hidden="true">?</span><p>${esc(h)}</p><button type="button" class="hint-x" data-act="hintclose" aria-label="${t`Hinweis schließen`}">×</button></aside>`);
  return parts.join('');
}

function guideCardHtml(s: GameState): string {
  const g = s.guide;
  if (!g || guideFinished(g) || !prefs.welcomed) return '';
  const n = GUIDE_STEPS.length;
  if (g.step >= n) {
    return `<section class="guide-card done" aria-label="${t`Erste Schritte`}">
      <div class="guide-head">${t`<span>Erste Schritte</span><span>alle geschafft</span>`}</div>
      <h2>${GUIDE_END.title}</h2><p>${GUIDE_END.text}</p>
      <div class="row"><button type="button" class="btn" data-act="guide:end">${t`Auf geht’s`}</button></div></section>`;
  }
  const st = GUIDE_STEPS[g.step];
  const p = s.player;
  const target = stepTarget(s, st);
  let text = st.text;
  let label = st.goLabel;
  if (st.id === 'meister' && target === 'go:training') { text = t('Dein Erfahrungsbalken ist voll! Dein Meister wartet auf dem Trainingsplatz. Besiege ihn, dann steigst du eine Stufe auf.'); label = t('Zum Trainingsplatz'); }
  let tip = '';
  if (target === 'go:forest' && p.forestFights <= 0) tip = t`Für diesen Spieltag sind deine Waldkämpfe aufgebraucht. Der nächste beginnt in ${waitText()}. Bis dahin kannst du im Dorf einkaufen, dich heilen lassen oder ins Gasthaus gehen.`;
  else if (target === 'go:forest' && p.hp < maxHp(p) * 0.35) tip = t('Du bist ziemlich angeschlagen. Lass dich besser erst bei Mirla heilen.');
  const dots = GUIDE_STEPS.map((_, i) => `<i class="${i < g.step ? 'on' : i === g.step ? 'now' : ''}"></i>`).join('');
  return `<section class="guide-card" aria-label="${t`Erste Schritte`}">
    <div class="guide-head">${t`<span>Erste Schritte · ${g.step + 1} von ${n}</span><span class="guide-dots" aria-hidden="true">${dots}</span>`}</div>
    <h2>${st.title}</h2>
    <p>${text}</p>
    ${tip ? `<p class="guide-tip">${tip}</p>` : ''}
    <div class="row"><button type="button" class="tbtn" data-act="${target}">${label}</button>
      <button type="button" class="linkish" data-act="guide:skip">${ui.confirmGuide ? t('Wirklich? Dann siehst du sofort alle Orte. Nochmal tippen.') : t('Einführung überspringen')}</button></div>
  </section>`;
}

function layout(s: GameState, main: string, groups: Group[], cls = ''): string {
  groups = localKeys(guideGroups(s, groups));
  const top = guideTop();
  if (top) main = main.includes('</h1>') ? main.replace('</h1>', `</h1>${top}`) : top + main;
  const dock = dockItems(groups);
  const needMenu = groups.flatMap((g) => g.items).some((i) => !dock.includes(i));
  const n = dock.length + (needMenu ? 1 : 0);
  const rows = (n > 1 ? Math.ceil((n - 1) / 3) : 0) + (n ? 1 : 0);
  return `<div class="shell ${cls} ${n ? 'has-dock' : ''} ${ui.menuOpen ? 'menu-open' : ''}" style="--dock-rows:${rows}">${topbar(s)}
    <nav class="nav" aria-label="${t`Navigation`}">${navHtml(groups)}</nav>
    <main class="main">${main}</main>
    ${vital(s)}
    ${n ? `<div class="nav-backdrop" data-act="menu"></div>${dockHtml(dock, needMenu)}` : ''}
  </div>`;
}

const back: Item = { act: 'go:village', label: t('Zurück ins Dorf'), key: 'd' };

/** Kampfbericht im Stil von damals: Runde für Runde, nichts verschwindet. */
function fightLogHtml(log: LogLine[]): string {
  let out = '';
  let round = -1;
  for (const l of log) {
    const r = l.r ?? round;
    if (r !== round) {
      if (round !== -1) out += '</div>';
      out += `<div class="round">${r > 0 ? `<h4>${t`Runde ${r}`}</h4>` : ''}`;
      round = r;
    }
    out += `<p class="${l.k}">${esc(l.t)}</p>`;
  }
  return out + (round !== -1 ? '</div>' : '');
}

// ---------- Bildschirme ----------

function titleScreen(): string {
  const p = state?.player;
  const art = TITLE_ART
    ? `<figure class="title-art"><img src="${TITLE_ART}" alt="${t`Ein Drache schläft in einer Farnschlucht, über ihm das Dorf im Mondlicht`}" width="1360" height="768"></figure>`
    : `<div class="fanned">${['borkenwolf', 'steintroll', 'irrlicht'].map((id, i) => cardHtml(cardFor(id)!, { cls: `fan fan-${i}`, fx: true })).join('')}</div>`;
  return `<div class="solo">
    <div class="solo-panel">
      <h1 class="title-logo">${t`Brackenwyrm`}</h1>
      <p class="title-def">${t`<span><b>Bracken</b> – Farn, so weit das Auge reicht.</span> <span><b>Wyrm</b> – ein Drache, der darin schläft.</span>`}</p>
      ${art}
      <p class="tagline">${TITLE_SPRUCH}</p>
      ${flashHtml()}
      <div class="solo-nav">${navHtml(localKeys([{ title: t('Willkommen'), items: [
        ...(p ? [{ act: 'continue', label: t`Weiterspielen: ${titleFor(p.dragonKills, p.gender)} ${p.name}`, key: 'w', hint: t`Stufe ${p.level} · Spieltag ${state!.day}` }] : []),
        { act: 'new', label: p && ui.confirmNew ? t('Wirklich neu beginnen? Der alte Spielstand geht verloren.') : t('Neues Spiel beginnen'), key: 'n' },
        ...(cloud.enabled && !cloud.signedIn ? [{ act: 'go:login', label: t('Mit Spielerkonto anmelden'), key: 'k', hint: t('auf einem anderen Gerät weiterspielen') }] : []),
      ] }]))}</div>
      <p class="fine" data-act="devtap">${t`${VERSION} · Tastenkürzel am Computer, Tippen am Handy${prefs.dev ? t(' · Entwicklermodus') : ''}`}</p>
      <p class="fine legal-links"><button type="button" class="linkish" data-act="legal:impressum">${t`Impressum`}</button> · <button type="button" class="linkish" data-act="legal:datenschutz">${t`Datenschutz`}</button>${LANGS.filter((l) => l.id !== lang).map((l) => ` · <button type="button" class="linkish" data-act="lang:${l.id}" lang="${l.id}">${l.name}</button>`).join('')}</p>
    </div>
  </div>`;
}

/** Impressum und Datenschutz: vom Titel aus ohne Spielstand, sonst im normalen Rahmen. */
function legalScreen(kind: 'impressum' | 'datenschutz'): string {
  const title = kind === 'impressum' ? t('Impressum') : t('Datenschutzerklärung');
  const body = `<article class="legal">${legalIncomplete() ? `<p class="warn-box">${t`Hinweis für den Betreiber: In src/content/legal.ts fehlen noch Angaben (in eckigen Klammern).`}</p>` : ''}
    ${kind === 'impressum' ? impressumHtml() : datenschutzHtml()}</article>`;
  const other = kind === 'impressum' ? { act: 'legal:datenschutz', label: t('Datenschutz'), key: 'p' } : { act: 'legal:impressum', label: t('Impressum'), key: 'i' };
  const backAct = ui.legalFrom === 'title' || !state ? 'go:title' : `go:${ui.legalFrom}`;
  if (!state || ui.legalFrom === 'title') {
    return `<div class="solo"><div class="solo-panel legal-panel"><h1 class="legal-title">${title}</h1>${body}
      <div class="row"><button type="button" class="btn ghost" data-act="${backAct}">${t`Zurück`}</button><button type="button" class="btn ghost" data-act="${other.act}">${other.label}</button></div></div></div>`;
  }
  return layout(state, `<h1 class="legal-title">${title}</h1>${body}`, [{ title: t('Rechtliches'), items: [other, { act: backAct, label: t('Zurück'), key: 'z' }] }]);
}

function loginScreen(): string {
  return `<div class="solo"><div class="solo-panel">
    ${accountHtml()}
    <div class="row"><button type="button" class="btn ghost" data-act="go:title">${t`Zurück`}</button></div>
  </div></div>`;
}

/** Rassenwahl mit Bild (zeigt die gerade gewählte Fähigkeit), für Erstellung und Neuanfang. */
function raceChoices(sel: RaceId, spec: SpecialtyId, g: Gender, act: string): string {
  return `<div class="choices race-choices" role="radiogroup" aria-label="${t`Rasse`}">${RACE_ORDER.map((id) => {
    const r = RACES[id];
    return `<button type="button" class="choice ${sel === id ? 'on' : ''}" role="radio" aria-checked="${sel === id}" data-act="${act}:${id}">
      <span class="choice-art">${heroArt(id, spec, g)}</span><strong>${raceName(id, g)}</strong><span class="gold">${r.bonus}</span><small>${r.blurb}</small></button>`;
  }).join('')}</div>`;
}

/** Fähigkeitswahl wie im Original ("Als Kind hast du …"), mit den vier Künsten. */
function specChoices(sel: SpecialtyId, act: string): string {
  return `<div class="choices spec-choices" role="radiogroup" aria-label="${t`Fähigkeit`}">${SPECIALTY_ORDER.map((id) => {
    const sp = SPECIALTIES[id];
    return `<button type="button" class="choice ${sel === id ? 'on' : ''}" role="radio" aria-checked="${sel === id}" data-act="${act}:${id}">
      <span class="muted">${sp.childhood} …</span><strong>${sp.name}</strong><span>${sp.blurb}</span>
      <ul class="skills">${sp.skills.map((k) => `<li><b>${k.name}</b> <i>${k.cost} ${k.cost === 1 ? t('Punkt') : t('Punkte')}</i><br><small>${k.blurb}</small></li>`).join('')}</ul></button>`;
  }).join('')}</div>`;
}

function createScreen(): string {
  return `<div class="solo"><div class="solo-panel">
    <h1>${t`Wer bist du?`}</h1>
    <p class="lead">${t`Du kommst nach <span class="place">Moosgrund</span>, ein Dorf am Rand des Brackenwalds. In der Farnschlucht schläft ein Wyrm. Noch.`}</p>
    ${flashHtml()}
    <label class="field">${t`Dein Name`}<input type="text" id="name" maxlength="20" autocomplete="off" value="${esc(ui.createName)}" placeholder="${ui.createGender === 'f' ? t('z. B. Hilda') : t('z. B. Hagen')}"></label>
    <div class="seg" role="radiogroup" aria-label="${t`Held oder Heldin`}">
      ${(['m', 'f'] as const).map((g) => `<button type="button" class="seg-btn ${ui.createGender === g ? 'on' : ''}" role="radio" aria-checked="${ui.createGender === g}" data-act="gender:${g}">${g === 'm' ? t('Held') : t('Heldin')}</button>`).join('')}
    </div>
    <h2>${t`Woher kommst du?`}</h2>
    ${raceChoices(ui.createRace, ui.createSpec, ui.createGender, 'race')}
    <h2>${t`Was hast du als Kind gemacht?`}</h2>
    ${specChoices(ui.createSpec, 'spec')}
    <p class="guide-tip">${t`Keine Sorge, hier kannst du nichts falsch machen. Rasse und Fähigkeit lassen sich später noch ändern.`}</p>
    <p class="muted">${t`Jeden Tag hast du einen Punkt für deine Fähigkeit. Mit jedem Meister, den du besiegst, wirst du besser darin, und jede dritte Stufe bringt einen Punkt mehr pro Tag.`}</p>
    <div class="row"><button type="button" class="btn" data-act="create">${t`Nach Moosgrund aufbrechen`}</button>
      <button type="button" class="btn ghost" data-act="go:title">${t`Zurück`}</button></div>
  </div></div>`;
}

function villageScreen(s: GameState): string {
  const p = s.player;
  const m = masterForLevel(p.level);
  const mstate = canChallengeMaster(p);
  const found = Object.keys(s.bestiary).filter((k) => k !== 'dragon').length;
  const main = `<h1>${t`Moosgrund`}</h1>
    <p class="lead">${t`Du stehst auf dem Dorfplatz von <span class="place">Moosgrund</span>. Rauch steigt aus den Kaminen, aus dem Gasthaus <span class="place">Zum Schlafenden Wurm</span> klingt Gelächter. Im Norden rauscht der <span class="place">Brackenwald</span>, und irgendwo dahinter schläft der Wyrm.`}</p>
    ${prefs.welcomed ? '' : `<section class="welcome">
      <h2>${t`Danke, dass du testest!`}</h2>
      <p>${t`Brackenwyrm ist noch in Arbeit. Am meisten Spaß macht es, wenn du <strong>jeden Tag ein bisschen</strong> spielst. Zweimal am Tag, um ${dayStarts()[0]} und um ${dayStarts()[1]} Uhr, beginnt ein neuer Spieltag mit frischen Waldkämpfen.`}</p>
      <p>${t`Wenn dir etwas auffällt, ob Fehler, Langeweile, zu schwer oder eine Idee, drück auf <strong>Rückmeldung geben</strong>. Dein Spielstand wird automatisch mitgeschickt, du musst nichts erklären.`}</p>
      <p class="muted">${t`Der Spielstand liegt in diesem Browser. Nicht im privaten Fenster spielen, sonst ist er weg.`}</p>
      <button type="button" class="btn" data-act="welcome">${t`Los geht’s`}</button>
    </section>`}
    ${guideCardHtml(s)}
    <p class="statue">${statueText(s)}</p>
    <p class="clock"><span aria-hidden="true">🕰</span> ${t`Die Dorfuhr: Der nächste Spieltag beginnt in ${waitText()}.`}</p>
    ${(() => { const a = ui.aushang?.[0]; return a && a.id > (prefs.aushangSeen ?? 0) ? `<section class="notice new"><h2>${t`Neu am Rathaus: ${esc(a.title)}`}</h2><p>${esc(a.body).replace(/\n/g, '<br>')}</p><div class="row"><button type="button" class="tbtn" data-act="aushangseen:${a.id}">${t`Gelesen`}</button><button type="button" class="tbtn ghost" data-act="go:aushang">${t`Alle Aushänge`}</button></div></section>` : ''; })()}
    ${flashHtml()}
    ${s.news.length ? `<section class="news"><h2>${t`Neuigkeiten`}</h2>${s.news.slice(-4).map((n) => `<p>${esc(n)}</p>`).join('')}</section>` : ''}
    ${cloud.enabled ? squareHtml() : ''}`;
  return layout(s, main, [
    { title: t('Stadttor'), items: [
      { act: 'go:forest', label: t('Wald'), key: 'w', hint: t`${p.forestFights} Kämpfe übrig` },
      ...(cloud.enabled ? [{ act: 'go:fields', label: t('Felder vor dem Tor'), key: 'f', hint: cloud.signedIn ? t('schlafende Helden') : t('nur mit Spielerkonto'), disabled: !cloud.signedIn }] : []),
    ] },
    { title: t('Dorf'), items: [
      { act: 'go:training', label: t('Trainingsplatz'), key: 't', hint: mstate === 'ok' ? t`${m?.name ?? ''} wartet!` : '' },
      { act: 'go:healer', label: t('Mirlas Kräuterhütte'), key: 'h', hint: p.hp < maxHp(p) ? t`${maxHp(p) - p.hp} LP fehlen` : '' },
      { act: 'go:smith', label: t('Alriks Schmiede'), key: 's' },
      { act: 'go:inn', label: t('Gasthaus'), key: 'g' },
      { act: 'go:bank', label: t('Kontor'), key: 'k', hint: p.bank ? t`${p.bank} Gold` : '' },
      { act: 'go:stable', label: t('Mertens Pferdestall'), key: 'p', hint: p.mount ? MOUNTS[p.mount].name : '' },
      { act: 'go:quirin', label: t('Quirins Tränke'), key: 'q', hint: p.pendingChoice ? t('du musst dich entscheiden') : p.gems ? (p.gems === 1 ? t('1 Edelstein') : t`${p.gems} Edelsteine`) : '' },
    ] },
    { title: t('Am Dorfrand'), items: [
      { act: 'go:lager', label: t('Söldnerlager'), key: 'ö', hint: p.companion ? `${companionDef(p.companion.id)?.name ?? ''}${p.companion.hp <= 0 ? t(' (k. o.)') : ''}` : t('Begleiter anheuern') },
      ...(cloud.enabled ? [{ act: 'go:seer', label: t('Das Zelt der Seherin'), key: 'z', hint: p.seerPaid ? t('bezahlt') : t('mit den Toten reden') }] : []),
      { act: 'go:ambros', label: t('Der alte Ambros'), key: 'a', hint: (p.ambrosGames ?? 0) >= AMBROS_GAMES_PER_DAY ? t('schläft') : t('Zahlenraten') },
      ...(cloud.enabled ? [
        { act: 'go:garten', label: t('Der Rosengarten'), key: 'o' },
        { act: 'go:felsen', label: t('Der Wyrmstein'), key: 'y', hint: p.dragonKills ? t('Drachentöter') : '' },
        { act: 'go:gilde', label: t('Gildenhalle'), key: 'u', hint: !cloud.signedIn ? t('nur mit Spielerkonto') : ui.guild.mine?.guild && ui.guild.mine.rank !== 'applicant' ? `[${ui.guild.mine.guild.tag}]` : '', disabled: !cloud.signedIn },
      ] : []),
    ] },
    { title: t('Sonstiges'), items: [
      { act: 'go:bestiary', label: t('Bestiarium'), key: 'b', hint: `${found} / ${MONSTERS.length}` },
      ...(cloud.enabled ? [{ act: 'go:news', label: t('Tagesneuigkeiten'), key: 'n' }, { act: 'go:aushang', label: t('Aushang am Rathaus'), key: 'x' }] : []),
      { act: 'go:fame', label: t('Ruhmeshalle'), key: 'r' },
      ...(cloud.enabled ? [
        { act: 'go:warriors', label: t('Kriegerliste'), key: 'l', hint: cloud.signedIn ? '' : t('nur mit Spielerkonto'), disabled: !cloud.signedIn },
        { act: 'go:mail', label: t('Briefe'), key: 'i', hint: !cloud.signedIn ? t('nur mit Spielerkonto') : ui.unread ? t`${ui.unread} neu` : '', disabled: !cloud.signedIn },
      ] : []),
      { act: 'go:chronicle', label: t('Kampfchronik'), key: 'c', hint: s.chronicle.length ? t`${s.chronicle.length} Kämpfe` : '' },
      { act: 'go:settings', label: t('Einstellungen'), key: 'e' },
      { act: 'feedback', label: t('Rückmeldung geben'), key: 'm' },
    ] },
  ]);
}

function eventScreen(s: GameState): string {
  const pe = s.pendingEvent!;
  const ev = eventById(pe.id);
  const p = s.player;
  const main = `<h1>${t`Der Brackenwald`}</h1>
    <div class="event-box log">${pe.lines.map((l) => `<p class="${l.k}">${esc(l.t)}</p>`).join('')}</div>
    <p class="muted">${t`Was tust du?`}</p>`;
  return layout(s, main, [{ title: t('Entscheidung'), items: (ev?.choices ?? []).map((c, i) => ({
    act: `event:${c.id}`, label: c.labelFor ? c.labelFor(pe.data) : c.label, key: c.key, hint: c.hint?.(p), disabled: !!c.available && !c.available(p), primary: ev?.neutral ? false : i === 0,
  })) }], 'in-fight');
}

function forestScreen(s: GameState): string {
  const p = s.player;
  if (s.pendingEvent) return eventScreen(s);
  const low = p.hp < maxHp(p) * 0.4;
  const main = `<h1>${t`Der Brackenwald`}</h1>
    <p class="lead">${t`Zwischen den Stämmen ist es still. Farne reichen dir bis zur Hüfte, und irgendwo knackt ein Ast.`}</p>
    ${flashHtml()}
    ${low ? `<p class="warn-box">${t`Du bist angeschlagen (${p.hp} von ${maxHp(p)} Lebenspunkten). Mirla in der Kräuterhütte könnte helfen.`}</p>` : ''}
    ${p.forestFights <= 0 ? `<p class="warn-box">${t`Du bist zu müde für weitere Abenteuer. Der nächste Spieltag beginnt in ${waitText()}.`}</p>` : ''}`;
  const none = p.forestFights <= 0;
  return layout(s, main, [
    { title: t('Wald'), items: [
      { act: 'forest:normal', label: t('Herumstreifen'), key: 'h', hint: t('Gegner deiner Stufe'), disabled: none, primary: true },
      { act: 'forest:easy', label: t('Leichte Beute suchen'), key: 'l', hint: t('schwächer, weniger Lohn'), disabled: none },
      { act: 'forest:hard', label: t('Nervenkitzel suchen'), key: 'n', hint: t('stärker, mehr Lohn'), disabled: none },
      ...(p.level >= MAX_LEVEL ? [{ act: 'dragon', label: t('Den Brackenwyrm suchen'), key: 'b', hint: t('Endkampf'), disabled: !canSeekDragon(p) }] : []),
      ...(p.festeFound ? [{ act: 'go:feste', label: t('Zur versunkenen Feste'), key: 'f', hint: p.level < FESTE_MIN_LEVEL ? t`ab Stufe ${FESTE_MIN_LEVEL}` : p.festeDay === gameDayKey() ? (s.feste && !s.feste.over ? t('du bist drin') : t('heute schon')) : t`${FESTE_COST} Waldkämpfe` }] : []),
    ] },
    { title: t('Zurück'), items: [back] },
  ]);
}

function fightScreen(s: GameState): string {
  const f = s.fight!;
  const p = s.player;
  const c = f.kind === 'dragon' ? dragonCard() : f.kind === 'master' ? masterCard(f.foe.level) : f.kind === 'grave' ? shadeCard(f.monsterId)!
    : f.kind === 'pvp' ? pvpCard(f.foe.name, f.foe.level, f.foeRace ?? 'mensch', f.foeSpec ?? 'dunkel', f.foeGender ?? 'm') : cardFor(f.monsterId)!;
  const acted = f.seq > 0;
  const heroAttacked = acted && (f.lastHeroDmg > 0 || f.lastHeroMiss);
  const foeAttacked = acted && (f.lastFoeDmg > 0 || f.lastFoeMiss);
  const from = pct(Math.min(f.foe.maxHp, f.foe.hp + f.lastHeroDmg), f.foe.maxHp);
  const cls = [
    f.lastHeroDmg > 0 ? 'is-hit' : '',
    f.lastCrit ? 'is-crit' : '',
    f.lastSpecial ? 'is-special' : '',
    foeAttacked ? 'is-attacking' : '',
    f.over === 'win' ? 'is-defeated' : '',
  ].join(' ');
  const sp = SPECIALTIES[p.specialty];
  const card = cardHtml(c, { hp: [f.foe.hp, f.foe.maxHp, from], cls, fx: true });
  const fx = `${heroAttacked ? `<div class="dmg dmg-foe ${f.lastCrit ? 'crit' : ''}">${f.lastHeroMiss ? t('Daneben') : '−' + f.lastHeroDmg}</div>` : ''}
    ${foeAttacked ? `<div class="dmg dmg-hero">${f.lastFoeMiss ? t('Ausgewichen') : '−' + f.lastFoeDmg + t(' LP')}</div>` : ''}
    ${f.over === 'win' ? `<div class="stamp">${t`Besiegt`}</div>` : ''}`;
  const isNew = f.over === 'win' && (f.kind === 'forest' || f.kind === 'grave' || f.kind === 'feste') && s.bestiary[f.monsterId] === 1;

  let groups: Group[] = [];
  if (!f.over) {
    // Wie im Original: die Künste stehen unter dem Namen der Fähigkeit mit den Punkten, nur die bezahlbaren sind nutzbar.
    const pts = `${p.specialUses} ${p.specialUses === 1 ? t('Punkt') : t('Punkte')}`;
    const skillItems: Item[] = f.kind === 'grave' ? [] : sp.skills.map((k, i) => ({
      act: `fight:skill:${k.cost}`, label: k.name, key: String(i + 1), hint: `${k.cost} ${k.cost === 1 ? t('Punkt') : t('Punkte')}`, disabled: p.specialUses < k.cost,
    }));
    const fightItems: Item[] = [
      { act: 'fight:attack', label: t('Angreifen'), key: 'a', primary: true },
      ...(skillItems.length ? [{ act: 'skills', label: sp.name, key: 's', hint: pts, mobileOnly: true }] : []),
      ...(f.kind !== 'master' ? [{ act: 'fight:auto', label: t('Kämpfen bis zum Ende'), key: 'k' }] : []),
      { act: 'fight:flee', label: f.kind === 'master' ? t('Aufgeben') : t('Fliehen'), key: f.kind === 'master' ? 'u' : 'f' },
    ];
    const skillGroup = { title: `${sp.name} · ${pts}`, items: skillItems };
    groups = ui.skillMenu && skillItems.length
      ? [{ title: skillGroup.title, dock: true, items: [...skillItems.map((it, i) => ({ ...it, primary: i === 0 && !it.disabled })), { act: 'skills', label: t('Zurück'), key: 'z', mobileOnly: true }] }, { title: t('Kampf'), items: fightItems }]
      : [{ title: t('Kampf'), items: fightItems }, ...(skillItems.length ? [skillGroup] : [])];
  } else {
    const items: Item[] = [];
    if (f.kind === 'pvp') {
      if (f.over === 'win') {
        items.push(f.pvpPlace === 'gasthaus' ? { act: 'after:inn', label: t('Zurück in die Gaststube'), key: 'g' } : { act: 'after:fields', label: t('Zurück auf die Felder'), key: 'f' });
        items.push({ act: 'after:village', label: t('Zurück ins Dorf'), key: 'd' });
      } else {
        items.push({ act: 'after:shadows', label: t('Ins Schattenreich'), key: 'w' });
      }
    } else if (f.kind === 'grave') {
      if (f.over === 'win') items.push({ act: 'after:grave', label: t('Weiter am Nebelfluss'), key: 'w', hint: t`${p.graveFights} Schattenkämpfe`, disabled: p.graveFights <= 0 });
      items.push({ act: 'after:shadows', label: t('Zurück zu Morwen'), key: 'm' });
    } else if (f.kind === 'forest' && f.over !== 'lose') {
      items.push({ act: 'after:forest', label: t('Weiter durch den Wald'), key: 'w', hint: t`${p.forestFights} Kämpfe übrig`, disabled: p.forestFights <= 0 });
      items.push({ act: 'after:village', label: t('Zurück ins Dorf'), key: 'd' });
    } else if (f.kind === 'master') {
      items.push({ act: 'after:training', label: t('Zurück zum Trainingsplatz'), key: 't' });
      items.push({ act: 'after:village', label: t('Zurück ins Dorf'), key: 'd' });
    } else if (f.kind === 'dragon' && f.over === 'win') {
      items.push({ act: 'after:bonus', label: t('Weiter'), key: 'w' });
    } else if (f.kind === 'feste' && f.over !== 'lose') {
      items.push({ act: 'after:feste', label: f.monsterId === 'hueter' && f.over === 'win' ? t('In die Schatzkammer') : t('Weiter durch die Feste'), key: 'w' });
    } else if (f.over === 'fled') {
      items.push({ act: 'after:forest', label: t('Zurück in den Wald'), key: 'w' });
      items.push({ act: 'after:village', label: t('Zurück ins Dorf'), key: 'd' });
    } else {
      items.push({ act: 'after:shadows', label: t('Ins Schattenreich'), key: 'w' });
    }
    if (items[0]) items[0].primary = true;
    groups = [{ title: t('Weiter'), items }];
  }

  const main = `<div class="battle">
      <div class="arena ${f.kind}">${card.replace('</figure>', `${isNew ? `<div class="card-new">${t`Neu`}</div>` : ''}</figure>`)}${fx}</div>
      <div class="battle-side">
        <h1 class="foe-title">${esc(f.foe.name)}</h1>
        ${(() => { const cp = p.companion; const cd = cp && companionDef(cp.id); if (!cp || !cd) return ''; const on = f.kind === 'forest' || f.kind === 'feste';
          return `<p class="companion-line ${cp.hp <= 0 || !on ? 'off' : ''}">${esc(cd.name)} (${cd.role}): ${!on ? t('wartet draußen') : cp.hp <= 0 ? t('k. o.') : t`${cp.hp} / ${cp.maxHp} LP`}</p>`; })()}
        <div class="log fight-log ${ui.fullLog ? 'open' : ''}" aria-live="polite">${fightLogHtml(f.log)}</div>
        ${f.round > 2 ? `<button type="button" class="log-toggle" data-act="fulllog">${ui.fullLog ? t('Bericht einklappen') : t`Ganzen Kampf anzeigen (${f.round} Runden)`}</button>` : ''}
        ${prefs.fightHint || s.guide ? '' : `<p class="hint-desk">${t`Deine Befehle stehen links, wie früher. Taste <b class="hk">A</b> greift an, <b class="hk">K</b> kämpft bis zum Ende.`}</p>`}
      </div>
    </div>`;
  return layout(s, main, groups, 'in-fight');
}

function trainingScreen(s: GameState): string {
  const p = s.player;
  const m = masterForLevel(p.level);
  const st = canChallengeMaster(p);
  const need = expNeeded(p.level, p.dragonKills);
  let text = '';
  if (st === 'max' || !m) {
    text = `<p class="lead">${t`Kein Meister in Moosgrund kann dir noch etwas beibringen. Nur einer wartet noch: der <span class="place">Brackenwyrm</span> in der Farnschlucht.`}</p>`;
  } else {
    const line = st === 'ok' ? m.greeting : st === 'seen' ? t`${m.name} winkt ab. „Für heute reicht’s. Komm morgen wieder.“` : m.notReady;
    text = `<div class="speaker">${cardHtml(masterCard(p.level), { cls: 'mini', fx: true })}<div>
      <p class="lead">${esc(line)}</p>
      ${st === 'notReady' ? `<p class="muted">${t`Dir fehlen noch ${need - p.exp} Erfahrungspunkte.`}</p>` : ''}</div></div>`;
  }
  return layout(s, `<h1>${t`Der Trainingsplatz`}</h1>${flashHtml()}${text}`, [
    { title: t('Training'), items: m && st !== 'max' ? [{ act: 'master', label: t`${m.name} herausfordern`, key: 'm', disabled: st !== 'ok', hint: st === 'seen' ? t('morgen wieder') : st === 'ok' ? t`Aufstieg auf Stufe ${p.level + 1}` : t('noch nicht bereit') }] : [] },
    { title: t('Zurück'), items: [back] },
  ]);
}

function healerScreen(s: GameState): string {
  const p = s.player;
  const missing = maxHp(p) - p.hp;
  const full = healCost(p, missing);
  const half = healCost(p, Math.ceil(missing / 2));
  const main = `<h1>${t`Mirlas Kräuterhütte`}</h1>
    <p class="lead">${missing <= 0 ? t('Mirla mustert dich. „Dir fehlt nichts. Raus mit dir, ich hab zu tun.“') : `${t`Mirla schnalzt mit der Zunge. „${missing} Lebenspunkte fehlen dir. Wenn ich alles heile, macht das <span class="gold">${full} Gold</span>.“`}`}</p>
    <p class="muted">${t`Preis auf deiner Stufe: ${healCostPerHp(p.level).toFixed(2).replace('.', ',')} Gold pro Lebenspunkt.`}</p>
    ${flashHtml()}`;
  return layout(s, main, [
    { title: t('Heilen'), items: [
      { act: 'heal:full', label: t('Vollständig heilen'), key: 'v', hint: t`${full} Gold`, disabled: missing <= 0 || p.gold < full },
      { act: 'heal:half', label: t('Teilweise heilen'), key: 't', hint: t`${half} Gold`, disabled: missing <= 0 || p.gold < half },
    ] },
    { title: t('Zurück'), items: [back] },
  ]);
}

function smithScreen(s: GameState): string {
  const p = s.player;
  const table = (kind: 'weapon' | 'armor') => {
    const list = kind === 'weapon' ? WEAPONS : ARMORS;
    const curTier = kind === 'weapon' ? p.weaponTier : p.armorTier;
    const cur = list[curTier];
    const to = Math.min(list.length - 1, Math.max(curTier + 4, p.level + 1));
    const rows = list.slice(curTier, to + 1).map((it) => {
      const owned = it.tier === curTier;
      const cost = it.price - tradeIn(cur);
      return `<tr class="${owned ? 'owned' : ''}"><td>${it.name}</td><td class="num">+${it.value}</td><td class="num">${owned ? '–' : cost}</td>
        <td class="num">${owned ? t('deins') : `<button type="button" class="tbtn" data-act="buy:${kind}:${it.tier}" ${p.gold < cost ? 'disabled' : ''}>${t`Kaufen`}</button>`}</td></tr>`;
    }).join('');
    return `<div class="scroll-x"><table><thead><tr><th>${kind === 'weapon' ? t('Waffe') : t('Rüstung')}</th><th class="num">${kind === 'weapon' ? t('Angriff') : t('Schutz')}</th><th class="num">${t`Gold*`}</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
  };
  const main = `<h1>${t`Alriks Schmiede`}</h1>
    <p class="lead">${t`Funken stieben. „Gutes Eisen rettet Leben“, brummt Alrik. „Dein altes Zeug nehm ich in Zahlung, halber Preis.“`}</p>
    ${flashHtml()}${table('weapon')}${table('armor')}
    <p class="muted small">${t`* Preis nach Eintausch deiner jetzigen Ausrüstung.`}</p>`;
  return layout(s, main, [{ title: t('Zurück'), items: [back] }]);
}

function bankScreen(s: GameState): string {
  const p = s.player;
  const main = `<h1>${t`Das Kontor`}</h1>
    <p class="lead">${t`Ansgar zählt Münzen, die nicht ihm gehören. „Was hier liegt, verlierst du nicht im Wald. Und über Nacht gibt’s Zinsen.“`}</p>
    ${flashHtml()}
    <p>${p.bank >= 0 ? `${t`Im Kontor: <span class="gold">${p.bank} Gold</span>`}` : `${t`<span class="bad">Schulden: ${-p.bank} Gold</span> (wachsen über Nacht mit dem Zins)`}`} ${t`· Dabei: <span class="gold">${p.gold} Gold</span>`}</p>
    <div class="row"><input type="number" id="amount" min="1" inputmode="numeric" placeholder="${t`Betrag`}" aria-label="${t`Betrag`}">
      <button type="button" class="tbtn" data-act="bank:dep:input">${t`Einzahlen`}</button>
      <button type="button" class="tbtn" data-act="bank:wd:input">${t`Abheben`}</button>
      ${ui.bankMode === 'loan' ? `<button type="button" class="tbtn" data-act="bank:loan:input">${t`Leihen`}</button>` : ''}</div>
    ${ui.bankMode === 'loan' ? `<p class="muted">${t`Ansgar leiht dir auf deiner Stufe bis zu ${LOAN_PER_LEVEL * p.level} Gold. Einzahlen tilgt die Schulden. Nach dem Drachen sind sie vergessen.`}</p>` : ''}
    ${ui.bankMode === 'transfer' ? transferHtml(s) : ''}`;
  return layout(s, main, [
    { title: t('Kontor'), items: [
      { act: 'bank:dep:all', label: t('Alles einzahlen'), key: 'e', disabled: p.gold <= 0 },
      { act: 'bank:wd:all', label: t('Alles abheben'), key: 'a', disabled: p.bank <= 0 },
      { act: 'bankmode:loan', label: t('Kredit aufnehmen'), key: 'k', hint: t`bis ${LOAN_PER_LEVEL * p.level} Gold`, disabled: p.bank > 0 },
      ...(cloud.enabled ? [{ act: 'bankmode:transfer', label: t('Gold überweisen'), key: 'w', hint: !cloud.signedIn ? t('nur mit Spielerkonto') : p.level < 3 && !p.dragonKills ? t('ab Stufe 3') : t('an andere Helden'), disabled: !cloud.signedIn || (p.level < 3 && !p.dragonKills) }] : []),
    ] },
    { title: t('Zurück'), items: [back] },
  ]);
}

/** Überweisen: Empfänger aus der Kriegerliste, Betrag aus dem Kontor (Grenzen wie im Original). */
function transferHtml(s: GameState): string {
  const p = s.player;
  const others = (ui.warriors ?? []).filter((w) => w.userId !== cloud.userId);
  return `<section class="good-box"><h2>${t`Gold überweisen`}</h2>
    <p class="muted">${t`Vom Konto im Kontor. Je Überweisung höchstens 25 Gold je Stufe des Empfängers, am Tag höchstens ${25 * p.level} Gold. Jeder bekommt höchstens drei Überweisungen am Tag.`}</p>
    ${ui.warriors === null ? `<p class="muted">${t`Ansgar blättert in der Kriegerliste …`}</p>` : `<div class="row">
      <select id="tf-to" aria-label="${t`Empfänger`}">${others.map((w) => `<option value="${w.userId}">${t`${esc(w.name)} (Stufe ${w.level}, bis ${25 * w.level} Gold)`}</option>`).join('')}</select>
      <input type="number" id="tf-amount" min="1" inputmode="numeric" placeholder="${t`Betrag`}" aria-label="${t`Betrag`}">
      <button type="button" class="tbtn" data-act="transfer">${t`Überweisen`}</button></div>`}
  </section>`;
}

const RUMORS = [
  t('„Der Wyrm träumt“, sagt ein alter Holzfäller. „Und wenn er träumt, wachsen die Farne schneller.“'),
  t('Zwei Jäger streiten, ob Eulenbären Eier legen. Keiner will es herausfinden.'),
  t('„Mirla hat mal einen Troll geheilt“, flüstert jemand. „Er schuldet ihr heute noch Geld.“'),
  t('Florian probt ein neues Lied. Es reimt „Wyrm“ auf „Schirm“. Niemand ist begeistert.'),
  t('Am Nebentisch prahlt ein Söldner mit einem Kampf gegen den Bergtrollkönig. Seine Hände zittern.'),
  t('„Wer im Pilzring tanzt, verliert die Zeit“, sagt Frieda. „Oder findet welche.“'),
];

function innScreen(s: GameState): string {
  const p = s.player;
  const main = `<h1>${t`Zum Schlafenden Wurm`}</h1>
    <p class="lead">${t`Das Feuer knistert. Wirtin <span class="npc">Frieda</span> poliert ein Glas, das davon nicht sauberer wird. In der Ecke stimmt Barde <span class="npc">Florian</span> seine Laute.`}</p>
    <p class="rumor">${esc(RUMORS[s.day % RUMORS.length])}</p>
    ${flashHtml()}
    ${cloud.enabled && p.innRoom ? `<p class="muted">${t`Du hast für heute ein Zimmer. Wenn du jetzt aufhörst zu spielen, schläfst du hier sicherer als draußen auf den Feldern.`}</p>` : ''}
    <section class="table-talk"><h2>${t`Am Stammtisch`}</h2>
      ${regularsSay(s).map((l) => `<p><span class="npc">${esc(l.who.charAt(0).toUpperCase() + l.who.slice(1))}:</span> ${esc(l.t)}</p>`).join('')}
    </section>
    ${cloud.enabled ? squareHtml('gasthaus') : ''}`;
  const talksLeft = FRIEDA_TALKS_PER_DAY - p.innTalks;
  return layout(s, main, [
    { title: t('Gasthaus'), items: [
      { act: 'talk', label: t('Mit Frieda reden'), key: 'f', hint: talksLeft > 0 ? t`${talksLeft}× heute` : t('hat zu tun') },
      { act: 'go:tresen', label: t('Am Tresen bestellen'), key: 't', hint: (p.drunk ?? 0) > 0 ? drunkWord(p.drunk ?? 0) : t`Harzbier ${harzbierCost(p.level)} Gold` },
      ...(cloud.enabled ? [
        { act: 'go:dag', label: t('Veit Galgenstrick'), key: 'k', hint: !cloud.signedIn ? t('nur mit Spielerkonto') : t('Kopfgeld'), disabled: !cloud.signedIn },
        { act: 'go:fivesix', label: t('Würfelecke: Sechserjagd'), key: 'w', hint: !cloud.signedIn ? t('nur mit Spielerkonto') : t('Jackpot'), disabled: !cloud.signedIn },
      ] : []),
      { act: 'inn:song', label: t('Lied wünschen'), key: 'l', hint: p.songToday ? t('heute schon') : t('1 Edelstein'), disabled: p.songToday },
      { act: 'go:flirt', label: p.marriedTo ? t`Zu ${PARTNERS[p.marriedTo].name} gehen` : t`${PARTNERS[partnerOf(p)].name} umwerben`, key: 'u', hint: p.seenLover ? t('heute schon') : p.marriedTo ? t('dein Schatz') : '' },
      { act: 'looks', label: t`${PARTNERS[friendOf(p)].name} fragen, wie du aussiehst`, key: 'a' },
      ...(cloud.enabled ? [
        { act: 'room', label: t('Zimmer mieten'), key: 'z', hint: p.innRoom ? t('gemietet') : t`${roomCost(p.level)} Gold`, disabled: p.innRoom },
        { act: 'bribe', label: t('Frieda bestechen'), key: 'b', hint: cloud.signedIn ? t('1 Edelstein') : t('nur mit Spielerkonto'), disabled: !cloud.signedIn || p.gems < 1 },
      ] : []),
    ] },
    { title: t('Zurück'), items: [back] },
  ]);
}

function tresenScreen(s: GameState): string {
  const p = s.player;
  const drunk = p.drunk ?? 0;
  const main = `<h1>${t`Am Tresen`}</h1>
    <p class="lead">${t`Frieda wischt den Tresen ab und schaut dich über den Rand ihres Glases an. „Was darf’s sein?“`}</p>
    ${flashHtml()}
    <div class="drunk-meter">${t`<span>Du bist ${drunkWord(drunk)}</span>`}<div class="progress">${bar(drunk, 100, drunk >= MAX_DRUNK ? 'hp low' : 'favor')}</div></div>
    <ul class="potions">${DRINKS.map((d) => `<li><strong>${d.name}</strong> <span class="gold">${d.costPerLevel ? t`${drinkCost(d, p.level)} Gold` : t('umsonst')}</span>${d.hard ? ` <span class="tag">${t('hart')}</span>` : ''}<br><small class="muted">${d.blurb}</small></li>`).join('')}</ul>
    <p class="muted">${t`Ab „sturzbetrunken“ schenkt Frieda nichts mehr aus, und wer so ins Bett geht, hat morgen einen Kater. Betrunken lallst du auch in den Gesprächen.`}</p>`;
  return layout(s, main, [
    { title: t('Bestellen'), items: DRINKS.map((d, i) => ({
      act: `drink:${d.id}`, label: d.name, key: String(i + 1), hint: d.costPerLevel ? t`${drinkCost(d, p.level)} Gold` : t('umsonst'),
      disabled: (d.drunk > 0 && drunk >= MAX_DRUNK) || p.gold < drinkCost(d, p.level) || (!!d.hard && (p.hardDrinks ?? 0) >= 2) || (d.id === 'quellwasser' && drunk <= 0),
    })) },
    { title: t('Zurück'), items: [{ act: 'go:inn', label: t('Zurück in die Gaststube'), key: 'g' }, back] },
  ]);
}

function dagScreen(s: GameState): string {
  const p = s.player;
  const list = ui.bounties;
  const onMe = list?.find((b) => b.target === cloud.userId);
  const others = (ui.warriors ?? []).filter((w) => w.userId !== cloud.userId && w.level >= 3);
  const main = `<h1>${t`Veit Galgenstrick`}</h1>
    <p class="lead">${t`In der dunkelsten Ecke des Gasthauses sitzt Veit Galgenstrick, Kopfgeldjäger, und raucht eine Pfeife, die nach nassem Hund riecht. „Du willst, dass jemandem etwas zustößt?“, brummt er. „Gegen Gold lässt sich das einrichten. Wer den Kopf bringt, kassiert. Ich behalte zehn Prozent.“`}</p>
    ${flashHtml()}
    ${onMe ? `<p class="warn-box">${t`Veit mustert dich. „Auf deinen Kopf sind übrigens ${onMe.total} Gold ausgesetzt. Schlaf lieber im Gasthaus.“`}</p>` : ''}
    <h2>${t`Offene Kopfgelder`}</h2>
    ${list === null ? `<p class="muted">${t`Veit blättert in seinem fleckigen Büchlein …`}</p>` : list.length
      ? `<table class="fame"><thead><tr><th>${t`Held`}</th><th class="num">${t`Stufe`}</th><th class="num">${t`Kopfgeld`}</th></tr></thead><tbody>${list.map((b) => `<tr class="${b.target === cloud.userId ? 'me' : ''}"><td><strong>${esc(b.name)}</strong><small>${esc(titleFor(b.dragon_kills, b.gender))}</small></td><td class="num">${b.level}</td><td class="num gold">${b.total}</td></tr>`).join('')}</tbody></table>`
      : `<p class="muted">${t`Gerade hat niemand einen Preis auf dem Kopf. Langweilige Zeiten.`}</p>`}
    <h2>${t`Kopfgeld aussetzen`}</h2>
    ${ui.warriors === null ? '<p class="muted">…</p>' : others.length ? `<div class="row">
      <select id="bounty-to" aria-label="${t`Auf wen`}">${others.map((w) => `<option value="${w.userId}">${t`${esc(w.name)} (Stufe ${w.level}: ${50 * w.level} bis ${200 * w.level} Gold)`}</option>`).join('')}</select>
      <input type="number" id="bounty-amount" min="1" inputmode="numeric" placeholder="${t`Betrag`}" aria-label="${t`Betrag`}">
      <button type="button" class="tbtn" data-act="bounty">${t`Aussetzen`}</button></div>
      <p class="muted">${t`Dazu kommen 10 % für Veit. Höchstens fünf Aufträge am Tag. Ziele ab Stufe 3. Du hast ${p.gold} Gold dabei.`}</p>`
      : `<p class="muted">${t`Niemand ab Stufe 3 da, auf den man Veit ansetzen könnte.`}</p>`}`;
  return layout(s, main, [{ title: t('Zurück'), items: [{ act: 'go:inn', label: t('Zurück in die Gaststube'), key: 'g' }, back] }]);
}

const DIE = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

function fivesixScreen(s: GameState): string {
  const d = ui.dice;
  const info = d.info;
  const last = d.last;
  const main = `<h1>${t`Sechserjagd`}</h1>
    <p class="lead">${t`Am Ecktisch klappert ein alter Würfelbecher. „Fünf Würfel“, erklärt der Wirt vom Dienst, „fünf Sechser, und der ganze Topf gehört dir. Vier Sechser: ein Zehntel. Drei: ein Zwanzigstel. Jeder Wurf kommt in den Topf.“`}</p>
    ${flashHtml()}${d.err ? `<p class="warn-box">${esc(d.err)}</p>` : ''}
    <div class="jackpot">${t`<span>Im Topf</span><strong>${info ? info.pot : '…'} Gold</strong>`}</div>
    ${last ? `<div class="dice" aria-label="${t`Gewürfelt: ${last.dice.join(', ')}`}">${last.dice.map((x) => `<span class="die ${x === 6 ? 'six' : ''}">${DIE[x - 1]}</span>`).join('')}</div>
      <p class="${last.win ? 'gold' : 'muted'}">${last.sixes === 5 ? t`FÜNF SECHSER! Der ganze Topf gehört dir: ${last.win} Gold!` : last.win ? t`${last.sixes} Sechser! Du bekommst ${last.win} Gold.` : t`${last.sixes === 1 ? t('Ein Sechser') : last.sixes ? t`${last.sixes} Sechser` : t('Kein einziger Sechser')}. Das reicht nicht.`}</p>` : ''}
    ${info ? `<p class="muted">${t`Ein Wurf kostet ${info.cost} Gold. Heute noch ${info.plays_left} Würfe.`}</p>
      <h2>${t`Zuletzt gewonnen`}</h2>
      <ul class="plain">
        <li>${t`Fünf Sechser:`} ${info.last5 ? t`${esc(info.last5)} (${info.last5_pot} Gold)` : t('noch nie! Du könntest der Erste sein.')}</li>
        <li>${t`Vier Sechser:`} ${info.last4 ? t`${esc(info.last4)} (${info.last4_pot} Gold)` : t('noch niemand')}</li>
        <li>${t`Drei Sechser:`} ${info.last3 ? t`${esc(info.last3)} (${info.last3_pot} Gold)` : t('noch niemand')}</li>
      </ul>` : ''}`;
  const left = info?.plays_left ?? 0;
  return layout(s, main, [
    { title: t('Würfeln'), items: [{ act: 'roll', label: last ? t('Nochmal würfeln') : t('Würfeln'), key: 'w', hint: info ? t`${info.cost} Gold` : '', primary: true, disabled: !info || d.busy || left <= 0 || s.player.gold < (info?.cost ?? 0) }] },
    { title: t('Zurück'), items: [{ act: 'go:inn', label: t('Zurück in die Gaststube'), key: 'g' }, back] },
  ]);
}

function aushangScreen(s: GameState): string {
  const list = ui.aushang;
  const main = `<h1>${t`Aushang am Rathaus`}</h1>
    <p class="lead">${t`Neben der Tür des Rathauses hängt ein schwarzes Brett. Hier schlägt die Wache an, was alle wissen sollten.`}</p>
    ${list === null ? '<p class="muted">…</p>' : list.length ? list.map((a) => `<article class="notice"><h2>${esc(a.title)}</h2><p class="muted">${when(a.created_at)} · ${esc(a.author)}</p><p>${esc(a.body).replace(/\n/g, '<br>')}</p></article>`).join('')
      : `<p class="muted">${t`Das Brett ist leer. Nur ein rostiger Nagel.`}</p>`}`;
  return layout(s, main, [{ title: t('Zurück'), items: [back] }]);
}

function loadAushang(): void {
  if (!cloud.enabled) return;
  cloud.aushang(10).then((r) => { ui.aushang = r; }, () => { ui.aushang = ui.aushang ?? []; }).finally(() => { if (['village', 'aushang', 'wache'].includes(currentScreen())) render(); });
}

function loadGuild(): void {
  const g = ui.guild;
  g.err = '';
  Promise.all([cloud.guildMine(), cloud.guildList()]).then(([mine, list]) => { g.mine = mine; g.list = list; if (mine && mine.rank !== 'applicant') loadSquare('gilde', true); },
    (e) => { g.mine = null; g.list = g.list ?? []; g.err = e instanceof CloudError ? e.message : t('Die Gildenhalle ist verschlossen.'); })
    .finally(() => { if (currentScreen() === 'gilde') render(); });
}

const GUILD_COST = 3000;

function rankName(r: GuildMember['rank'], g: Gender): string {
  if (r === 'leader') return g === 'f' ? t('Gildenmeisterin') : t('Gildenmeister');
  if (r === 'officer') return g === 'f' ? t('Offizierin') : t('Offizier');
  if (r === 'applicant') return g === 'f' ? t('Bewerberin') : t('Bewerber');
  return t('Mitglied');
}

function gildeScreen(s: GameState): string {
  const p = s.player;
  const g = ui.guild;
  const mine = g.mine;
  const back = { act: 'go:village', label: t('Zurück ins Dorf'), key: 'd' };
  const lead = `<p class="lead">${t`Am Rand des Dorfplatzes steht ein altes Fachwerkhaus. An der Tür hängen die Wappen der Gilden von Moosgrund, und von drinnen hört man Lachen, Pläne und das Klappern von Würfeln.`}</p>`;
  if (mine === undefined) return layout(s, `<h1>${t`Die Gildenhalle`}</h1>${lead}<p class="muted">${t`Der Hausmeister sucht den Schlüssel …`}</p>`, [{ title: t('Zurück'), items: [back] }]);
  const err = g.err ? `<p class="warn-box">${esc(g.err)}</p>` : '';
  if (!mine || mine.rank === 'applicant') {
    const canFound = p.level >= 5 || p.dragonKills > 0;
    const list = g.list === null ? '<p class="muted">…</p>' : g.list.length
      ? `<table class="fame"><thead><tr><th>${t`Gilde`}</th><th class="num">${t`Mitglieder`}</th><th></th></tr></thead><tbody>${g.list.map((x) => `<tr class="${mine?.guild.id === x.id ? 'me' : ''}"><td><strong>${esc(x.name)}</strong> <span class="g-tag">[${esc(x.tag)}]</span>${x.leader ? `<small>${t`Gildenmeister: ${esc(x.leader)}`}</small>` : ''}</td><td class="num">${x.members}</td><td>${mine ? (mine.guild.id === x.id ? `<span class="muted">${t`angefragt`}</span>` : '') : `<button type="button" class="tbtn" data-act="guild:apply:${x.id}">${t`Beitritt anfragen`}</button>`}</td></tr>`).join('')}</tbody></table>`
      : `<p class="muted">${t`Noch hängt kein einziges Wappen an der Tür. Gründe die erste Gilde von Moosgrund!`}</p>`;
    const main = `<h1>${t`Die Gildenhalle`}</h1>${lead}${flashHtml()}${err}
      ${mine ? `<p class="notice">${t`Deine Bewerbung bei <strong>${esc(mine.guild.name)}</strong> [${esc(mine.guild.tag)}] wartet auf eine Antwort der Gildenführung.`} <button type="button" class="linkish" data-act="guild:withdraw">${t`Bewerbung zurückziehen`}</button></p>` : ''}
      <h2>${t`Die Gilden von Moosgrund`}</h2>${list}
      <h2>${t`Eine Gilde gründen`}</h2>
      ${canFound ? `<div class="acct-form">
          <label class="field">${t`Name der Gilde`}<input type="text" id="guild-name" maxlength="30" placeholder="${t`z. B. Die Moosritter`}"></label>
          <label class="field">${t`Kürzel (2 bis 4 Zeichen)`}<input type="text" id="guild-tag" maxlength="4" placeholder="${t`z. B. MOOS`}" style="text-transform:uppercase"></label>
        </div>
        <div class="row"><button type="button" class="btn" data-act="guild:create"${p.gold < GUILD_COST ? ' disabled' : ''}>${t`Gilde gründen (${GUILD_COST} Gold)`}</button></div>
        <p class="muted">${p.gold < GUILD_COST ? t`Du hast nur ${p.gold} Gold dabei.` : t`Das Gold wird gleich bezahlt, und du übernimmst die Führung.`}</p>`
      : `<p class="muted">${t`Eine Gilde gründen kann man ab Stufe 5. Beitreten geht jederzeit.`}</p>`}`;
    return layout(s, main, [{ title: t('Zurück'), items: [back] }]);
  }
  const boss = mine.rank === 'leader';
  const lead2 = boss || mine.rank === 'officer';
  const memberRow = (m: GuildMember) => {
    const isMe = m.user_id === cloud.userId;
    const acts: string[] = [];
    if (!isMe && boss) {
      if (m.rank === 'member') acts.push(`<button type="button" class="tbtn ghost" data-act="guild:rank:${m.user_id}:officer">${t`befördern`}</button>`);
      if (m.rank === 'officer') acts.push(`<button type="button" class="tbtn ghost" data-act="guild:rank:${m.user_id}:member">${t`zurückstufen`}</button>`, `<button type="button" class="tbtn ghost" data-act="guild:rank:${m.user_id}:leader">${t`Führung übergeben`}</button>`);
    }
    if (!isMe && (boss || (mine.rank === 'officer' && m.rank === 'member'))) acts.push(`<button type="button" class="tbtn ghost" data-act="guild:kick:${m.user_id}">${t`entlassen`}</button>`);
    return `<li class="warrior g-member${isMe ? ' me' : ''}"><span class="t-info"><strong><span class="t-title">${esc(titleFor(m.dragon_kills, m.gender))}</span> ${esc(m.name)}</strong> <small>${rankName(m.rank, m.gender)} · ${t`Stufe ${m.level}`}${m.online ? ` · <span class="good">${t`unterwegs`}</span>` : ''}</small></span>${acts.length ? `<span class="row">${acts.join('')}</span>` : ''}</li>`;
  };
  const gi = mine.guild;
  const main = `<h1>${esc(gi.name)} <span class="g-tag">[${esc(gi.tag)}]</span></h1>
    <p class="lead">${t`Ihr habt einen eigenen Raum in der Gildenhalle, mit eurem Wappen über dem Kamin. Du bist hier ${rankName(mine.rank, p.gender)}.`}</p>
    ${flashHtml()}${err}
    ${gi.motd ? `<section class="notice"><h2>${t`Nachricht der Gildenführung`}</h2><p>${esc(gi.motd).replace(/\n/g, '<br>')}</p></section>` : ''}
    ${gi.descr ? `<p>${esc(gi.descr).replace(/\n/g, '<br>')}</p>` : ''}
    ${lead2 && mine.applicants.length ? `<h2>${t`Bewerbungen`}</h2><ul class="warriors">${mine.applicants.map((a) => `<li class="warrior g-member"><span class="t-info"><strong>${esc(a.name)}</strong> <small>${t`Stufe ${a.level}`}${a.dragon_kills ? t` · Drachentöter ${a.dragon_kills}×` : ''}</small></span><span class="row"><button type="button" class="tbtn" data-act="guild:accept:${a.user_id}">${t`aufnehmen`}</button><button type="button" class="tbtn ghost" data-act="guild:decline:${a.user_id}">${t`ablehnen`}</button></span></li>`).join('')}</ul>` : ''}
    <h2>${t`Mitglieder (${mine.members.length})`}</h2>
    <ul class="warriors">${mine.members.map(memberRow).join('')}</ul>
    ${squareHtml('gilde')}
    ${lead2 ? `<details class="guild-edit"><summary>${t`Nachricht und Beschreibung ändern`}</summary>
      <label class="field">${t`Nachricht der Gildenführung`}<textarea id="guild-motd" maxlength="300" rows="3">${esc(gi.motd ?? '')}</textarea></label>
      <label class="field">${t`Beschreibung der Gilde`}<textarea id="guild-descr" maxlength="600" rows="4">${esc(gi.descr ?? '')}</textarea></label>
      <div class="row"><button type="button" class="tbtn" data-act="guild:text">${t`Speichern`}</button></div></details>` : ''}
    <p class="fine"><button type="button" class="linkish" data-act="guild:leave">${g.confirmLeave ? (boss && mine.members.length > 1 ? t('Wirklich? Die Führung geht dann an deine Offiziere. Nochmal tippen.') : boss ? t('Wirklich? Du bist allein, die Gilde wird dann aufgelöst. Nochmal tippen.') : t('Wirklich austreten? Nochmal tippen.')) : t('Aus der Gilde austreten')}</button></p>`;
  return layout(s, main, [{ title: t('Zurück'), items: [back] }]);
}

function lagerScreen(s: GameState): string {
  const p = s.player;
  const cp = p.companion;
  const cd = cp ? companionDef(cp.id) : undefined;
  const main = `<h1>${t`Das Söldnerlager`}</h1>
    <p class="lead">${COMPANION_TEXT.intro}</p>
    ${flashHtml()}
    ${cp && cd ? `<section class="good-box"><h2>${esc(cd.name)}, ${cd.role}</h2><p>${cp.hp <= 0 ? t('Liegt k. o. im Zelt.') : t`${cp.hp} von ${cp.maxHp} Lebenspunkten.`} ${esc(cd.blurb)}</p></section>` : ''}
    <ul class="potions">${COMPANIONS.map((c) => `<li>${t`<strong>${esc(c.name)}</strong> · ${c.role} <span class="gold">${companionCost(c.id, p.level)} Gold</span><br><small class="muted">${esc(c.blurb)} ${companionMaxHp(c.id, p.level)} Lebenspunkte.</small>`}</li>`).join('')}</ul>
    <p class="muted">${COMPANION_TEXT.rules}</p>`;
  const heal = companionHealCost(s);
  const items: Item[] = cp ? [
    { act: 'merc:heal', label: t('Vom Feldscher heilen lassen'), key: 'h', hint: heal ? t`${heal} Gold` : t('nicht nötig'), disabled: !heal || p.gold < heal },
    { act: 'merc:dismiss', label: ui.confirmDelete ? t('Wirklich entlassen? Nochmal drücken.') : t('Entlassen'), key: 'e' },
  ] : COMPANIONS.map((c, i) => ({ act: `merc:hire:${c.id}`, label: t`${c.name} anheuern`, key: String(i + 1), hint: t`${companionCost(c.id, p.level)} Gold`, disabled: p.gold < companionCost(c.id, p.level) }));
  return layout(s, main, [{ title: t('Lager'), items }, { title: t('Zurück'), items: [back] }]);
}

function stableScreen(s: GameState): string {
  const p = s.player;
  const own = p.mount ? MOUNTS[p.mount] : null;
  const ownBuff = p.buffs.find((b) => b.id === 'mount');
  const main = `<h1>${t`Mertens Pferdestall`}</h1>
    <p class="lead">${esc(MERTEN.greeting)}</p>
    ${flashHtml()}
    ${own ? `<p>${t`Im Stall steht ${esc(own.yourNom.replace(/^./, (c) => c.toLowerCase()))}.`} ${ownBuff ? t`${esc(own.buffName)}: noch ${ownBuff.rounds} Runden.` : t('Es ist müde vom Tag.')}</p>` : ''}
    <div class="card-grid mount-grid">${MOUNT_ORDER.map((id) => {
      const m = MOUNTS[id];
      return `<div class="mount-offer ${p.mount === id ? 'owned' : ''}">${cardHtml(mountCard(id), { cls: 'grid-card' })}
        <p>${t`<strong>${m.gems} Edelsteine</strong><br>+${m.fights} Waldkämpfe pro Tag<br>+20 % Angriff für ${m.rounds} Runden<br><span class="muted">${esc(m.blurb)}</span>`}</p></div>`;
    }).join('')}</div>
    <p class="muted">${t`Ein Reittier bleibt dir auch nach dem Drachen. Beim Tausch rechnet Merten dein altes Tier mit zwei Dritteln seines Preises an.`}</p>`;
  const buyItems: Item[] = MOUNT_ORDER.filter((id) => id !== p.mount).map((id, i) => {
    const c = tradeCost(p, id);
    return { act: `mount:buy:${id}`, label: `${p.mount ? t('Tauschen gegen') : t('Kaufen:')} ${MOUNTS[id].name}`, key: String(i + 1),
      hint: c >= 0 ? t`${c} Edelsteine` : t`du bekommst ${-c} Edelsteine`, disabled: p.gems < c };
  });
  const ownItems: Item[] = own ? [
    { act: 'mount:feed', label: t('Füttern'), key: 'f', hint: p.mountFed ? t('heute schon') : t`${feedPrice(p)} Gold`, disabled: p.mountFed || p.gold < feedPrice(p) || (!!ownBuff && ownBuff.rounds >= own.rounds) },
    { act: 'mount:sell', label: ui.confirmDelete ? t(`Wirklich verkaufen? Nochmal drücken.`) : t`${own.name} verkaufen`, key: 'v', hint: t`+${mountRepay(p.mount)} Edelsteine` },
  ] : [];
  return layout(s, main, [
    { title: t('Stall'), items: [...ownItems, ...buyItems] },
    { title: t('Zurück'), items: [back] },
  ]);
}

function flirtScreen(s: GameState): string {
  const p = s.player;
  const id = partnerOf(p);
  const pt = PARTNERS[id];
  const toInn: Item = { act: 'go:inn', label: t('Zurück in die Gaststube'), key: 'g' };
  if (p.marriedTo) {
    const spouse = PARTNERS[p.marriedTo];
    const main = `<h1>${esc(spouse.name)}</h1>
      <p class="lead">${t`${p.marriedTo === 'frieda' ? t('Frieda wischt sich die Hände an der Schürze ab, als sie dich sieht.') : t('Florian legt die Laute weg, als er dich sieht.')} Ihr seid verheiratet. Einmal am Tag habt ihr Zeit füreinander.`}</p>
      ${flashHtml()}
      <p class="muted">${t`Verheiratete müssen nicht mehr so auf ihr Äußeres achten. Jeden Tag geht etwas Charme verloren. Wenn er ganz aufgebraucht ist, geht ${esc(spouse.name)}.`}</p>`;
    return layout(s, main, [
      { title: esc(spouse.name), items: [{ act: 'spouse', label: t('Zeit miteinander verbringen'), key: 'z', hint: p.seenLover ? t('heute schon') : '', disabled: p.seenLover, primary: true }] },
      { title: t('Zurück'), items: [toInn, back] },
    ]);
  }
  const main = `<h1>${t`${esc(pt.name)} umwerben`}</h1>
    <p class="lead">${esc(pt.intro)}</p>
    ${flashHtml()}
    <p class="muted">${t`Je kühner der Versuch, desto mehr Charme brauchst du. Ein Versuch pro Tag. ${p.seenLover ? esc(pt.notToday) : ''}`}</p>`;
  const keys = ['z', 'h', 'k', 's', 'c', 't', 'a'];
  return layout(s, main, [
    { title: t('Flirten'), items: pt.moves.map((m, i) => ({ act: `flirt:${i}`, label: m.label, key: keys[i], hint: m.hint, disabled: p.seenLover })) },
    { title: t('Zurück'), items: [toInn, back] },
  ]);
}

function bestiaryScreen(s: GameState): string {
  const levels = Array.from({ length: MAX_LEVEL }, (_, i) => i + 1);
  const found = MONSTERS.filter((m) => s.bestiary[m.id]).length;
  const sections = levels.map((lvl) => {
    const cards = MONSTERS.filter((m) => m.level === lvl).map((m) => {
      const n = s.bestiary[m.id] ?? 0;
      return n ? cardHtml(monsterCard(m), { count: n, cls: 'grid-card', isNew: ui.newCard === m.id }) : cardBack(lvl);
    }).join('');
    return `<section class="b-level"><h2>${t`Stufe ${lvl}`}</h2><div class="card-grid">${cards}</div></section>`;
  }).join('');
  const dragon = s.bestiary.dragon ? cardHtml(dragonCard(), { count: s.bestiary.dragon, cls: 'grid-card' }) : cardBack(18);
  const main = `<h1>${t`Bestiarium`}</h1>
    <p class="lead">${t`Jede Kreatur, die du besiegst, bekommt hier ihre Karte. <span class="gold">${found} von ${MONSTERS.length}</span> entdeckt.`}</p>
    <div class="progress">${bar(found, MONSTERS.length, 'xp')}</div>
    ${sections}
    <section class="b-level"><h2>${t`Legende`}</h2><div class="card-grid">${dragon}</div></section>
    <section class="b-level"><h2>${FESTE_NAME}</h2><div class="card-grid">${FESTE_FOES.map((m) => {
      const n = s.bestiary[m.id] ?? 0;
      return n ? cardHtml(monsterCard(m), { count: n, cls: 'grid-card', isNew: ui.newCard === m.id }) : cardBack(m.level);
    }).join('')}</div></section>
    <section class="b-level"><h2>${t`Schattenreich`}</h2><div class="card-grid">${SHADES.map((m) => {
      const n = s.bestiary[m.id] ?? 0;
      return n ? cardHtml(shadeCard(m.id)!, { count: n, cls: 'grid-card', isNew: ui.newCard === m.id }) : shadeBack();
    }).join('')}</div></section>`;
  return layout(s, main, [{ title: t('Zurück'), items: [back] }]);
}

function fameScreen(s: GameState): string {
  const p = s.player;
  const st = s.stats;
  const rows = fameTable(s).map((e, i) => `<tr class="${e.isPlayer ? 'me' : ''}"><td class="rank">${i + 1}.</td>
    <td><strong>${esc(e.name)}</strong><small>${esc(e.title)}</small></td><td class="num">${e.dragonKills}</td><td class="num">${e.level}</td></tr>`).join('');
  const found = Object.keys(s.bestiary).filter((k) => k !== 'dragon').length;
  const rec = (label: string, value: string) => `<div class="rec"><span>${label}</span><strong>${value}</strong></div>`;
  const main = `<h1>${t`Ruhmeshalle`}</h1>
    <p class="lead">${t`An der Wand im Rathaus hängen die Namen aller, die dem Brackenwyrm gegenübergetreten sind. Manche sind frisch geschnitzt, andere kaum noch zu lesen.`}</p>
    <table class="fame"><thead><tr><th></th><th>${t`Held`}</th><th class="num">${t`Drachen`}</th><th class="num">${t`Stufe`}</th></tr></thead><tbody>${rows}</tbody></table>
    ${ui.fame && ui.fame.length ? `<h2>${t`Drachentöter aus aller Welt`}</h2>
    <table class="fame"><thead><tr><th></th><th>${t`Held`}</th><th class="num">${t`Drachen`}</th><th class="num">${t`Stufe`}</th></tr></thead><tbody>${ui.fame.map((e, i) => `<tr><td class="rank">${i + 1}.</td><td><strong>${esc(e.name)}</strong><small>${esc(titleFor(e.dragonKills, e.gender))}</small></td><td class="num">${e.dragonKills}</td><td class="num">${e.level}</td></tr>`).join('')}</tbody></table>` : ''}
    ${cloud.enabled ? fameCatsHtml() : ''}
    <h2>${t`Deine Geschichte`}</h2>
    <p class="muted">${t`Titel: <span class="gold">${esc(titleFor(p.dragonKills, p.gender))}</span>`}${p.dragonKills < 31 ? t` · nach dem nächsten Drachen: ${esc(titleFor(p.dragonKills + 1, p.gender))}` : ''}</p>
    <div class="records">
      ${rec(t('Drachenkills'), String(p.dragonKills))}
      ${rec(t('Schnellster Drachenkill'), st.fastestDragon ? t`${st.fastestDragon} Tage` : t('noch keiner'))}
      ${rec(t('Stärkster Treffer'), st.bestHit.dmg ? t`${st.bestHit.dmg} (${esc(st.bestHit.foe)}, Tag ${st.bestHit.day})` : t('noch keiner'))}
      ${rec(t('Siege im Wald'), String(st.kills))}
      ${rec(t('Besiegte Meister'), String(st.masters))}
      ${rec(t('Karten im Bestiarium'), `${found} / ${MONSTERS.length}`)}
      ${rec(t('Waldereignisse'), String(st.events))}
      ${rec(t('Fahrten mit Morwen'), String(st.deaths))}
      ${rec(t('Spieltage'), String(s.day))}
    </div>`;
  return layout(s, main, [{ title: t('Zurück'), items: [back] }]);
}

const FAME_CATS: { id: FameCat; label: string; col: string; fmt?: (v: number) => string }[] = [
  { id: 'drachen', label: t('Drachentöter'), col: t('Drachen') },
  { id: 'schnell', label: t('Schnellste'), col: t('Tage'), fmt: (v) => t`${v} Tage` },
  { id: 'reich', label: t('Reichste'), col: t('Gold') },
  { id: 'charme', label: t('Charmanteste'), col: t('Charme') },
  { id: 'furcht', label: t('Gefürchtetste'), col: t('Überfälle') },
  { id: 'schatz', label: t('Schatzjäger'), col: t('Schätze') },
  { id: 'erben', label: t('Erben'), col: t('Erbstücke') },
  { id: 'veteran', label: t('Veteranen'), col: t('Spieltage') },
];

function fameCatsHtml(): string {
  const cat = FAME_CATS.find((c) => c.id === ui.fameCat) ?? FAME_CATS[0];
  const rows = ui.fameRows;
  return `<h2>${t`Ranglisten`}</h2>
    <div class="seg fame-cats" role="tablist">${FAME_CATS.map((c) => `<button type="button" class="seg-btn ${c.id === cat.id ? 'on' : ''}" role="tab" aria-selected="${c.id === cat.id}" data-act="famecat:${c.id}">${c.label}</button>`).join('')}</div>
    ${rows === undefined ? `<p class="muted">${t`Die Ranglisten sind auf dem Server noch nicht eingerichtet (Teil 5).`}</p>`
      : rows === null ? '<p class="muted">…</p>'
      : !rows.length ? `<p class="muted">${t`Hier steht noch niemand.`}</p>`
      : `<table class="fame"><thead><tr><th></th><th>${t`Held`}</th><th class="num">${cat.col}</th></tr></thead><tbody>${rows.map((e, i) => `<tr><td class="rank">${i + 1}.</td><td>${t`<strong>${esc(e.name)}</strong><small>${esc(titleFor(e.dragonKills, e.gender))} · Stufe ${e.level}</small>`}</td><td class="num">${cat.fmt ? cat.fmt(e.value) : e.value}</td></tr>`).join('')}</tbody></table>`}`;
}

function loadFameCat(): void {
  ui.fameRows = null;
  cloud.fameCategory(ui.fameCat, 20).then((r) => { ui.fameRows = r; }, () => { ui.fameRows = []; }).finally(() => { if (currentScreen() === 'fame') render(); });
}

const RESULT: Record<ChronicleEntry['result'], string> = { win: t('Sieg'), lose: t('Niederlage'), fled: t('Geflohen') };

function chronicleScreen(s: GameState): string {
  const list = s.chronicle.map((c, i) => `<details class="chron ${c.result}" ${i === 0 ? 'open' : ''}>
      <summary>${t`<span class="chron-foe">${esc(c.foe)}</span> <span class="chron-meta">Tag ${c.day} · ${RESULT[c.result]} in ${c.rounds} ${c.rounds === 1 ? t('Runde') : t('Runden')}`}${c.topHit ? t` · stärkster Treffer ${c.topHit}` : ''}</span></summary>
      <div class="log fight-log open">${fightLogHtml(c.log)}</div>
    </details>`).join('');
  const main = `<h1>${t`Kampfchronik`}</h1>
    <p class="lead">${t`Der Dorfschreiber notiert deine letzten ${CHRONICLE_SIZE} Kämpfe. Wort für Wort, auch die peinlichen.`}</p>
    ${list || `<p class="muted">${t`Noch keine Kämpfe. Der Wald wartet.`}</p>`}`;
  return layout(s, main, [{ title: t('Zurück'), items: [back] }]);
}

const SCREEN_NAMES: Partial<Record<Screen, string>> = {
  village: t('Dorfplatz'), forest: t('Wald'), fight: t('Kampf'), training: t('Trainingsplatz'), healer: t('Kräuterhütte'), smith: t('Schmiede'),
  bank: t('Kontor'), inn: t('Gasthaus'), bestiary: t('Bestiarium'), fame: t('Ruhmeshalle'), chronicle: t('Kampfchronik'), settings: t('Einstellungen'),
  shadows: t('Schattenreich'), dragonBonus: t('Drachenkill'), quirin: t('Quirins Tränke'), tresen: t('Tresen'), lager: t('Söldnerlager'), gilde: t('Gildenhalle'), dag: t('Veit Galgenstrick'), fivesix: t('Sechserjagd'), aushang: t('Aushang'), feste: t('Versunkene Feste'), heirlooms: t('Erbstücke'), seer: t('Seherin'), felsen: t('Wyrmstein'), garten: t('Rosengarten'),
  stable: t('Pferdestall'), ambros: t('Ambros'), warriors: t('Kriegerliste'), mail: t('Briefe'), bio: t('Steckbrief'),
};

function buildFeedback(s: GameState): string {
  return feedbackMessage(s, VERSION, ui.fbKinds, ui.fbText, SCREEN_NAMES[ui.fbFrom] ?? ui.fbFrom);
}

function feedbackScreen(s: GameState): string {
  const msg = buildFeedback(s);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const main = `<h1>${t`Rückmeldung geben`}</h1>
    <p class="lead">${t`Was ist dir aufgefallen? Ein Satz reicht. Dein Spielstand wird unten automatisch angehängt.`}</p>
    <div class="chips" role="group" aria-label="${t`Art der Rückmeldung`}">
      ${FEEDBACK_KINDS.map((k) => `<button type="button" class="chip ${ui.fbKinds.includes(k.id) ? 'on' : ''}" aria-pressed="${ui.fbKinds.includes(k.id)}" data-act="fbkind:${k.id}">${k.label}</button>`).join('')}
    </div>
    <label class="field">${t`Deine Nachricht`}<textarea id="fbtext" rows="5" placeholder="${t`z. B. Ab Stufe 6 sterbe ich ständig, oder: Ich hätte gern ein Haustier.`}">${esc(ui.fbText)}</textarea></label>
    <div class="row send-row">
      <button type="button" class="btn" data-act="fbsend:wa">${t`Per WhatsApp senden`}</button>
      ${canShare ? `<button type="button" class="btn alt" data-act="fbsend:share">${t`Teilen …`}</button>` : ''}
      <button type="button" class="btn ghost" data-act="fbsend:mail">${t`Per E-Mail`}</button>
      <button type="button" class="btn ghost" data-act="fbsend:copy">${t`Text kopieren`}</button>
    </div>
    ${ui.fbMsg ? `<p class="flash">${esc(ui.fbMsg)}</p>` : ''}
    <details class="fb-preview"><summary>${t`So sieht die Nachricht aus`}</summary><textarea id="fbpreview" readonly rows="11" aria-label="${t`Fertige Nachricht`}">${esc(msg)}</textarea></details>`;
  return layout(s, main, [{ title: t('Zurück'), items: [{ act: `go:${ui.fbFrom === 'fight' ? 'village' : ui.fbFrom}`, label: t('Zurück'), key: 'd' }] }]);
}

function accountHtml(): string {
  const msg = ui.acctMsg ? `<p class="muted">${esc(ui.acctMsg)}</p>` : '';
  if (cloud.signedIn) {
    return `<h2>${t`Spielerkonto`}</h2>
      <p>${t`Angemeldet als <strong>${esc(cloud.email)}</strong>. Dein Spielstand wird automatisch online gesichert, damit du auf Handy und Computer weiterspielen kannst.`}</p>
      <div class="row"><button type="button" class="tbtn" data-act="acct:sync">${t`Jetzt abgleichen`}</button><button type="button" class="tbtn" data-act="acct:out">${t`Abmelden`}</button></div>${msg}`;
  }
  if (ui.resetStep === 'email') {
    return `<h2>${t`Passwort vergessen`}</h2>
      <p class="muted">${t`Gib die E-Mail-Adresse deines Spielerkontos ein. Wir schicken dir einen Code, mit dem du ein neues Passwort festlegst.`}</p>
      <div class="acct-form"><label class="field">${t`E-Mail`}<input type="email" id="acct-email" autocomplete="email" placeholder="${t`deine@mail.at`}" value="${esc(ui.acctEmail)}"></label></div>
      <div class="row"><button type="button" class="btn" data-act="acct:resetsend">${t`Code schicken`}</button><button type="button" class="btn ghost" data-act="acct:resetcancel">${t`Zurück zur Anmeldung`}</button></div>${msg}`;
  }
  if (ui.resetStep === 'code') {
    return `<h2>${t`Neues Passwort`}</h2>
      <p class="muted">${t`Wir haben einen Code an <strong>${esc(ui.acctEmail)}</strong> geschickt. Er kann ein paar Minuten brauchen. Schau auch im Spam-Ordner nach.`}</p>
      <div class="acct-form">
        <label class="field">${t`Code aus der E-Mail`}<input type="text" id="acct-code" inputmode="numeric" autocomplete="one-time-code" maxlength="10"></label>
        <label class="field">${t`Neues Passwort`}<input type="password" id="acct-newpass" autocomplete="new-password" placeholder="${t`mindestens 6 Zeichen`}"></label>
      </div>
      <div class="row"><button type="button" class="btn" data-act="acct:resetsave">${t`Neues Passwort speichern`}</button><button type="button" class="btn ghost" data-act="acct:resetsend">${t`Code nochmal schicken`}</button><button type="button" class="btn ghost" data-act="acct:resetcancel">${t`Abbrechen`}</button></div>${msg}`;
  }
  return `<h2>${t`Spielerkonto`}</h2>
    <p class="muted">${t`Mit einem Konto wird dein Spielstand online gesichert, und du spielst auf Handy und Computer mit demselben Helden.`}</p>
    <div class="acct-form">
      <label class="field">${t`E-Mail`}<input type="email" id="acct-email" autocomplete="email" placeholder="${t`deine@mail.at`}" value="${esc(ui.acctEmail)}"></label>
      <label class="field">${t`Passwort`}<input type="password" id="acct-pass" autocomplete="current-password" placeholder="${t`mindestens 6 Zeichen`}"></label>
    </div>
    <div class="row"><button type="button" class="btn" data-act="acct:in">${t`Anmelden`}</button><button type="button" class="btn ghost" data-act="acct:up">${t`Neues Konto anlegen`}</button></div>
    <p class="fine"><button type="button" class="linkish" data-act="acct:reset">${t`Passwort vergessen?`}</button></p>
    <p class="fine">${t`Mit einem neuen Konto gilt die`} <button type="button" class="linkish" data-act="legal:datenschutz">${t`Datenschutzerklärung`}</button>${t`. Ein Konto ab 14 Jahren, jünger nur mit Einverständnis der Eltern.`}</p>${msg}`;
}

/** Nach dem Anmelden (Passwort oder Code): abgleichen und weiter ins Dorf oder Hinweis zeigen. */
async function afterLogin(done: (m: string) => void, note = ''): Promise<void> {
  prefs.lastSyncedAt = 0; savePrefs(prefs);
  ui.full = null; loadFull();
  const m = await syncNow();
  if (ui.screen === 'login') {
    if (state) { const newDay = checkRealDay(state); saveGame(state, !newDay); if (note) say(note, 'good'); go('village'); return; }
    done([note, t('Angemeldet. Für dieses Konto gibt es noch keinen Spielstand. Beginne ein neues Spiel, es wird dann automatisch gesichert.')].filter(Boolean).join(' '));
    return;
  }
  done(note || m || t('Angemeldet.'));
}

function summary(st: GameState): string {
  const p = st.player;
  const when = st.savedAt ? new Date(st.savedAt).toLocaleString(t('de-AT'), { dateStyle: 'medium', timeStyle: 'medium' }) : t('unbekannt');
  return `${t`<strong>${esc(p.name)}</strong>, Stufe ${p.level}, Spieltag ${st.day}<br>${p.gold} Gold, ${p.exp} Erfahrung, ${p.forestFights} Waldkämpfe übrig, ${p.dragonKills} Drachenkills<br><span class="muted">gespeichert ${when}</span>`}`;
}

function syncConflictScreen(s: GameState): string {
  const remote = ui.conflict!.state;
  const main = `<h1>${t`Zwei Spielstände`}</h1>
    <p class="lead">${t`Auf diesem Gerät und online wurde seit dem letzten Abgleich weitergespielt. Welcher Stand soll bleiben? Der andere geht verloren.`}</p>
    <div class="records sync-choice">
      <div class="rec">${t`<span>Auf diesem Gerät</span>`}<p>${summary(s)}</p></div>
      <div class="rec">${t`<span>Online gesichert</span>`}<p>${summary(remote)}</p></div>
    </div>`;
  return layout(s, main, [{ title: t('Entscheiden'), items: [
    { act: 'conflict:local', label: t('Diesen Stand behalten'), key: 'd' },
    { act: 'conflict:remote', label: t('Online-Stand laden'), key: 'o' },
  ] }]);
}

// ---------- Spieler gegen Spieler, Dorfplatz, Neuigkeiten ----------


function targetsHtml(place: 'felder' | 'gasthaus'): string {
  const pv = ui.pvp;
  if (pv.loading) return `<p class="muted">${t`Du schaust dich um …`}</p>`;
  if (pv.error) return `<p class="warn-box">${esc(pv.error)}</p>`;
  if (!pv.targets) return '';
  if (!pv.targets.length) return `<p class="muted">${place === 'gasthaus' ? t('Frieda zuckt mit den Schultern. Heute Nacht schläft hier niemand, an den du herankommst.') : t('Auf den Feldern schläft gerade niemand in deiner Reichweite.')}</p>`;
  const none = (pv.fightsLeft ?? 1) <= 0 || pv.busy;
  return `<ul class="targets">${pv.targets.map((tg) => `<li class="target">
      <span class="t-portrait">${heroPortrait(tg.race, tg.specialty, tg.gender)}${t`</span> <span class="t-info"><strong><span class="t-title">${esc(titleFor(tg.dragonKills, tg.gender))}</span> ${esc(tg.name)}</strong><small>Stufe ${tg.level} · ${raceName(tg.race, tg.gender)} · ${SPECIALTIES[tg.specialty]?.name ?? ''}`}${tg.dragonKills ? t` · Drachentöter ${tg.dragonKills}×` : ''}${tg.note ? ` · ${esc(tg.note)}` : ''}</small></span>
      <button type="button" class="tbtn" data-act="pvp:${tg.userId}:${place}" ${!tg.attackable || none ? 'disabled' : ''}>${t`Angreifen`}</button>
    </li>`).join('')}</ul>`;
}

function pvpIntro(): string {
  const pv = ui.pvp;
  const left = pv.fightsLeft === null ? '' : `<p>${t`Spielerkämpfe heute: <span class="gold">${pv.fightsLeft} von 3</span>.`}</p>`;
  const immune = pv.immune ? `<p class="warn-box">${t`Du stehst noch unter dem Schutz der Neulinge. Greifst du jemanden an, verlierst du diesen Schutz für immer.`}</p>` : '';
  return `${left}${immune}<p class="muted">${t`Gewinnst du, bekommst du das Gold, das dein Gegner bei sich trägt, und etwas von seiner Erfahrung. Verlierst du, landest du bei Morwen und dein Gold wechselt den Besitzer.`}</p>`;
}

function fieldsScreen(s: GameState): string {
  const main = `<h1>${t`Die Felder vor dem Tor`}</h1>
    <p class="lead">${t`Wer abends nicht ins Gasthaus will, legt sich hier ins hohe Gras. Manche schnarchen. Manche tun nur so.`}</p>
    ${pvpIntro()}${flashHtml()}${targetsHtml('felder')}`;
  return layout(s, main, [{ title: t('Felder'), items: [{ act: 'reload:felder', label: t('Nochmal umsehen'), key: 'u' }] }, { title: t('Zurück'), items: [back] }]);
}

function innGuestsScreen(s: GameState): string {
  const main = `<h1>${t`Die Gästezimmer`}</h1>
    <p class="lead">${t`Frieda lässt den Edelstein in ihrer Schürze verschwinden und schiebt dir das Gästebuch hin. „Ich hab nichts gesehen“, sagt sie und poliert weiter.`}</p>
    ${pvpIntro()}${flashHtml()}${targetsHtml('gasthaus')}`;
  return layout(s, main, [{ title: t('Gasthaus'), items: [{ act: 'go:inn', label: t('Zurück in die Gaststube'), key: 'g' }] }, { title: t('Zurück'), items: [back] }]);
}

function when(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const same = d.toDateString() === today.toDateString();
  return same ? d.toLocaleTimeString(t('de-AT'), { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString(t('de-AT'), { day: 'numeric', month: 'short' }) + ', ' + d.toLocaleTimeString(t('de-AT'), { hour: '2-digit', minute: '2-digit' });
}

function newsScreen(s: GameState): string {
  const rows = ui.newsRows;
  const main = `<h1>${t`Tagesneuigkeiten`}</h1>
    <p class="lead">${t`Am Brunnen hängt ein Brett. Darauf nagelt der Dorfschreiber alles, was in Moosgrund und im Brackenwald passiert.`}</p>
    ${rows === null ? `<p class="muted">${t`Der Dorfschreiber sucht seine Brille …`}</p>` : rows.length ? `<ul class="newsboard">${rows.map((n) => `<li><time>${when(n.created_at)}</time> ${esc(showNews(n.body))}</li>`).join('')}</ul>` : `<p class="muted">${t`Noch ist nichts passiert. Das ändert sich bestimmt bald.`}</p>`}`;
  return layout(s, main, [{ title: t('Zurück'), items: [back] }]);
}

type ChatSection = 'dorfplatz' | 'gasthaus' | 'schattenreich' | 'felsen' | 'garten' | 'gilde';
const CHAT: Record<ChatSection, { title: string; empty: string; screens: Screen[]; place: string; hint?: string }> = {
  dorfplatz: { title: t('Auf dem Dorfplatz'), empty: t('Auf dem Dorfplatz ist es still. Sag doch was.'), screens: ['village'], place: t('Dorfplatz') },
  gasthaus: { title: t('Am Tresen'), empty: t('Am Tresen schweigt man heute. Frieda poliert Gläser.'), screens: ['inn'], place: t('Tresen') },
  schattenreich: { title: t('Flüstern am Nebelfluss'), empty: t('Nur der Fluss rauscht. Flüstere den anderen Seelen etwas zu.'), screens: ['shadows', 'seer'], place: t('Nebelfluss') },
  felsen: { title: t('Am Wyrmstein'), empty: t('Die Drachentöter schweigen heute. Erzähl doch, wie dein letzter Kampf war.'), screens: ['felsen'], place: t('Wyrmstein'), hint: t('Erzähl von deinen Taten …') },
  gilde: { title: t('Gildengespräch'), empty: t('In der Gildenhalle ist es still. Sag deinen Gefährten etwas.'), screens: ['gilde'], place: t('Gildenhalle'), hint: t('Nur deine Gilde hört mit …') },
  garten: { title: t('Im Rosengarten'), empty: t('Nur die Bienen summen. Setz dich auf eine Bank und sag etwas.'), screens: ['garten'], place: t('Rosengarten'), hint: t('Flüstere etwas zwischen den Rosen …') },
};

/** Vom Server kommen Namen mit deutschem Titel ("Moosritterin Hilda"). In anderen Sprachen den Titel übersetzen. */
function titledLocal(name: string): string {
  if (lang === 'de') return name;
  const tag = name.match(/^\[[^\]]{1,6}\] /)?.[0] ?? '';
  const rest = name.slice(tag.length);
  const k = TITLE_KEYS.find((x) => rest.startsWith(x + ' '));
  return tag + (k ? t(k) + rest.slice(k.length) : rest);
}

/** Gesten wie im Original: "/me lacht", ":lacht" oder "::lacht" wird zu "Name lacht". Sonst null. */
export function emoteOf(body: string): string | null {
  const m = body.match(/^\s*(?:\/me\b|::?)\s*(\S[\s\S]*)$/i);
  return m ? m[1].trim() : null;
}

/** Gespräche wie im Original: Dorfplatz, Gasthaus und Schattenreich haben jeweils ihre eigene Runde. */
function squareHtml(section: ChatSection = 'dorfplatz'): string {
  const sq = ui.squares[section];
  const c = CHAT[section];
  const list = sq.comments === null ? '<p class="muted">…</p>'
    : sq.comments.length ? sq.comments.filter((x) => !(x.user_id && ui.blocked.has(x.user_id))).reverse().map((x) => {
        const act = emoteOf(x.body);
        return act !== null
          ? `<p class="say emote"><span class="muted">${when(x.created_at)}</span>${reportBtn('chat', x.id, x.user_id)}<br><em><span class="npc">${esc(titledLocal(x.name))}</span> ${esc(act)}</em></p>`
          : `<p class="say"><span class="npc">${esc(titledLocal(x.name))}</span> <span class="muted">${when(x.created_at)}</span>${reportBtn('chat', x.id, x.user_id)}<br>${esc(x.body)}</p>`;
      }).join('')
    : `<p class="muted">${c.empty}</p>`;
  const input = cloud.signedIn
    ? `<div class="row say-row"><input type="text" id="say" data-section="${section}" maxlength="200" placeholder="${c.hint ?? (section === 'schattenreich' ? t('Flüstere etwas …') : t('Sag etwas …'))}" value="${esc(ui.sayText)}" aria-label="${t`Spruch für ${c.place}`}"><button type="button" class="tbtn" data-act="say:${section}">${section === 'schattenreich' ? t('Flüstern') : t('Sagen')}</button></div><p class="fine">${t`Tipp: Mit <code>/me winkt</code> oder <code>:winkt</code> beschreibst du, was dein Held tut.`}</p>`
    : `<p class="muted">${t`Mit einem Spielerkonto kannst du hier mitreden (Einstellungen).`}</p>`;
  return `<section class="square ${section}"><h2>${c.title}</h2>${list}${sq.error ? `<p class="warn">${esc(sq.error)}</p>` : ''}${input}</section>`;
}

/** Kleiner Melden-Knopf (erst Tippen fragt nach, zweites Tippen meldet). */
function reportBtn(kind: ReportKind, ref: number | string, owner?: string | null): string {
  if (!cloud.signedIn || !owner || owner === cloud.userId) return '';
  const key = `${kind}:${ref}`;
  const sure = ui.repConfirm === key;
  return ` <button type="button" class="flag ${sure ? 'sure' : ''}" data-act="rep:${key}" title="${t`Melden`}" aria-label="${sure ? t('Wirklich melden') : t('Melden')}">${sure ? t('Wirklich melden?') : '⚑'}</button>`;
}

let safetyLoaded = false;
/** Blockierliste und Wache-Status nach dem Anmelden holen. */
function loadSafety(): void {
  safetyLoaded = true;
  cloud.blocks().then((rows) => { ui.blocksList = rows; ui.blocked = new Set(rows.map((r) => r.blocked)); render(); }, () => { safetyLoaded = false; });
  cloud.isAdmin().then((a) => { if (a !== ui.isAdmin) { ui.isAdmin = a; render(); } }, () => {});
}

function resetSafety(): void {
  safetyLoaded = false; ui.blocked = new Set(); ui.blocksList = null; ui.isAdmin = false;
}

function loadSquare(section: ChatSection = 'dorfplatz', force = false): void {
  const sq = ui.squares[section];
  if (!cloud.enabled || sq.loading || (!force && Date.now() - sq.at < 20_000)) return;
  sq.loading = true;
  cloud.comments(section, 12).then((rows) => { sq.comments = rows; sq.error = ''; }, () => { sq.comments = sq.comments ?? []; })
    .finally(() => { sq.loading = false; sq.at = Date.now(); if (CHAT[section].screens.includes(currentScreen())) render(); });
}

function loadTargets(place: 'felder' | 'gasthaus'): void {
  const pv = ui.pvp;
  pv.loading = true; pv.error = ''; pv.targets = null;
  render();
  Promise.all([cloud.pvpTargets(place), cloud.pvpStatus().catch(() => null)]).then(([t, st]) => {
    pv.targets = t;
    if (st) { pv.fightsLeft = st.fights_left; pv.immune = st.immune; }
  }, (e) => { pv.error = e instanceof CloudError ? e.message : t('Das hat nicht geklappt.'); })
    .finally(() => { pv.loading = false; render(); });
}

/** Spielerkarte für den Kampf: das Heldenbild des anderen Spielers. */
function pvpCard(name: string, level: number, race: RaceId, spec: SpecialtyId, gender: Gender): CardInfo {
  return { key: `pvp:${name}`, name, level, tier: tierFor(level), art: heroArt(race, spec, gender), hasIllustration: true, flavor: '', glow: '#ffd88a', fx: 'motes', tierLabel: gender === 'f' ? t('Heldin') : t('Held') };
}

function statusOf(w: WarriorRow): string {
  if (w.online) return '<span class="on-dot"></span> unterwegs';
  if (!w.alive) return t('bei Morwen');
  return w.inInn ? t('schläft im Gasthaus') : t('schläft auf den Feldern');
}

/** Denkmal wie die Statue im Original: der letzte Drachentöter des Dorfes. */
function statueText(s: GameState): string {
  const own = s.player.dragonKills > 0 ? s.player.name : '';
  const name = ui.statue ?? (own || t('Brunhild Eisenhand'));
  return `${t`Mitten auf dem Platz steht ein moosbewachsenes Denkmal. Die Inschrift lautet: „<span class="gold">${esc(name)}</span>. Zuletzt bezwang diese Klinge den Brackenwyrm.“`}`;
}

let statueLoaded = false;
function loadStatue(): void {
  if (statueLoaded || !cloud.enabled) return;
  statueLoaded = true;
  const show = (name: string) => { ui.statue = name; if (currentScreen() === 'village') render(); };
  cloud.lastDragonSlayer().then((r) => {
    if (r) { show(r.name); return; }
  }).catch(() => { statueLoaded = false; });
}

function bioScreen(s: GameState): string {
  const w = ui.bio;
  if (!w) return warriorsScreen(s);
  const me = w.userId === cloud.userId;
  const mounts = MOUNTS as Record<string, { name: string }>;
  const partners = PARTNERS as Record<string, { name: string }>;
  const mount = w.mount && mounts[w.mount] ? mounts[w.mount].name : '';
  const spouse = w.marriedTo && partners[w.marriedTo] ? partners[w.marriedTo].name : '';
  const row = (k: string, v: string) => `<div class="rec"><span>${k}</span><strong>${v}</strong></div>`;
  const text = me ? s.player.bio ?? '' : w.bio ?? '';
  const heirs = heirloomNames(me ? s.player.heirlooms : w.heirlooms);
  const news = ui.bioNews;
  const main = `<div class="bio-head">${cardHtml(pvpCard(w.name, w.level, w.race, w.specialty, w.gender), { cls: 'mini' })}
      <div><h1><span class="t-title">${esc(titleFor(w.dragonKills, w.gender))}</span> ${esc(w.name)}</h1>
      <p class="lead">${statusOf(w)}</p></div></div>
    ${flashHtml()}
    <div class="records bio-facts">
      ${row(t('Stufe'), String(w.level))}
      ${row(t('Rasse'), raceName(w.race, w.gender))}
      ${row(t('Fähigkeit'), SPECIALTIES[w.specialty].name)}
      ${row(t('Drachenkills'), String(w.dragonKills))}
      ${row(t('Spieltage'), String(w.daysPlayed))}
      ${row(t('Reittier'), esc(mount || t('zu Fuß')))}
      ${row(t('Verheiratet'), spouse ? `mit ${esc(spouse)}` : 'nein')}
    </div>
    ${heirs.length ? `<h2>${t`Erbstücke der Wyrmjäger (${heirs.length} von ${HEIRLOOMS.length})`}</h2><p>${heirs.map((h) => `<span class="tag">${esc(h)}</span>`).join(' ')}</p>${heirs.length === HEIRLOOMS.length ? `<p class="gold">${t`Erbe der Wyrmjäger`}</p>` : ''}` : ''}
    <h2>${t`Steckbrief`}</h2>
    ${me ? `<textarea id="bio-text" class="bio-edit" maxlength="400" rows="5" placeholder="${t`Erzähl etwas über deinen Helden …`}">${esc(text)}</textarea>
      <div class="row"><button type="button" class="tbtn" data-act="biosave">${t`Steckbrief speichern`}</button>${t`<span class="muted">höchstens 400 Zeichen</span>`}</div>`
      : `<p class="bio-text">${text ? esc(text).replace(/\n/g, '<br>') : `${t`<span class="muted">Noch kein Steckbrief geschrieben.</span>`}`}</p>`}
    <h2>${t`Zuletzt in den Neuigkeiten`}</h2>
    ${news === null ? '<p class="muted">…</p>' : news.length ? `<ul class="newsboard">${news.map((n) => `<li><time>${when(n.created_at)}</time> ${esc(showNews(n.body))}</li>`).join('')}</ul>` : `<p class="muted">${t`Noch nichts Erwähnenswertes.`}</p>`}`;
  return layout(s, main, [
    { title: t('Steckbrief'), items: [
      ...(me ? [] : [{ act: `write:${w.userId}`, label: t('Brief schreiben'), key: 'b', primary: true }]),
      { act: 'go:warriors', label: t('Zur Kriegerliste'), key: 'l' },
    ] },
    ...(me ? [] : [{ title: t('Ärger?'), items: [
      ui.blocked.has(w.userId)
        ? { act: `unblock:${w.userId}`, label: t('Nicht mehr blockieren'), key: 'k' }
        : { act: `block:${w.userId}`, label: t('Blockieren'), key: 'k', hint: t('keine Briefe, Gespräche ausgeblendet') },
      { act: `rep:steckbrief:${w.userId}`, label: ui.repConfirm === `steckbrief:${w.userId}` ? t('Wirklich melden?') : t('Steckbrief melden'), key: 'm' },
      { act: `rep:name:${w.userId}`, label: ui.repConfirm === `name:${w.userId}` ? t('Wirklich melden?') : t('Namen melden'), key: 'n' },
    ] }]),
    { title: t('Zurück'), items: [back] },
  ]);
}

const FESTE_ART = import.meta.glob('../assets/feste/*.webp', { eager: true, import: 'default' }) as Record<string, string>;
function festeArt(name: string): string {
  return FESTE_ART[`../assets/feste/${name}.webp`] ?? '';
}

/** Die Karte: nur Gesehenes ist sichtbar, Wände als Ränder. */
function festeMap(s: GameState): string {
  const run = s.feste!;
  const m = mazeFor(run.day);
  const cells: string[] = [];
  for (let c = 0; c < FESTE_SIZE * FESTE_SIZE; c++) {
    const seen = run.seen.includes(c);
    if (!seen) { cells.push('<div class="fc dark"></div>'); continue; }
    const o = m.open[c];
    const walls = `${o & 1 ? '' : ' wn'}${o & 2 ? '' : ' wo'}${o & 4 ? '' : ' ws'}${o & 8 ? '' : ' ww'}`;
    const here = c === run.pos;
    const done = run.done.includes(c);
    const visited = done || here || c === m.start;
    let mark = '';
    if (here) mark = '<span class="me" aria-label="Du">●</span>';
    else if (c === m.start) mark = `<span title="${t('Ausgang')}">⌂</span>`;
    else if (c === m.boss && (visited || run.bossDown)) mark = `<span class="boss" title="${t('Halle des Hüters')}">♜</span>`;
    else if (done) mark = '<span class="done">·</span>';
    cells.push(`<div class="fc${walls}${here ? ' here' : ''}">${mark}</div>`);
  }
  return `<div class="feste-map" role="img" aria-label="${t`Karte der Feste`}">${cells.join('')}</div>`;
}

function festePad(s: GameState): string {
  const ex = exits(s);
  const btn = (d: Dir, arrow: string) => {
    const k = lang === 'en' && d === 'o' ? 'e' : d;
    return `<button type="button" class="pad-btn pad-${d}" data-act="feste:${d}" data-hotkey="${k}" ${ex.includes(d) ? '' : 'disabled'} aria-label="${DIR_NAME[d]}" title="${DIR_NAME[d]} (${k.toUpperCase()})">${arrow}<small>${k.toUpperCase()}</small></button>`;
  };
  return `<div class="feste-pad">${btn('n', '▲')}${btn('w', '◀')}${btn('o', '▶')}${btn('s', '▼')}</div>
    <p class="muted pad-hint">${t`Am Computer: Pfeiltasten oder N, O, S, W`}</p>`;
}

function festeTreasureNews(s: GameState): void {
  const p = s.player;
  const post = (first: boolean) => { announce(s, treasureNews(p, first)); saveGame(s); scheduleSync(500); };
  if (!cloud.enabled) { post(false); return; }
  cloud.newsAbout('§festeTreasure', 20).then((rows) => {
    const today = gameDayKey();
    post(!rows.some((r) => gameDayKey(new Date(r.created_at)) === today));
  }, () => post(false));
}

function festeScreen(s: GameState): string {
  const p = s.player;
  const run = s.feste && s.feste.day === gameDayKey() ? s.feste : null;
  const entranceArt = festeArt('eingang');
  const treasureArt = festeArt('schatzkammer');
  if (!run || run.over) {
    const why = canEnterFeste(s, gameDayKey());
    const summary = run && run.over
      ? `<section class="event-box log">${run.log.map((l) => `<p class="${l.k}">${esc(l.t)}</p>`).join('')}
          ${run.heirloom && festeArt(`erbstueck-${run.heirloom}`) ? `<figure class="heir-found"><img src="${festeArt(`erbstueck-${run.heirloom}`)}" alt="${esc(heirloom(run.heirloom)?.name ?? '')}"><figcaption>${esc(heirloom(run.heirloom)?.name ?? '')}</figcaption></figure>` : ''}
          ${run.gold || run.gems ? `<p class="gold">${t`Ausbeute heute: ${run.gold} Gold`}${run.gems ? (run.gems === 1 ? t(', 1 Edelstein') : t`, ${run.gems} Edelsteine`) : ''}${run.heirloom ? `, ${esc(heirloom(run.heirloom)?.name ?? '')}` : ''}.</p>` : ''}</section>`
      : '';
    const art = run?.over === 'treasure' && treasureArt ? treasureArt : entranceArt;
    const main = `<h1>${FESTE_NAME}</h1>
      ${art ? `<figure class="title-art feste-art"><img src="${art}" alt="${run?.over === 'treasure' ? t('Die Schatzkammer der Wyrmjäger') : t('Die versunkene Feste im Moor')}"></figure>` : ''}
      ${summary || `<p class="lead">${FESTE_TEXT.entrance}</p>`}
      ${flashHtml()}
      ${why === 'today' && !summary ? `<p class="muted">${FESTE_TEXT.closedToday}</p>` : ''}
      ${why === 'level' ? `<p class="warn-box">${t`Ab Stufe ${FESTE_MIN_LEVEL} traust du dich da hinein.`}</p>` : ''}
      ${why === 'tired' ? `<p class="warn-box">${t`Der Weg hinein kostet ${FESTE_COST} Waldkämpfe. So viel Kraft hast du heute nicht mehr.`}</p>` : ''}
      <p class="muted">${t`Einmal am Tag. Licht für ${festeLight(p)} Schritte. Schriftrollen gelesen: ${p.festeScrolls ?? 0} von ${SCROLLS.length}. Erbstücke: ${p.heirlooms?.length ?? 0} von ${HEIRLOOMS.length}.`}</p>`;
    return layout(s, main, [
      { title: t('Die Feste'), items: [
        { act: 'festeEnter', label: t('Die Feste betreten'), key: 'b', hint: why === 'today' ? t('morgen wieder') : t`${FESTE_COST} Waldkämpfe`, disabled: why !== 'ok', primary: why === 'ok' },
        { act: 'go:heirlooms', label: t('Erbstücke und Schriftrollen'), key: 'e' },
      ] },
      { title: t('Zurück'), items: [{ act: 'go:forest', label: t('Zurück in den Wald'), key: 'w' }, back] },
    ]);
  }
  const lightCls = run.light <= 10 ? 'bad' : run.light <= 20 ? 'warn' : '';
  const main = `<h1>${FESTE_NAME}</h1>
    <div class="feste-wrap">
      <div>${festeMap(s)}</div>
      <div class="feste-side">
        <p class="feste-stats">${t`<span class="${lightCls}">🔥 Licht: ${run.light} Schritte</span><br>Lebenspunkte: ${p.hp} / ${maxHp(p)}`}${run.gold ? `${t`<br>Gefunden: ${run.gold} Gold`}${run.gems ? t`, ${run.gems} Edelsteine` : ''}` : ''}</p>
        ${festePad(s)}
      </div>
    </div>
    ${run.log.length ? `<section class="event-box log">${run.log.map((l) => `<p class="${l.k}">${esc(l.t)}</p>`).join('')}</section>` : ''}
    ${flashHtml()}`;
  return layout(s, main, [
    { title: t('Raus hier'), items: [{ act: 'festeLeave', label: t('Die Feste verlassen'), key: 'v', hint: t('für heute'), primary: false }] },
  ], 'feste-shell');
}

function heirloomsScreen(s: GameState): string {
  const p = s.player;
  const read = p.festeScrolls ?? 0;
  const main = `<h1>${t`Erbstücke der Wyrmjäger`}</h1>
    <p class="lead">${t`Was die Wyrmjäger in der Feste zurückgelassen haben. Jedes Erbstück bleibt dir für immer, auch nach dem Drachen.${(p.heirlooms?.length ?? 0) === HEIRLOOMS.length ? t(' Du hast sie alle: Du bist der Erbe der Wyrmjäger.') : ''}`}</p>
    <ul class="potions heirlooms">${HEIRLOOMS.map((h) => {
      const own = p.heirlooms?.includes(h.id);
      const img = festeArt(`erbstueck-${h.id}`);
      return `<li class="${own ? 'own' : 'missing'}">${img && own ? `<img src="${img}" alt="" class="heir-img">` : `<span class="heir-img empty">${own ? '✦' : '?'}</span>`}
        <strong>${own ? h.name : t('Noch nicht gefunden')}</strong><br><span class="gold">${own ? h.bonus : ''}</span>${own ? `<br><small class="muted">${h.blurb}</small>` : ''}</li>`;
    }).join('')}</ul>
    <h2>${t`Die Schriftrollen (${read} von ${SCROLLS.length})`}</h2>
    ${read ? SCROLLS.slice(0, read).map((sc) => `<p class="scroll">${t`„${esc(sc)}“`}</p>`).join('') : `<p class="muted">${t`Du hast noch keine Schriftrolle gefunden. Sie liegen in den Gängen der Feste.`}</p>`}`;
  return layout(s, main, [{ title: t('Zurück'), items: [{ act: 'go:feste', label: t('Zur Feste'), key: 'f' }, back] }]);
}

function quirinScreen(s: GameState): string {
  const p = s.player;
  const choice = p.pendingChoice === 'spec'
    ? `<section class="good-box"><h2>${t`Was hast du als Kind gelernt?`}</h2><p>${t`Wähle deine neue Fähigkeit. Deine Fähigkeitspunkte bleiben dir.`}</p>${specChoices(p.specialty, 'newspec')}</section>`
    : p.pendingChoice === 'race'
      ? `<section class="good-box"><h2>${t`Was wirst du?`}</h2><p>${t`Wähle deine neue Gestalt.`}</p>${raceChoices(p.race, p.specialty, p.gender, 'newrace')}</section>`
      : '';
  const main = `<h1>${t`Quirins Tränke`}</h1>
    <p class="lead">${t`Im schiefen Häuschen hinter dem Brunnen blubbert es aus hundert Kolben. Der Alchemist <span class="npc">Quirin</span> schiebt die Brille hoch. „Edelsteine gegen Tränke, so läuft das hier. Zwei pro Fläschchen. Nebenwirkungen auf eigene Gefahr.“`}</p>
    ${flashHtml()}
    ${choice}
    <ul class="potions">${POTIONS.map((pt) => `<li>${t`<strong>${pt.name}</strong> <span class="gem">${pt.gems} Edelsteine</span><br><span class="gold">${pt.effect}</span><br><small class="muted">${pt.blurb}</small>`}</li>`).join('')}</ul>
    <p class="muted">${t`Du hast`} ${p.gems === 1 ? t('einen Edelstein') : t`${p.gems} Edelsteine`}${p.potionHp ? t` · durch Lebenstränke schon +${p.potionHp} Lebenspunkte` : ''}.</p>`;
  return layout(s, main, [
    { title: t('Trinken'), items: POTIONS.map((pt, i) => ({
      act: `potion:${pt.id}`, label: pt.name, key: String(i + 1), hint: t`${pt.gems} Edelsteine`,
      disabled: p.gems < pt.gems || (!!p.pendingChoice && (pt.id === 'vergessen' || pt.id === 'verwandlung')),
    })) },
    { title: t('Zurück'), items: [back] },
  ]);
}

function seerScreen(s: GameState): string {
  const p = s.player;
  const cost = seerCost(p.level);
  const main = p.seerPaid
    ? `<h1 class="shadow-title">${t`In tiefer Trance`}</h1>
      <p class="lead">${t`Odas Kristallkugel beschlägt. Der Duft von Räucherwerk wird schwer, und plötzlich hörst du die Stimmen vom Nebelfluss, als stündest du am Ufer.`}</p>
      ${flashHtml()}
      ${squareHtml('schattenreich')}`
    : `<h1>${t`Das Zelt der Seherin`}</h1>
      <p class="lead">${t`Du duckst dich in ein buntes Zelt am Dorfrand. Hinter einer ziemlich fleckigen Kristallkugel sitzt die alte <span class="npc">Oda</span>. Man sagt, sie kann mit den Toten sprechen, und erstaunlich oft stimmt das sogar.`}</p>
      <p>${t`„Die Toten reden nur mit denen, die zahlen“, krächzt sie. „Für dich, ${p.gender === 'f' ? t('meine Hübsche') : t('mein Hübscher')}, nur lächerliche <span class="gold">${cost} Gold</span>. Für den ganzen Tag.“`}</p>
      ${flashHtml()}`;
  return layout(s, main, [
    { title: t('Seherin'), items: p.seerPaid ? [] : [{ act: 'seer', label: t('Bezahlen und mit den Toten reden'), key: 'b', hint: t`${cost} Gold`, disabled: p.gold < cost, primary: true }] },
    { title: t('Zurück'), items: [{ ...back, label: p.seerPaid ? t('Aus der Trance erwachen') : back.label }] },
  ]);
}

function felsenScreen(s: GameState): string {
  const p = s.player;
  const fame = (ui.fame ?? []).filter((f) => f.dragonKills > 0).slice(0, 12);
  const names = fame.length ? `<p class="carved">${fame.map((f) => `${esc(f.name)} <span class="muted">${f.dragonKills}×</span>`).join(' · ')}</p>` : '';
  const main = p.dragonKills > 0
    ? `<h1>${t`Der Wyrmstein`}</h1>
      <p class="lead">${t`Hinter dem Denkmal ragt ein gewaltiger, moosbewachsener Felsen auf. Wer den Brackenwyrm einmal bezwungen hat, ritzt hier seinen Namen ein, und abends treffen sich die Drachentöter auf den flachen Steinen davor.`}</p>
      ${names ? `<h2>${t`In den Stein geritzt`}</h2>${names}` : ''}
      ${flashHtml()}
      ${squareHtml('felsen')}`
    : `<h1>${t`Ein großer Felsen`}</h1>
      <p class="lead">${t`Hinter dem Denkmal ragt ein gewaltiger, moosbewachsener Felsen auf. Ein paar Gestalten sitzen davor und reden leise. Als du näherkommst, verstummen sie und schauen durch dich hindurch, als wärst du Nebel.`}</p>
      <p>${t`Ein alter Mann am Wegrand murmelt: „Der Wyrmstein ist nur für die, die den Drachen gesehen haben. Und überlebt.“`}</p>
      ${names ? `<h2>${t`In den Stein geritzt`}</h2>${names}` : ''}
      ${flashHtml()}`;
  return layout(s, main, [{ title: t('Zurück'), items: [back] }]);
}

function gartenScreen(s: GameState): string {
  const p = s.player;
  const main = `<h1>${t`Der Rosengarten`}</h1>
    <p class="lead">${t`Hinter Mirlas Kräuterhütte führt ein schmaler Weg in einen verwunschenen Garten. Rosen ranken über alte Bögen, Bienen summen, und auf den Bänken sitzen Paare, die so tun, als würden sie nur die Blumen ansehen.`}</p>
    ${p.marriedTo ? `<p class="muted">${t`Du denkst an ${esc(PARTNERS[p.marriedTo].name)} und pflückst heimlich eine Rose.`}</p>` : ''}
    ${flashHtml()}
    ${squareHtml('garten')}`;
  return layout(s, main, [{ title: t('Zurück'), items: [back] }]);
}

function ambrosScreen(s: GameState): string {
  const p = s.player;
  const g = ui.ambros;
  const left = AMBROS_GAMES_PER_DAY - (p.ambrosGames ?? 0);
  const last = g ? g.hints.length - 1 : -1;
  const main = `<h1>${t`Der alte Ambros`}</h1>
    <p class="lead">${t`Auf der Bank am Brunnen sitzt der alte Ambros und schnitzt an einem Stock. „Ich denk mir eine Zahl zwischen 1 und 100“, sagt er. „Du hast ${AMBROS_TRIES} Versuche. Errätst du sie, zahle ich dir deinen Einsatz doppelt. Wenn nicht, gehört er mir.“`}</p>
    ${flashHtml()}
    ${g ? `<div class="event-box log">${g.hints.length ? g.hints.map((h, i) => `<p class="${i === last && g.over === 'win' ? 'gold' : i === last && g.over === 'lose' ? 'bad' : 'info'}">${esc(h)}</p>`).join('') : `<p class="info">${t`Einsatz: ${g.bet} Gold. Ambros kneift ein Auge zu. „Na los.“`}</p>`}</div>
      ${g.over ? '' : `<div class="row say-row"><input type="number" id="guess" min="1" max="100" inputmode="numeric" placeholder="1–100" aria-label="${t`Deine Zahl`}"><button type="button" class="tbtn" data-act="guess">${t`Raten`}</button></div>`}` : ''}
    <p class="muted">${left > 0 ? t`Heute noch ${left} ${left === 1 ? t('Spiel') : t('Spiele')}.` : t('Für heute ist Ambros fertig mit Rechnen und döst in der Sonne.')}</p>`;
  const playing = !!g && !g.over;
  const groups: Group[] = [];
  if (!playing) groups.push({ title: t('Zahlenraten'), items: ambrosBets(p.level).map((b, i) => ({
    act: `ambros:${b}`, label: t`Um ${b} Gold spielen`, key: String(i + 1), disabled: left <= 0 || p.gold < b, primary: i === 0,
  })) });
  groups.push({ title: t('Zurück'), items: [back] });
  return layout(s, main, groups);
}

function hauntScreen(s: GameState): string {
  const p = s.player;
  const me = cloud.userId;
  const living = (ui.warriors ?? []).filter((w) => w.alive && w.userId !== me);
  const rows = ui.warriors === null ? `<p class="muted">${t`Du lauschst in die Welt der Lebenden …`}</p>`
    : !living.length ? `<p class="muted">${t`Gerade gibt es niemanden, den du heimsuchen könntest.`}</p>`
    : `<ul class="warriors">${living.map((w) => `<li class="warrior">
        <span class="t-portrait">${heroPortrait(w.race, w.specialty, w.gender)}${t`</span> <span class="t-info"><strong><span class="t-title">${esc(titleFor(w.dragonKills, w.gender))}</span> ${esc(w.name)}</strong> <small>Stufe ${w.level} · ${raceName(w.race, w.gender)}</small><small class="w-status">${statusOf(w)}</small></span>`}
        <button type="button" class="tbtn" data-act="haunt:${w.userId}" ${p.favor < HAUNT_FAVOR || ui.pvp.busy ? 'disabled' : ''}>${t`Heimsuchen`}</button>
      </li>`).join('')}</ul>`;
  const main = `<h1 class="shadow-title">${t`Heimsuchen`}</h1>
    <p class="lead">${t`Morwen stakt ihr Boot ans Ufer und reicht dir eine Laterne mit kaltem, blauem Licht. „Damit findest du den Weg in die Träume der Lebenden.“ Gelingt es, wacht dein Opfer morgen müde auf und verliert Waldkämpfe. Je höher deine Stufe im Vergleich zu deinem Opfer, desto eher klappt es.`}</p>
    ${flashHtml()}
    ${ui.listErr ? `<p class="warn-box">${esc(ui.listErr)}</p>` : ''}
    <p class="muted">${t`Deine Gunst: ${p.favor}. Jeder Versuch kostet ${HAUNT_FAVOR} Gunst, ob er gelingt oder nicht.`}</p>
    ${rows}`;
  return layout(s, main, [{ title: t('Schattenreich'), items: [{ act: 'go:shadows', label: t('Zurück zu Morwen'), key: 'm' }] }]);
}

function warriorsScreen(s: GameState): string {
  const list = ui.warriors;
  const me = cloud.userId;
  const rows = list === null ? `<p class="muted">${t`Du schaust auf die Liste am Rathaus …`}</p>`
    : !list.length ? `<p class="muted">${t`Noch niemand eingetragen.`}</p>`
    : `<ul class="warriors">${list.map((w) => `<li class="warrior ${w.userId === me ? 'me' : ''}">
        <span class="t-portrait">${heroPortrait(w.race, w.specialty, w.gender)}</span>
        <button type="button" class="t-info w-link" data-act="bio:${w.userId}" title="${t`Steckbrief ansehen`}">${ui.guild.tags.get(w.userId) ? `<span class="g-tag">[${esc(ui.guild.tags.get(w.userId)!)}]</span> ` : ''}${t`<strong><span class="t-title">${esc(titleFor(w.dragonKills, w.gender))}</span> ${esc(w.name)}</strong> <small>Stufe ${w.level} · ${raceName(w.race, w.gender)} · ${SPECIALTIES[w.specialty].name}`}${w.dragonKills ? t` · Drachentöter ${w.dragonKills}×` : ''}</small>
          <small class="w-status">${statusOf(w)}</small></button>
        ${w.userId === me ? '<span class="muted">du</span>' : `<button type="button" class="tbtn" data-act="write:${w.userId}">${t`Brief`}</button>`}
      </li>`).join('')}</ul>`;
  const online = list ? list.filter((w) => w.online).length : 0;
  const main = `<h1>${t`Kriegerliste`}</h1>
    <p class="lead">${t`Am Rathaus hängt eine Liste aller Helden von Moosgrund.`} ${list ? t`${list.length} ${list.length === 1 ? t('Held') : t('Helden')}, ${online} gerade unterwegs.` : ''}</p>
    ${ui.listErr ? `<p class="warn-box">${esc(ui.listErr)}</p>` : ''}
    ${rows}`;
  return layout(s, main, [
    { title: t('Kriegerliste'), items: [{ act: `bio:${me}`, label: t('Mein Steckbrief'), key: 's', disabled: !list?.some((w) => w.userId === me) }, { act: 'reloadlist', label: t('Neu laden'), key: 'n' }, { act: 'go:mail', label: t('Briefe'), key: 'i', hint: ui.unread ? t`${ui.unread} neu` : '' }] },
    { title: t('Zurück'), items: [back] },
  ]);
}

function mailScreen(s: GameState): string {
  const c = ui.compose;
  if (c) {
    const main = `<h1>${t`Brief an ${esc(c.toName)}`}</h1>
      ${flashHtml()}
      <label class="field">${t`Betreff`}<input type="text" id="mail-subject" maxlength="60" value="${esc(c.subject)}"></label>
      <label class="field">${t`Dein Brief`}<textarea id="mail-body" maxlength="1000" rows="7" placeholder="${t`Schreib etwas …`}">${esc(c.body)}</textarea></label>
      <p class="muted">${t`Ein Bote bringt den Brief sofort. Bitte freundlich bleiben, Moosgrund ist ein kleines Dorf.`}</p>`;
    return layout(s, main, [
      { title: t('Brief'), items: [{ act: 'mailsend', label: t('Abschicken'), key: 'a', primary: true }, { act: 'mailcancel', label: t('Verwerfen'), key: 'v' }] },
      { title: t('Zurück'), items: [back] },
    ]);
  }
  const list = ui.mail;
  const rows = list === null ? `<p class="muted">${t`Du siehst nach, ob Post da ist …`}</p>`
    : !list.length ? `<p class="muted">${t`Dein Postfach ist leer. Schreib doch jemandem aus der Kriegerliste.`}</p>`
    : `<ul class="mails">${list.filter((m) => !(m.from_user && ui.blocked.has(m.from_user))).map((m) => {
        const open = ui.mailOpen === m.id;
        return `<li class="mail ${m.seen ? '' : 'unread'} ${open ? 'open' : ''}">
          <button type="button" class="mail-head" data-act="mailopen:${m.id}" aria-expanded="${open}">
            <span class="mail-from">${esc(m.from_name ? (m.from_user ? titledLocal(m.from_name) : serverText(m.from_name)) : t('Unbekannt'))}</span><span class="muted">${when(m.created_at)}</span>
            <span class="mail-subj">${esc((m.from_user ? m.subject : serverText(m.subject)) || t('(ohne Betreff)'))}</span></button>
          ${open ? `<div class="mail-body"><p>${esc(m.from_user ? m.body : serverText(m.body)).replace(/\n/g, '<br>')}</p>
            <div class="row">${m.from_user ? `<button type="button" class="tbtn" data-act="reply:${m.id}">${t`Antworten`}</button>` : ''}
            <button type="button" class="tbtn" data-act="maildel:${m.id}">${t`Wegwerfen`}</button>
            ${m.from_user ? `<button type="button" class="tbtn ghost" data-act="rep:brief:${m.id}">${ui.repConfirm === `brief:${m.id}` ? t('Wirklich melden?') : t('Melden')}</button>
            <button type="button" class="tbtn ghost" data-act="block:${m.from_user}">${t`Absender blockieren`}</button>` : ''}</div></div>` : ''}
        </li>`;
      }).join('')}</ul>`;
  const main = `<h1>${t`Briefe`}</h1>
    <p class="lead">${t`Beim Rathaus hat jeder Held ein kleines Postfach.`}</p>
    ${flashHtml()}
    ${ui.listErr ? `<p class="warn-box">${esc(ui.listErr)}</p>` : ''}
    ${rows}`;
  return layout(s, main, [
    { title: t('Briefe'), items: [{ act: 'go:warriors', label: t('Brief schreiben'), key: 's', hint: t('aus der Kriegerliste') }, { act: 'reloadmail', label: t('Neu laden'), key: 'n' }] },
    { title: t('Zurück'), items: [back] },
  ]);
}

function loadWarriors(): void {
  ui.warriors = null; ui.listErr = '';
  render();
  cloud.guildTags().then((m) => { ui.guild.tags = m; }, () => {});
  cloud.warriors().then((r) => { ui.warriors = r; }, (e) => { ui.warriors = []; ui.listErr = e instanceof CloudError ? e.message : t('Die Liste ließ sich nicht laden.'); })
    .finally(() => { if (currentScreen() === 'warriors' || currentScreen() === 'haunt') render(); });
}

function loadMail(): void {
  ui.mail = null; ui.listErr = '';
  render();
  cloud.mailbox().then((r) => { ui.mail = r; ui.unread = r.filter((m) => !m.seen).length; }, (e) => { ui.mail = []; ui.listErr = e instanceof CloudError ? e.message : t('Die Briefe ließen sich nicht laden.'); })
    .finally(() => { if (currentScreen() === 'mail') render(); });
}

/** Schaut höchstens einmal pro Minute nach neuer Post (für den Hinweis im Dorf). */
function checkMail(): void {
  if (!cloud.signedIn || Date.now() - ui.unreadAt < 60_000) return;
  ui.unreadAt = Date.now();
  cloud.unreadMail().then((n) => {
    if (n !== ui.unread) { if (n > ui.unread) say(n === 1 ? t('Ein Bote hat dir einen Brief gebracht.') : t`Boten haben dir ${n} Briefe gebracht.`, 'gold'); ui.unread = n; if (currentScreen() === 'village') render(); }
  }, () => {});
}

function settingsScreen(s: GameState): string {
  const main = `<h1>${t`Einstellungen`}</h1>
    ${flashHtml()}
    <label class="toggle"><input type="checkbox" id="opt-motion" data-act="toggle:motion" ${prefs.reducedMotion ? 'checked' : ''}> ${t`Weniger Bewegung im Kampf`}</label>
    <h2>${t`Ton`}</h2>
    <label class="slider">${t`Musik`} <input type="range" min="0" max="100" step="5" data-act="vol:music" value="${Math.round(prefs.musicVol * 100)}" aria-label="${t`Lautstärke Musik`}"></label>
    <label class="slider">${t`Effekte`} <input type="range" min="0" max="100" step="5" data-act="vol:sfx" value="${Math.round(prefs.sfxVol * 100)}" aria-label="${t`Lautstärke Effekte`}"></label>
    <label class="toggle"><input type="checkbox" data-act="toggle:muted" ${prefs.muted ? 'checked' : ''}> ${t`Ton ganz aus`}</label>
    <h2>${t`Im Gasthaus umwerben`}</h2>
    <div class="seg" role="radiogroup" aria-label="${t`Wen umwerben`}">
      ${(['frieda', 'florian'] as const).map((id) => `<button type="button" class="seg-btn ${partnerOf(s.player) === id ? 'on' : ''}" role="radio" aria-checked="${partnerOf(s.player) === id}" data-act="lover:${id}">${id === 'frieda' ? t('Wirtin Frieda') : t('Barde Florian')}</button>`).join('')}
    </div>
    ${s.player.marriedTo ? `<p class="muted">${t`Du bist mit ${PARTNERS[s.player.marriedTo].name} verheiratet.`}</p>` : ''}
    ${cloud.enabled ? accountHtml() : ''}
    <h2>${t`Als App`}</h2>
    ${isStandalone() ? `<p class="muted">${t`Brackenwyrm läuft als App. Es startet vom Startbildschirm, im Vollbild und auch bei schlechtem Netz.`}</p>`
      : canInstall() ? `<p class="muted">${t`Leg Brackenwyrm als App auf deinen Startbildschirm: eigenes Symbol, Vollbild, schneller Start.`}</p><div class="row"><button type="button" class="tbtn" data-act="install">${t`Als App installieren`}</button></div>`
      : isIos() ? `<p class="muted">${t`Auf dem iPhone oder iPad: In Safari unten auf das Teilen-Symbol tippen (Quadrat mit Pfeil nach oben), dann „Zum Home-Bildschirm“.`}</p>`
      : `<p class="muted">${t`Im Browser-Menü findest du „App installieren“ oder „Zum Startbildschirm hinzufügen“. Dann startet Brackenwyrm wie eine App.`}</p>`}
    ${cloud.enabled && cloud.signedIn ? `<h2>${t`Vollversion`}</h2>${ui.full ? `<p class="good">${t`Freigeschaltet. Danke, dass du Brackenwyrm unterstützt!`}</p>` : `<p class="muted">${t`Bis zum ersten Drachen ist Brackenwyrm kostenlos. Danach geht es mit der Vollversion weiter (einmalig ${priceText()}). Hast du einen Code, kannst du ihn hier einlösen.`}</p>${redeemHtml()}`}` : ''}
    <h2>${t`Spielstand auf ein anderes Gerät mitnehmen`}</h2>
    <p class="muted">${cloud.signedIn ? t('Mit deinem Spielerkonto geht das automatisch. Der Code hier ist nur eine Notlösung, zum Beispiel als Sicherungskopie.') : t('Ohne Spielerkonto liegt der Spielstand nur in diesem Browser. Kopiere den Code und füge ihn auf dem anderen Gerät ein.')}</p>
    <textarea id="exportcode" readonly aria-label="${t`Spielstand-Code`}">${exportCode(s)}</textarea>
    <div class="row"><button type="button" class="tbtn" data-act="copycode">${t`Code kopieren`}</button></div>
    <textarea id="importcode" placeholder="${t`Code hier einfügen (beginnt mit BW1:)`}" aria-label="${t`Code einfügen`}"></textarea>
    <div class="row"><button type="button" class="tbtn" data-act="importcode">${t`Spielstand laden`}</button><span class="muted">${esc(ui.importMsg)}</span></div>`;
  return layout(s, main, [
    { title: t('Spielstand'), items: [
      ...(prefs.dev ? [{ act: 'testday', label: t('Neuer Tag (Testmodus)'), key: 'n', hint: t`sonst in ${waitText()}` }] : []),
      { act: 'feedback', label: t('Rückmeldung geben'), key: 'm' },
      ...(s.guide && !guideFinished(s.guide) ? [{ act: 'guide:skip', label: ui.confirmGuide ? t('Wirklich? Nochmal drücken.') : t('Einführung beenden'), key: 'f', hint: t('alle Orte sofort zeigen') }] : []),
      { act: 'delete', label: ui.confirmDelete ? t('Wirklich löschen? Nochmal drücken.') : t('Spielstand löschen'), key: 'x', hint: t('nur auf diesem Gerät') },
    ] },
    ...(cloud.signedIn ? [{ title: t('Spielerkonto'), items: [
      ...(ui.isAdmin ? [{ act: 'go:wache', label: t('Die Wache'), key: 'w', hint: t('Meldungen prüfen') }] : []),
      { act: 'go:blocks', label: t('Blockierte Spieler'), key: 'b', hint: ui.blocked.size ? String(ui.blocked.size) : '' },
      { act: 'go:deleteAccount', label: t('Konto löschen'), key: 'l', hint: t('mit allen Daten') },
    ] }] : []),
    { title: t('Sprache'), items: LANGS.filter((l) => l.id !== lang).map((l, i) => ({ act: `lang:${l.id}`, label: l.name, key: String(i + 1), hint: t('Spiel lädt neu') })) },
    { title: t('Rechtliches'), items: [
      { act: 'legal:datenschutz', label: t('Datenschutz'), key: 'p' },
      { act: 'legal:impressum', label: t('Impressum'), key: 'i' },
    ] },
    { title: t('Zurück'), items: [back] },
  ]);
}

function blocksScreen(s: GameState): string {
  const list = ui.blocksList;
  const main = `<h1>${t`Blockierte Spieler`}</h1>
    <p class="lead">${t`Von blockierten Spielern bekommst du keine Briefe mehr, und ihre Gespräche siehst du nicht. Sie erfahren nicht, dass du sie blockiert hast.`}</p>
    ${flashHtml()}
    ${list === null ? '<p class="muted">…</p>' : list.length ? `<ul class="warriors">${list.map((b) => `<li class="warrior"><span></span><span class="t-info"><strong>${esc(b.name)}</strong></span>
      <button type="button" class="tbtn" data-act="unblock:${b.blocked}">${t`Nicht mehr blockieren`}</button></li>`).join('')}</ul>`
      : `<p class="muted">${t`Du hast niemanden blockiert. Blockieren kannst du im Steckbrief eines Helden (Kriegerliste) oder bei einem Brief.`}</p>`}`;
  return layout(s, main, [{ title: t('Zurück'), items: [{ act: 'go:settings', label: t('Einstellungen'), key: 'e' }, back] }]);
}

function deleteAccountScreen(s: GameState): string {
  const main = `<h1>${t`Konto löschen`}</h1>
    <p class="lead">${t`Damit werden dein Spielerkonto und alles, was dazu auf dem Server liegt, sofort und endgültig gelöscht: Spielstand, Held in der Kriegerliste und Ruhmeshalle, deine Gespräche, Briefe an dich und deine Neuigkeiten. Das lässt sich nicht rückgängig machen.`}</p>
    <p>${t`Der Spielstand auf diesem Gerät wird ebenfalls gelöscht. Wenn du ihn behalten willst, kopiere vorher den Code unter Einstellungen.`}</p>
    ${flashHtml()}
    <label class="field">${t`Zum Bestätigen <strong>LÖSCHEN</strong> eintippen`}<input type="text" id="del-confirm" autocomplete="off" placeholder="${t`LÖSCHEN`}"></label>
    ${ui.delMsg ? `<p class="warn">${esc(ui.delMsg)}</p>` : ''}
    <div class="row"><button type="button" class="btn danger" data-act="delacct">${t`Konto endgültig löschen`}</button></div>`;
  return layout(s, main, [{ title: t('Zurück'), items: [{ act: 'go:settings', label: t('Doch nicht'), key: 'z', primary: true }] }]);
}

function loadWache(): void {
  const w = ui.wache;
  w.err = '';
  const fail = (e: unknown) => { w.err = e instanceof CloudError ? e.message : t('Das hat nicht geklappt.'); };
  if (w.tab === 'aushang') { loadAushang(); }
  if (w.tab === 'reports') { w.reports = null; cloud.modReports().then((r) => { w.reports = r; }, fail).finally(render); }
  if (w.tab === 'banned') { w.banned = null; cloud.modBanned().then((r) => { w.banned = r; }, fail).finally(render); }
  if (w.tab === 'cheats') { w.cheats = null; cloud.modCheats().then((r) => { w.cheats = r; }, fail).finally(render); }
  if (w.tab === 'vollversion') { w.codes = null; cloud.modCodes().then((r) => { w.codes = r; }, fail).finally(render); }
  render();
}

const KIND_NAMES: Record<ReportKind, string> = { chat: t('Gespräch'), brief: t('Brief'), steckbrief: t('Steckbrief'), name: t('Name') };

function wacheScreen(s: GameState): string {
  const w = ui.wache;
  let body = '';
  if (w.tab === 'reports') {
    body = w.reports === null ? '<p class="muted">…</p>' : !w.reports.length ? `<p class="muted">${t`Keine offenen Meldungen. Ruhig in Moosgrund.`}</p>`
      : `<ul class="mod-list">${w.reports.map((r, i) => `<li class="mod-item">
          <div class="mod-head">${t`<strong>${KIND_NAMES[r.kind]}</strong> von <strong>${esc(r.target_name)}</strong> <span class="muted">${r.reports}× gemeldet · ${when(r.first_at)}${r.hidden ? ' · ausgeblendet' : ''}${r.banned ? ' · gesperrt' : ''}</span>`}</div>
          <blockquote>${esc(r.content).replace(/\n/g, '<br>') || '<span class="muted">(leer)</span>'}</blockquote>
          <div class="row">
            <button type="button" class="tbtn" data-act="mod:ok:${i}">${r.kind === 'brief' ? t('Erledigt') : t('Fehlalarm, zeigen')}</button>
            ${r.kind === 'brief' ? '' : `<button type="button" class="tbtn" data-act="mod:hide:${i}">${t`Ausblenden`}</button>`}
            ${r.target && !r.banned ? `<button type="button" class="tbtn danger" data-act="mod:ban:${i}">${t`Sperren`}</button>` : ''}
          </div></li>`).join('')}</ul>`;
  } else if (w.tab === 'aushang') {
    body = `<section class="good-box"><h2>${t`Neuer Aushang`}</h2>
      <label class="field">${t`Überschrift`}<input type="text" id="au-title" maxlength="80" placeholder="${t`z. B. Neue Version: die Feste ist da`}"></label>
      <label class="field">${t`Text`}<textarea id="au-body" maxlength="1500" rows="5" placeholder="${t`Was alle wissen sollen …`}"></textarea></label>
      <div class="row"><button type="button" class="tbtn" data-act="aushangpost">${t`Anschlagen`}</button></div></section>
      ${(ui.aushang ?? []).map((a) => `<article class="notice"><h2>${esc(a.title)}</h2><p class="muted">${when(a.created_at)} · ${esc(a.author)}</p><p>${esc(a.body)}</p>
        <button type="button" class="tbtn ghost" data-act="aushangdel:${a.id}">${t`Abnehmen`}</button></article>`).join('')}`;
  } else if (w.tab === 'vollversion') {
    body = `<section class="good-box"><h2>${t`Vollversion verschenken`}</h2>
        <p class="muted">${t`Zum Beispiel für Tester. Der Held bekommt die Vollversion sofort, auf allen Geräten.`}</p>
        <div class="row"><input type="text" id="mod-hero" maxlength="40" placeholder="${t`Name des Helden`}" aria-label="${t`Name des Helden`}"><button type="button" class="tbtn" data-act="modfull:grant">${t`Freischalten`}</button></div></section>
      <section class="good-box"><h2>${t`Codes erzeugen`}</h2>
        <p class="muted">${t`Jeder Code schaltet genau ein Spielerkonto frei. Zum Verkaufen, Verschenken oder Verlosen.`}</p>
        <div class="row"><input type="number" id="mod-n" min="1" max="100" value="5" aria-label="${t`Anzahl`}"><input type="text" id="mod-note" maxlength="100" placeholder="${t`Notiz, z. B. Tester Oktober`}" aria-label="${t`Notiz`}"><button type="button" class="tbtn" data-act="modfull:codes">${t`Erzeugen`}</button></div>
        ${w.newCodes.length ? `<textarea readonly rows="${Math.min(10, w.newCodes.length + 1)}" aria-label="${t`Neue Codes`}">${w.newCodes.join('\n')}</textarea>` : ''}</section>
      <h2>${t`Alle Codes`}</h2>
      ${w.codes === null ? '<p class="muted">…</p>' : !w.codes.length ? `<p class="muted">${t`Noch keine Codes.`}</p>`
        : `<table class="mod-table"><thead><tr><th>${t`Code`}</th><th>${t`Notiz`}</th><th>${t`eingelöst von`}</th></tr></thead><tbody>${w.codes.map((c) => `<tr><td><code>${esc(c.code)}</code></td><td>${esc(c.note)}</td><td>${c.redeemed_by ? `${esc(c.redeemed_by)} <span class="muted">${c.redeemed_at ? when(c.redeemed_at) : ''}</span>` : '<span class="muted">–</span>'}</td></tr>`).join('')}</tbody></table>`}`;
  } else if (w.tab === 'banned') {
    body = w.banned === null ? '<p class="muted">…</p>' : !w.banned.length ? `<p class="muted">${t`Niemand ist gesperrt.`}</p>`
      : `<ul class="warriors">${w.banned.map((b) => `<li class="warrior">${t`<span></span><span class="t-info"><strong>${esc(b.name)}</strong><small>Stufe ${b.level} · ${b.dragon_kills} Drachenkills</small></span>`}
          <button type="button" class="tbtn" data-act="modban:${b.user_id}:off">${t`Entsperren`}</button></li>`).join('')}</ul>`;
  } else {
    body = w.cheats === null ? '<p class="muted">…</p>' : !w.cheats.length ? `<p class="muted">${t`Nichts Auffälliges.`}</p>`
      : `<p class="muted">${t`Hier landet, was der Server an Spielwerten korrigiert hat. Einzelne Einträge können von Offline-Spielen kommen; wiederholt hohe Werte deuten auf Schummeln.`}</p>
        <table class="mod-table"><thead><tr><th>${t`Wann`}</th><th>${t`Held`}</th><th>${t`Wert`}</th><th>${t`geschickt`}</th><th>${t`behalten`}</th><th></th></tr></thead><tbody>
        ${w.cheats.map((c) => `<tr><td>${when(c.created_at)}</td><td>${esc(c.name)}</td><td>${esc(c.field)}</td><td>${esc(c.sent)}</td><td>${esc(c.kept)}</td>
          <td>${c.banned ? t('gesperrt') : `<button type="button" class="tbtn danger" data-act="modban:${c.user_id}:on">${t`Sperren`}</button>`}</td></tr>`).join('')}</tbody></table>`;
  }
  const main = `<h1>${t`Die Wache`}</h1>
    <p class="lead">${t`Hier prüfst du, was Spieler gemeldet haben. Ab drei Meldungen ist ein Beitrag schon ausgeblendet, bis du entscheidest.`}</p>
    ${flashHtml()}${w.err ? `<p class="warn-box">${esc(w.err)}</p>` : ''}
    ${body}`;
  return layout(s, main, [
    { title: t('Die Wache'), items: [
      { act: 'wache:aushang', label: t('Aushang schreiben'), key: 'x', primary: w.tab === 'aushang' },
      { act: 'wache:reports', label: t('Meldungen'), key: 'm', hint: w.reports?.length ? String(w.reports.length) : '', primary: w.tab === 'reports' },
      { act: 'wache:cheats', label: t('Auffällige Spielstände'), key: 'a', primary: w.tab === 'cheats' },
      { act: 'wache:banned', label: t('Gesperrte'), key: 'g', primary: w.tab === 'banned' },
      { act: 'wache:vollversion', label: t('Vollversion und Codes'), key: 'v', primary: w.tab === 'vollversion' },
    ] },
    { title: t('Zurück'), items: [{ act: 'go:settings', label: t('Einstellungen'), key: 'e' }, back] },
  ]);
}

function shadowsScreen(s: GameState): string {
  const p = s.player;
  const cost = soulRestoreCost(p);
  const canBack = p.favor >= RESURRECT_FAVOR;
  const main = `<h1 class="shadow-title">${t`Das Schattenreich`}</h1>
    ${s.news.length ? `<section class="news"><h2>${t`Neuigkeiten`}</h2>${s.news.slice(-3).map((n) => `<p>${esc(n)}</p>`).join('')}</section>` : ''}
    <p class="lead">${t`Grauer Nebel, ein stiller Fluss. <span class="npc">Morwen</span> stakt ihr Boot heran. „Du schon wieder“, sagt sie. „Setz dich. Wenn die Dorfuhr den nächsten Tag schlägt, bringe ich dich zurück.“`}</p>
    <p>${t`Am Ufer treiben verirrte Seelen. „Wenn du mir ein paar davon vom Hals schaffst“, sagt Morwen, „fahre ich dich vielleicht früher zurück.“`}
      ${canBack ? `${t`<span class="place">Du hast genug Gunst für die Rückkehr.</span>`}` : `${t`Dafür brauchst du <span class="gem">${RESURRECT_FAVOR} Gunst</span>, du hast ${p.favor}.`}`}</p>
    <div class="progress">${bar(p.favor, RESURRECT_FAVOR, 'favor')}</div>
    <p class="muted">${t`Neuer Tag in ${waitText()}. Gold im Kontor ist sicher.`}</p>
    ${flashHtml()}
    ${cloud.enabled ? squareHtml('schattenreich') : ''}`;
  return layout(s, main, [{ title: t('Am Nebelfluss'), items: [
    { act: 'grave', label: t('Gegen Seelen kämpfen'), key: 'k', hint: t`${p.graveFights} Schattenkämpfe`, disabled: p.graveFights <= 0 || p.soul <= 0, primary: !canBack },
    { act: 'resurrect', label: t('Morwen um Rückkehr bitten'), key: 'r', hint: t`${p.favor} / ${RESURRECT_FAVOR} Gunst`, disabled: !canBack, primary: canBack },
    { act: 'soul', label: t('Seelenkraft stärken'), key: 's', hint: p.soul >= maxSoul(p) ? t('voll') : t`${cost} Gunst`, disabled: p.soul >= maxSoul(p) || p.favor < cost },
    ...(cloud.enabled ? [{ act: 'go:haunt', label: t('Einen Lebenden heimsuchen'), key: 'h', hint: !cloud.signedIn ? t('nur mit Spielerkonto') : t`${HAUNT_FAVOR} Gunst`, disabled: !cloud.signedIn || p.favor < HAUNT_FAVOR }] : []),
  ] }, { title: t('Sonstiges'), items: [
    ...(prefs.dev ? [{ act: 'testday', label: t('Neuer Tag (Testmodus)'), key: 'n' }] : []),
    { act: 'feedback', label: t('Rückmeldung geben'), key: 'm' },
    { act: 'go:settings', label: t('Einstellungen'), key: 'e' },
  ] }]);
}

const DK_POINTS: { id: DragonPoint; name: string; text: string }[] = [
  { id: 'ff', name: t('+1 Waldkampf'), text: t('Jeden Tag einen Waldkampf mehr. Wer öfter in den Wald geht, ist schneller wieder beim Drachen.') },
  { id: 'hp', name: t('+5 Lebenspunkte'), text: t('Dauerhaft mehr Lebenskraft, auf jeder Stufe.') },
  { id: 'atk', name: t('+1 Angriff'), text: t('Deine Schläge sitzen fester. Für immer.') },
  { id: 'def', name: t('+1 Verteidigung'), text: t('Du weißt jetzt, wie man einem Wyrmzahn ausweicht.') },
];

// ---------- Vollversion ----------
let fullLoading = false;
/** Darf der Held nach dem Drachen weiterspielen? Ohne Server (lokale Testfassung) gibt es keine Sperre. */
function fullOk(): boolean {
  return !cloud.enabled || ui.full === true;
}
function loadFull(): void {
  if (!cloud.enabled) { ui.full = true; return; }
  if (!cloud.signedIn) { ui.full = false; return; }
  const cached = prefs.full && prefs.full.uid === cloud.userId ? prefs.full.ok : null;
  if (cached !== null) ui.full = cached;
  fullLoading = true;
  cloud.hasFull().then((ok) => { ui.full = ok; prefs.full = { uid: cloud.userId, ok }; savePrefs(prefs); },
    () => { ui.full = cached ?? false; })
    .finally(() => { fullLoading = false; render(); });
}

const CODE_HINT = 'BW-XXXX-XXXX'; // i18n-ignore

function redeemHtml(): string {
  return `<div class="row"><input type="text" id="unlock-code" maxlength="20" placeholder="${CODE_HINT}" aria-label="${t`Code`}" autocomplete="off" style="text-transform:uppercase"><button type="button" class="tbtn" data-act="redeem">${t`Code einlösen`}</button></div>
    ${ui.fullMsg ? `<p class="muted">${esc(ui.fullMsg)}</p>` : ''}`;
}

function vollversionScreen(s: GameState): string {
  const p = s.player;
  const buy = SHOP.buyUrl
    ? `<p><a class="btn" href="${esc(SHOP.buyUrl)}" target="_blank" rel="noopener">${t`Vollversion kaufen (${priceText()})`}</a></p><p class="muted">${t`Nach dem Kauf bekommst du einen Code. Den gibst du hier ein.`}</p>`
    : `<p class="muted">${t`Bald kannst du die Vollversion hier für einmalig ${priceText()} kaufen. Bis dahin schalten wir sie für dich frei: Schreib uns über „Rückmeldung geben“ oder löse einen Code ein, wenn du einen hast.`}</p>`;
  const main = `<h1>${FULL_TEXT.title}</h1>
    <p class="lead">${FULL_TEXT.lead}</p>
    <p>${FULL_TEXT.more}</p>
    <section class="good-box"><h2>${t`Vollversion`}</h2>
      <p>${FULL_TEXT.fair}</p>
      ${!cloud.signedIn ? `<p class="warn-box">${t`Die Vollversion hängt an deinem Spielerkonto. Lege zuerst in den Einstellungen ein Konto an oder melde dich an. Dein Held wartet so lange hier.`}</p>`
        : ui.full === null ? `<p class="muted">${t`Prüfe, ob du die Vollversion schon hast …`}</p>` : `${buy}<h3>${t`Code einlösen`}</h3>${redeemHtml()}`}
    </section>
    <p class="muted">${t`Dein Held ${esc(p.name)} bleibt genau so, wie er ist. Sobald die Vollversion freigeschaltet ist, geht es hier weiter.`}</p>`;
  return layout(s, main, [{ title: t('Weiter'), items: [
    { act: 'go:settings', label: cloud.signedIn ? t('Einstellungen') : t('Spielerkonto anlegen'), key: 'e', primary: !cloud.signedIn },
    { act: 'feedback', label: t('Rückmeldung geben'), key: 'm' },
  ] }]);
}

function dragonBonusScreen(s: GameState): string {
  const p = s.player;
  const dk = p.dragonKills;
  const title = titleFor(dk, p.gender);
  const spec = ui.dkSpec ?? p.specialty;
  const race = ui.dkRace ?? p.race;
  const gold = restartGold(dk) + (s.flawlessDragon ? FLAWLESS_GOLD : 0);
  const gems = restartGems(dk) + (s.flawlessDragon ? 1 : 0);
  const counts = (id: DragonPoint) => p.dragonPoints.filter((x) => x === id).length;
  const main = `<div class="speaker">${cardHtml(dragonCard(), { cls: 'mini is-defeated' })}<div>
    <h1>${t`Drachentöter!`}</h1>
    <p class="lead">${t`Ganz Moosgrund läuft zusammen. Frieda schenkt aus, Florian dichtet, Mirla weint ein bisschen. Der Dorfrat ernennt dich feierlich: Von heute an heißt du <strong class="gold">${esc(title)} ${esc(p.name)}</strong>.`}</p>
    <p>${t`Doch die alten Geschichten sagen: Ein Wyrm stirbt nie ganz. Du wirst wieder bei Stufe 1 anfangen, ohne Ausrüstung, ohne Gold im Kontor. Etwas von diesem Tag bleibt dir aber für immer.`}</p></div></div>
    ${s.flawlessDragon ? `<p class="good-box">${t`Ohne einen einzigen Kratzer! Dafür gibt es ${FLAWLESS_GOLD} Gold und einen Edelstein extra.`}</p>` : ''}
    <h2>${t`1. Dein Drachenpunkt`}</h2>
    <div class="choices dk-points" role="radiogroup" aria-label="${t`Drachenpunkt`}">
      ${DK_POINTS.map((d) => `<button type="button" class="choice ${ui.dkPoint === d.id ? 'on' : ''}" role="radio" aria-checked="${ui.dkPoint === d.id}" data-act="dkpoint:${d.id}">
        <strong>${d.name}</strong><span>${d.text}</span>${counts(d.id) ? `${t`<small>Bisher ${counts(d.id)}× gewählt</small>`}` : ''}</button>`).join('')}
    </div>
    <h2>${t`2. Wer wirst du in deinem neuen Leben?`}</h2>
    <p class="muted">${t`Mit dem neuen Leben darfst du Rasse und Fähigkeit neu wählen. Du kannst auch alles so lassen.`}</p>
    ${raceChoices(race, spec, p.gender, 'dkrace')}
    <h2>${t`3. Was hast du als Kind gemacht?`}</h2>
    ${specChoices(spec, 'dkspec')}
    <h2>${t`Das nimmst du mit`}</h2>
    <ul class="plain">
      <li>${t`${gold} Gold für den Neuanfang`}${gems ? (gems > 1 ? t` und ${gems} Edelsteine dazu` : t(' und 1 Edelstein dazu')) : ''}</li>
      <li>${t`Deine ${p.gems} Edelsteine, Morwens Gunst, dein Bestiarium und deine Ruhmeshalle`}</li>
      <li>${p.dragonPoints.length ? t`Deine bisherigen Drachenpunkte (${[p.bonusAtk ? t`+${p.bonusAtk} Angriff` : '', p.bonusDef ? t`+${p.bonusDef} Verteidigung` : '', p.baseMaxHp ? t`+${p.baseMaxHp} Lebenspunkte` : '', p.bonusFights ? t`+${p.bonusFights} Waldkämpfe` : ''].filter(Boolean).join(', ')}) und den neuen dazu` : t('Deinen ersten Drachenpunkt')}</li>
      <li>${t`Ein frischer Tag mit ${forestFightsPerDay({ ...p, race }) + (ui.dkPoint === 'ff' ? 1 : 0)} Waldkämpfen`}</li>
    </ul>
    ${!ui.dkPoint ? `<p class="muted">${t`Wähle zuerst deinen Drachenpunkt.`}</p>` : ''}`;
  return layout(s, main, [{ title: t('Neuanfang'), items: [
    { act: 'rebirth', label: t('Neues Leben beginnen'), key: 'n', disabled: !ui.dkPoint, primary: true, hint: ui.dkPoint ? `${DK_POINTS.find((d) => d.id === ui.dkPoint)!.name} · ${raceName(race, p.gender)} · ${SPECIALTIES[spec].name}` : t('erst Drachenpunkt wählen') },
  ] }]);
}

// ---------- Steuerung ----------

function currentScreen(): Screen {
  if (ui.screen === 'impressum' || ui.screen === 'datenschutz') return ui.screen;
  if (!state) return ui.screen === 'create' || ui.screen === 'login' ? ui.screen : 'title';
  if (ui.screen === 'title' || ui.screen === 'create' || ui.screen === 'login') return ui.screen;
  if (state.pendingDragonBonus && !state.fight) {
    if (fullOk()) return 'dragonBonus';
    return ['settings', 'feedback', 'impressum', 'datenschutz', 'wache'].includes(ui.screen) ? ui.screen : 'vollversion';
  }
  if (ui.conflict) return 'syncConflict';
  if (state.fight) return 'fight';
  // Tote bleiben im Schattenreich, dürfen aber spuken, Briefe lesen und die Neuigkeiten sehen.
  if (!state.player.alive && !['settings', 'feedback', 'haunt', 'mail', 'warriors', 'news', 'bio', 'wache', 'blocks', 'deleteAccount'].includes(ui.screen)) return 'shadows';
  return ui.screen;
}

export function render(): void {
  const s = state;
  document.body.classList.toggle('reduced', prefs.reducedMotion);
  const scr = currentScreen();
  if (s?.guide && !['title', 'create', 'login', 'impressum', 'datenschutz'].includes(scr)) {
    const msgs = guideUpdate(s);
    let dirty = msgs.length > 0;
    if (msgs.length) { ui.guideToast.push(...msgs); if (msgs.some((m) => m.startsWith('✓'))) sound.play('coins'); }
    if (SCREEN_HINTS[scr] && !s.guide.seen.includes(scr)) { s.guide.seen.push(scr); ui.hint = scr; dirty = true; }
    if (dirty) { saveGame(s); scheduleSync(); }
  }
  const views: Record<Screen, () => string> = {
    title: titleScreen, create: createScreen, login: loginScreen,
    village: () => villageScreen(s!), forest: () => forestScreen(s!), fight: () => fightScreen(s!),
    training: () => trainingScreen(s!), healer: () => healerScreen(s!), smith: () => smithScreen(s!),
    bank: () => bankScreen(s!), inn: () => innScreen(s!), bestiary: () => bestiaryScreen(s!), fame: () => fameScreen(s!), syncConflict: () => syncConflictScreen(s!), fields: () => fieldsScreen(s!), innGuests: () => innGuestsScreen(s!), news: () => newsScreen(s!), chronicle: () => chronicleScreen(s!), feedback: () => feedbackScreen(s!),
    settings: () => settingsScreen(s!), shadows: () => shadowsScreen(s!), dragonBonus: () => dragonBonusScreen(s!), vollversion: () => vollversionScreen(s!), flirt: () => flirtScreen(s!), stable: () => stableScreen(s!), warriors: () => warriorsScreen(s!), mail: () => mailScreen(s!), haunt: () => hauntScreen(s!), bio: () => bioScreen(s!), ambros: () => ambrosScreen(s!), quirin: () => quirinScreen(s!), tresen: () => tresenScreen(s!), dag: () => dagScreen(s!), fivesix: () => fivesixScreen(s!), aushang: () => aushangScreen(s!), lager: () => lagerScreen(s!), gilde: () => gildeScreen(s!), feste: () => festeScreen(s!), heirlooms: () => heirloomsScreen(s!), seer: () => seerScreen(s!), felsen: () => felsenScreen(s!), garten: () => gartenScreen(s!),
    impressum: () => legalScreen('impressum'), datenschutz: () => legalScreen('datenschutz'), wache: () => wacheScreen(s!), blocks: () => blocksScreen(s!), deleteAccount: () => deleteAccountScreen(s!),
  };
  root.innerHTML = views[scr]();
  sound.music(trackFor(scr));
  soundCues();
  if (cloud.signedIn && !safetyLoaded) loadSafety();
  if (ui.full === null && !fullLoading) loadFull();
  if (scr === 'village') { loadSquare('dorfplatz'); checkMail(); loadStatue(); if (ui.aushang === null) { ui.aushang = []; loadAushang(); } }
  if (scr === 'inn') loadSquare('gasthaus');
  if (scr === 'shadows') loadSquare('schattenreich');
  if (scr === 'seer' && s?.player.seerPaid) loadSquare('schattenreich');
  if (scr === 'felsen' && s && s.player.dragonKills > 0) loadSquare('felsen');
  if (scr === 'garten') loadSquare('garten');
  if (scr === 'gilde' && ui.guild.mine && ui.guild.mine.rank !== 'applicant') loadSquare('gilde');
  // Der neueste Kampftext steht unten, also dorthin scrollen.
  const fl = root.querySelector<HTMLElement>('.battle .fight-log');
  if (fl) fl.scrollTop = fl.scrollHeight;
}

/** Welche Musik zu welchem Ort gehört. */
/** Sobald es ein eigenes Musikstück für die Feste gibt (public/audio/music/musik-feste.mp3), auf true setzen. */
const FESTE_MUSIC = true;

function trackFor(scr: Screen): TrackId {
  const s = state;
  if (scr === 'title' || scr === 'create' || scr === 'login' || !s) return 'titel';
  if (scr === 'fight' && s.fight && s.fight.kind !== 'feste') return s.fight.kind === 'dragon' ? 'drache' : s.fight.kind === 'grave' ? 'schattenreich' : 'kampf';
  if (scr === 'fight' && s.fight?.monsterId === 'hueter') return 'kampf';
  if (!s.player.alive || scr === 'shadows' || scr === 'haunt' || (scr === 'seer' && s.player.seerPaid)) return 'schattenreich';
  if (scr === 'feste' || scr === 'heirlooms' || (scr === 'fight' && s.fight?.kind === 'feste')) return FESTE_MUSIC ? 'feste' : 'schattenreich';
  if (scr === 'forest') return 'wald';
  if (scr === 'inn' || scr === 'flirt' || scr === 'innGuests' || scr === 'tresen' || scr === 'dag' || scr === 'fivesix') return 'gasthaus';
  return 'dorf';
}

// Klänge ergeben sich aus dem, was sich seit dem letzten Bild geändert hat. So muss nicht jede Aktion selbst Töne auslösen.
let lastAct = 0;
let snap: { gold: number; gems: number; level: number; seq: number; fightKey: string; over: string; alive: boolean; card: string | null; event: string; unread: number } | null = null;

function soundCues(): void {
  const s = state;
  if (!s) { snap = null; return; }
  const p = s.player;
  const f = s.fight;
  const now = { gold: p.gold, gems: p.gems, level: p.level, seq: f?.seq ?? 0, fightKey: f ? `${f.monsterId}:${f.foe.maxHp}` : '', over: f?.over ?? '', alive: p.alive, card: ui.newCard, event: s.pendingEvent?.id ?? '', unread: ui.unread };
  const before = snap;
  snap = now;
  if (!before || !sound.ready) return;
  if (now.unread > before.unread) sound.play('letter');
  if (Date.now() - lastAct > 4000) return;  // nur auf eigene Aktionen reagieren, nicht auf den Abgleich im Hintergrund
  if (f && now.fightKey === before.fightKey && now.seq !== before.seq) {
    if (f.lastSpecial) sound.play(s.player.specialty);
    if (f.lastCrit) sound.play('crit', { delay: 0.05 });
    else if (f.lastHeroDmg > 0) sound.play('hit', { delay: 0.05, vary: true });
    else if (f.lastHeroMiss) sound.play('miss', { vary: true });
    if (f.lastFoeDmg > 0) sound.play('hurt', { delay: 0.3, vary: true });
    else if (f.lastFoeMiss && !f.over) sound.play('miss', { delay: 0.3, volume: 0.6, vary: true });
    if (f.over === 'win' && before.over !== 'win') {
      if (f.kind === 'dragon') sound.jingle('fanfare'); else sound.play('win', { delay: 0.35 });
    }
    if (f.over === 'lose' && before.over !== 'lose') sound.play('death', { delay: 0.4 });
  }
  if (!now.alive && before.alive && !f) sound.play('death');
  if (now.level > before.level) sound.play('levelup', { delay: 0.6 });
  if (now.card && now.card !== before.card) sound.play('card', { delay: 0.9 });
  if (now.event && now.event !== before.event) sound.play('event');
  if (now.gold > before.gold) sound.play('coins', { delay: f?.over === 'win' ? 0.6 : 0 });
  else if (now.gold < before.gold && now.alive) sound.play('buy');
  if (now.gems > before.gems) sound.play('gem', { delay: 0.3 });
}

function go(screen: Screen): void {
  ui.screen = screen;
  ui.menuOpen = false;
  ui.flash = [];
  ui.confirmDelete = false;
  ui.confirmNew = false;
  render();
  window.scrollTo(0, 0);
}

function commit(): void {
  if (state) saveGame(state);
  render();
  scheduleSync();
}

// ---------- Abgleich mit dem Online-Spielstand ----------

let syncTimer = 0;
let syncing = false;

/** Nach Änderungen kurz warten und dann abgleichen, damit nicht jeder Klick eine Anfrage auslöst. */
/** Vor einem Serveraufruf, der Gold oder Werte ändert: eigenen Stand hochladen und als abgeglichen merken. */
async function pushFirst(st: GameState): Promise<void> {
  saveGame(st);
  try {
    await cloud.push(JSON.parse(JSON.stringify(st)) as GameState);
    prefs.lastSyncedAt = st.savedAt ?? 0;
    savePrefs(prefs);
  } catch { /* der Server prüft selbst */ }
}

function scheduleSync(delay = 8000): void {
  if (!cloud.enabled || !cloud.signedIn) return;
  window.clearTimeout(syncTimer);
  syncTimer = window.setTimeout(() => void syncNow(), delay);
}

async function syncNow(): Promise<string> {
  if (!cloud.signedIn || syncing || ui.conflict) return '';
  syncing = true;
  try {
    const remote = await cloud.pull();
    let local = state;
    const d = decideSync({ local: local?.savedAt ?? null, remote: remote?.savedAt ?? null, lastSynced: prefs.lastSyncedAt });
    if ((d === 'pull' || d === 'conflict') && local?.fight) {
      scheduleSync(15000);  // nie mitten im Kampf austauschen oder nachfragen: nach dem Kampf erneut versuchen
      return '';
    }
    if (d === 'conflict' && remote) {
      ui.conflict = remote;
      render();
      return t('Zwei Spielstände gefunden.');
    }
    if (d === 'pull' && remote) {
      state = remote.state;
      local = state;
      localSaveWithoutTouch(state);
      prefs.lastSyncedAt = remote.savedAt;
    }
    let changed = false;
    if (local && !local.fight) {
      // Was ist passiert, während ich geschlafen habe? (Überfälle anderer Spieler)
      const events = await cloud.pvpEvents();
      if (events.length) {
        const lines = applyPvpEvents(local, events);
        saveGame(local);
        await cloud.ackEvents(events.map((e) => e.id));
        ui.flash = lines.map((t) => ({ t, k: 'warn' as const }));
        changed = true;
      }
      // Eigene Meldungen für die Tagesneuigkeiten verschicken (vor dem Hochladen leeren, damit nichts doppelt kommt)
      if (local.outbox.length) {
        const out = local.outbox.splice(0);
        saveGame(local);
        for (const t of out) await cloud.postNews(t).catch(() => {});
        changed = true;
      }
    }
    if (local && (d === 'push' || changed || (local.savedAt ?? 0) > prefs.lastSyncedAt)) {
      const pushedAt = local.savedAt ?? 0;  // merken, was wirklich hochging (während des Hochladens kann weitergespielt werden)
      await cloud.push(JSON.parse(JSON.stringify(local)) as GameState);
      prefs.lastSyncedAt = pushedAt;
    }
    savePrefs(prefs);
    if (d === 'pull' || changed) render();
    return d === 'none' && !changed ? t('Alles aktuell.') : d === 'pull' ? t('Online-Stand geladen.') : t('Online gesichert.');
  } catch (e) {
    return e instanceof CloudError ? e.message : t('Abgleich fehlgeschlagen.');
  } finally {
    syncing = false;
  }
}

/** Speichert einen vom Server geladenen Stand, ohne seinen Zeitpunkt zu ändern. */
function localSaveWithoutTouch(st: GameState): void {
  saveGame(st, true);
}

function handle(act: string, el: HTMLElement): void {
  const [cmd, a, b] = act.split(':');
  const s = state;
  if (cmd !== 'menu' && cmd !== 'hintclose') ui.guideToast = [];
  if (cmd !== 'guide') ui.confirmGuide = false;
  if (s && cmd === 'go') guideVisit(s, act);
  switch (cmd) {
    case 'menu': ui.menuOpen = !ui.menuOpen; render(); return;
    case 'hintclose': ui.hint = ''; render(); return;
    case 'lang': if (state) saveGame(state); switchLang(a as 'de' | 'en'); return;
    case 'guide': {
      if (!s) return;
      if (a === 'end') { closeGuide(s); commit(); return; }
      if (a === 'skip') {
        if (!ui.confirmGuide) { ui.confirmGuide = true; render(); return; }
        ui.confirmGuide = false; skipGuide(s); say(t('Alles klar. Ab jetzt siehst du alle Orte. Die kurzen Hinweise beim ersten Besuch bleiben.'), 'info'); commit();
      }
      return;
    }
    case 'skills': ui.skillMenu = !ui.skillMenu; render(); return;
    case 'reloadlist': loadWarriors(); return;
    case 'festeEnter': {
      if (!s) return;
      if (!enterFeste(s, gameDayKey())) { say(t('Heute kommst du nicht hinein.'), 'warn'); render(); return; }
      ui.flash = []; saveGame(s); scheduleSync(); render(); window.scrollTo(0, 0);
      return;
    }
    case 'feste': {
      if (!s || !s.feste) return;
      moveFeste(s, a as Dir);
      ui.flash = [];
      commit();
      if (s.fight) window.scrollTo(0, 0);
      return;
    }
    case 'festeLeave': if (!s) return; leaveFeste(s); commit(); return;
    case 'potion': {
      if (!s) return;
      const r = drinkPotion(s, a as PotionId);
      if (!r.ok) { say(r.why, 'warn'); render(); return; }
      ui.flash = r.lines.map((t, i) => ({ t, k: i ? 'good' as const : 'info' as const }));
      saveGame(s); scheduleSync(); render();
      return;
    }
    case 'newspec': {
      if (!s) return;
      const msg = chooseNewSpecialty(s, a as SpecialtyId);
      if (msg) { ui.flash = [{ t: msg, k: 'good' }]; saveGame(s); scheduleSync(); }
      render(); return;
    }
    case 'newrace': {
      if (!s) return;
      const msg = chooseNewRace(s, a as RaceId);
      if (msg) { ui.flash = [{ t: msg, k: 'good' }]; saveGame(s); scheduleSync(); }
      render(); return;
    }
    case 'seer': {
      if (!s) return;
      const why = paySeer(s);
      if (why) { say(why, 'warn'); render(); return; }
      saveGame(s); scheduleSync(); ui.flash = []; render();
      return;
    }
    case 'legal':
      if (ui.screen !== 'impressum' && ui.screen !== 'datenschutz') ui.legalFrom = state ? currentScreen() : 'title';
      go(a as Screen); window.scrollTo(0, 0); return;
    case 'rep': {
      const key = `${a}:${b}`;
      if (ui.repConfirm !== key) { ui.repConfirm = key; render(); return; }
      ui.repConfirm = '';
      const kind = a as ReportKind;
      const byId = kind === 'chat' || kind === 'brief';
      cloud.report(kind, byId ? Number(b) : 0, byId ? null : b).then((m) => say(m, 'good'), (e) => say(e instanceof CloudError ? e.message : t('Melden hat nicht geklappt.'), 'warn')).finally(render);
      return;
    }
    case 'block': {
      if (!a || a === cloud.userId) return;
      cloud.block(a).then(() => {
        ui.blocked.add(a);
        const name = ui.warriors?.find((w) => w.userId === a)?.name ?? ui.mail?.find((m) => m.from_user === a)?.from_name ?? t('Unbekannt');
        ui.blocksList = [...(ui.blocksList ?? []).filter((x) => x.blocked !== a), { blocked: a, name }];
        ui.mailOpen = null;
        say(t('Blockiert. Von diesem Helden hörst du nichts mehr.'), 'good');
      }, (e) => say(e instanceof CloudError ? e.message : t('Blockieren hat nicht geklappt.'), 'warn')).finally(render);
      return;
    }
    case 'unblock': {
      cloud.unblock(a).then(() => {
        ui.blocked.delete(a);
        ui.blocksList = (ui.blocksList ?? []).filter((x) => x.blocked !== a);
        say(t('Nicht mehr blockiert.'), 'good');
      }, (e) => say(e instanceof CloudError ? e.message : t('Das hat nicht geklappt.'), 'warn')).finally(render);
      return;
    }
    case 'install':
      install().then((ok) => { if (ok) say(t('Brackenwyrm liegt jetzt auf deinem Startbildschirm.'), 'good'); render(); }, () => {});
      return;
    case 'redeem': {
      const code = ((document.getElementById('unlock-code') as HTMLInputElement | null)?.value ?? '').trim();
      if (code.replace(/[^A-Za-z0-9]/g, '').length < 8) { ui.fullMsg = t('Ein Code sieht so aus: BW-XXXX-XXXX'); render(); return; }
      ui.fullMsg = t('Prüfe den Code …'); render();
      cloud.redeemCode(code).then((r) => {
        if (!r.ok) { ui.fullMsg = serverText(r.error ?? '') || t('Das hat nicht geklappt.'); return; }
        ui.full = true; prefs.full = { uid: cloud.userId, ok: true }; savePrefs(prefs);
        ui.fullMsg = '';
        say(t('Die Vollversion ist freigeschaltet. Viel Spaß mit allem, was nach dem Drachen kommt!'), 'gold');
      }, (e) => { ui.fullMsg = e instanceof CloudError ? e.message : t('Das hat nicht geklappt.'); }).finally(render);
      return;
    }
    case 'modfull': {
      const w = ui.wache;
      if (a === 'grant') {
        const hero = ((document.getElementById('mod-hero') as HTMLInputElement | null)?.value ?? '').trim();
        if (!hero) return;
        cloud.modGrantFull(hero).then((n) => say(t`${n} hat jetzt die Vollversion.`, 'good'), (e) => say(e instanceof CloudError ? e.message : t('Das hat nicht geklappt.'), 'warn')).finally(render);
      }
      if (a === 'codes') {
        const n = Math.max(1, Math.min(100, Math.floor(Number((document.getElementById('mod-n') as HTMLInputElement | null)?.value) || 1)));
        const note = ((document.getElementById('mod-note') as HTMLInputElement | null)?.value ?? '').trim();
        cloud.modMakeCodes(n, note).then((codes) => { w.newCodes = codes; loadWache(); }, (e) => { w.err = e instanceof CloudError ? e.message : t('Das hat nicht geklappt.'); render(); });
      }
      return;
    }
    case 'wache': ui.wache.tab = a as 'reports' | 'banned' | 'cheats' | 'aushang' | 'vollversion'; ui.flash = []; loadWache(); return;
    case 'mod': {
      const r = ui.wache.reports?.[Number(b)];
      if (!r) return;
      cloud.modDecide(r.kind, r.ref_id, r.target, a as 'ok' | 'hide' | 'ban').then(() => {
        say(a === 'ban' ? t`${r.target_name} ist gesperrt.` : a === 'hide' ? t('Ausgeblendet.') : t('Erledigt.'), 'good');
        loadWache();
      }, (e) => { say(e instanceof CloudError ? e.message : t('Das hat nicht geklappt.'), 'warn'); render(); });
      return;
    }
    case 'modban': {
      cloud.modBan(a, b === 'on').then(() => { say(b === 'on' ? t('Gesperrt.') : t('Entsperrt.'), 'good'); loadWache(); },
        (e) => { say(e instanceof CloudError ? e.message : t('Das hat nicht geklappt.'), 'warn'); render(); });
      return;
    }
    case 'delacct': {
      const typed = ((document.getElementById('del-confirm') as HTMLInputElement | null)?.value ?? '').trim().toUpperCase();
      if (typed !== t('LÖSCHEN') && typed !== 'LÖSCHEN' && typed !== 'LOESCHEN') { ui.delMsg = t('Bitte zum Bestätigen LÖSCHEN eintippen.'); render(); return; }
      ui.delMsg = '';
      cloud.deleteAccount().then(() => {
        resetSafety(); prefs.lastSyncedAt = 0; savePrefs(prefs);
        deleteGame(); state = null;
        go('title'); say(t('Dein Konto und alle Daten dazu sind gelöscht. Mach’s gut, und danke fürs Spielen.'), 'good'); render();
      }, (e) => { ui.delMsg = e instanceof CloudError ? e.message : t('Das Löschen hat nicht geklappt.'); render(); });
      return;
    }
    case 'bio': {
      const w = ui.warriors?.find((x) => x.userId === a);
      if (!w) return;
      ui.bio = w; ui.bioNews = null; ui.flash = [];
      go('bio');
      cloud.newsAbout(w.name, 6).then((r) => { ui.bioNews = r; }, () => { ui.bioNews = []; }).finally(() => { if (currentScreen() === 'bio') render(); });
      return;
    }
    case 'biosave': {
      if (!s) return;
      s.player.bio = censor(((document.getElementById('bio-text') as HTMLTextAreaElement | null)?.value ?? '').slice(0, 400).trim()).slice(0, 400);
      if (ui.bio && ui.bio.userId === cloud.userId) ui.bio = { ...ui.bio, bio: s.player.bio };
      saveGame(s); scheduleSync(300);
      say(t('Dein Steckbrief hängt jetzt am Rathaus.'), 'good'); render();
      return;
    }
    case 'ambros': {
      if (!s) return;
      const r = startAmbros(s, Number(a));
      if (typeof r === 'string') { say(r, 'warn'); render(); return; }
      ui.ambros = r; ui.flash = []; commit();
      (document.getElementById('guess') as HTMLInputElement | null)?.focus();
      return;
    }
    case 'guess': {
      if (!s || !ui.ambros || ui.ambros.over) return;
      const n = Math.round(Number((document.getElementById('guess') as HTMLInputElement | null)?.value));
      if (!(n >= 1 && n <= 100)) { say(t('Eine Zahl von 1 bis 100, bitte.'), 'warn'); render(); return; }
      ui.flash = [];
      guessAmbros(s, ui.ambros, n);
      commit();
      (document.getElementById('guess') as HTMLInputElement | null)?.focus();
      return;
    }
    case 'haunt': {
      if (!s || ui.pvp.busy || s.player.favor < HAUNT_FAVOR) return;
      ui.pvp.busy = true; render();
      // Erst den eigenen Stand hochladen, damit der Server weiß, dass du tot bist.
      const st = s;
      pushFirst(st).then(() => cloud.haunt(a)).then((res) => {
        ui.flash = [applyHaunt(st, res)];
        saveGame(st); scheduleSync(500);
      }, (e) => { say(e instanceof CloudError ? e.message : t('Das Spuken hat nicht geklappt.'), 'warn'); })
        .finally(() => { ui.pvp.busy = false; render(); });
      return;
    }
    case 'reloadmail': loadMail(); return;
    case 'write': {
      const w = ui.warriors?.find((x) => x.userId === a);
      ui.compose = { to: a, toName: w ? `${titleFor(w.dragonKills, w.gender)} ${w.name}` : t('einen Helden'), subject: '', body: '' };
      go('mail'); return;
    }
    case 'reply': {
      const m = ui.mail?.find((x) => x.id === Number(a));
      if (!m || !m.from_user) return;
      ui.compose = { to: m.from_user, toName: m.from_name, subject: m.subject.startsWith('Re: ') ? m.subject : t`Re: ${m.subject}`.slice(0, 60), body: '' };
      go('mail'); return;
    }
    case 'mailcancel': ui.compose = null; go('mail'); loadMail(); return;
    case 'mailsend': {
      const c = ui.compose;
      if (!c) return;
      c.subject = (document.getElementById('mail-subject') as HTMLInputElement | null)?.value ?? c.subject;
      c.body = (document.getElementById('mail-body') as HTMLTextAreaElement | null)?.value ?? c.body;
      if (!c.body.trim()) { say(t('Ein leerer Brief? Der Bote schaut dich verwirrt an.'), 'warn'); render(); return; }
      cloud.sendMail(c.to, c.subject.trim(), c.body.trim()).then(() => {
        ui.compose = null; go('mail'); say(t`Der Bote ist mit deinem Brief an ${c.toName} unterwegs.`, 'good'); loadMail();
      }, (e) => { say(e instanceof CloudError ? e.message : t('Der Brief ließ sich nicht verschicken.'), 'warn'); render(); });
      return;
    }
    case 'mailopen': {
      const id = Number(a);
      ui.mailOpen = ui.mailOpen === id ? null : id;
      const m = ui.mail?.find((x) => x.id === id);
      if (m && !m.seen) { m.seen = true; ui.unread = Math.max(0, ui.unread - 1); cloud.markMailSeen([id]).catch(() => {}); }
      render(); return;
    }
    case 'maildel': {
      const id = Number(a);
      ui.mail = (ui.mail ?? []).filter((x) => x.id !== id);
      ui.mailOpen = null;
      cloud.deleteMail(id).catch(() => {});
      render(); return;
    }
    case 'go':
      if (a === 'fields' && cloud.signedIn) { go('fields'); loadTargets('felder'); return; }
      if (a === 'news' && cloud.enabled) { ui.newsRows = null; cloud.news(40).then((r) => { ui.newsRows = r; }, () => { ui.newsRows = []; }).finally(() => { if (ui.screen === 'news') render(); }); }
      if (a === 'warriors' && cloud.signedIn) { go('warriors'); loadWarriors(); return; }
      if (a === 'haunt' && cloud.signedIn) { go('haunt'); loadWarriors(); return; }
      if (a === 'mail' && cloud.signedIn) { ui.compose = null; ui.mailOpen = null; go('mail'); loadMail(); return; }
      if (a === 'wache' && ui.isAdmin) { go('wache'); loadWache(); return; }
      if (a === 'blocks' && cloud.signedIn) { go('blocks'); cloud.blocks().then((r) => { ui.blocksList = r; ui.blocked = new Set(r.map((x) => x.blocked)); }, () => {}).finally(render); return; }
      if (a === 'deleteAccount') ui.delMsg = '';
      if (a === 'felsen' && cloud.enabled) cloud.hallOfFame(40).then((rows) => { ui.fame = rows; if (ui.screen === 'felsen') render(); }, () => {});
      if (a === 'tresen') ui.flash = [];
      if (a === 'dag' && cloud.signedIn) { ui.bounties = null; go('dag'); loadWarriors(); cloud.bounties().then((b) => { ui.bounties = b; }, (e) => { ui.bounties = []; say(e instanceof CloudError ? e.message : t('Veit schweigt.'), 'warn'); }).finally(render); return; }
      if (a === 'fivesix' && cloud.signedIn) { ui.dice = { info: null, last: null, err: '', busy: false }; go('fivesix'); cloud.jackpot().then((i) => { ui.dice.info = i; }, (e) => { ui.dice.err = e instanceof CloudError ? e.message : t('Der Tisch ist leer.'); }).finally(render); return; }
      if (a === 'gilde' && cloud.signedIn) { ui.guild.confirmLeave = false; go('gilde'); loadGuild(); return; }
      if (a === 'aushang' && cloud.enabled) { ui.aushang = null; go('aushang'); loadAushang(); return; }
      if (a === 'fame' && cloud.enabled) loadFameCat();
      if (a === 'bank') ui.bankMode = '';
      if (a === 'fame' && cloud.enabled) cloud.hallOfFame().then((rows) => { ui.fame = rows; if (ui.screen === 'fame') render(); }, () => {});
      go(a as Screen);
      return;
    case 'devtap':
      if (++ui.devTaps >= 5) { ui.devTaps = 0; prefs.dev = !prefs.dev; savePrefs(prefs); render(); }
      return;
    case 'continue': if (s) { const newDay = checkRealDay(s); saveGame(s, !newDay); go('village'); scheduleSync(500); } return;
    case 'new':
      if (state && !ui.confirmNew) { ui.confirmNew = true; render(); return; }
      ui.createName = ''; go('create'); return;
    case 'spec': {
      const input = document.getElementById('name') as HTMLInputElement | null;
      if (input) ui.createName = input.value;
      ui.createSpec = a as SpecialtyId; render(); return;
    }
    case 'race': {
      const input = document.getElementById('name') as HTMLInputElement | null;
      if (input) ui.createName = input.value;
      ui.createRace = (a as RaceId) in RACES ? a as RaceId : 'mensch'; render(); return;
    }
    case 'gender': {
      const input = document.getElementById('name') as HTMLInputElement | null;
      if (input) ui.createName = input.value;
      ui.createGender = a === 'f' ? 'f' : 'm'; render(); return;
    }
    case 'create': {
      const name = ((document.getElementById('name') as HTMLInputElement | null)?.value ?? '').trim().slice(0, 20);
      if (!name) { say(t('Ohne Namen lässt dich der Torwächter nicht ins Dorf.'), 'warn'); ui.createName = ''; render(); return; }
      if (!isClean(name)) { say(t('Der Torwächter runzelt die Stirn. „So einen Namen lass ich nicht ins Dorf.“'), 'warn'); ui.createName = name; render(); return; }
      state = newGame(name, ui.createSpec, ui.createGender, ui.createRace);
      saveGame(state);
      go('village');
      scheduleSync(500);
      return;
    }
    case 'acct': {
      const done = (m: string) => { ui.acctMsg = m; render(); };
      if (a === 'in' || a === 'up') {
        const email = ((document.getElementById('acct-email') as HTMLInputElement | null)?.value ?? '').trim();
        const pass = (document.getElementById('acct-pass') as HTMLInputElement | null)?.value ?? '';
        ui.acctEmail = email;
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { done(t('Bitte eine gültige E-Mail-Adresse eingeben.')); return; }
        if (pass.length < 6) { done(t('Das Passwort braucht mindestens 6 Zeichen.')); return; }
        done(a === 'up' ? t('Lege Konto an …') : t('Melde an …'));
        (a === 'up' ? cloud.signUp(email, pass) : cloud.signIn(email, pass)).then(() => afterLogin(done), (e) => done(e instanceof CloudError ? e.message : t('Das hat nicht geklappt.')));
      } else if (a === 'reset') {
        const email = ((document.getElementById('acct-email') as HTMLInputElement | null)?.value ?? '').trim();
        if (email) ui.acctEmail = email;
        ui.resetStep = 'email'; done('');
      } else if (a === 'resetcancel') {
        ui.resetStep = ''; done('');
      } else if (a === 'resetsend') {
        const field = document.getElementById('acct-email') as HTMLInputElement | null;
        const email = (field ? field.value : ui.acctEmail).trim();
        ui.acctEmail = email;
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { done(t('Bitte eine gültige E-Mail-Adresse eingeben.')); return; }
        done(t('Schicke Code …'));
        cloud.requestReset(email).then(() => { ui.resetStep = 'code'; done(t('Code ist unterwegs.')); }, (e) => done(e instanceof CloudError ? e.message : t('Das hat nicht geklappt.')));
      } else if (a === 'resetsave') {
        const code = ((document.getElementById('acct-code') as HTMLInputElement | null)?.value ?? '').replace(/\s/g, '');
        const pass = (document.getElementById('acct-newpass') as HTMLInputElement | null)?.value ?? '';
        if (!/^\d{4,10}$/.test(code)) { done(t('Bitte den Code aus der E-Mail eingeben (nur Ziffern).')); return; }
        if (pass.length < 6) { done(t('Das Passwort braucht mindestens 6 Zeichen.')); return; }
        done(t('Prüfe den Code …'));
        cloud.verifyCode(ui.acctEmail, code).then(async () => {
          ui.resetStep = '';
          let note = t('Neues Passwort gespeichert. Du bist angemeldet.');
          try { await cloud.setPassword(pass); } catch (e) { note = t`Du bist angemeldet, aber das Passwort wurde nicht geändert: ${e instanceof CloudError ? e.message : t('unbekannter Fehler')}`; }
          await afterLogin(done, note);
        }, (e) => done(e instanceof CloudError ? e.message : t('Das hat nicht geklappt.')));
      } else if (a === 'sync') {
        done(t('Gleiche ab …'));
        syncNow().then(done);
      } else if (a === 'out') {
        cloud.signOut(); prefs.lastSyncedAt = 0; savePrefs(prefs); resetSafety(); ui.full = null; ui.guild.mine = undefined; done(t('Abgemeldet. Der Spielstand bleibt auf diesem Gerät.'));
      }
      return;
    }
  }
  if (!s) return;
  switch (cmd) {
    case 'forest': {
      const r = forestSearch(s, a as ForestMode);
      ui.flash = r.type === 'event' ? r.lines : r.type === 'none' ? [{ t: r.reason, k: 'warn' }] : [];
      commit();
      if (r.type === 'fight') window.scrollTo(0, 0);
      return;
    }
    case 'grave': {
      const err = graveSearch(s);
      ui.flash = err ? [{ t: err, k: 'warn' }] : [];
      commit();
      if (!err) window.scrollTo(0, 0);
      return;
    }
    case 'soul': say(restoreSoul(s), 'good'); commit(); return;
    case 'room': say(rentRoom(s), 'good'); commit(); return;
    case 'bribe': {
      if (s.player.gems < 1) { say(t('Frieda will einen Edelstein sehen.'), 'warn'); render(); return; }
      s.player.gems -= 1;
      commit();
      go('innGuests');
      loadTargets('gasthaus');
      return;
    }
    case 'reload': loadTargets(a === 'gasthaus' ? 'gasthaus' : 'felder'); return;
    case 'pvp': {
      const place = b === 'gasthaus' ? 'gasthaus' : 'felder';
      const pv = ui.pvp;
      if (pv.busy) return;
      pv.busy = true; pv.error = '';
      render();
      (async () => {
        try {
          // Erst die eigenen Werte hochladen, damit der Server mit dem aktuellen Stand rechnet.
          saveGame(s);
          await cloud.push(JSON.parse(JSON.stringify(s)) as GameState);
          prefs.lastSyncedAt = s.savedAt ?? 0;
          savePrefs(prefs);
          const res = await cloud.pvpAttack(a, place);
          applyPvpResult(s, res, place);
          pv.fightsLeft = res.fights_left;
          pv.immune = false;
          ui.flash = [];
          commit();
          window.scrollTo(0, 0);
        } catch (e) {
          pv.error = e instanceof CloudError ? e.message : t('Der Angriff ist fehlgeschlagen.');
          render();
        } finally {
          pv.busy = false;
        }
      })();
      return;
    }
    case 'say': {
      const inp = document.getElementById('say') as HTMLInputElement | null;
      const section = ((a || inp?.dataset.section || 'dorfplatz') as ChatSection);
      const text = (inp?.value ?? '').trim();
      if (!text) return;
      ui.sayText = text;
      // Lallen nur im Text, nicht im Gestenzeichen (/me, :)
      const lead = text.match(/^\s*(?:\/me\b|::?)\s*/i)?.[0] ?? '';
      const drunkText = s && (s.player.drunk ?? 0) > 0 ? (lead + slur(text.slice(lead.length), s.player.drunk ?? 0)).slice(0, 200) : text;
      cloud.postComment(drunkText, section).then(() => { ui.sayText = ''; ui.squares[section].error = ''; loadSquare(section, true); },
        (e) => { ui.squares[section].error = e instanceof CloudError ? e.message : t('Das hat nicht geklappt.'); render(); });
      return;
    }
    case 'resurrect': {
      const msg = resurrect(s);
      saveGame(s);
      if (s.player.alive) { go('village'); say(msg, 'good'); render(); scheduleSync(500); } else { say(msg, 'warn'); render(); }
      return;
    }
    case 'dragon': if (startDragonFight(s)) { ui.flash = []; commit(); window.scrollTo(0, 0); } return;
    case 'master': if (startMasterFight(s)) { ui.flash = []; commit(); window.scrollTo(0, 0); } return;
    case 'fight': {
      if (a === 'auto') {
        // Bis zum Ende kämpfen. Einmal pro Kampf hält das Spiel an, wenn es knapp wird;
        // wer danach nochmal drückt (oder schon angeschlagen startet), kämpft wirklich bis zum Ende.
        const f0 = s.fight;
        // Im Schattenreich zählt die Seelenkraft, sonst die Lebenspunkte.
        const healthy = () => (f0?.kind === 'grave' ? s.player.soul > maxSoul(s.player) * 0.3 : s.player.hp > maxHp(s.player) * 0.3);
        const safe = !!f0 && !f0.autoWarned && healthy();
        let guard = 0;
        while (s.fight && !s.fight.over && guard++ < 200 && (!safe || healthy())) fightAction(s, 'attack');
        if (s.fight && !s.fight.over) {
          s.fight.autoWarned = true;
          s.fight.log.push({ t: s.fight.kind === 'grave' ? t('Du hältst inne, deine Seele flackert. Drück nochmal „Kämpfen bis zum Ende“, um weiterzukämpfen, oder flieh. Verlierst du, ist der Tag am Nebelfluss vorbei.') : t('Du hältst inne, du bist schwer angeschlagen. Drück nochmal „Kämpfen bis zum Ende“, um trotzdem weiterzukämpfen, oder flieh.'), k: 'warn', r: s.fight.round });
        }
      } else {
        fightAction(s, (a === 'skill' ? `skill:${b}` : a) as FightAction);
        ui.skillMenu = false;
      }
      const f = s.fight;
      if (f && f.over === 'win' && (f.kind === 'forest' || f.kind === 'grave') && s.bestiary[f.monsterId] === 1) ui.newCard = f.monsterId;
      commit();
      return;
    }
    case 'welcome': prefs.welcomed = true; savePrefs(prefs); render(); return;
    case 'feedback': {
      const from = currentScreen();
      ui.fbFrom = from === 'feedback' ? ui.fbFrom : from;
      ui.fbMsg = '';
      go('feedback');
      return;
    }
    case 'fbkind': {
      readFbText();
      const k = a as FeedbackKind;
      ui.fbKinds = ui.fbKinds.includes(k) ? ui.fbKinds.filter((x) => x !== k) : [...ui.fbKinds, k];
      render();
      return;
    }
    case 'fbsend': {
      readFbText();
      const msg = buildFeedback(s);
      const done = (t: string) => { ui.fbMsg = t; render(); };
      if (a === 'wa' || a === 'mail') {
        const url = a === 'wa' ? `https://wa.me/?text=${encodeURIComponent(msg)}` : `mailto:?subject=${encodeURIComponent(t('Brackenwyrm-Rückmeldung'))}&body=${encodeURIComponent(msg)}`;
        const w = window.open(url, '_blank', 'noopener');
        done(w || a === 'mail' ? t('Danke! Falls sich nichts geöffnet hat, nimm „Text kopieren“ und schick ihn selbst.') : t('Das Fenster wurde blockiert. Nimm „Text kopieren“ und schick den Text selbst.'));
      } else if (a === 'share') {
        navigator.share({ title: t('Brackenwyrm-Rückmeldung'), text: msg }).then(() => done(t('Danke für deine Rückmeldung!')), () => done(''));
      } else {
        try {
          navigator.clipboard.writeText(msg).then(() => done(t('Kopiert. Jetzt einfach in WhatsApp oder eine E-Mail einfügen.')), () => done(t('Kopieren ging nicht. Öffne unten die Vorschau und kopiere den Text von Hand.')));
        } catch {
          done(t('Kopieren ging nicht. Öffne unten die Vorschau und kopiere den Text von Hand.'));
        }
      }
      return;
    }
    case 'conflict': {
      const remote = ui.conflict;
      ui.conflict = null;
      if (!remote) return;
      if (a === 'remote') {
        state = remote.state;
        localSaveWithoutTouch(state);
        prefs.lastSyncedAt = remote.savedAt;
        savePrefs(prefs);
        go('village');
      } else {
        // Diesen Stand behalten: als neuester speichern und hochladen
        saveGame(s);
        cloud.push(s).then(() => { prefs.lastSyncedAt = s.savedAt ?? 0; savePrefs(prefs); }, () => {});
        go('village');
      }
      return;
    }
    case 'fulllog': ui.fullLog = !ui.fullLog; render(); return;
    case 'after': {
      ui.fullLog = false;
      if (a === 'grave') {
        closeFight(s);
        const err = graveSearch(s);
        ui.flash = err ? [{ t: err, k: 'warn' }] : [];
        if (err) ui.screen = 'shadows';
        commit();
        window.scrollTo(0, 0);
        return;
      }
      if (!prefs.fightHint) { prefs.fightHint = true; savePrefs(prefs); }
      if (s.fight?.kind === 'feste') {
        const f = s.fight;
        afterFesteFight(s, f.over, f.monsterId);
        closeFight(s);
        if (s.feste?.over === 'treasure') festeTreasureNews(s);
        saveGame(s); scheduleSync();
        if (a === 'feste') { go('feste'); return; }
      } else closeFight(s);
      const target: Screen = a === 'forest' ? 'forest' : a === 'training' ? 'training' : a === 'shadows' ? 'shadows' : a === 'bonus' ? 'dragonBonus'
        : a === 'fields' ? 'fields' : a === 'inn' ? 'inn' : 'village';
      saveGame(s);
      go(target);
      if (target === 'fields') loadTargets('felder');
      return;
    }
    case 'heal': say(heal(s, a as 'full' | 'half'), 'good'); commit(); return;
    case 'buy': say(buyItem(s, a as 'weapon' | 'armor', Number(b)), 'gold'); commit(); return;
    case 'bank': {
      const amtInput = document.getElementById('amount') as HTMLInputElement | null;
      const v = b === 'all' ? Infinity : Number(amtInput?.value ?? 0);
      say(a === 'dep' ? bankDeposit(s, v) : a === 'loan' ? bankBorrow(s, v) : bankWithdraw(s, v), 'gold');
      commit();
      return;
    }
    case 'event': ui.flash = resolveEvent(s, a); commit(); return;
    case 'talk': say(talkToFrieda(s), 'info'); commit(); return;
    case 'inn': say(requestSong(s), 'good'); commit(); return;
    case 'drink': {
      const r = orderDrink(s, a as DrinkId);
      ui.flash = r.lines.map((t, i) => ({ t, k: !r.ok ? 'warn' as const : i === 0 ? 'info' as const : 'good' as const }));
      commit(); return;
    }
    case 'bankmode': {
      ui.bankMode = ui.bankMode === a ? '' : a as 'loan' | 'transfer';
      if (ui.bankMode === 'transfer' && ui.warriors === null) loadWarriors();
      render(); return;
    }
    case 'transfer': {
      const to = (document.getElementById('tf-to') as HTMLSelectElement | null)?.value ?? '';
      const amount = Math.floor(Number((document.getElementById('tf-amount') as HTMLInputElement | null)?.value));
      if (!to || !(amount > 0)) { say(t('Wem und wie viel?'), 'warn'); render(); return; }
      if (s.player.bank < amount) { say(t`Auf deinem Konto liegen nur ${Math.max(0, s.player.bank)} Gold.`, 'warn'); render(); return; }
      cloud.transferGold(to, amount).then((r) => {
        s.player.bank -= r.amount;
        saveGame(s); scheduleSync(500);
        say(t`Ansgar trägt es ins Buch ein: ${r.amount} Gold an ${r.name}. Heute kannst du noch ${Math.max(0, r.left_today)} Gold überweisen.`, 'good');
      }, (e) => say(e instanceof CloudError ? e.message : t('Die Überweisung hat nicht geklappt.'), 'warn')).finally(render);
      return;
    }
    case 'guild': {
      const g = ui.guild;
      const fail = (e: unknown) => { say(e instanceof CloudError ? e.message : t('Das hat nicht geklappt.'), 'warn'); loadGuild(); };
      const done = (msg: string, k: LogLine['k'] = 'good') => { if (msg) say(msg, k); loadGuild(); };
      if (a !== 'leave') g.confirmLeave = false;
      if (a === 'create') {
        const name = ((document.getElementById('guild-name') as HTMLInputElement | null)?.value ?? '').trim();
        const tag = ((document.getElementById('guild-tag') as HTMLInputElement | null)?.value ?? '').trim().toUpperCase();
        if (name.length < 3 || !/^[A-ZÄÖÜ0-9]{2,4}$/.test(tag)) { say(t('Bitte einen Namen (mindestens 3 Zeichen) und ein Kürzel aus 2 bis 4 Buchstaben oder Ziffern eingeben.'), 'warn'); render(); return; }
        if (s.player.gold < GUILD_COST) { say(t`Eine Gilde zu gründen kostet ${GUILD_COST} Gold. So viel hast du nicht dabei.`, 'warn'); render(); return; }
        pushFirst(s).then(() => cloud.guildCreate(name, tag)).then((r) => {
          s.player.gold -= r.paid;
          saveGame(s); scheduleSync(500);
          done(t`Der Wappenmaler pinselt „${r.name}“ [${r.tag}] an die Tür. Die Gilde gehört dir.`, 'gold');
        }, fail);
        return;
      }
      if (a === 'apply') { cloud.guildApply(Number(b)).then((r) => done(t`Deine Bewerbung bei „${r.name}“ hängt jetzt am Brett. Die Gildenführung bekommt einen Brief.`), fail); return; }
      if (a === 'withdraw') { cloud.guildWithdraw().then(() => done(t('Du nimmst deine Bewerbung wieder vom Brett.'), 'info'), fail); return; }
      if (a === 'accept' || a === 'decline') { cloud.guildDecide(b, a === 'accept').then(() => done(a === 'accept' ? t('Aufgenommen! Ein Bote bringt die gute Nachricht.') : t('Abgelehnt. Ein Bote bringt die Nachricht.'), 'info'), fail); return; }
      if (a === 'kick') { cloud.guildKick(b).then(() => done(t('Entlassen. Der Name wird von der Tafel gewischt.'), 'info'), fail); return; }
      if (a === 'rank') {
        const r = act.split(':')[3] as 'leader' | 'officer' | 'member';
        cloud.guildRank(b, r).then(() => done(r === 'leader' ? t('Du übergibst den Schlüssel der Gildenhalle. Ab jetzt führt jemand anderes.') : r === 'officer' ? t('Befördert!') : t('Zurückgestuft.'), 'info'), fail);
        return;
      }
      if (a === 'text') {
        const motd = (document.getElementById('guild-motd') as HTMLTextAreaElement | null)?.value ?? '';
        const descr = (document.getElementById('guild-descr') as HTMLTextAreaElement | null)?.value ?? '';
        cloud.guildText(motd, descr).then(() => done(t('Gespeichert. Die Tafel in der Gildenhalle ist frisch beschrieben.'), 'info'), fail);
        return;
      }
      if (a === 'leave') {
        if (!g.confirmLeave) { g.confirmLeave = true; render(); return; }
        g.confirmLeave = false;
        cloud.guildLeave().then(() => { ui.squares.gilde.comments = null; done(t('Du hängst deinen Gildenmantel an den Haken und gehst.'), 'info'); }, fail);
        return;
      }
      return;
    }
    case 'bounty': {
      const to = (document.getElementById('bounty-to') as HTMLSelectElement | null)?.value ?? '';
      const amount = Math.floor(Number((document.getElementById('bounty-amount') as HTMLInputElement | null)?.value));
      if (!to || !(amount > 0)) { say(t('„Auf wen, und wie viel?“, brummt Veit.'), 'warn'); render(); return; }
      const fee = Math.ceil(amount * 0.1);
      if (s.player.gold < amount + fee) { say(t`Das kostet ${amount + fee} Gold mit Veits Anteil. So viel hast du nicht dabei.`, 'warn'); render(); return; }
      pushFirst(s).then(() => cloud.setBounty(to, amount)).then((r) => {
        s.player.gold -= r.paid;
        saveGame(s); scheduleSync(500);
        say(t`Veit steckt ${r.paid} Gold ein und nickt. „Auf ${r.name} sind jetzt ${r.total} Gold ausgesetzt.“`, 'good');
        cloud.bounties().then((b) => { ui.bounties = b; }, () => {}).finally(render);
      }, (e) => { say(e instanceof CloudError ? e.message : t('Veit hat dich nicht verstanden.'), 'warn'); render(); });
      return;
    }
    case 'roll': {
      const d = ui.dice;
      if (d.busy) return;
      d.busy = true; d.err = '';
      pushFirst(s).then(() => cloud.rollFiveSix()).then((r) => {
        s.player.gold += r.win - r.cost;
        d.last = r;
        if (d.info) { d.info = { ...d.info, pot: r.pot, plays_left: r.plays_left }; }
        saveGame(s); scheduleSync(500);
        if (r.win) sound.play('coins');
      }, (e) => { d.err = e instanceof CloudError ? e.message : t('Der Becher klemmt.'); }).finally(() => {
        d.busy = false;
        cloud.jackpot().then((i) => { d.info = i; }, () => {}).finally(render);
      });
      render();
      return;
    }
    case 'aushangseen': prefs.aushangSeen = Number(a); savePrefs(prefs); render(); return;
    case 'aushangpost': {
      const title = ((document.getElementById('au-title') as HTMLInputElement | null)?.value ?? '').trim();
      const body = ((document.getElementById('au-body') as HTMLTextAreaElement | null)?.value ?? '').trim();
      if (!title || !body) { say(t('Überschrift und Text, bitte.'), 'warn'); render(); return; }
      cloud.postAushang(title, body).then(() => { say(t('Angeschlagen. Alle sehen es beim nächsten Besuch im Dorf.'), 'good'); loadAushang(); },
        (e) => { say(e instanceof CloudError ? e.message : t('Das hat nicht geklappt.'), 'warn'); render(); });
      return;
    }
    case 'aushangdel': cloud.deleteAushang(Number(a)).then(() => { say(t('Abgenommen.'), 'good'); loadAushang(); }, (e) => { say(e instanceof CloudError ? e.message : t('Das hat nicht geklappt.'), 'warn'); render(); }); return;
    case 'merc': {
      if (a === 'hire') { const r = hireCompanion(s, b as CompanionId); say(r.text, r.ok ? 'good' : 'warn'); }
      else if (a === 'heal') { const r = healCompanion(s); say(r.text, r.ok ? 'good' : 'warn'); }
      else if (a === 'dismiss') {
        if (!ui.confirmDelete) { ui.confirmDelete = true; render(); return; }
        ui.confirmDelete = false; say(dismissCompanion(s), 'info');
      }
      commit(); return;
    }
    case 'famecat': ui.fameCat = a as FameCat; loadFameCat(); render(); return;
    case 'mount': {
      if (a === 'buy') { const before = s.player.mount; const t = buyMount(s, b as MountId); say(t, s.player.mount !== before ? 'good' : 'warn'); ui.confirmDelete = false; commit(); return; }
      if (a === 'feed') { const r = feedMount(s); say(r.text, r.ok ? 'good' : 'info'); commit(); return; }
      if (a === 'sell') {
        if (!ui.confirmDelete) { ui.confirmDelete = true; render(); return; }
        ui.confirmDelete = false; say(sellMount(s), 'info'); commit(); return;
      }
      return;
    }
    case 'flirt': {
      const r = flirt(s, Number(a), announce);
      ui.flash = r.lines.map((t) => ({ t, k: r.kind }));
      commit(); return;
    }
    case 'spouse': { const r = visitSpouse(s); ui.flash = r.lines.map((t) => ({ t, k: r.kind })); commit(); return; }
    case 'looks': say(askLooks(s.player), 'info'); render(); return;
    case 'lover': s.player.loverPref = a === 'florian' ? 'florian' : 'frieda'; saveGame(s); render(); return;
    case 'dkpoint': ui.dkPoint = a as DragonPoint; render(); return;
    case 'dkspec': ui.dkSpec = a as SpecialtyId; render(); return;
    case 'dkrace': ui.dkRace = a as RaceId; render(); return;
    case 'rebirth': {
      if (!ui.dkPoint) return;
      const res = chooseDragonBonus(s, ui.dkPoint, ui.dkSpec ?? s.player.specialty, ui.dkRace ?? s.player.race);
      ui.dkPoint = null; ui.dkSpec = null; ui.dkRace = null;
      saveGame(s); go('village');
      if (res) say(t`Von heute an: ${res.title} ${s.player.name}.`, 'good');
      scheduleSync(500);
      return;
    }
    case 'toggle':
      if (a === 'motion') prefs.reducedMotion = (el as HTMLInputElement).checked;
      if (a === 'muted') { prefs.muted = (el as HTMLInputElement).checked; sound.setPrefs(prefs); }
      savePrefs(prefs);
      render();
      return;
    case 'vol': {
      const v = Math.max(0, Math.min(100, Number((el as HTMLInputElement).value))) / 100;
      if (a === 'music') prefs.musicVol = v; else prefs.sfxVol = v;
      savePrefs(prefs); sound.setPrefs(prefs);
      if (a === 'sfx') sound.play('coins');
      return;
    }
    case 'testday':
      startNewDay(s);
      ui.flash = [{ t: t('Testmodus: Ein neuer Tag beginnt.'), k: 'info' }];
      saveGame(s);
      ui.screen = 'village';
      render();
      window.scrollTo(0, 0);
      return;
    case 'copycode': {
      const ta = document.getElementById('exportcode') as HTMLTextAreaElement | null;
      if (!ta) return;
      ta.select();
      const done = (msg: string) => { ui.importMsg = msg; render(); };
      try {
        navigator.clipboard.writeText(ta.value).then(() => done(t('Code kopiert.')), () => done(t('Bitte den Code markieren und selbst kopieren.')));
      } catch {
        done(t('Bitte den Code markieren und selbst kopieren.'));
      }
      return;
    }
    case 'importcode': {
      const v = (document.getElementById('importcode') as HTMLTextAreaElement | null)?.value ?? '';
      const loaded = importCode(v);
      if (!loaded) { ui.importMsg = t('Dieser Code passt nicht. Er beginnt mit BW1:'); render(); return; }
      state = loaded;
      checkRealDay(state);
      saveGame(state);
      ui.importMsg = '';
      say(t`Spielstand von ${loaded.player.name} geladen.`, 'good');
      ui.screen = 'village';
      render();
      return;
    }
    case 'delete':
      if (!ui.confirmDelete) { ui.confirmDelete = true; render(); return; }
      deleteGame();
      state = null;
      go('title');
      return;
  }
}

function readFbText(): void {
  const t = document.getElementById('fbtext') as HTMLTextAreaElement | null;
  if (t) ui.fbText = t.value;
}

function onKey(e: KeyboardEvent): void {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const t = e.target as HTMLElement;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) {
    if (e.key === 'Enter' && (t as HTMLInputElement).id === 'name') handle('create', t);
    if (e.key === 'Enter' && (t as HTMLInputElement).id === 'acct-pass') handle('acct:in', t);
    if (e.key === 'Enter' && (t as HTMLInputElement).id === 'acct-newpass') handle('acct:resetsave', t);
    if (e.key === 'Enter' && (t as HTMLInputElement).id === 'acct-email' && ui.resetStep === 'email') handle('acct:resetsend', t);
    if (e.key === 'Enter' && (t as HTMLInputElement).id === 'say') handle('say', t);
    if (e.key === 'Enter' && (t as HTMLInputElement).id === 'guess') handle('guess', t);
    return;
  }
  if (e.key === 'Escape' && ui.menuOpen) { ui.menuOpen = false; render(); return; }
  const arrow: Record<string, string> = { ArrowUp: 'n', ArrowRight: 'o', ArrowDown: 's', ArrowLeft: 'w' };
  if (arrow[e.key] && currentScreen() === 'feste') {
    const b = root.querySelector<HTMLButtonElement>(`[data-act="feste:${arrow[e.key]}"]:not(:disabled)`);
    if (b) { e.preventDefault(); b.click(); }
    return;
  }
  const key = e.key.toLowerCase();
  const btn = root.querySelector<HTMLButtonElement>(`[data-hotkey="${CSS.escape(key)}"]:not(:disabled)`);
  if (btn) { e.preventDefault(); btn.click(); }
}

/** Beginn der beiden Spieltage in der Uhrzeit des Geräts, z. B. ["06:00", "18:00"]. */
function dayStarts(): [string, string] {
  return dayStartsLocal(new Date(), lang === 'de' ? 'de-DE' : undefined); // i18n-ignore
}

/** Restzeit bis zum nächsten Spieltag, z. B. "3 Std. 12 Min." */
function waitText(): string {
  const { h, m } = untilNextDay();
  return h > 0 ? t`${h} Std. ${m} Min.` : t`${m} Min.`;
}

function checkDayTick(): void {
  if (!state || state.fight) return;
  if (checkRealDay(state)) {
    saveGame(state);
    say(gameDayKey().endsWith('a') ? t('Die Sonne geht auf. Ein neuer Tag in Moosgrund!') : t('Die Dorfuhr schlägt sechs Mal. Der Abend bricht an, ein neuer Spieltag in Moosgrund!'), 'good');
    if (ui.screen !== 'title' && ui.screen !== 'create') ui.screen = 'village';
    render();
  }
}

// ---------- Karten kippen mit (Maus am Computer, Neigung am Handy) ----------

function tiltCard(card: HTMLElement, nx: number, ny: number): void {
  // nx, ny zwischen -1 und 1: Lage des Zeigers bzw. Neigung des Geräts
  const max = 9;
  const mag = Math.min(1, Math.hypot(nx, ny));
  card.style.setProperty('--tilt', `${-ny} ${nx} 0 ${(mag * max).toFixed(2)}deg`);
  card.style.setProperty('--px', `${(-nx * 2.2).toFixed(2)}%`);
  card.style.setProperty('--py', `${(-ny * 2.2).toFixed(2)}%`);
  card.style.setProperty('--mx', `${Math.round(50 + nx * 50)}%`);
  card.classList.add('is-tilted');
}

function untilt(card: HTMLElement): void {
  card.classList.remove('is-tilted');
  for (const v of ['--tilt', '--px', '--py', '--mx']) card.style.removeProperty(v);
}

function setupTilt(): void {
  root.addEventListener('pointermove', (e) => {
    if (prefs.reducedMotion || e.pointerType === 'touch') return;
    const card = (e.target as HTMLElement).closest<HTMLElement>('.card.is-live');
    root.querySelectorAll<HTMLElement>('.card.is-tilted').forEach((c) => { if (c !== card) untilt(c); });
    if (!card) return;
    const b = card.getBoundingClientRect();
    tiltCard(card, ((e.clientX - b.left) / b.width) * 2 - 1, ((e.clientY - b.top) / b.height) * 2 - 1);
  });
  root.addEventListener('pointerleave', () => root.querySelectorAll<HTMLElement>('.card.is-tilted').forEach(untilt));

  // Handy: Neigung des Geräts bewegt die großen Karten (Kampf, Titel).
  let base: [number, number] | null = null;
  const onOrient = (e: DeviceOrientationEvent) => {
    if (prefs.reducedMotion || e.beta == null || e.gamma == null) return;
    if (!base) base = [e.beta, e.gamma];
    const nx = Math.max(-1, Math.min(1, (e.gamma - base[1]) / 20));
    const ny = Math.max(-1, Math.min(1, (e.beta - base[0]) / 20));
    // Langsam zur aktuellen Haltung nachziehen, damit "gerade halten" immer die Mitte ist.
    base = [base[0] + (e.beta - base[0]) * 0.01, base[1] + (e.gamma - base[1]) * 0.01];
    root.querySelectorAll<HTMLElement>('.card.has-fx.is-live').forEach((c) => tiltCard(c, nx, ny));
  };
  const D = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> } | undefined;
  if (D && typeof D.requestPermission === 'function') {
    // iPhone: Erlaubnis nur nach einem Tippen möglich.
    const ask = () => {
      D.requestPermission!().then((r) => { if (r === 'granted') window.addEventListener('deviceorientation', onOrient); }).catch(() => {});
      root.removeEventListener('click', ask);
    };
    root.addEventListener('click', ask);
  } else if (D) {
    window.addEventListener('deviceorientation', onOrient);
  }
}

export function start(el: HTMLElement): void {
  root = el;
  initPwa(() => { if (currentScreen() === 'settings') render(); });
  document.documentElement.lang = lang;
  (window as unknown as { __i18nMissing?: Set<string> }).__i18nMissing = missing;
  root.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!target || (target as HTMLButtonElement).disabled) return;
    if (target.tagName === 'INPUT') return;
    lastAct = Date.now();
    if (!target.dataset.act!.startsWith('fight:')) sound.play('click', { volume: 0.5 });
    handle(target.dataset.act!, target);
  });
  // Ton geht erst nach der ersten Berührung (Vorgabe der Browser).
  const unlock = () => sound.unlock();
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
  sound.setPrefs(prefs);
  root.addEventListener('change', (e) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' && target.dataset.act) handle(target.dataset.act, target);
  });
  window.addEventListener('keydown', onKey);
  if (cloud.signedIn) void syncNow();
  setupTilt();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkDayTick(); });
  window.setInterval(checkDayTick, 60_000);
  render();
}
