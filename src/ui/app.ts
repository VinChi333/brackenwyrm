// Die Oberfläche: liest den Spielzustand, zeichnet den passenden Bildschirm
// und leitet Klicks und Tastenkürzel an die Spiellogik weiter.

import { ARMORS, WEAPONS, tradeIn } from '../content/items';
import { masterForLevel } from '../content/masters';
import { DRAGON, monsterById } from '../content/monsters';
import { SPECIALTIES, SPECIALTY_ORDER } from '../content/specialties';
import { MAX_LEVEL, healCostPerHp } from '../game/balance';
import {
  attack, bankDeposit, bankWithdraw, buyItem, canChallengeMaster, canSeekDragon, checkRealDay, chooseDragonBonus,
  closeFight, defense, drinkHarzbier, expNeeded, fightAction, forestSearch, harzbierCost, heal, healCost, maxHp,
  newGame, requestSong, specialUsesPerDay, startDragonFight, startMasterFight, startNewDay,
} from '../game/engine';
import type { DragonBonus, FightAction, ForestMode } from '../game/engine';
import { deleteGame, exportCode, importCode, loadGame, saveGame } from '../game/storage';
import type { Fight, GameState, LogLine, SpecialtyId } from '../game/types';
import { creature, humanoid } from './art/silhouettes';
import { stageSvg, villageBanner, vignette } from './art/stage';

type Screen = 'title' | 'create' | 'village' | 'forest' | 'fight' | 'training' | 'healer' | 'smith'
  | 'bank' | 'inn' | 'sheet' | 'settings' | 'shadows' | 'dragonBonus';

interface Ui {
  screen: Screen;
  flash: LogLine[];
  createName: string;
  createSpec: SpecialtyId;
  confirmDelete: boolean;
  confirmNew: boolean;
  importMsg: string;
}

let state: GameState | null = loadGame();
const ui: Ui = {
  screen: 'title', flash: [], createName: '', createSpec: 'klinge', confirmDelete: false, confirmNew: false, importMsg: '',
};
let root: HTMLElement;

// ---------- Hilfen ----------

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

interface Item { act: string; label: string; key?: string; hint?: string; disabled?: boolean }

function menu(items: Item[]): string {
  return `<nav class="menu">${items.map((it, i) => `
    <button type="button" data-act="${it.act}" ${it.key ? `data-hotkey="${it.key}"` : ''} ${it.disabled ? 'disabled' : ''}>
      <span class="num">${ROMAN[i] ?? i + 1}.</span>
      <span>${it.label}${it.key ? `<span class="key">${it.key.toUpperCase()}</span>` : ''}</span>
      ${it.hint ? `<span class="hint">${it.hint}</span>` : ''}
    </button>`).join('')}</nav>`;
}

function flash(): string {
  if (!ui.flash.length) return '';
  return `<div class="flash log">${ui.flash.map((l) => `<p class="${l.k}">${esc(l.t)}</p>`).join('')}</div>`;
}

function say(t: string, k: LogLine['k'] = 'info'): void {
  ui.flash = [{ t, k }];
}

function pct(a: number, b: number): number {
  return Math.max(0, Math.min(100, Math.round((100 * a) / Math.max(1, b))));
}

function textBar(v: number, max: number, w = 20): string {
  const n = Math.round((v / Math.max(1, max)) * w);
  return '█'.repeat(Math.max(0, n)) + '░'.repeat(Math.max(0, w - n));
}

function statusBar(s: GameState): string {
  const p = s.player;
  return `<header class="status">
    <div class="status-top"><span class="brand">Brackenwyrm</span>
      <span class="status-day">Tag ${s.day} · ${p.alive ? `${p.forestFights} Waldkämpfe` : 'im Schattenreich'}</span></div>
    <div class="hpline"><span>${esc(p.name)} · Stufe ${p.level}</span>
      <div class="bar" aria-hidden="true"><i style="width:${pct(p.hp, maxHp(p))}%"></i></div>
      <span>${p.hp}/${maxHp(p)} LP</span></div>
    <div class="stats"><span><b>Gold</b>${p.gold}</span><span><b>Edelsteine</b>${p.gems}</span>
      <span><b>Angriff</b>${attack(p)}</span><span><b>Verteidigung</b>${defense(p)}</span>
      ${p.dragonKills ? `<span><b>Drachentöter</b>${p.dragonKills}×</span>` : ''}</div>
  </header>`;
}

