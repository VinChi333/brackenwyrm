// Die Oberfläche im Aufbau von damals: Navigation links, Geschehen in der Mitte,
// Charakterwerte rechts. Gegner erscheinen als illustrierte Karten.

import { eventById } from '../content/events';
import { FEEDBACK_KINDS, feedbackMessage } from '../content/feedback';
import type { FeedbackKind } from '../content/feedback';
import { fameTable } from '../content/fame';
import { titleFor } from '../content/titles';
import { PARTNERS } from '../content/lovers';
import { MERTEN, MOUNTS, MOUNT_ORDER, mountRepay } from '../content/mounts';
import { buyMount, feedMount, feedPrice, sellMount, tradeCost } from '../game/stable';
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
  announce, todayKey, applyHaunt, HAUNT_FAVOR, attack, bankDeposit, bankWithdraw, buyItem, canChallengeMaster, canSeekDragon, checkRealDay, chooseDragonBonus,
  CHRONICLE_SIZE, closeFight, defense, drinkHarzbier, expNeeded, fightAction, forestSearch, harzbierCost, heal, healCost, maxHp,
  graveSearch, maxSoul, RESURRECT_FAVOR, restoreSoul, resurrect, soulRestoreCost,
  newGame, rentRoom, roomCost, requestSong, resolveEvent, startDragonFight, startMasterFight, startNewDay, talkToFrieda,
} from '../game/engine';
import type { FightAction, ForestMode } from '../game/engine';
import { deleteGame, exportCode, importCode, loadGame, loadPrefs, saveGame, savePrefs } from '../game/storage';
import { Cloud, CloudError } from '../game/cloud';
import type { BlockRow, MailRow, ModBanned, ModCheat, ModReport, ReportKind, WarriorRow } from '../game/cloud';
import { censor, isClean } from '../content/badwords';
import { datenschutzHtml, impressumHtml, legalIncomplete } from '../content/legal';
import { DIR_NAME, FESTE_COST, FESTE_MIN_LEVEL, SIZE as FESTE_SIZE, afterFesteFight, canEnterFeste, enterFeste, festeLight, exits, heirloomNames, leaveFeste, mazeFor, moveFeste, treasureNews, type Dir } from '../game/feste';
import { FESTE_FOES, FESTE_NAME, FESTE_TEXT, HEIRLOOMS, SCROLLS, heirloom } from '../content/feste';
import { POTIONS, chooseNewRace, chooseNewSpecialty, drinkPotion, paySeer, seerCost, type PotionId } from '../game/shops';
import { AMBROS_GAMES_PER_DAY, AMBROS_TRIES, ambrosBets, guessAmbros, startAmbros, type AmbrosGame } from '../game/ambros';
import type { CommentRow, FameRow, NewsRow, PvpTarget, RemoteSave } from '../game/cloud';
import { decideSync } from '../game/sync';
import type { ChronicleEntry, DragonPoint, GameState, Gender, LogLine, MountId, RaceId, SpecialtyId } from '../game/types';
import { cardBack, cardFor, shadeBack, shadeCard, cardHtml, dragonCard, heroArt, heroPortrait, masterCard, monsterCard, mountCard, tierFor } from './art/cards';
import type { CardInfo } from './art/cards';
import { applyPvpEvents, applyPvpResult } from '../game/pvp';
import { sound, type TrackId } from './audio';

type Screen = 'title' | 'create' | 'village' | 'forest' | 'fight' | 'training' | 'healer' | 'smith'
  | 'bank' | 'inn' | 'bestiary' | 'fame' | 'chronicle' | 'feedback' | 'settings' | 'shadows' | 'dragonBonus' | 'syncConflict' | 'login' | 'fields' | 'innGuests' | 'news' | 'flirt' | 'stable' | 'warriors' | 'mail' | 'haunt' | 'bio' | 'ambros'
  | 'datenschutz' | 'impressum' | 'wache' | 'blocks' | 'deleteAccount'
  | 'quirin' | 'seer' | 'felsen' | 'garten' | 'feste' | 'heirlooms';

// Titelbild: der schlafende Wyrm (art-source/titel-wyrm.png) und der Spruch darunter.
const TITLE_ART = (import.meta.glob('../assets/title/titel-wyrm.webp', { eager: true, import: 'default' }) as Record<string, string>)['../assets/title/titel-wyrm.webp'];
const TITLE_SPRUCH = 'Hier gibt’s nicht viel zu schnacken – such lieber den Wyrm in den Bracken.';
const VERSION = 'Testversion 0.36';

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
  wache: { tab: 'reports' | 'banned' | 'cheats'; reports: ModReport[] | null; banned: ModBanned[] | null; cheats: ModCheat[] | null; err: string };
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
  conflict: RemoteSave | null;  // Server-Stand, wenn beide Geräte weitergespielt haben
  fame: FameRow[] | null;       // echte Spieler aus der Online-Ruhmeshalle
}

let state: GameState | null = loadGame();
const prefs = loadPrefs();
const cloud = new Cloud();
const ui: Ui = {
  screen: 'title', flash: [], createName: '', createSpec: 'dunkel', createGender: 'm', createRace: 'mensch', dkRace: null, skillMenu: false, warriors: null, mail: null, listErr: '', mailOpen: null, compose: null, unread: 0, unreadAt: 0, bio: null, bioNews: null, statue: null, ambros: null, blocked: new Set(), blocksList: null, isAdmin: false, repConfirm: '', legalFrom: 'title', delMsg: '', wache: { tab: 'reports', reports: null, banned: null, cheats: null, err: '' }, dkPoint: null, dkSpec: null, confirmDelete: false, confirmNew: false, importMsg: '', newCard: null, fullLog: false, fbKinds: [], fbText: '', fbFrom: 'village', fbMsg: '', devTaps: 0, menuOpen: false, pvp: { targets: null, loading: false, busy: false, error: '', fightsLeft: null, immune: false }, squares: { dorfplatz: { comments: null, loading: false, at: 0, error: '' }, gasthaus: { comments: null, loading: false, at: 0, error: '' }, schattenreich: { comments: null, loading: false, at: 0, error: '' }, felsen: { comments: null, loading: false, at: 0, error: '' }, garten: { comments: null, loading: false, at: 0, error: '' } }, newsRows: null, sayText: '', acctEmail: '', acctMsg: '', conflict: null, fame: null,
};
let root: HTMLElement;

// ---------- Bausteine ----------

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function pct(a: number, b: number): number {
  return Math.max(0, Math.min(100, Math.round((100 * a) / Math.max(1, b))));
}

interface Item { act: string; label: string; key?: string; hint?: string; disabled?: boolean; primary?: boolean; mobileOnly?: boolean }
interface Group { title: string; items: Item[]; dock?: boolean }

/** Tastenkürzel im Wort hervorheben, wie damals: "[W]ald" → W unterstrichen und farbig. */
function hotLabel(label: string, key?: string): string {
  if (!key) return esc(label);
  const i = label.toLowerCase().indexOf(key.toLowerCase());
  if (i < 0) return `<b class="hk">${key.toUpperCase()}</b> · ${esc(label)}`;
  return `${esc(label.slice(0, i))}<b class="hk">${esc(label[i])}</b>${esc(label.slice(i + 1))}`;
}

