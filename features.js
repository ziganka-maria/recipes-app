'use strict';
// Дополнительные возможности: свои продукты и рецепты, запасы, цены, дневник и вес,
// ограничения в питании, напоминания, резервная копия.

const BACKUP_KEYS = ['pantry', 'stock', 'profile', 'custom', 'day', 'week', 'dayStrict', 'weekStrict', 'theme',
  'myProducts', 'myRecipes', 'prices', 'diary', 'weights', 'diet', 'reminders', 'remDone', 'activity', 'addBurn'];

const pad2 = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
const todayStr = () => ymd(new Date());
// пользовательский текст: убираем символы, которые ломают разметку
const clean = (s, n = 60) => String(s == null ? '' : s).replace(/[<>&"'`]/g, '').trim().slice(0, n);
const numOr = (v, d = 0) => { const x = parseFloat(String(v).replace(',', '.')); return isFinite(x) ? x : d; };
const r1 = x => Math.round(x * 10) / 10;

let stock = store.get('stock', {});       // id -> граммы дома
let prices = store.get('prices', {});     // id -> {o: цена в Ozon, v: цена во ВкусВилле}
let diary = store.get('diary', {});       // дата -> [{n, k, p, f, c}]
let weights = store.get('weights', {});   // дата -> кг
let diet = store.get('diet', { type: 'none', allergens: [], dislike: [] });
let myProducts = store.get('myProducts', []);
let myRecipes = store.get('myRecipes', []);

function openSheet(html) {
  $('#modal').innerHTML = '<div class="sheet">' + html + '</div>';
  $('#modal').hidden = false;
}
const rerenderTab = () => { const t = document.querySelector('nav .on'); if (t) showTab(t.dataset.tab); };

// ================= свои продукты =================
const CATS = ['Мясо и рыба', 'Молочное и яйца', 'Крупы и хлеб', 'Овощи и зелень', 'Фрукты и ягоды', 'Орехи, масла, прочее', 'Сладости и снеки', 'Соусы и специи', 'Напитки', 'Готовые блюда'];
const CAT_COLOR = { 'Мясо и рыба': '#e3a07a', 'Молочное и яйца': '#fff6e0', 'Крупы и хлеб': '#e7cf9a', 'Овощи и зелень': '#8fcf7c', 'Фрукты и ягоды': '#ee8a7a', 'Орехи, масла, прочее': '#c9a070', 'Сладости и снеки': '#d9a0b8', 'Соусы и специи': '#d98f5f', 'Напитки': '#8fc4e0', 'Готовые блюда': '#e0c27a' };

function registerProduct(p) {
  const row = [p.id, p.name, p.cat, p.k, p.p, p.f, p.c];
  const i = PRODUCTS.findIndex(a => a[0] === p.id);
  if (i >= 0) PRODUCTS[i] = row; else PRODUCTS.push(row);
  PR[p.id] = { id: p.id, name: p.name, cat: p.cat, k: p.k, p: p.p, f: p.f, c: p.c, mine: true };
  ART[p.id] = [CAT_COLOR[p.cat] || '#cfd8c0', 'blob'];
}
myProducts.forEach(registerProduct);
myRecipes.forEach(r => RC.push(Object.assign({ mine: true }, r)));

function productForm(id) {
  const p = id ? PR[id] : null;
  openSheet(`<div class="meal-h"><h1 style="margin:0">${p ? 'Изменить продукт' : 'Свой продукт'}</h1><button class="btn sec sm fit" id="fclose">Закрыть</button></div>
    <p class="hint">Перепиши значения с упаковки. Обычно они указаны на 100 г. Если на порцию или на всю упаковку, выбери это ниже и впиши вес.</p>
    <label class="f">Название<input type="text" id="upn" maxlength="40" value="${p ? p.name : ''}" placeholder="Например, сырок глазированный"></label>
    <label class="f" style="margin-top:8px">Категория<select id="upc">${CATS.map(c => `<option ${p && p.cat === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
    <label class="f" style="margin-top:8px">Значения указаны на<select id="upb"><option value="100">100 г</option><option value="x">порцию или упаковку</option></select></label>
    <label class="f" id="upwrap" hidden style="margin-top:8px">Вес порции или упаковки, г<input type="number" id="upw" inputmode="decimal"></label>
    <div class="grid2" style="margin-top:10px">
      <label class="f">Калории, ккал<input type="number" id="upk" inputmode="decimal" value="${p ? p.k : ''}" placeholder="можно пропустить"></label>
      <label class="f">Белки, г<input type="number" id="upp" inputmode="decimal" value="${p ? p.p : ''}"></label>
      <label class="f">Жиры, г<input type="number" id="upf" inputmode="decimal" value="${p ? p.f : ''}"></label>
      <label class="f">Углеводы, г<input type="number" id="upc2" inputmode="decimal" value="${p ? p.c : ''}"></label>
    </div>
    <p class="hint">Если калории пропустить, посчитаю сама: Б×4 + Ж×9 + У×4.</p>
    <div class="row" style="margin-top:8px"><button class="btn" id="upsave">Сохранить</button>${p ? '<button class="btn warn" id="updel">Удалить</button>' : ''}</div>`);
  $('#fclose').onclick = closeModal;
  $('#upb').onchange = () => { $('#upwrap').hidden = $('#upb').value !== 'x'; };
  $('#upsave').onclick = () => {
    const name = clean($('#upn').value, 40);
    if (!name) { toast('Впиши название'); return; }
    let w = 100;
    if ($('#upb').value === 'x') { w = numOr($('#upw').value); if (w <= 0) { toast('Впиши вес порции'); return; } }
    const f = 100 / w;
    const P = numOr($('#upp').value) * f, F = numOr($('#upf').value) * f, C = numOr($('#upc2').value) * f;
    const kRaw = $('#upk').value.trim();
    const K = kRaw === '' ? P * 4 + F * 9 + C * 4 : numOr(kRaw) * f;
    if (P + F + C > 100.5) { toast('Белки, жиры и углеводы вместе больше 100 г на 100 г: проверь значения'); return; }
    if (K <= 0 && P + F + C <= 0) { toast('Впиши хотя бы калории или БЖУ'); return; }
    const np = { id: p ? p.id : 'u_' + Date.now().toString(36), name, cat: $('#upc').value, k: r1(K), p: r1(P), f: r1(F), c: r1(C) };
    const i = myProducts.findIndex(x => x.id === np.id);
    if (i >= 0) myProducts[i] = np; else myProducts.push(np);
    store.set('myProducts', myProducts);
    registerProduct(np);
    closeModal(); toast('Продукт сохранён ✓');
  };
  const del = $('#updel');
  if (del) del.onclick = () => {
    if (myRecipes.some(r => r.ing.some(x => x[0] === p.id))) { toast('Продукт используется в твоём рецепте. Сначала убери его оттуда'); return; }
    myProducts = myProducts.filter(x => x.id !== p.id); store.set('myProducts', myProducts);
    const k = PRODUCTS.findIndex(a => a[0] === p.id); if (k >= 0) PRODUCTS.splice(k, 1);
    delete PR[p.id]; delete ART[p.id]; delete stock[p.id]; delete prices[p.id];
    pantry.delete(p.id); savePantry(); store.set('stock', stock); store.set('prices', prices);
    closeModal(); toast('Продукт удалён');
  };
}

function myProductsHtml() {
  if (!myProducts.length) return '';
  return `<h2>Мои продукты</h2>` + myProducts.map(p => `<div class="shop"><span class="ck" style="cursor:default"><span>${p.name}</span></span>
    <span class="q">${p.k} ккал · Б ${p.p} · Ж ${p.f} · У ${p.c}</span><button class="btn sec sm fit" data-editp="${p.id}">Изменить</button></div>`).join('');
}

// ================= запасы дома =================
function stockHtml() {
  const ids = [...pantry].filter(id => PR[id]);
  if (!ids.length) return '';
  return `<h2>Сколько дома</h2><p class="hint">По желанию: впиши граммы (яйцо весит около 55 г). Тогда список покупок учтёт запасы, а после готовки их можно списать.</p>` +
    ids.map(id => `<div class="stock"><span>${PR[id].name}</span><input type="number" inputmode="decimal" min="0" data-stock="${id}" placeholder="—" value="${stock[id] != null ? stock[id] : ''}"><span class="mu">${LIQ.has(id) ? 'мл' : 'г'}</span></div>`).join('');
}
function renderStock() {
  const box = $('#stockbox'); if (!box) return;
  box.innerHTML = stockHtml();
  box.querySelectorAll('[data-stock]').forEach(i => i.onchange = () => {
    const v = numOr(i.value, NaN);
    if (isFinite(v) && v >= 0) stock[i.dataset.stock] = v; else delete stock[i.dataset.stock];
    store.set('stock', stock);
  });
}
function bindPantryExtras() {
  const add = $('#addp'); if (add) add.onclick = () => productForm(null);
  document.querySelectorAll('#tab-pantry [data-editp]').forEach(b => b.onclick = () => productForm(b.dataset.editp));
  renderStock();
}
// списываем продукты после готовки; когда запас кончился, продукт убираем из «есть дома»
function consume(ings) {
  let used = 0;
  ings.forEach(([id, g]) => {
    if (stock[id] == null) return;
    stock[id] = Math.max(0, stock[id] - g); used++;
    if (stock[id] <= 0.5) { delete stock[id]; pantry.delete(id); }
  });
  store.set('stock', stock); savePantry();
  return used;
}

// ================= цены =================
const priceUnit = id => id === 'egg' ? '₽/10 шт' : LIQ.has(id) ? '₽/л' : '₽/кг';
const itemCost = (id, g, price) => id === 'egg' ? g / 55 / 10 * price : g / 1000 * price;
const rub = x => Math.round(x).toLocaleString('ru-RU') + ' ₽';

function priceRowHtml(id, grams) {
  const pr = prices[id] || {};
  const co = pr.o > 0 ? itemCost(id, grams, pr.o) : null, cv = pr.v > 0 ? itemCost(id, grams, pr.v) : null;
  const best = co != null && cv != null ? (co < cv ? 'o' : cv < co ? 'v' : '') : '';
  return `<div class="pricerow"><label class="${best === 'o' ? 'best' : ''}">Ozon<input type="number" inputmode="decimal" min="0" data-price="${id}|o" value="${pr.o || ''}" placeholder="${priceUnit(id)}"></label>
    <label class="${best === 'v' ? 'best' : ''}">ВкусВилл<input type="number" inputmode="decimal" min="0" data-price="${id}|v" value="${pr.v || ''}" placeholder="${priceUnit(id)}"></label>
    <span class="mu">${co != null ? 'Ozon ≈ ' + rub(co) : ''}${co != null && cv != null ? ' · ' : ''}${cv != null ? 'ВВ ≈ ' + rub(cv) : ''}</span></div>`;
}
function priceSummaryHtml(rows) {
  let both = 0, onlyO = 0, onlyV = 0, bestSum = 0, priced = 0, bo = 0, bv = 0;
  rows.forEach(r => {
    const pr = prices[r.id] || {};
    const co = pr.o > 0 ? itemCost(r.id, r.rem, pr.o) : null, cv = pr.v > 0 ? itemCost(r.id, r.rem, pr.v) : null;
    if (co != null && cv != null) { both++; bo += co; bv += cv; bestSum += Math.min(co, cv); priced++; }
    else if (co != null) { onlyO += co; bestSum += co; priced++; }
    else if (cv != null) { onlyV += cv; bestSum += cv; priced++; }
  });
  if (!priced) return '<p class="hint">Впиши цены под товарами (за кг, литр или десяток яиц), и я посчитаю, где корзина выгоднее. Цены запомнятся на следующий раз.</p>';
  let h = `<div class="card tot" style="margin:10px 0"><b>Примерная стоимость</b>`;
  if (both) {
    const w = bo < bv ? 'Ozon' : bv < bo ? 'ВкусВилл' : '';
    h += `<div class="mu" style="margin-top:4px">Там, где есть цена в обоих магазинах (${both} шт): Ozon ${rub(bo)}, ВкусВилл ${rub(bv)}.</div>`;
    h += w ? `<div class="best-note">Выгоднее ${w}: дешевле на ${rub(Math.abs(bo - bv))}</div>` : '<div class="best-note">Цены одинаковые</div>';
  }
  const single = [onlyO ? 'Ozon ' + rub(onlyO) : '', onlyV ? 'ВкусВилл ' + rub(onlyV) : ''].filter(Boolean).join(', ');
  if (single) h += `<div class="mu" style="margin-top:4px">Цена только в одном магазине: ${single}.</div>`;
  h += `<div style="margin-top:4px">Если брать каждый товар там, где дешевле: <b>${rub(bestSum)}</b> (оценено ${priced} из ${rows.length} товаров)</div></div>`;
  return h;
}
function bindPrices(rerender) {
  document.querySelectorAll('[data-price]').forEach(i => i.onchange = () => {
    const [id, k] = i.dataset.price.split('|'), v = numOr(i.value, 0);
    prices[id] = Object.assign({}, prices[id]); if (v > 0) prices[id][k] = v; else delete prices[id][k];
    store.set('prices', prices); rerender();
  });
}

// ================= свои рецепты =================
function recipeForm(id) {
  const r = id ? RC.find(x => x.id === id) : null;
  const ings = r ? ingsOf(r).map(x => x.slice()) : [['chicken_breast', 100]];
  let type = r ? r.type : 'm';
  const opts = sel => PRODUCTS.map(a => `<option value="${a[0]}" ${a[0] === sel ? 'selected' : ''}>${a[1]}</option>`).join('');
  const draw = () => {
    openSheet(`<div class="meal-h"><h1 style="margin:0">${r ? 'Изменить рецепт' : 'Свой рецепт'}</h1><button class="btn sec sm fit" id="fclose">Закрыть</button></div>
      <label class="f">Название<input type="text" id="rn" maxlength="60" value="${r ? r.name : ''}" placeholder="Например, бабушкины сырники"></label>
      <div class="grid2" style="margin-top:8px">
        <label class="f">Тип<select id="rt"><option value="b" ${type === 'b' ? 'selected' : ''}>Завтрак</option><option value="m" ${type === 'm' ? 'selected' : ''}>Обед / ужин</option><option value="s" ${type === 's' ? 'selected' : ''}>Перекус</option></select></label>
        <label class="f">Время, мин<input type="number" id="rm" value="${r ? r.time : 20}"></label>
      </div>
      <h2>Ингредиенты на 1 порцию (граммы)</h2>
      <div id="ri">${ings.map((x, n) => `<div class="ing"><select data-n="${n}">${opts(x[0])}</select><input type="number" inputmode="decimal" min="0" data-g="${n}" value="${x[1]}"><button class="x" data-del="${n}">✕</button></div>`).join('')}</div>
      <div class="row" style="margin-top:8px"><select id="radd"><option value="">+ Добавить ингредиент…</option>${opts('')}</select></div>
      <label class="f" style="margin-top:10px">Как готовить<textarea id="rs" rows="4" maxlength="800">${r ? r.steps : ''}</textarea></label>
      <div class="row" style="margin-top:12px"><button class="btn" id="rsave">Сохранить</button>${r && r.mine ? '<button class="btn warn" id="rdel">Удалить</button>' : ''}</div>`);
    $('#fclose').onclick = closeModal;
    const keep = () => { ings.forEach((x, n) => { const g = document.querySelector(`#ri [data-g="${n}"]`); if (g) x[1] = numOr(g.value); }); type = $('#rt').value; typed = { name: $('#rn').value, time: $('#rm').value, steps: $('#rs').value }; };
    document.querySelectorAll('#ri select').forEach(s => s.onchange = () => { ings[+s.dataset.n][0] = s.value; });
    document.querySelectorAll('#ri input').forEach(i => i.onchange = () => { ings[+i.dataset.g][1] = numOr(i.value); });
    document.querySelectorAll('#ri [data-del]').forEach(b => b.onclick = () => { keep(); ings.splice(+b.dataset.del, 1); redraw(); });
    $('#radd').onchange = e => { if (e.target.value) { keep(); ings.push([e.target.value, 50]); redraw(); } };
    $('#rsave').onclick = () => {
      keep();
      const name = clean($('#rn').value);
      const good = ings.filter(x => x[1] > 0 && PR[x[0]]);
      if (!name) { toast('Впиши название'); return; }
      if (!good.length) { toast('Добавь хотя бы один ингредиент с граммами'); return; }
      const rec = { id: r ? r.id : 'm_' + Date.now().toString(36), name, type, time: Math.max(1, Math.round(numOr($('#rm').value, 20))), ing: good, steps: clean($('#rs').value, 800) || 'Приготовь по своему рецепту.' };
      const i = myRecipes.findIndex(x => x.id === rec.id);
      if (i >= 0) myRecipes[i] = rec; else myRecipes.push(rec);
      store.set('myRecipes', myRecipes);
      const j = RC.findIndex(x => x.id === rec.id);
      const full = Object.assign({ mine: true }, rec);
      if (j >= 0) RC[j] = full; else RC.push(full);
      delete custom[rec.id]; store.set('custom', custom);
      closeModal(); toast('Рецепт сохранён ✓');
    };
    const del = $('#rdel');
    if (del) del.onclick = () => {
      myRecipes = myRecipes.filter(x => x.id !== r.id); store.set('myRecipes', myRecipes);
      const j = RC.findIndex(x => x.id === r.id); if (j >= 0) RC.splice(j, 1);
      delete custom[r.id]; store.set('custom', custom);
      day = null; store.set('day', null);
      closeModal(); toast('Рецепт удалён');
    };
  };
  // перерисовка формы с сохранением уже введённого текста
  let typed = null;
  const redraw = () => { draw(); if (typed) { $('#rn').value = typed.name; $('#rm').value = typed.time; $('#rs').value = typed.steps; } };
  draw();
}

// ================= дневник и вес =================
let diaryDate = todayStr();
const shiftDate = (s, n) => { const [Y, M, D] = s.split('-').map(Number); return ymd(new Date(Y, M - 1, D + n)); };
function dateLabel(s) {
  if (s === todayStr()) return 'Сегодня';
  if (s === shiftDate(todayStr(), -1)) return 'Вчера';
  const [Y, M, D] = s.split('-'); return D + '.' + M + '.' + Y;
}
function diaryTotals(date) {
  const t = { k: 0, p: 0, f: 0, c: 0 };
  (diary[date] || []).forEach(e => { t.k += e.k; t.p += e.p; t.f += e.f; t.c += e.c; });
  return t;
}
function addDiary(date, e) {
  (diary[date] = diary[date] || []).push({ n: clean(e.n, 60) || 'Без названия', k: Math.max(0, e.k), p: Math.max(0, e.p), f: Math.max(0, e.f), c: Math.max(0, e.c) });
  store.set('diary', diary);
}
function chartLine(pts) {
  const W = 300, H = 120, pl = 34, pr = 10, pt = 12, pb = 20;
  const ys = pts.map(p => p.y); let mn = Math.min(...ys), mx = Math.max(...ys);
  if (mn === mx) { mn -= 1; mx += 1; }
  const padv = (mx - mn) * .2; mn -= padv; mx += padv;
  const X = i => pl + (pts.length === 1 ? (W - pl - pr) / 2 : i * (W - pl - pr) / (pts.length - 1));
  const Y = y => pt + (H - pt - pb) * (1 - (y - mn) / (mx - mn));
  const d = pts.map((p, i) => (i ? 'L' : 'M') + r1(X(i)) + ' ' + r1(Y(p.y))).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="График веса">
    <line x1="${pl}" y1="${Y(mx - padv)}" x2="${W - pr}" y2="${Y(mx - padv)}" class="grid"/><line x1="${pl}" y1="${Y(mn + padv)}" x2="${W - pr}" y2="${Y(mn + padv)}" class="grid"/>
    <text x="${pl - 4}" y="${Y(mx - padv) + 4}" text-anchor="end">${r1(mx - padv)}</text><text x="${pl - 4}" y="${Y(mn + padv) + 4}" text-anchor="end">${r1(mn + padv)}</text>
    <path d="${d}" fill="none" class="ln"/>${pts.map((p, i) => `<circle cx="${r1(X(i))}" cy="${r1(Y(p.y))}" r="3.2" class="dot"/>`).join('')}
    <text x="${pl}" y="${H - 4}">${pts[0].l}</text><text x="${W - pr}" y="${H - 4}" text-anchor="end">${pts[pts.length - 1].l}</text></svg>`;
}
function chartBars(days, target) {
  const W = 300, H = 130, pl = 8, pr = 8, pt = 14, pb = 22;
  const mx = Math.max(target * 1.25, ...days.map(d => d.k), 1);
  const bw = (W - pl - pr) / days.length, Y = v => pt + (H - pt - pb) * (1 - v / mx);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Калории за неделю">
    ${days.map((d, i) => `<rect x="${r1(pl + i * bw + bw * .18)}" y="${r1(Y(d.k))}" width="${r1(bw * .64)}" height="${r1(Math.max(0, H - pb - Y(d.k)))}" rx="4" class="bar2 ${d.k > target * 1.1 ? 'over' : ''}"/>
    <text x="${r1(pl + i * bw + bw / 2)}" y="${H - 6}" text-anchor="middle">${d.l}</text>`).join('')}
    <line x1="${pl}" y1="${r1(Y(target))}" x2="${W - pr}" y2="${r1(Y(target))}" class="target"/><text x="${W - pr}" y="${r1(Y(target)) - 3}" text-anchor="end">норма ${target}</text></svg>`;
}
const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

function renderDiary() {
  const list = diary[diaryDate] || [], tot = diaryTotals(diaryDate);
  const acts = activity[diaryDate] || [], burned = burnedOn(diaryDate);
  // если включено «прибавлять к норме», норма дня растёт на сожжённое, а Б/Ж/У — пропорционально
  const kT = profile.k + (addBurn ? burned : 0), s = profile.k ? kT / profile.k : 1;
  let h = `<h1>Дневник</h1>
  <div class="row dnav"><button class="btn sec sm fit" id="dprev" aria-label="Предыдущий день">◀</button><b style="text-align:center">${dateLabel(diaryDate)}</b>
  <button class="btn sec sm fit" id="dnext" aria-label="Следующий день" ${diaryDate >= todayStr() ? 'disabled' : ''}>▶</button></div>
  ${diaryDate === todayStr() ? characterCard(profile, true) : ''}
  <div class="card" style="margin-top:10px"><b>Съедено</b>${bar('Калории', tot.k, kT, 'ккал')}${bar('Белки', tot.p, profile.p * s, 'г')}${bar('Жиры', tot.f, profile.f * s, 'г')}${bar('Углеводы', tot.c, profile.c * s, 'г')}
    <div class="burnline"><span>🔥 Сожжено: <b>${burned}</b> ккал</span><span>Осталось: <b>${Math.max(0, round(kT - tot.k))}</b> ккал</span></div>
    <div class="mu">${burned ? (addBurn ? `Норма на сегодня выросла на ${burned} ккал за счёт тренировок.` : 'Норма не меняется: тренировки уже учтены в уровне активности. Изменить можно во вкладке «Цели».') : ''}</div></div>
  <div class="row" style="margin:10px 0"><button class="btn sm" id="dd">+ Блюдо</button><button class="btn sm" id="dp">+ Продукт</button><button class="btn sm sec" id="dm">+ Вручную</button></div>`;
  h += list.length ? list.map((e, i) => `<div class="entry"><div><b>${e.n}</b><div class="mu">${round(e.k)} ккал · Б ${round(e.p)} · Ж ${round(e.f)} · У ${round(e.c)}</div></div><button class="x" data-del="${i}" aria-label="Удалить">✕</button></div>`).join('')
    : '<p class="hint">Пока пусто. Добавь блюдо, продукт или впиши вручную. Блюдо можно отметить прямо из рецепта кнопкой «Съела».</p>';
  h += `<h2>Активность</h2>
  <div class="row" style="margin:6px 0 10px"><button class="btn sm" id="wd">✎ Описать</button><button class="btn sm" id="wl2">+ Из списка</button><button class="btn sm sec" id="wmn">+ Вручную</button></div>`;
  h += acts.length ? acts.map((e, i) => `<div class="entry"><div><b>${e.n}</b><div class="mu">${e.kcal} ккал${e.min ? ' · ' + e.min + ' мин' : ''}</div></div><button class="x" data-adel="${i}" aria-label="Удалить">✕</button></div>`).join('')
    : '<p class="hint">Опиши тренировку словами, например «бег 30 минут, потом растяжка 15», выбери из списка или впиши калории с часов.</p>';

  const wv = weights[diaryDate];
  const wk = Object.keys(weights).sort().slice(-30);
  h += `<h2>Вес</h2><div class="card"><div class="row"><label class="f">Вес за ${dateLabel(diaryDate).toLowerCase()}, кг<input type="number" inputmode="decimal" step="0.1" id="wv" value="${wv != null ? wv : ''}"></label>
    <button class="btn fit" id="wsave" style="align-self:flex-end">Записать</button></div>`;
  if (wk.length >= 2) {
    const first = weights[wk[0]], last = weights[wk[wk.length - 1]], dl = r1(last - first);
    h += chartLine(wk.map(k => ({ l: k.slice(8) + '.' + k.slice(5, 7), y: weights[k] })));
    h += `<div class="mu">С ${wk[0].slice(8)}.${wk[0].slice(5, 7)}: ${first} → ${last} кг (${dl > 0 ? '+' : ''}${dl})</div>`;
  } else if (wk.length === 1) h += '<div class="mu" style="margin-top:6px">Запиши вес ещё раз в другой день, и появится график.</div>';
  h += '</div>';

  const days = [];
  for (let i = 6; i >= 0; i--) { const s = shiftDate(todayStr(), -i), [Y, M, D] = s.split('-').map(Number); days.push({ k: round(diaryTotals(s).k), l: WD[new Date(Y, M - 1, D).getDay()] }); }
  h += `<h2>Калории за 7 дней</h2><div class="card">${chartBars(days, profile.k)}</div>`;
  $('#tab-diary').innerHTML = h;

  $('#dprev').onclick = () => { diaryDate = shiftDate(diaryDate, -1); renderDiary(); };
  $('#dnext').onclick = () => { if (diaryDate < todayStr()) { diaryDate = shiftDate(diaryDate, 1); renderDiary(); } };
  document.querySelectorAll('#tab-diary [data-del]').forEach(b => b.onclick = () => { diary[diaryDate].splice(+b.dataset.del, 1); store.set('diary', diary); renderDiary(); });
  $('#wsave').onclick = () => {
    const v = numOr($('#wv').value, 0);
    if (v < 20 || v > 400) { toast('Введи вес в килограммах'); return; }
    weights[diaryDate] = r1(v); store.set('weights', weights); renderDiary(); toast('Вес записан ✓');
  };
  $('#dd').onclick = pickDish;
  $('#dp').onclick = pickProduct;
  $('#dm').onclick = manualEntry;
  $('#wd').onclick = describeWorkout;
  $('#wl2').onclick = pickWorkout;
  $('#wmn').onclick = manualWorkout;
  document.querySelectorAll('#tab-diary [data-adel]').forEach(b => b.onclick = () => { activity[diaryDate].splice(+b.dataset.adel, 1); store.set('activity', activity); renderDiary(); });
}

function pickerSheet(title, rowsFn, addFn) {
  openSheet(`<div class="meal-h"><h1 style="margin:0">${title}</h1><button class="btn sec sm fit" id="fclose">Закрыть</button></div>
    <input type="text" id="psearch" placeholder="Поиск…" style="margin:10px 0"><div id="plist"></div>`);
  $('#fclose').onclick = closeModal;
  const draw = () => {
    const q = $('#psearch').value.trim().toLowerCase();
    const rows = rowsFn().filter(r => !q || r.name.toLowerCase().includes(q)).slice(0, 80);
    $('#plist').innerHTML = rows.length ? rows.map(r => `<div class="pick"><div><b>${r.name}</b><div class="mu">${r.sub}</div></div>
      <input type="number" inputmode="decimal" min="0" step="any" value="${r.def}" data-v="${r.id}"><span class="mu">${r.unit}</span><button class="btn sm fit" data-add="${r.id}">+</button></div>`).join('')
      : '<p class="hint">Ничего не найдено.</p>';
    document.querySelectorAll('#plist [data-add]').forEach(b => b.onclick = () => {
      const v = numOr(document.querySelector(`#plist [data-v="${b.dataset.add}"]`).value);
      if (v <= 0) { toast('Впиши количество'); return; }
      addFn(b.dataset.add, v); toast('Добавлено в дневник ✓');
    });
  };
  $('#psearch').oninput = draw; draw();
}
function pickDish() {
  pickerSheet('Блюдо', () => RC.map(r => { const m = macros(ingsOf(r)); return { id: r.id, name: r.name, sub: `${round(m.k)} ккал на порцию`, def: 1, unit: 'порц.' }; }),
    (id, mult) => {
      const r = RC.find(x => x.id === id), m = macros(ingsOf(r));
      addDiary(diaryDate, { n: r.name + (mult !== 1 ? ' ×' + mult : ''), k: m.k * mult, p: m.p * mult, f: m.f * mult, c: m.c * mult });
    });
}
function pickProduct() {
  pickerSheet('Продукт', () => PRODUCTS.map(a => ({ id: a[0], name: a[1], sub: `${a[3]} ккал на 100 г`, def: 100, unit: LIQ.has(a[0]) ? 'мл' : 'г' })),
    (id, g) => {
      const p = PR[id], f = g / 100;
      addDiary(diaryDate, { n: `${p.name}, ${g} ${LIQ.has(id) ? 'мл' : 'г'}`, k: p.k * f, p: p.p * f, f: p.f * f, c: p.c * f });
    });
}
function manualEntry() {
  openSheet(`<div class="meal-h"><h1 style="margin:0">Вручную</h1><button class="btn sec sm fit" id="fclose">Закрыть</button></div>
    <label class="f" style="margin-top:8px">Что съела<input type="text" id="mn" maxlength="60" placeholder="Например, кофе с молоком"></label>
    <div class="grid2" style="margin-top:8px">
      <label class="f">Калории<input type="number" id="mk" inputmode="decimal"></label><label class="f">Белки, г<input type="number" id="mp" inputmode="decimal"></label>
      <label class="f">Жиры, г<input type="number" id="mf" inputmode="decimal"></label><label class="f">Углеводы, г<input type="number" id="mc" inputmode="decimal"></label></div>
    <div class="row" style="margin-top:12px"><button class="btn" id="msave">Добавить</button></div>`);
  $('#fclose').onclick = closeModal;
  $('#msave').onclick = () => {
    const p = numOr($('#mp').value), f = numOr($('#mf').value), c = numOr($('#mc').value);
    const kRaw = $('#mk').value.trim(), k = kRaw === '' ? p * 4 + f * 9 + c * 4 : numOr(kRaw);
    const n = clean($('#mn').value);
    if (!n) { toast('Впиши название'); return; }
    if (k <= 0) { toast('Впиши калории или БЖУ'); return; }
    addDiary(diaryDate, { n, k, p, f, c }); closeModal(); toast('Добавлено ✓');
  };
}
// ================= активность и сожжённые калории =================
// Коэффициенты нагрузки (MET) по таблице Compendium of Physical Activities: [легко, средне, тяжело].
// Считаем расход сверх покоя: (MET − 1) × вес × часы — так тренировка не дублирует базовый обмен из нормы.
// Порядок важен: сначала конкретные занятия, потом общая «Тренировка», потом ходьба
// (иначе «сходила в зал» или «ходила на йогу» распознались бы как ходьба).
const ACTS = [
  { id: 'run', name: 'Бег', kw: ['бег', 'беж', 'пробежк', 'джогинг'], met: [7.0, 9.8, 11.5], kmMin: 6 },
  { id: 'skate', name: 'Коньки / ролики', kw: ['коньк', 'ролик'], met: [5.5, 7.0, 9.8] },
  { id: 'bike', name: 'Велосипед', kw: ['велосипед', 'вело', 'велик', 'сайкл', 'педали'], met: [4.0, 6.8, 10.0], kmMin: 3 },
  { id: 'swim', name: 'Плавание', kw: ['плава', 'плыл', 'бассейн'], met: [5.8, 8.0, 9.8], kmMin: 30 },
  { id: 'hiit', name: 'Круговая / интервальная', kw: ['кругов', 'интервал', 'кроссфит', 'hiit', 'табат', 'функциональн', 'берпи'], met: [6.0, 8.0, 10.0] },
  { id: 'strength', name: 'Силовая', kw: ['силов', 'тренажер', 'штанг', 'гантел', 'качал', 'присед', 'отжим', 'пресс', 'планк', 'подтяг', 'выпад', 'становая', 'жим леж'], met: [3.5, 5.0, 6.0] },
  { id: 'yoga', name: 'Йога', kw: ['йог'], met: [2.3, 3.0, 4.0] },
  { id: 'pilates', name: 'Пилатес', kw: ['пилатес'], met: [2.8, 3.0, 3.8] },
  { id: 'stretch', name: 'Растяжка', kw: ['растяж', 'растяг', 'стретч', 'зарядк'], met: [2.3, 2.5, 3.0] },
  { id: 'dance', name: 'Танцы', kw: ['танц', 'зумб'], met: [4.5, 6.0, 7.8] },
  { id: 'aerobics', name: 'Аэробика / фитнес', kw: ['аэробик', 'фитнес', 'кардио'], met: [5.0, 6.5, 7.3] },
  { id: 'ellipse', name: 'Эллипс', kw: ['эллипс', 'орбитрек'], met: [4.5, 5.0, 6.0] },
  { id: 'stairs', name: 'Лестница / степпер', kw: ['лестниц', 'степпер', 'ступеньк'], met: [5.0, 8.0, 9.0] },
  { id: 'rope', name: 'Скакалка', kw: ['скакалк', 'прыгала на скакал'], met: [8.8, 11.8, 12.3] },
  { id: 'ski', name: 'Лыжи', kw: ['лыж'], met: [6.8, 9.0, 12.5], kmMin: 7 },
  { id: 'racket', name: 'Теннис / бадминтон', kw: ['теннис', 'бадминтон', 'сквош'], met: [5.0, 7.3, 8.0] },
  { id: 'team', name: 'Футбол / баскетбол / волейбол', kw: ['футбол', 'баскетбол', 'волейбол', 'хоккей'], met: [4.0, 7.0, 9.0] },
  { id: 'row', name: 'Гребля', kw: ['гребл', 'гребн', 'байдарк'], met: [4.8, 7.0, 8.5] },
  { id: 'box', name: 'Бокс / единоборства', kw: ['бокс', 'единоборств', 'карате', 'кикбокс'], met: [5.5, 7.8, 10.0] },
  { id: 'hike', name: 'Поход', kw: ['поход', 'хайкинг', 'в гору', 'по горам'], met: [5.3, 6.0, 7.8], kmMin: 15 },
  { id: 'clean', name: 'Уборка', kw: ['уборк', 'убира', 'мыла пол', 'пылесос'], met: [2.5, 3.3, 4.0] },
  { id: 'garden', name: 'Сад / огород', kw: ['огород', 'грядк', 'на даче', 'в саду'], met: [3.0, 4.0, 5.0] },
  { id: 'workout', name: 'Тренировка', kw: ['тренировк', 'тренил', 'в зале', 'в зал', 'занимал', 'спорт'], met: [3.5, 5.0, 7.0] },
  { id: 'walk', name: 'Ходьба', kw: ['ходьб', 'ходил', 'хожд', 'гуля', 'прогул', 'пешк', 'пешком', 'шаг', 'прошла', 'прошел'], met: [2.8, 3.5, 5.0], kmMin: 12 }
];
const WALK = ACTS.find(a => a.id === 'walk');
const LEVELS = ['легко', 'средне', 'интенсивно'];
let activity = store.get('activity', {});   // дата -> [{n, kcal, min}]
let addBurn = store.get('addBurn', false);  // прибавлять сожжённое к норме

// расчёт ведём для веса из профиля («Цели»)
const workoutWeight = () => profile.w > 0 ? profile.w : 60;
const actKcal = (act, level, min, kg) => Math.max(0, Math.round((act.met[level] - 1) * kg * min / 60));
const burnedOn = date => (activity[date] || []).reduce((a, e) => a + e.kcal, 0);

// «сорок пять минут» → «45 минут», «два часа» → «2 часа»
const NUM_W = { один: 1, одна: 1, одну: 1, два: 2, две: 2, три: 3, четыре: 4, пять: 5, шесть: 6, семь: 7, восемь: 8, девять: 9, десять: 10,
  пятнадцать: 15, двадцать: 20, тридцать: 30, сорок: 40, пятьдесят: 50, шестьдесят: 60, семьдесят: 70, восемьдесят: 80, девяносто: 90, сто: 100 };
const wordsToDigits = t => t
  .replace(/(двадцать|тридцать|сорок|пятьдесят|шестьдесят|семьдесят|восемьдесят|девяносто)(?:\s+(один|одна|одну|два|две|три|четыре|пять|шесть|семь|восемь|девять))?(?![а-я])/g,
    (m, a, b) => String(NUM_W[a] + (b ? NUM_W[b] : 0)))
  .replace(/(^|[^а-я])(один|одна|одну|два|две|три|четыре|пять|шесть|семь|восемь|девять|десять|пятнадцать|сто)(?![а-я])/g, (m, pre, w) => pre + NUM_W[w]);

// длительность и прочие числа из одной части описания
function partNumbers(p, act) {
  let min = 0;
  if (/полтора час/.test(p)) min += 90; else if (/полчаса/.test(p)) min += 30;
  const h = p.match(/(\d+(?:[.,]\d+)?)\s*(?:часа|часов|час|ч)(?![а-я])/);
  if (h) min += numOr(h[1]) * 60; else if (!min && /(^|[^а-я])час(?![а-я])/.test(p)) min += 60;
  const m = p.match(/(\d+)\s*(?:минут[а-я]*|мин|м)(?![а-я])/);
  if (m) min += numOr(m[1]);
  const km = p.match(/(\d+(?:[.,]\d+)?)\s*(?:км|килом)/);
  const steps = p.match(/(\d[\d\s]*)\s*шаг/);
  const kc = p.match(/(\d+)\s*(?:ккал|kcal|калор)/);
  if (!min && km && act && act.kmMin) min = numOr(km[1]) * act.kmMin;
  if (!min && steps) min = numOr(steps[1].replace(/\s/g, '')) / 100;   // около 100 шагов в минуту
  if (!min && !kc) { const bare = p.match(/(?:^|\s)(\d{1,3})(?:\s|$)/); if (bare && +bare[1] >= 5) min = +bare[1]; }
  return { min, kcal: kc ? numOr(kc[1]) : 0 };
}

// Разбор описания тренировки обычными словами. Работает без интернета по ключевым словам.
// Позже сюда можно добавить ИИ: он вернёт такой же список частей {act, min, level, kcal}.
function parseWorkout(text, kg) {
  const t = wordsToDigits(String(text).toLowerCase().replace(/ё/g, 'е'));
  // запятая внутри числа («1,5 ч») — не разделитель
  const parts = t.split(/,(?!\d)|[;\n+.]\s|[;\n+]|\s(?:и|потом|затем|а потом|плюс|после этого|после)\s/).map(s => s.trim()).filter(Boolean);
  const found = [], unknown = [], noTime = [];
  let pending = null;   // занятие без времени: «отжимания и пресс 20 минут» — время берём из следующей части
  parts.forEach(p => {
    let act = ACTS.find(a => a.kw.some(k => p.includes(k))) || null;
    const n = partNumbers(p, act);
    if (!act && /шаг/.test(p)) act = WALK;
    let level = 1;
    if (/легк|спокойн|медленн|не спеша|разминк|неторопл/.test(p)) level = 0;
    if (/интенсив|быстр|тяжел|сильно|в горку|спринт|на максимум|выложил|до пота/.test(p)) level = 2;
    if (act && !n.min && !n.kcal) { if (pending) noTime.push(pending.act.name); pending = { act, level }; return; }
    if (!act && pending && (n.min || n.kcal)) { act = pending.act; level = Math.max(level, pending.level); pending = null; }
    // «сходила в зал, позанималась на тренажёрах 50 мин» — общее «тренировка» сливается с конкретным занятием
    else if (act && pending) { if (pending.act === act || pending.act.id === 'workout') level = Math.max(level, pending.level); else noTime.push(pending.act.name); pending = null; }
    if (!act) { if (!n.min && !n.kcal) unknown.push(p); else unknown.push(p + ' (не поняла, какое занятие)'); return; }
    const kcal = n.kcal || actKcal(act, level, n.min, kg);
    found.push({ act, min: Math.round(n.min), level, kcal: Math.round(kcal), own: !!n.kcal });
  });
  if (pending) noTime.push(pending.act.name);
  return { found, unknown, noTime };
}
const partName = f => `${f.act.name}${f.min ? ', ' + f.min + ' мин' : ''}${f.level !== 1 ? ' (' + LEVELS[f.level] + ')' : ''}`;
function addActivity(date, e) {
  (activity[date] = activity[date] || []).push({ n: clean(e.n, 60) || 'Активность', kcal: Math.max(0, Math.round(e.kcal)), min: Math.round(e.min || 0) });
  store.set('activity', activity);
}

function describeWorkout() {
  const kg = workoutWeight();
  openSheet(`<div class="meal-h"><h1 style="margin:0">Опиши тренировку</h1><button class="btn sec sm fit" id="fclose">Закрыть</button></div>
    <p class="hint">Пиши как удобно: что делала, сколько минут и как тяжело. Части можно разделять запятой или словом «потом». Считаю для веса ${kg} кг из профиля.</p>
    <textarea id="wtext" rows="3" placeholder="бег 30 минут, потом силовая 40 мин интенсивно"></textarea>
    <div id="wprev" style="margin-top:8px"></div>
    <div class="row" style="margin-top:10px"><button class="btn" id="wadd">Добавить</button></div>`);
  $('#fclose').onclick = closeModal;
  let res = { found: [], unknown: [], noTime: [] };
  const draw = () => {
    res = parseWorkout($('#wtext').value, kg);
    $('#wprev').innerHTML = (res.found.length ? res.found.map(f => `<div class="entry"><div><b>${partName(f)}</b><div class="mu">${f.own ? 'калории из текста' : 'оценка по таблице нагрузок'}</div></div><b>${f.kcal} ккал</b></div>`).join('')
      + `<div class="best-note">Всего: ${res.found.reduce((a, f) => a + f.kcal, 0)} ккал</div>` : '')
      + (res.noTime.length ? `<p class="hint">Для «${res.noTime.join('», «')}» не указано время: допиши, сколько минут.</p>` : '')
      + (res.unknown.length ? `<p class="hint">Не поняла: «${res.unknown.map(s => clean(s)).join('», «')}». Напиши вид занятия и время, например «йога 40 мин», или выбери из списка.</p>` : '');
  };
  $('#wtext').oninput = draw;
  $('#wadd').onclick = () => {
    draw();
    if (!res.found.length) { toast('Не нашла ни одной тренировки в описании'); return; }
    res.found.forEach(f => addActivity(diaryDate, { n: partName(f), kcal: f.kcal, min: f.min }));
    closeModal(); toast('Тренировка записана ✓');
  };
}
function pickWorkout() {
  const kg = workoutWeight();
  let level = 1;
  openSheet(`<div class="meal-h"><h1 style="margin:0">Из списка</h1><button class="btn sec sm fit" id="fclose">Закрыть</button></div>
    <label class="f" style="margin-top:8px">Занятие<select id="wa">${ACTS.map(a => `<option value="${a.id}">${a.name}</option>`).join('')}</select></label>
    <label class="f" style="margin-top:8px">Длительность, мин<input type="number" id="wm" inputmode="numeric" value="30" min="1"></label>
    <div class="mu" style="margin-top:8px">Интенсивность:</div>
    <div class="chips" id="wl">${LEVELS.map((n, i) => `<button class="chip ${i === level ? 'on' : ''}" data-l="${i}">${n}</button>`).join('')}</div>
    <div class="best-note" id="wk"></div><p class="hint">Для веса ${kg} кг из профиля, сверх обычного расхода в покое.</p>
    <div class="row" style="margin-top:6px"><button class="btn" id="wadd">Добавить</button></div>`);
  $('#fclose').onclick = closeModal;
  const act = () => ACTS.find(a => a.id === $('#wa').value);
  const calc = () => actKcal(act(), level, numOr($('#wm').value), kg);
  const draw = () => { $('#wk').textContent = '≈ ' + calc() + ' ккал'; };
  $('#wa').onchange = draw; $('#wm').oninput = draw;
  document.querySelectorAll('#wl [data-l]').forEach(b => b.onclick = () => {
    level = +b.dataset.l; document.querySelectorAll('#wl [data-l]').forEach(x => x.classList.toggle('on', x === b)); draw();
  });
  draw();
  $('#wadd').onclick = () => {
    const min = numOr($('#wm').value);
    if (min <= 0) { toast('Впиши минуты'); return; }
    addActivity(diaryDate, { n: partName({ act: act(), min, level }), kcal: calc(), min });
    closeModal(); toast('Записано ✓');
  };
}
function manualWorkout() {
  openSheet(`<div class="meal-h"><h1 style="margin:0">Вручную</h1><button class="btn sec sm fit" id="fclose">Закрыть</button></div>
    <p class="hint">Например, калории с часов, браслета или тренажёра.</p>
    <label class="f">Что делала<input type="text" id="wn" maxlength="60" placeholder="Тренировка в зале"></label>
    <div class="grid2" style="margin-top:8px"><label class="f">Сожжено, ккал<input type="number" id="wkc" inputmode="numeric"></label>
    <label class="f">Минут (необязательно)<input type="number" id="wmin" inputmode="numeric"></label></div>
    <div class="row" style="margin-top:12px"><button class="btn" id="wadd">Добавить</button></div>`);
  $('#fclose').onclick = closeModal;
  $('#wadd').onclick = () => {
    const k = numOr($('#wkc').value);
    if (k <= 0 || k > 5000) { toast('Впиши сожжённые калории'); return; }
    addActivity(diaryDate, { n: clean($('#wn').value) || 'Тренировка', kcal: k, min: numOr($('#wmin').value) });
    closeModal(); toast('Записано ✓');
  };
}

// из окна рецепта
function eatRecipe(r, mult, ings) {
  const m = macros(ings);
  addDiary(todayStr(), { n: r.name + (mult !== 1 ? ' ×' + mult : ''), k: m.k, p: m.p, f: m.f, c: m.c });
}

// ================= ограничения в питании =================
const GROUP = {
  meat: ['chicken_breast', 'chicken_thigh', 'turkey', 'beef', 'minced', 'ham'], fish: ['salmon', 'cod', 'tuna'], seafood: ['shrimp'],
  dairy: ['milk', 'kefir', 'greek_yogurt', 'cottage', 'cheese', 'sour_cream', 'butter'], egg: ['egg'], honey: ['honey'],
  gluten: ['oats', 'pasta', 'bread', 'flour'], nuts: ['walnut', 'almond', 'peanut_butter'], soy: ['tofu', 'soy_sauce']
};
Object.keys(EXTRA_GROUPS).forEach(k => GROUP[k].push(...EXTRA_GROUPS[k]));
const DIETS = [['none', 'Ем всё'], ['pesc', 'Без мяса, рыба можно'], ['veg', 'Вегетарианство'], ['vegan', 'Веганство']];
const ALLERGENS = [['dairy', 'Молочное'], ['egg', 'Яйца'], ['gluten', 'Глютен'], ['nuts', 'Орехи'], ['fish', 'Рыба'], ['seafood', 'Морепродукты'], ['soy', 'Соя'], ['honey', 'Мёд']];
let bannedCache = null;
function bannedSet() {
  if (!bannedCache) {
    const s = new Set(diet.dislike || []), add = k => GROUP[k].forEach(i => s.add(i)), t = diet.type;
    if (t === 'pesc' || t === 'veg' || t === 'vegan') add('meat');
    if (t === 'veg' || t === 'vegan') { add('fish'); add('seafood'); }
    if (t === 'vegan') { add('dairy'); add('egg'); add('honey'); }
    (diet.allergens || []).forEach(a => GROUP[a] && add(a));
    bannedCache = s;
  }
  return bannedCache;
}
const isBanned = id => bannedSet().has(id);
const recipeAllowed = r => !ingsOf(r).some(([id]) => isBanned(id));
function dietChanged() {
  bannedCache = null; store.set('diet', diet);
  day = null; week = null; genCache = null; store.set('day', null); store.set('week', null);
  toast('Рацион и меню недели сброшены: составь заново');
}

// ================= напоминания =================
const REM_DEFAULT = [
  { id: 'shop', label: 'Заказать продукты на неделю', time: '12:00', days: [6], on: false },
  { id: 'defrost', label: 'Достать мясо или рыбу на завтра', time: '20:00', days: [0, 1, 2, 3, 4, 5, 6], on: false },
  { id: 'weigh', label: 'Взвеситься', time: '08:00', days: [0, 1, 2, 3, 4, 5, 6], on: false },
  { id: 'log', label: 'Записать, что съела', time: '21:00', days: [0, 1, 2, 3, 4, 5, 6], on: false }
];
let reminders = REM_DEFAULT.map(d => Object.assign({}, d, (store.get('reminders', []) || []).find(x => x.id === d.id) || {}));
let remDone = store.get('remDone', {});
const DAY_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const todayIdx = () => (new Date().getDay() + 6) % 7;

function tomorrowMeat() {
  if (!week) return null;
  const meals = week[(todayIdx() + 1) % 7] || [], names = new Set(), dishes = [];
  const raw = new Set([...GROUP.meat, ...GROUP.fish, ...GROUP.seafood]);
  meals.forEach(m => {
    const r = m.dish || getRecipe(m.id); if (!r) return;
    const hit = mealIngs(r, m.strict).filter(([id]) => raw.has(id));
    if (hit.length) { dishes.push(r.name); hit.forEach(([id]) => names.add(PR[id].name.toLowerCase())); }
  });
  return dishes.length ? `Завтра в меню: ${dishes.join(', ')}. Достань из морозилки: ${[...names].join(', ')}.` : null;
}
function remText(r) {
  if (r.id === 'shop') return 'Пора заказать продукты на неделю.';
  if (r.id === 'defrost') return tomorrowMeat();
  if (r.id === 'weigh') return weights[todayStr()] ? null : 'Взвесься и запиши вес.';
  if (r.id === 'log') return (diary[todayStr()] || []).length ? null : 'Запиши, что сегодня съела.';
  return r.label;
}
function dueReminders() {
  const now = new Date(), hm = pad2(now.getHours()) + ':' + pad2(now.getMinutes()), t = todayStr(), idx = todayIdx();
  return reminders.filter(r => r.on && r.days.includes(idx) && r.time <= hm && remDone[r.id] !== t)
    .map(r => ({ r, text: remText(r) })).filter(x => x.text);
}
const notified = {};
function renderBanner() {
  const box = $('#banner'); if (!box) return;
  const due = dueReminders();
  box.innerHTML = due.map(({ r, text }) => `<div class="card note"><div class="meal-h"><b>${r.label}</b>
    <button class="btn sm fit" data-done="${r.id}">Готово</button></div><div class="mu">${text}</div>
    ${r.id === 'shop' ? '<button class="btn sec sm" data-go="shop" style="margin-top:6px">Открыть список</button>' : ''}
    ${r.id === 'weigh' || r.id === 'log' ? '<button class="btn sec sm" data-go="diary" style="margin-top:6px">Открыть дневник</button>' : ''}</div>`).join('');
  box.querySelectorAll('[data-done]').forEach(b => b.onclick = () => { remDone[b.dataset.done] = todayStr(); store.set('remDone', remDone); renderBanner(); });
  box.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { if (b.dataset.go === 'shop') weekView = 'shop'; showTab(b.dataset.go === 'shop' ? 'week' : 'diary'); });
  if ('Notification' in window && Notification.permission === 'granted') {
    due.forEach(({ r, text }) => {
      const key = r.id + todayStr(); if (notified[key]) return; notified[key] = 1;
      try { navigator.serviceWorker.getRegistration().then(reg => reg ? reg.showNotification(r.label, { body: text }) : new Notification(r.label, { body: text })); } catch (e) { }
    });
  }
}
function downloadFile(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 500);
}
function icsText() {
  const BY = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'], now = new Date();
  const stamp = now.getFullYear() + pad2(now.getMonth() + 1) + pad2(now.getDate()) + 'T' + pad2(now.getHours()) + pad2(now.getMinutes()) + '00';
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//recipes//RU', 'CALSCALE:GREGORIAN'];
  reminders.filter(r => r.on && r.days.length).forEach(r => {
    const d = new Date(); let guard = 0;
    while (!r.days.includes((d.getDay() + 6) % 7) && guard++ < 8) d.setDate(d.getDate() + 1);
    const start = d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) + 'T' + r.time.replace(':', '') + '00';
    L.push('BEGIN:VEVENT', `UID:rem-${r.id}@recipes`, `DTSTAMP:${stamp}`, `DTSTART:${start}`, 'DURATION:PT15M',
      `RRULE:FREQ=WEEKLY;BYDAY=${r.days.map(i => BY[i]).join(',')}`, `SUMMARY:${r.label}`,
      'BEGIN:VALARM', 'TRIGGER:PT0M', 'ACTION:DISPLAY', `DESCRIPTION:${r.label}`, 'END:VALARM', 'END:VEVENT');
  });
  L.push('END:VCALENDAR');
  return L.join('\r\n');
}

