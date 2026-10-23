'use strict';

// ---------- данные и состояние ----------
const $ = s => document.querySelector(s);
const PR = {};
PRODUCTS.forEach(a => PR[a[0]] = { id: a[0], name: a[1], cat: a[2], k: a[3], p: a[4], f: a[5], c: a[6] });
const RC = RECIPES.map(a => ({ id: a[0], name: a[1], type: a[2], time: a[3], ing: a[4], steps: a[5] }));
const TYPE_NAME = { b: 'Завтрак', m: 'Обед / ужин', s: 'Перекус' };

const store = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v === null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
};

let pantry = new Set(store.get('pantry', []));
let profile = store.get('profile', { sex: 'f', age: 30, h: 165, w: 60, act: 1.375, goal: 'keep', k: 1800, p: 108, f: 50, c: 230 });
let custom = store.get('custom', {});   // id рецепта -> свои ингредиенты на 1 порцию
let day = store.get('day', null);       // [{slot, id, mult}]
let pantryFilter = '';
let recipeType = 'all';
let onlyCookable = false;
let usePantryForDay = true;
let dayStrict = store.get('dayStrict', false);

const round = (x, n = 0) => { const m = 10 ** n; return Math.round(x * m) / m; };

// ---------- расчёты ----------
function macros(ings) {
  const t = { k: 0, p: 0, f: 0, c: 0 };
  for (const [id, g] of ings) {
    const p = PR[id]; if (!p) continue;
    t.k += p.k * g / 100; t.p += p.p * g / 100; t.f += p.f * g / 100; t.c += p.c * g / 100;
  }
  return t;
}
const ingsOf = r => custom[r.id] || r.ing;
const scale = (ings, m) => ings.map(([id, g]) => [id, g * m]);

function match(r) {
  const req = ingsOf(r).filter(([, g]) => g >= 15);
  if (!req.length) return { pct: 1, missing: [] };
  const missing = req.filter(([id]) => !pantry.has(id)).map(([id]) => PR[id] ? PR[id].name : 'удалённый продукт');
  return { pct: (req.length - missing.length) / req.length, missing };
}

function calcNorm() {
  const p = profile;
  const bmr = 10 * p.w + 6.25 * p.h - 5 * p.age + (p.sex === 'm' ? 5 : -161);
  let k = bmr * p.act;
  k *= p.goal === 'lose' ? 0.85 : p.goal === 'gain' ? 1.1 : 1;
  const prot = p.w * (p.goal === 'lose' ? 2 : 1.8);
  const fat = k * 0.27 / 9;
  const carb = (k - prot * 4 - fat * 9) / 4;
  return { k: round(k / 10) * 10, p: round(prot), f: round(fat), c: round(Math.max(carb, 0)) };
}

// подгонка граммовок под целевые Б/Ж/У (покоординатный спуск)
function fit(ings, t) {
  const o = ings.map(i => i[1]);
  const g = o.slice();
  const err = () => {
    const m = macros(ings.map((i, n) => [i[0], g[n]]));
    return (m.p - t.p) ** 2 + (m.f - t.f) ** 2 + (m.c - t.c) ** 2;
  };
  let best = err();
  for (let it = 0; it < 60; it++) {
    let changed = false;
    for (let n = 0; n < g.length; n++) {
      const lo = Math.max(5, o[n] * 0.3), hi = o[n] * 3;
      for (const d of [-20, -10, -5, -1, 1, 5, 10, 20]) {
        const v = g[n] + d; if (v < lo || v > hi) continue;
        const old = g[n]; g[n] = v;
        const e = err();
        if (e < best - 1e-6) { best = e; changed = true; } else g[n] = old;
      }
    }
    if (!changed) break;
  }
  return ings.map((i, n) => [i[0], round(g[n])]);
}

// ---------- вкладки ----------
document.querySelectorAll('nav button').forEach(b => b.onclick = () => showTab(b.dataset.tab));
function toast(msg) {
  const old = document.getElementById('toast'); if (old) old.remove();
  const el = document.createElement('div'); el.id = 'toast'; el.textContent = msg;
  document.body.appendChild(el); setTimeout(() => el.remove(), 2200);
}
const CAT_EMO = { 'Мясо и рыба': '🍗', 'Молочное и яйца': '🥛', 'Крупы и хлеб': '🌾', 'Овощи и зелень': '🥦', 'Фрукты и ягоды': '🍓', 'Орехи, масла, прочее': '🥜' };

// ---------- оформление: «карандаш» или «акварель» ----------
const THEMES = { pencil: 'Карандаш', ghibli: 'Акварельная сказка', burton: 'Мрачная сказка' };
let theme = store.get('theme', 'ghibli');
const applyTheme = () => { document.documentElement.dataset.theme = theme; };
applyTheme();
// листики, разлетающиеся при нажатии (только в акварельной теме)
function leaves(el) {
  if (theme === 'pencil' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const colors = theme === 'burton' ? ['#8c7fb0', '#3d344d', '#b8afc4', '#1f1b24'] : ['#8fd18f', '#6fbf8e', '#b5dc8a', '#7cc7d9'];
  const r = el.getBoundingClientRect();
  for (let i = 0; i < 6; i++) {
    const s = document.createElement('span');
    s.className = 'leaf';
    s.style.left = (r.left + r.width / 2 + (Math.random() - .5) * r.width * .6) + 'px';
    s.style.top = (r.top + r.height / 2) + 'px';
    s.style.setProperty('--dx', Math.round((Math.random() - .5) * 90) + 'px');
    s.style.setProperty('--rot', Math.round((Math.random() - .5) * 360) + 'deg');
    s.style.background = colors[i % 4];
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 1100);
  }
}
function showTab(t) {
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  document.querySelectorAll('main section').forEach(s => s.hidden = s.id !== 'tab-' + t);
  ({ pantry: renderPantry, recipes: renderRecipes, day: renderDay, week: renderWeek, diary: renderDiary, profile: renderProfile })[t]();
  renderBanner();
  window.scrollTo(0, 0);
}

