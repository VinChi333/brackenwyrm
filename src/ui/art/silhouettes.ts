// Scherenschnitt-Figuren als Vektorgrafik. Jede Figur steht mit den Füßen auf (0,0)
// und schaut nach LINKS. Gezeichnet wird mit der aktuellen Füllfarbe (currentColor),
// Augen bekommen ihre eigene Leuchtfarbe. Vektoren bleiben auf jedem Bildschirm scharf.

import type { PropId, ShapeId } from '../../game/types';

const eye = (x: number, y: number, c: string, r = 4) =>
  `<circle cx="${x}" cy="${y}" r="${r * 2.6}" fill="${c}" opacity="0.22"/><circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`;

/** Requisit in der vorderen Hand. Hand liegt bei (hx, hy). */
export function prop(id: PropId, hx: number, hy: number): string {
  switch (id) {
    case 'sword':
      return `<g transform="translate(${hx} ${hy}) rotate(-35)">
        <rect x="-3" y="-118" width="10" height="112" rx="2"/><polygon points="-3,-118 2,-134 7,-118"/>
        <rect x="-14" y="-8" width="32" height="8" rx="3"/><rect x="-1" y="0" width="6" height="18" rx="2"/></g>`;
    case 'axe':
      return `<g transform="translate(${hx} ${hy}) rotate(-25)">
        <rect x="-3" y="-112" width="8" height="132" rx="3"/>
        <path d="M5 -112 Q-34 -112 -40 -84 Q-30 -64 5 -72 Z"/></g>`;
    case 'bow':
      return `<g transform="translate(${hx} ${hy})">
        <path d="M6 -78 Q-38 0 6 78" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>
        <line x1="6" y1="-78" x2="6" y2="78" stroke="currentColor" stroke-width="1.5"/></g>`;
    case 'hammer':
      return `<g transform="translate(${hx} ${hy}) rotate(-20)">
        <rect x="-3" y="-110" width="8" height="130" rx="3"/><rect x="-26" y="-132" width="54" height="30" rx="4"/></g>`;
    case 'spear':
      return `<g transform="translate(${hx} ${hy}) rotate(-12)">
        <rect x="-2" y="-170" width="6" height="230" rx="2"/><polygon points="-9,-168 1,-206 11,-168"/></g>`;
    case 'staff':
      return `<g transform="translate(${hx} ${hy}) rotate(-8)">
        <rect x="-3" y="-150" width="8" height="215" rx="3"/>
        <ellipse cx="-10" cy="-158" rx="14" ry="7" transform="rotate(-35 -10 -158)"/>
        <ellipse cx="12" cy="-162" rx="14" ry="7" transform="rotate(35 12 -162)"/>
        <ellipse cx="1" cy="-172" rx="7" ry="15"/></g>`;
    case 'daggers':
      return `<g transform="translate(${hx} ${hy}) rotate(-60)">
        <polygon points="-3,0 4,-58 9,0"/><rect x="-6" y="0" width="18" height="6" rx="2"/></g>
        <g transform="translate(${hx + 30} ${hy + 10}) rotate(-20)">
        <polygon points="-3,0 4,-50 9,0"/><rect x="-6" y="0" width="18" height="6" rx="2"/></g>`;
    case 'club':
      return `<g transform="translate(${hx} ${hy}) rotate(-30)">
        <path d="M-4 18 L-8 -60 Q-12 -100 4 -104 Q22 -100 16 -60 L6 18 Z"/>
        <circle cx="-8" cy="-80" r="4"/><circle cx="14" cy="-70" r="4"/></g>`;
    default:
      return '';
  }
}

