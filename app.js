'use strict';

const $ = id => document.getElementById(id);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const store = {
  get: (k, d = null) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
  del: k => { try { localStorage.removeItem(k); } catch {} },
  json: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }
};

const THEMES = ['ios-dark', 'ios-light'];
const HOUR = 36e5;
const MAX_HISTORY = 50;
const PURITY = [['၁၅ ပဲရည်', 17], ['၁၄ ပဲ ၂ ပြားရည်', 17.5], ['၁၄ ပဲရည်', 18], ['၁၃ ပဲရည်', 19], ['၁၂ ပဲရည်', 20]];
const UNITS = [[100000, 'သိန်း'], [10000, 'သောင်း'], [1000, 'ထောင်'], [100, 'ရာ'], [10, 'ဆယ်']];
const MY_DIGITS = [...'၀၁၂၃၄၅၆၇၈၉'];
const WEIGHT_DEFAULT = '၀ ကျပ် ၀ ပဲ ၀ ရွေး';

const S = { banner: true, nav: true, purity: false, calc: null, from: 'price-calc', theme: 0, timer: 0, install: null };
let history = store.json('calcHistory', []);
let invoice = store.json('invoiceList', []);

const num = v => parseFloat(v) || 0;
const val = id => num($(id).value);
const fmt = n => Math.round(n).toLocaleString('en-US');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const toMy = n => String(n).replace(/\d/g, d => MY_DIGITS[d]);
const icons = () => window.lucide && window.lucide.createIcons();
const setIcon = (btn, name) => { btn.innerHTML = `<i data-lucide="${name}"></i>`; icons(); };

function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(S.timer);
  S.timer = setTimeout(() => el.classList.remove('show'), 2400);
}

const breakdown = n => {
  let r = Math.floor(n);
  const out = [];
  for (const [u, name] of UNITS) {
    const q = Math.floor(r / u);
    r %= u;
    if (q > 0) out.push([q, name]);
  }
  if (r > 0) out.push([r, '']);
  return out;
};
const fmtUnits = n => (n > 0 ? breakdown(Math.round(n)).map(([q, u]) => q + u).join('') : '');
const numToBurmeseText = n => {
  n = Math.floor(n);
  if (!n || isNaN(n) || n <= 0) return '၀ ကျပ်';
  return breakdown(n).map(([q, u]) => toMy(q) + (u ? ' ' + u : '')).join(' ') + ' ကျပ်';
};

const toDecimal = (k, p, y) => num(k) + num(p) / 16 + num(y) / 128;
const split = d => {
  let k = Math.floor(d + 1e-7);
  const r = (d - k) * 16;
  let p = Math.floor(r + 1e-7);
  let y = +((r - p) * 8).toFixed(2);
  if (y >= 8) { p++; y = 0; }
  if (p >= 16) { k++; p = 0; }
  return [k, p, y];
};
const weightStr = (k, p, y) => [k > 0 && `${k} ကျပ်`, p > 0 && `${p} ပဲ`, y > 0 && `${y} ရွေး`].filter(Boolean).join(' ');
const fromDecimal = d => weightStr(...split(d)) || '၀ ကျပ်';
const diamondStr = (r, b, p) => [r > 0 && `${r}R`, b > 0 && `${b}B`, p > 0 && `${p}P`].filter(Boolean).join(' ');

function buildWeights() {
  $$('[data-w]').forEach(box => {
    const ids = box.dataset.w.split(',');
    const ph = (box.dataset.ph || 'ကျပ်,ပဲ,ရွေး').split(',');
    ids.forEach((id, i) => {
      const el = document.createElement('input');
      el.type = 'number';
      el.id = id;
      el.inputMode = 'decimal';
      el.placeholder = ph[i];
      el.className = `inp inp-center ${box.dataset.cls || ''}`.trim();
      if (i === 2) el.step = '0.01';
      if (!box.hasAttribute('data-nr')) el.dataset.g = box.dataset.w;
      box.appendChild(el);
    });
  });
  $$('[data-mm]').forEach(el => {
    const label = document.createElement('div');
    label.className = 'mm-text';
    label.id = `mm-${el.id}`;
    label.setAttribute('aria-live', 'polite');
    el.insertAdjacentElement('afterend', label);
  });
}

