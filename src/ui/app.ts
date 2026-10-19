// Die Oberfläche im Aufbau von damals: Navigation links, Geschehen in der Mitte,
// Charakterwerte rechts. Gegner erscheinen als illustrierte Karten.

import { eventById } from '../content/events';
import { FEEDBACK_KINDS, feedbackMessage } from '../content/feedback';
import type { FeedbackKind } from '../content/feedback';
import { fameTable, titleFor } from '../content/fame';
import { FRIEDA_TALKS_PER_DAY, regularsSay } from '../content/inn';
import { ARMORS, WEAPONS, tradeIn } from '../content/items';
import { masterForLevel } from '../content/masters';
import { MONSTERS } from '../content/monsters';
import { SPECIALTIES, SPECIALTY_ORDER } from '../content/specialties';
import { MAX_LEVEL, healCostPerHp } from '../game/balance';
import {
  attack, bankDeposit, bankWithdraw, buyItem, canChallengeMaster, canSeekDragon, checkRealDay, chooseDragonBonus,
  CHRONICLE_SIZE, closeFight, defense, drinkHarzbier, expNeeded, fightAction, forestSearch, harzbierCost, heal, healCost, maxHp,
  newGame, requestSong, resolveEvent, startDragonFight, startMasterFight, startNewDay, talkToFrieda,
} from '../game/engine';
import type { DragonBonus, FightAction, ForestMode } from '../game/engine';
import { deleteGame, exportCode, importCode, loadGame, loadPrefs, saveGame, savePrefs } from '../game/storage';
import { Cloud, CloudError } from '../game/cloud';
import type { FameRow, RemoteSave } from '../game/cloud';
import { decideSync } from '../game/sync';
import type { ChronicleEntry, GameState, Gender, LogLine, SpecialtyId } from '../game/types';
import { cardBack, cardFor, cardHtml, dragonCard, heroArt, heroPortrait, masterCard, monsterCard } from './art/cards';

type Screen = 'title' | 'create' | 'village' | 'forest' | 'fight' | 'training' | 'healer' | 'smith'
  | 'bank' | 'inn' | 'bestiary' | 'fame' | 'chronicle' | 'feedback' | 'settings' | 'shadows' | 'dragonBonus' | 'syncConflict' | 'login';

const VERSION = 'Testversion 0.12';

interface Ui {
  screen: Screen;
  flash: LogLine[];
  createName: string;
  createSpec: SpecialtyId;
  createGender: Gender;
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
  acctEmail: string;        // Spielerkonto: eingegebene Adresse
  acctStep: 'email' | 'code';
  acctMsg: string;
  conflict: RemoteSave | null;  // Server-Stand, wenn beide Geräte weitergespielt haben
  fame: FameRow[] | null;       // echte Spieler aus der Online-Ruhmeshalle
}

let state: GameState | null = loadGame();
const prefs = loadPrefs();
const cloud = new Cloud();
const ui: Ui = {
  screen: 'title', flash: [], createName: '', createSpec: 'klinge', createGender: 'm', confirmDelete: false, confirmNew: false, importMsg: '', newCard: null, fullLog: false, fbKinds: [], fbText: '', fbFrom: 'village', fbMsg: '', devTaps: 0, acctEmail: '', acctStep: 'email', acctMsg: '', conflict: null, fame: null,
};
let root: HTMLElement;

// ---------- Bausteine ----------

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function pct(a: number, b: number): number {
  return Math.max(0, Math.min(100, Math.round((100 * a) / Math.max(1, b))));
}

interface Item { act: string; label: string; key?: string; hint?: string; disabled?: boolean }
interface Group { title: string; items: Item[] }

/** Tastenkürzel im Wort hervorheben, wie damals: "[W]ald" → W unterstrichen und farbig. */
function hotLabel(label: string, key?: string): string {
  if (!key) return esc(label);
  const i = label.toLowerCase().indexOf(key.toLowerCase());
  if (i < 0) return `<b class="hk">${key.toUpperCase()}</b> · ${esc(label)}`;
  return `${esc(label.slice(0, i))}<b class="hk">${esc(label[i])}</b>${esc(label.slice(i + 1))}`;
}