/** Menschliche Gestalt (Held, Meister, Räuber). size ~ 1 = 200 Einheiten hoch. */
export function humanoid(p: PropId, eyes: string | null, opts: { hood?: boolean; cape?: boolean; shield?: boolean } = {}): string {
  const head = opts.hood
    ? `<path d="M-22 -166 Q-26 -198 2 -214 Q12 -206 18 -196 Q24 -180 20 -166 Q12 -156 -2 -155 Q-16 -157 -22 -166 Z"/><path d="M16 -196 Q34 -170 28 -150 L18 -152 Z"/>`
    : `<circle cx="-2" cy="-178" r="16"/><path d="M-14 -186 Q-4 -200 12 -188 Q16 -176 10 -170 Q4 -184 -14 -186 Z"/><rect x="-7" y="-166" width="12" height="12"/>`;
  const cape = opts.cape ? `<path d="M14 -152 Q46 -110 44 -8 L22 -10 Q30 -90 8 -150 Z"/>` : '';
  const shield = opts.shield ? `<path d="M20 -140 L52 -134 Q54 -96 34 -78 Q14 -96 20 -140 Z"/>` : '';
  return `${cape}
    <path d="M-27 -156 Q-31 -146 -28 -128 L-19 -98 L19 -98 L28 -128 Q31 -146 27 -156 Q0 -164 -27 -156 Z"/>
    <path d="M-21 -100 L21 -100 L33 -64 Q0 -58 -33 -64 Z"/>
    <path d="M-20 -68 L-6 -68 L-15 -6 L-31 -6 Z"/><path d="M6 -68 L20 -68 L30 -6 L14 -6 Z"/>
    <path d="M-36 -10 Q-34 -1 -12 0 L-12 -10 Z"/><path d="M10 -10 L10 0 Q32 -1 34 -8 Z"/>
    <path d="M22 -152 Q38 -130 32 -100 L23 -98 Q26 -124 14 -144 Z"/>
    ${shield}
    <path d="M-22 -152 Q-42 -134 -50 -110 L-41 -104 Q-30 -124 -12 -142 Z"/>
    <circle cx="-46" cy="-106" r="8"/>
    <rect x="-22" y="-104" width="44" height="7" fill="#3a2214" opacity="0.6"/>
    ${head}
    ${prop(p, -46, -106)}
    ${eyes ? eye(-8, -178, eyes, 2.5) : ''}`;
}

function wolf(e: string): string {
  return `<path d="M96 -96 Q150 -118 152 -82 Q126 -100 92 -80 Z"/>
    <ellipse cx="22" cy="-86" rx="84" ry="38"/>
    <polygon points="-30,-118 -18,-136 -6,-120 8,-138 20,-120 34,-140 46,-120 60,-134 72,-116 86,-126 92,-104"/>
    <rect x="-40" y="-64" width="14" height="64" rx="5"/><rect x="-14" y="-62" width="14" height="62" rx="5"/>
    <rect x="58" y="-64" width="14" height="64" rx="5"/><rect x="82" y="-66" width="14" height="66" rx="5"/>
    <path d="M-30 -110 Q-50 -128 -70 -124 L-56 -84 Q-40 -82 -24 -78 Z"/>
    <circle cx="-62" cy="-112" r="28"/>
    <polygon points="-82,-124 -126,-104 -122,-94 -84,-90"/>
    <polygon points="-76,-134 -70,-166 -58,-136"/><polygon points="-56,-136 -44,-164 -38,-130"/>
    ${eye(-70, -116, e)}
    <path d="M-120 -96 L-114 -88 L-108 -96 L-102 -88 L-96 -96" fill="none" stroke="#efe3c8" stroke-width="2.5" opacity="0.8"/>`;
}

function rat(e: string): string {
  return `<path d="M60 -26 Q120 -40 150 -8 Q160 4 150 2 Q122 -24 62 -14 Z"/>
    <ellipse cx="12" cy="-36" rx="58" ry="30"/>
    <polygon points="-36,-56 -92,-30 -36,-14"/>
    <circle cx="-32" cy="-62" r="14"/>
    <rect x="-22" y="-14" width="10" height="14" rx="3"/><rect x="36" y="-14" width="10" height="14" rx="3"/>
    ${eye(-58, -40, e, 3.5)}
    <path d="M-92 -30 l-14 -6 M-92 -30 l-14 4" stroke="currentColor" stroke-width="1.5"/>`;
}

function bat(e: string): string {
  return `<g transform="translate(0 -150)">
    <path d="M-14 -10 Q-60 -64 -140 -46 Q-120 -30 -118 -10 Q-96 -22 -86 -2 Q-66 -18 -54 4 Q-36 -12 -16 12 Z"/>
    <path d="M14 -10 Q60 -64 140 -46 Q120 -30 118 -10 Q96 -22 86 -2 Q66 -18 54 4 Q36 -12 16 12 Z"/>
    <ellipse cx="0" cy="0" rx="22" ry="32"/>
    <polygon points="-16,-26 -12,-50 -4,-28"/><polygon points="4,-28 12,-50 16,-26"/>
    ${eye(-8, -12, e, 3)}${eye(8, -12, e, 3)}</g>`;
}