function mmLabel(el) {
  if (!el.hasAttribute('data-mm')) return;
  $(`mm-${el.id}`).textContent = fmtUnits(num(el.value));
}

function rollover(ids) {
  if (!$('rollover-toggle').checked) return;
  const [k, p, y] = ids.map($);
  let kv = num(k.value), pv = num(p.value), yv = num(y.value);
  if (yv >= 8) {
    pv += Math.floor(yv / 8);
    yv = +(yv % 8).toFixed(2);
    y.value = yv || '';
    p.value = pv || '';
  }
  if (pv >= 16) {
    kv += Math.floor(pv / 16);
    pv %= 16;
    p.value = pv || '';
    k.value = kv || '';
  }
  ids.forEach(id => store.set(id, $(id).value));
}

function setPurityVisible(show) {
  S.purity = !!show;
  $('pp-card').hidden = !S.purity;
  const btn = $('purity-toggle-btn');
  btn.classList.toggle('active', S.purity);
  btn.setAttribute('aria-pressed', String(S.purity));
  $('purity-toggle-state').textContent = S.purity ? 'ON' : 'OFF';
}

function togglePurity() {
  setPurityVisible(!S.purity);
  store.set('purityVisible', S.purity);
}

async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {}
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  ta.setSelectionRange(0, text.length);
  let ok = false;
  try { ok = document.execCommand('copy'); } catch {}
  ta.remove();
  return ok;
}

async function copyPurity(btn) {
  const raw = btn.dataset.val;
  const label = btn.dataset.label;
  if (!raw) return;
  const ok = await copyText(raw);
  if (!ok) return toast('ကူးယူ၍မရပါ');
  btn.classList.add('copied');
  const ico = btn.querySelector('.pp-copy-ico');
  if (ico) {
    ico.innerHTML = '<i data-lucide="check"></i>';
    icons();
  }
  toast(`${label} (${fmt(num(raw))} ကျပ်) ကူးယူပြီးပါပြီ`);
  clearTimeout(btn._t);
  btn._t = setTimeout(() => {
    btn.classList.remove('copied');
    if (ico) {
      ico.innerHTML = '<i data-lucide="copy"></i>';
      icons();
    }
  }, 1400);
}

function purityPrices() {
  const p = val('GoldPrice');
  const box = $('pp-list');
  if (p <= 0) {
    box.innerHTML = '<div class="pp-empty">၁၆ ပဲရည် ယနေ့ပေါက်ဈေး ထည့်ပါ</div>';
    return;
  }
  const rows = [['၁၆ ပဲရည်', p], ...PURITY.map(([label, d]) => [label, (16 / d) * p])];
  box.innerHTML = rows.map(([label, a]) => {
    const raw = Math.round(a);
    return `<div class="pp-row"><span>${label}</span><button type="button" class="pp-copy" data-act="copy-pp" data-val="${raw}" data-label="${label}" aria-label="Copy ${label}"><div><b>${fmt(a)} ကျပ်</b><small>${fmtUnits(a)}</small></div><span class="pp-copy-ico"><i data-lucide="copy"></i></span></button></div>`;
  }).join('');
  icons();
}

function netWeight() {
  const net = Math.max(0, toDecimal(val('TKat'), val('TPe'), val('TYway')) - toDecimal(val('SKat'), val('SPe'), val('SYway')));
  $('netDisplay').textContent = fromDecimal(net);
  $('netSubDisplay').textContent = `(${net.toFixed(4)} ကျပ်)`;
  return net;
}

function useNetWeight() {
  const [k, p, y] = split(netWeight());
  [['PKat', k], ['PPe', p], ['PYway', y]].forEach(([id, v]) => {
    $(id).value = v > 0 ? v : '';
    store.set(id, $(id).value);
  });
  showView('price-calc');
  toast('ရွှေအလေးချိန်သို့ ထည့်သွင်းပြီးပါပြီ');
}