function placeHead(kind: Parameters<typeof vignette>[0], title: string, sub: string): string {
  return `<div class="place-head">${vignette(kind)}<div><h2>${title}</h2><p class="sub">${sub}</p></div></div>`;
}

// ---------- Bildschirme ----------

function titleScreen(): string {
  const p = state?.player;
  return `<div class="page">
    ${villageBanner()}
    <div class="center"><h1>Brackenwyrm</h1><p class="sub">Ein Abenteuer in Tagen, Wäldern und Drachenfeuer</p></div>
    <p class="ornament">❦ ❦ ❦</p>
    ${flash()}
    ${menu([
      ...(p ? [{ act: 'continue', label: `Weiterspielen: ${esc(p.name)}`, key: 'w', hint: `Stufe ${p.level} · Tag ${state!.day}` }] : []),
      { act: 'new', label: p && ui.confirmNew ? 'Wirklich neu beginnen? Der alte Spielstand geht verloren.' : 'Neues Spiel beginnen', key: 'n' },
    ])}
    <p class="sub center" style="font-size:14px">Prototyp 0.1 · Tastenkürzel am Computer, Tippen am Handy</p>
  </div>`;
}

function createScreen(): string {
  return `<div class="page">
    <h1>Wer bist du?</h1>
    <p class="sub">Du kommst nach Moosgrund, ein Dorf am Rand des Brackenwalds. In der Farnschlucht schläft ein Wyrm. Noch.</p>
    ${flash()}
    <label>Dein Name<input type="text" id="name" maxlength="20" autocomplete="off" value="${esc(ui.createName)}" placeholder="z. B. Hilda"></label>
    <h3>Was hast du gelernt?</h3>
    <div class="choices" role="radiogroup" aria-label="Spezialfähigkeit">
      ${SPECIALTY_ORDER.map((id) => {
        const sp = SPECIALTIES[id];
        return `<button type="button" class="choice ${ui.createSpec === id ? 'on' : ''}" role="radio" aria-checked="${ui.createSpec === id}" data-act="spec:${id}">
          <strong>${sp.name}</strong><span>${sp.blurb}</span><small>Fähigkeit: ${sp.move} – ${sp.moveBlurb}</small></button>`;
      }).join('')}
    </div>
    <div class="row"><button type="button" class="btn" data-act="create">Nach Moosgrund aufbrechen</button>
      <button type="button" class="btn secondary" data-act="go:title">Zurück</button></div>
  </div>`;
}

function villageScreen(s: GameState): string {
  const p = s.player;
  const m = masterForLevel(p.level);
  const mstate = canChallengeMaster(p);
  return `<div class="page">${statusBar(s)}
    ${villageBanner()}
    <div><h2>Moosgrund</h2><p class="sub">Rauch steigt aus den Kaminen. Hinter den Dächern rauscht der Brackenwald.</p></div>
    ${flash()}
    ${s.news.length ? `<div class="news">${s.news.slice(-4).map((n) => `<p>${esc(n)}</p>`).join('')}</div>` : ''}
    ${menu([
      { act: 'go:forest', label: 'In den Farnwald', key: 'w', hint: `${p.forestFights} Kämpfe übrig` },
      { act: 'go:training', label: 'Zum Trainingsplatz', key: 't', hint: mstate === 'ok' ? `${m?.name} wartet!` : p.level >= MAX_LEVEL ? 'Kein Meister mehr' : m?.name ?? '' },
      { act: 'go:healer', label: 'Mirlas Kräuterhütte', key: 'h', hint: `${p.hp}/${maxHp(p)} LP` },
      { act: 'go:smith', label: 'Alriks Schmiede', key: 's', hint: `${WEAPONS[p.weaponTier].name}` },
      { act: 'go:inn', label: 'Gasthaus „Zum Schlafenden Wurm“', key: 'g' },
      { act: 'go:bank', label: 'Das Kontor', key: 'k', hint: `${p.bank} Gold sicher` },
      { act: 'go:sheet', label: 'Charakterbogen', key: 'c' },
      { act: 'go:settings', label: 'Einstellungen & Spielstand', key: 'e' },
    ])}
  </div>`;
}