function goblin(p: PropId, e: string): string {
  return `<path d="M-26 -96 Q0 -108 26 -96 L32 -40 Q0 -30 -32 -40 Z"/>
    <path d="M-24 -44 L-8 -44 L-10 -2 L-28 -2 Z"/><path d="M8 -44 L24 -44 L28 -2 L10 -2 Z"/>
    <rect x="-34" y="-8" width="26" height="8" rx="3"/><rect x="8" y="-8" width="24" height="8" rx="3"/>
    <path d="M-20 -90 Q-46 -80 -52 -60 L-42 -56 Q-34 -72 -14 -80 Z"/><circle cx="-48" cy="-58" r="7"/>
    <circle cx="-4" cy="-118" r="24"/>
    <polygon points="-24,-126 -66,-146 -26,-108"/><polygon points="16,-128 50,-150 22,-110"/>
    <polygon points="-24,-112 -40,-104 -22,-100"/>
    ${prop(p, -48, -58)}
    ${eye(-16, -122, e, 3.5)}${eye(2, -122, e, 3.5)}`;
}

function beetle(e: string): string {
  const legs = [-40, 0, 40].map((x) =>
    `<path d="M${x} -40 L${x - 20} -24 L${x - 28} 0" fill="none" stroke="currentColor" stroke-width="7" stroke-linejoin="round"/>`).join('');
  return `${legs}
    <ellipse cx="14" cy="-48" rx="78" ry="42"/>
    <line x1="14" y1="-88" x2="40" y2="-12" stroke="#efe3c8" stroke-width="2" opacity="0.5"/>
    <circle cx="-66" cy="-42" r="22"/>
    <path d="M-80 -52 Q-112 -70 -128 -52 Q-110 -58 -92 -44 Z"/>
    <path d="M-82 -32 Q-114 -20 -126 -36 Q-108 -32 -88 -26 Z"/>
    <path d="M-60 -60 Q-70 -96 -40 -110 Q-54 -88 -46 -64 Z"/>
    ${eye(-74, -46, e, 3.5)}`;
}

function blob(e: string): string {
  return `<path d="M-92 0 Q-104 -72 -60 -104 Q0 -138 58 -104 Q102 -74 92 0 Q76 -10 66 0 Q50 -14 36 0 Q14 -12 0 0 Q-20 -14 -36 0 Q-56 -12 -70 0 Q-82 -10 -92 0 Z"/>
    <circle cx="-38" cy="-118" r="10"/><circle cx="26" cy="-128" r="7"/><circle cx="62" cy="-112" r="6"/>
    ${eye(-34, -70, e, 5)}${eye(10, -74, e, 5)}`;
}

function bird(e: string): string {
  return `<g transform="translate(0 -150)">
    <path d="M10 -6 Q40 -90 120 -110 Q90 -60 96 -20 Q60 -30 30 4 Z"/>
    <path d="M-4 -6 Q-10 -70 30 -120 Q34 -60 20 -10 Z"/>
    <ellipse cx="6" cy="0" rx="44" ry="24" transform="rotate(-12 6 0)"/>
    <path d="M40 4 L96 24 L88 6 L104 2 Z"/>
    <circle cx="-38" cy="-16" r="18"/>
    <polygon points="-52,-20 -86,-10 -52,-6"/>
    <path d="M-10 18 L-16 40 M8 18 L6 40" stroke="currentColor" stroke-width="5"/>
    ${eye(-44, -20, e, 3.2)}</g>`;
}