function convertUnits(source) {
  const factor = val('standard');
  let kyat = 0;
  if (source === 'grams') {
    kyat = val('gramsInput') / factor;
    const [k, p, y] = split(kyat);
    $('uKyat').value = k > 0 ? k : '';
    $('uPe').value = p > 0 ? p : '';
    $('uYway').value = y > 0 ? y : '';
  } else {
    kyat = toDecimal($('uKyat').value, $('uPe').value, $('uYway').value);
    $('gramsInput').value = kyat > 0 ? (kyat * factor).toFixed(3) : '';
  }
  $('uDisplay').textContent = fromDecimal(kyat);
  $('uSubDisplay').textContent = `(${kyat.toFixed(4)} ကျပ်) | ${(kyat * factor).toFixed(3)} g`;
}

function convertDiamond(mode) {
  if (mode === 'ct') $('convGm').value = (val('convCt') * 0.2).toFixed(4);
  else $('convCt').value = (val('convGm') / 0.2).toFixed(4);
}

function calcBudget() {
  const b = val('b-amount'), p = val('b-price');
  if (b > 0 && p > 0) {
    const d = b / p;
    $('b-result').textContent = fromDecimal(d);
    $('b-sub-result').textContent = `(${d.toFixed(4)} ကျပ်)`;
  } else {
    $('b-result').textContent = WEIGHT_DEFAULT;
    $('b-sub-result').textContent = '(0.0000 ကျပ်)';
  }
  const line = (label, n) => (n > 0 ? `<div>${label}: ${fmt(n)} ကျပ်<small>${fmtUnits(n)}</small></div>` : '');
  $('b-money').innerHTML = line('ဘတ်ဂျက်ငွေ', b) + line('ယနေ့ရွှေဈေး', p);
}

function equivPrice() {
  const price = val('DiamondPrice');
  const out = $('equivPriceDisplay');
  if (price === 0) { out.textContent = ''; return; }
  out.textContent = $('DiamondPriceType').value === 'carat'
    ? `≈ ${fmt(price / 1.1)} ကျပ် (၁ ရတီလျှင်)`
    : `≈ ${fmt(price * 1.1)} ကျပ် (၁ ကာရက်လျှင်)`;
}

function syncDiamond(mode) {
  const dr = $('DR'), db = $('DB'), dp = $('DP'), dct = $('DCt');
  if (mode === 'ct') {
    const ratti = num(dct.value) * 1.1;
    const r = Math.floor(ratti + 1e-5);
    const remB = (ratti - r) * 20;
    const b = Math.floor(remB + 1e-5);
    const p = +((remB - b) * 8).toFixed(2);
    dr.value = r || '';
    db.value = b || '';
    dp.value = p > 0 ? p : '';
  } else {
    let r = num(dr.value), b = num(db.value), p = num(dp.value);
    if (p >= 8) { b += Math.floor(p / 8); p = +(p % 8).toFixed(2); db.value = b; dp.value = p > 0 ? p : ''; }
    if (b >= 20) { r += Math.floor(b / 20); b %= 20; dr.value = r; db.value = b > 0 ? b : ''; }
    dct.value = ((r + b / 20 + p / 160) / 1.1).toFixed(4);
  }
}

