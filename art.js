'use strict';
// Рисованные блюда: SVG собирается из ингредиентов рецепта, поэтому картинка меняется вместе с правками.

// цвет и форма «мазка» для каждого продукта
const ART = {
  chicken_breast: ['#f0d29c', 'blob'], chicken_thigh: ['#dd9a52', 'blob'], turkey: ['#efd3ab', 'blob'], beef: ['#b4694a', 'blob'],
  minced: ['#a8714f', 'crumbs'], ham: ['#f0a6a0', 'slices'], salmon: ['#f5997a', 'blob'], cod: ['#f4ecdc', 'blob'],
  tuna: ['#e6b4a0', 'crumbs'], shrimp: ['#f5a085', 'blob'], egg: ['#fffaf0', 'egg'], tofu: ['#f6efd6', 'cubes'],
  buckwheat: ['#86633f', 'grain'], rice: ['#fffaf0', 'grain'], pasta: ['#f3d67a', 'swirl'], potato: ['#f2da92', 'cubes'],
  bread: ['#e8c685', 'slices'], oats: ['#e7d6b2', 'grain'], lentils: ['#d4803f', 'grain'], chickpeas: ['#e6c374', 'dots'], beans: ['#b04a38', 'dots'],
  tomato: ['#e8523b', 'slices'], cucumber: ['#98d084', 'slices'], carrot: ['#f29536', 'cubes'], onion: ['#e6cdee', 'slices'],
  pepper: ['#f2bd2a', 'cubes'], cabbage: ['#b8de98', 'leafy'], broccoli: ['#4a9650', 'florets'], zucchini: ['#a3cc66', 'slices'],
  eggplant: ['#765596', 'cubes'], mushrooms: ['#d6bd9c', 'slices'], spinach: ['#3d8747', 'leafy'], beet: ['#a22c58', 'cubes'],
  pumpkin: ['#f2a03a', 'cubes'], peas: ['#78bf58', 'dots'], corn: ['#f6d23f', 'dots'], greens: ['#56a64c', 'leafy'],
  lettuce: ['#8acd75', 'leafy'], avocado: ['#b2d566', 'slices'],
  apple: ['#e4655a', 'slices'], banana: ['#f5dd62', 'slices'], orange: ['#f4a032', 'slices'], berries: ['#a9346a', 'dots'],
  lemon: ['#f5e050', 'slices'], raisins: ['#69404a', 'dots'],
  walnut: ['#b78d62', 'dots'], almond: ['#c29668', 'dots'], peanut_butter: ['#c2864a', 'blob'], honey: ['#efb12b', 'blob'],
  greek_yogurt: ['#fffdf4', 'blob'], cottage: ['#fff8e6', 'blob'], cheese: ['#f4cf62', 'cubes'], sour_cream: ['#fffdf4', 'blob'],
  milk: ['#fffdf4', 'blob'], kefir: ['#fffdf4', 'blob']
};
const ART_SKIP = new Set(['oil', 'butter', 'sugar', 'flour', 'soy_sauce', 'tomato_paste', 'garlic']);
const ART_VESSEL = {
  r1: 'porridge', r3: 'yogurt', r4: 'porridge', r7: 'yogurt', r31: 'yogurt', r15: 'soup', r16: 'soup', r17: 'soup', r24: 'soup',
  r23: 'salad', r28: 'salad', r33: 'salad', r30: 'glass', r5: 'toast', r9: 'toast', r32: 'toast'
};
const BASE_ING = new Set(['oats', 'buckwheat', 'milk', 'kefir', 'greek_yogurt', 'cottage']);

let artSeq = 0;
const hashStr = s => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
const rng = seed => { let s = seed || 1; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; };
const f1 = n => Math.round(n * 10) / 10;