function forestScreen(s: GameState): string {
  const p = s.player;
  const low = p.hp < maxHp(p) * 0.4;
  return `<div class="page">${statusBar(s)}
    ${placeHead('forest', 'Der Farnwald', 'Zwischen den Stämmen ist es still. Zu still.')}
    ${flash()}
    ${low ? `<p class="flash">Du bist angeschlagen (${p.hp}/${maxHp(p)} LP). Mirla in der Kräuterhütte könnte helfen.</p>` : ''}
    ${p.forestFights <= 0 ? '<p>Du bist zu müde für weitere Abenteuer. Morgen ist auch noch ein Tag.</p>' : ''}
    ${menu([
      { act: 'forest:normal', label: 'Durch den Wald streifen', key: 'h', hint: 'Gegner deiner Stufe', disabled: p.forestFights <= 0 },
      { act: 'forest:easy', label: 'Leichte Beute suchen', key: 'l', hint: 'schwächer, weniger Lohn', disabled: p.forestFights <= 0 },
      { act: 'forest:hard', label: 'Den Nervenkitzel suchen', key: 'n', hint: 'stärker, mehr Lohn', disabled: p.forestFights <= 0 },
      ...(p.level >= MAX_LEVEL ? [{ act: 'dragon', label: 'In die Farnschlucht: den Brackenwyrm suchen', key: 'b', hint: 'Endkampf', disabled: !canSeekDragon(p) }] : []),
      { act: 'go:village', label: 'Zurück ins Dorf', key: 'd' },
    ])}
  </div>`;
}

function heroFigure(s: GameState): string {
  const sp = s.player.specialty;
  return humanoid(SPECIALTIES[sp].heroProp, null, { hood: sp === 'schleich', shield: sp === 'klinge', cape: sp === 'wurzel' });
}

function foeFigure(f: Fight): { svg: string; scale: number; stage: 'forest' | 'training' | 'lair' } {
  if (f.kind === 'dragon') return { svg: creature('dragon', DRAGON.eyes ?? '#ffcf5a'), scale: 0.95, stage: 'lair' };
  if (f.kind === 'master') {
    const m = masterForLevel(f.foe.level)!;
    return { svg: humanoid(m.prop, null, { cape: true }), scale: 1.14, stage: 'training' };
  }
  const m = monsterById(f.monsterId)!;
  return { svg: creature(m.shape, m.eyes ?? '#f3c06a', m.prop), scale: m.scale ?? 1, stage: 'forest' };
}