function boar(e: string): string {
  return `<ellipse cx="14" cy="-72" rx="88" ry="46"/>
    <polygon points="-40,-112 -28,-126 -16,-112 -2,-128 10,-112 24,-128 36,-112 50,-126 62,-110 76,-120 86,-102"/>
    <path d="M100 -84 Q118 -96 112 -70" fill="none" stroke="currentColor" stroke-width="5"/>
    <polygon points="-58,-100 -126,-62 -120,-42 -58,-40"/>
    <polygon points="-64,-104 -58,-130 -44,-104"/>
    <rect x="-46" y="-44" width="18" height="44" rx="6"/><rect x="-18" y="-40" width="18" height="40" rx="6"/>
    <rect x="52" y="-40" width="18" height="40" rx="6"/><rect x="78" y="-44" width="18" height="44" rx="6"/>
    <path d="M-104 -50 Q-120 -74 -98 -82" fill="none" stroke="#efe3c8" stroke-width="5" stroke-linecap="round"/>
    ${eye(-78, -82, e, 3.5)}`;
}

function spider(e: string): string {
  const leg = (x1: number, kx: number, ky: number, fx: number) =>
    `<path d="M${x1} -64 Q${kx} ${ky} ${fx} 0" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>`;
  return `${leg(-30, -90, -150, -128)}${leg(-24, -70, -130, -96)}${leg(-14, -40, -120, -62)}${leg(-4, -10, -112, -28)}
    ${leg(10, 40, -130, 30)}${leg(20, 70, -140, 66)}${leg(30, 104, -150, 104)}${leg(40, 140, -140, 140)}
    <ellipse cx="44" cy="-78" rx="56" ry="44"/>
    <circle cx="-24" cy="-64" r="28"/>
    <path d="M-44 -50 Q-58 -36 -50 -24 M-34 -46 Q-40 -30 -30 -22" fill="none" stroke="currentColor" stroke-width="6"/>
    ${eye(-38, -70, e, 3)}${eye(-26, -76, e, 3)}${eye(-30, -60, e, 2.4)}${eye(-16, -68, e, 2.4)}`;
}

function ghost(e: string): string {
  return `<g opacity="0.88">
    <path d="M-44 -150 Q-48 -206 0 -210 Q48 -206 44 -150 L50 -80 Q58 -40 40 -20 Q28 -40 20 -14 Q8 -36 -6 -10 Q-18 -34 -30 -16 Q-44 -40 -50 -20 Q-60 -50 -50 -90 Z"/>
    <path d="M-40 -130 Q-80 -120 -100 -90 Q-76 -104 -46 -104 Z"/>
    <path d="M40 -130 Q76 -110 84 -76 Q64 -100 44 -104 Z"/></g>
    ${eye(-18, -168, e, 5)}${eye(12, -168, e, 5)}
    <ellipse cx="-4" cy="-138" rx="8" ry="11" fill="${e}" opacity="0.35"/>`;
}

function serpent(e: string): string {
  return `<path d="M120 -6 Q60 -10 30 -24 Q-10 -44 20 -78 Q60 -112 20 -140 Q-6 -158 -34 -150"
      fill="none" stroke="currentColor" stroke-width="34" stroke-linecap="round"/>
    <polygon points="0,-176 -10,-196 -18,-168"/><polygon points="16,-158 14,-182 0,-160"/>
    <path d="M-30 -166 Q-58 -172 -84 -160 Q-92 -150 -82 -144 Q-56 -140 -30 -134 Z"/>
    <path d="M-84 -150 L-104 -154 M-104 -154 l-8 -6 M-104 -154 l-8 6" fill="none" stroke="#a8321e" stroke-width="2.5"/>
    ${eye(-58, -158, e, 4)}`;
}

function bear(e: string): string {
  return `<path d="M-64 -112 Q-30 -150 40 -146 Q110 -138 116 -70 Q116 -30 98 -20 L-60 -20 Q-90 -60 -64 -112 Z"/>
    <rect x="-56" y="-48" width="26" height="48" rx="9"/><rect x="-22" y="-44" width="24" height="44" rx="9"/>
    <rect x="62" y="-44" width="24" height="44" rx="9"/><rect x="90" y="-50" width="26" height="50" rx="9"/>
    <circle cx="-78" cy="-108" r="34"/>
    <ellipse cx="-110" cy="-98" rx="20" ry="14"/>
    <circle cx="-86" cy="-140" r="10"/><circle cx="-62" cy="-138" r="10"/>
    ${eye(-88, -114, e, 3.8)}`;
}