// ---------- продукты ----------
function renderPantry() {
  const q = pantryFilter.trim().toLowerCase();
  const cats = {};
  PRODUCTS.forEach(a => { if (!q || a[1].toLowerCase().includes(q)) (cats[a[2]] = cats[a[2]] || []).push(a); });
  let h = `<h1>Мои продукты</h1>
  <p class="hint">Нажимай на то, что есть дома. Выбрано: <b>${pantry.size}</b></p>
  <div class="row"><input type="text" id="pf" placeholder="Поиск продукта…" value="${pantryFilter.replace(/[&"<>]/g, ch => '&#' + ch.charCodeAt(0) + ';')}">
  <button class="btn sec sm fit" id="addp">+ Свой</button>
  ${pantry.size ? '<button class="btn warn sm fit" id="pclear">Очистить</button>' : ''}</div>`;
  for (const c in cats) {
    h += `<h2>${CAT_EMO[c] || ''} ${c}</h2><div class="chips">` +
      cats[c].map(a => `<button class="chip ${pantry.has(a[0]) ? 'on' : ''}" data-id="${a[0]}">${a[1]}${PR[a[0]] && PR[a[0]].mine ? ' ★' : ''}</button>`).join('') + '</div>';
  }
  if (!Object.keys(cats).length) h += '<p class="hint">Ничего не найдено. Можно добавить свой продукт кнопкой «+ Свой».</p>';
  h += '<div id="stockbox"></div>' + myProductsHtml();
  $('#tab-pantry').innerHTML = h;
  const pf = $('#pf');
  pf.oninput = () => { pantryFilter = pf.value; const pos = pf.selectionStart; renderPantry(); const n = $('#pf'); n.focus(); n.setSelectionRange(pos, pos); };
  const clr = $('#pclear');
  if (clr) clr.onclick = () => { pantry.clear(); stock = {}; store.set('stock', stock); savePantry(); renderPantry(); };
  document.querySelectorAll('#tab-pantry .chip[data-id]').forEach(b => b.onclick = () => {
    const id = b.dataset.id;
    if (pantry.has(id)) { pantry.delete(id); delete stock[id]; store.set('stock', stock); } else pantry.add(id);
    savePantry();
    b.classList.toggle('on');
    if (b.classList.contains('on')) leaves(b);
    document.querySelector('#tab-pantry .hint b').textContent = pantry.size;
    renderStock();
  });
  bindPantryExtras();
}
const savePantry = () => store.set('pantry', [...pantry]);

// ---------- рецепты ----------
function macroLine(m, mult = 1) {
  return `<div class="macros"><span><b>${round(m.k * mult)}</b> ккал</span><span>Б <b>${round(m.p * mult)}</b></span><span>Ж <b>${round(m.f * mult)}</b></span><span>У <b>${round(m.c * mult)}</b></span></div>`;
}
function badge(pct) {
  const cls = pct >= 0.99 ? '' : pct >= 0.6 ? 'mid' : 'low';
  return `<span class="badge ${cls}">${pct >= 0.99 ? 'всё есть' : 'есть ' + round(pct * 100) + '%'}</span>`;
}

// ---------- блюда, собранные только из моих продуктов ----------
const GP = { // белковая основа: [название, граммы, тип, винительный падеж]
  chicken_breast: ['Куриная грудка', 150, 'meat', 'куриную грудку'], chicken_thigh: ['Куриные бёдра', 180, 'meat', 'куриные бёдра'],
  turkey: ['Индейка', 150, 'meat', 'индейку'], beef: ['Говядина', 130, 'meat', 'говядину'], minced: ['Фарш', 120, 'meat', 'фарш'],
  tofu: ['Тофу', 150, 'meat', 'тофу'], salmon: ['Лосось', 150, 'fish', 'лосось'], cod: ['Треска', 180, 'fish', 'треску'],
  shrimp: ['Креветки', 150, 'fish', 'креветки'], egg: ['Яйца', 110, 'egg', 'яйца'], chickpeas: ['Нут', 60, 'legume', 'нут'],
  lentils: ['Чечевица', 60, 'legume', 'чечевицу'], ham: ['Ветчина', 70, 'cold', 'ветчину'], tuna: ['Тунец', 100, 'cold', 'тунец'],
  beans: ['Фасоль', 120, 'cold', 'фасоль']
};
const GC = { // гарнир: [творительный, граммы, шаг]
  buckwheat: ['гречкой', 70, 'Отвари гречку до готовности.'], rice: ['рисом', 70, 'Отвари рис.'], pasta: ['пастой', 80, 'Отвари пасту.'],
  potato: ['картофелем', 200, 'Отвари или запеки картофель.'], bread: ['хлебом', 50, 'Подсуши хлеб на сковороде или в тостере.']
};
const GV = { // овощи: [творительный, граммы, свежий]
  tomato: ['помидорами', 100, 1], cucumber: ['огурцом', 100, 1], lettuce: ['салатом', 50, 1], avocado: ['авокадо', 60, 1],
  corn: ['кукурузой', 60, 1], carrot: ['морковью', 60, 0], onion: ['луком', 40, 0], pepper: ['перцем', 80, 0],
  cabbage: ['капустой', 100, 0], broccoli: ['брокколи', 100, 0], zucchini: ['кабачком', 120, 0], eggplant: ['баклажаном', 100, 0],
  mushrooms: ['грибами', 100, 0], spinach: ['шпинатом', 80, 0], beet: ['свёклой', 80, 0], pumpkin: ['тыквой', 120, 0], peas: ['горошком', 70, 0]
};
const GEN = {};
let genCache = null;

function strictIngs(r) { return ingsOf(r).filter(([id, g]) => g >= 15 || pantry.has(id)); }
const getRecipe = id => RC.find(x => x.id === id) || GEN[id];
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

