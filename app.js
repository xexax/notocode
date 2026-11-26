/* Dönüşüm Arenası — oyun arayüzü: joystick (Gamepad API) + ses (Web Speech) + sahneler */
(() => {
'use strict';
const K = window.Core;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const trl = (s) => String(s).toLocaleLowerCase('tr');
const SAVE_KEY = 'dtarena.v1';

const STAGES = [
  { id: 'minutes', ico: '🎙️', name: 'Toplantı Odası', sub: 'Konuş → minute çıksın' },
  { id: 'mining', ico: '📡', name: 'Süreç Radarı', sub: 'Process mining' },
  { id: 'tobe', ico: '🛠️', name: 'Tasarım Atölyesi', sub: 'Olması gereken süreç' },
  { id: 'plan', ico: '🧭', name: 'Komuta Merkezi', sub: 'Plan · aksiyon · KPI' },
  { id: 'deliver', ico: '🤖', name: 'AI Fabrikası', sub: 'AI ile teslim et' }
];
const RANKS = [[0, 'Stajyer Analist'], [200, 'Süreç Kaşifi'], [500, 'Optimizasyon Ustası'], [900, 'Dönüşüm Mimarı'], [1400, 'AI Komutanı'], [2000, 'Efsane CTO']];

/* ---------------- Durum ---------------- */
const fresh = () => ({
  stage: 'hq', xp: 0, awards: {}, transcript: '', minutes: null, events: null, mining: null, tobe: null, plan: null, kpis: null,
  delivered: {}, sel: null, settings: { key: '', model: 'claude-sonnet-5-5', narrator: true, sfx: true }
});
let S = fresh();
function load() {
  try {
    const j = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (j) { S = { ...fresh(), ...j, settings: { ...fresh().settings, ...(j.settings || {}) } }; if (S.events) S.events = S.events.map((a) => ({ case: a[0], act: a[1], ts: a[2], res: a[3] })); }
  } catch (e) { /* yok say */ }
}
let saveT;
function save() {
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    try {
      const c = { ...S, events: S.events ? S.events.map((e) => [e.case, e.act, e.ts, e.res]) : null };
      localStorage.setItem(SAVE_KEY, JSON.stringify(c));
    } catch (e) { /* kota */ }
  }, 300);
}

/* ---------------- Ses efekti, bildirim, haptik ---------------- */
let AC;
function beep(seq) {
  if (!S.settings.sfx) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    let t = AC.currentTime;
    seq.forEach(([f, d]) => {
      const o = AC.createOscillator(), g = AC.createGain();
      o.type = 'square'; o.frequency.value = f; g.gain.value = 0.04;
      o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + d); t += d;
    });
  } catch (e) { /* yok say */ }
}
const SFX = { move: [[520, .03]], ok: [[660, .06], [880, .08]], xp: [[523, .07], [659, .07], [784, .07], [1047, .12]], err: [[200, .15]] };
function toast(msg, cls) {
  const d = document.createElement('div'); d.className = 'toast ' + (cls || ''); d.textContent = msg;
  const box = $('#toasts'); box.appendChild(d); while (box.children.length > 3) box.firstChild.remove(); setTimeout(() => d.remove(), 3200);
}
function rumble(ms, s, w) {
  const gp = padIndex != null && navigator.getGamepads()[padIndex];
  const a = gp && (gp.vibrationActuator);
  if (a && a.playEffect) a.playEffect('dual-rumble', { duration: ms || 80, strongMagnitude: s || .4, weakMagnitude: w || .3 }).catch(() => {});
}
function rankOf(xp) { let r = 0; RANKS.forEach((x, i) => { if (xp >= x[0]) r = i; }); return r; }
function gain(key, xp, msg) {
  if (key && S.awards[key]) return;
  if (key) S.awards[key] = 1;
  const before = rankOf(S.xp); S.xp += xp;
  toast('+' + xp + ' XP · ' + msg, 'xp'); beep(SFX.xp); rumble(160, .6, .5);
  const after = rankOf(S.xp);
  if (after > before) setTimeout(() => { toast('🏆 Rütbe atladın: ' + RANKS[after][1], 'xp'); speak('Tebrikler! Yeni rütbe: ' + RANKS[after][1]); }, 600);
  save(); renderHud();
}

/* ---------------- Sesli anlatıcı (TTS) ---------------- */
let speaking = false;
function speak(text) {
  if (!S.settings.narrator || !('speechSynthesis' in window) || !text) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text); u.lang = 'tr-TR'; u.rate = 1.05;
    const v = speechSynthesis.getVoices().find((x) => /^tr/i.test(x.lang)); if (v) u.voice = v;
    speaking = true; u.onend = u.onerror = () => setTimeout(() => { speaking = false; }, 400);
    speechSynthesis.speak(u);
  } catch (e) { speaking = false; }
}
function stopSpeak() { try { speechSynthesis.cancel(); } catch (e) { /* */ } speaking = false; }

/* ---------------- Yardımcı: HTML üreticileri ---------------- */
const btn = (label, act, arg, cls) => `<button class="btn ${cls || ''}" data-nav data-act="${act}" ${arg !== undefined ? `data-arg="${esc(arg)}"` : ''}>${label}</button>`;
const stat = (v, l) => `<div class="card stat"><b>${v}</b><small>${l}</small></div>`;
const fd = K.fmtDur;