function navHtml(groups: Group[]): string {
  return groups.map((g) => `<section class="nav-group"><h3>${esc(g.title)}</h3>
    ${g.items.map((it) => `<button type="button" class="nav-link ${it.primary ? 'primary' : ''} ${it.mobileOnly ? 'mobile-only' : ''}" data-act="${it.act}" ${it.key ? `data-hotkey="${it.key}"` : ''} ${it.disabled ? 'disabled' : ''}>
      <span>${hotLabel(it.label, it.key)}</span>${it.hint ? `<small>${esc(it.hint)}</small>` : ''}</button>`).join('')}
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
  return `<aside class="vital" aria-label="Charakter">
    <div class="vital-head">
      <div class="portrait">${heroPortrait(p.race, p.specialty, p.gender)}</div>
      <div><span class="v-title">${esc(titleFor(p.dragonKills, p.gender))}</span><strong class="v-name">${esc(p.name)}</strong><span class="v-sub">Stufe ${p.level} · ${raceName(p.race, p.gender)} · ${sp.name}</span>
        ${p.dragonKills ? `<span class="v-dk">Drachentöter ${p.dragonKills}×</span>` : ''}
        ${p.marriedTo ? `<span class="v-wed">♥ verheiratet mit ${PARTNERS[p.marriedTo].name}</span>` : ''}</div>
    </div>
    <dl class="vital-list">
      ${p.alive
        ? `<div class="v-row wide"><dt>Lebenspunkte</dt><dd>${p.hp} / ${maxHp(p)}</dd>${bar(p.hp, maxHp(p), 'hp')}</div>`
        : `<div class="v-row wide"><dt>Seelenkraft</dt><dd>${p.soul} / ${maxSoul(p)}</dd>${bar(p.soul, maxSoul(p), 'soul')}</div>
           <div class="v-row"><dt>Gunst</dt><dd class="gem">${p.favor} / ${RESURRECT_FAVOR}</dd></div>
           <div class="v-row"><dt>Schattenkämpfe</dt><dd>${p.graveFights}</dd></div>`}
      <div class="v-row wide"><dt>Erfahrung</dt><dd>${p.level >= MAX_LEVEL ? 'max.' : `${p.exp} / ${need}`}</dd>${bar(p.exp - prev, need - prev, 'xp')}</div>
      <div class="v-row"><dt>Angriff</dt><dd>${attack(p)}</dd></div>
      <div class="v-row"><dt>Verteidigung</dt><dd>${defense(p)}</dd></div>
      <div class="v-row"><dt>Gold</dt><dd class="gold">${p.gold}</dd></div>
      <div class="v-row"><dt>Edelsteine</dt><dd class="gem">${p.gems}</dd></div>
      <div class="v-row"><dt>Waldkämpfe</dt><dd>${p.forestFights}</dd></div>
      <div class="v-row"><dt>${sp.name}</dt><dd>${p.specialUses} ${p.specialUses === 1 ? 'Punkt' : 'Punkte'}</dd></div>
      <div class="v-row wide v-gear"><dt>Waffe</dt><dd>${WEAPONS[p.weaponTier].name}</dd></div>
      <div class="v-row wide v-gear"><dt>Rüstung</dt><dd>${ARMORS[p.armorTier].name}</dd></div>
      ${p.buffs.length ? `<div class="v-row wide v-gear"><dt>Wirkung</dt><dd>${p.buffs.map((b) => `${b.name} (${b.rounds})`).join(', ')}</dd></div>` : ''}
    </dl>
  </aside>`;
}

function topbar(s: GameState | null): string {
  return `<header class="topbar"><span class="logo">Brackenwyrm</span>
    ${s ? `<span class="day">Spieltag ${s.day} · ${s.player.alive ? `${s.player.forestFights} Waldkämpfe übrig` : 'im Schattenreich'}</span>` : ''}</header>`;
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
  const btn = (it: Item, primary: boolean) => `<button type="button" class="dock-btn ${primary ? 'primary' : ''}" data-act="${it.act}" ${it.disabled ? 'disabled' : ''}>
      <span>${hotLabel(it.label, it.key)}</span>${it.hint ? `<small>${esc(it.hint)}</small>` : ''}</button>`;
  const [main, ...rest] = items;
  const sec = rest.map((it) => btn(it, false));
  if (needMenu) sec.push(`<button type="button" class="dock-btn menu" data-act="menu" aria-expanded="${ui.menuOpen}">☰ Menü</button>`);
  // Der Hauptbefehl steht immer ganz unten über die volle Breite: Angreifen, Weiter, Herumstreifen …
  // So bleibt er für den Daumen an derselben Stelle, egal wie viele andere Knöpfe es gibt.
  return `<div class="dock" role="toolbar" aria-label="Aktionen">
    ${sec.length ? `<div class="dock-row">${sec.join('')}</div>` : ''}
    ${main ? btn(main, main.primary !== false) : ''}
  </div>`;
}

function layout(s: GameState, main: string, groups: Group[], cls = ''): string {
  const dock = dockItems(groups);
  const needMenu = groups.flatMap((g) => g.items).some((i) => !dock.includes(i));
  const n = dock.length + (needMenu ? 1 : 0);
  const rows = (n > 1 ? Math.ceil((n - 1) / 3) : 0) + (n ? 1 : 0);
  return `<div class="shell ${cls} ${n ? 'has-dock' : ''} ${ui.menuOpen ? 'menu-open' : ''}" style="--dock-rows:${rows}">${topbar(s)}
    <nav class="nav" aria-label="Navigation">${navHtml(groups)}</nav>
    <main class="main">${main}</main>
    ${vital(s)}
    ${n ? `<div class="nav-backdrop" data-act="menu"></div>${dockHtml(dock, needMenu)}` : ''}
  </div>`;
}

const back: Item = { act: 'go:village', label: 'Zurück ins Dorf', key: 'd' };

/** Kampfbericht im Stil von damals: Runde für Runde, nichts verschwindet. */
function fightLogHtml(log: LogLine[]): string {
  let out = '';
  let round = -1;
  for (const l of log) {
    const r = l.r ?? round;
    if (r !== round) {
      if (round !== -1) out += '</div>';
      out += `<div class="round">${r > 0 ? `<h4>Runde ${r}</h4>` : ''}`;
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
    ? `<figure class="title-art"><img src="${TITLE_ART}" alt="Ein Drache schläft in einer Farnschlucht, über ihm das Dorf im Mondlicht" width="1360" height="768"></figure>`
    : `<div class="fanned">${['borkenwolf', 'steintroll', 'irrlicht'].map((id, i) => cardHtml(cardFor(id)!, { cls: `fan fan-${i}`, fx: true })).join('')}</div>`;
  return `<div class="solo">
    <div class="solo-panel">
      <h1 class="title-logo">Brackenwyrm</h1>
      <p class="title-def"><span><b>Bracken</b> – Farn, so weit das Auge reicht.</span> <span><b>Wyrm</b> – ein Drache, der darin schläft.</span></p>
      ${art}
      <p class="tagline">${TITLE_SPRUCH}</p>
      ${flashHtml()}
      <div class="solo-nav">${navHtml([{ title: 'Willkommen', items: [
        ...(p ? [{ act: 'continue', label: `Weiterspielen: ${titleFor(p.dragonKills, p.gender)} ${p.name}`, key: 'w', hint: `Stufe ${p.level} · Spieltag ${state!.day}` }] : []),
        { act: 'new', label: p && ui.confirmNew ? 'Wirklich neu beginnen? Der alte Spielstand geht verloren.' : 'Neues Spiel beginnen', key: 'n' },
        ...(cloud.enabled && !cloud.signedIn ? [{ act: 'go:login', label: 'Mit Spielerkonto anmelden', key: 'k', hint: 'auf einem anderen Gerät weiterspielen' }] : []),
      ] }])}</div>
      <p class="fine" data-act="devtap">${VERSION} · Tastenkürzel am Computer, Tippen am Handy${prefs.dev ? ' · Entwicklermodus' : ''}</p>
      <p class="fine legal-links"><button type="button" class="linkish" data-act="legal:impressum">Impressum</button> · <button type="button" class="linkish" data-act="legal:datenschutz">Datenschutz</button></p>
    </div>
  </div>`;
}

/** Impressum und Datenschutz: vom Titel aus ohne Spielstand, sonst im normalen Rahmen. */
function legalScreen(kind: 'impressum' | 'datenschutz'): string {
  const title = kind === 'impressum' ? 'Impressum' : 'Datenschutzerklärung';
  const body = `<article class="legal">${legalIncomplete() ? '<p class="warn-box">Hinweis für den Betreiber: In src/content/legal.ts fehlen noch Angaben (in eckigen Klammern).</p>' : ''}
    ${kind === 'impressum' ? impressumHtml() : datenschutzHtml()}</article>`;
  const other = kind === 'impressum' ? { act: 'legal:datenschutz', label: 'Datenschutz', key: 'p' } : { act: 'legal:impressum', label: 'Impressum', key: 'i' };
  const backAct = ui.legalFrom === 'title' || !state ? 'go:title' : `go:${ui.legalFrom}`;
  if (!state || ui.legalFrom === 'title') {
    return `<div class="solo"><div class="solo-panel legal-panel"><h1 class="legal-title">${title}</h1>${body}
      <div class="row"><button type="button" class="btn ghost" data-act="${backAct}">Zurück</button><button type="button" class="btn ghost" data-act="${other.act}">${other.label}</button></div></div></div>`;
  }
  return layout(state, `<h1 class="legal-title">${title}</h1>${body}`, [{ title: 'Rechtliches', items: [other, { act: backAct, label: 'Zurück', key: 'z' }] }]);
}

function loginScreen(): string {
  return `<div class="solo"><div class="solo-panel">
    ${accountHtml()}
    <div class="row"><button type="button" class="btn ghost" data-act="go:title">Zurück</button></div>
  </div></div>`;
}

/** Rassenwahl mit Bild (zeigt die gerade gewählte Fähigkeit), für Erstellung und Neuanfang. */
function raceChoices(sel: RaceId, spec: SpecialtyId, g: Gender, act: string): string {
  return `<div class="choices race-choices" role="radiogroup" aria-label="Rasse">${RACE_ORDER.map((id) => {
    const r = RACES[id];
    return `<button type="button" class="choice ${sel === id ? 'on' : ''}" role="radio" aria-checked="${sel === id}" data-act="${act}:${id}">
      <span class="choice-art">${heroArt(id, spec, g)}</span><strong>${raceName(id, g)}</strong><span class="gold">${r.bonus}</span><small>${r.blurb}</small></button>`;
  }).join('')}</div>`;
}

/** Fähigkeitswahl wie im Original ("Als Kind hast du …"), mit den vier Künsten. */
function specChoices(sel: SpecialtyId, act: string): string {
  return `<div class="choices spec-choices" role="radiogroup" aria-label="Fähigkeit">${SPECIALTY_ORDER.map((id) => {
    const sp = SPECIALTIES[id];
    return `<button type="button" class="choice ${sel === id ? 'on' : ''}" role="radio" aria-checked="${sel === id}" data-act="${act}:${id}">
      <span class="muted">${sp.childhood} …</span><strong>${sp.name}</strong><span>${sp.blurb}</span>
      <ul class="skills">${sp.skills.map((k) => `<li><b>${k.name}</b> <i>${k.cost} ${k.cost === 1 ? 'Punkt' : 'Punkte'}</i><br><small>${k.blurb}</small></li>`).join('')}</ul></button>`;
  }).join('')}</div>`;
}

function createScreen(): string {
  return `<div class="solo"><div class="solo-panel">
    <h1>Wer bist du?</h1>
    <p class="lead">Du kommst nach <span class="place">Moosgrund</span>, ein Dorf am Rand des Brackenwalds. In der Farnschlucht schläft ein Wyrm. Noch.</p>
    ${flashHtml()}
    <label class="field">Dein Name<input type="text" id="name" maxlength="20" autocomplete="off" value="${esc(ui.createName)}" placeholder="${ui.createGender === 'f' ? 'z. B. Hilda' : 'z. B. Hagen'}"></label>
    <div class="seg" role="radiogroup" aria-label="Held oder Heldin">
      ${(['m', 'f'] as const).map((g) => `<button type="button" class="seg-btn ${ui.createGender === g ? 'on' : ''}" role="radio" aria-checked="${ui.createGender === g}" data-act="gender:${g}">${g === 'm' ? 'Held' : 'Heldin'}</button>`).join('')}
    </div>
    <h2>Woher kommst du?</h2>
    ${raceChoices(ui.createRace, ui.createSpec, ui.createGender, 'race')}
    <h2>Was hast du als Kind gemacht?</h2>
    ${specChoices(ui.createSpec, 'spec')}
    <p class="muted">Jeden Tag hast du einen Punkt für deine Fähigkeit. Mit jedem Meister, den du besiegst, wirst du besser darin, und jede dritte Stufe bringt einen Punkt mehr pro Tag.</p>
    <div class="row"><button type="button" class="btn" data-act="create">Nach Moosgrund aufbrechen</button>
      <button type="button" class="btn ghost" data-act="go:title">Zurück</button></div>
  </div></div>`;
}

function villageScreen(s: GameState): string {
  const p = s.player;
  const m = masterForLevel(p.level);
  const mstate = canChallengeMaster(p);
  const found = Object.keys(s.bestiary).filter((k) => k !== 'dragon').length;
  const main = `<h1>Moosgrund</h1>
    <p class="lead">Du stehst auf dem Dorfplatz von <span class="place">Moosgrund</span>. Rauch steigt aus den Kaminen, aus dem Gasthaus <span class="place">Zum Schlafenden Wurm</span> klingt Gelächter. Im Norden rauscht der <span class="place">Brackenwald</span>, und irgendwo dahinter schläft der Wyrm.</p>
    ${prefs.welcomed ? '' : `<section class="welcome">
      <h2>Danke, dass du testest!</h2>
      <p>Brackenwyrm ist ein Nachfolger der Browserspiele von damals und noch in Arbeit. Spiel einfach so, wie du früher gespielt hast: <strong>jeden Tag ein bisschen</strong>. Um Mitternacht gibt es neue Waldkämpfe.</p>
      <p>Wenn dir etwas auffällt, ob Fehler, Langeweile, zu schwer oder eine Idee, drück auf <strong>Rückmeldung geben</strong>. Dein Spielstand wird automatisch mitgeschickt, du musst nichts erklären.</p>
      <p class="muted">Der Spielstand liegt in diesem Browser. Nicht im privaten Fenster spielen, sonst ist er weg.</p>
      <button type="button" class="btn" data-act="welcome">Los geht’s</button>
    </section>`}
    <p class="statue">${statueText(s)}</p>
    ${flashHtml()}
    ${s.news.length ? `<section class="news"><h2>Neuigkeiten</h2>${s.news.slice(-4).map((n) => `<p>${esc(n)}</p>`).join('')}</section>` : ''}
    ${cloud.enabled ? squareHtml() : ''}`;
  return layout(s, main, [
    { title: 'Stadttor', items: [
      { act: 'go:forest', label: 'Wald', key: 'w', hint: `${p.forestFights} Kämpfe übrig` },
      ...(cloud.enabled ? [{ act: 'go:fields', label: 'Felder vor dem Tor', key: 'f', hint: cloud.signedIn ? 'schlafende Helden' : 'nur mit Spielerkonto', disabled: !cloud.signedIn }] : []),
    ] },
    { title: 'Dorf', items: [
      { act: 'go:training', label: 'Trainingsplatz', key: 't', hint: mstate === 'ok' ? `${m?.name} wartet!` : '' },
      { act: 'go:healer', label: 'Mirlas Kräuterhütte', key: 'h', hint: p.hp < maxHp(p) ? `${maxHp(p) - p.hp} LP fehlen` : '' },
      { act: 'go:smith', label: 'Alriks Schmiede', key: 's' },
      { act: 'go:inn', label: 'Gasthaus', key: 'g' },
      { act: 'go:bank', label: 'Kontor', key: 'k', hint: p.bank ? `${p.bank} Gold` : '' },
      { act: 'go:stable', label: 'Mertens Pferdestall', key: 'p', hint: p.mount ? MOUNTS[p.mount].name : '' },
      { act: 'go:quirin', label: 'Quirins Tränke', key: 'q', hint: p.pendingChoice ? 'du musst dich entscheiden' : p.gems ? `${p.gems} Edelstein${p.gems === 1 ? '' : 'e'}` : '' },
    ] },
    { title: 'Am Dorfrand', items: [
      ...(cloud.enabled ? [{ act: 'go:seer', label: 'Das Zelt der Seherin', key: 'z', hint: p.seerPaid ? 'bezahlt' : 'mit den Toten reden' }] : []),
      { act: 'go:ambros', label: 'Der alte Ambros', key: 'a', hint: (p.ambrosGames ?? 0) >= AMBROS_GAMES_PER_DAY ? 'schläft' : 'Zahlenraten' },
      ...(cloud.enabled ? [
        { act: 'go:garten', label: 'Der Rosengarten', key: 'o' },
        { act: 'go:felsen', label: 'Der Wyrmstein', key: 'y', hint: p.dragonKills ? 'Drachentöter' : '' },
      ] : []),
    ] },
    { title: 'Sonstiges', items: [
      { act: 'go:bestiary', label: 'Bestiarium', key: 'b', hint: `${found} / ${MONSTERS.length}` },
      ...(cloud.enabled ? [{ act: 'go:news', label: 'Tagesneuigkeiten', key: 'n' }] : []),
      { act: 'go:fame', label: 'Ruhmeshalle', key: 'r' },
      ...(cloud.enabled ? [
        { act: 'go:warriors', label: 'Kriegerliste', key: 'l', hint: cloud.signedIn ? '' : 'nur mit Spielerkonto', disabled: !cloud.signedIn },
        { act: 'go:mail', label: 'Briefe', key: 'i', hint: !cloud.signedIn ? 'nur mit Spielerkonto' : ui.unread ? `${ui.unread} neu` : '', disabled: !cloud.signedIn },
      ] : []),
      { act: 'go:chronicle', label: 'Kampfchronik', key: 'c', hint: s.chronicle.length ? `${s.chronicle.length} Kämpfe` : '' },
      { act: 'go:settings', label: 'Einstellungen', key: 'e' },
      { act: 'feedback', label: 'Rückmeldung geben', key: 'm' },
    ] },
  ]);
}

function eventScreen(s: GameState): string {
  const pe = s.pendingEvent!;
  const ev = eventById(pe.id);
  const p = s.player;
  const main = `<h1>Der Brackenwald</h1>
    <div class="event-box log">${pe.lines.map((l) => `<p class="${l.k}">${esc(l.t)}</p>`).join('')}</div>
    <p class="muted">Was tust du?</p>`;
  return layout(s, main, [{ title: 'Entscheidung', items: (ev?.choices ?? []).map((c, i) => ({
    act: `event:${c.id}`, label: c.labelFor ? c.labelFor(pe.data) : c.label, key: c.key, hint: c.hint?.(p), disabled: !!c.available && !c.available(p), primary: ev?.neutral ? false : i === 0,
  })) }], 'in-fight');
}

function forestScreen(s: GameState): string {
  const p = s.player;
  if (s.pendingEvent) return eventScreen(s);
  const low = p.hp < maxHp(p) * 0.4;
  const main = `<h1>Der Brackenwald</h1>
    <p class="lead">Zwischen den Stämmen ist es still. Farne reichen dir bis zur Hüfte, und irgendwo knackt ein Ast.</p>
    ${flashHtml()}
    ${low ? `<p class="warn-box">Du bist angeschlagen (${p.hp} von ${maxHp(p)} Lebenspunkten). Mirla in der Kräuterhütte könnte helfen.</p>` : ''}
    ${p.forestFights <= 0 ? '<p class="warn-box">Du bist zu müde für weitere Abenteuer. Morgen ist auch noch ein Tag.</p>' : ''}`;
  const none = p.forestFights <= 0;
  return layout(s, main, [
    { title: 'Wald', items: [
      { act: 'forest:normal', label: 'Herumstreifen', key: 'h', hint: 'Gegner deiner Stufe', disabled: none, primary: true },
      { act: 'forest:easy', label: 'Leichte Beute suchen', key: 'l', hint: 'schwächer, weniger Lohn', disabled: none },
      { act: 'forest:hard', label: 'Nervenkitzel suchen', key: 'n', hint: 'stärker, mehr Lohn', disabled: none },
      ...(p.level >= MAX_LEVEL ? [{ act: 'dragon', label: 'Den Brackenwyrm suchen', key: 'b', hint: 'Endkampf', disabled: !canSeekDragon(p) }] : []),
      ...(p.festeFound ? [{ act: 'go:feste', label: 'Zur versunkenen Feste', key: 'f', hint: p.level < FESTE_MIN_LEVEL ? `ab Stufe ${FESTE_MIN_LEVEL}` : p.festeDay === todayKey() ? (s.feste && !s.feste.over ? 'du bist drin' : 'heute schon') : `${FESTE_COST} Waldkämpfe` }] : []),
    ] },
    { title: 'Zurück', items: [back] },
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
  const fx = `${heroAttacked ? `<div class="dmg dmg-foe ${f.lastCrit ? 'crit' : ''}">${f.lastHeroMiss ? 'Daneben' : '−' + f.lastHeroDmg}</div>` : ''}
    ${foeAttacked ? `<div class="dmg dmg-hero">${f.lastFoeMiss ? 'Ausgewichen' : '−' + f.lastFoeDmg + ' LP'}</div>` : ''}
    ${f.over === 'win' ? '<div class="stamp">Besiegt</div>' : ''}`;
  const isNew = f.over === 'win' && (f.kind === 'forest' || f.kind === 'grave' || f.kind === 'feste') && s.bestiary[f.monsterId] === 1;

  let groups: Group[] = [];
  if (!f.over) {
    // Wie im Original: die Künste stehen unter dem Namen der Fähigkeit mit den Punkten, nur die bezahlbaren sind nutzbar.
    const pts = `${p.specialUses} ${p.specialUses === 1 ? 'Punkt' : 'Punkte'}`;
    const skillItems: Item[] = f.kind === 'grave' ? [] : sp.skills.map((k, i) => ({
      act: `fight:skill:${k.cost}`, label: k.name, key: String(i + 1), hint: `${k.cost} ${k.cost === 1 ? 'Punkt' : 'Punkte'}`, disabled: p.specialUses < k.cost,
    }));
    const fightItems: Item[] = [
      { act: 'fight:attack', label: 'Angreifen', key: 'a', primary: true },
      ...(skillItems.length ? [{ act: 'skills', label: sp.name, key: 's', hint: pts, mobileOnly: true }] : []),
      ...(f.kind !== 'master' ? [{ act: 'fight:auto', label: 'Kämpfen bis zum Ende', key: 'k' }] : []),
      { act: 'fight:flee', label: f.kind === 'master' ? 'Aufgeben' : 'Fliehen', key: f.kind === 'master' ? 'u' : 'f' },
    ];
    const skillGroup = { title: `${sp.name} · ${pts}`, items: skillItems };
    groups = ui.skillMenu && skillItems.length
      ? [{ title: skillGroup.title, dock: true, items: [...skillItems.map((it, i) => ({ ...it, primary: i === 0 && !it.disabled })), { act: 'skills', label: 'Zurück', key: 'z', mobileOnly: true }] }, { title: 'Kampf', items: fightItems }]
      : [{ title: 'Kampf', items: fightItems }, ...(skillItems.length ? [skillGroup] : [])];
  } else {
    const items: Item[] = [];
    if (f.kind === 'pvp') {
      if (f.over === 'win') {
        items.push(f.pvpPlace === 'gasthaus' ? { act: 'after:inn', label: 'Zurück in die Gaststube', key: 'g' } : { act: 'after:fields', label: 'Zurück auf die Felder', key: 'f' });
        items.push({ act: 'after:village', label: 'Zurück ins Dorf', key: 'd' });
      } else {
        items.push({ act: 'after:shadows', label: 'Ins Schattenreich', key: 'w' });
      }
    } else if (f.kind === 'grave') {
      if (f.over === 'win') items.push({ act: 'after:grave', label: 'Weiter am Nebelfluss', key: 'w', hint: `${p.graveFights} Schattenkämpfe`, disabled: p.graveFights <= 0 });
      items.push({ act: 'after:shadows', label: 'Zurück zu Morwen', key: 'm' });
    } else if (f.kind === 'forest' && f.over !== 'lose') {
      items.push({ act: 'after:forest', label: 'Weiter durch den Wald', key: 'w', hint: `${p.forestFights} Kämpfe übrig`, disabled: p.forestFights <= 0 });
      items.push({ act: 'after:village', label: 'Zurück ins Dorf', key: 'd' });
    } else if (f.kind === 'master') {
      items.push({ act: 'after:training', label: 'Zurück zum Trainingsplatz', key: 't' });
      items.push({ act: 'after:village', label: 'Zurück ins Dorf', key: 'd' });
    } else if (f.kind === 'dragon' && f.over === 'win') {
      items.push({ act: 'after:bonus', label: 'Weiter', key: 'w' });
    } else if (f.kind === 'feste' && f.over !== 'lose') {
      items.push({ act: 'after:feste', label: f.monsterId === 'hueter' && f.over === 'win' ? 'In die Schatzkammer' : 'Weiter durch die Feste', key: 'w' });
    } else if (f.over === 'fled') {
      items.push({ act: 'after:forest', label: 'Zurück in den Wald', key: 'w' });
      items.push({ act: 'after:village', label: 'Zurück ins Dorf', key: 'd' });
    } else {
      items.push({ act: 'after:shadows', label: 'Ins Schattenreich', key: 'w' });
    }
    if (items[0]) items[0].primary = true;
    groups = [{ title: 'Weiter', items }];
  }

  const main = `<div class="battle">
      <div class="arena ${f.kind}">${card.replace('</figure>', `${isNew ? '<div class="card-new">Neu</div>' : ''}</figure>`)}${fx}</div>
      <div class="battle-side">
        <h1 class="foe-title">${esc(f.foe.name)}</h1>
        <div class="log fight-log ${ui.fullLog ? 'open' : ''}" aria-live="polite">${fightLogHtml(f.log)}</div>
        ${f.round > 2 ? `<button type="button" class="log-toggle" data-act="fulllog">${ui.fullLog ? 'Bericht einklappen' : `Ganzen Kampf anzeigen (${f.round} Runden)`}</button>` : ''}
        ${prefs.fightHint ? '' : '<p class="hint-desk">Deine Befehle stehen links, wie früher. Taste <b class="hk">A</b> greift an, <b class="hk">K</b> kämpft bis zum Ende.</p>'}
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
    text = '<p class="lead">Kein Meister in Moosgrund kann dir noch etwas beibringen. Nur einer wartet noch: der <span class="place">Brackenwyrm</span> in der Farnschlucht.</p>';
  } else {
    const line = st === 'ok' ? m.greeting : st === 'seen' ? `${m.name} winkt ab. „Für heute reicht’s. Komm morgen wieder.“` : m.notReady;
    text = `<div class="speaker">${cardHtml(masterCard(p.level), { cls: 'mini', fx: true })}<div>
      <p class="lead">${esc(line)}</p>
      ${st === 'notReady' ? `<p class="muted">Dir fehlen noch ${need - p.exp} Erfahrungspunkte.</p>` : ''}</div></div>`;
  }
  return layout(s, `<h1>Der Trainingsplatz</h1>${flashHtml()}${text}`, [
    { title: 'Training', items: m && st !== 'max' ? [{ act: 'master', label: `${m.name} herausfordern`, key: 'm', disabled: st !== 'ok', hint: st === 'seen' ? 'morgen wieder' : st === 'ok' ? `Aufstieg auf Stufe ${p.level + 1}` : 'noch nicht bereit' }] : [] },
    { title: 'Zurück', items: [back] },
  ]);
}

