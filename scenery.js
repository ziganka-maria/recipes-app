'use strict';
// Фон «Мрачной сказки»: сцена строится под пропорции экрана, деревья растут по алгоритму —
// кривые ветки, на концах закручиваются в спирали, как будто нарисованы тушью.

function buildBurtonScene() {
  const box = document.getElementById('scenery-b');
  if (!box) return;
  const H = 800, W = Math.max(360, Math.round(H * window.innerWidth / Math.max(1, window.innerHeight)));
  const R = rng(1313), f = n => Math.round(n * 10) / 10;
  const crowSpots = [];

  // спираль из точки (x, y): r — радиус, dir — направление закрутки
  const spiral = (x, y, r, a0, dir, turns = 1.6) => {
    let d = `M${f(x)} ${f(y)}`;
    const steps = 18;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps, a = a0 + dir * t * turns * Math.PI * 2, rr = r * (1 - t * .85);
      d += `L${f(x + Math.cos(a0) * r * .2 + Math.cos(a) * rr - Math.cos(a0) * r)} ${f(y + Math.sin(a0) * r * .2 + Math.sin(a) * rr - Math.sin(a0) * r)}`;
    }
    return d;
  };
  // дерево: редкие корявые ветки с S-изгибом, на части концов — крупные спирали; out — массив [ширина, путь]
  const branch = (x, y, len, ang, depth, wid, out) => {
    const b1 = (R() - .5) * 1.3, b2 = (R() - .5) * 1.3;
    const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
    const c1x = x + Math.cos(ang + b1) * len * .35, c1y = y + Math.sin(ang + b1) * len * .35;
    const c2x = x + Math.cos(ang - b2) * len * .7, c2y = y + Math.sin(ang - b2) * len * .7;
    out.push([wid, `M${f(x)} ${f(y)}C${f(c1x)} ${f(c1y)} ${f(c2x)} ${f(c2y)} ${f(x2)} ${f(y2)}`]);
    if (depth === 1 && R() < .55) crowSpots.push([x2, y2]);
    if (depth === 0) {
      if (R() < .6) out.push([Math.max(.9, wid * .9), spiral(x2, y2, 6 + R() * 9, ang, R() < .5 ? 1 : -1, 1.3 + R() * .6)]);
      return;
    }
    // иногда ветка просто тянется дальше, не раздваиваясь — так дерево выходит длинным и корявым
    const n = R() < .28 ? 1 : 2;
    for (let i = 0; i < n; i++) {
      const spread = n === 1 ? (R() - .5) * .6 : (i ? 1 : -1) * (.45 + R() * .5);
      branch(x2, y2, len * (n === 1 ? .9 : .74 + R() * .1), ang + spread, depth - 1, Math.max(.8, wid * (n === 1 ? .8 : .6)), out);
    }
  };
  const tree = (x, y, h, depth, wid, color, rim) => {
    const out = [];
    // ствол из двух изогнутых частей, потом — ветвление
    let ang = -Math.PI / 2 + (R() - .5) * .3, cx = x, cy = y, len = h * .22, w2 = wid;
    for (let k = 0; k < 2; k++) {
      const b = (R() - .5) * .9, nx = cx + Math.cos(ang) * len, ny = cy + Math.sin(ang) * len;
      out.push([w2, `M${f(cx)} ${f(cy)}Q${f(cx + Math.cos(ang + b) * len * .5)} ${f(cy + Math.sin(ang + b) * len * .5)} ${f(nx)} ${f(ny)}`]);
      cx = nx; cy = ny; ang += (R() - .5) * .5; w2 *= .78;
    }
    branch(cx, cy, h * .2, ang - .4, depth, w2 * .75, out);
    branch(cx, cy, h * .22, ang + .35, depth, w2 * .8, out);
    let s = `<path d="M${f(x - wid * 1.6)} ${f(y + 2)}Q${f(x - wid * .4)} ${f(y - h * .12)} ${f(x - wid * .45)} ${f(y - h * .2)}L${f(x + wid * .45)} ${f(y - h * .2)}Q${f(x + wid * .4)} ${f(y - h * .12)} ${f(x + wid * 1.7)} ${f(y + 2)}Z" fill="${color}"/>`;
    if (rim) s += out.map(([w, d]) => `<path d="${d}" stroke="${rim}" stroke-width="${f(w + 1.6)}"/>`).join('');
    s += out.map(([w, d]) => `<path d="${d}" stroke="${color}" stroke-width="${f(w)}"/>`).join('');
    return s;
  };
  // ворона сидит на ветке: спина, голова с клювом, хвост, лапки
  const crow = (x, y, s, flip) => `<g transform="translate(${f(x)} ${f(y)}) scale(${flip ? -s : s} ${s})" fill="#0b0a0e">
    <path d="M-9 2Q-6 -6 3 -6L6 -9Q9 -12 12 -10L17 -9L12 -7Q12 -2 8 1Q4 6 -3 5L-13 9L-10 3Z"/>
    <circle cx="9.5" cy="-9" r=".8" fill="#d9d2c4"/>
    <path d="M0 5l-1 5M3 5l1 5" stroke="#0b0a0e" stroke-width="1"/></g>`;
  const bat = (x, y, s, cls) => `<g transform="translate(${f(x)} ${f(y)}) scale(${s})"><g class="bat ${cls}"><path class="wing" d="M0 0q6-8 12-2q4-6 6 0q2-6 6 0q6-6 12 2q-8-2-12 4q-4-3-6 0q-2-3-6 0q-4-6-12-4Z" fill="#100d14"/></g></g>`;

  let s = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg" fill="none" stroke-linecap="round" stroke-linejoin="round">
  <defs>
    <radialGradient id="moonshade" cx=".35" cy=".35" r=".8"><stop offset=".55" stop-color="#ece5d3" stop-opacity="0"/><stop offset="1" stop-color="#8f86a0" stop-opacity=".6"/></radialGradient>
    <radialGradient id="moonglow"><stop offset="0" stop-color="#ece5d3" stop-opacity=".22"/><stop offset="1" stop-color="#ece5d3" stop-opacity="0"/></radialGradient>
    <radialGradient id="winglow"><stop offset="0" stop-color="#f0c96a" stop-opacity=".55"/><stop offset="1" stop-color="#f0c96a" stop-opacity="0"/></radialGradient>
    <filter id="inkw" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".025" numOctaves="2" seed="5"/><feDisplacementMap in="SourceGraphic" scale="3"/></filter>
  </defs>`;

  // звёзды
  s += '<g fill="#d9d2c4">';
  for (let i = 0; i < Math.round(W / 14); i++) s += `<circle cx="${f(R() * W)}" cy="${f(R() * 380)}" r="${f(.5 + R() * 1.1)}" opacity="${f(.35 + R() * .6)}"/>`;
  s += '</g>';

  // луна со свечением и спиральное облако поперёк неё
  const mx = W > 700 ? W * .78 : W - 120, my = 112;
  s += `<circle cx="${f(mx)}" cy="${my}" r="120" fill="url(#moonglow)"/><circle cx="${f(mx)}" cy="${my}" r="52" fill="#ece5d3"/><circle cx="${f(mx)}" cy="${my}" r="52" fill="url(#moonshade)"/>
    <circle cx="${f(mx - 16)}" cy="${my - 12}" r="7" fill="#d6cdbb"/><circle cx="${f(mx + 14)}" cy="${my + 18}" r="5" fill="#d6cdbb"/><circle cx="${f(mx + 8)}" cy="${my - 22}" r="3" fill="#d6cdbb"/>`;

  // закрученные облака
  const cloud = (x, y, w2, sc) => `<path d="M${f(x)} ${f(y)}q${f(w2 * .25)} ${f(-14 * sc)} ${f(w2 * .5)} 0t${f(w2 * .5)} 0${spiral(x + w2, y, 9 * sc, 0, -1).replace(/^M[^L]+/, '')}" stroke="#cfc6d8" stroke-width="${f(1.4 * sc)}" opacity=".35"/>`;
  s += `<g class="drift">${cloud(W * .08, 150, W * .3, 1)}${cloud(W * .45, 64, W * .22, .8)}${cloud(mx - 120, my + 26, 200, 1.1)}${cloud(W * .2, 300, W * .25, .7)}</g>`;

  // дальний холм с кривым домом
  s += `<path d="M0 ${560}Q${f(W * .25)} 520 ${f(W * .5)} 548T${W} 530V${H}H0Z" fill="#2a2633"/>`;
  const hx = W * .6, hy = 548;
  s += `<g transform="translate(${f(hx)} ${hy}) scale(1.45) translate(${f(-hx)} ${-hy}) rotate(-7 ${f(hx)} ${hy})" fill="#141218">
    <path d="M${f(hx - 22)} ${hy}V${hy - 56}L${f(hx - 8)} ${hy - 82}L${f(hx + 4)} ${hy - 58}V${hy}Z"/>
    <path d="M${f(hx + 2)} ${hy}V${hy - 40}L${f(hx + 16)} ${hy - 64}Q${f(hx + 22)} ${hy - 76} ${f(hx + 30)} ${hy - 72}Q${f(hx + 22)} ${hy - 70} ${f(hx + 28)} ${hy - 44}V${hy}Z"/>
    <path d="M${f(hx - 30)} ${hy}V${hy - 30}L${f(hx - 22)} ${hy - 40}V${hy}Z"/>
    <path d="M${f(hx - 8)} ${hy - 82}q-2 -10 4 -16q-6 2 -8 -4" stroke="#141218" stroke-width="1.5"/>`;
  // окна внутри той же группы, чтобы сдвигались и наклонялись вместе с домом
  [[hx - 13, hy - 50], [hx + 14, hy - 34], [hx - 12, hy - 26]].forEach(([x, y], i) => {
    s += `<circle cx="${f(x)}" cy="${f(y)}" r="12" fill="url(#winglow)"/><rect x="${f(x - 3)}" y="${f(y - 4)}" width="6" height="${i === 1 ? 9 : 7}" rx="1" fill="#f0c96a" class="win w${i}"/>`;
  });
  s += '</g>';

  // дальние деревья по гребню
  s += '<g>';
  for (let x = 14; x < W; x += 60 + R() * 70) { if (Math.abs(x - hx) < 60) continue; s += tree(x, 560 - Math.sin(x / W * Math.PI) * 26 + 6, 80 + R() * 60, 3, 3, '#1d1a23'); }
  s += '</g>';

  // холм-спираль
  const sx = W * .44;
  s += `<path d="M${f(sx - 200)} ${H}Q${f(sx - 90)} 640 ${f(sx + 30)} 622Q${f(sx + 110)} 612 ${f(sx + 130)} 660Q${f(sx + 140)} 700 ${f(sx + 260)} ${H}Z" fill="#1f1c26"/>`;
  s += `<path d="M${f(sx - 140)} ${H}Q${f(sx - 70)} 660 ${f(sx + 30)} 636Q${f(sx + 100)} 628 ${f(sx + 112)} 662Q${f(sx + 120)} 692 ${f(sx + 82)} 694Q${f(sx + 54)} 694 ${f(sx + 58)} 672Q${f(sx + 64)} 656 ${f(sx + 82)} 664Q${f(sx + 92)} 670 ${f(sx + 82)} 678" stroke="#d9d2c4" stroke-width="2.2" opacity=".5"/>`;

  // большие деревья по краям (на широком экране — ещё и в середине)
  s += `<g filter="url(#inkw)">`;
  s += tree(Math.max(40, W * .08), 772, 470, 4, 18, '#0c0a10', '#3d3549');
  s += tree(Math.min(W - 40, W * .92), 780, 440, 4, 16, '#0c0a10', '#3d3549');
  if (W > 700) { s += tree(W * .3, 762, 320, 3, 10, '#110e16', '#352e40'); s += tree(W * .72, 768, 300, 3, 9, '#110e16', '#352e40'); }
  s += '</g>';
  crowSpots.filter(([x, y]) => y > 260 && x > 10 && x < W - 10).slice(0, W > 700 ? 5 : 3).forEach(([x, y], i) => { s += crow(x, y - 9, 1.1 + (i % 2) * .2, i % 2); });

  // передний план: земля, покосившийся забор, надгробия, кресты, сухая трава
  s += `<path d="M0 ${H - 52}Q${f(W * .3)} ${H - 74} ${f(W * .6)} ${H - 56}T${W} ${H - 64}V${H}H0Z" fill="#100e14"/>`;
  const fx0 = W * .5, fx1 = W * .9;
  let fence = '';
  for (let x = fx0; x < fx1; x += 13 + R() * 4) {
    const top = H - 96 - R() * 18, lean = (R() - .5) * 12;
    fence += `<path d="M${f(x)} ${H - 58}L${f(x + lean * .3)} ${f(top)}l3 -9l3 9L${f(x + 6)} ${H - 58}Z" transform="rotate(${f(lean)} ${f(x)} ${H - 58})"/>`;
  }
  s += `<g fill="#0e0c12" stroke="#4a4256" stroke-width=".8">${fence}</g>`;
  s += `<path d="M${f(fx0 - 6)} ${H - 84}Q${f((fx0 + fx1) / 2)} ${H - 92} ${f(fx1 + 6)} ${H - 80}M${f(fx0 - 6)} ${H - 70}Q${f((fx0 + fx1) / 2)} ${H - 76} ${f(fx1 + 6)} ${H - 66}" stroke="#0e0c12" stroke-width="4"/>`;
  const stones = [[W * .16, 0], [W * .3, 1], [W * .4, 2], [W * .62, 0], [W * .82, 1]];
  stones.forEach(([x, k], i) => {
    const y = H - 60, rot = (R() - .5) * 18;
    s += `<g transform="rotate(${f(rot)} ${f(x)} ${y})" fill="#24202b" stroke="#6b6378" stroke-width="1.1">` + (k === 1
      ? `<path d="M${f(x - 3)} ${y}V${y - 34}H${f(x - 13)}V${y - 41}H${f(x - 3)}V${y - 50}H${f(x + 3)}V${y - 41}H${f(x + 13)}V${y - 34}H${f(x + 3)}V${y}Z"/>`
      : `<path d="M${f(x - 12)} ${y}V${y - 26}Q${f(x - 12)} ${y - 40} ${f(x)} ${y - 40}Q${f(x + 12)} ${y - 40} ${f(x + 12)} ${y - 26}V${y}Z"/><path d="M${f(x - 5)} ${y - 26}h10M${f(x - 4)} ${y - 20}h8" stroke-width=".8"/>`) + '</g>';
  });
  let grass = '';
  for (let x = 4; x < W; x += 9 + R() * 14) { const y = H - 54 + R() * 10; grass += `M${f(x)} ${f(y)}q${f(-2 + R() * 4)} -8 ${f(-4 + R() * 8)} -${f(10 + R() * 10)}`; }
  s += `<path d="${grass}" stroke="#0e0c12" stroke-width="1.6"/>`;

  // туман и летучие мыши
  // туман — на всю ширину экрана с запасом, чтобы при движении не было обрыва
  const waves = (y, step, amp) => { let d = `M-${step * 2} ${y}q${step / 2} -${amp} ${step} 0`; for (let x = 0; x < W + step * 2; x += step) d += `t${step} 0`; return d + `V${H}H-${step * 2}Z`; };
  s += `<g class="fog"><path d="${waves(H - 40, 120, 20)}" fill="#b8afc4" opacity=".08"/><path d="${waves(H - 18, 140, 18)}" fill="#b8afc4" opacity=".07"/></g>`;
  s += bat(mx - 150, 90, .9, 'b1') + bat(mx - 40, 210, .6, 'b2') + bat(W * .3, 200, .5, 'b3');
  s += '</svg>';
  box.innerHTML = s;
}

let sceneTimer = null;
window.addEventListener('resize', () => { clearTimeout(sceneTimer); sceneTimer = setTimeout(buildBurtonScene, 250); });