function md(src) {
  const lines = String(src).replace(/\r/g, '').split('\n'); let h = '', list = null, inCode = false, tbl = [];
  const inl = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`(.+?)`/g, '<code>$1</code>');
  const flushList = () => { if (list) { h += `</${list}>`; list = null; } };
  const flushTbl = () => {
    if (!tbl.length) return;
    const rows = tbl.filter((r) => !/^\s*\|?\s*:?-{2,}/.test(r)).map((r) => r.replace(/^\s*\||\|\s*$/g, '').split('|').map((c) => c.trim()));
    h += '<table>' + rows.map((r, i) => '<tr>' + r.map((c) => `<${i ? 'td' : 'th'}>${inl(c)}</${i ? 'td' : 'th'}>`).join('') + '</tr>').join('') + '</table>'; tbl = [];
  };
  for (const l of lines) {
    if (/^```/.test(l)) { flushList(); flushTbl(); h += inCode ? '</pre>' : '<pre>'; inCode = !inCode; continue; }
    if (inCode) { h += esc(l) + '\n'; continue; }
    if (/^\s*\|/.test(l)) { flushList(); tbl.push(l); continue; } else flushTbl();
    let m;
    if ((m = l.match(/^(#{1,4})\s+(.*)/))) { flushList(); h += `<h${m[1].length}>${inl(m[2])}</h${m[1].length}>`; }
    else if ((m = l.match(/^\s*[-*]\s+(.*)/))) { if (list !== 'ul') { flushList(); h += '<ul>'; list = 'ul'; } h += `<li>${inl(m[1])}</li>`; }
    else if ((m = l.match(/^\s*\d+[.)]\s+(.*)/))) { if (list !== 'ol') { flushList(); h += '<ol>'; list = 'ol'; } h += `<li>${inl(m[1])}</li>`; }
    else if (!l.trim()) flushList();
    else { flushList(); h += `<p>${inl(l)}</p>`; }
  }
  flushList(); flushTbl(); return h;
}

/* ---------------- Üst bar ---------------- */
function renderHud() {
  const r = rankOf(S.xp), nxt = RANKS[r + 1], lo = RANKS[r][0];
  const pct = nxt ? Math.round(100 * (S.xp - lo) / (nxt[0] - lo)) : 100;
  $('#rank').innerHTML = `<div class="row"><span>Seviye ${r + 1} · <b>${RANKS[r][1]}</b></span><span>${S.xp} XP${nxt ? ' / ' + nxt[0] : ''}</span></div><div class="bar"><i style="width:${pct}%"></i></div>`;
  $('#map').innerHTML = STAGES.map((s, i) => {
    const lk = !unlocked(s.id), done = isDone(s.id);
    return `<button class="stage-tab ${S.stage === s.id ? 'cur' : ''} ${done ? 'done' : ''} ${lk ? 'locked' : ''}" data-nav data-act="go" data-arg="${s.id}"><b>${s.ico} ${i + 1}. ${s.name}</b><small>${s.sub}</small></button>`;
  }).join('');
}
function unlocked(id) {
  return id === 'minutes' || id === 'mining' || (id === 'tobe' && !!S.mining) || (id === 'plan' && !!S.tobe) || (id === 'deliver' && !!S.plan);
}
function isDone(id) {
  return ({ minutes: !!S.minutes, mining: !!S.mining, tobe: !!S.tobe, plan: !!S.plan, deliver: Object.keys(S.delivered).length >= 3 })[id];
}

/* ---------------- Navigasyon ---------------- */
function go(id) {
  if (id !== 'hq' && !unlocked(id)) {
    const need = { tobe: 'Önce Süreç Radarı\'nda analiz çalıştır.', plan: 'Önce To-Be tasarımı üret.', deliver: 'Önce planı oluştur.' }[id];
    toast('🔒 Kilitli — ' + need); beep(SFX.err); rumble(120, .7, .1); return;
  }
  S.stage = id; S.sel = null; save(); render(); window.scrollTo(0, 0);
  const st = STAGES.find((s) => s.id === id);
  setLive(st ? st.ico + ' ' + st.name : '🏠 Ana Merkez');
  beep(SFX.ok);
}
function step(d) {
  const ids = ['hq', ...STAGES.map((s) => s.id)]; let i = ids.indexOf(S.stage);
  for (let k = 0; k < ids.length; k++) { i = (i + d + ids.length) % ids.length; if (ids[i] === 'hq' || unlocked(ids[i])) return go(ids[i]); }
}
function setLive(t) { $('#live').textContent = t || ''; }

/* ---------------- Sahneler ---------------- */
function render() {
  const lastId = document.activeElement && document.activeElement.dataset ? (document.activeElement.dataset.act || '') + (document.activeElement.dataset.arg || '') : '';
  renderHud();
  const v = $('#view');
  v.innerHTML = ({ hq: vHQ, minutes: vMinutes, mining: vMining, tobe: vTobe, plan: vPlan, deliver: vDeliver })[S.stage]();
  if (S.stage === 'mining') drawMining();
  if (S.stage === 'tobe') drawTobe();
  if (lastId) { const el = $$('[data-nav]').find((e) => (e.dataset.act || '') + (e.dataset.arg || '') === lastId); if (el) el.focus({ preventScroll: true }); }
}

function vHQ() {
  const r = rankOf(S.xp);
  return `
  <div class="card hero"><h2>🎮 Kurumsal AI Dönüşüm Oyunu</h2>
    <p class="big">Toplantıyı dinle → minute çıkar → süreci <b>process mining</b> ile röntgenle → <b>olması gereken</b> süreci yeniden çiz → aksiyon + KPI planla → <b>AI ile teslim et</b>.</p>
    <p class="mut">Joystick bağla (D-Pad gez, <b>A</b> seç, <b>X</b> mikrofon) veya sadece konuş: «toplantı», «süreç radarı», «tasarım», «plan», «teslimat», «analiz et», «anlat».</p>
    <div class="row">${btn('▶ Hızlı Başlat (demo senaryo)', 'quick', undefined, 'primary')}${btn('🎙️ Toplantıdan başla', 'go', 'minutes')}${btn('📡 Kendi log\'umla başla', 'go', 'mining')}${btn('↺ Oyunu sıfırla', 'reset', undefined, 'ghost')}</div>
  </div>
  <h3 style="margin-top:18px">Görev Haritası</h3>
  <div class="stages">${STAGES.map((s, i) => `<button class="card stage ${unlocked(s.id) ? '' : 'locked'}" data-nav data-act="go" data-arg="${s.id}"><div class="ico">${s.ico}</div><h3>${i + 1}. ${s.name}</h3><small>${s.sub}</small><div style="margin-top:8px">${isDone(s.id) ? '<span class="tag t-new">✓ Tamamlandı</span>' : unlocked(s.id) ? '<span class="tag t-automate">Açık</span>' : '<span class="tag">🔒 Kilitli</span>'}</div></button>`).join('')}</div>
  <div class="grid g2" style="margin-top:18px">
    <div class="card"><h3>🏅 Rütbe</h3><p class="big">${RANKS[r][1]} <small>(${S.xp} XP)</small></p><p class="mut">Her sahnede XP kazan; plandaki aksiyonları tamamladıkça ve AI çıktıları ürettikçe rütben yükselir.</p>
    <ul class="clean">${Object.keys(S.awards).length ? Object.keys(S.awards).map((a) => `<li>🏆 ${esc(AWARD_NAMES[a] || a)}</li>`).join('') : '<li class="mut">Henüz rozet yok — ilk görevini yap!</li>'}</ul></div>
    <div class="card"><h3>🕹️ Kontroller</h3><table>
      <tr><td><kbd>D-Pad / Sol çubuk</kbd></td><td>Odak hareketi (gez)</td></tr><tr><td><kbd>A</kbd></td><td>Seç / çalıştır</td></tr><tr><td><kbd>B</kbd></td><td>Ana ekran / pencere kapat</td></tr>
      <tr><td><kbd>X</kbd></td><td>Mikrofon aç/kapat</td></tr><tr><td><kbd>Y</kbd></td><td>Bu sahneyi sesli anlat</td></tr><tr><td><kbd>LB / RB</kbd></td><td>Önceki / sonraki sahne</td></tr>
      <tr><td><kbd>Start</kbd></td><td>Komut ↔ Dikte modu</td></tr><tr><td><kbd>Sağ çubuk</kbd></td><td>Sayfayı kaydır</td></tr></table>
      <p class="mut" style="margin-bottom:0">Ses tanıma için Chrome/Edge önerilir. Joystick'te herhangi bir tuşa basarak tarayıcıya tanıt.</p></div>
  </div>`;
}
const AWARD_NAMES = { minutes: 'İlk Minute', mining: 'Process Mining Gözü', tobe: 'To-Be Mimarı', plan: 'Plan Ustası', kpi: 'KPI Avcısı', done5: 'Aksiyon Makinesi', deliver1: 'İlk Teslimat', deliverAll: 'AI Fabrikası Tam Kapasite', voice: 'Sesli Komutan' };

function vMinutes() {
  const m = S.minutes;
  return `
  <div class="grid g2">
    <div class="card"><h2>🎙️ Toplantı Odası</h2>
      <p class="mut">Mikrofonu aç, <b>Dikte</b> moduna geç ve toplantıyı anlat (veya transkripti yapıştır). Sonra «minute çıkar» de.</p>
      <textarea id="tx" data-nav placeholder="Toplantı notları / transkript…">${esc(S.transcript)}</textarea>
      <div class="row" style="margin-top:10px">${btn('✨ Minute Çıkar', 'extract', undefined, 'primary')}${btn('🧠 AI ile derinleştir', 'aiExtract')}${btn('📋 Örnek toplantı', 'sampleText')}${btn('🗑️ Temizle', 'clearText', undefined, 'ghost')}</div>
      <p class="mut" style="margin-bottom:0">${S.settings.key ? '🟢 Claude bağlı' : '⚪ Yerel kural motoru (Ayarlar\'dan Claude anahtarı ekleyince AI aktif olur)'}</p>
    </div>
    <div class="card"><h3>📝 Minute (toplantı tutanağı)</h3>${m ? minutesHtml(m) : '<p class="mut">Henüz minute yok. Sol tarafa toplantı metnini gir ve «Minute Çıkar»a bas.</p>'}</div>
  </div>
  ${m ? `<div class="row" style="margin-top:14px">${btn('📡 Süreç Radarına geç →', 'go', 'mining', 'hot')}${btn('🔊 Minute\'u oku', 'narrate')}</div>` : ''}`;
}
function minutesHtml(m) {
  const sec = (t, arr, f) => arr.length ? `<h3>${t} (${arr.length})</h3><ul class="clean">${arr.map(f).join('')}</ul>` : '';
  return `${m.title ? `<p class="big"><b>${esc(m.title)}</b> <span class="tag">${esc(m.source)}</span></p>` : ''}
    ${m.people.length ? `<p>${m.people.map((p) => `<span class="tag">👤 ${esc(p.name)}${p.role ? ' · ' + esc(p.role) : ''}</span>`).join('')}</p>` : ''}
    ${sec('🔁 Anlatılan süreç adımları', m.steps, (x, i) => `<li>${i + 1}. ${esc(x)}</li>`)}
    ${sec('✅ Kararlar', m.decisions, (x) => `<li>${esc(x)}</li>`)}
    ${sec('🎯 Aksiyonlar', m.actions, (a) => `<li>${esc(a.text)} ${a.owner ? `<span class="tag t-automate">👤 ${esc(a.owner)}</span>` : '<span class="tag t-remove">sahip yok</span>'}${a.due ? `<span class="tag t-approval">⏰ ${esc(a.due)}</span>` : ''}</li>`)}
    ${sec('⚠️ Risk / sorunlar', m.risks, (x) => `<li>${esc(x)}</li>`)}
    ${sec('🏁 Hedefler', m.goals, (x) => `<li>${esc(x)}</li>`)}`;
}

function vMining() {
  const m = S.mining;
  return `
  <div class="card"><h2>📡 Süreç Radarı — Process Mining</h2>
    <p class="mut">Sistem kayıtlarından (event log: <code>vaka_id; aktivite; zaman; kaynak</code>) gerçek süreci çıkarır: akış haritası, varyantlar, darboğaz, rework, uyum.</p>
    <div class="row">${btn('▶ Demo log yükle', 'demoLog', undefined, 'primary')}${btn('📂 CSV yükle', 'upload')}${btn('📋 Şablon CSV indir', 'dlTemplate', undefined, 'ghost')}${m ? btn('🔄 Yeniden analiz', 'runMining') : ''}</div>
    <details style="margin-top:10px"><summary class="mut">CSV'yi yapıştır</summary><textarea id="csvtx" data-nav style="min-height:110px" placeholder="case_id;activity;timestamp;resource"></textarea>${btn('Analiz et', 'pasteCsv', undefined, 'sm')}</details>
    ${S.events ? `<p class="mut" style="margin-bottom:0">Yüklü log: ${S.events.length} olay</p>` : ''}
  </div>
  ${m ? miningBody(m) : '<div class="card lock-msg mut">Henüz analiz yok. «Demo log yükle» ile başla veya kendi event log\'unu yükle.</div>'}`;
}
function miningBody(m) {
  const st = m.stats, cf = m.conformance;
  return `
  <div class="grid g4" style="margin-top:14px">${stat(m.nCases, 'vaka')}${stat(m.nEvents, 'olay')}${stat(m.nVariants, 'varyant')}${stat(fd(st.mean), 'ort. çevrim')}${stat(fd(st.median), 'medyan')}${stat(fd(st.p90), 'P90 (yavaş uç)')}${stat(K.pct(st.reworkRate), 'rework oranı')}${stat(st.handoffsPerCase.toFixed(1), 'devir / vaka')}${stat(K.pct(cf.fitness), 'uyum skoru')}</div>
  <h3 style="margin-top:16px">Gerçek süreç haritası (As-Is)</h3>
  <div class="legend"><span><i class="dot" style="background:hsl(120 70% 45%)"></i>hızlı</span><span><i class="dot" style="background:hsl(40 90% 50%)"></i>orta</span><span><i class="dot" style="background:hsl(0 80% 55%)"></i>yavaş (bekleme)</span><span>çizgi kalınlığı = vaka sayısı · etiket = ort. bekleme · kesikli çizgi = geri dönüş (rework)</span></div>
  <div class="graphbox" id="graph"></div>
  <div class="card" id="detail" style="margin-top:12px"><span class="mut">Bir adıma odaklan ve <b>A</b>'ya bas — detayı burada gör.</span></div>
  <div class="grid g2" style="margin-top:14px">
    <div class="card"><h3>🔥 Darboğazlar</h3><table><tr><th>Geçiş</th><th>Ort. bekleme</th><th>Vaka</th></tr>${m.bottlenecks.map((b) => `<tr><td>${esc(b.from)} → ${esc(b.to)}${b.back ? ' ↩' : ''}</td><td><b>${fd(b.avgWait)}</b></td><td>${b.count}</td></tr>`).join('')}</table></div>
    <div class="card"><h3>🧭 Uyum (conformance)</h3>
      <p>Referans: <b>${esc(cf.source)}</b><br>Uyum skoru <b class="${cf.fitness > .85 ? 'rag-g' : cf.fitness > .7 ? 'rag-a' : 'rag-r'}">${K.pct(cf.fitness)}</b> · birebir uyan vaka ${K.pct(cf.exactShare)}</p>
      ${cf.extra.length ? `<p><b>Anlatılmayan ama gerçekte olan adımlar:</b><br>${cf.extra.map((x) => `<span class="tag t-remove">${esc(x)}</span>`).join('')}</p>` : ''}
      ${cf.missing.length ? `<p><b>Anlatılan ama logda bulunamayan:</b><br>${cf.missing.map((x) => `<span class="tag t-approval">${esc(x)}</span>`).join('')}</p>` : ''}
      <p class="mut" style="margin-bottom:0">Toplantıda anlatılan ile sistemde gerçekleşen arasındaki fark = gizli işler.</p></div>
  </div>
  <div class="card" style="margin-top:14px"><h3>🧬 En sık varyantlar</h3><table><tr><th>Vaka</th><th>Pay</th><th>Ort. süre</th><th>Akış</th></tr>
    ${m.variants.slice(0, 7).map((v) => `<tr><td>${v.count}</td><td><div class="hbar"><i style="width:${Math.round(v.share * 100 * 3)}%"></i></div>${K.pct(v.share)}</td><td>${fd(v.avg)}</td><td><div class="seq">${v.seq.map((a) => `<span>${esc(a)}</span>`).join('')}</div></td></tr>`).join('')}</table></div>
  <div class="row" style="margin-top:14px">${btn('🛠️ Olması gereken süreci tasarla →', 'tobeGen', undefined, 'hot')}${btn('🔊 Bulguları anlat', 'narrate')}</div>`;
}

function vTobe() {
  const t = S.tobe;
  if (!t) return `<div class="card lock-msg"><h2>🛠️ Tasarım Atölyesi</h2><p class="mut">As-Is analizinden olması gereken süreç üretilecek.</p>${btn('✨ To-Be Süreci Üret', 'tobeGen', undefined, 'primary')}</div>`;
  const w = Math.round(100 * t.toBeMs / t.asIsMs);
  return `
  <div class="card"><h2>🛠️ Olması Gereken Süreç (To-Be)</h2>
    <div class="grid g3"><div><small>Bugün (ort.)</small><div class="big"><b>${fd(t.asIsMs)}</b></div><div class="bar"><i style="width:100%;background:var(--red)"></i></div></div>
    <div><small>Hedef (tahmini)</small><div class="big"><b class="rag-g">${fd(t.toBeMs)}</b></div><div class="bar"><i style="width:${w}%"></i></div></div>
    <div><small>İyileşme</small><div class="big"><b class="rag-g">−${K.pct(t.improvement)}</b></div><small>${t.automated} adım AI/otomasyon</small></div></div></div>
  <h3 style="margin-top:16px">Yeni akış</h3>
  <div class="legend"><span><i class="dot" style="background:var(--amber)"></i>otomatik onay</span><span><i class="dot" style="background:var(--neon)"></i>otomasyon</span><span><i class="dot" style="background:var(--lime)"></i>yeni kontrol</span><span><i class="dot" style="background:var(--violet)"></i>paralel</span><span>kesikli = istisna yolu</span></div>
  <div class="graphbox" id="tgraph"></div>
  <h3 style="margin-top:16px">Değişiklik listesi</h3>
  <div class="grid g2">${t.steps.filter((s) => s.type !== 'keep').map((s) => `<div class="card"><span class="tag t-${s.type}">${TYPE_NAME[s.type]}</span> <b>${esc(s.name)}</b><p class="mut" style="margin:6px 0 0">${esc(s.note)}</p>${s.saveMs ? `<p style="margin:4px 0 0">⏱ Tahmini kazanım: <b class="rag-g">${fd(s.saveMs)}</b>/vaka</p>` : ''}</div>`).join('')}</div>
  <div class="row" style="margin-top:14px">${btn('🧭 Plan ve KPI üret →', 'planGen', undefined, 'hot')}${btn('🔊 Anlat', 'narrate')}</div>`;
}
const TYPE_NAME = { keep: 'Korunur', approval: 'Otomatik onay', automate: 'Otomasyon', new: 'Yeni kontrol', parallel: 'Paralel', exception: 'İstisna yolu', remove: 'Kaldırılır (rework)' };

function vPlan() {
  const P = S.plan; if (!P) return `<div class="card lock-msg">${btn('✨ Plan ve KPI üret', 'planGen', undefined, 'primary')}</div>`;
  const doneN = P.filter((a) => a.done).length, tot = P.length;
  const kp = S.kpis.reduce((a, k) => a + K.kpiProgress(k), 0) / S.kpis.length;
  return `
  <div class="card"><h2>🧭 Komuta Merkezi</h2>
    <div class="grid g4">${stat(doneN + '/' + tot, 'aksiyon tamam')}${stat(K.pct(doneN / tot), 'plan ilerlemesi')}${stat(K.pct(kp), 'KPI hedefe yakınlık')}${stat(S.kpis.length, 'izlenen KPI')}</div></div>
  <h3 style="margin-top:16px">Adım adım yol haritası</h3>
  <div class="cols3">${[1, 2, 3].map((ph) => `<div class="card"><h3>${['', '🚀 Faz 1 · 0-30 gün (hızlı kazanımlar)', '⚙️ Faz 2 · 31-60 gün (otomasyon)', '📈 Faz 3 · 61-90 gün (ölçekle)'][ph]}</h3>
    ${P.filter((a) => a.phase === ph).map((a) => `<div class="act ${a.done ? 'done' : ''}"><button class="btn chk ${a.done ? 'primary' : ''}" data-nav data-act="toggle" data-arg="${a.id}" title="Tamamla">${a.done ? '✓' : ''}</button><div><div class="tt">${esc(a.title)}</div><small>👤 ${esc(a.owner)} · <span class="pips">${'●'.repeat(a.effort)}${'○'.repeat(3 - a.effort)}</span> efor · ${esc(a.src)}${a.due ? ' · ⏰ ' + esc(a.due) : ''}${a.impactMs ? ' · ⏱ −' + fd(a.impactMs) : ''}</small></div></div>`).join('') || '<small class="mut">—</small>'}</div>`).join('')}</div>
  <h3 style="margin-top:16px">Takip edilecek metrikler (KPI)</h3>
  <div class="grid g2">${S.kpis.map((k, i) => { const p = K.kpiProgress(k), rag = p >= .8 ? 'g' : p >= .4 ? 'a' : 'r'; const f = (x) => x.toFixed(k.fmt);
    return `<div class="card"><div class="kpi"><div><b>${esc(k.name)}</b><br><small>${esc(k.why)}</small></div><div style="text-align:right" class="rag-${rag}"><b class="big">${f(k.current)}</b> ${esc(k.unit)}</div></div>
    <div class="bar" style="margin:8px 0"><i style="width:${Math.round(p * 100)}%"></i></div>
    <div class="row"><small>Başlangıç ${f(k.base)} → Hedef <b>${f(k.target)}</b> ${esc(k.unit)}</small><span class="sp"></span>${btn('−', 'kpi-', i, 'sm')}${btn('+', 'kpi+', i, 'sm')}</div></div>`; }).join('')}</div>
  <div class="row" style="margin-top:14px">${btn('🤖 AI ile teslim et →', 'go', 'deliver', 'hot')}${btn('🔊 Planı anlat', 'narrate')}</div>`;
}

const ARTS = [
  ['exec', '📊', 'Yönetici özeti', 'Karar vericiler için tek sayfa'], ['sop', '📘', 'SOP / Süreç dokümanı', 'To-Be adım adım prosedür'],
  ['raci', '👥', 'RACI matrisi', 'Rol ve sorumluluklar (insan + AI ajan)'], ['backlog', '🧩', 'Kullanıcı hikayeleri', 'Sprint backlog + kabul kriterleri'],
  ['automation', '⚙️', 'Otomasyon spesifikasyonu', 'RPA/AI adımları, kurallar, istisnalar'], ['kpi', '📈', 'KPI panosu tasarımı', 'Formül, veri kaynağı, eşikler'],
  ['comms', '📣', 'Değişim iletişimi', 'Duyuru e-postası + SSS'], ['agent', '🧠', 'AI ajan komutu (system prompt)', 'Süreç kopilotu için hazır talimat']
];
function vDeliver() {
  if (!S.plan) return '<div class="card lock-msg mut">Önce planı oluştur.</div>';
  const n = Object.keys(S.delivered).length, cur = S.sel && S.delivered[S.sel];
  return `
  <div class="card"><h2>🤖 AI Fabrikası — Teslimat</h2>
    <p class="mut">Plan, KPI ve süreç verisinden teslim edilebilir çıktılar üretilir. ${S.settings.key ? '<b class="rag-g">🟢 Claude ile üretim aktif</b>' : '<b>⚪ Yerel şablon modu</b> — Ayarlar\'a Anthropic API anahtarı ekleyince çıktılar AI ile zenginleşir.'}</p>
    <div class="row">${btn('⚡ Hepsini üret', 'genAll', undefined, 'primary')}${btn('⬇️ Tümünü indir (.md)', 'dlAll')}<span class="chip ${n === ARTS.length ? 'on' : ''}">${n}/${ARTS.length} teslim edildi</span></div></div>
  <div class="grid g4" style="margin-top:14px">${ARTS.map(([id, ic, t, d]) => `<button class="card stage" data-nav data-act="gen" data-arg="${id}"><div class="ico">${ic}</div><b>${t}</b><br><small>${d}</small><div style="margin-top:6px">${S.delivered[id] ? '<span class="tag t-new">✓ hazır</span>' : '<span class="tag">üret</span>'}</div></button>`).join('')}</div>
  <div class="card" style="margin-top:14px" id="out">${cur ? outHtml(S.sel) : '<span class="mut">Bir çıktı seç — burada görünecek.</span>'}</div>`;
}
function outHtml(id) {
  const a = ARTS.find((x) => x[0] === id);
  return `<div class="row"><h3 style="margin:0">${a[1]} ${a[2]}</h3><span class="tag">${esc(S.delivered[id].by)}</span><span class="sp"></span>${btn('⬇️ İndir', 'dl', id, 'sm')}${btn('🔊 Oku', 'read', id, 'sm')}</div><div class="md">${md(S.delivered[id].text)}</div>`;
}

/* ---------------- Grafik çizimi ---------------- */
const NW = 132, NH = 62, CW = 168;
function wrap(s, n) {
  const w = s.split(' '), out = []; let cur = '';
  w.forEach((x) => { if ((cur + ' ' + x).trim().length > n && cur) { out.push(cur); cur = x; } else cur = (cur + ' ' + x).trim(); });
  if (cur) out.push(cur); return out.length > 2 ? [out[0], out.slice(1).join(' ').slice(0, n - 1) + '…'] : out;
}
function borderPt(c, to, hw, hh) {
  const dx = to.x - c.x, dy = to.y - c.y; if (!dx && !dy) return c;
  const t = Math.min(hw / (Math.abs(dx) || 1e9), hh / (Math.abs(dy) || 1e9));
  return { x: c.x + dx * t, y: c.y + dy * t };
}
const heat = (r) => `hsl(${Math.round(120 - 120 * Math.max(0, Math.min(1, r)))} 80% ${r > .5 ? 58 : 50}%)`;
const nodeLines = (name, ml) => wrap(name, 17).map((l, i) => `<text class="nm" x="${NW / 2}" y="${20 + i * 14}" text-anchor="middle">${esc(l)}</text>`).join('') + (ml ? `<text class="mt" x="${NW / 2}" y="${NH - 8}" text-anchor="middle">${esc(ml)}</text>` : '');

function drawMining() {
  const m = S.mining; if (!m) return;
  const nodes = m.nodes.slice().sort((a, b) => a.avgPos - b.avgPos), pos = {};
  nodes.forEach((n, i) => { pos[n.name] = { x: 30 + NW / 2 + i * CW, y: n.happy ? 90 : 240, col: i }; });
  const W = 60 + nodes.length * CW, Hh = 330;
  const maxW = Math.max(...m.edges.map((e) => e.avgWait), 1), maxC = Math.max(...m.edges.map((e) => e.count), 1), maxNW = Math.max(...nodes.map((n) => n.avgWait), 1);
  const min = Math.max(2, 0.03 * m.nCases);
  let defs = '<defs>'; for (let b = 0; b < 5; b++) defs += `<marker id="ar${b}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="11" markerHeight="11" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${heat(b / 4)}"/></marker>`; defs += '</defs>';
  let eh = '', lab = '';
  m.edges.filter((e) => e.count >= min).forEach((e) => {
    const a = pos[e.from], b = pos[e.to], dc = Math.abs(b.col - a.col), r = e.avgWait / maxW;
    const back = b.col < a.col || e.from === e.to;
    const off = (back ? 1 : -1) * ((dc > 1 || a.y === b.y && dc === 0) ? 26 + 16 * dc : (a.y !== b.y ? 0 : 0));
    const cp = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + off };
    const p0 = borderPt(a, cp, NW / 2 + 2, NH / 2 + 2), p1 = borderPt(b, cp, NW / 2 + 5, NH / 2 + 5);
    const mid = { x: .25 * p0.x + .5 * cp.x + .25 * p1.x, y: .25 * p0.y + .5 * cp.y + .25 * p1.y };
    eh += `<path d="M${p0.x.toFixed(1)} ${p0.y.toFixed(1)} Q${cp.x.toFixed(1)} ${cp.y.toFixed(1)} ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}" fill="none" stroke="${heat(r)}" stroke-width="${(1.2 + 6 * e.count / maxC).toFixed(1)}" ${back ? 'stroke-dasharray="6 4"' : ''} opacity=".85" marker-end="url(#ar${Math.min(4, Math.round(r * 4))})"/>`;
    if (e.count >= 0.1 * m.nCases || r > .5) lab += `<text class="elabel" x="${mid.x.toFixed(0)}" y="${(mid.y - 4).toFixed(0)}" text-anchor="middle">${fd(e.avgWait)}</text>`;
  });
  const nh = nodes.map((n) => `<g class="gnode" tabindex="0" data-nav data-act="node" data-arg="${esc(n.name)}" role="button" transform="translate(${pos[n.name].x - NW / 2} ${pos[n.name].y - NH / 2})"><rect width="${NW}" height="${NH}" rx="12" style="stroke:${heat(n.avgWait / maxNW)}"/>${nodeLines(n.name, K.pct(n.share) + ' · ⏱ ' + fd(n.avgWait))}</g>`).join('');
  $('#graph').innerHTML = `<svg width="${W}" height="${Hh}" viewBox="0 0 ${W} ${Hh}">${defs}<text x="14" y="26" class="mt" style="font-size:11px;fill:#8f99cf">ANA AKIŞ</text><text x="14" y="176" class="mt" style="font-size:11px;fill:#8f99cf">ALTERNATİF / TEKRAR YOLLARI</text>${eh}${nh}${lab}</svg>`;
}
function nodeDetail(name) {
  const m = S.mining, n = m.nodes.find((x) => x.name === name); if (!n) return;
  const ins = m.edges.filter((e) => e.to === name).sort((a, b) => b.count - a.count).slice(0, 4), outs = m.edges.filter((e) => e.from === name).sort((a, b) => b.count - a.count).slice(0, 4);
  const rw = m.reworkNodes.includes(name);
  $('#detail').innerHTML = `<h3>${esc(name)} ${rw ? '<span class="tag t-remove">rework adımı</span>' : ''}${n.happy ? '<span class="tag t-new">ana akış</span>' : ''}</h3>
  <div class="grid g4">${stat(n.cases, 'vakada görüldü (' + K.pct(n.share) + ')')}${stat(fd(n.avgWait), 'ort. bekleme')}${stat(n.repeat, 'tekrar sayısı')}${stat(n.resCount, 'farklı kaynak')}</div>
  <p>Kaynaklar: ${n.topRes.map((r) => `<span class="tag">${esc(r)}</span>`).join('')}</p>
  <div class="grid g2"><div><b>Gelen:</b><br>${ins.map((e) => `<span class="tag">${esc(e.from)} (${e.count}, ${fd(e.avgWait)})</span>`).join('') || '—'}</div><div><b>Giden:</b><br>${outs.map((e) => `<span class="tag">${esc(e.to)} (${e.count}, ${fd(e.avgWait)})</span>`).join('') || '—'}</div></div>`;
  speak(name + ': ortalama bekleme ' + fd(n.avgWait) + (rw ? '. Bu bir tekrar işi adımı.' : '.'));
}

function drawTobe() {
  const t = S.tobe; if (!t) return;
  const cols = []; // paralel adımlar aynı kolonda
  t.steps.filter((s) => s.type !== 'remove').forEach((s) => {
    const par = s.type === 'parallel' || (s.parallelWith && cols.length);
    if (s.parallelWith && cols.length && cols[cols.length - 1].some((x) => x.name === s.parallelWith)) cols[cols.length - 1].push(s); else cols.push([s]);
  });
  const col = { keep: '#6f7bd9', approval: '#ffb020', automate: '#00e5ff', new: '#b6ff3b', parallel: '#a07bff', exception: '#999' };
  const W = 60 + cols.length * CW, Hh = 250;
  let nh = '', eh = '';
  cols.forEach((c, i) => {
    const x = 30 + i * CW, ys = c.length > 1 ? [40, 130] : [85];
    c.forEach((s, j) => {
      nh += `<g class="gnode" tabindex="0" data-nav data-act="tnode" data-arg="${esc(s.name)}" role="button" transform="translate(${x} ${ys[j]})"><rect width="${NW}" height="${NH}" rx="12" style="stroke:${col[s.type]}" ${s.type === 'exception' ? 'stroke-dasharray="6 4"' : ''}/>${s.type === 'automate' || s.type === 'approval' ? `<text x="${NW - 20}" y="16" style="font-size:13px">🤖</text>` : ''}${nodeLines(s.name, TYPE_NAME[s.type])}</g>`;
      if (i < cols.length - 1) {
        const nx = cols[i + 1].length > 1 ? [40, 130] : [85];
        nx.forEach((y2) => { eh += `<path d="M${x + NW} ${ys[j] + NH / 2} L${x + CW} ${y2 + NH / 2}" stroke="#6f7bd9" stroke-width="2" fill="none" marker-end="url(#tar)"/>`; });
      }
    });
  });
  $('#tgraph').innerHTML = `<svg width="${W}" height="${Hh}" viewBox="0 0 ${W} ${Hh}"><defs><marker id="tar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="11" markerHeight="11" markerUnits="userSpaceOnUse" orient="auto"><path d="M0 0L10 5L0 10z" fill="#6f7bd9"/></marker></defs>${eh}${nh}</svg>`;
}

/* ---------------- Aksiyonlar ---------------- */
function extractLocal() {
  const txt = ($('#tx') ? $('#tx').value : S.transcript).trim();
  if (txt.length < 20) { toast('Önce toplantı metnini gir ya da dikte et'); beep(SFX.err); return; }
  S.transcript = txt; S.minutes = K.extractMinutes(txt);
  const m = S.minutes;
  save(); render(); gain('minutes', 100, 'İlk minute çıkarıldı');
  setLive(`✅ ${m.steps.length} adım · ${m.decisions.length} karar · ${m.actions.length} aksiyon · ${m.risks.length} risk`);
  speak(`Minute hazır. ${m.steps.length} süreç adımı, ${m.decisions.length} karar, ${m.actions.length} aksiyon ve ${m.risks.length} risk buldum.`);
}
function runMining() {
  if (!S.events) return loadDemoLog();
  S.mining = K.mine(S.events, S.minutes && S.minutes.steps); S.tobe = null; S.plan = null; S.kpis = null; S.delivered = {};
  save(); render(); gain('mining', 150, 'Süreç röntgeni çekildi');
  const m = S.mining; speak(`Analiz tamam. ${m.nCases} vaka, ${m.nVariants} varyant. Ortalama süre ${fd(m.stats.mean)}. En büyük darboğaz ${m.bottlenecks[0].from} sonrası ${m.bottlenecks[0].to} geçişi, ortalama ${fd(m.bottlenecks[0].avgWait)} bekleme. Tekrar işi oranı yüzde ${Math.round(m.stats.reworkRate * 100)}.`);
}
function loadDemoLog() { S.events = K.demoLog(); runMining(); }
function loadEvents(text) {
  try { S.events = K.eventsFromCSV(text); runMining(); } catch (e) { toast('CSV hatası: ' + e.message); beep(SFX.err); }
}
function tobeGen() {
  if (!S.mining) return go('mining');
  S.tobe = K.redesign(S.mining); S.plan = null; S.kpis = null; save(); go('tobe'); gain('tobe', 200, 'To-Be süreç tasarlandı');
  speak(`Yeni süreç hazır. Ortalama süre ${fd(S.tobe.asIsMs)} yerine yaklaşık ${fd(S.tobe.toBeMs)}. Yüzde ${Math.round(S.tobe.improvement * 100)} iyileşme.`);
}
function planGen() {
  if (!S.tobe) return;
  S.plan = K.makePlan(S.tobe, S.minutes, S.mining); S.kpis = K.makeKpis(S.mining, S.tobe); save(); go('plan'); gain('plan', 150, 'Plan ve KPI seti hazır');
  speak(`Plan hazır: ${S.plan.length} aksiyon, ${S.kpis.length} KPI, üç fazda.`);
}
function toggleAction(id) {
  const a = S.plan.find((x) => x.id === id); a.done = !a.done; save(); render();
  if (a.done) { gain(null, 40, 'Aksiyon tamamlandı'); if (S.plan.filter((x) => x.done).length >= 5) gain('done5', 150, 'Aksiyon Makinesi rozeti'); }
}
function kpiStep(i, d) {
  const k = S.kpis[i], s = (k.target - k.base) / 10 || 0.1; k.current = k.current + d * s;
  const lo = Math.min(k.base, k.target) - Math.abs(s) * 3, hi = Math.max(k.base, k.target) + Math.abs(s) * 3; k.current = Math.max(lo, Math.min(hi, k.current));
  save(); render(); if (K.kpiProgress(k) >= 1) gain('kpi', 120, 'İlk KPI hedefine ulaştı');
}

/* ---------------- AI (Claude) ---------------- */
async function claude(system, user, max) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': S.settings.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({ model: S.settings.model || 'claude-sonnet-5-5', max_tokens: max || 3000, system, messages: [{ role: 'user', content: user }] })
  });
  if (!r.ok) throw new Error('API ' + r.status + ' ' + (await r.text()).slice(0, 120));
  const j = await r.json(); return j.content.map((c) => c.text || '').join('');
}
async function aiExtract() {
  if (!S.settings.key) { toast('Ayarlar\'dan Claude API anahtarı ekle'); return openSettings(); }
  const txt = ($('#tx') ? $('#tx').value : S.transcript).trim(); if (txt.length < 20) return toast('Önce metin gir');
  S.transcript = txt; setLive('🧠 Claude toplantıyı analiz ediyor…');
  try {
    const out = await claude('Sen kıdemli bir süreç danışmanısın. Yalnızca geçerli JSON döndür.',
      'Toplantı transkriptinden şu şemada JSON çıkar: {"title":str,"people":[{"name":str,"role":str}],"steps":[süreç adımları sırayla, kısa fiil öbeği],"decisions":[str],"actions":[{"text":str,"owner":str,"due":str}],"risks":[str],"goals":[str]}. Türkçe yaz, uydurma yapma.\n\nTRANSKRİPT:\n' + txt, 2500);
    const j = JSON.parse(out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1));
    S.minutes = { title: '', people: [], steps: [], decisions: [], actions: [], risks: [], goals: [], ...j, source: 'claude' };
    save(); render(); gain('minutes', 100, 'İlk minute çıkarıldı'); setLive('✅ Claude minute\'u çıkardı'); speak('Minute hazır.');
  } catch (e) { toast('AI hatası: ' + e.message); setLive(''); extractLocal(); }
}