// замкнутая плавная кривая по точкам
function smooth(pts) {
  const n = pts.length, mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  let d = 'M' + mid(pts[0], pts[1]).map(f1).join(' ');
  for (let i = 1; i <= n; i++) {
    const p = pts[i % n], q = mid(p, pts[(i + 1) % n]);
    d += ` Q${f1(p[0])} ${f1(p[1])} ${f1(q[0])} ${f1(q[1])}`;
  }
  return d + 'Z';
}
const blobPath = (x, y, rx, ry, R, k = 0.3) => {
  const pts = [];
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, j = 1 - k / 2 + R() * k; pts.push([x + Math.cos(a) * rx * j, y + Math.sin(a) * ry * j]); }
  return smooth(pts);
};
const shine = (x, y, r) => `<ellipse cx="${f1(x - r * .25)}" cy="${f1(y - r * .3)}" rx="${f1(r * .45)}" ry="${f1(r * .22)}" fill="#fff" opacity=".4"/>`;

const SHAPES = {
  blob: (x, y, r, c, R) => `<path class="ol" d="${blobPath(x, y, r * 1.15, r * .8, R)}" fill="${c}"/>` + shine(x, y, r),
  egg: (x, y, r, c, R) => `<path class="ol" d="${blobPath(x, y, r * 1.2, r * .85, R, .25)}" fill="${c}"/><circle class="ol" cx="${f1(x + r * .1)}" cy="${f1(y)}" r="${f1(r * .38)}" fill="#f6b733"/>` + shine(x + r * .1, y, r * .4),
  slices: (x, y, r, c, R) => [[-.5, .1], [.45, -.2], [.05, .55]].map(([dx, dy]) =>
    `<circle class="ol" cx="${f1(x + dx * r)}" cy="${f1(y + dy * r)}" r="${f1(r * .56)}" fill="${c}"/><circle cx="${f1(x + dx * r)}" cy="${f1(y + dy * r)}" r="${f1(r * .32)}" fill="#fff" opacity=".35"/>`).join(''),
  cubes: (x, y, r, c, R) => [[-.5, .1], [.4, -.25], [.15, .5], [.5, .3]].map(([dx, dy]) => {
    const s = r * (.55 + R() * .15), rot = Math.round(R() * 60 - 30);
    return `<rect class="ol" x="${f1(x + dx * r - s / 2)}" y="${f1(y + dy * r - s / 2)}" width="${f1(s)}" height="${f1(s)}" rx="${f1(s * .22)}" fill="${c}" transform="rotate(${rot} ${f1(x + dx * r)} ${f1(y + dy * r)})"/>`;
  }).join(''),
  grain: (x, y, r, c, R) => {
    let s = `<path class="ol" d="${blobPath(x, y + r * .1, r * 1.2, r * .75, R, .2)}" fill="${c}"/>`;
    for (let i = 0; i < 12; i++) {
      const a = R() * Math.PI * 2, d = R() * r * .75;
      s += `<ellipse cx="${f1(x + Math.cos(a) * d)}" cy="${f1(y + r * .1 + Math.sin(a) * d * .6)}" rx="1.5" ry=".8" fill="#000" opacity=".16" transform="rotate(${Math.round(R() * 180)} ${f1(x + Math.cos(a) * d)} ${f1(y + Math.sin(a) * d * .6)})"/>`;
    }
    return s + shine(x, y, r);
  },
  florets: (x, y, r, c, R) => `<rect x="${f1(x - r * .12)}" y="${f1(y)}" width="${f1(r * .24)}" height="${f1(r * .75)}" rx="2" fill="#a9d28a" class="ol"/>` +
    [[-.5, -.1, .5], [.5, -.1, .5], [0, -.5, .55], [0, .05, .5]].map(([dx, dy, k]) =>
      `<circle class="ol" cx="${f1(x + dx * r)}" cy="${f1(y + dy * r)}" r="${f1(r * k)}" fill="${c}"/>`).join('') +
    [[-.4, -.3], [.35, -.55], [.1, .1]].map(([dx, dy]) => `<circle cx="${f1(x + dx * r)}" cy="${f1(y + dy * r)}" r="${f1(r * .14)}" fill="#fff" opacity=".28"/>`).join(''),
  leafy: (x, y, r, c, R) => [-42, 0, 42].map(a =>
    `<g transform="rotate(${a} ${f1(x)} ${f1(y + r * .6)})"><ellipse class="ol" cx="${f1(x)}" cy="${f1(y)}" rx="${f1(r * .38)}" ry="${f1(r * .8)}" fill="${c}"/><path d="M${f1(x)} ${f1(y - r * .6)}V${f1(y + r * .6)}" stroke="#fff" stroke-width=".8" opacity=".5" fill="none"/></g>`).join(''),
  dots: (x, y, r, c, R) => Array.from({ length: 7 }, () => {
    const a = R() * Math.PI * 2, d = Math.sqrt(R()) * r * .9;
    return `<circle class="ol" cx="${f1(x + Math.cos(a) * d)}" cy="${f1(y + Math.sin(a) * d * .75)}" r="${f1(r * .27)}" fill="${c}"/>`;
  }).join(''),
  swirl: (x, y, r, c, R) => `<path class="ol" d="${blobPath(x, y, r * 1.2, r * .8, R, .2)}" fill="${c}"/>` +
    `<path d="M${f1(x - r * .8)} ${f1(y)}q${f1(r * .4)} ${f1(-r * .5)} ${f1(r * .8)} 0t${f1(r * .8)} 0" stroke="#c99a2e" stroke-width="1" fill="none"/>` +
    `<path d="M${f1(x - r * .7)} ${f1(y + r * .3)}q${f1(r * .4)} ${f1(-r * .5)} ${f1(r * .7)} 0t${f1(r * .7)} 0" stroke="#c99a2e" stroke-width="1" fill="none"/>`,
  crumbs: (x, y, r, c, R) => Array.from({ length: 8 }, () => {
    const a = R() * Math.PI * 2, d = Math.sqrt(R()) * r * .9;
    return `<path class="ol" d="${blobPath(x + Math.cos(a) * d, y + Math.sin(a) * d * .7, r * .3, r * .24, R, .5)}" fill="${c}"/>`;
  }).join('')
};