function fightScreen(s: GameState): string {
  const f = s.fight!;
  const p = s.player;
  const fig = foeFigure(f);
  const acted = f.seq > 0;
  const heroAttacked = acted && (f.lastHeroDmg > 0 || f.lastHeroMiss);
  const foeAttacked = acted && (f.lastFoeDmg > 0 || f.lastFoeMiss);
  const heroCls = [heroAttacked ? 'anim-hero-lunge' : '', f.lastFoeDmg > 0 ? 'anim-hero-hit' : '', f.over === 'lose' && f.kind !== 'master' ? 'anim-fall' : ''].join(' ');
  const foeCls = [f.lastHeroDmg > 0 ? 'anim-foe-hit' : '', foeAttacked ? 'anim-foe-lunge' : '', f.over === 'win' ? 'anim-fall' : ''].join(' ');
  const foeFrom = pct(Math.min(f.foe.maxHp, f.foe.hp + f.lastHeroDmg), f.foe.maxHp);
  const heroFrom = pct(Math.min(maxHp(p), p.hp + f.lastFoeDmg), maxHp(p));
  const sp = SPECIALTIES[p.specialty];

  const stage = `<div class="stage">
      ${stageSvg({ id: fig.stage, hero: heroFigure(s), foe: fig.svg, foeScale: fig.scale, heroClass: heroCls, foeClass: foeCls, label: `${esc(p.name)} kämpft gegen ${esc(f.foe.name)}` })}
      <div class="stage-hud">
        <div class="who"><span class="nm"><span>${esc(p.name)}</span><span>${p.hp}/${maxHp(p)}</span></span>
          <div class="bar anim"><i style="--from:${heroFrom}%;--to:${pct(p.hp, maxHp(p))}%;width:${pct(p.hp, maxHp(p))}%"></i></div></div>
        <div class="who r"><span class="nm"><span>${esc(f.foe.name)}</span><span>${f.foe.hp}/${f.foe.maxHp}</span></span>
          <div class="bar anim"><i style="--from:${foeFrom}%;--to:${pct(f.foe.hp, f.foe.maxHp)}%;width:${pct(f.foe.hp, f.foe.maxHp)}%"></i></div></div>
      </div>
      ${heroAttacked ? `<div class="dmg foe-dmg show-foe ${f.lastCrit ? 'crit' : ''}">${f.lastHeroMiss ? 'daneben' : '−' + f.lastHeroDmg}</div>` : ''}
      ${foeAttacked ? `<div class="dmg hero-dmg show-hero">${f.lastFoeMiss ? 'daneben' : '−' + f.lastFoeDmg}</div>` : ''}
    </div>`;

  const retro = `<div class="retro-only"><p style="color:#ff6b5e">${esc(f.foe.name.toUpperCase())}</p>
      <p class="retro-hp" style="color:#ff6b5e">${textBar(f.foe.hp, f.foe.maxHp)}  ${f.foe.hp}/${f.foe.maxHp}</p>
      <p style="color:#7fd16b">${esc(p.name.toUpperCase())}</p>
      <p class="retro-hp" style="color:#7fd16b">${textBar(p.hp, maxHp(p))}  ${p.hp}/${maxHp(p)}</p></div>`;

  let actions = '';
  if (!f.over) {
    actions = `<div class="actions">
      <button type="button" class="btn" data-act="fight:attack" data-hotkey="a">Angreifen</button>
      <button type="button" class="btn secondary" data-act="fight:special" data-hotkey="s" ${p.specialUses <= 0 ? 'disabled' : ''}>${sp.move} (${p.specialUses})</button>
      <button type="button" class="btn secondary" data-act="fight:flee" data-hotkey="f">${f.kind === 'master' ? 'Aufgeben' : 'Fliehen'}</button>
      ${f.kind !== 'master' ? `<button type="button" class="btn secondary" data-act="fight:auto" data-hotkey="k" style="grid-column:1/-1">Kämpfen bis zum Ende</button>` : ''}
    </div>`;
  } else {
    const items: Item[] = [];
    if (f.kind === 'forest' && f.over !== 'lose') {
      items.push({ act: 'after:forest', label: 'Weiter durch den Wald', key: 'w', hint: `${p.forestFights} Kämpfe übrig`, disabled: p.forestFights <= 0 });
      items.push({ act: 'after:village', label: 'Zurück ins Dorf', key: 'd' });
    } else if (f.kind === 'master') {
      items.push({ act: 'after:training', label: 'Zurück zum Trainingsplatz', key: 'w' });
      items.push({ act: 'after:village', label: 'Ins Dorf', key: 'd' });
    } else if (f.kind === 'dragon' && f.over === 'win') {
      items.push({ act: 'after:bonus', label: 'Weiter', key: 'w' });
    } else if (f.over === 'fled') {
      items.push({ act: 'after:forest', label: 'Zurück in den Wald', key: 'w' });
      items.push({ act: 'after:village', label: 'Ins Dorf', key: 'd' });
    } else {
      items.push({ act: 'after:shadows', label: 'Ins Schattenreich', key: 'w' });
    }
    actions = menu(items);
  }

  return `<div class="page">${statusBar(s)}
    ${stage}${retro}
    <div class="log" aria-live="polite">${f.log.slice(-5).map((l) => `<p class="${l.k}">${esc(l.t)}</p>`).join('')}</div>
    ${actions}
  </div>`;
}