function buildDishes() {
  const ok = id => pantry.has(id) && !isBanned(id);
  const have = ids => ids.filter(ok);
  const prots = have(Object.keys(GP)), carbs = have(Object.keys(GC)), vegs = have(Object.keys(GV));
  const fat = ok('oil') ? 'oil' : ok('butter') ? 'butter' : null;
  const vegSets = [[]];
  vegs.forEach((a, i) => { vegSets.push([a]); vegs.slice(i + 1).forEach(b => vegSets.push([a, b])); });
  const out = [];
  for (const p of prots) {
    const [pname, pg, kind, pacc] = GP[p];
    for (const c of [null, ...carbs]) {
      if (kind === 'egg' && c && !['bread', 'potato'].includes(c)) continue;
      for (const vs of vegSets) {
        if (!c && !vs.length && kind !== 'legume') continue;
        const id = 'g_' + [p, c, ...vs].filter(Boolean).join('-');
        const withList = [c && GC[c][0], ...vs.map(v => GV[v][0])].filter(Boolean);
        const name = pname + (withList.length ? ' с ' + (withList.length > 1 ? withList.slice(0, -1).join(', ') + ' и ' + withList.slice(-1) : withList[0]) : '');
        const ings = [[p, pg]];
        if (c) ings.push([c, GC[c][1]]);
        vs.forEach(v => ings.push([v, GV[v][1]]));
        const useFat = fat && ['meat', 'fish', 'egg', 'legume'].includes(kind);
        if (useFat) ings.push([fat, 8]);
        const onFat = fat ? ' на масле' : '';
        const steps = [];
        if (c) steps.push(GC[c][2]);
        steps.push({
          meat: `Нарежь ${pacc} и ${fat ? 'обжарь' + onFat : 'запеки или потуши'} до готовности.`,
          fish: `Запеки или обжарь ${pacc} 12–15 минут${onFat}.`,
          egg: 'Приготовь яйца: яичницей, омлетом или отвари вкрутую.',
          legume: `Заранее замочи и отвари ${pacc} до мягкости${fat ? ', слегка обжарь на масле' : ''}.`,
          cold: `Нарежь ${pacc}, слей лишнюю жидкость, если из банки.`
        }[kind]);
        const cooked = vs.filter(v => !GV[v][2]), raw = vs.filter(v => GV[v][2]);
        if (cooked.length) steps.push(`Нарежь ${cooked.map(v => PR[v].name.toLowerCase()).join(' и ')}, добавь к основе и туши 10 минут.`);
        if (raw.length) steps.push(`Свежие овощи (${raw.map(v => PR[v].name.toLowerCase()).join(', ')}) нарежь и подай рядом.`);
        steps.push('Посоли и поперчи по вкусу. Приятного аппетита!');
        out.push({ id, name, type: 'm', time: 25, ing: ings, steps: steps.join(' '), gen: true, vessel: kind === 'cold' ? 'salad' : 'plate' });
      }
    }
  }
  return out;
}

function genDishes(force) {
  const key = [...pantry].sort().join(',');
  if (!genCache || genCache.key !== key || force) {
    const all = buildDishes();
    genCache = { key, all: shuffle(all), shown: 8 };
    if (force) genCache.shown = 8;
  }
  const list = genCache.all.slice(0, genCache.shown);
  list.forEach(r => GEN[r.id] = r);
  return list;
}

function renderRecipes() {
  let list = RC.filter(r => (recipeType === 'all' || r.type === recipeType) && recipeAllowed(r)).map(r => ({ r, m: match(r) }));
  if (onlyCookable) list = list.filter(x => x.m.pct >= 0.99);
  list.sort((a, b) => b.m.pct - a.m.pct || a.r.name.localeCompare(b.r.name));
  const types = [['all', 'Все'], ['b', 'Завтрак'], ['m', 'Обед / ужин'], ['s', 'Перекус']];
  let h = `<h1>Рецепты</h1>
  <div class="chips">${types.map(t => `<button class="chip ${recipeType === t[0] ? 'on' : ''}" data-t="${t[0]}">${t[1]}</button>`).join('')}
  <button class="chip ${onlyCookable ? 'on' : ''}" id="cook">Только из моих</button></div>
  <div class="row" style="margin-top:10px"><button class="btn sec" id="addr">+ Свой рецепт</button></div>`;
  if (!pantry.size) h += '<p class="hint">Отметь продукты на вкладке «Продукты», и рецепты отсортируются по тому, что можно приготовить.</p>';
  const card = (r, m, ings, extra = '') => `<div class="card" data-id="${r.id}"><div class="cardrow">${artHtml(r, ings)}<div class="cbody">
      <div class="meal-h"><h3>${r.name}${custom[r.id] ? ' ✎' : ''}</h3>${!onlyCookable && pantry.size ? badge(m.pct) : ''}</div>
      <div class="mu">${TYPE_NAME[r.type]} · ${r.time} мин${extra}</div>
      ${macroLine(macros(ings))}
      ${!onlyCookable && pantry.size && m.missing.length ? `<div class="mu" style="margin-top:4px">Не хватает: ${m.missing.join(', ')}</div>` : ''}
    </div></div></div>`;

  if (onlyCookable && pantry.size && (recipeType === 'all' || recipeType === 'm')) {
    const gen = genDishes(false);
    h += `<h2>✨ Собрано из моих продуктов</h2><p class="hint">Придуманные блюда: только то, что ты отметила. Соль, специи и воду считаем всегда.</p>`;
    if (gen.length) {
      gen.forEach(r => h += card(r, null, ingsOf(r), ' · новое'));
      if (genCache.shown < genCache.all.length) h += '<div class="row" style="margin-top:6px"><button class="btn sec" id="more">Ещё варианты</button><button class="btn sec" id="remix">Перемешать</button></div>';
      else h += '<div class="row" style="margin-top:6px"><button class="btn sec" id="remix">Перемешать</button></div>';
    } else h += '<p class="hint">Не из чего собрать блюдо. Добавь белковый продукт (мясо, рыбу, яйца, тофу, бобовые) и пару овощей или гарнир.</p>';
  }
  if (onlyCookable) h += '<h2>📖 Готовые рецепты из моих продуктов</h2>';
  for (const { r, m } of list) h += card(r, m, onlyCookable ? strictIngs(r) : ingsOf(r));
  if (!list.length) h += '<p class="hint">' + (onlyCookable ? 'Готовых рецептов только из твоих продуктов нет — смотри блюда выше.' : 'Подходящих рецептов нет.') + '</p>';
  $('#tab-recipes').innerHTML = h;
  document.querySelectorAll('#tab-recipes [data-t]').forEach(b => b.onclick = () => { recipeType = b.dataset.t; renderRecipes(); });
  $('#cook').onclick = () => { onlyCookable = !onlyCookable; renderRecipes(); };
  $('#addr').onclick = () => recipeForm(null);
  const more = $('#more'); if (more) more.onclick = () => { genCache.shown += 8; renderRecipes(); };
  const remix = $('#remix'); if (remix) remix.onclick = () => { genDishes(true); renderRecipes(); };
  document.querySelectorAll('#tab-recipes .card').forEach(c => c.onclick = () => openRecipe(c.dataset.id, 1, onlyCookable));
}