function calcPurity() {
  const isPurity = $('tab-purity').classList.contains('active');
  const box = $('purity-result');
  if (isPurity) {
    const raw = toDecimal(val('p1-k'), val('p1-p'), val('p1-y'));
    const pure = toDecimal(val('p2-k'), val('p2-p'), val('p2-y'));
    if (raw <= 0 || pure <= 0) return toast('အလေးချိန်မှန်ကန်စွာထည့်ပါ။');
    box.hidden = false;
    $('p-res-label').textContent = 'တွက်ချက်ရရှိသော ရွှေအရည်အသွေး';
    $('p-res-val').textContent = `${((pure / raw) * 16).toFixed(2)} ပဲရည်`;
    $('p-res-detail').textContent = `Density (စက်ပွိုင့်): ${((pure / raw) * 19.32).toFixed(2)}`;
    return;
  }
  const raw = toDecimal(val('y1-k'), val('y1-p'), val('y1-y'));
  const den = val('y-den'), pe = val('y-pe');
  let kyat;
  if (den > 0) kyat = (den / 19.32) * raw;
  else if (pe > 0) kyat = (pe / 16) * raw;
  else return toast('Density (သို့မဟုတ်) ပဲရည် တစ်ခုခုထည့်ပါ။');
  box.hidden = false;
  $('p-res-label').textContent = 'ပြန်ရမည့် အခေါက်ရွှေပမာဏ';
  $('p-res-val').textContent = fromDecimal(kyat);
  $('p-res-detail').textContent = `စုစုပေါင်းဒသမကိန်း: ${kyat.toFixed(6)} ကျပ်`;
}

const R = {
  title: s => `<div class="r-title">${s}</div>`,
  row: (a, b) => `<div class="r-row"><span>${a}</span><b>${b}</b></div>`,
  note: s => (s ? `<div class="r-note">(အလေးချိန်: ${s})</div>` : ''),
  total: (n, cls = '') => `<div class="r-total ${cls}">${fmt(n)} ကျပ်</div><div class="r-mm">${numToBurmeseText(n)}</div>`
};

function commit(type, sig, html, total, summary) {
  S.calc = { amount: total, summary };
  saveHistory({ type, sig: `${type}|${sig}`, html, total, summary });
  const box = $('res-list');
  box.innerHTML = html;
  box.classList.toggle('result-box-diamond', type === 'diamond');
  showView('price-result');
}

function calcPrice() {
  const price = val('GoldPrice');
  const [pk, pp, py] = ['PKat', 'PPe', 'PYway'].map(val);
  const [rk, rp, ry] = ['RKat', 'RPae', 'RYway'].map(val);
  const smith = val('Smith'), stone = val('StonePrice');
  const gold = toDecimal(pk, pp, py), red = toDecimal(rk, rp, ry);
  const total = gold * price + red * price + smith + stone;
  const html = R.title('ရွှေတွက်ချက်မှု') + R.row('ယနေ့ဈေး:', price.toLocaleString()) + R.row('ရွှေဖိုး:', fmt(gold * price)) + R.note(weightStr(pk, pp, py)) +
    R.row('လျော့တွက်ဖိုး:', fmt(red * price)) + R.note(weightStr(rk, rp, ry)) + R.row('လက်ခ+ကျောက်:', (smith + stone).toLocaleString()) + R.total(total);
  commit('gold', [price, pk, pp, py, rk, rp, ry, smith, stone].join(','), html, total, `ရွှေ (${pk}K ${pp}P ${py}Y)`);
}

function calcDiamond() {
  const price = val('DiamondPrice');
  const type = $('DiamondPriceType').value;
  const ct = val('DCt'), r = val('DR'), b = val('DB'), p = val('DP');
  const total = type === 'carat' ? ct * price : (r + b / 20 + p / 160) * price;
  const ws = diamondStr(r, b, p);
  const note = ct > 0 ? `${ct} Ct${ws ? ' - ' + ws : ''}` : '';
  const html = R.title('စိန်/ရတနာ တွက်ချက်မှု') + R.row('သတ်မှတ်ဈေး:', price.toLocaleString()) + R.row('စိန်/ရတနာဖိုး:', fmt(total)) + R.note(note) + R.total(total, 'd');
  commit('diamond', [type, price, ct, r, b, p].join(','), html, total, `စိန်/ရတနာ (${ct} Ct)`);
}

function saveHistory(e) {
  const now = Date.now();
  if (history.some(h => h.sig === e.sig && now - (h.ts || h.id) < HOUR)) {
    toast('တူညီသော တွက်ချက်မှုကို ၁ နာရီအတွင်း မှတ်တမ်းတင်ပြီးဖြစ်သည်');
    return;
  }
  history.unshift({ id: now, ts: now, v: 2, type: e.type, sig: e.sig, summary: e.summary, total: Math.round(e.total), html: e.html });
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
  store.set('calcHistory', JSON.stringify(history));
  renderHistory();
}