function trainingScreen(s: GameState): string {
  const p = s.player;
  const m = masterForLevel(p.level);
  const st = canChallengeMaster(p);
  const prev = p.level > 1 ? expNeeded(p.level - 1) : 0;
  const need = expNeeded(p.level);
  let body = '';
  if (st === 'max' || !m) {
    body = '<p>Kein Meister in Moosgrund kann dir noch etwas beibringen. Nur einer wartet noch: der Brackenwyrm in der Farnschlucht.</p>';
  } else {
    const line = st === 'ok' ? m.greeting : st === 'seen' ? `${m.name} winkt ab. „Für heute reicht’s. Komm morgen wieder.“` : m.notReady;
    body = `<p class="lead">${esc(line)}</p>
      <div class="hpline"><span>Erfahrung</span><div class="bar exp"><i style="width:${pct(p.exp - prev, need - prev)}%"></i></div>
      <span>${p.exp}/${need}</span></div>`;
  }
  return `<div class="page">${statusBar(s)}
    ${placeHead('training', 'Der Trainingsplatz', m ? `Dein Meister: ${m.name}` : 'Hier ist es leer geworden.')}
    ${flash()}
    <div class="prose">${body}</div>
    ${menu([
      ...(m && st !== 'max' ? [{ act: 'master', label: `${m.name} herausfordern`, key: 'm', disabled: st !== 'ok', hint: st === 'notReady' ? `noch ${need - p.exp} Erfahrung` : st === 'seen' ? 'morgen wieder' : 'Aufstieg auf Stufe ' + (p.level + 1) }] : []),
      { act: 'go:village', label: 'Zurück ins Dorf', key: 'd' },
    ])}
  </div>`;
}

function healerScreen(s: GameState): string {
  const p = s.player;
  const missing = maxHp(p) - p.hp;
  const full = healCost(p, missing);
  const half = healCost(p, Math.ceil(missing / 2));
  return `<div class="page">${statusBar(s)}
    ${placeHead('healer', 'Mirlas Kräuterhütte', 'Es riecht nach Kamille, Rauch und alten Geheimnissen.')}
    ${flash()}
    <p class="lead">${missing <= 0 ? 'Mirla mustert dich. „Dir fehlt nichts. Raus mit dir, ich hab zu tun.“' : `Mirla schnalzt mit der Zunge. „${missing} Lebenspunkte fehlen dir. Das kostet ${full} Gold, wenn ich alles heile.“`}</p>
    <p class="sub">Preis: ${healCostPerHp(p.level).toFixed(2).replace('.', ',')} Gold pro Lebenspunkt auf deiner Stufe.</p>
    ${menu([
      { act: 'heal:full', label: 'Alles heilen', key: 'v', hint: `${full} Gold`, disabled: missing <= 0 || p.gold < full },
      { act: 'heal:half', label: 'Nur das Gröbste verbinden', key: 't', hint: `${half} Gold`, disabled: missing <= 0 || p.gold < half },
      { act: 'go:village', label: 'Zurück ins Dorf', key: 'd' },
    ])}
  </div>`;
}