// ---------- окно рецепта с правкой ----------
let cur = null; // {r, mult, ings (с учётом порции)}

function openRecipe(id, mult, strict) {
  const r = getRecipe(id);
  cur = { r, mult, ings: scale(strict ? strictIngs(r) : ingsOf(r), mult).map(([i, g]) => [i, round(g)]), target: null };
  drawRecipe();
  $('#modal').hidden = false;
}
function closeModal() {
  $('#modal').hidden = true; cur = null;
  const y = window.scrollY, t = document.querySelector('nav .on');
  if (t) showTab(t.dataset.tab);
  window.scrollTo(0, y);   // остаёмся на том же месте списка, а не прыгаем наверх
}
$('#modal').onclick = e => { if (e.target.id === 'modal') closeModal(); };

function drawRecipe() {
  const { r, mult, ings } = cur;
  const m = macros(ings);
  if (!cur.target) cur.target = { p: round(m.p), f: round(m.f), c: round(m.c) };
  const opts = sel => PRODUCTS.map(a => `<option value="${a[0]}" ${a[0] === sel ? 'selected' : ''}>${a[1]}</option>`).join('');
  $('#modal').innerHTML = `<div class="sheet">
    <div class="meal-h"><h1 style="margin:0">${r.name}</h1><button class="btn sec sm fit" id="close">Закрыть</button></div>
    <div class="art big">${dishArt(r, ings)}</div>
    <div class="mu">${TYPE_NAME[r.type]} · ${r.time} мин</div>
    <div class="sticky"><div class="card tot" id="tot" style="margin:6px 0"></div></div>
    <label class="f">Количество порций
      <input type="number" id="mult" min="0.25" max="10" step="0.25" value="${mult}"></label>
    <h2>Ингредиенты (граммы)</h2>
    <div id="ings">${ings.map((x, n) => `<div class="ing">
      <select data-n="${n}">${opts(x[0])}</select>
      <input type="number" inputmode="decimal" min="0" data-g="${n}" value="${x[1]}">
      <button class="x" data-del="${n}">✕</button></div>`).join('')}</div>
    <div class="row" style="margin-top:8px">
      <select id="addsel"><option value="">+ Добавить ингредиент…</option>${opts('')}</select></div>
    <h2>Подогнать под БЖУ</h2>
    <p class="hint">Задай нужные белки, жиры и углеводы для этого блюда. Граммовки подберутся сами.</p>
    <div class="grid2" style="grid-template-columns:repeat(3,1fr)">
      <label class="f">Белки<input type="number" id="tp" value="${cur.target.p}"></label>
      <label class="f">Жиры<input type="number" id="tf" value="${cur.target.f}"></label>
      <label class="f">Углеводы<input type="number" id="tc" value="${cur.target.c}"></label>
    </div>
    <div class="row" style="margin-top:10px"><button class="btn" id="fit">Подогнать</button></div>
    <h2>Приготовление</h2><p>${r.steps}</p>
    <div class="row" style="margin-top:12px">
      <button class="btn" id="eat">Съела ✓</button>
      <button class="btn sec" id="use">Списать продукты</button>
    </div>
    <p class="hint">«Съела» запишет это блюдо в дневник на сегодня. «Списать продукты» вычтет граммы из запасов на вкладке «Продукты».</p>
    <div class="row" style="margin-top:6px">
      <button class="btn sec" id="save">Сохранить мою версию</button>
      ${custom[r.id] ? '<button class="btn warn" id="reset">Вернуть исходный</button>' : ''}
      ${r.mine ? '<button class="btn sec" id="editmine">Изменить рецепт</button>' : ''}
    </div>
  </div>`;
  updateTotals();
  $('#close').onclick = closeModal;
  $('#mult').onchange = e => {
    const nm = Math.max(0.25, +e.target.value || 1);
    cur.ings = cur.ings.map(([i, g]) => [i, round(g * nm / cur.mult)]);
    cur.mult = nm; cur.target = null; drawRecipe();
  };
  document.querySelectorAll('#ings select').forEach(s => s.onchange = () => { cur.ings[+s.dataset.n][0] = s.value; drawRecipe(); });
  document.querySelectorAll('#ings input').forEach(i => i.oninput = () => { cur.ings[+i.dataset.g][1] = +i.value || 0; updateTotals(); });
  document.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { cur.ings.splice(+b.dataset.del, 1); drawRecipe(); });
  $('#addsel').onchange = e => { if (e.target.value) { cur.ings.push([e.target.value, 50]); drawRecipe(); } };
  $('#fit').onclick = () => {
    cur.target = { p: +$('#tp').value || 0, f: +$('#tf').value || 0, c: +$('#tc').value || 0 };
    cur.ings = fit(cur.ings, cur.target); drawRecipe(); toast('Подогнано ✓');
  };
  $('#save').onclick = () => {
    custom[r.id] = cur.ings.map(([i, g]) => [i, round(g / cur.mult, 1)]);
    store.set('custom', custom); closeModal(); toast('Сохранено ✓');
  };
  const rs = $('#reset');
  if (rs) rs.onclick = () => { delete custom[r.id]; store.set('custom', custom); closeModal(); };
  $('#eat').onclick = () => { eatRecipe(r, cur.mult, cur.ings); toast('Записано в дневник ✓'); };
  $('#use').onclick = () => {
    const n = consume(cur.ings);
    toast(n ? 'Продукты списаны ✓' : 'Нечего списывать: укажи, сколько продуктов дома, на вкладке «Продукты»');
  };
  const em = $('#editmine');
  if (em) em.onclick = () => recipeForm(r.id);
}
function updateTotals() {
  const m = macros(cur.ings);
  $('#tot').innerHTML = `<b>Итого</b>${macroLine(m)}`;
}