function renderHistory() {
  const list = $('history-list');
  if (!history.length) {
    list.innerHTML = '<div class="card empty-card">မှတ်တမ်းမရှိသေးပါ</div>';
    return;
  }
  list.innerHTML = history.map((h, i) => `
    <div class="history-item" data-act="view-hist" data-id="${h.id}">
      <div>${h.html}<div class="history-time">${new Date(h.ts || h.id).toLocaleString()}</div></div>
      <button class="mini-btn" data-act="del-hist" data-i="${i}" aria-label="Delete"><i data-lucide="trash-2"></i></button>
    </div>`).join('');
  icons();
}

function viewHistory(id) {
  const h = history.find(i => i.id === id);
  if (!h) return;
  const html = h.v ? h.html : h.html.replace(/font-size:21px/g, 'font-size:27px').replace(/font-size:14px/g, 'font-size:16px');
  const time = `<div class="history-time" style="text-align:center;font-size:12.5px;margin-top:16px">တွက်ချက်ခဲ့သော အချိန် - ${new Date(h.ts || h.id).toLocaleString()}</div>`;
  const box = $('res-list');
  box.innerHTML = html + time;
  box.classList.toggle('result-box-diamond', h.type === 'diamond' || h.html.includes('စိန်/ရတနာ'));
  S.calc = null;
  showView('price-result');
}

function historyRows() {
  return history.map(h => ({
    time: new Date(h.ts || h.id).toISOString(),
    type: h.type || (h.html.includes('စိန်/ရတနာ') ? 'diamond' : 'gold'),
    summary: h.summary || '',
    total_kyat: h.total ?? '',
    details: new DOMParser().parseFromString(h.html, 'text/html').body.textContent.replace(/\s+/g, ' ').trim()
  }));
}

function exportHistory(kind) {
  if (!history.length) return toast('မှတ်တမ်းမရှိသေးပါ');
  const rows = historyRows();
  const stamp = new Date().toISOString().slice(0, 10);
  if (kind === 'json') {
    downloadBlob(new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' }), `ShweCalc_History_${stamp}.json`);
  } else {
    const cols = Object.keys(rows[0]);
    const cell = v => `"${String(v).replace(/"/g, '""')}"`;
    const csv = '\uFEFF' + [cols.join(','), ...rows.map(r => cols.map(c => cell(r[c])).join(','))].join('\r\n');
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `ShweCalc_History_${stamp}.csv`);
  }
  toast('မှတ်တမ်း ထုတ်ယူပြီးပါပြီ');
}

function renderInvoice() {
  const badge = $('invoice-badge');
  badge.hidden = !invoice.length;
  badge.textContent = invoice.length;
  if (!invoice.length) {
    $('invoice-list').innerHTML = '<div class="card empty-card">ဘောင်ချာစာရင်း မရှိသေးပါ</div>';
    $('invoice-total').textContent = '၀ ကျပ်';
    $('invoice-total-text').textContent = '၀ ကျပ်';
    return;
  }
  const total = invoice.reduce((s, i) => s + i.amount, 0);
  $('invoice-list').innerHTML = invoice.map((it, i) => `
    <div class="card inv-item">
      <div><div class="inv-title">${esc(it.title)}</div><div class="inv-amt">${fmt(it.amount)} ကျပ်</div></div>
      <button class="mini-btn" data-act="del-inv" data-i="${i}" aria-label="Remove"><i data-lucide="minus-circle"></i></button>
    </div>`).join('');
  $('invoice-total').textContent = `${fmt(total)} ကျပ်`;
  $('invoice-total-text').textContent = numToBurmeseText(total);
  icons();
}

const saveInvoiceList = () => { store.set('invoiceList', JSON.stringify(invoice)); renderInvoice(); };