function ctx() {
  const m = S.mining, t = S.tobe;
  return {
    toplanti: S.minutes && { baslik: S.minutes.title, kisiler: S.minutes.people, kararlar: S.minutes.decisions, riskler: S.minutes.risks, hedefler: S.minutes.goals, aksiyonlar: S.minutes.actions },
    asis: m && { vaka: m.nCases, varyant: m.nVariants, ort_cevrim: fd(m.stats.mean), reworkOrani: K.pct(m.stats.reworkRate), devir: m.stats.handoffsPerCase.toFixed(1), uyum: K.pct(m.conformance.fitness), darbogazlar: m.bottlenecks.slice(0, 4).map((b) => `${b.from}→${b.to}: ${fd(b.avgWait)}`) },
    tobe: t && { hedef_cevrim: fd(t.toBeMs), iyilesme: K.pct(t.improvement), adimlar: t.steps.map((s) => ({ ad: s.name, tip: TYPE_NAME[s.type], not: s.note })) },
    plan: S.plan && S.plan.map((a) => ({ faz: a.phase, aksiyon: a.title, sahip: a.owner, efor: a.effort })),
    kpi: S.kpis && S.kpis.map((k) => ({ ad: k.name, baslangic: +k.base.toFixed(1), hedef: +k.target.toFixed(1), birim: k.unit }))
  };
}
const processName = () => (S.minutes && S.minutes.title) || 'Hedef Süreç';
const rolesOf = (a) => /onay/i.test(a) ? ['Yönetici', 'Finans'] : /fatura|ödeme|bütçe/i.test(a) ? ['Muhasebe', 'Finans'] : /mal kabul/i.test(a) ? ['Depo', 'Satın Alma'] : /tedarik|sipariş/i.test(a) ? ['Satın Alma', 'Tedarikçi'] : ['Talep Sahibi', 'Süreç Sahibi'];
const TEMPLATES = {
  exec() {
    const m = S.mining, t = S.tobe, st = m.stats;
    return `# Yönetici Özeti — ${processName()}\n\n## Durum\n- ${m.nCases} vaka analiz edildi; ortalama çevrim **${fd(st.mean)}**, yavaş uç (P90) **${fd(st.p90)}**.\n- Vakaların **${K.pct(st.reworkRate)}**'inde tekrar iş var; yalnız **${K.pct(st.happyShare)}** vaka standart akışta ilerliyor.\n- Toplantıda anlatılan süreçle gerçek akış uyumu **${K.pct(m.conformance.fitness)}**.\n\n## En büyük darboğazlar\n${m.bottlenecks.slice(0, 3).map((b) => `- ${b.from} → ${b.to}: ort. **${fd(b.avgWait)}** bekleme`).join('\n')}\n\n## Öneri\nSüreç yeniden tasarlandı: ${t.automated} adım AI/otomasyonla yürüyecek, tekrar işi önleyici kontrollerle kaldırılacak, bağımsız adımlar paralelleşecek.\n\n## Beklenen kazanım\n- Çevrim süresi **${fd(t.asIsMs)} → ${fd(t.toBeMs)}** (−${K.pct(t.improvement)})\n- Rework oranı **${K.pct(st.reworkRate)} → <%5**\n\n## Karar talebi\n1. Süreç sahibi ve dönüşüm sponsoru ataması\n2. Faz 1 (0-30 gün) hızlı kazanımların onayı\n3. AI pilot bütçesi ve veri erişimi`;
  },
  sop() {
    return `# SOP — ${processName()} (To-Be)\n\n**Amaç:** Standart, ölçülebilir ve AI destekli süreç işletimi.\n\n` + S.tobe.steps.filter((s) => s.type !== 'remove').map((s, i) => `## ${i + 1}. ${s.name}\n- **Tip:** ${TYPE_NAME[s.type]}\n- **Sorumlu rol:** ${s.type === 'automate' || s.type === 'approval' || s.type === 'new' ? 'AI Ajan (insan denetimli)' : rolesOf(s.name)[0]}\n- **Girdi / Çıktı:** önceki adım çıktısı → doğrulanmış kayıt\n- **Kural / not:** ${s.note}\n- **SLA:** ${s.type === 'approval' ? '4 saat (otomatik), istisna 1 iş günü' : '1 iş günü'}`).join('\n\n') + '\n\n## İstisna yönetimi\nStandart dışı vakalar istisna yoluna alınır; her istisna loglanır ve aylık gözden geçirilir.';
  },
  raci() {
    const rows = S.tobe.steps.filter((s) => s.type !== 'remove');
    return `# RACI — ${processName()}\n\n| Adım | Talep Sahibi | Süreç Sahibi | Operasyon/Finans | AI Ajan |\n|---|---|---|---|---|\n` + rows.map((s) => { const ai = ['automate', 'approval', 'new'].includes(s.type); const r = rolesOf(s.name)[0]; return `| ${s.name} | ${r === 'Talep Sahibi' ? 'R' : 'I'} | ${ai ? 'A' : 'C'} | ${ai ? 'C' : 'R'} | ${ai ? 'R' : '—'} |`; }).join('\n') + '\n\nR: Yürütür · A: Hesap verir · C: Danışılır · I: Bilgilendirilir';
  },
  backlog() {
    return `# Kullanıcı Hikayeleri — ${processName()}\n\n` + S.plan.filter((a) => a.src !== 'Temel' || a.phase === 1).map((a, i) => `## US-${i + 1} · ${a.title}\n**Sprint:** ${a.phase} · **Sahip:** ${a.owner} · **Efor:** ${'S M L'.split(' ')[a.effort - 1]}\n\n> ${a.owner} olarak, "${a.title}" çıktısını istiyorum; böylece çevrim süresi ve hata oranı düşsün.\n\n**Kabul kriterleri**\n- Çıktı canlı süreçte pilot edildi ve KPI'ya etkisi ölçüldü\n- İstisna ve geri dönüş senaryosu tanımlı\n- Kullanıcı eğitimi tamamlandı`).join('\n\n');
  },
  automation() {
    const s = S.tobe.steps.filter((x) => ['automate', 'approval', 'new'].includes(x.type));
    return `# Otomasyon Spesifikasyonu — ${processName()}\n\n` + s.map((x) => `## ${x.name}\n- **Tetikleyici:** önceki adım tamamlandığında olay (event) ile\n- **Girdi:** vaka verisi, ekler (PDF/e-posta), ilgili ERP kayıtları\n- **Karar mantığı:** ${x.type === 'approval' ? 'Tutar/risk eşiği altında otomatik onay; eşik üstü ve anomali → insan onayı' : x.type === 'new' ? 'Zorunlu alan, tutarlılık ve tekrar kontrolü; eksikse talep sahibine anında geri bildirim' : 'Kural + belge zekâsı ile eşleştirme/doğrulama; güven skoru < %90 ise insana yönlendir'}\n- **Human-in-the-loop:** istisna kuyruğu, günlük örneklem denetimi\n- **Kayıt/denetim:** her karar gerekçesiyle loglanır\n- **Başarı ölçütü:** otomasyon oranı, hata oranı, adım süresi`).join('\n\n');
  },
  kpi() {
    return `# KPI Panosu Tasarımı\n\n| KPI | Başlangıç | Hedef | Formül / kaynak | Sıklık |\n|---|---|---|---|---|\n` + S.kpis.map((k) => `| ${k.name} | ${k.base.toFixed(k.fmt)} ${k.unit} | ${k.target.toFixed(k.fmt)} ${k.unit} | ${k.why} (event log'dan) | Haftalık |`).join('\n') + '\n\n**Eşikler:** yeşil ≥ %80 hedefe yakınlık · sarı %40-80 · kırmızı < %40.\n**Ritim:** haftalık süreç sahibi toplantısı, aylık yönetim özeti.';
  },
  comms() {
    return `# Değişim İletişimi\n\n## Duyuru e-postası\n**Konu:** ${processName()} süreci yenileniyor — neler değişiyor?\n\nMerhaba ekip,\n\nSüreç analizimiz gösterdi ki ortalama çevrim süresi ${fd(S.mining.stats.mean)}; hedefimiz bunu ${fd(S.tobe.toBeMs)}'e indirmek. Bunun için ${S.tobe.automated} adımda AI destekli otomasyon, daha net kontrol noktaları ve paralel çalışma getiriyoruz.\n\n**Sizin için ne değişiyor?** Daha az tekrar iş, daha hızlı onay, net sorumluluklar.\n**Takvim:** 30-60-90 günlük üç faz.\n**Destek:** pilot eğitimleri ve haftalık soru-cevap oturumları.\n\n## SSS\n- *AI işimi elinden alacak mı?* Hayır; tekrarlayan kontrolleri üstlenir, istisnaları siz yönetirsiniz.\n- *Hata olursa kim sorumlu?* Süreç sahibi; her AI kararı loglanır ve itiraz edilebilir.`;
  },
  agent() {
    return `# AI Süreç Kopilotu — System Prompt\n\n\`\`\`\nSen "${processName()}" sürecinin yapay zekâ kopilotusun.\nGörevin: gelen vakaları aşağıdaki akışa göre ilerletmek, eksik/hatalı girdiyi ilk adımda yakalamak ve istisnaları insana yönlendirmek.\n\nAkış: ${S.tobe.steps.filter((s) => s.type !== 'remove').map((s) => s.name).join(' → ')}\n\nKurallar:\n- Güven skorun %90'ın altındaysa karar verme, insana devret.\n- Her kararı kısa gerekçeyle logla.\n- Kişisel veri ve ticari sırları dışarı sızdırma.\n- Hedef KPI'lar: ${S.kpis.map((k) => k.name + ' ' + k.target.toFixed(k.fmt) + k.unit).join('; ')}\n\`\`\``;
  }
};
const AI_INSTR = {
  exec: 'Üst yönetim için 1 sayfalık yönetici özeti yaz (durum, darboğazlar, öneri, kazanım, karar talepleri).', sop: 'To-Be süreç için adım adım SOP dokümanı yaz.',
  raci: 'Adımlar × roller RACI tablosu üret (insan roller + AI ajan).', backlog: 'Plandaki aksiyonlardan kabul kriterli kullanıcı hikayeleri üret.',
  automation: 'Otomasyon/AI adımları için teknik spesifikasyon yaz (tetikleyici, girdi, karar mantığı, human-in-the-loop, ölçütler).', kpi: 'KPI panosu tasarla: formül, veri kaynağı, eşik, sıklık, sahip.',
  comms: 'Değişim yönetimi için duyuru e-postası ve SSS yaz.', agent: 'Bu süreci yürüten AI ajan için kapsamlı, güvenli bir system prompt yaz.'
};
async function gen(id, quiet) {
  const t = ARTS.find((a) => a[0] === id); S.sel = id;
  let text, by = 'yerel şablon';
  if (S.settings.key) {
    setLive('🧠 Claude üretiyor: ' + t[2] + '…');
    try { text = await claude('Sen kıdemli süreç ve AI dönüşüm danışmanısın. Türkçe, net, markdown formatında, uygulanabilir çıktı üret.', AI_INSTR[id] + '\n\nBAĞLAM (JSON):\n' + JSON.stringify(ctx()), 3500); by = 'Claude'; }
    catch (e) { toast('AI hatası, şablona düşüldü: ' + e.message); }
  }
  if (!text) text = TEMPLATES[id]();
  S.delivered[id] = { text, by }; save(); setLive('');
  if (!quiet) { render(); gain('deliver1', 250, 'İlk teslimat'); }
  if (Object.keys(S.delivered).length === ARTS.length) gain('deliverAll', 400, 'Tüm çıktılar teslim edildi!');
}
async function genAll() {
  for (const a of ARTS) { await gen(a[0], true); render(); }
  gain('deliver1', 250, 'İlk teslimat'); speak('Tüm çıktılar teslim edildi.');
}
function download(name, text) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ---------------- Ayarlar ---------------- */
function openSettings() {
  const m = $('#modal'); m.hidden = false;
  m.innerHTML = `<div class="card"><h2>⚙️ Ayarlar</h2>
    <label>Anthropic API anahtarı (opsiyonel — AI çıktıları için)</label><input type="password" id="setKey" data-nav value="${esc(S.settings.key)}" placeholder="sk-ant-…" autocomplete="off">
    <p class="mut">Anahtar yalnızca bu tarayıcıda (localStorage) saklanır ve doğrudan Anthropic API'ye gider. Paylaşılan bilgisayarlarda kullanmayın.</p>
    <label>Model</label><input type="text" id="setModel" data-nav value="${esc(S.settings.model)}">
    <div class="row" style="margin:12px 0"><button class="btn ${S.settings.narrator ? 'primary' : ''}" data-nav data-act="setNarr">🔊 Sesli anlatıcı: ${S.settings.narrator ? 'açık' : 'kapalı'}</button><button class="btn ${S.settings.sfx ? 'primary' : ''}" data-nav data-act="setSfx">🔔 Ses efekti: ${S.settings.sfx ? 'açık' : 'kapalı'}</button></div>
    <div class="row">${btn('Kaydet', 'saveSet', undefined, 'primary')}${btn('Kapat', 'closeModal')}</div></div>`;
  $('#setKey').focus();
}
function closeModal() { $('#modal').hidden = true; $('#modal').innerHTML = ''; }
const modalOpen = () => !$('#modal').hidden;