function troll(p: PropId, e: string): string {
  return `<path d="M-56 -200 Q-10 -232 44 -204 Q70 -170 60 -110 L46 -96 L-46 -96 Q-70 -150 -56 -200 Z"/>
    <path d="M-40 -100 L-6 -100 L-10 -4 L-46 -4 Z"/><path d="M6 -100 L40 -100 L46 -4 L10 -4 Z"/>
    <rect x="-54" y="-10" width="46" height="10" rx="4"/><rect x="8" y="-10" width="44" height="10" rx="4"/>
    <path d="M-48 -196 Q-90 -150 -82 -76 L-62 -74 Q-66 -140 -34 -182 Z"/><circle cx="-72" cy="-70" r="14"/>
    <path d="M44 -196 Q78 -150 70 -84 L54 -84 Q58 -140 34 -180 Z"/>
    <circle cx="-26" cy="-216" r="22"/>
    <polygon points="-44,-226 -54,-236 -40,-232"/>
    ${prop(p === 'none' ? 'club' : p, -72, -70)}
    ${eye(-36, -220, e, 3.4)}${eye(-20, -220, e, 3.4)}`;
}

function stag(e: string): string {
  const antler = `<g fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round">
      <path d="M-62 -206 Q-70 -250 -50 -282"/><path d="M-66 -236 Q-90 -250 -96 -270"/><path d="M-58 -260 Q-36 -268 -30 -288"/>
      <path d="M-50 -206 Q-30 -240 -6 -256"/><path d="M-36 -230 Q-20 -228 -8 -238"/></g>`;
  return `<path d="M88 -138 Q104 -146 100 -124 Z"/>
    <ellipse cx="22" cy="-124" rx="74" ry="32"/>
    <rect x="-36" y="-104" width="10" height="104" rx="4"/><rect x="-16" y="-100" width="10" height="100" rx="4"/>
    <rect x="58" y="-104" width="10" height="104" rx="4"/><rect x="78" y="-100" width="10" height="100" rx="4"/>
    <path d="M-40 -146 Q-60 -170 -56 -200 L-36 -198 Q-34 -168 -10 -142 Z"/>
    <path d="M-36 -208 Q-56 -214 -96 -196 Q-100 -186 -90 -184 Q-60 -182 -36 -186 Z"/>
    <polygon points="-44,-212 -30,-226 -32,-206"/>
    ${antler}
    ${eye(-62, -200, e, 3.4)}`;
}

function horse(e: string): string {
  return `<path d="M92 -140 Q130 -120 118 -60 Q112 -90 94 -112 Z"/>
    <ellipse cx="22" cy="-124" rx="76" ry="34"/>
    <rect x="-38" y="-104" width="11" height="104" rx="4"/><rect x="-16" y="-100" width="11" height="100" rx="4"/>
    <rect x="58" y="-104" width="11" height="104" rx="4"/><rect x="80" y="-100" width="11" height="100" rx="4"/>
    <path d="M-42 -146 Q-62 -176 -58 -212 L-34 -208 Q-32 -170 -6 -142 Z"/>
    <path d="M-40 -214 Q-62 -222 -104 -196 Q-110 -184 -98 -180 Q-66 -184 -36 -190 Z"/>
    <polygon points="-48,-218 -40,-238 -34,-214"/>
    <path d="M-34 -212 Q-14 -196 -16 -150 Q-24 -176 -40 -196 Z"/>
    ${eye(-66, -206, e, 3.4)}`;
}

function treant(e: string): string {
  return `<path d="M-70 0 Q-50 -10 -42 -40 L-40 -150 L40 -150 L42 -40 Q50 -10 74 0 Q40 -4 24 -18 L20 0 L-20 0 L-24 -18 Q-40 -4 -70 0 Z"/>
    <path d="M-40 -130 Q-80 -140 -110 -110 Q-116 -96 -100 -98 Q-80 -116 -42 -112 Z"/>
    <path d="M-106 -104 l-18 6 M-104 -100 l-10 16" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>
    <path d="M40 -136 Q80 -160 106 -190 Q112 -178 98 -170 Q72 -140 42 -116 Z"/>
    <circle cx="-30" cy="-200" r="46"/><circle cx="30" cy="-210" r="50"/><circle cx="0" cy="-246" r="44"/>
    <circle cx="-62" cy="-176" r="28"/><circle cx="66" cy="-178" r="30"/>
    ${eye(-16, -126, e, 4.5)}${eye(14, -126, e, 4.5)}
    <path d="M-14 -96 Q0 -88 14 -96" fill="none" stroke="${e}" stroke-width="2" opacity="0.5"/>`;
}