// ---------- рацион на день ----------
const SLOTS = [
  { key: 'b', name: 'Завтрак', type: 'b', share: 0.25 },
  { key: 'l', name: 'Обед', type: 'm', share: 0.35 },
  { key: 's', name: 'Перекус', type: 's', share: 0.10 },
  { key: 'd', name: 'Ужин', type: 'm', share: 0.30 }
];
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// варианты блюд для приёма пищи; в строгом режиме — только то, что целиком готовится из моих продуктов
function dayPool(type, strict) {
  if (!strict) return RC.filter(r => r.type === type && recipeAllowed(r)).map(r => ({ r, strict: false }));
  const ready = RC.filter(r => r.type === type && recipeAllowed(r) && match(r).pct >= 0.99).map(r => ({ r, strict: true }));
  genDishes(false);
  const gen = genCache.all.filter(d => type === 'm' || (type === 'b' && d.ing[0][0] === 'egg')).slice(0, 150).map(r => ({ r, strict: true }));
  return ready.concat(gen);
}
const mealIngs = (r, strict) => strict ? strictIngs(r) : ingsOf(r);

const makePool = strict => { const pool = {}; SLOTS.forEach(s => pool[s.type] = dayPool(s.type, strict)); return pool; };
const mealMult = (o, s) => round(clamp(profile.k * s.share / (macros(mealIngs(o.r, o.strict)).k || 1), 0.5, 2) * 20) / 20;

// подбор приёмов пищи на один день; avoid — блюда, которые уже были на неделе (их стараемся не повторять)
function planDay(pool, strict, soft, avoid, iters) {
  const T = profile;
  let best = null, bestScore = 1e9;
  for (let n = 0; n < iters; n++) {
    const meals = []; let used = new Set(), score = 0;
    for (const s of SLOTS) {
      const options = pool[s.type]; if (!options.length) continue;
      let o, tries = 0;
      do { o = pick(options); tries++; } while (used.has(o.r.id) && tries < 10);
      used.add(o.r.id);
      const mult = mealMult(o, s);
      meals.push({ slot: s.key, id: o.r.id, mult, strict: o.strict, dish: o.r.gen ? o.r : undefined });
      score += Math.abs(mult - 1) * 0.15;
      if (!strict && soft && pantry.size) score += (1 - match(o.r).pct) * 2.5;
      if (avoid && avoid.has(o.r.id)) score += 1.2;
    }
    if (!meals.length) break;
    const tot = dayTotals(meals);
    const d = x => Math.max(x, 1);
    score += Math.abs(tot.p - T.p) / d(T.p) + Math.abs(tot.f - T.f) / d(T.f) + Math.abs(tot.c - T.c) / d(T.c) + Math.abs(tot.k - T.k) / d(T.k);
    if (score < bestScore) { bestScore = score; best = meals; }
  }
  return best || [];
}
function genDay() {
  day = planDay(makePool(dayStrict), dayStrict, usePantryForDay, null, 600);
  store.set('day', day);
}
function dayTotals(meals) {
  const t = { k: 0, p: 0, f: 0, c: 0 };
  for (const m of meals) {
    const r = m.dish || getRecipe(m.id); if (!r) continue;
    const mm = macros(mealIngs(r, m.strict));
    t.k += mm.k * m.mult; t.p += mm.p * m.mult; t.f += mm.f * m.mult; t.c += mm.c * m.mult;
  }
  return t;
}
function bar(label, v, t, unit) {
  const pct = t ? v / t * 100 : 0;
  return `<div style="margin:6px 0"><div class="meal-h"><span>${label}</span><span class="mu"><b>${round(v)}</b> / ${round(t)} ${unit}</span></div>
  <div class="bar"><i class="${pct > 110 ? 'over' : ''}" style="width:${clamp(pct, 0, 100)}%"></i></div></div>`;
}

function renderDay() {
  let h = `<h1>Рацион на день</h1>
  <div class="chips" style="margin-bottom:10px">
    <button class="chip ${!dayStrict && usePantryForDay ? 'on' : ''}" id="upd">Учитывать мои продукты</button>
    <button class="chip ${dayStrict ? 'on' : ''}" id="strict">Только из моих продуктов</button>
  </div>
  <div class="row"><button class="btn" id="gen">${day && day.length ? 'Другой вариант' : 'Составить рацион'}</button></div>`;
  if (dayStrict && !pantry.size) h += '<p class="hint">Сначала отметь продукты на вкладке «Продукты».</p>';
  if (day && !day.length) h += '<p class="hint">Из твоих продуктов не получилось собрать рацион. Добавь белок (мясо, рыбу, яйца, тофу) и овощи или гарнир.</p>';
  if (day && day.length) {
    const tot = dayTotals(day);
    h += `<div class="card" style="margin-top:12px"><b>Итого за день</b>
      ${bar('Калории', tot.k, profile.k, 'ккал')}${bar('Белки', tot.p, profile.p, 'г')}${bar('Жиры', tot.f, profile.f, 'г')}${bar('Углеводы', tot.c, profile.c, 'г')}</div>`;
    const missingSlots = SLOTS.filter(s => !day.some(m => m.slot === s.key)).map(s => s.name.toLowerCase());
    if (missingSlots.length) h += `<p class="hint">Не хватает продуктов для: ${missingSlots.join(', ')}.</p>`;
    for (const m of day) {
      const r = m.dish || getRecipe(m.id); if (!r) continue;
      if (m.dish) GEN[m.id] = m.dish;
      const s = SLOTS.find(x => x.key === m.slot);
      const mm = macros(mealIngs(r, m.strict));
      const mt = match(r);
      h += `<div class="card" data-id="${r.id}" data-m="${m.mult}" data-s="${m.strict ? 1 : ''}"><div class="cardrow">${artHtml(r, mealIngs(r, m.strict))}<div class="cbody">
        <div class="meal-h"><span class="mu">${s.name}${r.gen ? ' · новое блюдо' : ''}</span>${!m.strict && pantry.size ? badge(mt.pct) : ''}</div>
        <h3>${r.name}${custom[r.id] ? ' ✎' : ''}</h3>
        <div class="mu">порция ×${m.mult} · ${r.time} мин</div>
        ${macroLine(mm, m.mult)}
        ${!m.strict && pantry.size && mt.missing.length ? `<div class="mu" style="margin-top:4px">Не хватает: ${mt.missing.join(', ')}</div>` : ''}
      </div></div></div>`;
    }
  } else if (!day) h += '<p class="hint">Нажми кнопку, и я подберу завтрак, обед, перекус и ужин под твою норму калорий и БЖУ. Норму можно задать на вкладке «Цели».</p>';
  $('#tab-day').innerHTML = h;
  $('#gen').onclick = () => { genDay(); renderDay(); };
  // при смене режима рацион сразу пересобирается, чтобы не оставались блюда из прошлого режима
  const switchMode = () => { store.set('dayStrict', dayStrict); if (day) genDay(); renderDay(); };
  $('#upd').onclick = () => { if (dayStrict) dayStrict = false; else usePantryForDay = !usePantryForDay; switchMode(); };
  $('#strict').onclick = () => { dayStrict = !dayStrict; switchMode(); };
  document.querySelectorAll('#tab-day .card[data-id]').forEach(c => c.onclick = () => openRecipe(c.dataset.id, +c.dataset.m, !!c.dataset.s));
}

