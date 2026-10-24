'use strict';
// Персонаж в профиле: тонкие чернильные линии, большие глаза, зашитый рот, лоскутное платье, полосатые чулки.
// Фигура плавно меняется по индексу массы тела, выражение лица — по дневнику за сегодня.

const bmiOf = p => (p.h >= 50 && p.h <= 260 && p.w >= 20 && p.w <= 400) ? p.w / ((p.h / 100) ** 2) : 0;
function bmiCategory(b) {
  if (!b) return '';
  if (b < 18.5) return 'ниже нормы';
  if (b < 25) return 'норма';
  if (b < 30) return 'выше нормы';
  return 'высокий';
}
// ширина фигуры: 1 — стройная; меньше — худее, больше — полнее (плавно, без скачков)
function bodyWidth(b) {
  const pts = [[15, .72], [18.5, .86], [22, 1], [25, 1.12], [30, 1.45], [35, 1.75], [40, 1.95]];
  if (!b) return 1;
  if (b <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (b <= pts[i][0]) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    return y0 + (y1 - y0) * (b - x0) / (x1 - x0);
  }
  return pts[pts.length - 1][1];
}

// настроение по дневнику за сегодня
function moodToday(sex) {
  const t = todayStr(), eaten = diaryTotals(t).k, m = sex === 'm';
  const target = (profile.k || 1800) + (typeof addBurn !== 'undefined' && addBurn ? burnedOn(t) : 0);
  const pct = eaten / target, hour = new Date().getHours();
  if (!eaten) return { m: 'sleepy', text: hour < 12 ? (m ? 'Сонный: ещё не завтракал' : 'Сонная: ещё не завтракала') : 'Ждёт, когда ты запишешь еду' };
  if (pct > 1.15) return { m: 'stuffed', text: m ? 'Объелся… Ничего, завтра будет легче' : 'Объелась… Ничего, завтра будет легче' };
  if (pct >= 0.85) return { m: 'happy', text: m ? 'Доволен: сегодня всё в норме' : 'Довольна: сегодня всё в норме' };
  if (hour >= 19 && pct < 0.6) return { m: 'hungry', text: 'Грустит: для вечера съедено маловато' };
  return { m: 'calm', text: m ? 'Спокоен: день идёт по плану' : 'Спокойна: день идёт по плану' };
}