function smithScreen(s: GameState): string {
  const p = s.player;
  const table = (kind: 'weapon' | 'armor') => {
    const list = kind === 'weapon' ? WEAPONS : ARMORS;
    const curTier = kind === 'weapon' ? p.weaponTier : p.armorTier;
    const cur = list[curTier];
    const from = Math.max(0, curTier);
    const to = Math.min(list.length - 1, Math.max(curTier + 4, p.level + 1));
    const rows = list.slice(from, to + 1).map((it) => {
      const owned = it.tier === curTier;
      const cost = it.price - tradeIn(cur);
      return `<tr class="${owned ? 'owned' : ''}"><td>${it.name}</td><td class="num">${kind === 'weapon' ? '+' : '+'}${it.value}</td>
        <td class="num">${owned ? '—' : cost}</td>
        <td class="num">${owned ? 'deins' : `<button type="button" class="tbtn" data-act="buy:${kind}:${it.tier}" ${p.gold < cost ? 'disabled' : ''}>Kaufen</button>`}</td></tr>`;
    }).join('');
    return `<div class="scroll-x"><table><thead><tr><th>${kind === 'weapon' ? 'Waffe' : 'Rüstung'}</th><th class="num">${kind === 'weapon' ? 'Angriff' : 'Schutz'}</th><th class="num">Gold*</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
  };
  return `<div class="page">${statusBar(s)}
    ${placeHead('smith', 'Alriks Schmiede', 'Funken stieben. Alrik nickt dir zu, ohne den Hammer abzusetzen.')}
    ${flash()}
    <p class="lead">„Gutes Eisen rettet Leben“, brummt Alrik. „Dein altes Zeug nehm ich in Zahlung. Halber Preis.“</p>
    ${table('weapon')}
    ${table('armor')}
    <p class="sub" style="font-size:15px">* Preis nach Eintausch deiner jetzigen Ausrüstung.</p>
    ${menu([{ act: 'go:village', label: 'Zurück ins Dorf', key: 'd' }])}
  </div>`;
}

function bankScreen(s: GameState): string {
  const p = s.player;
  return `<div class="page">${statusBar(s)}
    ${placeHead('bank', 'Das Kontor', 'Ansgar, der Kontorist, zählt Münzen, die nicht ihm gehören.')}
    ${flash()}
    <p class="lead">„Was im Kontor liegt, verlierst du nicht im Wald“, sagt Ansgar. „Und über Nacht gibt’s Zinsen.“</p>
    <div class="stats"><span><b>Im Kontor</b>${p.bank} Gold</span><span><b>Dabei</b>${p.gold} Gold</span></div>
    <div class="row"><input type="number" id="amount" min="1" inputmode="numeric" placeholder="Betrag" style="max-width:180px">
      <button type="button" class="tbtn" data-act="bank:dep:input">Einzahlen</button>
      <button type="button" class="tbtn" data-act="bank:wd:input">Abheben</button></div>
    ${menu([
      { act: 'bank:dep:all', label: 'Alles einzahlen', key: 'e', disabled: p.gold <= 0 },
      { act: 'bank:wd:all', label: 'Alles abheben', key: 'a', disabled: p.bank <= 0 },
      { act: 'go:village', label: 'Zurück ins Dorf', key: 'd' },
    ])}
  </div>`;
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
  return `<div class="page">${statusBar(s)}
    ${placeHead('inn', 'Zum Schlafenden Wurm', 'Das Feuer knistert. Wirtin Frieda poliert ein Glas, das davon nicht sauberer wird.')}
    ${flash()}
    <p class="lead">${esc(RUMORS[s.day % RUMORS.length])}</p>
    ${menu([
      { act: 'inn:beer', label: 'Ein Harzbier bestellen', key: 'b', hint: p.drankToday ? 'heute schon' : `${harzbierCost(p.level)} Gold · Mut und etwas Heilung`, disabled: p.drankToday },
      { act: 'inn:song', label: 'Barde Florian ein Lied wünschen', key: 'l', hint: p.songToday ? 'heute schon' : '1 Edelstein', disabled: p.songToday },
      { act: 'go:village', label: 'Zurück ins Dorf', key: 'd' },
    ])}
  </div>`;
}

function sheetScreen(s: GameState): string {
  const p = s.player;
  const sp = SPECIALTIES[p.specialty];
  const rows: [string, string][] = [
    ['Name', esc(p.name)], ['Fähigkeit', `${sp.name} (${sp.move})`], ['Stufe', String(p.level)],
    ['Erfahrung', `${p.exp} / ${p.level >= MAX_LEVEL ? '—' : expNeeded(p.level)}`], ['Lebenspunkte', `${p.hp} / ${maxHp(p)}`],
    ['Angriff', String(attack(p))], ['Verteidigung', String(defense(p))],
    ['Waffe', WEAPONS[p.weaponTier].name], ['Rüstung', ARMORS[p.armorTier].name],
    ['Fähigkeit heute', `${p.specialUses} von ${specialUsesPerDay(p)}`], ['Gold', `${p.gold} dabei, ${p.bank} im Kontor`],
    ['Edelsteine', String(p.gems)], ['Drachentöter', `${p.dragonKills}×`], ['Spieltag', String(s.day)],
    ...(p.buffs.length ? [['Wirkungen', p.buffs.map((b) => `${b.name} (${b.rounds} Runden)`).join(', ')] as [string, string]] : []),
  ];
  return `<div class="page">${statusBar(s)}
    ${placeHead('sheet', 'Charakterbogen', 'Alles, was man über dich wissen muss. Und ein bisschen mehr.')}
    <table><tbody>${rows.map(([a, b]) => `<tr><td>${a}</td><td class="num">${b}</td></tr>`).join('')}</tbody></table>
    ${menu([{ act: 'go:village', label: 'Zurück ins Dorf', key: 'd' }])}
  </div>`;
}

function settingsScreen(s: GameState): string {
  return `<div class="page">${statusBar(s)}
    <h2>Einstellungen & Spielstand</h2>
    ${flash()}
    <label class="toggle"><input type="checkbox" data-act="toggle:retro" ${s.settings.retro ? 'checked' : ''}> Retro-Modus: reiner Text wie damals</label>
    <label class="toggle"><input type="checkbox" data-act="toggle:motion" ${s.settings.reducedMotion ? 'checked' : ''}> Weniger Bewegung im Kampf</label>
    <h3>Spielstand auf ein anderes Gerät mitnehmen</h3>
    <p class="sub">Im Prototyp liegt der Spielstand nur in diesem Browser. Kopiere den Code und füge ihn auf dem anderen Gerät ein. Später übernimmt das ein Spielerkonto automatisch.</p>
    <textarea id="exportcode" readonly>${exportCode(s)}</textarea>
    <div class="row"><button type="button" class="tbtn" data-act="copycode">Code kopieren</button></div>
    <textarea id="importcode" placeholder="Code hier einfügen (beginnt mit BW1:)"></textarea>
    <div class="row"><button type="button" class="tbtn" data-act="importcode">Spielstand laden</button><span class="sub">${esc(ui.importMsg)}</span></div>
    <h3>Testen</h3>
    ${menu([
      { act: 'testday', label: 'Neuer Tag (Testmodus)', key: 'n', hint: 'normal: um Mitternacht' },
      { act: 'delete', label: ui.confirmDelete ? 'Wirklich löschen? Nochmal tippen.' : 'Spielstand löschen', key: 'x' },
      { act: 'go:village', label: 'Zurück ins Dorf', key: 'd' },
    ])}
  </div>`;
}

function shadowsScreen(s: GameState): string {
  const now = new Date();
  const mid = new Date(now);
  mid.setHours(24, 0, 0, 0);
  const mins = Math.max(0, Math.round((mid.getTime() - now.getTime()) / 60000));
  const h = Math.floor(mins / 60);
  return `<div class="page">${statusBar(s)}
    ${placeHead('shadows', 'Das Schattenreich', 'Grauer Nebel, ein stiller Fluss und eine Fährfrau, die nicht lächelt.')}
    ${flash()}
    <div class="prose"><p class="lead">Morwen stakt ihr Boot durch den Nebel. „Du schon wieder“, sagt sie. „Setz dich. Bei Sonnenaufgang bringe ich dich zurück.“</p>
    <p class="sub">Neuer Tag in ${h} Std. ${mins % 60} Min. Bis dahin bleibst du hier. Gold im Kontor ist sicher.</p></div>
    ${menu([
      { act: 'testday', label: 'Neuer Tag (Testmodus)', key: 'n' },
      { act: 'go:settings', label: 'Einstellungen & Spielstand', key: 'e' },
    ])}
  </div>`;
}

function dragonBonusScreen(s: GameState): string {
  return `<div class="page">${statusBar(s)}
    ${villageBanner()}
    <div class="prose"><h1>Drachentöter!</h1>
    <p class="lead">Ganz Moosgrund läuft zusammen. Frieda schenkt aus, Florian dichtet, Mirla weint ein bisschen. Doch alte Geschichten sagen: Ein Wyrm stirbt nie ganz. Du wirst wieder klein anfangen, aber etwas von diesem Tag bleibt dir für immer.</p>
    <h3>Was nimmst du mit?</h3></div>
    ${menu([
      { act: 'bonus:atk', label: 'Kraft: +1 Angriff für immer', key: 'k' },
      { act: 'bonus:def', label: 'Panzer: +1 Verteidigung für immer', key: 'p' },
      { act: 'bonus:hp', label: 'Lebenskraft: +5 Lebenspunkte für immer', key: 'l' },
    ])}
  </div>`;
}

// ---------- Steuerung ----------

function currentScreen(): Screen {
  if (!state) return ui.screen === 'create' ? 'create' : 'title';
  if (ui.screen === 'title' || ui.screen === 'create') return ui.screen;
  if (state.pendingDragonBonus && !state.fight) return 'dragonBonus';
  if (state.fight) return 'fight';
  if (!state.player.alive && ui.screen !== 'settings') return 'shadows';
  return ui.screen;
}

export function render(): void {
  const scr = currentScreen();
  const s = state;
  document.body.classList.toggle('retro', !!s?.settings.retro);
  document.body.classList.toggle('reduced', !!s?.settings.reducedMotion);
  let html = '';
  switch (scr) {
    case 'title': html = titleScreen(); break;
    case 'create': html = createScreen(); break;
    case 'village': html = villageScreen(s!); break;
    case 'forest': html = forestScreen(s!); break;
    case 'fight': html = fightScreen(s!); break;
    case 'training': html = trainingScreen(s!); break;
    case 'healer': html = healerScreen(s!); break;
    case 'smith': html = smithScreen(s!); break;
    case 'bank': html = bankScreen(s!); break;
    case 'inn': html = innScreen(s!); break;
    case 'sheet': html = sheetScreen(s!); break;
    case 'settings': html = settingsScreen(s!); break;
    case 'shadows': html = shadowsScreen(s!); break;
    case 'dragonBonus': html = dragonBonusScreen(s!); break;
  }
  root.innerHTML = html;
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
}

function handle(act: string, el: HTMLElement): void {
  const [cmd, a, b] = act.split(':');
  const s = state;
  switch (cmd) {
    case 'go': go(a as Screen); return;
    case 'continue': if (s) { checkRealDay(s); saveGame(s); go('village'); } return;
    case 'new':
      if (state && !ui.confirmNew) { ui.confirmNew = true; render(); return; }
      ui.createName = ''; go('create'); return;
    case 'spec': {
      const input = document.getElementById('name') as HTMLInputElement | null;
      if (input) ui.createName = input.value;
      ui.createSpec = a as SpecialtyId; render(); return;
    }
    case 'create': {
      const name = ((document.getElementById('name') as HTMLInputElement | null)?.value ?? '').trim().slice(0, 20);
      if (!name) { say('Ohne Namen lässt dich der Torwächter nicht ins Dorf.', 'warn'); ui.createName = ''; render(); return; }
      state = newGame(name, ui.createSpec);
      saveGame(state);
      go('village');
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
        if (s.fight && !s.fight.over) s.fight.log.push({ t: 'Du hältst inne. Du bist angeschlagen, entscheide selbst, wie es weitergeht.', k: 'warn' });
      } else {
        fightAction(s, a as FightAction);
      }
      commit();
      return;
    }
    case 'after': {
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
    case 'inn': say(a === 'beer' ? drinkHarzbier(s) : requestSong(s), 'good'); commit(); return;
    case 'bonus': chooseDragonBonus(s, a as DragonBonus); saveGame(s); go('village'); return;
    case 'toggle':
      if (a === 'retro') s.settings.retro = (el as HTMLInputElement).checked;
      if (a === 'motion') s.settings.reducedMotion = (el as HTMLInputElement).checked;
      commit();
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
      navigator.clipboard?.writeText(ta.value).then(
        () => { ui.importMsg = 'Code kopiert.'; render(); },
        () => { ui.importMsg = 'Bitte den Code markieren und selbst kopieren.'; render(); },
      );
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
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkDayTick(); });
  window.setInterval(checkDayTick, 60_000);
  render();
}