// ---------- план на неделю и список покупок ----------
const DAYS = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
const LIQ = new Set(['milk', 'kefir', 'oil', 'soy_sauce']);
const CAT_ORDER = ['Мясо и рыба', 'Молочное и яйца', 'Овощи и зелень', 'Фрукты и ягоды', 'Крупы и хлеб', 'Орехи, масла, прочее'];
const SEARCH = { greens: 'укроп петрушка зелень', minced: 'фарш', berries: 'ягоды замороженные', pepper: 'перец болгарский', tuna: 'тунец консервированный', beans: 'фасоль консервированная', corn: 'кукуруза консервированная', cheese: 'сыр', oil: 'подсолнечное масло', oats: 'овсяные хлопья' };
let week = store.get('week', null);
let weekStrict = store.get('weekStrict', false);
let weekView = 'plan';
let showPrices = false;

function genWeek() {
  const pool = makePool(weekStrict), avoid = new Set();
  week = [];
  for (let d = 0; d < 7; d++) {
    const meals = planDay(pool, weekStrict, true, avoid, 250);
    meals.forEach(m => avoid.add(m.id));
    week.push(meals);
  }
  store.set('week', week);
}
function rerollMeal(d, key) {
  const s = SLOTS.find(x => x.key === key);
  let options = dayPool(s.type, weekStrict);
  const taken = new Set(week.flat().map(m => m.id));
  let c = options.filter(o => !taken.has(o.r.id));
  if (!c.length) c = options;
  if (!c.length) return;
  if (!weekStrict && pantry.size) c = c.slice().sort((a, b) => match(b.r).pct - match(a.r).pct).slice(0, 6);
  const o = pick(c);
  const i = week[d].findIndex(m => m.slot === key);
  const nm = { slot: key, id: o.r.id, mult: mealMult(o, s), strict: o.strict, dish: o.r.gen ? o.r : undefined };
  if (i >= 0) week[d][i] = nm; else week[d].push(nm);
  week[d].sort((a, b) => SLOTS.findIndex(x => x.key === a.slot) - SLOTS.findIndex(x => x.key === b.slot));
  store.set('week', week);
}
function weekItems() {
  const map = {};
  week.flat().forEach(m => {
    const r = m.dish || getRecipe(m.id); if (!r) return;
    mealIngs(r, m.strict).forEach(([id, g]) => map[id] = (map[id] || 0) + g * m.mult);
  });
  return Object.entries(map).map(([id, g]) => ({ id, g, p: PR[id] })).filter(x => x.p)
    .sort((a, b) => CAT_ORDER.indexOf(a.p.cat) - CAT_ORDER.indexOf(b.p.cat) || a.p.name.localeCompare(b.p.name));
}
// сколько докупить: если продукт есть дома без количества, считаем, что хватает; если с количеством — вычитаем
function shopRows() {
  return weekItems().map(i => {
    const inP = pantry.has(i.id), st = inP ? stock[i.id] : undefined;
    const rem = !inP ? i.g : st == null ? 0 : Math.max(0, i.g - st);
    return Object.assign({}, i, { rem, st });
  });
}
function qty(id, g) {
  if (id === 'egg') return Math.ceil(g / 55) + ' шт';
  const u = LIQ.has(id) ? 'мл' : 'г';
  if (g >= 1000) return (round(g / 1000, 1) + '').replace('.', ',') + (u === 'мл' ? ' л' : ' кг');
  return Math.max(10, round(g / 10) * 10) + ' ' + u;
}
const searchText = p => SEARCH[p.id] || p.name.replace(/\s*\(.*\)/, '').toLowerCase();
const ozonUrl = p => 'https://www.ozon.ru/search/?text=' + encodeURIComponent(searchText(p));
const vvUrl = p => 'https://vkusvill.ru/search/?q=' + encodeURIComponent(searchText(p));

function copyText(text) {
  const done = () => toast('Список скопирован ✓');
  if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(text).then(done, fallback); return; }
  fallback();
  function fallback() {
    const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { toast('Не получилось скопировать'); }
    ta.remove();
  }
}