const SLOT_XY = {
  plate: [[], [[50, 56]], [[36, 56], [64, 56]], [[35, 52], [65, 52], [50, 68]], [[34, 52], [66, 52], [38, 68], [62, 68]]],
  bowl: [[], [[50, 40]], [[37, 40], [63, 40]], [[33, 41], [67, 41], [50, 35]], [[32, 41], [68, 41], [44, 34], [56, 45]]],
  toast: [[], [[50, 52]], [[40, 50], [62, 56]], [[38, 44], [62, 48], [50, 66]], [[38, 42], [62, 44], [40, 64], [62, 66]]],
  glass: [[], [[50, 24]], [[44, 24], [58, 22]], [[40, 24], [60, 22], [50, 18]], [[40, 24], [60, 22], [50, 18], [50, 28]]]
};

function dishArt(r, ings) {
  const id = ++artSeq, R = rng(hashStr(r.id || r.name));
  const vessel = r.vessel || ART_VESSEL[r.id] || 'plate';
  const sum = {};
  ings.forEach(([i, g]) => { if (ART[i] && !ART_SKIP.has(i)) sum[i] = (sum[i] || 0) + g; });
  let items = Object.entries(sum).sort((a, b) => b[1] - a[1]);
  const isBase = i => BASE_ING.has(i);
  let base = null;
  if (vessel === 'porridge' || vessel === 'yogurt' || vessel === 'glass') {
    const b = items.find(([i]) => isBase(i)); if (b) base = b[0];
    items = items.filter(([i]) => i !== base);
  }
  items = items.filter(([, g]) => g >= 12).slice(0, vessel === 'glass' ? 2 : 4);
  const tot = items.reduce((a, [, g]) => a + Math.sqrt(g), 0) || 1;
  const radius = (g, k) => Math.max(8, Math.min(18, 8 + 12 * Math.sqrt(g) / tot * (items.length > 2 ? 1.2 : 1.6))) * k;

  let s = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${r.name}">`;
  s += `<defs><filter id="ws${id}" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".05" numOctaves="2" seed="${hashStr(r.id || '') % 9}"/><feDisplacementMap in="SourceGraphic" scale="1.6"/></filter></defs><g filter="url(#ws${id})">`;
  const draw = (k, list, scale) => list.map(([i, g], n) => {
    const [x, y] = SLOT_XY[k][list.length][n], [c, shape] = ART[i];
    return SHAPES[shape](x, y, radius(g, scale), c, R);
  }).join('');

  if (vessel === 'plate') {
    s += `<ellipse cx="50" cy="62" rx="45" ry="31" fill="#000" opacity=".08"/><ellipse class="ol" cx="50" cy="58" rx="45" ry="31" fill="#fffdf7"/><ellipse cx="50" cy="58" rx="35" ry="22" fill="none" stroke="#7fb6d6" stroke-width="1.2" opacity=".6"/>`;
    s += draw('plate', items, 1);
  } else if (vessel === 'glass') {
    const tint = base === 'kefir' || base === 'milk' ? '#fffaf0' : '#f6f0d8';
    const hasBerry = items.some(([i]) => i === 'berries');
    s += `<path d="M28 20H72L65 88Q50 95 35 88Z" fill="#e9f5fb" class="ol"/><path d="M30 34H70L65 88Q50 95 35 88Z" fill="${hasBerry ? '#f2b5cf' : tint}" class="ol"/>`;
    s += `<path d="M62 8L57 34" stroke="#e8523b" stroke-width="3" stroke-linecap="round" fill="none"/>`;
    s += draw('glass', items.slice(0, 2), .9);
    s += `<path d="M34 44V80" stroke="#fff" stroke-width="3" opacity=".5" stroke-linecap="round"/>`;
  } else if (vessel === 'toast') {
    s += `<ellipse cx="50" cy="90" rx="38" ry="5" fill="#000" opacity=".08"/><path class="ol" d="M20 40Q18 14 50 14Q82 14 80 40V80Q80 87 73 87H27Q20 87 20 80Z" fill="#efd29a"/><path d="M26 42Q25 20 50 20Q75 20 74 42V78Q74 82 70 82H30Q26 82 26 78Z" fill="#f8e6bd"/>`;
    s += draw('toast', items.filter(([i]) => i !== 'bread'), 1.1);
  } else { // bowl: soup, porridge, yogurt, salad
    const baseCol = vessel === 'soup'
      ? (items.some(([i]) => ['tomato', 'beet', 'tomato_paste'].includes(i)) ? '#e5694a' : items.some(([i]) => i === 'mushrooms') ? '#e6d6bb' : '#f0c366')
      : vessel === 'porridge' ? (base === 'buckwheat' ? '#9a7550' : '#eadcc0')
      : vessel === 'yogurt' ? '#fffdf4' : '#d9ecbb';
    s += `<path class="ol" d="M8 40Q10 94 50 95Q90 94 92 40Z" fill="#f4efe3"/><path d="M14 60Q50 72 86 60" stroke="#7fb6d6" stroke-width="2" fill="none" opacity=".7"/><path d="M12 70Q50 84 88 70" stroke="#7fb6d6" stroke-width="1.2" fill="none" opacity=".5"/>`;
    s += `<ellipse class="ol" cx="50" cy="40" rx="42" ry="11" fill="#fffdf7"/><ellipse cx="50" cy="41" rx="37" ry="8.5" fill="${baseCol}"/>`;
    if (vessel === 'soup') s += `<g class="steam"><path d="M38 24q-5-6 0-11t0-9" stroke="#9db4c4" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M58 22q-5-6 0-11t0-9" stroke="#9db4c4" stroke-width="2" fill="none" stroke-linecap="round"/></g>`;
    s += draw('bowl', items, vessel === 'soup' ? .62 : .78);
  }
  return s + '</g></svg>';
}
const artHtml = (r, ings) => `<div class="art">${dishArt(r, ings)}</div>`;