/* ---------------- Ses: komut ve dikte ---------------- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null, listening = false, micMode = 'command';
function updateMic() {
  $('#micBtn').classList.toggle('on', listening); $('#micLbl').textContent = listening ? 'Dinliyor' : 'Kapalı';
  $('#modeBtn').textContent = micMode === 'dictate' ? '📝 Dikte' : '⌨️ Komut';
}
function micToggle() {
  if (!SR) { toast('Bu tarayıcı ses tanımayı desteklemiyor (Chrome/Edge)'); beep(SFX.err); return; }
  if (listening) { listening = false; try { rec.stop(); } catch (e) { /* */ } updateMic(); setLive(''); return; }
  rec = new SR(); rec.lang = 'tr-TR'; rec.continuous = true; rec.interimResults = true;
  rec.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) { const r = e.results[i]; if (r.isFinal) onSpeech(r[0].transcript.trim()); else interim += r[0].transcript; }
    if (interim) setLive('🎤 ' + interim);
  };
  rec.onend = () => { if (listening) { try { rec.start(); } catch (e) { /* */ } } else updateMic(); };
  rec.onerror = (e) => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { listening = false; toast('Mikrofon izni verilmedi'); updateMic(); } };
  try { listening = true; rec.start(); gain('voice', 50, 'Mikrofon açıldı'); toast('🎤 Dinliyorum — mod: ' + (micMode === 'dictate' ? 'dikte' : 'komut')); } catch (e) { listening = false; }
  updateMic();
}
function setMode(m) { micMode = m; updateMic(); toast(m === 'dictate' ? '📝 Dikte modu: söylediklerin toplantı notuna yazılır' : '⌨️ Komut modu'); }
function onSpeech(txt) {
  if (speaking || !txt) return;
  const l = trl(txt);
  if (/komut modu|dikteyi bitir|dikte bitti|kaydı durdur/.test(l)) return setMode('command');
  if (/dikte modu|dikteyi başlat|not al|yazmaya başla/.test(l)) { if (S.stage !== 'minutes') go('minutes'); return setMode('dictate'); }
  if (micMode === 'dictate' && S.stage === 'minutes') {
    const tx = $('#tx'); const add = txt.replace(/\s+nokta$/i, '.').replace(/\s+yeni satır$/i, '\n');
    S.transcript = (S.transcript ? S.transcript.replace(/\s+$/, '') + (/[.!?\n]$/.test(S.transcript.trim()) ? ' ' : '. ') : '') + add; if (tx) { tx.value = S.transcript; tx.scrollTop = tx.scrollHeight; } save(); return;
  }
  setLive('🎤 Komut: «' + txt + '»'); voiceCommand(l);
}
function primary() {
  ({ hq: quick, minutes: extractLocal, mining: runMining, tobe: tobeGen, plan: planGen, deliver: genAll })[S.stage]();
}
function voiceCommand(l) {
  const has = (re) => re.test(l);
  if (has(/ana (ekran|merkez|menü)|harita|başa dön/)) return go('hq');
  if (has(/toplantı odası|toplantı/) && !has(/başlat|analiz/)) return go('minutes');
  if (has(/süreç radar|radar|mining|madencilik|process/)) return go('mining');
  if (has(/tasarım|atölye|olması gereken|to be|tu bi/)) return go('tobe');
  if (has(/plan|kpi|metrik|komuta|aksiyon listesi/) && !has(/planla/)) return go('plan');
  if (has(/teslim|fabrika|üret/)) return has(/hepsi|tümü/) ? (go('deliver'), genAll()) : go('deliver');
  if (has(/demo|örnek veri|hızlı başlat/)) return quick();
  if (has(/minute çıkar|analiz et|çalıştır|başlat|uygula|oluştur/)) return primary();
  if (has(/sonraki|ileri|devam/)) return step(1);
  if (has(/önceki|geri/)) return step(-1);
  if (has(/anlat|oku|özetle|ne var/)) return narrate();
  if (has(/sus|sessiz|dur/)) return stopSpeak();
  if (has(/mikrofonu kapat|dinlemeyi bırak/)) return micToggle();
  toast('Komut anlaşılamadı: «' + l + '»'); beep(SFX.err);
}
function quick() {
  S.transcript = K.DEMO_TRANSCRIPT; S.minutes = K.extractMinutes(S.transcript); S.events = K.demoLog();
  S.mining = K.mine(S.events, S.minutes.steps); S.tobe = K.redesign(S.mining); S.plan = K.makePlan(S.tobe, S.minutes, S.mining); S.kpis = K.makeKpis(S.mining, S.tobe); S.delivered = {};
  save(); gain('minutes', 100, 'İlk minute çıkarıldı'); gain('mining', 150, 'Süreç röntgeni çekildi'); gain('tobe', 200, 'To-Be süreç tasarlandı'); gain('plan', 150, 'Plan ve KPI seti hazır');
  go('mining'); speak('Demo senaryo yüklendi. Satın alma süreci analiz edildi. Gezmek için D-Pad, seçmek için A tuşunu kullan.');
}
function narrate() {
  const m = S.mining, t = S.tobe;
  const txt = ({
    hq: 'Dönüşüm Arenası. Toplantıdan başla, süreci analiz et, yeniden tasarla, planla ve yapay zekâ ile teslim et.',
    minutes: S.minutes ? `Minute: ${S.minutes.steps.length} adım, ${S.minutes.decisions.length} karar, ${S.minutes.actions.length} aksiyon. Kararlar: ${S.minutes.decisions.join('. ')}` : 'Toplantı notunu gir ya da dikte et.',
    mining: m ? `${m.nCases} vaka, ortalama ${fd(m.stats.mean)}. Rework yüzde ${Math.round(m.stats.reworkRate * 100)}. En büyük darboğaz ${m.bottlenecks[0].from} ile ${m.bottlenecks[0].to} arası, ${fd(m.bottlenecks[0].avgWait)}. Uyum skoru yüzde ${Math.round(m.conformance.fitness * 100)}.` : 'Henüz analiz yok.',
    tobe: t ? `Yeni süreçte ${t.steps.filter((s) => s.type !== 'remove').length} adım var. ${fd(t.asIsMs)} süreden yaklaşık ${fd(t.toBeMs)} süreye iniyoruz.` : 'To-Be henüz yok.',
    plan: S.plan ? `${S.plan.length} aksiyon, ${S.plan.filter((a) => a.done).length} tamamlandı. ${S.kpis.length} KPI izleniyor.` : 'Plan henüz yok.',
    deliver: `${Object.keys(S.delivered).length} çıktı teslim edildi.`
  })[S.stage];
  const was = S.settings.narrator; S.settings.narrator = true; speak(txt); S.settings.narrator = was;
}