function renderWeek() {
  let h = `<h1>План на неделю</h1>
  <div class="chips" style="margin-bottom:10px">
    <button class="chip ${weekView === 'plan' ? 'on' : ''}" data-v="plan">Меню</button>
    <button class="chip ${weekView === 'shop' ? 'on' : ''}" data-v="shop">Список продуктов</button>
  </div>`;
  if (weekView === 'plan') {
    h += `<div class="chips" style="margin-bottom:10px">
      <button class="chip ${!weekStrict ? 'on' : ''}" id="wsoft">Учитывать мои продукты</button>
      <button class="chip ${weekStrict ? 'on' : ''}" id="wstrict">Только из моих продуктов</button></div>
      <div class="row"><button class="btn" id="wgen">${week && week.length ? 'Составить заново' : 'Составить неделю'}</button></div>`;
    if (week && !week.some(d => d.length)) h += '<p class="hint">Из твоих продуктов неделю собрать не получилось. Отметь больше продуктов или выключи «Только из моих».</p>';
    else if (!week) h += '<p class="hint">Нажми кнопку, и я составлю меню на 7 дней под твою норму КБЖУ, стараясь не повторять блюда. Потом откроется список продуктов для покупок.</p>';
    else week.forEach((meals, d) => {
      const tot = dayTotals(meals);
      h += `<h2>${DAYS[d]} <span class="mu">· ${round(tot.k)} ккал</span></h2>`;
      meals.forEach(m => {
        const r = m.dish || getRecipe(m.id); if (!r) return;
        if (m.dish) GEN[m.id] = m.dish;
        const s = SLOTS.find(x => x.key === m.slot), mm = macros(mealIngs(r, m.strict));
        h += `<div class="card" data-id="${r.id}" data-m="${m.mult}" data-s="${m.strict ? 1 : ''}"><div class="cardrow">${artHtml(r, mealIngs(r, m.strict))}<div class="cbody">
          <div class="meal-h"><span class="mu">${s.name} · ×${m.mult}</span><button class="btn sec sm fit" data-re="${d}|${m.slot}" title="Заменить блюдо">↻ другое</button></div>
          <h3>${r.name}</h3>
          ${macroLine(mm, m.mult)}</div></div></div>`;
      });
    });
  } else {
    if (!week || !week.some(d => d.length)) h += '<p class="hint">Сначала составь меню на неделю.</p>';
    else {
      const rows = shopRows(), need = rows.filter(i => i.rem > 0.5), have = rows.filter(i => i.rem <= 0.5);
      const row = (i, buy) => `<div class="shop ${buy ? '' : 'got'}">
        <label class="ck"><input type="checkbox" data-ck="${i.id}" ${buy ? '' : 'checked'}><span>${i.p.name}</span></label>
        <span class="q">${qty(i.id, buy ? i.rem : i.g)}${buy && i.st ? ` <span class="mu">(дома ${qty(i.id, i.st)} из ${qty(i.id, i.g)})</span>` : ''}</span>
        ${buy ? `<span class="links"><a href="${ozonUrl(i.p)}" target="_blank" rel="noopener">Ozon</a><a href="${vvUrl(i.p)}" target="_blank" rel="noopener">ВкусВилл</a></span>` + (showPrices ? priceRowHtml(i.id, i.rem) : '') : ''}</div>`;
      h += `<p class="hint">Отмечай галочкой то, что уже есть дома: продукт перейдёт вниз и запомнится на вкладке «Продукты». Если там указано, сколько продукта дома, здесь останется только недостающее. Количества на всю неделю, соль, специи и воду не считаем.</p>`;
      h += `<h2>🛒 Нужно купить: ${need.length}</h2>`;
      if (need.length) {
        h += `<button class="chip ${showPrices ? 'on' : ''}" id="ptoggle">₽ Сравнить цены</button>`;
        if (showPrices) h += priceSummaryHtml(need);
        let cat = '';
        need.forEach(i => { if (i.p.cat !== cat) { cat = i.p.cat; h += `<div class="mu" style="margin-top:8px">${CAT_EMO[cat] || ''} ${cat}</div>`; } h += row(i, true); });
        h += `<div class="row" style="margin-top:12px"><button class="btn" id="copy">Скопировать список</button></div>
        <p class="hint">Кнопки «Ozon» и «ВкусВилл» открывают поиск товара на сайте. Положить в корзину нужно самой, автоматически я этого сделать не могу.</p>`;
      } else h += '<p class="hint">Всё нужное уже есть. 🎉</p>';
      if (have.length) { h += `<h2>✅ Уже есть: ${have.length}</h2>`; have.forEach(i => h += row(i, false)); }
    }
  }
  $('#tab-week').innerHTML = h;
  document.querySelectorAll('#tab-week [data-v]').forEach(b => b.onclick = () => { weekView = b.dataset.v; renderWeek(); });
  const on = (sel, fn) => { const e = $(sel); if (e) e.onclick = fn; };
  const mode = v => { weekStrict = v; store.set('weekStrict', v); if (week) genWeek(); renderWeek(); };
  on('#wsoft', () => mode(false));
  on('#wstrict', () => mode(true));
  on('#wgen', () => { genWeek(); renderWeek(); });
  on('#copy', () => copyText('Список продуктов на неделю:\n' + shopRows().filter(i => i.rem > 0.5).map(i => `• ${i.p.name} — ${qty(i.id, i.rem)}`).join('\n')));
  bindPrices(renderWeek);
  on('#ptoggle', () => { showPrices = !showPrices; renderWeek(); });
  document.querySelectorAll('#tab-week [data-re]').forEach(b => b.onclick = e => {
    e.stopPropagation(); const [d, k] = b.dataset.re.split('|'); rerollMeal(+d, k); renderWeek();
  });
  document.querySelectorAll('#tab-week [data-ck]').forEach(c => c.onchange = () => {
    // галочка = «есть дома, хватает»: точное количество сбрасываем
    c.checked ? pantry.add(c.dataset.ck) : pantry.delete(c.dataset.ck);
    delete stock[c.dataset.ck]; store.set('stock', stock);
    savePantry(); renderWeek();
  });
  document.querySelectorAll('#tab-week .card[data-id]').forEach(c => c.onclick = () => openRecipe(c.dataset.id, +c.dataset.m, !!c.dataset.s));
}