let charSeq = 0;
function characterSvg(bmi, mood, sex) {
  const id = ++charSeq, w = bodyWidth(bmi), R = rng(77), cx = 100, f = n => Math.round(n * 10) / 10, male = sex === 'm';
  const ink = 'class="ci"';
  let s = `<svg viewBox="0 0 200 400" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Персонаж">
  <defs>
    <filter id="cw${id}" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".04" numOctaves="2" seed="7"/><feDisplacementMap in="SourceGraphic" scale="2.2"/></filter>
    <pattern id="st${id}" width="8" height="7" patternUnits="userSpaceOnUse"><rect width="8" height="7" fill="#f2eee8"/><rect width="8" height="3.4" fill="#26222b"/></pattern>
    <pattern id="sl${id}" width="6" height="9" patternUnits="userSpaceOnUse"><rect width="6" height="9" fill="#ddd6e6"/><rect width="6" height="3.5" fill="#3a3342"/></pattern>
  </defs><g filter="url(#cw${id})" fill="none">`;

  // --- волосы: два растрёпанных хвостика
  const hair = (side) => {
    let h = '';
    const x0 = cx + side * 33, y0 = 42;
    for (let i = 0; i < 9; i++) {
      const len = 70 + R() * 70, out = 30 + R() * 45;
      const x1 = x0 + side * (out * .6), y1 = y0 - 12 + R() * 10;
      const x2 = x0 + side * out, y2 = y0 + len * .55;
      const x3 = x0 + side * (out * (.5 + R() * .6)), y3 = y0 + len;
      h += `<path ${ink} d="M${f(x0)} ${f(y0)}C${f(x1)} ${f(y1)} ${f(x2)} ${f(y2)} ${f(x3)} ${f(y3)}" stroke-width="${f(.8 + R() * .6)}"/>`;
    }
    h += `<path d="M${x0 - side * 6} ${y0 - 4}q${side * 18} 10 ${side * 34} 60" stroke="#8c7fb0" stroke-width="7" opacity=".28"/>`;
    h += `<path ${ink} d="M${x0 - 5} ${y0 - 6}l10 10M${x0 + 5} ${y0 - 6}l-10 10"/>`;   // стежок-резинка
    return h;
  };
  if (male) {
    // короткие растрёпанные волосы: торчащие вверх и в стороны пряди
    for (let i = 0; i < 30; i++) {
      const x = cx - 38 + i * 2.55 + R() * 2, d = (x - cx) / 38, y0 = 43 + d * d * 16, hh = 14 + R() * 22;
      s += `<path ${ink} d="M${f(x)} ${f(y0)}q${f(R() * 10 - 5)} ${f(-hh * .6)} ${f(d * 14 + R() * 12 - 6)} ${f(-hh)}" stroke-width="${f(.8 + R() * .7)}"/>`;
    }
    s += `<path d="M${cx - 38} 62Q${cx} 4 ${cx + 38} 62" stroke="#8c7fb0" stroke-width="8" opacity=".25"/>`;
  } else {
    s += hair(-1) + hair(1);
  }
  for (let i = 0; !male && i < 9; i++) { const x = cx - 26 + i * 6.5 + R() * 3; s += `<path ${ink} d="M${f(x)} 40q${f(R() * 8 - 4)} -12 ${f(R() * 10 - 5)} -${f(14 + R() * 12)}" stroke-width=".8"/>`; }

  // --- шея в полоску
  const nw = 4.5 + (w - 1) * 3;
  s += `<path ${ink} d="M${f(cx - nw)} 120V152M${f(cx + nw)} 120V152" stroke-width="1.3"/>`;
  for (let y = 124; y < 152; y += 5) s += `<path ${ink} d="M${f(cx - nw)} ${y}q${f(nw)} 2 ${f(nw * 2)} 0" stroke-width=".9"/>`;

  // --- ноги в полосатых чулках
  const hemY = 292, footY = 378, lw = male ? 5.6 + (w - 1) * 7 : 4.2 + (w - 1) * 6, lx = male ? 12.5 * w + 2 : 11 * w + 2;
  [-1, 1].forEach(sd => {
    const x = cx + sd * lx, top = male ? 250 : hemY;   // у мужчины штаны идут от пояса
    s += `<path d="M${f(x - lw * (male ? 1.15 : 1))} ${top}L${f(x - lw * .8)} ${footY}H${f(x + lw * .8)}L${f(x + lw * (male ? 1.15 : 1))} ${top}Z" fill="url(#st${id})" ${ink} stroke-width="1"/>`;
    s += `<path ${ink} d="M${f(x - lw * .9)} ${footY}q${sd * 4} 8 ${f(sd * (lw + 14))} 4q${f(-sd * 4)} -2 ${f(-sd * 2)} -6" fill="#26222b" stroke-width="1"/>`;
  });

  // --- руки (правая — полосатый рукав)
  const sw = (male ? 25 : 21) * w, bb = Math.max(0, w - 1) * 30, aw = 2.4 + (w - 1) * 3.5;
  [-1, 1].forEach(sd => {
    const x0 = cx + sd * sw, x1 = cx + sd * (sw + 8 + bb * .5), x2 = cx + sd * (sw + 6 + bb * .6);
    s += `<path d="M${f(x0)} 156Q${f(x1 + sd * 6)} 205 ${f(x2)} 258L${f(x2 + sd * aw * 2)} 257Q${f(x1 + sd * (6 + aw * 2))} 205 ${f(x0 + sd * aw * 2)} 158Z" ${sd > 0 ? `fill="url(#sl${id})"` : 'fill="#f4f0ea"'} ${ink} stroke-width="1"/>`;
    s += `<path ${ink} d="M${f(x2)} 258l${f(-sd * 3)} 9M${f(x2 + sd * aw)} 259l0 10M${f(x2 + sd * aw * 2)} 257l${f(sd * 3)} 9" stroke-width=".9"/>`;
  });

  if (male) {
    // --- лоскутная жилетка поверх рубашки; ширина и живот растут с ИМТ
    const vw = 21 * w + bb, hipw = lx + lw * 1.15 + 3, hemM = 268;
    let vh = '';
    for (let i = 0; i <= 10; i++) vh += `L${f(cx - hipw + i * hipw * 2 / 10)} ${f(hemM - (i % 2 ? 6 : 0) + R() * 2)}`;
    const vest = `M${f(cx - sw)} 152Q${f(cx - vw - 6)} 205 ${f(cx - hipw)} ${hemM}${vh}Q${f(cx + vw + 6)} 205 ${f(cx + sw)} 152Q${cx} 162 ${f(cx - sw)} 152Z`;
    s += `<clipPath id="dc${id}"><path d="${vest}"/></clipPath>`;
    s += `<path d="${vest}" fill="#e9e4ef" ${ink} stroke-width="1.4"/>`;
    s += `<g clip-path="url(#dc${id})">`;
    s += `<path d="M${cx + 4} 150L${f(cx + hipw)} 150L${f(cx + hipw)} 290L${cx + 8} 290Z" fill="#8c7fb0" opacity=".22"/>`;
    s += `<rect x="${f(cx + hipw * .3)}" y="212" width="${f(15 + w * 4)}" height="${f(16 + w * 3)}" fill="#6d6676" opacity=".75" transform="rotate(7 ${f(cx + hipw * .4)} 220)"/>`;   // заплатка
    s += `<rect x="${f(cx - hipw * .85)}" y="236" width="${f(14 + w * 3)}" height="14" fill="#8c7fb0" opacity=".45" transform="rotate(-5 ${f(cx - hipw * .7)} 242)"/>`;
    for (let x = cx - hipw - 30; x < cx + hipw + 30; x += 7) s += `<path d="M${f(x)} 238l30 34M${f(x + 30)} 238l-30 34" stroke="#2a2530" stroke-width=".6" opacity=".6"/>`;
    s += `</g>`;
    s += `<path d="M${cx - 10} 152L${cx} 192L${cx + 10} 152Z" fill="#f6f2ec" ${ink} stroke-width="1"/>`;   // рубашка в вырезе
    s += `<path ${ink} d="M${cx} 192V${hemM - 4}" stroke-width="1"/>`;   // борт жилетки
    for (let y = 200; y < hemM - 8; y += 13) s += `<circle cx="${cx + 4}" cy="${y}" r="2.2" fill="#2a2530"/>`;
    for (let y = 198; y < hemM - 10; y += 13) s += `<path ${ink} d="M${cx - 12} ${y}l6 3M${cx - 6} ${y}l-6 3" stroke-width=".8"/>`;   // стежки
    s += `<path ${ink} d="M${f(cx - sw + 2)} 154L${cx - 8} 176L${cx - 10} 152M${f(cx + sw - 2)} 154L${cx + 8} 176L${cx + 10} 152" stroke-width="1"/>`;   // отвороты
  } else {
  // --- лоскутное платье: чем выше ИМТ, тем шире силуэт и заметнее живот
  const ww = 17 * w + bb, hw = 34 * w + 8;
  let hem = '';
  const n = 12;
  for (let i = 0; i <= n; i++) hem += `L${f(cx - hw + i * hw * 2 / n)} ${f(hemY - (i % 2 ? 7 : 0) + R() * 3)}`;
  const dress = `M${f(cx - sw)} 152Q${f(cx - ww - 6)} 205 ${f(cx - hw)} ${hemY}${hem}Q${f(cx + ww + 6)} 205 ${f(cx + sw)} 152Q${cx} 162 ${f(cx - sw)} 152Z`;
  s += `<clipPath id="dc${id}"><path d="${dress}"/></clipPath>`;
  s += `<path d="${dress}" fill="#efebf3" ${ink} stroke-width="1.4"/>`;
  s += `<g clip-path="url(#dc${id})">`;
  s += `<path d="M${cx + 4} 150L${f(cx + hw)} 150L${f(cx + hw)} 300L${cx + 8} 300Z" fill="#8c7fb0" opacity=".22"/>`;                       // акварельная тень
  s += `<rect x="${f(cx + hw * .25)}" y="222" width="${f(16 + w * 4)}" height="${f(16 + w * 3)}" fill="#6d6676" opacity=".75" transform="rotate(-8 ${f(cx + hw * .3)} 230)"/>`;   // заплатка
  for (let x = cx - hw - 40; x < cx + hw + 40; x += 7) s += `<path d="M${f(x)} 252l38 44M${f(x + 38)} 252l-38 44" stroke="#2a2530" stroke-width=".6" opacity=".7"/>`;   // сетка на юбке
  s += `</g>`;
  s += `<path ${ink} d="M${cx} 158Q${cx + 3} 220 ${cx - 2} 252" stroke-width="1"/>`;   // шов посередине
  for (let y = 166; y < 250; y += 9) s += `<path ${ink} d="M${cx - 4} ${y}l8 4M${cx + 4} ${y}l-8 4" stroke-width=".8"/>`;   // стежки
  s += `<path ${ink} d="M${f(cx - sw + 2)} 154L${cx - 6} 178L${cx} 160L${cx + 6} 178L${f(cx + sw - 2)} 154" stroke-width="1"/>`;   // воротник
  for (let i = 0; i < 5; i++) s += `<circle cx="${f(cx - hw * .6 + i * hw * .3)}" cy="${f(hemY - 14 + (i % 2) * 4)}" r="1.6" fill="#2a2530"/>`;
  }

  // --- голова
  const hx = 37 + (w - 1) * 9, chin = 124 + (w - 1) * 2;
  s += `<path d="M${f(cx - hx)} 72C${f(cx - hx)} 26 ${f(cx + hx)} 26 ${f(cx + hx)} 72C${f(cx + hx)} 104 ${cx + 12} ${f(chin - 4)} ${cx} ${f(chin)}C${cx - 12} ${f(chin - 4)} ${f(cx - hx)} 104 ${f(cx - hx)} 72Z" fill="#f6f2ec" ${ink} stroke-width="1.5"/>`;
  s += `<path d="M${f(cx + hx - 8)} 50Q${f(cx + hx + 2)} 80 ${cx + 14} ${f(chin - 8)}" stroke="#8c7fb0" stroke-width="8" opacity=".22"/>`;
  s += `<path ${ink} d="M${f(cx - hx + 6)} 92l6 4M${f(cx - hx + 9)} 88l2 9" stroke-width=".8"/>`;   // шрам-стежок на щеке
  if (male) for (let i = 0; i < 9; i++) { const x = cx - 30 + i * 7 + R() * 3; s += `<path ${ink} d="M${f(x)} ${f(38 + ((x - cx) / 38) ** 2 * 14)}q${f(R() * 6 - 3)} 8 ${f(R() * 8 - 4 + (x - cx) * .1)} ${f(12 + R() * 8)}" stroke-width="1"/>`; }   // чёлка

  // глаза
  const eye = (ex, sd) => {
    let e = `<circle cx="${ex}" cy="70" r="14" fill="#fff" ${ink} stroke-width="1.4"/>`;
    for (let i = 0; i < 6; i++) { const a = Math.PI * (1.05 + i * .17); e += `<path ${ink} d="M${f(ex + Math.cos(a) * 14)} ${f(70 + Math.sin(a) * 14)}l${f(Math.cos(a) * 6)} ${f(Math.sin(a) * 6)}" stroke-width=".9"/>`; }
    if (mood === 'sleepy') e += `<path d="M${ex - 14} 70A14 14 0 0 1 ${ex + 14} 70Z" fill="#d9d2e2" ${ink} stroke-width="1.2"/><circle cx="${ex}" cy="76" r="2" fill="#1d1a22"/>`;
    else if (mood === 'stuffed') e += `<path ${ink} d="M${ex} 70m-1 0a1 1 0 1 1 2 0a3 3 0 1 1 -5 0a5 5 0 1 1 8 1a7 7 0 1 1 -11 -1" stroke-width="1"/>`;   // глаза-спиральки
    else {
      const py = mood === 'happy' ? 66 : mood === 'hungry' ? 75 : 70;
      e += `<circle cx="${ex + sd * 1.5}" cy="${py}" r="2.3" fill="#1d1a22"/>`;
      if (mood === 'hungry') e += `<path ${ink} d="M${ex - 12} 58l10 5" stroke-width="1.2"/>`;   // грустные брови домиком
    }
    return e;
  };
  s += eye(cx - 17, 1) + eye(cx + 17, -1);
  if (mood === 'hungry') s += `<path d="M${cx + 24} 86q-2 6 0 8q2 -2 0 -8Z" fill="#9fc3e0" stroke="#5a7d99" stroke-width=".6"/>`;   // слезинка
  if (mood === 'happy') s += `<circle cx="${cx - 26}" cy="94" r="6" fill="#e58a9a" opacity=".35"/><circle cx="${cx + 26}" cy="94" r="6" fill="#e58a9a" opacity=".35"/>`;

  // зашитый рот: изгиб зависит от настроения
  const my = 104, curve = { happy: 12, calm: 4, sleepy: 0, hungry: -10, stuffed: 0 }[mood] || 0;
  const mouth = mood === 'stuffed'
    ? `M${cx - 16} ${my}q4 -4 8 0t8 0t8 0t8 0`
    : `M${cx - 16} ${my - curve * .4}Q${cx} ${my + curve} ${cx + 16} ${my - curve * .4}`;
  s += `<path ${ink} d="${mouth}" stroke-width="1.3"/>`;
  for (let i = -12; i <= 12; i += 6) { const yy = my + (mood === 'stuffed' ? 0 : curve * (1 - (i / 16) ** 2) * .55 - curve * .4 * (i / 16) ** 2); s += `<path ${ink} d="M${cx + i} ${f(yy - 4)}v8" stroke-width=".9"/>`; }
  if (!male) s += `<path d="M${cx - 5} ${f(my + (mood === 'stuffed' ? 0 : curve * .55) - 1)}q2.5 -3 5 0q2.5 -3 5 0q-2.5 4 -5 4q-2.5 0 -5 -4Z" fill="#d6322b" stroke="#8e1d18" stroke-width=".6"/>`;   // красные губы
  else for (let i = 0; i < 14; i++) s += `<path ${ink} d="M${f(cx - 22 + i * 3.2 + R())} ${f(112 + R() * 4)}l${f(R() * 2 - 1)} ${f(2 + R() * 2)}" stroke-width=".6"/>`;   // щетина
  if (mood === 'sleepy') s += `<text x="${cx + 40}" y="38" font-size="14" fill="#5d5566" font-family="serif">z</text><text x="${cx + 50}" y="26" font-size="10" fill="#5d5566" font-family="serif">z</text>`;

  return s + '</g></svg>';
}

// карточка персонажа (профиль и дневник)
function characterCard(p, small) {
  const b = bmiOf(p), md = moodToday(p.sex);
  const cat = bmiCategory(b);
  return `<div class="card charcard ${small ? 'small' : ''}"><div class="cardrow"><div class="char">${characterSvg(b, md.m, p.sex)}</div><div class="cbody">
    <b>${md.text}</b>
    ${b ? `<div class="mu" style="margin-top:6px">ИМТ ${String(Math.round(b * 10) / 10).replace('.', ',')}: ${cat}</div>` : '<div class="mu">Впиши рост в сантиметрах и вес в килограммах, чтобы посчитать ИМТ</div>'}
    ${!small ? '<div class="mu" style="margin-top:6px">Фигура меняется по индексу массы тела из профиля, настроение — по дневнику за сегодня. ИМТ — грубый показатель: при большой мышечной массе он бывает завышен.</div>' : ''}
  </div></div></div>`;
}