function addToInvoice() {
  if (!S.calc) return toast('မှတ်တမ်းဟောင်းများကို ဘောင်ချာသို့ထည့်၍မရပါ');
  invoice.push({ id: Date.now(), title: S.calc.summary, amount: S.calc.amount });
  saveInvoiceList();
  toast('ဘောင်ချာသို့ ထည့်ပြီးပါပြီ');
}

function showView(view) {
  if (view !== 'price-result') S.from = view;
  $$('.view').forEach(el => el.classList.remove('active'));
  const target = $(`${view}-view`);
  if (target) target.classList.add('active');
  $('main').scrollTop = 0;
  $$('.nav-btn').forEach(b => b.classList.remove('active', 'active-diamond'));
  const diamond = view === 'diamond-calc';
  const color = diamond ? 'var(--diamond)' : 'var(--primary)';
  $('nav-title-wrap').style.color = color;
  $('nav-subtitle').textContent = diamond ? 'စိန်/ရတနာ တွက်စက်' : 'ရွှေဈေးတွက်စက်';
  $('header-icon-bg').style.background = color;
  $('nav-toggle-btn').style.color = color;
  const nav = $(`nav-${view}`);
  if (nav) nav.classList.add(diamond ? 'active-diamond' : 'active');
}

function switchTab(btn) {
  const view = btn.closest('.view');
  $$('.tab-btn', view).forEach(b => b.classList.toggle('active', b === btn));
  $$('.sub', view).forEach(s => s.classList.toggle('on', s.id === btn.dataset.target));
  if (view.id === 'purity-calc-view') $('purity-result').hidden = true;
}

function resetGroup(sel) {
  $$(`${sel} input, ${sel} select`).forEach(el => {
    if (el.type === 'checkbox') return;
    if (el.tagName === 'INPUT') { el.value = ''; store.del(el.id); }
    mmLabel(el);
  });
  const run = { '#price-calc-view': purityPrices, '#diamond-calc-view': equivPrice, '#tools-net-sub': netWeight, '#tools-budget-sub': calcBudget };
  if (run[sel]) run[sel]();
  if (sel === '#tools-unit-sub') {
    $('uDisplay').textContent = WEIGHT_DEFAULT;
    $('uSubDisplay').textContent = '(0.0000 ကျပ်) | 0.000 g';
  }
}

function toggleBanner() {
  S.banner = !S.banner;
  $('banner-wrapper').hidden = !S.banner;
  setIcon($('toggle-banner-btn'), S.banner ? 'eye-off' : 'eye');
  store.set('bannerVisible', S.banner);
}

function toggleNav() {
  S.nav = !S.nav;
  $('nav-bar').classList.toggle('nav-hidden', !S.nav);
  $('nav-toggle-wrap').classList.toggle('nav-hidden-shift', !S.nav);
  setIcon($('nav-toggle-btn'), S.nav ? 'chevrons-down' : 'chevrons-up');
}

function applyTheme(i) {
  S.theme = i;
  document.body.classList.remove(...THEMES);
  document.body.classList.add(THEMES[i]);
  $('theme-meta').setAttribute('content', getComputedStyle(document.body).getPropertyValue('--bg').trim());
}

function cycleTheme() {
  applyTheme((S.theme + 1) % THEMES.length);
  store.set('appThemeIndex', S.theme);
  renderWidgets();
}

function renderWidgets() {
  const box = $('widgets-container');
  box.innerHTML = '';
  const tv = document.createElement('div');
  tv.className = 'widget-box';
  tv.style.width = '220px';
  const wrap = document.createElement('div');
  wrap.className = 'tradingview-widget-container';
  wrap.style.width = '100%';
  const inner = document.createElement('div');
  inner.className = 'tradingview-widget-container__widget';
  const script = document.createElement('script');
  script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-single-quote.js';
  script.async = true;
  script.text = JSON.stringify({ symbol: 'TVC:GOLD', width: '100%', isTransparent: false, colorTheme: document.body.classList.contains('ios-dark') ? 'dark' : 'light', locale: 'en' });
  wrap.append(inner, script);
  tv.appendChild(wrap);
  const gb = document.createElement('div');
  gb.className = 'widget-box';
  const frame = document.createElement('iframe');
  frame.src = 'https://www.goldbroker.com/widget/live/XAU?currency=USD&weight=oz';
  frame.width = '250';
  frame.height = '130';
  frame.loading = 'lazy';
  frame.title = 'Gold live price';
  gb.appendChild(frame);
  box.append(tv, gb);
}