function navHtml(groups: Group[]): string {
  return groups.map((g) => `<section class="nav-group"><h3>${esc(g.title)}</h3>
    ${g.items.map((it) => `<button type="button" class="nav-link" data-act="${it.act}" ${it.key ? `data-hotkey="${it.key}"` : ''} ${it.disabled ? 'disabled' : ''}>
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
  const prev = p.level > 1 ? expNeeded(p.level - 1) : 0;
  const need = expNeeded(p.level);
  return `<aside class="vital" aria-label="Charakter">
    <div class="vital-head">
      <div class="portrait">${heroPortrait(p.specialty, p.gender)}</div>
      <div><strong class="v-name">${esc(p.name)}</strong><span class="v-sub">Stufe ${p.level} · ${sp.name}</span>
        ${p.dragonKills ? `<span class="v-dk">Drachentöter ${p.dragonKills}×</span>` : ''}</div>
    </div>
    <dl class="vital-list">
      <div class="v-row wide"><dt>Lebenspunkte</dt><dd>${p.hp} / ${maxHp(p)}</dd>${bar(p.hp, maxHp(p), 'hp')}</div>
      <div class="v-row wide"><dt>Erfahrung</dt><dd>${p.level >= MAX_LEVEL ? 'max.' : `${p.exp} / ${need}`}</dd>${bar(p.exp - prev, need - prev, 'xp')}</div>
      <div class="v-row"><dt>Angriff</dt><dd>${attack(p)}</dd></div>
      <div class="v-row"><dt>Verteidigung</dt><dd>${defense(p)}</dd></div>
      <div class="v-row"><dt>Gold</dt><dd class="gold">${p.gold}</dd></div>
      <div class="v-row"><dt>Edelsteine</dt><dd class="gem">${p.gems}</dd></div>
      <div class="v-row"><dt>Waldkämpfe</dt><dd>${p.forestFights}</dd></div>
      <div class="v-row"><dt>${sp.move}</dt><dd>${p.specialUses}×</dd></div>
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
function layout(s: GameState, main: string, groups: Group[], cls = ''): string {
  return `<div class="shell ${cls}">${topbar(s)}
    <nav class="nav" aria-label="Navigation">${navHtml(groups)}</nav>
    <main class="main">${main}</main>
    ${vital(s)}
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
  const showcase = ['borkenwolf', 'steintroll', 'irrlicht'].map((id, i) => cardHtml(cardFor(id)!, { cls: `fan fan-${i}`, fx: true })).join('');
  return `<div class="solo">
    <div class="solo-panel">
      <h1 class="title-logo">Brackenwyrm</h1>
      <p class="tagline">Jeden Tag ein paar Kämpfe. Irgendwann der Drache.</p>
      <div class="fanned">${showcase}</div>
      ${flashHtml()}
      <div class="solo-nav">${navHtml([{ title: 'Willkommen', items: [
        ...(p ? [{ act: 'continue', label: `Weiterspielen: ${p.name}`, key: 'w', hint: `Stufe ${p.level} · Spieltag ${state!.day}` }] : []),
        { act: 'new', label: p && ui.confirmNew ? 'Wirklich neu beginnen? Der alte Spielstand geht verloren.' : 'Neues Spiel beginnen', key: 'n' },
        ...(cloud.enabled && !cloud.signedIn ? [{ act: 'go:login', label: 'Mit Spielerkonto anmelden', key: 'k', hint: 'auf einem anderen Gerät weiterspielen' }] : []),
      ] }])}</div>
      <p class="fine" data-act="devtap">${VERSION} · Tastenkürzel am Computer, Tippen am Handy${prefs.dev ? ' · Entwicklermodus' : ''}</p>
    </div>
  </div>`;
}

function loginScreen(): string {
  return `<div class="solo"><div class="solo-panel">
    ${accountHtml()}
    <div class="row"><button type="button" class="btn ghost" data-act="go:title">Zurück</button></div>
  </div></div>`;
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
    <h2>Was hast du gelernt?</h2>
    <div class="choices" role="radiogroup" aria-label="Spezialfähigkeit">
      ${SPECIALTY_ORDER.map((id) => {
        const sp = SPECIALTIES[id];
        return `<button type="button" class="choice ${ui.createSpec === id ? 'on' : ''}" role="radio" aria-checked="${ui.createSpec === id}" data-act="spec:${id}">
          <span class="choice-art">${heroArt(id, ui.createGender)}</span><strong>${sp.name}</strong><span>${sp.blurb}</span><small>Fähigkeit: ${sp.move}. ${sp.moveBlurb}</small></button>`;
      }).join('')}
    </div>
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
    ${flashHtml()}
    ${s.news.length ? `<section class="news"><h2>Neuigkeiten</h2>${s.news.slice(-4).map((n) => `<p>${esc(n)}</p>`).join('')}</section>` : ''}`;
  return layout(s, main, [
    { title: 'Stadttor', items: [{ act: 'go:forest', label: 'Wald', key: 'w', hint: `${p.forestFights} Kämpfe übrig` }] },
    { title: 'Dorf', items: [
      { act: 'go:training', label: 'Trainingsplatz', key: 't', hint: mstate === 'ok' ? `${m?.name} wartet!` : '' },
      { act: 'go:healer', label: 'Mirlas Kräuterhütte', key: 'h', hint: p.hp < maxHp(p) ? `${maxHp(p) - p.hp} LP fehlen` : '' },
      { act: 'go:smith', label: 'Alriks Schmiede', key: 's' },
      { act: 'go:inn', label: 'Gasthaus', key: 'g' },
      { act: 'go:bank', label: 'Kontor', key: 'k', hint: p.bank ? `${p.bank} Gold` : '' },
    ] },
    { title: 'Sonstiges', items: [
      { act: 'go:bestiary', label: 'Bestiarium', key: 'b', hint: `${found} / ${MONSTERS.length}` },
      { act: 'go:fame', label: 'Ruhmeshalle', key: 'r' },
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
    <p class="muted">Was tust du?</p>
    <div class="choice-row">${(ev?.choices ?? []).map((c) => {
      const ok = !c.available || c.available(p);
      return `<button type="button" class="tbtn" data-act="event:${c.id}" ${ok ? '' : 'disabled'}>${esc(c.label)}${c.hint ? ` <small>${esc(c.hint(p))}</small>` : ''}</button>`;
    }).join('')}</div>`;
  return layout(s, main, [{ title: 'Entscheidung', items: (ev?.choices ?? []).map((c) => ({
    act: `event:${c.id}`, label: c.label, key: c.key, hint: c.hint?.(p), disabled: !!c.available && !c.available(p),
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
      { act: 'forest:normal', label: 'Herumstreifen', key: 'h', hint: 'Gegner deiner Stufe', disabled: none },
      { act: 'forest:easy', label: 'Leichte Beute suchen', key: 'l', hint: 'schwächer, weniger Lohn', disabled: none },
      { act: 'forest:hard', label: 'Nervenkitzel suchen', key: 'n', hint: 'stärker, mehr Lohn', disabled: none },
      ...(p.level >= MAX_LEVEL ? [{ act: 'dragon', label: 'Den Brackenwyrm suchen', key: 'b', hint: 'Endkampf', disabled: !canSeekDragon(p) }] : []),
    ] },
    { title: 'Zurück', items: [back] },
  ]);
}

function fightScreen(s: GameState): string {
  const f = s.fight!;
  const p = s.player;
  const c = f.kind === 'dragon' ? dragonCard() : f.kind === 'master' ? masterCard(f.foe.level) : cardFor(f.monsterId)!;
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
  const spKey = sp.move[0].toLowerCase();
  const card = cardHtml(c, { hp: [f.foe.hp, f.foe.maxHp, from], cls, fx: true });
  const fx = `${heroAttacked ? `<div class="dmg dmg-foe ${f.lastCrit ? 'crit' : ''}">${f.lastHeroMiss ? 'Daneben' : '−' + f.lastHeroDmg}</div>` : ''}
    ${foeAttacked ? `<div class="dmg dmg-hero">${f.lastFoeMiss ? 'Ausgewichen' : '−' + f.lastFoeDmg + ' LP'}</div>` : ''}
    ${f.over === 'win' ? '<div class="stamp">Besiegt</div>' : ''}`;
  const isNew = f.over === 'win' && f.kind === 'forest' && s.bestiary[f.monsterId] === 1;

  let actions = '';
  let groups: Group[] = [];
  if (!f.over) {
    actions = `<div class="actions">
      <button type="button" class="btn big" data-act="fight:attack" data-hotkey="a">${hotLabel('Angreifen', 'a')}</button>
      <button type="button" class="btn alt" data-act="fight:special" data-hotkey="${spKey}" ${p.specialUses <= 0 ? 'disabled' : ''}>${hotLabel(sp.move, spKey)} <small>${p.specialUses}×</small></button>
      <button type="button" class="btn ghost" data-act="fight:flee" data-hotkey="f">${hotLabel(f.kind === 'master' ? 'Aufgeben' : 'Fliehen', f.kind === 'master' ? 'u' : 'f')}</button>
      ${f.kind !== 'master' ? `<button type="button" class="btn ghost" data-act="fight:auto" data-hotkey="k">${hotLabel('Kämpfen bis zum Ende', 'k')}</button>` : ''}
    </div>`;
    groups = [{ title: 'Kampf', items: [
      { act: 'fight:attack', label: 'Angreifen', key: 'a' },
      { act: 'fight:special', label: sp.move, key: spKey, disabled: p.specialUses <= 0, hint: `${p.specialUses}× übrig` },
      ...(f.kind !== 'master' ? [{ act: 'fight:auto', label: 'Kämpfen bis zum Ende', key: 'k' }] : []),
      { act: 'fight:flee', label: f.kind === 'master' ? 'Aufgeben' : 'Fliehen', key: f.kind === 'master' ? 'u' : 'f' },
    ] }];
  } else {
    const items: Item[] = [];
    if (f.kind === 'forest' && f.over !== 'lose') {
      items.push({ act: 'after:forest', label: 'Weiter durch den Wald', key: 'w', hint: `${p.forestFights} Kämpfe übrig`, disabled: p.forestFights <= 0 });
      items.push({ act: 'after:village', label: 'Zurück ins Dorf', key: 'd' });
    } else if (f.kind === 'master') {
      items.push({ act: 'after:training', label: 'Zurück zum Trainingsplatz', key: 't' });
      items.push({ act: 'after:village', label: 'Zurück ins Dorf', key: 'd' });
    } else if (f.kind === 'dragon' && f.over === 'win') {
      items.push({ act: 'after:bonus', label: 'Weiter', key: 'w' });
    } else if (f.over === 'fled') {
      items.push({ act: 'after:forest', label: 'Zurück in den Wald', key: 'w' });
      items.push({ act: 'after:village', label: 'Zurück ins Dorf', key: 'd' });
    } else {
      items.push({ act: 'after:shadows', label: 'Ins Schattenreich', key: 'w' });
    }
    groups = [{ title: 'Weiter', items }];
    actions = `<div class="actions after">${items.map((it, i) => `<button type="button" class="btn ${i ? 'ghost' : 'big'}" data-act="${it.act}" ${it.disabled ? 'disabled' : ''}>${hotLabel(it.label, it.key)}</button>`).join('')}</div>`;
  }

  const main = `<div class="battle">
      <div class="arena ${f.kind}">${card.replace('</figure>', `${isNew ? '<div class="card-new">Neu</div>' : ''}</figure>`)}${fx}</div>
      <div class="battle-side">
        <h1 class="foe-title">${esc(f.foe.name)}</h1>
        <div class="log fight-log ${ui.fullLog ? 'open' : ''}" aria-live="polite">${fightLogHtml(f.log)}</div>
        ${f.round > 2 ? `<button type="button" class="log-toggle" data-act="fulllog">${ui.fullLog ? 'Bericht einklappen' : `Ganzen Kampf anzeigen (${f.round} Runden)`}</button>` : ''}
        ${actions}
      </div>
    </div>`;
  return layout(s, main, groups, 'in-fight');
}

function trainingScreen(s: GameState): string {
  const p = s.player;
  const m = masterForLevel(p.level);
  const st = canChallengeMaster(p);
  const need = expNeeded(p.level);
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
    <section class="table-talk"><h2>Am Stammtisch</h2>
      ${regularsSay(s).map((l) => `<p><span class="npc">${esc(l.who.charAt(0).toUpperCase() + l.who.slice(1))}:</span> ${esc(l.t)}</p>`).join('')}
    </section>`;
  const talksLeft = FRIEDA_TALKS_PER_DAY - p.innTalks;
  return layout(s, main, [
    { title: 'Gasthaus', items: [
      { act: 'talk', label: 'Mit Frieda reden', key: 'f', hint: talksLeft > 0 ? `${talksLeft}× heute` : 'hat zu tun' },
      { act: 'inn:beer', label: 'Harzbier bestellen', key: 'h', hint: p.drankToday ? 'heute schon' : `${harzbierCost(p.level)} Gold`, disabled: p.drankToday },
      { act: 'inn:song', label: 'Lied wünschen', key: 'l', hint: p.songToday ? 'heute schon' : '1 Edelstein', disabled: p.songToday },
    ] },
    { title: 'Zurück', items: [back] },
  ]);
}

function bestiaryScreen(s: GameState): string {
  const levels = Array.from({ length: MAX_LEVEL }, (_, i) => i + 1);
  const found = Object.keys(s.bestiary).filter((k) => k !== 'dragon').length;
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
    <section class="b-level"><h2>Legende</h2><div class="card-grid">${dragon}</div></section>`;
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
    <table class="fame"><thead><tr><th></th><th>Held</th><th class="num">Drachen</th><th class="num">Stufe</th></tr></thead><tbody>${ui.fame.map((e, i) => `<tr><td class="rank">${i + 1}.</td><td><strong>${esc(e.name)}</strong><small>${esc(titleFor(e.dragonKills))}</small></td><td class="num">${e.dragonKills}</td><td class="num">${e.level}</td></tr>`).join('')}</tbody></table>` : ''}
    <h2>Deine Geschichte</h2>
    <p class="muted">Titel: <span class="gold">${esc(titleFor(p.dragonKills))}</span></p>
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
  shadows: 'Schattenreich', dragonBonus: 'Drachenkill',
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
  if (ui.acctStep === 'code') {
    return `<h2>Spielerkonto</h2>
      <p>Wir haben dir einen 6-stelligen Code an <strong>${esc(ui.acctEmail)}</strong> geschickt.</p>
      <div class="row"><input type="text" id="acct-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="123456" aria-label="Anmeldecode">
        <button type="button" class="tbtn" data-act="acct:verify">Anmelden</button><button type="button" class="tbtn" data-act="acct:back">Andere Adresse</button></div>${msg}`;
  }
  return `<h2>Spielerkonto</h2>
    <p class="muted">Mit einem Konto wird dein Spielstand online gesichert, und du spielst auf Handy und Computer mit demselben Helden. Kein Passwort: Du bekommst einen Code per E-Mail.</p>
    <div class="row"><input type="email" id="acct-email" autocomplete="email" placeholder="deine@mail.at" aria-label="E-Mail-Adresse" value="${esc(ui.acctEmail)}">
      <button type="button" class="tbtn" data-act="acct:code">Code schicken</button></div>${msg}`;
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

function settingsScreen(s: GameState): string {
  const main = `<h1>Einstellungen</h1>
    ${flashHtml()}
    <label class="toggle"><input type="checkbox" id="opt-motion" data-act="toggle:motion" ${prefs.reducedMotion ? 'checked' : ''}> Weniger Bewegung im Kampf</label>
    ${cloud.enabled ? accountHtml() : ''}
    <h2>Spielstand auf ein anderes Gerät mitnehmen</h2>
    <p class="muted">Im Prototyp liegt der Spielstand nur in diesem Browser. Kopiere den Code und füge ihn auf dem anderen Gerät ein. Später übernimmt das ein Spielerkonto automatisch.</p>
    <textarea id="exportcode" readonly aria-label="Spielstand-Code">${exportCode(s)}</textarea>
    <div class="row"><button type="button" class="tbtn" data-act="copycode">Code kopieren</button></div>
    <textarea id="importcode" placeholder="Code hier einfügen (beginnt mit BW1:)" aria-label="Code einfügen"></textarea>
    <div class="row"><button type="button" class="tbtn" data-act="importcode">Spielstand laden</button><span class="muted">${esc(ui.importMsg)}</span></div>`;
  return layout(s, main, [
    { title: 'Spielstand', items: [
      ...(prefs.dev ? [{ act: 'testday', label: 'Neuer Tag (Testmodus)', key: 'n', hint: 'sonst um Mitternacht' }] : []),
      { act: 'feedback', label: 'Rückmeldung geben', key: 'm' },
      { act: 'delete', label: ui.confirmDelete ? 'Wirklich löschen? Nochmal drücken.' : 'Spielstand löschen', key: 'x' },
    ] },
    { title: 'Zurück', items: [back] },
  ]);
}

function shadowsScreen(s: GameState): string {
  const now = new Date();
  const mid = new Date(now);
  mid.setHours(24, 0, 0, 0);
  const mins = Math.max(0, Math.round((mid.getTime() - now.getTime()) / 60000));
  const main = `<h1 class="shadow-title">Das Schattenreich</h1>
    <p class="lead">Grauer Nebel, ein stiller Fluss. <span class="npc">Morwen</span> stakt ihr Boot heran. „Du schon wieder“, sagt sie. „Setz dich. Bei Sonnenaufgang bringe ich dich zurück.“</p>
    <p class="muted">Neuer Tag in ${Math.floor(mins / 60)} Std. ${mins % 60} Min. Gold im Kontor ist sicher.</p>
    ${flashHtml()}`;
  return layout(s, main, [{ title: 'Schattenreich', items: [
    ...(prefs.dev ? [{ act: 'testday', label: 'Neuer Tag (Testmodus)', key: 'n' }] : []),
    { act: 'feedback', label: 'Rückmeldung geben', key: 'm' },
    { act: 'go:settings', label: 'Einstellungen', key: 'e' },
  ] }]);
}

function dragonBonusScreen(s: GameState): string {
  const main = `<div class="speaker">${cardHtml(dragonCard(), { cls: 'mini is-defeated' })}<div>
    <h1>Drachentöter!</h1>
    <p class="lead">Ganz Moosgrund läuft zusammen. Frieda schenkt aus, Florian dichtet, Mirla weint ein bisschen. Doch die alten Geschichten sagen: Ein Wyrm stirbt nie ganz. Du wirst wieder klein anfangen, aber etwas von diesem Tag bleibt dir für immer.</p></div></div>`;
  return layout(s, main, [{ title: 'Was nimmst du mit?', items: [
    { act: 'bonus:atk', label: 'Kraft: +1 Angriff', key: 'k' },
    { act: 'bonus:def', label: 'Panzer: +1 Verteidigung', key: 'p' },
    { act: 'bonus:hp', label: 'Lebenskraft: +5 Lebenspunkte', key: 'l' },
  ] }]);
}

// ---------- Steuerung ----------

function currentScreen(): Screen {
  if (!state) return ui.screen === 'create' || ui.screen === 'login' ? ui.screen : 'title';
  if (ui.screen === 'title' || ui.screen === 'create') return ui.screen;
  if (ui.screen === 'login') return 'village';
  if (state.pendingDragonBonus && !state.fight) return 'dragonBonus';
  if (ui.conflict) return 'syncConflict';
  if (state.fight) return 'fight';
  if (!state.player.alive && ui.screen !== 'settings' && ui.screen !== 'feedback') return 'shadows';
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
    bank: () => bankScreen(s!), inn: () => innScreen(s!), bestiary: () => bestiaryScreen(s!), fame: () => fameScreen(s!), syncConflict: () => syncConflictScreen(s!), chronicle: () => chronicleScreen(s!), feedback: () => feedbackScreen(s!),
    settings: () => settingsScreen(s!), shadows: () => shadowsScreen(s!), dragonBonus: () => dragonBonusScreen(s!),
  };
  root.innerHTML = views[scr]();
  // Der neueste Kampftext steht unten, also dorthin scrollen.
  const fl = root.querySelector<HTMLElement>('.battle .fight-log');
  if (fl) fl.scrollTop = fl.scrollHeight;
}

function go(screen: Screen): void {
  ui.screen = screen;
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
    const local = state;
    const d = decideSync({ local: local?.savedAt ?? null, remote: remote?.savedAt ?? null, lastSynced: prefs.lastSyncedAt });
    if (d === 'push' && local) {
      await cloud.push(local);
      prefs.lastSyncedAt = local.savedAt ?? 0;
    } else if (d === 'pull' && remote) {
      if (local?.fight) return '';  // nie mitten im Kampf austauschen
      state = remote.state;
      localSaveWithoutTouch(state);
      prefs.lastSyncedAt = remote.savedAt;
      render();
    } else if (d === 'conflict' && remote) {
      ui.conflict = remote;
      render();
      return 'Zwei Spielstände gefunden.';
    }
    savePrefs(prefs);
    return d === 'none' ? 'Alles aktuell.' : d === 'push' ? 'Online gesichert.' : 'Online-Stand geladen.';
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
    case 'go':
      if (a === 'fame' && cloud.enabled) cloud.hallOfFame().then((rows) => { ui.fame = rows; if (ui.screen === 'fame') render(); }, () => {});
      go(a as Screen);
      return;
    case 'devtap':
      if (++ui.devTaps >= 5) { ui.devTaps = 0; prefs.dev = !prefs.dev; savePrefs(prefs); render(); }
      return;
    case 'continue': if (s) { checkRealDay(s); saveGame(s); go('village'); } return;
    case 'new':
      if (state && !ui.confirmNew) { ui.confirmNew = true; render(); return; }
      ui.createName = ''; go('create'); return;
    case 'spec': {
      const input = document.getElementById('name') as HTMLInputElement | null;
      if (input) ui.createName = input.value;
      ui.createSpec = a as SpecialtyId; render(); return;
    }
    case 'gender': {
      const input = document.getElementById('name') as HTMLInputElement | null;
      if (input) ui.createName = input.value;
      ui.createGender = a === 'f' ? 'f' : 'm'; render(); return;
    }
    case 'create': {
      const name = ((document.getElementById('name') as HTMLInputElement | null)?.value ?? '').trim().slice(0, 20);
      if (!name) { say('Ohne Namen lässt dich der Torwächter nicht ins Dorf.', 'warn'); ui.createName = ''; render(); return; }
      state = newGame(name, ui.createSpec, ui.createGender);
      saveGame(state);
      go('village');
      return;
    }
    case 'acct': {
      const done = (m: string) => { ui.acctMsg = m; render(); };
      if (a === 'code') {
        const email = ((document.getElementById('acct-email') as HTMLInputElement | null)?.value ?? '').trim();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { done('Bitte eine gültige E-Mail-Adresse eingeben.'); return; }
        ui.acctEmail = email;
        cloud.requestCode(email).then(() => { ui.acctStep = 'code'; done(''); }, (e) => done(e instanceof CloudError ? e.message : 'Das hat nicht geklappt.'));
      } else if (a === 'verify') {
        const code = (document.getElementById('acct-code') as HTMLInputElement | null)?.value ?? '';
        cloud.verifyCode(ui.acctEmail, code).then(async () => { ui.acctStep = 'email'; prefs.lastSyncedAt = 0; savePrefs(prefs); const m = await syncNow(); if (ui.screen === 'login') { if (state) { checkRealDay(state); saveGame(state, true); go('village'); return; } done('Für dieses Konto gibt es noch keinen Spielstand. Beginne ein neues Spiel, es wird dann automatisch gesichert.'); return; } done(m); }, (e) => done(e instanceof CloudError ? e.message : 'Das hat nicht geklappt.'));
      } else if (a === 'back') {
        ui.acctStep = 'email'; done('');
      } else if (a === 'sync') {
        done('Gleiche ab …');
        syncNow().then(done);
      } else if (a === 'out') {
        cloud.signOut(); prefs.lastSyncedAt = 0; savePrefs(prefs); done('Abgemeldet. Der Spielstand bleibt auf diesem Gerät.');
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
    case 'dragon': if (startDragonFight(s)) { ui.flash = []; commit(); window.scrollTo(0, 0); } return;
    case 'master': if (startMasterFight(s)) { ui.flash = []; commit(); window.scrollTo(0, 0); } return;
    case 'fight': {
      if (a === 'auto') {
        let guard = 0;
        while (s.fight && !s.fight.over && s.player.hp > maxHp(s.player) * 0.3 && guard++ < 60) fightAction(s, 'attack');
        if (s.fight && !s.fight.over) s.fight.log.push({ t: 'Du hältst inne. Du bist angeschlagen, entscheide selbst, wie es weitergeht.', k: 'warn', r: s.fight.round });
      } else {
        fightAction(s, a as FightAction);
      }
      const f = s.fight;
      if (f && f.over === 'win' && f.kind === 'forest' && s.bestiary[f.monsterId] === 1) ui.newCard = f.monsterId;
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
      closeFight(s);
      const target: Screen = a === 'forest' ? 'forest' : a === 'training' ? 'training' : a === 'shadows' ? 'shadows' : a === 'bonus' ? 'dragonBonus' : 'village';
      saveGame(s);
      go(target);
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
    case 'bonus': chooseDragonBonus(s, a as DragonBonus); saveGame(s); go('village'); return;
    case 'toggle':
      if (a === 'motion') prefs.reducedMotion = (el as HTMLInputElement).checked;
      savePrefs(prefs);
      render();
      return;
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
    handle(target.dataset.act!, target);
  });
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