/* ---------------- Eylem dağıtıcı ---------------- */
async function act(name, el) {
  const arg = el && el.dataset ? el.dataset.arg : undefined;
  switch (name) {
    case 'go': return go(arg);
    case 'quick': return quick();
    case 'reset': if (confirm('Tüm ilerleme silinsin mi?')) { S = fresh(); save(); render(); } return;
    case 'mic': return micToggle();
    case 'mode': return setMode(micMode === 'dictate' ? 'command' : 'dictate');
    case 'settings': return openSettings();
    case 'closeModal': return closeModal();
    case 'saveSet': S.settings.key = $('#setKey').value.trim(); S.settings.model = $('#setModel').value.trim() || 'claude-sonnet-5-5'; save(); closeModal(); render(); return toast('Ayarlar kaydedildi');
    case 'setNarr': S.settings.narrator = !S.settings.narrator; { const k = $('#setKey').value, mo = $('#setModel').value; S.settings.key = k; S.settings.model = mo; } save(); return openSettings();
    case 'setSfx': S.settings.sfx = !S.settings.sfx; { const k = $('#setKey').value, mo = $('#setModel').value; S.settings.key = k; S.settings.model = mo; } save(); return openSettings();
    case 'extract': return extractLocal();
    case 'aiExtract': return aiExtract();
    case 'sampleText': S.transcript = K.DEMO_TRANSCRIPT; save(); return render();
    case 'clearText': S.transcript = ''; S.minutes = null; save(); return render();
    case 'narrate': return narrate();
    case 'demoLog': return loadDemoLog();
    case 'upload': return $('#file').click();
    case 'pasteCsv': return loadEvents($('#csvtx').value);
    case 'runMining': return runMining();
    case 'dlTemplate': return download('event_log_sablon.csv', 'case_id;activity;timestamp;resource\nC1;Talep Oluştur;2026-01-05 09:00;Ayşe\nC1;Yönetici Onayı;2026-01-06 14:30;Hakan\nC1;Ödeme;2026-01-09 10:00;Nur\n');
    case 'node': return nodeDetail(arg);
    case 'tnode': { const s = S.tobe.steps.find((x) => x.name === arg); toast(TYPE_NAME[s.type] + ' — ' + s.note); return speak(s.name + '. ' + s.note); }
    case 'tobeGen': return tobeGen();
    case 'planGen': return planGen();
    case 'toggle': return toggleAction(arg);
    case 'kpi+': return kpiStep(+arg, 1);
    case 'kpi-': return kpiStep(+arg, -1);
    case 'gen': await gen(arg); return;
    case 'genAll': return genAll();
    case 'dl': return download(arg + '.md', S.delivered[arg].text);
    case 'dlAll': return download('donusum-paketi.md', ARTS.filter((a) => S.delivered[a[0]]).map((a) => S.delivered[a[0]].text).join('\n\n---\n\n') || '# Henüz çıktı yok');
    case 'read': return speak(S.delivered[arg].text.replace(/[#*`|>-]/g, ' ').slice(0, 900));
  }
}

/* ---------------- Uzamsal gezinme + joystick ---------------- */
function navEls() {
  const scope = modalOpen() ? $('#modal') : document;
  return $$('[data-nav]', scope).filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; });
}
function navMove(dir) {
  const els = navEls(); if (!els.length) return;
  let cur = document.activeElement;
  if (!els.includes(cur)) { els[0].focus(); beep(SFX.move); return; }
  const r = cur.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  let best = null, bs = Infinity;
  for (const e of els) {
    if (e === cur) continue;
    const q = e.getBoundingClientRect(), dx = q.left + q.width / 2 - cx, dy = q.top + q.height / 2 - cy;
    let p, s;
    if (dir === 'right') { p = q.left - r.right + r.width * .5; s = Math.abs(dy); if (dx <= 4) continue; }
    else if (dir === 'left') { p = r.left - q.right + r.width * .5; s = Math.abs(dy); if (dx >= -4) continue; }
    else if (dir === 'down') { p = q.top - r.bottom + r.height * .5; s = Math.abs(dx); if (dy <= 4) continue; }
    else { p = r.top - q.bottom + r.height * .5; s = Math.abs(dx); if (dy >= -4) continue; }
    const sc = Math.max(0, p) + s * 2.2;
    if (sc < bs) { bs = sc; best = e; }
  }
  if (best) { best.focus({ preventScroll: true }); best.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' }); beep(SFX.move); }
}
function activate() {
  const el = document.activeElement; if (!el || el === document.body) return;
  if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') return;
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}
function back() { if (modalOpen()) return closeModal(); go('hq'); }

let padIndex = null;
const prevBtn = {}, lastRep = {};
function pollPad(ts) {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const gp = padIndex != null ? pads[padIndex] : null;
  if (gp) {
    const b = (i) => gp.buttons[i] && gp.buttons[i].pressed;
    const edge = (i, fn) => { const p = b(i); if (p && !prevBtn[i]) fn(); prevBtn[i] = p; };
    const rep = (key, on, fn) => { if (!on) { lastRep[key] = 0; return; } const d = lastRep[key] ? 140 : 380; if (!lastRep[key] || ts - lastRep[key] > d) { if (!lastRep[key]) lastRep[key] = ts; else lastRep[key] = ts; fn(); } };
    const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    rep('up', b(12) || ay < -.6, () => navMove('up')); rep('down', b(13) || ay > .6, () => navMove('down'));
    rep('left', b(14) || ax < -.6, () => navMove('left')); rep('right', b(15) || ax > .6, () => navMove('right'));
    edge(0, () => { activate(); rumble(40, .2, .2); }); edge(1, back); edge(2, micToggle); edge(3, narrate);
    edge(4, () => step(-1)); edge(5, () => step(1)); edge(9, () => setMode(micMode === 'dictate' ? 'command' : 'dictate')); edge(8, () => go('hq'));
    const ry = gp.axes[3] || 0; if (Math.abs(ry) > .25) window.scrollBy(0, ry * 22);
  }
  requestAnimationFrame(pollPad);
}
window.addEventListener('gamepadconnected', (e) => { padIndex = e.gamepad.index; $('#padChip').textContent = '🕹️ ' + e.gamepad.id.slice(0, 22); $('#padChip').classList.add('on'); toast('🕹️ Joystick bağlandı!'); rumble(200, .5, .5); if (!navEls().includes(document.activeElement)) navEls()[0] && navEls()[0].focus(); });
window.addEventListener('gamepaddisconnected', () => { padIndex = null; $('#padChip').textContent = '🕹️ Joystick yok'; $('#padChip').classList.remove('on'); });

/* ---------------- Olaylar ---------------- */
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-act]'); if (!t) return;
  e.preventDefault(); act(t.dataset.act, t);
});
document.addEventListener('input', (e) => { if (e.target.id === 'tx') { S.transcript = e.target.value; save(); } });
document.addEventListener('keydown', (e) => {
  const tag = (document.activeElement && document.activeElement.tagName) || '';
  if (e.key === 'Escape') { if (tag === 'TEXTAREA' || tag === 'INPUT') return document.activeElement.blur(); return back(); }
  if (tag === 'TEXTAREA' || tag === 'INPUT' || e.ctrlKey || e.metaKey || e.altKey) return;
  const dir = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[e.key];
  if (dir) { e.preventDefault(); return navMove(dir); }
  if ((e.key === 'Enter' || e.key === ' ') && document.activeElement && !/BUTTON|A/.test(tag) && document.activeElement.dataset && document.activeElement.dataset.act) { e.preventDefault(); return activate(); }
  const k = e.key.toLowerCase();
  if (k === 'm') micToggle(); else if (k === 'q') step(-1); else if (k === 'e') step(1); else if (k === 'h') go('hq'); else if (k === 'y') narrate();
});
$('#file').addEventListener('change', (e) => {
  const f = e.target.files[0]; if (!f) return; const rd = new FileReader();
  rd.onload = () => { if (S.stage === 'minutes') { S.transcript = String(rd.result); save(); render(); } else loadEvents(String(rd.result)); };
  rd.readAsText(f); e.target.value = '';
});
window.addEventListener('beforeunload', () => stopSpeak());

load(); render(); updateMic(); requestAnimationFrame(pollPad);
// joystick'i otomatik yakala (bazı tarayıcılar olayı ilk tuş basımına kadar tetiklemez)
setInterval(() => { if (padIndex == null) { const p = (navigator.getGamepads ? navigator.getGamepads() : []); const g = [...p].find(Boolean); if (g) { padIndex = g.index; $('#padChip').textContent = '🕹️ ' + g.id.slice(0, 22); $('#padChip').classList.add('on'); } } }, 1000);
if (!S.minutes && !S.mining) setLive('Başlamak için «Hızlı Başlat»a bas ya da «demo» de.');
window.__arena = { get S() { return S; }, act, navMove, voiceCommand, onSpeech };
})();