function refreshWidgets() {
  const icon = document.querySelector('#refresh-btn svg');
  if (icon) { icon.style.transform = 'rotate(180deg)'; setTimeout(() => { icon.style.transform = ''; }, 500); }
  renderWidgets();
}

function captureElement(id, hideButtons) {
  const area = $(id);
  if (!window.html2canvas) return Promise.reject(new Error('offline'));
  const buttons = hideButtons ? $$('button', area) : [];
  buttons.forEach(b => { b.style.display = 'none'; });
  const bg = getComputedStyle(document.body).getPropertyValue('--bg').trim();
  return window.html2canvas(area, { backgroundColor: bg, scale: 3, logging: false, useCORS: true }).finally(() => buttons.forEach(b => { b.style.display = ''; }));
}

const canvasToBlob = c => new Promise(res => c.toBlob(res, 'image/png'));

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

async function shareBlob(blob, name, title) {
  const file = new File([blob], name, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title }); }
    catch (e) { if (e.name !== 'AbortError') { downloadBlob(blob, name); toast('မျှဝေမရ၍ သိမ်းပြီးပါပြီ'); } }
  } else {
    downloadBlob(blob, name);
    toast('ဓာတ်ပုံ သိမ်းပြီးပါပြီ');
  }
}

async function photo(id, hide, prefix, mode, msg) {
  try {
    const blob = await canvasToBlob(await captureElement(id, hide));
    const name = `${prefix}_${Date.now()}.png`;
    if (mode === 'share') await shareBlob(blob, name, 'Shwe Calculator');
    else { downloadBlob(blob, name); toast(msg); }
  } catch { toast('ဓာတ်ပုံမရနိုင်ပါ - အင်တာနက်စစ်ပါ'); }
}

const ROUTES = [
  [/^(TKat|TPe|TYway|SKat|SPe|SYway)$/, netWeight],
  [/^(uKyat|uPe|uYway)$/, () => convertUnits('units')],
  [/^(gramsInput|standard)$/, () => convertUnits('grams')],
  [/^convCt$/, () => convertDiamond('ct')],
  [/^convGm$/, () => convertDiamond('gm')],
  [/^(b-amount|b-price)$/, calcBudget],
  [/^(DiamondPrice|DiamondPriceType)$/, equivPrice],
  [/^DCt$/, () => syncDiamond('ct')],
  [/^(DR|DB|DP)$/, () => syncDiamond('unit')],
  [/^GoldPrice$/, purityPrices]
];
const route = el => { const r = ROUTES.find(([re]) => re.test(el.id)); if (r) r[1](); };

const ACTIONS = {
  view: b => showView(b.dataset.view),
  banner: toggleBanner,
  refresh: refreshWidgets,
  theme: cycleTheme,
  nav: toggleNav,
  'toggle-purity': togglePurity,
  'copy-pp': copyPurity,
  calc: calcPrice,
  'calc-diamond': calcDiamond,
  'calc-purity': calcPurity,
  reset: b => resetGroup(b.dataset.target),
  back: () => showView(S.from),
  'add-inv': addToInvoice,
  tab: switchTab,
  'use-net': useNetWeight,
  'view-hist': b => viewHistory(+b.dataset.id),
  'del-hist': b => { history.splice(+b.dataset.i, 1); store.set('calcHistory', JSON.stringify(history)); renderHistory(); },
  'clear-hist': () => { history = []; store.set('calcHistory', '[]'); renderHistory(); },
  'del-inv': b => { invoice.splice(+b.dataset.i, 1); saveInvoiceList(); },
  'clear-inv': () => { invoice = []; saveInvoiceList(); },
  'export-csv': () => exportHistory('csv'),
  'export-json': () => exportHistory('json'),
  'save-photo': () => photo('capture-area', false, 'ShweCalc', 'save', 'ဓာတ်ပုံ သိမ်းပြီးပါပြီ'),
  'share-photo': () => photo('capture-area', false, 'ShweCalc', 'share'),
  'save-inv': () => photo('invoice-view', true, 'ShweInvoice', 'save', 'ဘောင်ချာ သိမ်းပြီးပါပြီ'),
  'share-inv': () => photo('invoice-view', true, 'ShweInvoice', 'share'),
  install: async () => {
    if (!S.install) return;
    S.install.prompt();
    await S.install.userChoice;
    S.install = null;
    $('install-btn').hidden = true;
  }
};