function dragon(e: string): string {
  // Der Brackenwyrm: Farnwedel als Kamm, Flügel wie eingerollte Farnblätter.
  const frond = (x: number, y: number, rot: number, len: number) => {
    let leaves = '';
    for (let i = 1; i <= 6; i++) {
      const t = (i / 7) * len;
      const w = (1 - i / 8) * len * 0.32;
      leaves += `<ellipse cx="${-t}" cy="${-w * 0.45}" rx="${w * 0.42}" ry="${w * 0.16}" transform="rotate(-38 ${-t} ${-w * 0.45})"/>`;
      leaves += `<ellipse cx="${-t}" cy="${w * 0.45}" rx="${w * 0.42}" ry="${w * 0.16}" transform="rotate(38 ${-t} ${w * 0.45})"/>`;
    }
    return `<g transform="translate(${x} ${y}) rotate(${rot})"><rect x="${-len}" y="-2" width="${len}" height="4"/>${leaves}</g>`;
  };
  return `
    <path d="M40 -180 Q60 -330 150 -400 Q170 -330 230 -350 Q210 -290 270 -280 Q220 -230 250 -190 Q170 -200 120 -160 Z"/>
    <path d="M300 -40 Q380 -60 420 -20 Q440 0 470 -6 Q420 30 360 0 Q320 -16 280 -6 Z"/>
    <ellipse cx="120" cy="-90" rx="190" ry="78"/>
    <polygon points="-10,-162 10,-190 26,-160 46,-192 62,-160 84,-190 98,-158 122,-186 134,-154 160,-178 168,-148"/>
    <path d="M-60 -60 L-40 -60 L-50 -10 L-80 -2 L-96 -4 L-66 -16 Z"/>
    <path d="M200 -60 L236 -60 L240 -8 L206 -2 L190 -4 L214 -14 Z"/>
    <path d="M-40 -130 Q-120 -170 -150 -270 Q-160 -310 -190 -320 L-210 -300 Q-190 -260 -170 -220 Q-130 -130 -30 -60 Z"/>
    <path d="M-176 -330 Q-240 -334 -300 -300 Q-310 -284 -296 -278 Q-246 -282 -210 -276 Q-180 -280 -166 -294 Z"/>
    <path d="M-300 -292 l-14 -4 M-300 -284 l-12 6" stroke="currentColor" stroke-width="4"/>
    <polygon points="-196,-332 -168,-376 -176,-330"/><polygon points="-178,-326 -138,-358 -156,-318"/>
    ${frond(-166, -330, 135, 130)}${frond(-150, -300, 160, 120)}${frond(-128, -250, 175, 110)}${frond(-104, -196, 190, 100)}
    <path d="M-296 -282 Q-268 -276 -240 -282" fill="none" stroke="#efe3c8" stroke-width="2" opacity="0.6"/>
    ${eye(-232, -306, e, 6)}`;
}

/** Gegner-Silhouette nach Form. */
export function creature(shape: ShapeId, eyes: string, p: PropId = 'none'): string {
  switch (shape) {
    case 'wolf': return wolf(eyes);
    case 'rat': return rat(eyes);
    case 'bat': return bat(eyes);
    case 'goblin': return goblin(p, eyes);
    case 'beetle': return beetle(eyes);
    case 'blob': return blob(eyes);
    case 'bird': return bird(eyes);
    case 'humanoid': return humanoid(p, eyes, { hood: p === 'bow' || p === 'daggers' || p === 'staff', cape: p === 'sword' });
    case 'boar': return boar(eyes);
    case 'spider': return spider(eyes);
    case 'ghost': return ghost(eyes);
    case 'serpent': return serpent(eyes);
    case 'bear': return bear(eyes);
    case 'troll': return troll(p, eyes);
    case 'stag': return stag(eyes);
    case 'horse': return horse(eyes);
    case 'treant': return treant(eyes);
    case 'dragon': return dragon(eyes);
  }
}