// ================= резервная копия =================
function exportBackup() {
  const data = {};
  BACKUP_KEYS.forEach(k => { try { const v = localStorage.getItem(k); if (v !== null) data[k] = JSON.parse(v); } catch (e) { } });
  downloadFile('recipes-backup-' + todayStr() + '.json', JSON.stringify({ app: 'recipes', v: 1, saved: new Date().toISOString(), data }), 'application/json');
  toast('Копия сохранена в файл ✓');
}
function importBackup(file) {
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { toast('Файл слишком большой'); return; }
  const rd = new FileReader();
  rd.onload = () => {
    let obj;
    try { obj = JSON.parse(rd.result); } catch (e) { toast('Это не файл копии'); return; }
    if (!obj || obj.app !== 'recipes' || !obj.data || typeof obj.data !== 'object') { toast('Это не файл копии этого приложения'); return; }
    if (!confirm('Заменить все данные на телефоне данными из файла? Текущие продукты, рецепты и дневник будут перезаписаны.')) return;
    BACKUP_KEYS.forEach(k => { if (k in obj.data) { try { localStorage.setItem(k, JSON.stringify(obj.data[k])); } catch (e) { } } });
    location.reload();
  };
  rd.readAsText(file);
}

// ================= раздел настроек во вкладке «Цели» =================
function settingsHtml() {
  const chip = (on, attr, text) => `<button class="chip ${on ? 'on' : ''}" ${attr}>${text}</button>`;
  let h = `<h2>Ограничения в питании</h2>
    <p class="hint">Заблокированные продукты не попадут в рецепты, рацион и меню недели.</p>
    <div class="chips" id="dietchips">${DIETS.map(([k, n]) => chip(diet.type === k, `data-diet="${k}"`, n)).join('')}</div>
    <div class="mu" style="margin:10px 0 4px">Аллергии и непереносимость:</div>
    <div class="chips" id="allchips">${ALLERGENS.map(([k, n]) => chip((diet.allergens || []).includes(k), `data-all="${k}"`, n)).join('')}</div>
    <details style="margin-top:10px"><summary class="mu" style="cursor:pointer">Не ем отдельные продукты${(diet.dislike || []).length ? ' (' + diet.dislike.length + ')' : ''}</summary>
      <div class="chips" id="dischips" style="margin-top:8px">${PRODUCTS.map(a => chip((diet.dislike || []).includes(a[0]), `data-dis="${a[0]}"`, a[1])).join('')}</div></details>`;
  h += `<h2>Тренировки</h2>
    <p class="hint">Если при расчёте нормы ты уже выбрала активность с тренировками, не прибавляй сожжённое, иначе тренировки посчитаются дважды.</p>
    <div class="chips">${chip(!addBurn, 'data-burn="0"', 'Только показывать')}${chip(addBurn, 'data-burn="1"', 'Прибавлять к норме дня')}</div>`;
  h += `<h2>Напоминания</h2>
    <p class="hint">Подсказки появятся вверху приложения, когда придёт время. Чтобы телефон напоминал и при закрытом приложении, скачай их в календарь.</p>`;
  h += reminders.map((r, i) => `<div class="card remcard"><label class="ck" style="display:flex;gap:10px;align-items:center"><input type="checkbox" data-ron="${i}" ${r.on ? 'checked' : ''}><b>${r.label}</b></label>
    <div class="row" style="margin-top:8px"><input type="time" data-rtime="${i}" value="${r.time}" style="max-width:130px"></div>
    <div class="chips" style="margin-top:8px">${DAY_SHORT.map((n, d) => chip(r.days.includes(d), `data-rday="${i}|${d}"`, n)).join('')}</div></div>`).join('');
  h += `<div class="row" style="margin-top:8px"><button class="btn sec" id="notif">Разрешить уведомления</button><button class="btn sec" id="ics">В календарь (.ics)</button></div>
    <p class="hint">Уведомления приложения работают, пока оно открыто или свёрнуто. Надёжнее всего календарь.</p>`;
  h += `<h2>Резервная копия</h2><p class="hint">Все данные хранятся только в браузере телефона. Сохрани копию в файл, чтобы не потерять их, если очистишь данные браузера или купишь новый телефон.</p>
    <div class="row"><button class="btn sec" id="bkexp">Сохранить в файл</button><button class="btn sec" id="bkimp">Загрузить из файла</button></div>
    <input type="file" id="bkfile" accept="application/json,.json" hidden>`;
  return h;
}
function bindSettings() {
  document.querySelectorAll('#tab-profile [data-diet]').forEach(b => b.onclick = () => {
    diet.type = b.dataset.diet; dietChanged();
    document.querySelectorAll('#tab-profile [data-diet]').forEach(x => x.classList.toggle('on', x === b));
  });
  const toggle = (attr, arr) => document.querySelectorAll(`#tab-profile [${attr}]`).forEach(b => b.onclick = () => {
    const v = b.getAttribute(attr), list = diet[arr] = diet[arr] || [], i = list.indexOf(v);
    i >= 0 ? list.splice(i, 1) : list.push(v);
    b.classList.toggle('on'); dietChanged();
  });
  toggle('data-all', 'allergens'); toggle('data-dis', 'dislike');
  document.querySelectorAll('#tab-profile [data-burn]').forEach(b => b.onclick = () => {
    addBurn = b.dataset.burn === '1'; store.set('addBurn', addBurn);
    document.querySelectorAll('#tab-profile [data-burn]').forEach(x => x.classList.toggle('on', x === b));
  });
  document.querySelectorAll('#tab-profile [data-ron]').forEach(c => c.onchange = () => { reminders[+c.dataset.ron].on = c.checked; saveReminders(); });
  document.querySelectorAll('#tab-profile [data-rtime]').forEach(c => c.onchange = () => { if (c.value) { reminders[+c.dataset.rtime].time = c.value; saveReminders(); } });
  document.querySelectorAll('#tab-profile [data-rday]').forEach(b => b.onclick = () => {
    const [i, d] = b.dataset.rday.split('|').map(Number), days = reminders[i].days, k = days.indexOf(d);
    k >= 0 ? days.splice(k, 1) : days.push(d); days.sort();
    b.classList.toggle('on'); saveReminders();
  });
  $('#notif').onclick = () => {
    if (!('Notification' in window)) { toast('Этот браузер не поддерживает уведомления'); return; }
    Notification.requestPermission().then(p => toast(p === 'granted' ? 'Уведомления включены ✓' : 'Уведомления не разрешены'));
  };
  $('#ics').onclick = () => {
    if (!reminders.some(r => r.on)) { toast('Сначала включи хотя бы одно напоминание'); return; }
    downloadFile('recipes-reminders.ics', icsText(), 'text/calendar'); toast('Файл готов: открой его на телефоне');
  };
  $('#bkexp').onclick = exportBackup;
  $('#bkimp').onclick = () => $('#bkfile').click();
  $('#bkfile').onchange = e => importBackup(e.target.files[0]);
}
function saveReminders() { store.set('reminders', reminders); renderBanner(); }