function setAppHeight() {
  const h = (window.visualViewport && window.visualViewport.height) || window.innerHeight;
  document.documentElement.style.setProperty('--app-height', `${h}px`);
}

function initViewport() {
  const nav = $('nav-bar'), toggle = $('nav-toggle-wrap');
  const apply = () => {
    setAppHeight();
    const vv = window.visualViewport;
    if (!vv) return;
    const open = window.innerWidth < 900 && window.innerHeight - (vv.height + vv.offsetTop) > 120;
    document.body.classList.toggle('keyboard-open', open);
    nav.classList.toggle('kb-hidden', open);
    toggle.classList.toggle('kb-hidden', open);
  };
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', apply);
    window.visualViewport.addEventListener('scroll', apply);
  }
  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', () => setTimeout(apply, 120));
  apply();
  document.addEventListener('focusin', e => {
    if (e.target.matches('input, select')) setTimeout(() => e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 260);
  });
}

function bindEvents() {
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (b && ACTIONS[b.dataset.act]) ACTIONS[b.dataset.act](b, e);
  });
  document.addEventListener('input', e => {
    const el = e.target;
    if (!el.id || el.type === 'checkbox') return;
    store.set(el.id, el.value);
    mmLabel(el);
    route(el);
  });
  document.addEventListener('change', e => {
    if (e.target.tagName === 'SELECT') { store.set(e.target.id, e.target.value); route(e.target); }
  });
  document.addEventListener('focusout', e => {
    const el = e.target;
    if (el.dataset && el.dataset.g) { rollover(el.dataset.g.split(',')); route(el); }
  });
  $('rollover-toggle').addEventListener('change', e => store.set('rolloverEnabled', e.target.checked));
}

function restoreState() {
  const themeIndex = store.get('appThemeIndex');
  applyTheme(themeIndex !== null ? parseInt(themeIndex, 10) % THEMES.length : (window.matchMedia('(prefers-color-scheme: light)').matches ? 1 : 0));
  if (store.get('bannerVisible') === 'false') toggleBanner();
  if (store.get('rolloverEnabled') === 'false') $('rollover-toggle').checked = false;
  setPurityVisible(store.get('purityVisible') === 'true');
  $$('input, select').forEach(el => {
    if (el.type === 'checkbox' || !el.id) return;
    const v = store.get(el.id);
    if (v) el.value = v;
  });
  $$('input, select').forEach(el => { if (el.id && el.type !== 'checkbox' && el.value) { mmLabel(el); route(el); } });
  netWeight();
  equivPrice();
  purityPrices();
  calcBudget();
}

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        if (w) w.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) toast('အပ်ဒိတ်အသစ် ရရှိပါပြီ - ပြန်ဖွင့်ပါ');
        });
      });
    }).catch(() => {});
  });
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    S.install = e;
    $('install-btn').hidden = false;
  });
  window.addEventListener('appinstalled', () => { S.install = null; $('install-btn').hidden = true; });
}

function init() {
  buildWeights();
  bindEvents();
  restoreState();
  renderHistory();
  renderInvoice();
  renderWidgets();
  initViewport();
  icons();
}

registerSW();
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();