function healerScreen(s: GameState): string {
  const p = s.player;
  const missing = maxHp(p) - p.hp;
  const full = healCost(p, missing);
  const half = healCost(p, Math.ceil(missing / 2));
  const main = `<h1>Mirlas Kräuterhütte</h1>
    <p class="lead">${missing <= 0 ? 'Mirla mustert dich. „Dir fehlt nichts. Raus mit dir, ich hab zu tun.“' : `Mirla schnalzt mit der Zunge. „${missing} Lebenspunkte fehlen dir. Wenn ich alles heile, macht das <span class="gold">${full} Gold</span>.“`}</p>
    <p class="muted">Preis auf deiner Stufe: ${healCostPerHp(p.level).toFixed(2).replace('.', ',')} Gold pro Lebenspunkt.</p>
    ${flashHtml()}`;
  return layout(s, main, [
    { title: 'Heilen', items: [
      { act: 'heal:full', label: 'Vollständig heilen', key: 'v', hint: `${full} Gold`, disabled: missing <= 0 || p.gold < full },
      { act: 'heal:half', label: 'Teilweise heilen', key: 't', hint: `${half} Gold`, disabled: missing <= 0 || p.gold < half },
    ] },
    { title: 'Zurück', items: [back] },
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
        <td class="num">${owned ? 'deins' : `<button type="button" class="tbtn" data-act="buy:${kind}:${it.tier}" ${p.gold < cost ? 'disabled' : ''}>Kaufen</button>`}</td></tr>`;
    }).join('');
    return `<div class="scroll-x"><table><thead><tr><th>${kind === 'weapon' ? 'Waffe' : 'Rüstung'}</th><th class="num">${kind === 'weapon' ? 'Angriff' : 'Schutz'}</th><th class="num">Gold*</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
  };
  const main = `<h1>Alriks Schmiede</h1>
    <p class="lead">Funken stieben. „Gutes Eisen rettet Leben“, brummt Alrik. „Dein altes Zeug nehm ich in Zahlung, halber Preis.“</p>
    ${flashHtml()}${table('weapon')}${table('armor')}
    <p class="muted small">* Preis nach Eintausch deiner jetzigen Ausrüstung.</p>`;
  return layout(s, main, [{ title: 'Zurück', items: [back] }]);
}

function bankScreen(s: GameState): string {
  const p = s.player;
  const main = `<h1>Das Kontor</h1>
    <p class="lead">Ansgar zählt Münzen, die nicht ihm gehören. „Was hier liegt, verlierst du nicht im Wald. Und über Nacht gibt’s Zinsen.“</p>
    ${flashHtml()}
    <p>Im Kontor: <span class="gold">${p.bank} Gold</span> · Dabei: <span class="gold">${p.gold} Gold</span></p>
    <div class="row"><input type="number" id="amount" min="1" inputmode="numeric" placeholder="Betrag" aria-label="Betrag">
      <button type="button" class="tbtn" data-act="bank:dep:input">Einzahlen</button>
      <button type="button" class="tbtn" data-act="bank:wd:input">Abheben</button></div>`;
  return layout(s, main, [
    { title: 'Kontor', items: [
      { act: 'bank:dep:all', label: 'Alles einzahlen', key: 'e', disabled: p.gold <= 0 },
      { act: 'bank:wd:all', label: 'Alles abheben', key: 'a', disabled: p.bank <= 0 },
    ] },
    { title: 'Zurück', items: [back] },
  ]);
}

const RUMORS = [
  '„Der Wyrm träumt“, sagt ein alter Holzfäller. „Und wenn er träumt, wachsen die Farne schneller.“',
  'Zwei Jäger streiten, ob Eulenbären Eier legen. Keiner will es herausfinden.',
  '„Mirla hat mal einen Troll geheilt“, flüstert jemand. „Er schuldet ihr heute noch Geld.“',
  'Florian probt ein neues Lied. Es reimt „Wyrm“ auf „Schirm“. Niemand ist begeistert.',
  'Am Nebentisch prahlt ein Söldner mit einem Kampf gegen den Bergtrollkönig. Seine Hände zittern.',
  '„Wer im Pilzring tanzt, verliert die Zeit“, sagt Frieda. „Oder findet welche.“',
];

function innScreen(s: GameState): string {
  const p = s.player;
  const main = `<h1>Zum Schlafenden Wurm</h1>
    <p class="lead">Das Feuer knistert. Wirtin <span class="npc">Frieda</span> poliert ein Glas, das davon nicht sauberer wird. In der Ecke stimmt Barde <span class="npc">Florian</span> seine Laute.</p>
    <p class="rumor">${esc(RUMORS[s.day % RUMORS.length])}</p>
    ${flashHtml()}
    ${cloud.enabled && p.innRoom ? '<p class="muted">Du hast für heute ein Zimmer. Wenn du jetzt aufhörst zu spielen, schläfst du hier sicherer als draußen auf den Feldern.</p>' : ''}
    <section class="table-talk"><h2>Am Stammtisch</h2>
      ${regularsSay(s).map((l) => `<p><span class="npc">${esc(l.who.charAt(0).toUpperCase() + l.who.slice(1))}:</span> ${esc(l.t)}</p>`).join('')}
    </section>
    ${cloud.enabled ? squareHtml('gasthaus') : ''}`;
  const talksLeft = FRIEDA_TALKS_PER_DAY - p.innTalks;
  return layout(s, main, [
    { title: 'Gasthaus', items: [
      { act: 'talk', label: 'Mit Frieda reden', key: 'f', hint: talksLeft > 0 ? `${talksLeft}× heute` : 'hat zu tun' },
      { act: 'inn:beer', label: 'Harzbier bestellen', key: 'h', hint: p.drankToday ? 'heute schon' : `${harzbierCost(p.level)} Gold`, disabled: p.drankToday },
      { act: 'inn:song', label: 'Lied wünschen', key: 'l', hint: p.songToday ? 'heute schon' : '1 Edelstein', disabled: p.songToday },
      { act: 'go:flirt', label: p.marriedTo ? `Zu ${PARTNERS[p.marriedTo].name} gehen` : `${PARTNERS[partnerOf(p)].name} umwerben`, key: 'u', hint: p.seenLover ? 'heute schon' : p.marriedTo ? 'dein Schatz' : '' },
      { act: 'looks', label: `${PARTNERS[friendOf(p)].name} fragen, wie du aussiehst`, key: 'a' },
      ...(cloud.enabled ? [
        { act: 'room', label: 'Zimmer mieten', key: 'z', hint: p.innRoom ? 'gemietet' : `${roomCost(p.level)} Gold`, disabled: p.innRoom },
        { act: 'bribe', label: 'Frieda bestechen', key: 'b', hint: cloud.signedIn ? '1 Edelstein' : 'nur mit Spielerkonto', disabled: !cloud.signedIn || p.gems < 1 },
      ] : []),
    ] },
    { title: 'Zurück', items: [back] },
  ]);
}

function stableScreen(s: GameState): string {
  const p = s.player;
  const own = p.mount ? MOUNTS[p.mount] : null;
  const ownBuff = p.buffs.find((b) => b.id === 'mount');
  const main = `<h1>Mertens Pferdestall</h1>
    <p class="lead">${esc(MERTEN.greeting)}</p>
    ${flashHtml()}
    ${own ? `<p>Im Stall steht ${esc(own.yourNom.replace('Dein', 'dein'))}. ${ownBuff ? `${esc(own.buffName)}: noch ${ownBuff.rounds} Runden.` : 'Es ist müde vom Tag.'}</p>` : ''}
    <div class="card-grid mount-grid">${MOUNT_ORDER.map((id) => {
      const m = MOUNTS[id];
      return `<div class="mount-offer ${p.mount === id ? 'owned' : ''}">${cardHtml(mountCard(id), { cls: 'grid-card' })}
        <p><strong>${m.gems} Edelsteine</strong><br>+${m.fights} Waldkämpfe pro Tag<br>+20 % Angriff für ${m.rounds} Runden<br><span class="muted">${esc(m.blurb)}</span></p></div>`;
    }).join('')}</div>
    <p class="muted">Ein Reittier bleibt dir auch nach dem Drachen. Beim Tausch rechnet Merten dein altes Tier mit zwei Dritteln seines Preises an.</p>`;
  const buyItems: Item[] = MOUNT_ORDER.filter((id) => id !== p.mount).map((id, i) => {
    const c = tradeCost(p, id);
    return { act: `mount:buy:${id}`, label: `${p.mount ? 'Tauschen gegen' : 'Kaufen:'} ${MOUNTS[id].name}`, key: String(i + 1),
      hint: c >= 0 ? `${c} Edelsteine` : `du bekommst ${-c} Edelsteine`, disabled: p.gems < c };
  });
  const ownItems: Item[] = own ? [
    { act: 'mount:feed', label: 'Füttern', key: 'f', hint: p.mountFed ? 'heute schon' : `${feedPrice(p)} Gold`, disabled: p.mountFed || p.gold < feedPrice(p) || (!!ownBuff && ownBuff.rounds >= own.rounds) },
    { act: 'mount:sell', label: ui.confirmDelete ? `Wirklich verkaufen? Nochmal drücken.` : `${own.name} verkaufen`, key: 'v', hint: `+${mountRepay(p.mount)} Edelsteine` },
  ] : [];
  return layout(s, main, [
    { title: 'Stall', items: [...ownItems, ...buyItems] },
    { title: 'Zurück', items: [back] },
  ]);
}

function flirtScreen(s: GameState): string {
  const p = s.player;
  const id = partnerOf(p);
  const pt = PARTNERS[id];
  const toInn: Item = { act: 'go:inn', label: 'Zurück in die Gaststube', key: 'g' };
  if (p.marriedTo) {
    const spouse = PARTNERS[p.marriedTo];
    const main = `<h1>${esc(spouse.name)}</h1>
      <p class="lead">${p.marriedTo === 'frieda' ? 'Frieda wischt sich die Hände an der Schürze ab, als sie dich sieht.' : 'Florian legt die Laute weg, als er dich sieht.'} Ihr seid verheiratet. Einmal am Tag habt ihr Zeit füreinander.</p>
      ${flashHtml()}
      <p class="muted">Verheiratete müssen nicht mehr so auf ihr Äußeres achten. Jeden Tag geht etwas Charme verloren. Wenn er ganz aufgebraucht ist, geht ${esc(spouse.name)}.</p>`;
    return layout(s, main, [
      { title: esc(spouse.name), items: [{ act: 'spouse', label: 'Zeit miteinander verbringen', key: 'z', hint: p.seenLover ? 'heute schon' : '', disabled: p.seenLover, primary: true }] },
      { title: 'Zurück', items: [toInn, back] },
    ]);
  }
  const main = `<h1>${esc(pt.name)} umwerben</h1>
    <p class="lead">${esc(pt.intro)}</p>
    ${flashHtml()}
    <p class="muted">Je kühner der Versuch, desto mehr Charme brauchst du. Ein Versuch pro Tag. ${p.seenLover ? esc(pt.notToday) : ''}</p>`;
  const keys = ['z', 'h', 'k', 's', 'c', 't', 'a'];
  return layout(s, main, [
    { title: 'Flirten', items: pt.moves.map((m, i) => ({ act: `flirt:${i}`, label: m.label, key: keys[i], hint: m.hint, disabled: p.seenLover })) },
    { title: 'Zurück', items: [toInn, back] },
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
    return `<section class="b-level"><h2>Stufe ${lvl}</h2><div class="card-grid">${cards}</div></section>`;
  }).join('');
  const dragon = s.bestiary.dragon ? cardHtml(dragonCard(), { count: s.bestiary.dragon, cls: 'grid-card' }) : cardBack(18);
  const main = `<h1>Bestiarium</h1>
    <p class="lead">Jede Kreatur, die du besiegst, bekommt hier ihre Karte. <span class="gold">${found} von ${MONSTERS.length}</span> entdeckt.</p>
    <div class="progress">${bar(found, MONSTERS.length, 'xp')}</div>
    ${sections}
    <section class="b-level"><h2>Legende</h2><div class="card-grid">${dragon}</div></section>
    <section class="b-level"><h2>${FESTE_NAME}</h2><div class="card-grid">${FESTE_FOES.map((m) => {
      const n = s.bestiary[m.id] ?? 0;
      return n ? cardHtml(monsterCard(m), { count: n, cls: 'grid-card', isNew: ui.newCard === m.id }) : cardBack(m.level);
    }).join('')}</div></section>
    <section class="b-level"><h2>Schattenreich</h2><div class="card-grid">${SHADES.map((m) => {
      const n = s.bestiary[m.id] ?? 0;
      return n ? cardHtml(shadeCard(m.id)!, { count: n, cls: 'grid-card', isNew: ui.newCard === m.id }) : shadeBack();
    }).join('')}</div></section>`;
  return layout(s, main, [{ title: 'Zurück', items: [back] }]);
}

function fameScreen(s: GameState): string {
  const p = s.player;
  const st = s.stats;
  const rows = fameTable(s).map((e, i) => `<tr class="${e.isPlayer ? 'me' : ''}"><td class="rank">${i + 1}.</td>
    <td><strong>${esc(e.name)}</strong><small>${esc(e.title)}</small></td><td class="num">${e.dragonKills}</td><td class="num">${e.level}</td></tr>`).join('');
  const found = Object.keys(s.bestiary).filter((k) => k !== 'dragon').length;
  const rec = (label: string, value: string) => `<div class="rec"><span>${label}</span><strong>${value}</strong></div>`;
  const main = `<h1>Ruhmeshalle</h1>
    <p class="lead">An der Wand im Rathaus hängen die Namen aller, die dem Brackenwyrm gegenübergetreten sind. Manche sind frisch geschnitzt, andere kaum noch zu lesen.</p>
    <table class="fame"><thead><tr><th></th><th>Held</th><th class="num">Drachen</th><th class="num">Stufe</th></tr></thead><tbody>${rows}</tbody></table>
    ${ui.fame && ui.fame.length ? `<h2>Drachentöter aus aller Welt</h2>
    <table class="fame"><thead><tr><th></th><th>Held</th><th class="num">Drachen</th><th class="num">Stufe</th></tr></thead><tbody>${ui.fame.map((e, i) => `<tr><td class="rank">${i + 1}.</td><td><strong>${esc(e.name)}</strong><small>${esc(titleFor(e.dragonKills, e.gender))}</small></td><td class="num">${e.dragonKills}</td><td class="num">${e.level}</td></tr>`).join('')}</tbody></table>` : ''}
    <h2>Deine Geschichte</h2>
    <p class="muted">Titel: <span class="gold">${esc(titleFor(p.dragonKills, p.gender))}</span>${p.dragonKills < 31 ? ` · nach dem nächsten Drachen: ${esc(titleFor(p.dragonKills + 1, p.gender))}` : ''}</p>
    <div class="records">
      ${rec('Drachenkills', String(p.dragonKills))}
      ${rec('Schnellster Drachenkill', st.fastestDragon ? `${st.fastestDragon} Tage` : 'noch keiner')}
      ${rec('Stärkster Treffer', st.bestHit.dmg ? `${st.bestHit.dmg} (${esc(st.bestHit.foe)}, Tag ${st.bestHit.day})` : 'noch keiner')}
      ${rec('Siege im Wald', String(st.kills))}
      ${rec('Besiegte Meister', String(st.masters))}
      ${rec('Karten im Bestiarium', `${found} / ${MONSTERS.length}`)}
      ${rec('Waldereignisse', String(st.events))}
      ${rec('Fahrten mit Morwen', String(st.deaths))}
      ${rec('Spieltage', String(s.day))}
    </div>`;
  return layout(s, main, [{ title: 'Zurück', items: [back] }]);
}

const RESULT: Record<ChronicleEntry['result'], string> = { win: 'Sieg', lose: 'Niederlage', fled: 'Geflohen' };

function chronicleScreen(s: GameState): string {
  const list = s.chronicle.map((c, i) => `<details class="chron ${c.result}" ${i === 0 ? 'open' : ''}>
      <summary><span class="chron-foe">${esc(c.foe)}</span>
        <span class="chron-meta">Tag ${c.day} · ${RESULT[c.result]} in ${c.rounds} ${c.rounds === 1 ? 'Runde' : 'Runden'}${c.topHit ? ` · stärkster Treffer ${c.topHit}` : ''}</span></summary>
      <div class="log fight-log open">${fightLogHtml(c.log)}</div>
    </details>`).join('');
  const main = `<h1>Kampfchronik</h1>
    <p class="lead">Der Dorfschreiber notiert deine letzten ${CHRONICLE_SIZE} Kämpfe. Wort für Wort, auch die peinlichen.</p>
    ${list || '<p class="muted">Noch keine Kämpfe. Der Wald wartet.</p>'}`;
  return layout(s, main, [{ title: 'Zurück', items: [back] }]);
}

const SCREEN_NAMES: Partial<Record<Screen, string>> = {
  village: 'Dorfplatz', forest: 'Wald', fight: 'Kampf', training: 'Trainingsplatz', healer: 'Kräuterhütte', smith: 'Schmiede',
  bank: 'Kontor', inn: 'Gasthaus', bestiary: 'Bestiarium', fame: 'Ruhmeshalle', chronicle: 'Kampfchronik', settings: 'Einstellungen',
  shadows: 'Schattenreich', dragonBonus: 'Drachenkill', quirin: 'Quirins Tränke', feste: 'Versunkene Feste', heirlooms: 'Erbstücke', seer: 'Seherin', felsen: 'Wyrmstein', garten: 'Rosengarten',
  stable: 'Pferdestall', ambros: 'Ambros', warriors: 'Kriegerliste', mail: 'Briefe', bio: 'Steckbrief',
};

function buildFeedback(s: GameState): string {
  return feedbackMessage(s, VERSION, ui.fbKinds, ui.fbText, SCREEN_NAMES[ui.fbFrom] ?? ui.fbFrom);
}

function feedbackScreen(s: GameState): string {
  const msg = buildFeedback(s);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const main = `<h1>Rückmeldung geben</h1>
    <p class="lead">Was ist dir aufgefallen? Ein Satz reicht. Dein Spielstand wird unten automatisch angehängt.</p>
    <div class="chips" role="group" aria-label="Art der Rückmeldung">
      ${FEEDBACK_KINDS.map((k) => `<button type="button" class="chip ${ui.fbKinds.includes(k.id) ? 'on' : ''}" aria-pressed="${ui.fbKinds.includes(k.id)}" data-act="fbkind:${k.id}">${k.label}</button>`).join('')}
    </div>
    <label class="field">Deine Nachricht<textarea id="fbtext" rows="5" placeholder="z. B. Ab Stufe 6 sterbe ich ständig, oder: Ich hätte gern ein Haustier.">${esc(ui.fbText)}</textarea></label>
    <div class="row send-row">
      <button type="button" class="btn" data-act="fbsend:wa">Per WhatsApp senden</button>
      ${canShare ? '<button type="button" class="btn alt" data-act="fbsend:share">Teilen …</button>' : ''}
      <button type="button" class="btn ghost" data-act="fbsend:mail">Per E-Mail</button>
      <button type="button" class="btn ghost" data-act="fbsend:copy">Text kopieren</button>
    </div>
    ${ui.fbMsg ? `<p class="flash">${esc(ui.fbMsg)}</p>` : ''}
    <details class="fb-preview"><summary>So sieht die Nachricht aus</summary><textarea id="fbpreview" readonly rows="11" aria-label="Fertige Nachricht">${esc(msg)}</textarea></details>`;
  return layout(s, main, [{ title: 'Zurück', items: [{ act: `go:${ui.fbFrom === 'fight' ? 'village' : ui.fbFrom}`, label: 'Zurück', key: 'd' }] }]);
}

function accountHtml(): string {
  const msg = ui.acctMsg ? `<p class="muted">${esc(ui.acctMsg)}</p>` : '';
  if (cloud.signedIn) {
    return `<h2>Spielerkonto</h2>
      <p>Angemeldet als <strong>${esc(cloud.email)}</strong>. Dein Spielstand wird automatisch online gesichert, damit du auf Handy und Computer weiterspielen kannst.</p>
      <div class="row"><button type="button" class="tbtn" data-act="acct:sync">Jetzt abgleichen</button><button type="button" class="tbtn" data-act="acct:out">Abmelden</button></div>${msg}`;
  }
  return `<h2>Spielerkonto</h2>
    <p class="muted">Mit einem Konto wird dein Spielstand online gesichert, und du spielst auf Handy und Computer mit demselben Helden.</p>
    <div class="acct-form">
      <label class="field">E-Mail<input type="email" id="acct-email" autocomplete="email" placeholder="deine@mail.at" value="${esc(ui.acctEmail)}"></label>
      <label class="field">Passwort<input type="password" id="acct-pass" autocomplete="current-password" placeholder="mindestens 6 Zeichen"></label>
    </div>
    <div class="row"><button type="button" class="btn" data-act="acct:in">Anmelden</button><button type="button" class="btn ghost" data-act="acct:up">Neues Konto anlegen</button></div>
    <p class="fine">Mit einem neuen Konto gilt die <button type="button" class="linkish" data-act="legal:datenschutz">Datenschutzerklärung</button>. Ein Konto ab 14 Jahren, jünger nur mit Einverständnis der Eltern.</p>${msg}`;
}

function summary(st: GameState): string {
  const p = st.player;
  const when = st.savedAt ? new Date(st.savedAt).toLocaleString('de-AT', { dateStyle: 'medium', timeStyle: 'medium' }) : 'unbekannt';
  return `<strong>${esc(p.name)}</strong>, Stufe ${p.level}, Spieltag ${st.day}<br>${p.gold} Gold, ${p.exp} Erfahrung, ${p.forestFights} Waldkämpfe übrig, ${p.dragonKills} Drachenkills<br><span class="muted">gespeichert ${when}</span>`;
}

function syncConflictScreen(s: GameState): string {
  const remote = ui.conflict!.state;
  const main = `<h1>Zwei Spielstände</h1>
    <p class="lead">Auf diesem Gerät und online wurde seit dem letzten Abgleich weitergespielt. Welcher Stand soll bleiben? Der andere geht verloren.</p>
    <div class="records sync-choice">
      <div class="rec"><span>Auf diesem Gerät</span><p>${summary(s)}</p></div>
      <div class="rec"><span>Online gesichert</span><p>${summary(remote)}</p></div>
    </div>`;
  return layout(s, main, [{ title: 'Entscheiden', items: [
    { act: 'conflict:local', label: 'Diesen Stand behalten', key: 'd' },
    { act: 'conflict:remote', label: 'Online-Stand laden', key: 'o' },
  ] }]);
}

// ---------- Spieler gegen Spieler, Dorfplatz, Neuigkeiten ----------


function targetsHtml(place: 'felder' | 'gasthaus'): string {
  const pv = ui.pvp;
  if (pv.loading) return '<p class="muted">Du schaust dich um …</p>';
  if (pv.error) return `<p class="warn-box">${esc(pv.error)}</p>`;
  if (!pv.targets) return '';
  if (!pv.targets.length) return `<p class="muted">${place === 'gasthaus' ? 'Frieda zuckt mit den Schultern. Heute Nacht schläft hier niemand, an den du herankommst.' : 'Auf den Feldern schläft gerade niemand in deiner Reichweite.'}</p>`;
  const none = (pv.fightsLeft ?? 1) <= 0 || pv.busy;
  return `<ul class="targets">${pv.targets.map((t) => `<li class="target">
      <span class="t-portrait">${heroPortrait(t.race, t.specialty, t.gender)}</span>
      <span class="t-info"><strong><span class="t-title">${esc(titleFor(t.dragonKills, t.gender))}</span> ${esc(t.name)}</strong><small>Stufe ${t.level} · ${raceName(t.race, t.gender)} · ${SPECIALTIES[t.specialty]?.name ?? ''}${t.dragonKills ? ` · Drachentöter ${t.dragonKills}×` : ''}${t.note ? ` · ${esc(t.note)}` : ''}</small></span>
      <button type="button" class="tbtn" data-act="pvp:${t.userId}:${place}" ${!t.attackable || none ? 'disabled' : ''}>Angreifen</button>
    </li>`).join('')}</ul>`;
}

function pvpIntro(): string {
  const pv = ui.pvp;
  const left = pv.fightsLeft === null ? '' : `<p>Spielerkämpfe heute: <span class="gold">${pv.fightsLeft} von 3</span>.</p>`;
  const immune = pv.immune ? '<p class="warn-box">Du stehst noch unter dem Schutz der Neulinge. Greifst du jemanden an, verlierst du diesen Schutz für immer.</p>' : '';
  return `${left}${immune}<p class="muted">Gewinnst du, bekommst du das Gold, das dein Gegner bei sich trägt, und etwas von seiner Erfahrung. Verlierst du, landest du bei Morwen und dein Gold wechselt den Besitzer.</p>`;
}

function fieldsScreen(s: GameState): string {
  const main = `<h1>Die Felder vor dem Tor</h1>
    <p class="lead">Wer abends nicht ins Gasthaus will, legt sich hier ins hohe Gras. Manche schnarchen. Manche tun nur so.</p>
    ${pvpIntro()}${flashHtml()}${targetsHtml('felder')}`;
  return layout(s, main, [{ title: 'Felder', items: [{ act: 'reload:felder', label: 'Nochmal umsehen', key: 'u' }] }, { title: 'Zurück', items: [back] }]);
}

function innGuestsScreen(s: GameState): string {
  const main = `<h1>Die Gästezimmer</h1>
    <p class="lead">Frieda lässt den Edelstein in ihrer Schürze verschwinden und schiebt dir das Gästebuch hin. „Ich hab nichts gesehen“, sagt sie und poliert weiter.</p>
    ${pvpIntro()}${flashHtml()}${targetsHtml('gasthaus')}`;
  return layout(s, main, [{ title: 'Gasthaus', items: [{ act: 'go:inn', label: 'Zurück in die Gaststube', key: 'g' }] }, { title: 'Zurück', items: [back] }]);
}

function when(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const same = d.toDateString() === today.toDateString();
  return same ? d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('de-AT', { day: 'numeric', month: 'short' }) + ', ' + d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
}

function newsScreen(s: GameState): string {
  const rows = ui.newsRows;
  const main = `<h1>Tagesneuigkeiten</h1>
    <p class="lead">Am Brunnen hängt ein Brett. Darauf nagelt der Dorfschreiber alles, was in Moosgrund und im Brackenwald passiert.</p>
    ${rows === null ? '<p class="muted">Der Dorfschreiber sucht seine Brille …</p>' : rows.length ? `<ul class="newsboard">${rows.map((n) => `<li><time>${when(n.created_at)}</time> ${esc(n.body)}</li>`).join('')}</ul>` : '<p class="muted">Noch ist nichts passiert. Das ändert sich bestimmt bald.</p>'}`;
  return layout(s, main, [{ title: 'Zurück', items: [back] }]);
}

type ChatSection = 'dorfplatz' | 'gasthaus' | 'schattenreich' | 'felsen' | 'garten';
const CHAT: Record<ChatSection, { title: string; empty: string; screens: Screen[]; place: string; hint?: string }> = {
  dorfplatz: { title: 'Auf dem Dorfplatz', empty: 'Auf dem Dorfplatz ist es still. Sag doch was.', screens: ['village'], place: 'Dorfplatz' },
  gasthaus: { title: 'Am Tresen', empty: 'Am Tresen schweigt man heute. Frieda poliert Gläser.', screens: ['inn'], place: 'Tresen' },
  schattenreich: { title: 'Flüstern am Nebelfluss', empty: 'Nur der Fluss rauscht. Flüstere den anderen Seelen etwas zu.', screens: ['shadows', 'seer'], place: 'Nebelfluss' },
  felsen: { title: 'Am Wyrmstein', empty: 'Die Drachentöter schweigen heute. Erzähl doch, wie dein letzter Kampf war.', screens: ['felsen'], place: 'Wyrmstein', hint: 'Erzähl von deinen Taten …' },
  garten: { title: 'Im Rosengarten', empty: 'Nur die Bienen summen. Setz dich auf eine Bank und sag etwas.', screens: ['garten'], place: 'Rosengarten', hint: 'Flüstere etwas zwischen den Rosen …' },
};

/** Gespräche wie im Original: Dorfplatz, Gasthaus und Schattenreich haben jeweils ihre eigene Runde. */
function squareHtml(section: ChatSection = 'dorfplatz'): string {
  const sq = ui.squares[section];
  const c = CHAT[section];
  const list = sq.comments === null ? '<p class="muted">…</p>'
    : sq.comments.length ? sq.comments.filter((x) => !(x.user_id && ui.blocked.has(x.user_id))).reverse().map((x) => `<p class="say"><span class="npc">${esc(x.name)}</span> <span class="muted">${when(x.created_at)}</span>${reportBtn('chat', x.id, x.user_id)}<br>${esc(x.body)}</p>`).join('')
    : `<p class="muted">${c.empty}</p>`;
  const input = cloud.signedIn
    ? `<div class="row say-row"><input type="text" id="say" data-section="${section}" maxlength="200" placeholder="${c.hint ?? (section === 'schattenreich' ? 'Flüstere etwas …' : 'Sag etwas …')}" value="${esc(ui.sayText)}" aria-label="Spruch für ${c.place}"><button type="button" class="tbtn" data-act="say:${section}">${section === 'schattenreich' ? 'Flüstern' : 'Sagen'}</button></div>`
    : '<p class="muted">Mit einem Spielerkonto kannst du hier mitreden (Einstellungen).</p>';
  return `<section class="square ${section}"><h2>${c.title}</h2>${list}${sq.error ? `<p class="warn">${esc(sq.error)}</p>` : ''}${input}</section>`;
}

/** Kleiner Melden-Knopf (erst Tippen fragt nach, zweites Tippen meldet). */
function reportBtn(kind: ReportKind, ref: number | string, owner?: string | null): string {
  if (!cloud.signedIn || !owner || owner === cloud.userId) return '';
  const key = `${kind}:${ref}`;
  const sure = ui.repConfirm === key;
  return ` <button type="button" class="flag ${sure ? 'sure' : ''}" data-act="rep:${key}" title="Melden" aria-label="${sure ? 'Wirklich melden' : 'Melden'}">${sure ? 'Wirklich melden?' : '⚑'}</button>`;
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
  }, (e) => { pv.error = e instanceof CloudError ? e.message : 'Das hat nicht geklappt.'; })
    .finally(() => { pv.loading = false; render(); });
}