// ---------- цели ----------
function renderProfile() {
  const p = profile;
  const sel = (v, a) => v == a ? 'selected' : '';
  $('#tab-profile').innerHTML = `<h1>Мои цели</h1>
  <div id="charbox">${characterCard(profile)}</div>
  <p class="hint">Заполни данные и нажми «Рассчитать» или впиши свою норму вручную.</p>
  <div class="grid2">
    <label class="f">Пол<select id="sex"><option value="f" ${sel(p.sex, 'f')}>Женский</option><option value="m" ${sel(p.sex, 'm')}>Мужской</option></select></label>
    <label class="f">Возраст<input type="number" id="age" value="${p.age}"></label>
    <label class="f">Рост, см<input type="number" id="h" value="${p.h}"></label>
    <label class="f">Вес, кг<input type="number" id="w" value="${p.w}"></label>
  </div>
  <label class="f" style="margin-top:10px">Активность
    <select id="act">
      <option value="1.2" ${sel(p.act, 1.2)}>Сидячий образ жизни</option>
      <option value="1.375" ${sel(p.act, 1.375)}>Лёгкая (1–3 тренировки в неделю)</option>
      <option value="1.55" ${sel(p.act, 1.55)}>Средняя (3–5 тренировок)</option>
      <option value="1.725" ${sel(p.act, 1.725)}>Высокая (6–7 тренировок)</option>
    </select></label>
  <label class="f" style="margin-top:10px">Цель
    <select id="goal">
      <option value="lose" ${sel(p.goal, 'lose')}>Похудение</option>
      <option value="keep" ${sel(p.goal, 'keep')}>Поддержание веса</option>
      <option value="gain" ${sel(p.goal, 'gain')}>Набор массы</option>
    </select></label>
  <div class="row" style="margin-top:12px"><button class="btn sec" id="calc">Рассчитать норму</button></div>
  <h2>Оформление</h2>
  <div class="chips">${Object.entries(THEMES).map(([k, n]) => `<button class="chip ${theme === k ? 'on' : ''}" data-theme="${k}">${n}</button>`).join('')}</div>
  <h2>Дневная норма</h2>
  <div class="grid2">
    <label class="f">Калории, ккал<input type="number" id="nk" value="${p.k}"></label>
    <label class="f">Белки, г<input type="number" id="np" value="${p.p}"></label>
    <label class="f">Жиры, г<input type="number" id="nf" value="${p.f}"></label>
    <label class="f">Углеводы, г<input type="number" id="nc" value="${p.c}"></label>
  </div>
  <p class="hint" id="chk"></p>
  <div class="row"><button class="btn" id="saveP">Сохранить</button></div>
  ${settingsHtml()}`;
  const read = () => {
    Object.assign(profile, {
      sex: $('#sex').value, age: +$('#age').value, h: +$('#h').value, w: +$('#w').value,
      act: +$('#act').value, goal: $('#goal').value
    });
  };
  const check = () => {
    const k = +$('#np').value * 4 + +$('#nf').value * 9 + +$('#nc').value * 4;
    $('#chk').textContent = `Калории и БЖУ связаны: меняешь калории — БЖУ пересчитываются в тех же пропорциях, меняешь БЖУ — пересчитываются калории. (Б×4 + Ж×9 + У×4 = ${round(k)} ккал)`;
  };
  const num = id => +$('#' + id).value || 0;
  // Доли калорий от белков/жиров/углеводов запоминаем отдельно и не выводим из округлённых полей,
  // иначе при наборе калорий по цифре маленькие значения округляются до 0 и доля жиров «залипает» в нуле.
  const calcShares = (p, f, c) => {
    const e = p * 4 + f * 9 + c * 4;
    return e > 0 ? [p * 4 / e, f * 9 / e, c * 4 / e] : [0.25, 0.27, 0.48];
  };
  let shares = calcShares(p.p, p.f, p.c);
  $('#nk').oninput = () => {
    const k = num('nk');
    $('#np').value = round(k * shares[0] / 4);
    $('#nf').value = round(k * shares[1] / 9);
    $('#nc').value = round(k * shares[2] / 4);
    check();
  };
  ['np', 'nf', 'nc'].forEach(i => $('#' + i).oninput = () => {
    shares = calcShares(num('np'), num('nf'), num('nc'));
    $('#nk').value = round(num('np') * 4 + num('nf') * 9 + num('nc') * 4);
    check();
  });
  check();
  document.querySelectorAll('#tab-profile [data-theme]').forEach(b => b.onclick = () => {
    theme = b.dataset.theme; store.set('theme', theme); applyTheme();
    document.querySelectorAll('#tab-profile [data-theme]').forEach(x => x.classList.toggle('on', x === b));
  });
  $('#calc').onclick = () => {
    if (!(+$('#age').value > 0 && +$('#h').value > 0 && +$('#w').value > 0)) { toast('Заполни возраст, рост и вес'); return; }
    read();
    const n = calcNorm();
    $('#nk').value = n.k; $('#np').value = n.p; $('#nf').value = n.f; $('#nc').value = n.c;
    shares = calcShares(n.p, n.f, n.c);
    check();
  };
  $('#saveP').onclick = () => {
    const next = Object.assign({}, profile, {
      sex: $('#sex').value, age: +$('#age').value, h: +$('#h').value, w: +$('#w').value,
      act: +$('#act').value, goal: $('#goal').value,
      k: +$('#nk').value, p: +$('#np').value, f: +$('#nf').value, c: +$('#nc').value
    });
    // сначала проверяем, и только потом меняем настройки, чтобы пустое поле не испортило сохранённую норму
    if (!(next.k > 0 && next.p > 0 && next.f > 0 && next.c >= 0)) { toast('Калории, белки и жиры должны быть больше нуля'); return; }
    Object.assign(profile, next);
    store.set('profile', profile); day = null; store.set('day', null);
    $('#saveP').textContent = 'Сохранено ✓';
    if (week) toast('Рацион на день сброшен. Меню недели составь заново');
    setTimeout(() => { const b = $('#saveP'); if (b) b.textContent = 'Сохранить'; }, 1500);
  };
  bindSettings();
  // персонаж меняется сразу, пока вводишь рост и вес
  const live = () => { $('#charbox').innerHTML = characterCard(Object.assign({}, profile, { h: +$('#h').value, w: +$('#w').value })); };
  $('#h').addEventListener('input', live); $('#w').addEventListener('input', live);
}

// ---------- старт ----------
// запуск — в boot.js, после загрузки features.js