/** Spielerkarte für den Kampf: das Heldenbild des anderen Spielers. */
function pvpCard(name: string, level: number, race: RaceId, spec: SpecialtyId, gender: Gender): CardInfo {
  return { key: `pvp:${name}`, name, level, tier: tierFor(level), art: heroArt(race, spec, gender), hasIllustration: true, flavor: '', glow: '#ffd88a', fx: 'motes', tierLabel: gender === 'f' ? 'Heldin' : 'Held' };
}

function statusOf(w: WarriorRow): string {
  if (w.online) return '<span class="on-dot"></span> unterwegs';
  if (!w.alive) return 'bei Morwen';
  return w.inInn ? 'schläft im Gasthaus' : 'schläft auf den Feldern';
}

/** Denkmal wie die Statue im Original: der letzte Drachentöter des Dorfes. */
function statueText(s: GameState): string {
  const own = s.player.dragonKills > 0 ? s.player.name : '';
  const name = ui.statue ?? (own || 'Brunhild Eisenhand');
  return `Mitten auf dem Platz steht ein moosbewachsenes Denkmal. Die Inschrift lautet: „<span class="gold">${esc(name)}</span>. Zuletzt bezwang diese Klinge den Brackenwyrm.“`;
}

let statueLoaded = false;
function loadStatue(): void {
  if (statueLoaded || !cloud.enabled) return;
  statueLoaded = true;
  const show = (name: string) => { ui.statue = name; if (currentScreen() === 'village') render(); };
  cloud.lastDragonSlayer().then((r) => {
    if (r) { show(r.name); return; }
    if (r === null) return;
    // Server noch ohne Teil 4: aus den Neuigkeiten lesen
    return cloud.newsAbout('hat den Brackenwyrm', 5).then((rows) => {
      const hit = rows.find((x) => x.body.includes('besiegt'));
      if (hit) show(hit.body.split(' hat den Brackenwyrm')[0].trim());
    });
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
      ${row('Stufe', String(w.level))}
      ${row('Rasse', raceName(w.race, w.gender))}
      ${row('Fähigkeit', SPECIALTIES[w.specialty].name)}
      ${row('Drachenkills', String(w.dragonKills))}
      ${row('Spieltage', String(w.daysPlayed))}
      ${row('Reittier', esc(mount || 'zu Fuß'))}
      ${row('Verheiratet', spouse ? `mit ${esc(spouse)}` : 'nein')}
    </div>
    ${heirs.length ? `<h2>Erbstücke der Wyrmjäger (${heirs.length} von ${HEIRLOOMS.length})</h2><p>${heirs.map((h) => `<span class="tag">${esc(h)}</span>`).join(' ')}</p>${heirs.length === HEIRLOOMS.length ? '<p class="gold">Erbe der Wyrmjäger</p>' : ''}` : ''}
    <h2>Steckbrief</h2>
    ${me ? `<textarea id="bio-text" class="bio-edit" maxlength="400" rows="5" placeholder="Erzähl etwas über deinen Helden …">${esc(text)}</textarea>
      <div class="row"><button type="button" class="tbtn" data-act="biosave">Steckbrief speichern</button><span class="muted">höchstens 400 Zeichen</span></div>`
      : `<p class="bio-text">${text ? esc(text).replace(/\n/g, '<br>') : '<span class="muted">Noch kein Steckbrief geschrieben.</span>'}</p>`}
    <h2>Zuletzt in den Neuigkeiten</h2>
    ${news === null ? '<p class="muted">…</p>' : news.length ? `<ul class="newsboard">${news.map((n) => `<li><time>${when(n.created_at)}</time> ${esc(n.body)}</li>`).join('')}</ul>` : '<p class="muted">Noch nichts Erwähnenswertes.</p>'}`;
  return layout(s, main, [
    { title: 'Steckbrief', items: [
      ...(me ? [] : [{ act: `write:${w.userId}`, label: 'Brief schreiben', key: 'b', primary: true }]),
      { act: 'go:warriors', label: 'Zur Kriegerliste', key: 'l' },
    ] },
    ...(me ? [] : [{ title: 'Ärger?', items: [
      ui.blocked.has(w.userId)
        ? { act: `unblock:${w.userId}`, label: 'Nicht mehr blockieren', key: 'k' }
        : { act: `block:${w.userId}`, label: 'Blockieren', key: 'k', hint: 'keine Briefe, Gespräche ausgeblendet' },
      { act: `rep:steckbrief:${w.userId}`, label: ui.repConfirm === `steckbrief:${w.userId}` ? 'Wirklich melden?' : 'Steckbrief melden', key: 'm' },
      { act: `rep:name:${w.userId}`, label: ui.repConfirm === `name:${w.userId}` ? 'Wirklich melden?' : 'Namen melden', key: 'n' },
    ] }]),
    { title: 'Zurück', items: [back] },
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
    else if (c === m.start) mark = '<span title="Ausgang">⌂</span>';
    else if (c === m.boss && (visited || run.bossDown)) mark = '<span class="boss" title="Halle des Hüters">♜</span>';
    else if (done) mark = '<span class="done">·</span>';
    cells.push(`<div class="fc${walls}${here ? ' here' : ''}">${mark}</div>`);
  }
  return `<div class="feste-map" role="img" aria-label="Karte der Feste">${cells.join('')}</div>`;
}

function festePad(s: GameState): string {
  const ex = exits(s);
  const btn = (d: Dir, arrow: string) => `<button type="button" class="pad-btn pad-${d}" data-act="feste:${d}" data-hotkey="${d}" ${ex.includes(d) ? '' : 'disabled'} aria-label="${DIR_NAME[d]}" title="${DIR_NAME[d]} (${d.toUpperCase()})">${arrow}<small>${d.toUpperCase()}</small></button>`;
  return `<div class="feste-pad">${btn('n', '▲')}${btn('w', '◀')}${btn('o', '▶')}${btn('s', '▼')}</div>
    <p class="muted pad-hint">Am Computer: Pfeiltasten oder N, O, S, W</p>`;
}

function festeTreasureNews(s: GameState): void {
  const p = s.player;
  const post = (first: boolean) => { announce(s, treasureNews(p, first)); saveGame(s); scheduleSync(500); };
  if (!cloud.enabled) { post(false); return; }
  cloud.newsAbout('versunkenen Feste besiegt', 20).then((rows) => {
    const today = todayKey();
    post(!rows.some((r) => todayKey(new Date(r.created_at)) === today));
  }, () => post(false));
}

function festeScreen(s: GameState): string {
  const p = s.player;
  const run = s.feste && s.feste.day === todayKey() ? s.feste : null;
  const entranceArt = festeArt('eingang');
  const treasureArt = festeArt('schatzkammer');
  if (!run || run.over) {
    const why = canEnterFeste(s, todayKey());
    const summary = run && run.over
      ? `<section class="event-box log">${run.log.map((l) => `<p class="${l.k}">${esc(l.t)}</p>`).join('')}
          ${run.gold || run.gems ? `<p class="gold">Ausbeute heute: ${run.gold} Gold${run.gems ? `, ${run.gems} Edelstein${run.gems === 1 ? '' : 'e'}` : ''}${run.heirloom ? `, ${esc(heirloom(run.heirloom)?.name ?? '')}` : ''}.</p>` : ''}</section>`
      : '';
    const art = run?.over === 'treasure' && treasureArt ? treasureArt : entranceArt;
    const main = `<h1>${FESTE_NAME}</h1>
      ${art ? `<figure class="title-art feste-art"><img src="${art}" alt="${run?.over === 'treasure' ? 'Die Schatzkammer der Wyrmjäger' : 'Die versunkene Feste im Moor'}"></figure>` : ''}
      ${summary || `<p class="lead">${FESTE_TEXT.entrance}</p>`}
      ${flashHtml()}
      ${why === 'today' && !summary ? `<p class="muted">${FESTE_TEXT.closedToday}</p>` : ''}
      ${why === 'level' ? `<p class="warn-box">Ab Stufe ${FESTE_MIN_LEVEL} traust du dich da hinein.</p>` : ''}
      ${why === 'tired' ? `<p class="warn-box">Der Weg hinein kostet ${FESTE_COST} Waldkämpfe. So viel Kraft hast du heute nicht mehr.</p>` : ''}
      <p class="muted">Einmal am Tag. Licht für ${festeLight(p)} Schritte. Schriftrollen gelesen: ${p.festeScrolls ?? 0} von ${SCROLLS.length}. Erbstücke: ${p.heirlooms?.length ?? 0} von ${HEIRLOOMS.length}.</p>`;
    return layout(s, main, [
      { title: 'Die Feste', items: [
        { act: 'festeEnter', label: 'Die Feste betreten', key: 'b', hint: why === 'today' ? 'morgen wieder' : `${FESTE_COST} Waldkämpfe`, disabled: why !== 'ok', primary: why === 'ok' },
        { act: 'go:heirlooms', label: 'Erbstücke und Schriftrollen', key: 'e' },
      ] },
      { title: 'Zurück', items: [{ act: 'go:forest', label: 'Zurück in den Wald', key: 'w' }, back] },
    ]);
  }
  const lightCls = run.light <= 10 ? 'bad' : run.light <= 20 ? 'warn' : '';
  const main = `<h1>${FESTE_NAME}</h1>
    <div class="feste-wrap">
      <div>${festeMap(s)}</div>
      <div class="feste-side">
        <p class="feste-stats"><span class="${lightCls}">🔥 Licht: ${run.light} Schritte</span><br>Lebenspunkte: ${p.hp} / ${maxHp(p)}${run.gold ? `<br>Gefunden: ${run.gold} Gold${run.gems ? `, ${run.gems} Edelsteine` : ''}` : ''}</p>
        ${festePad(s)}
      </div>
    </div>
    ${run.log.length ? `<section class="event-box log">${run.log.map((l) => `<p class="${l.k}">${esc(l.t)}</p>`).join('')}</section>` : ''}
    ${flashHtml()}`;
  return layout(s, main, [
    { title: 'Raus hier', items: [{ act: 'festeLeave', label: 'Die Feste verlassen', key: 'v', hint: 'für heute', primary: false }] },
  ], 'feste-shell');
}

function heirloomsScreen(s: GameState): string {
  const p = s.player;
  const read = p.festeScrolls ?? 0;
  const main = `<h1>Erbstücke der Wyrmjäger</h1>
    <p class="lead">Was die Wyrmjäger in der Feste zurückgelassen haben. Jedes Erbstück bleibt dir für immer, auch nach dem Drachen.${(p.heirlooms?.length ?? 0) === HEIRLOOMS.length ? ' Du hast sie alle: Du bist der Erbe der Wyrmjäger.' : ''}</p>
    <ul class="potions heirlooms">${HEIRLOOMS.map((h) => {
      const own = p.heirlooms?.includes(h.id);
      const img = festeArt(`erbstueck-${h.id}`);
      return `<li class="${own ? 'own' : 'missing'}">${img && own ? `<img src="${img}" alt="" class="heir-img">` : `<span class="heir-img empty">${own ? '✦' : '?'}</span>`}
        <strong>${own ? h.name : 'Noch nicht gefunden'}</strong><br><span class="gold">${own ? h.bonus : ''}</span>${own ? `<br><small class="muted">${h.blurb}</small>` : ''}</li>`;
    }).join('')}</ul>
    <h2>Die Schriftrollen (${read} von ${SCROLLS.length})</h2>
    ${read ? SCROLLS.slice(0, read).map((t) => `<p class="scroll">„${esc(t)}“</p>`).join('') : '<p class="muted">Du hast noch keine Schriftrolle gefunden. Sie liegen in den Gängen der Feste.</p>'}`;
  return layout(s, main, [{ title: 'Zurück', items: [{ act: 'go:feste', label: 'Zur Feste', key: 'f' }, back] }]);
}

function quirinScreen(s: GameState): string {
  const p = s.player;
  const choice = p.pendingChoice === 'spec'
    ? `<section class="good-box"><h2>Was hast du als Kind gelernt?</h2><p>Wähle deine neue Fähigkeit. Deine Fähigkeitspunkte bleiben dir.</p>${specChoices(p.specialty, 'newspec')}</section>`
    : p.pendingChoice === 'race'
      ? `<section class="good-box"><h2>Was wirst du?</h2><p>Wähle deine neue Gestalt.</p>${raceChoices(p.race, p.specialty, p.gender, 'newrace')}</section>`
      : '';
  const main = `<h1>Quirins Tränke</h1>
    <p class="lead">Im schiefen Häuschen hinter dem Brunnen blubbert es aus hundert Kolben. Der Alchemist <span class="npc">Quirin</span> schiebt die Brille hoch. „Edelsteine gegen Tränke, so läuft das hier. Zwei pro Fläschchen. Nebenwirkungen auf eigene Gefahr.“</p>
    ${flashHtml()}
    ${choice}
    <ul class="potions">${POTIONS.map((pt) => `<li><strong>${pt.name}</strong> <span class="gem">${pt.gems} Edelsteine</span><br><span class="gold">${pt.effect}</span><br><small class="muted">${pt.blurb}</small></li>`).join('')}</ul>
    <p class="muted">Du hast ${p.gems} Edelstein${p.gems === 1 ? '' : 'e'}${p.potionHp ? ` · durch Lebenstränke schon +${p.potionHp} Lebenspunkte` : ''}.</p>`;
  return layout(s, main, [
    { title: 'Trinken', items: POTIONS.map((pt, i) => ({
      act: `potion:${pt.id}`, label: pt.name, key: String(i + 1), hint: `${pt.gems} Edelsteine`,
      disabled: p.gems < pt.gems || (!!p.pendingChoice && (pt.id === 'vergessen' || pt.id === 'verwandlung')),
    })) },
    { title: 'Zurück', items: [back] },
  ]);
}

function seerScreen(s: GameState): string {
  const p = s.player;
  const cost = seerCost(p.level);
  const main = p.seerPaid
    ? `<h1 class="shadow-title">In tiefer Trance</h1>
      <p class="lead">Odas Kristallkugel beschlägt. Der Duft von Räucherwerk wird schwer, und plötzlich hörst du die Stimmen vom Nebelfluss, als stündest du am Ufer.</p>
      ${flashHtml()}
      ${squareHtml('schattenreich')}`
    : `<h1>Das Zelt der Seherin</h1>
      <p class="lead">Du duckst dich in ein buntes Zelt am Dorfrand. Hinter einer ziemlich fleckigen Kristallkugel sitzt die alte <span class="npc">Oda</span>. Man sagt, sie kann mit den Toten sprechen, und erstaunlich oft stimmt das sogar.</p>
      <p>„Die Toten reden nur mit denen, die zahlen“, krächzt sie. „Für dich, ${p.gender === 'f' ? 'meine Hübsche' : 'mein Hübscher'}, nur lächerliche <span class="gold">${cost} Gold</span>. Für den ganzen Tag.“</p>
      ${flashHtml()}`;
  return layout(s, main, [
    { title: 'Seherin', items: p.seerPaid ? [] : [{ act: 'seer', label: 'Bezahlen und mit den Toten reden', key: 'b', hint: `${cost} Gold`, disabled: p.gold < cost, primary: true }] },
    { title: 'Zurück', items: [{ ...back, label: p.seerPaid ? 'Aus der Trance erwachen' : back.label }] },
  ]);
}

function felsenScreen(s: GameState): string {
  const p = s.player;
  const fame = (ui.fame ?? []).filter((f) => f.dragonKills > 0).slice(0, 12);
  const names = fame.length ? `<p class="carved">${fame.map((f) => `${esc(f.name)} <span class="muted">${f.dragonKills}×</span>`).join(' · ')}</p>` : '';
  const main = p.dragonKills > 0
    ? `<h1>Der Wyrmstein</h1>
      <p class="lead">Hinter dem Denkmal ragt ein gewaltiger, moosbewachsener Felsen auf. Wer den Brackenwyrm einmal bezwungen hat, ritzt hier seinen Namen ein, und abends treffen sich die Drachentöter auf den flachen Steinen davor.</p>
      ${names ? `<h2>In den Stein geritzt</h2>${names}` : ''}
      ${flashHtml()}
      ${squareHtml('felsen')}`
    : `<h1>Ein großer Felsen</h1>
      <p class="lead">Hinter dem Denkmal ragt ein gewaltiger, moosbewachsener Felsen auf. Ein paar Gestalten sitzen davor und reden leise. Als du näherkommst, verstummen sie und schauen durch dich hindurch, als wärst du Nebel.</p>
      <p>Ein alter Mann am Wegrand murmelt: „Der Wyrmstein ist nur für die, die den Drachen gesehen haben. Und überlebt.“</p>
      ${names ? `<h2>In den Stein geritzt</h2>${names}` : ''}
      ${flashHtml()}`;
  return layout(s, main, [{ title: 'Zurück', items: [back] }]);
}

function gartenScreen(s: GameState): string {
  const p = s.player;
  const main = `<h1>Der Rosengarten</h1>
    <p class="lead">Hinter Mirlas Kräuterhütte führt ein schmaler Weg in einen verwunschenen Garten. Rosen ranken über alte Bögen, Bienen summen, und auf den Bänken sitzen Paare, die so tun, als würden sie nur die Blumen ansehen.</p>
    ${p.marriedTo ? `<p class="muted">Du denkst an ${esc(PARTNERS[p.marriedTo].name)} und pflückst heimlich eine Rose.</p>` : ''}
    ${flashHtml()}
    ${squareHtml('garten')}`;
  return layout(s, main, [{ title: 'Zurück', items: [back] }]);
}

function ambrosScreen(s: GameState): string {
  const p = s.player;
  const g = ui.ambros;
  const left = AMBROS_GAMES_PER_DAY - (p.ambrosGames ?? 0);
  const last = g ? g.hints.length - 1 : -1;
  const main = `<h1>Der alte Ambros</h1>
    <p class="lead">Auf der Bank am Brunnen sitzt der alte Ambros und schnitzt an einem Stock. „Ich denk mir eine Zahl zwischen 1 und 100“, sagt er. „Du hast ${AMBROS_TRIES} Versuche. Errätst du sie, zahle ich dir deinen Einsatz doppelt. Wenn nicht, gehört er mir.“</p>
    ${flashHtml()}
    ${g ? `<div class="event-box log">${g.hints.length ? g.hints.map((h, i) => `<p class="${i === last && g.over === 'win' ? 'gold' : i === last && g.over === 'lose' ? 'bad' : 'info'}">${esc(h)}</p>`).join('') : `<p class="info">Einsatz: ${g.bet} Gold. Ambros kneift ein Auge zu. „Na los.“</p>`}</div>
      ${g.over ? '' : `<div class="row say-row"><input type="number" id="guess" min="1" max="100" inputmode="numeric" placeholder="1–100" aria-label="Deine Zahl"><button type="button" class="tbtn" data-act="guess">Raten</button></div>`}` : ''}
    <p class="muted">${left > 0 ? `Heute noch ${left} ${left === 1 ? 'Spiel' : 'Spiele'}.` : 'Für heute ist Ambros fertig mit Rechnen und döst in der Sonne.'}</p>`;
  const playing = !!g && !g.over;
  const groups: Group[] = [];
  if (!playing) groups.push({ title: 'Zahlenraten', items: ambrosBets(p.level).map((b, i) => ({
    act: `ambros:${b}`, label: `Um ${b} Gold spielen`, key: String(i + 1), disabled: left <= 0 || p.gold < b, primary: i === 0,
  })) });
  groups.push({ title: 'Zurück', items: [back] });
  return layout(s, main, groups);
}

function hauntScreen(s: GameState): string {
  const p = s.player;
  const me = cloud.userId;
  const living = (ui.warriors ?? []).filter((w) => w.alive && w.userId !== me);
  const rows = ui.warriors === null ? '<p class="muted">Du lauschst in die Welt der Lebenden …</p>'
    : !living.length ? '<p class="muted">Gerade gibt es niemanden, den du heimsuchen könntest.</p>'
    : `<ul class="warriors">${living.map((w) => `<li class="warrior">
        <span class="t-portrait">${heroPortrait(w.race, w.specialty, w.gender)}</span>
        <span class="t-info"><strong><span class="t-title">${esc(titleFor(w.dragonKills, w.gender))}</span> ${esc(w.name)}</strong>
          <small>Stufe ${w.level} · ${raceName(w.race, w.gender)}</small><small class="w-status">${statusOf(w)}</small></span>
        <button type="button" class="tbtn" data-act="haunt:${w.userId}" ${p.favor < HAUNT_FAVOR || ui.pvp.busy ? 'disabled' : ''}>Heimsuchen</button>
      </li>`).join('')}</ul>`;
  const main = `<h1 class="shadow-title">Heimsuchen</h1>
    <p class="lead">Morwen ist von deinem Eifer beeindruckt und gibt dir die Macht, einen Lebenden heimzusuchen. Gelingt es, wacht dein Opfer morgen müde auf und verliert Waldkämpfe. Je höher deine Stufe im Vergleich zu deinem Opfer, desto eher klappt es.</p>
    ${flashHtml()}
    ${ui.listErr ? `<p class="warn-box">${esc(ui.listErr)}</p>` : ''}
    <p class="muted">Deine Gunst: ${p.favor}. Jeder Versuch kostet ${HAUNT_FAVOR} Gunst, ob er gelingt oder nicht.</p>
    ${rows}`;
  return layout(s, main, [{ title: 'Schattenreich', items: [{ act: 'go:shadows', label: 'Zurück zu Morwen', key: 'm' }] }]);
}

function warriorsScreen(s: GameState): string {
  const list = ui.warriors;
  const me = cloud.userId;
  const rows = list === null ? '<p class="muted">Du schaust auf die Liste am Rathaus …</p>'
    : !list.length ? '<p class="muted">Noch niemand eingetragen.</p>'
    : `<ul class="warriors">${list.map((w) => `<li class="warrior ${w.userId === me ? 'me' : ''}">
        <span class="t-portrait">${heroPortrait(w.race, w.specialty, w.gender)}</span>
        <button type="button" class="t-info w-link" data-act="bio:${w.userId}" title="Steckbrief ansehen"><strong><span class="t-title">${esc(titleFor(w.dragonKills, w.gender))}</span> ${esc(w.name)}</strong>
          <small>Stufe ${w.level} · ${raceName(w.race, w.gender)} · ${SPECIALTIES[w.specialty].name}${w.dragonKills ? ` · Drachentöter ${w.dragonKills}×` : ''}</small>
          <small class="w-status">${statusOf(w)}</small></button>
        ${w.userId === me ? '<span class="muted">du</span>' : `<button type="button" class="tbtn" data-act="write:${w.userId}">Brief</button>`}
      </li>`).join('')}</ul>`;
  const online = list ? list.filter((w) => w.online).length : 0;
  const main = `<h1>Kriegerliste</h1>
    <p class="lead">Am Rathaus hängt eine Liste aller Helden von Moosgrund. ${list ? `${list.length} ${list.length === 1 ? 'Held' : 'Helden'}, ${online} gerade unterwegs.` : ''}</p>
    ${ui.listErr ? `<p class="warn-box">${esc(ui.listErr)}</p>` : ''}
    ${rows}`;
  return layout(s, main, [
    { title: 'Kriegerliste', items: [{ act: `bio:${me}`, label: 'Mein Steckbrief', key: 's', disabled: !list?.some((w) => w.userId === me) }, { act: 'reloadlist', label: 'Neu laden', key: 'n' }, { act: 'go:mail', label: 'Briefe', key: 'i', hint: ui.unread ? `${ui.unread} neu` : '' }] },
    { title: 'Zurück', items: [back] },
  ]);
}

function mailScreen(s: GameState): string {
  const c = ui.compose;
  if (c) {
    const main = `<h1>Brief an ${esc(c.toName)}</h1>
      ${flashHtml()}
      <label class="field">Betreff<input type="text" id="mail-subject" maxlength="60" value="${esc(c.subject)}"></label>
      <label class="field">Dein Brief<textarea id="mail-body" maxlength="1000" rows="7" placeholder="Schreib etwas …">${esc(c.body)}</textarea></label>
      <p class="muted">Ein Bote bringt den Brief sofort. Bitte freundlich bleiben, Moosgrund ist ein kleines Dorf.</p>`;
    return layout(s, main, [
      { title: 'Brief', items: [{ act: 'mailsend', label: 'Abschicken', key: 'a', primary: true }, { act: 'mailcancel', label: 'Verwerfen', key: 'v' }] },
      { title: 'Zurück', items: [back] },
    ]);
  }
  const list = ui.mail;
  const rows = list === null ? '<p class="muted">Du siehst nach, ob Post da ist …</p>'
    : !list.length ? '<p class="muted">Dein Postfach ist leer. Schreib doch jemandem aus der Kriegerliste.</p>'
    : `<ul class="mails">${list.filter((m) => !(m.from_user && ui.blocked.has(m.from_user))).map((m) => {
        const open = ui.mailOpen === m.id;
        return `<li class="mail ${m.seen ? '' : 'unread'} ${open ? 'open' : ''}">
          <button type="button" class="mail-head" data-act="mailopen:${m.id}" aria-expanded="${open}">
            <span class="mail-from">${esc(m.from_name || 'Unbekannt')}</span><span class="muted">${when(m.created_at)}</span>
            <span class="mail-subj">${esc(m.subject || '(ohne Betreff)')}</span></button>
          ${open ? `<div class="mail-body"><p>${esc(m.body).replace(/\n/g, '<br>')}</p>
            <div class="row">${m.from_user ? `<button type="button" class="tbtn" data-act="reply:${m.id}">Antworten</button>` : ''}
            <button type="button" class="tbtn" data-act="maildel:${m.id}">Wegwerfen</button>
            ${m.from_user ? `<button type="button" class="tbtn ghost" data-act="rep:brief:${m.id}">${ui.repConfirm === `brief:${m.id}` ? 'Wirklich melden?' : 'Melden'}</button>
            <button type="button" class="tbtn ghost" data-act="block:${m.from_user}">Absender blockieren</button>` : ''}</div></div>` : ''}
        </li>`;
      }).join('')}</ul>`;
  const main = `<h1>Briefe</h1>
    <p class="lead">Beim Rathaus hat jeder Held ein kleines Postfach.</p>
    ${flashHtml()}
    ${ui.listErr ? `<p class="warn-box">${esc(ui.listErr)}</p>` : ''}
    ${rows}`;
  return layout(s, main, [
    { title: 'Briefe', items: [{ act: 'go:warriors', label: 'Brief schreiben', key: 's', hint: 'aus der Kriegerliste' }, { act: 'reloadmail', label: 'Neu laden', key: 'n' }] },
    { title: 'Zurück', items: [back] },
  ]);
}

function loadWarriors(): void {
  ui.warriors = null; ui.listErr = '';
  render();
  cloud.warriors().then((r) => { ui.warriors = r; }, (e) => { ui.warriors = []; ui.listErr = e instanceof CloudError ? e.message : 'Die Liste ließ sich nicht laden.'; })
    .finally(() => { if (currentScreen() === 'warriors' || currentScreen() === 'haunt') render(); });
}

function loadMail(): void {
  ui.mail = null; ui.listErr = '';
  render();
  cloud.mailbox().then((r) => { ui.mail = r; ui.unread = r.filter((m) => !m.seen).length; }, (e) => { ui.mail = []; ui.listErr = e instanceof CloudError ? e.message : 'Die Briefe ließen sich nicht laden.'; })
    .finally(() => { if (currentScreen() === 'mail') render(); });
}

/** Schaut höchstens einmal pro Minute nach neuer Post (für den Hinweis im Dorf). */
function checkMail(): void {
  if (!cloud.signedIn || Date.now() - ui.unreadAt < 60_000) return;
  ui.unreadAt = Date.now();
  cloud.unreadMail().then((n) => {
    if (n !== ui.unread) { if (n > ui.unread) say(n === 1 ? 'Ein Bote hat dir einen Brief gebracht.' : `Boten haben dir ${n} Briefe gebracht.`, 'gold'); ui.unread = n; if (currentScreen() === 'village') render(); }
  }, () => {});
}

function settingsScreen(s: GameState): string {
  const main = `<h1>Einstellungen</h1>
    ${flashHtml()}
    <label class="toggle"><input type="checkbox" id="opt-motion" data-act="toggle:motion" ${prefs.reducedMotion ? 'checked' : ''}> Weniger Bewegung im Kampf</label>
    <h2>Ton</h2>
    <label class="slider">Musik <input type="range" min="0" max="100" step="5" data-act="vol:music" value="${Math.round(prefs.musicVol * 100)}" aria-label="Lautstärke Musik"></label>
    <label class="slider">Effekte <input type="range" min="0" max="100" step="5" data-act="vol:sfx" value="${Math.round(prefs.sfxVol * 100)}" aria-label="Lautstärke Effekte"></label>
    <label class="toggle"><input type="checkbox" data-act="toggle:muted" ${prefs.muted ? 'checked' : ''}> Ton ganz aus</label>
    <h2>Im Gasthaus umwerben</h2>
    <div class="seg" role="radiogroup" aria-label="Wen umwerben">
      ${(['frieda', 'florian'] as const).map((id) => `<button type="button" class="seg-btn ${partnerOf(s.player) === id ? 'on' : ''}" role="radio" aria-checked="${partnerOf(s.player) === id}" data-act="lover:${id}">${id === 'frieda' ? 'Wirtin Frieda' : 'Barde Florian'}</button>`).join('')}
    </div>
    ${s.player.marriedTo ? `<p class="muted">Du bist mit ${PARTNERS[s.player.marriedTo].name} verheiratet.</p>` : ''}
    ${cloud.enabled ? accountHtml() : ''}
    <h2>Spielstand auf ein anderes Gerät mitnehmen</h2>
    <p class="muted">${cloud.signedIn ? 'Mit deinem Spielerkonto geht das automatisch. Der Code hier ist nur eine Notlösung, zum Beispiel als Sicherungskopie.' : 'Ohne Spielerkonto liegt der Spielstand nur in diesem Browser. Kopiere den Code und füge ihn auf dem anderen Gerät ein.'}</p>
    <textarea id="exportcode" readonly aria-label="Spielstand-Code">${exportCode(s)}</textarea>
    <div class="row"><button type="button" class="tbtn" data-act="copycode">Code kopieren</button></div>
    <textarea id="importcode" placeholder="Code hier einfügen (beginnt mit BW1:)" aria-label="Code einfügen"></textarea>
    <div class="row"><button type="button" class="tbtn" data-act="importcode">Spielstand laden</button><span class="muted">${esc(ui.importMsg)}</span></div>`;
  return layout(s, main, [
    { title: 'Spielstand', items: [
      ...(prefs.dev ? [{ act: 'testday', label: 'Neuer Tag (Testmodus)', key: 'n', hint: 'sonst um Mitternacht' }] : []),
      { act: 'feedback', label: 'Rückmeldung geben', key: 'm' },
      { act: 'delete', label: ui.confirmDelete ? 'Wirklich löschen? Nochmal drücken.' : 'Spielstand löschen', key: 'x', hint: 'nur auf diesem Gerät' },
    ] },
    ...(cloud.signedIn ? [{ title: 'Spielerkonto', items: [
      ...(ui.isAdmin ? [{ act: 'go:wache', label: 'Die Wache', key: 'w', hint: 'Meldungen prüfen' }] : []),
      { act: 'go:blocks', label: 'Blockierte Spieler', key: 'b', hint: ui.blocked.size ? String(ui.blocked.size) : '' },
      { act: 'go:deleteAccount', label: 'Konto löschen', key: 'l', hint: 'mit allen Daten' },
    ] }] : []),
    { title: 'Rechtliches', items: [
      { act: 'legal:datenschutz', label: 'Datenschutz', key: 'p' },
      { act: 'legal:impressum', label: 'Impressum', key: 'i' },
    ] },
    { title: 'Zurück', items: [back] },
  ]);
}

function blocksScreen(s: GameState): string {
  const list = ui.blocksList;
  const main = `<h1>Blockierte Spieler</h1>
    <p class="lead">Von blockierten Spielern bekommst du keine Briefe mehr, und ihre Gespräche siehst du nicht. Sie erfahren nicht, dass du sie blockiert hast.</p>
    ${flashHtml()}
    ${list === null ? '<p class="muted">…</p>' : list.length ? `<ul class="warriors">${list.map((b) => `<li class="warrior"><span></span><span class="t-info"><strong>${esc(b.name)}</strong></span>
      <button type="button" class="tbtn" data-act="unblock:${b.blocked}">Nicht mehr blockieren</button></li>`).join('')}</ul>`
      : '<p class="muted">Du hast niemanden blockiert. Blockieren kannst du im Steckbrief eines Helden (Kriegerliste) oder bei einem Brief.</p>'}`;
  return layout(s, main, [{ title: 'Zurück', items: [{ act: 'go:settings', label: 'Einstellungen', key: 'e' }, back] }]);
}

function deleteAccountScreen(s: GameState): string {
  const main = `<h1>Konto löschen</h1>
    <p class="lead">Damit werden dein Spielerkonto und alles, was dazu auf dem Server liegt, sofort und endgültig gelöscht: Spielstand, Held in der Kriegerliste und Ruhmeshalle, deine Gespräche, Briefe an dich und deine Neuigkeiten. Das lässt sich nicht rückgängig machen.</p>
    <p>Der Spielstand auf diesem Gerät wird ebenfalls gelöscht. Wenn du ihn behalten willst, kopiere vorher den Code unter Einstellungen.</p>
    ${flashHtml()}
    <label class="field">Zum Bestätigen <strong>LÖSCHEN</strong> eintippen<input type="text" id="del-confirm" autocomplete="off" placeholder="LÖSCHEN"></label>
    ${ui.delMsg ? `<p class="warn">${esc(ui.delMsg)}</p>` : ''}
    <div class="row"><button type="button" class="btn danger" data-act="delacct">Konto endgültig löschen</button></div>`;
  return layout(s, main, [{ title: 'Zurück', items: [{ act: 'go:settings', label: 'Doch nicht', key: 'z', primary: true }] }]);
}

function loadWache(): void {
  const w = ui.wache;
  w.err = '';
  const fail = (e: unknown) => { w.err = e instanceof CloudError ? e.message : 'Das hat nicht geklappt.'; };
  if (w.tab === 'reports') { w.reports = null; cloud.modReports().then((r) => { w.reports = r; }, fail).finally(render); }
  if (w.tab === 'banned') { w.banned = null; cloud.modBanned().then((r) => { w.banned = r; }, fail).finally(render); }
  if (w.tab === 'cheats') { w.cheats = null; cloud.modCheats().then((r) => { w.cheats = r; }, fail).finally(render); }
  render();
}

const KIND_NAMES: Record<ReportKind, string> = { chat: 'Gespräch', brief: 'Brief', steckbrief: 'Steckbrief', name: 'Name' };

function wacheScreen(s: GameState): string {
  const w = ui.wache;
  let body = '';
  if (w.tab === 'reports') {
    body = w.reports === null ? '<p class="muted">…</p>' : !w.reports.length ? '<p class="muted">Keine offenen Meldungen. Ruhig in Moosgrund.</p>'
      : `<ul class="mod-list">${w.reports.map((r, i) => `<li class="mod-item">
          <div class="mod-head"><strong>${KIND_NAMES[r.kind]}</strong> von <strong>${esc(r.target_name)}</strong>
            <span class="muted">${r.reports}× gemeldet · ${when(r.first_at)}${r.hidden ? ' · ausgeblendet' : ''}${r.banned ? ' · gesperrt' : ''}</span></div>
          <blockquote>${esc(r.content).replace(/\n/g, '<br>') || '<span class="muted">(leer)</span>'}</blockquote>
          <div class="row">
            <button type="button" class="tbtn" data-act="mod:ok:${i}">${r.kind === 'brief' ? 'Erledigt' : 'Fehlalarm, zeigen'}</button>
            ${r.kind === 'brief' ? '' : `<button type="button" class="tbtn" data-act="mod:hide:${i}">Ausblenden</button>`}
            ${r.target && !r.banned ? `<button type="button" class="tbtn danger" data-act="mod:ban:${i}">Sperren</button>` : ''}
          </div></li>`).join('')}</ul>`;
  } else if (w.tab === 'banned') {
    body = w.banned === null ? '<p class="muted">…</p>' : !w.banned.length ? '<p class="muted">Niemand ist gesperrt.</p>'
      : `<ul class="warriors">${w.banned.map((b) => `<li class="warrior"><span></span><span class="t-info"><strong>${esc(b.name)}</strong><small>Stufe ${b.level} · ${b.dragon_kills} Drachenkills</small></span>
          <button type="button" class="tbtn" data-act="modban:${b.user_id}:off">Entsperren</button></li>`).join('')}</ul>`;
  } else {
    body = w.cheats === null ? '<p class="muted">…</p>' : !w.cheats.length ? '<p class="muted">Nichts Auffälliges.</p>'
      : `<p class="muted">Hier landet, was der Server an Spielwerten korrigiert hat. Einzelne Einträge können von Offline-Spielen kommen; wiederholt hohe Werte deuten auf Schummeln.</p>
        <table class="mod-table"><thead><tr><th>Wann</th><th>Held</th><th>Wert</th><th>geschickt</th><th>behalten</th><th></th></tr></thead><tbody>
        ${w.cheats.map((c) => `<tr><td>${when(c.created_at)}</td><td>${esc(c.name)}</td><td>${esc(c.field)}</td><td>${esc(c.sent)}</td><td>${esc(c.kept)}</td>
          <td>${c.banned ? 'gesperrt' : `<button type="button" class="tbtn danger" data-act="modban:${c.user_id}:on">Sperren</button>`}</td></tr>`).join('')}</tbody></table>`;
  }
  const main = `<h1>Die Wache</h1>
    <p class="lead">Hier prüfst du, was Spieler gemeldet haben. Ab drei Meldungen ist ein Beitrag schon ausgeblendet, bis du entscheidest.</p>
    ${flashHtml()}${w.err ? `<p class="warn-box">${esc(w.err)}</p>` : ''}
    ${body}`;
  return layout(s, main, [
    { title: 'Die Wache', items: [
      { act: 'wache:reports', label: 'Meldungen', key: 'm', hint: w.reports?.length ? String(w.reports.length) : '', primary: w.tab === 'reports' },
      { act: 'wache:cheats', label: 'Auffällige Spielstände', key: 'a', primary: w.tab === 'cheats' },
      { act: 'wache:banned', label: 'Gesperrte', key: 'g', primary: w.tab === 'banned' },
    ] },
    { title: 'Zurück', items: [{ act: 'go:settings', label: 'Einstellungen', key: 'e' }, back] },
  ]);
}

function shadowsScreen(s: GameState): string {
  const now = new Date();
  const mid = new Date(now);
  mid.setHours(24, 0, 0, 0);
  const mins = Math.max(0, Math.round((mid.getTime() - now.getTime()) / 60000));
  const p = s.player;
  const cost = soulRestoreCost(p);
  const canBack = p.favor >= RESURRECT_FAVOR;
  const main = `<h1 class="shadow-title">Das Schattenreich</h1>
    ${s.news.length ? `<section class="news"><h2>Neuigkeiten</h2>${s.news.slice(-3).map((n) => `<p>${esc(n)}</p>`).join('')}</section>` : ''}
    <p class="lead">Grauer Nebel, ein stiller Fluss. <span class="npc">Morwen</span> stakt ihr Boot heran. „Du schon wieder“, sagt sie. „Setz dich. Bei Sonnenaufgang bringe ich dich zurück.“</p>
    <p>Am Ufer treiben verirrte Seelen. „Wenn du mir ein paar davon vom Hals schaffst“, sagt Morwen, „fahre ich dich vielleicht früher zurück.“
      ${canBack ? '<span class="place">Du hast genug Gunst für die Rückkehr.</span>' : `Dafür brauchst du <span class="gem">${RESURRECT_FAVOR} Gunst</span>, du hast ${p.favor}.`}</p>
    <div class="progress">${bar(p.favor, RESURRECT_FAVOR, 'favor')}</div>
    <p class="muted">Neuer Tag in ${Math.floor(mins / 60)} Std. ${mins % 60} Min. Gold im Kontor ist sicher.</p>
    ${flashHtml()}
    ${cloud.enabled ? squareHtml('schattenreich') : ''}`;
  return layout(s, main, [{ title: 'Am Nebelfluss', items: [
    { act: 'grave', label: 'Gegen Seelen kämpfen', key: 'k', hint: `${p.graveFights} Schattenkämpfe`, disabled: p.graveFights <= 0 || p.soul <= 0, primary: !canBack },
    { act: 'resurrect', label: 'Morwen um Rückkehr bitten', key: 'r', hint: `${p.favor} / ${RESURRECT_FAVOR} Gunst`, disabled: !canBack, primary: canBack },
    { act: 'soul', label: 'Seelenkraft stärken', key: 's', hint: p.soul >= maxSoul(p) ? 'voll' : `${cost} Gunst`, disabled: p.soul >= maxSoul(p) || p.favor < cost },
    ...(cloud.enabled ? [{ act: 'go:haunt', label: 'Einen Lebenden heimsuchen', key: 'h', hint: !cloud.signedIn ? 'nur mit Spielerkonto' : `${HAUNT_FAVOR} Gunst`, disabled: !cloud.signedIn || p.favor < HAUNT_FAVOR }] : []),
  ] }, { title: 'Sonstiges', items: [
    ...(prefs.dev ? [{ act: 'testday', label: 'Neuer Tag (Testmodus)', key: 'n' }] : []),
    { act: 'feedback', label: 'Rückmeldung geben', key: 'm' },
    { act: 'go:settings', label: 'Einstellungen', key: 'e' },
  ] }]);
}

const DK_POINTS: { id: DragonPoint; name: string; text: string }[] = [
  { id: 'ff', name: '+1 Waldkampf', text: 'Jeden Tag einen Waldkampf mehr. Wer öfter in den Wald geht, ist schneller wieder beim Drachen.' },
  { id: 'hp', name: '+5 Lebenspunkte', text: 'Dauerhaft mehr Lebenskraft, auf jeder Stufe.' },
  { id: 'atk', name: '+1 Angriff', text: 'Deine Schläge sitzen fester. Für immer.' },
  { id: 'def', name: '+1 Verteidigung', text: 'Du weißt jetzt, wie man einem Wyrmzahn ausweicht.' },
];

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
    <h1>Drachentöter!</h1>
    <p class="lead">Ganz Moosgrund läuft zusammen. Frieda schenkt aus, Florian dichtet, Mirla weint ein bisschen. Der Dorfrat ernennt dich feierlich: Von heute an heißt du <strong class="gold">${esc(title)} ${esc(p.name)}</strong>.</p>
    <p>Doch die alten Geschichten sagen: Ein Wyrm stirbt nie ganz. Du wirst wieder bei Stufe 1 anfangen, ohne Ausrüstung, ohne Gold im Kontor. Etwas von diesem Tag bleibt dir aber für immer.</p></div></div>
    ${s.flawlessDragon ? `<p class="good-box">Ohne einen einzigen Kratzer! Dafür gibt es ${FLAWLESS_GOLD} Gold und einen Edelstein extra.</p>` : ''}
    <h2>1. Dein Drachenpunkt</h2>
    <div class="choices dk-points" role="radiogroup" aria-label="Drachenpunkt">
      ${DK_POINTS.map((d) => `<button type="button" class="choice ${ui.dkPoint === d.id ? 'on' : ''}" role="radio" aria-checked="${ui.dkPoint === d.id}" data-act="dkpoint:${d.id}">
        <strong>${d.name}</strong><span>${d.text}</span>${counts(d.id) ? `<small>Bisher ${counts(d.id)}× gewählt</small>` : ''}</button>`).join('')}
    </div>
    <h2>2. Wer wirst du in deinem neuen Leben?</h2>
    <p class="muted">Wie im Original wählst du Rasse und Fähigkeit neu. Du kannst auch alles so lassen.</p>
    ${raceChoices(race, spec, p.gender, 'dkrace')}
    <h2>3. Was hast du als Kind gemacht?</h2>
    ${specChoices(spec, 'dkspec')}
    <h2>Das nimmst du mit</h2>
    <ul class="plain">
      <li>${gold} Gold für den Neuanfang${gems ? ` und ${gems} Edelstein${gems > 1 ? 'e' : ''} dazu` : ''}</li>
      <li>Deine ${p.gems} Edelsteine, Morwens Gunst, dein Bestiarium und deine Ruhmeshalle</li>
      <li>${p.dragonPoints.length ? `Deine bisherigen Drachenpunkte (${[p.bonusAtk ? `+${p.bonusAtk} Angriff` : '', p.bonusDef ? `+${p.bonusDef} Verteidigung` : '', p.baseMaxHp ? `+${p.baseMaxHp} Lebenspunkte` : '', p.bonusFights ? `+${p.bonusFights} Waldkämpfe` : ''].filter(Boolean).join(', ')}) und den neuen dazu` : 'Deinen ersten Drachenpunkt'}</li>
      <li>Ein frischer Tag mit ${forestFightsPerDay({ ...p, race }) + (ui.dkPoint === 'ff' ? 1 : 0)} Waldkämpfen</li>
    </ul>
    ${!ui.dkPoint ? '<p class="muted">Wähle zuerst deinen Drachenpunkt.</p>' : ''}`;
  return layout(s, main, [{ title: 'Neuanfang', items: [
    { act: 'rebirth', label: 'Neues Leben beginnen', key: 'n', disabled: !ui.dkPoint, primary: true, hint: ui.dkPoint ? `${DK_POINTS.find((d) => d.id === ui.dkPoint)!.name} · ${raceName(race, p.gender)} · ${SPECIALTIES[spec].name}` : 'erst Drachenpunkt wählen' },
  ] }]);
}

// ---------- Steuerung ----------

function currentScreen(): Screen {
  if (ui.screen === 'impressum' || ui.screen === 'datenschutz') return ui.screen;
  if (!state) return ui.screen === 'create' || ui.screen === 'login' ? ui.screen : 'title';
  if (ui.screen === 'title' || ui.screen === 'create' || ui.screen === 'login') return ui.screen;
  if (state.pendingDragonBonus && !state.fight) return 'dragonBonus';
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
  const views: Record<Screen, () => string> = {
    title: titleScreen, create: createScreen, login: loginScreen,
    village: () => villageScreen(s!), forest: () => forestScreen(s!), fight: () => fightScreen(s!),
    training: () => trainingScreen(s!), healer: () => healerScreen(s!), smith: () => smithScreen(s!),
    bank: () => bankScreen(s!), inn: () => innScreen(s!), bestiary: () => bestiaryScreen(s!), fame: () => fameScreen(s!), syncConflict: () => syncConflictScreen(s!), fields: () => fieldsScreen(s!), innGuests: () => innGuestsScreen(s!), news: () => newsScreen(s!), chronicle: () => chronicleScreen(s!), feedback: () => feedbackScreen(s!),
    settings: () => settingsScreen(s!), shadows: () => shadowsScreen(s!), dragonBonus: () => dragonBonusScreen(s!), flirt: () => flirtScreen(s!), stable: () => stableScreen(s!), warriors: () => warriorsScreen(s!), mail: () => mailScreen(s!), haunt: () => hauntScreen(s!), bio: () => bioScreen(s!), ambros: () => ambrosScreen(s!), quirin: () => quirinScreen(s!), feste: () => festeScreen(s!), heirlooms: () => heirloomsScreen(s!), seer: () => seerScreen(s!), felsen: () => felsenScreen(s!), garten: () => gartenScreen(s!),
    impressum: () => legalScreen('impressum'), datenschutz: () => legalScreen('datenschutz'), wache: () => wacheScreen(s!), blocks: () => blocksScreen(s!), deleteAccount: () => deleteAccountScreen(s!),
  };
  root.innerHTML = views[scr]();
  sound.music(trackFor(scr));
  soundCues();
  if (cloud.signedIn && !safetyLoaded) loadSafety();
  if (scr === 'village') { loadSquare('dorfplatz'); checkMail(); loadStatue(); }
  if (scr === 'inn') loadSquare('gasthaus');
  if (scr === 'shadows') loadSquare('schattenreich');
  if (scr === 'seer' && s?.player.seerPaid) loadSquare('schattenreich');
  if (scr === 'felsen' && s && s.player.dragonKills > 0) loadSquare('felsen');
  if (scr === 'garten') loadSquare('garten');
  // Der neueste Kampftext steht unten, also dorthin scrollen.
  const fl = root.querySelector<HTMLElement>('.battle .fight-log');
  if (fl) fl.scrollTop = fl.scrollHeight;
}

/** Welche Musik zu welchem Ort gehört. */
/** Sobald es ein eigenes Musikstück für die Feste gibt (public/audio/music/musik-feste.mp3), auf true setzen. */
const FESTE_MUSIC = false;

function trackFor(scr: Screen): TrackId {
  const s = state;
  if (scr === 'title' || scr === 'create' || scr === 'login' || !s) return 'titel';
  if (scr === 'fight' && s.fight && s.fight.kind !== 'feste') return s.fight.kind === 'dragon' ? 'drache' : s.fight.kind === 'grave' ? 'schattenreich' : 'kampf';
  if (scr === 'fight' && s.fight?.monsterId === 'hueter') return 'kampf';
  if (!s.player.alive || scr === 'shadows' || scr === 'haunt' || (scr === 'seer' && s.player.seerPaid)) return 'schattenreich';
  if (scr === 'feste' || scr === 'heirlooms' || (scr === 'fight' && s.fight?.kind === 'feste')) return FESTE_MUSIC ? 'feste' : 'schattenreich';
  if (scr === 'forest') return 'wald';
  if (scr === 'inn' || scr === 'flirt' || scr === 'innGuests') return 'gasthaus';
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
      return 'Zwei Spielstände gefunden.';
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
    return d === 'none' && !changed ? 'Alles aktuell.' : d === 'pull' ? 'Online-Stand geladen.' : 'Online gesichert.';
  } catch (e) {
    return e instanceof CloudError ? e.message : 'Abgleich fehlgeschlagen.';
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
  switch (cmd) {
    case 'menu': ui.menuOpen = !ui.menuOpen; render(); return;
    case 'skills': ui.skillMenu = !ui.skillMenu; render(); return;
    case 'reloadlist': loadWarriors(); return;
    case 'festeEnter': {
      if (!s) return;
      if (!enterFeste(s, todayKey())) { say('Heute kommst du nicht hinein.', 'warn'); render(); return; }
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
      cloud.report(kind, byId ? Number(b) : 0, byId ? null : b).then((m) => say(m, 'good'), (e) => say(e instanceof CloudError ? e.message : 'Melden hat nicht geklappt.', 'warn')).finally(render);
      return;
    }
    case 'block': {
      if (!a || a === cloud.userId) return;
      cloud.block(a).then(() => {
        ui.blocked.add(a);
        const name = ui.warriors?.find((w) => w.userId === a)?.name ?? ui.mail?.find((m) => m.from_user === a)?.from_name ?? 'Unbekannt';
        ui.blocksList = [...(ui.blocksList ?? []).filter((x) => x.blocked !== a), { blocked: a, name }];
        ui.mailOpen = null;
        say('Blockiert. Von diesem Helden hörst du nichts mehr.', 'good');
      }, (e) => say(e instanceof CloudError ? e.message : 'Blockieren hat nicht geklappt.', 'warn')).finally(render);
      return;
    }
    case 'unblock': {
      cloud.unblock(a).then(() => {
        ui.blocked.delete(a);
        ui.blocksList = (ui.blocksList ?? []).filter((x) => x.blocked !== a);
        say('Nicht mehr blockiert.', 'good');
      }, (e) => say(e instanceof CloudError ? e.message : 'Das hat nicht geklappt.', 'warn')).finally(render);
      return;
    }
    case 'wache': ui.wache.tab = a as 'reports' | 'banned' | 'cheats'; ui.flash = []; loadWache(); return;
    case 'mod': {
      const r = ui.wache.reports?.[Number(b)];
      if (!r) return;
      cloud.modDecide(r.kind, r.ref_id, r.target, a as 'ok' | 'hide' | 'ban').then(() => {
        say(a === 'ban' ? `${r.target_name} ist gesperrt.` : a === 'hide' ? 'Ausgeblendet.' : 'Erledigt.', 'good');
        loadWache();
      }, (e) => { say(e instanceof CloudError ? e.message : 'Das hat nicht geklappt.', 'warn'); render(); });
      return;
    }
    case 'modban': {
      cloud.modBan(a, b === 'on').then(() => { say(b === 'on' ? 'Gesperrt.' : 'Entsperrt.', 'good'); loadWache(); },
        (e) => { say(e instanceof CloudError ? e.message : 'Das hat nicht geklappt.', 'warn'); render(); });
      return;
    }
    case 'delacct': {
      const typed = ((document.getElementById('del-confirm') as HTMLInputElement | null)?.value ?? '').trim().toUpperCase();
      if (typed !== 'LÖSCHEN' && typed !== 'LOESCHEN') { ui.delMsg = 'Bitte zum Bestätigen LÖSCHEN eintippen.'; render(); return; }
      ui.delMsg = '';
      cloud.deleteAccount().then(() => {
        resetSafety(); prefs.lastSyncedAt = 0; savePrefs(prefs);
        deleteGame(); state = null;
        go('title'); say('Dein Konto und alle Daten dazu sind gelöscht. Mach’s gut, und danke fürs Spielen.', 'good'); render();
      }, (e) => { ui.delMsg = e instanceof CloudError ? e.message : 'Das Löschen hat nicht geklappt.'; render(); });
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
      say('Dein Steckbrief hängt jetzt am Rathaus.', 'good'); render();
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
      if (!(n >= 1 && n <= 100)) { say('Eine Zahl von 1 bis 100, bitte.', 'warn'); render(); return; }
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
      cloud.push(st).then(() => cloud.haunt(a)).then((res) => {
        ui.flash = [applyHaunt(st, res)];
        saveGame(st); scheduleSync(500);
      }, (e) => { say(e instanceof CloudError ? e.message : 'Das Spuken hat nicht geklappt.', 'warn'); })
        .finally(() => { ui.pvp.busy = false; render(); });
      return;
    }
    case 'reloadmail': loadMail(); return;
    case 'write': {
      const w = ui.warriors?.find((x) => x.userId === a);
      ui.compose = { to: a, toName: w ? `${titleFor(w.dragonKills, w.gender)} ${w.name}` : 'einen Helden', subject: '', body: '' };
      go('mail'); return;
    }
    case 'reply': {
      const m = ui.mail?.find((x) => x.id === Number(a));
      if (!m || !m.from_user) return;
      ui.compose = { to: m.from_user, toName: m.from_name, subject: m.subject.startsWith('Re: ') ? m.subject : `Re: ${m.subject}`.slice(0, 60), body: '' };
      go('mail'); return;
    }
    case 'mailcancel': ui.compose = null; go('mail'); loadMail(); return;
    case 'mailsend': {
      const c = ui.compose;
      if (!c) return;
      c.subject = (document.getElementById('mail-subject') as HTMLInputElement | null)?.value ?? c.subject;
      c.body = (document.getElementById('mail-body') as HTMLTextAreaElement | null)?.value ?? c.body;
      if (!c.body.trim()) { say('Ein leerer Brief? Der Bote schaut dich verwirrt an.', 'warn'); render(); return; }
      cloud.sendMail(c.to, c.subject.trim(), c.body.trim()).then(() => {
        ui.compose = null; go('mail'); say(`Der Bote ist mit deinem Brief an ${c.toName} unterwegs.`, 'good'); loadMail();
      }, (e) => { say(e instanceof CloudError ? e.message : 'Der Brief ließ sich nicht verschicken.', 'warn'); render(); });
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
      if (!name) { say('Ohne Namen lässt dich der Torwächter nicht ins Dorf.', 'warn'); ui.createName = ''; render(); return; }
      if (!isClean(name)) { say('Der Torwächter runzelt die Stirn. „So einen Namen lass ich nicht ins Dorf.“', 'warn'); ui.createName = name; render(); return; }
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
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { done('Bitte eine gültige E-Mail-Adresse eingeben.'); return; }
        if (pass.length < 6) { done('Das Passwort braucht mindestens 6 Zeichen.'); return; }
        done(a === 'up' ? 'Lege Konto an …' : 'Melde an …');
        (a === 'up' ? cloud.signUp(email, pass) : cloud.signIn(email, pass)).then(async () => {
          prefs.lastSyncedAt = 0; savePrefs(prefs);
          const m = await syncNow();
          if (ui.screen === 'login') {
            if (state) { const newDay = checkRealDay(state); saveGame(state, !newDay); go('village'); return; }
            done('Angemeldet. Für dieses Konto gibt es noch keinen Spielstand. Beginne ein neues Spiel, es wird dann automatisch gesichert.');
            return;
          }
          done(m || 'Angemeldet.');
        }, (e) => done(e instanceof CloudError ? e.message : 'Das hat nicht geklappt.'));
      } else if (a === 'sync') {
        done('Gleiche ab …');
        syncNow().then(done);
      } else if (a === 'out') {
        cloud.signOut(); prefs.lastSyncedAt = 0; savePrefs(prefs); resetSafety(); done('Abgemeldet. Der Spielstand bleibt auf diesem Gerät.');
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
      if (s.player.gems < 1) { say('Frieda will einen Edelstein sehen.', 'warn'); render(); return; }
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
          pv.error = e instanceof CloudError ? e.message : 'Der Angriff ist fehlgeschlagen.';
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
      cloud.postComment(text, section).then(() => { ui.sayText = ''; ui.squares[section].error = ''; loadSquare(section, true); },
        (e) => { ui.squares[section].error = e instanceof CloudError ? e.message : 'Das hat nicht geklappt.'; render(); });
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
          s.fight.log.push({ t: s.fight.kind === 'grave' ? 'Du hältst inne, deine Seele flackert. Drück nochmal „Kämpfen bis zum Ende“, um weiterzukämpfen, oder flieh. Verlierst du, ist der Tag am Nebelfluss vorbei.' : 'Du hältst inne, du bist schwer angeschlagen. Drück nochmal „Kämpfen bis zum Ende“, um trotzdem weiterzukämpfen, oder flieh.', k: 'warn', r: s.fight.round });
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
        const url = a === 'wa' ? `https://wa.me/?text=${encodeURIComponent(msg)}` : `mailto:?subject=${encodeURIComponent('Brackenwyrm-Rückmeldung')}&body=${encodeURIComponent(msg)}`;
        const w = window.open(url, '_blank', 'noopener');
        done(w || a === 'mail' ? 'Danke! Falls sich nichts geöffnet hat, nimm „Text kopieren“ und schick ihn selbst.' : 'Das Fenster wurde blockiert. Nimm „Text kopieren“ und schick den Text selbst.');
      } else if (a === 'share') {
        navigator.share({ title: 'Brackenwyrm-Rückmeldung', text: msg }).then(() => done('Danke für deine Rückmeldung!'), () => done(''));
      } else {
        try {
          navigator.clipboard.writeText(msg).then(() => done('Kopiert. Jetzt einfach in WhatsApp oder eine E-Mail einfügen.'), () => done('Kopieren ging nicht. Öffne unten die Vorschau und kopiere den Text von Hand.'));
        } catch {
          done('Kopieren ging nicht. Öffne unten die Vorschau und kopiere den Text von Hand.');
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
      say(a === 'dep' ? bankDeposit(s, v) : bankWithdraw(s, v), 'gold');
      commit();
      return;
    }
    case 'event': ui.flash = resolveEvent(s, a); commit(); return;
    case 'talk': say(talkToFrieda(s), 'info'); commit(); return;
    case 'inn': say(a === 'beer' ? drinkHarzbier(s) : requestSong(s), 'good'); commit(); return;
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
      if (res) say(`Von heute an: ${res.title} ${s.player.name}.`, 'good');
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
      ui.flash = [{ t: 'Testmodus: Ein neuer Tag beginnt.', k: 'info' }];
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
        navigator.clipboard.writeText(ta.value).then(() => done('Code kopiert.'), () => done('Bitte den Code markieren und selbst kopieren.'));
      } catch {
        done('Bitte den Code markieren und selbst kopieren.');
      }
      return;
    }
    case 'importcode': {
      const v = (document.getElementById('importcode') as HTMLTextAreaElement | null)?.value ?? '';
      const loaded = importCode(v);
      if (!loaded) { ui.importMsg = 'Dieser Code passt nicht. Er beginnt mit BW1:'; render(); return; }
      state = loaded;
      checkRealDay(state);
      saveGame(state);
      ui.importMsg = '';
      say(`Spielstand von ${loaded.player.name} geladen.`, 'good');
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

function checkDayTick(): void {
  if (!state || state.fight) return;
  if (checkRealDay(state)) {
    saveGame(state);
    say('Die Sonne geht auf. Ein neuer Tag in Moosgrund!', 'good');
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
