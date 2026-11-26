/* Dönüşüm Arenası — çekirdek mantık (UI'dan bağımsız, node'da test edilebilir) */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Core = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const C = {};
  const H = 3600e3, D = 24 * H;

  C.fmtDur = function (ms) {
    if (!isFinite(ms)) return '-';
    const a = Math.abs(ms);
    if (a < H) return Math.round(ms / 60000) + ' dk';
    if (a < 2 * D) return (ms / H).toFixed(1).replace(/\.0$/, '') + ' sa';
    return (ms / D).toFixed(1).replace(/\.0$/, '') + ' gün';
  };
  C.pct = (x) => Math.round(x * 100) + '%';

  /* ---------------- Demo veri ---------------- */
  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  C.DEMO_TRANSCRIPT = `Toplantı: Satın Alma Süreci İyileştirme
Katılımcılar: Ayşe (Satın Alma Müdürü), Hakan (Finans), Burak (Satın Alma), Zeynep (Depo), Nur (Muhasebe)
Süreç şöyle işliyor: önce kullanıcı talep oluşturuyor, ardından yönetici onaylıyor, sonra bütçe kontrolü yapılıyor, ardından tedarikçi seçiliyor, sipariş veriliyor, mal kabul yapılıyor, fatura doğrulanıyor ve son olarak ödeme yapılıyor.
Hakan onay adımının ortalama 2 günde tamamlandığını söyledi ama gerçekte çok daha uzun sürüyor, darboğaz burası.
Burak faturalarda sık sık uyuşmazlık çıktığını ve işin tekrar yapıldığını belirtti, bu büyük bir sorun.
Talep formları eksik geldiği için onay reddedilip tekrar düzeltiliyor, manuel kontrol çok fazla.
Karar: 10 bin TL altındaki taleplerde otomatik onay pilotu başlatılacak.
Karar: Fatura eşleştirme için AI destekli kontrol denenecek.
Ayşe ay sonuna kadar talep formunu yeniden tasarlayacak.
Hakan 15.12 tarihine kadar onay yetki matrisini hazırlayacak.
Burak iki hafta içinde fatura uyuşmazlık nedenlerini analiz edecek.
Zeynep mal kabul için barkod okuma çözümünü araştıracak.
Hedef: toplam süreç süresini 30 günden 12 güne düşürmek ve hata oranını %5'in altına çekmek.
Risk: Tedarikçi sistem entegrasyonu gecikebilir.`;

  C.demoLog = function (n, seed) {
    n = n || 240; const r = rng(seed || 7);
    const ppl = {
      talep: ['Ayşe', 'Mert', 'Elif', 'Can'], yon: ['Hakan', 'Selin'],
      sa: ['Burak', 'Derya', 'Emre'], depo: ['Okan', 'Zeynep'], muh: ['Nur', 'Kerem']
    };
    const pick = (a) => a[Math.floor(r() * a.length)];
    const rg = (lo, hi) => (lo + r() * (hi - lo)) * H;
    const t0 = Date.UTC(2026, 0, 5, 8, 0, 0);
    const ev = [];
    for (let i = 0; i < n; i++) {
      const id = 'SA-' + (1000 + i);
      let t = t0 + i * 2.2 * H + r() * H;
      const add = (act, res, wait) => { t += wait; ev.push({ case: id, act, ts: Math.round(t), res }); };
      add('Talep Oluştur', pick(ppl.talep), 0);
      add('Yönetici Onayı', pick(ppl.yon), rg(20, 70));
      if (r() < 0.16) {
        add('Talep Düzelt', pick(ppl.talep), rg(8, 30));
        add('Yönetici Onayı', pick(ppl.yon), rg(16, 40));
      }
      const budget = r() < 0.65, supplier = r() < 0.88;
      const order = r() < 0.5;
      const doB = () => budget && add('Bütçe Kontrolü', pick(ppl.muh), rg(4, 12));
      const doS = () => supplier && add('Tedarikçi Seçimi', pick(ppl.sa), rg(6, 24));
      if (order) { doB(); doS(); } else { doS(); doB(); }
      add('Sipariş Ver', pick(ppl.sa), rg(2, 6));
      add('Mal Kabul', pick(ppl.depo), rg(48, 120));
      add('Fatura Doğrula', pick(ppl.muh), rg(4, 20));
      if (r() < 0.22) {
        add('Fatura Uyuşmazlığı Çöz', pick(ppl.sa), rg(24, 72));
        add('Fatura Doğrula', pick(ppl.muh), rg(6, 20));
      }
      add('Ödeme', pick(ppl.muh), rg(24, 96));
    }
    return ev;
  };

  /* ---------------- CSV ---------------- */
  C.parseCSV = function (text) {
    text = String(text).replace(/^﻿/, '').trim();
    if (!text) return [];
    const first = text.split(/\r?\n/)[0];
    const delim = [';', '\t', ','].map((d) => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
    const rows = []; let row = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c;
      } else if (c === '"') q = true;
      else if (c === delim) { row.push(cur); cur = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cur); cur = ''; rows.push(row); row = [];
      } else cur += c;
    }
    row.push(cur); rows.push(row);
    return rows.filter((r) => r.some((x) => x.trim()));
  };

  C.parseTime = function (s) {
    s = String(s).trim();
    let m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (m) return Date.UTC(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
    if (/^\d{10,13}$/.test(s)) return s.length <= 10 ? +s * 1000 : +s;
    const t = Date.parse(s);
    return isNaN(t) ? NaN : t;
  };

  C.eventsFromCSV = function (text) {
    const rows = C.parseCSV(text);
    if (rows.length < 2) throw new Error('Veri boş veya başlık satırı yok');
    const hd = rows[0].map((h) => h.trim().toLowerCase().replace(/[^a-zçğıöşü0-9]/g, ''));
    const find = (...k) => hd.findIndex((h) => k.some((x) => h.includes(x)));
    let ci = find('case', 'vaka', 'talepno', 'caseid'), ai = find('activity', 'aktivite', 'adım', 'adim', 'etkinlik', 'işlem', 'islem'),
      ti = find('timestamp', 'time', 'zaman', 'tarih', 'date'), ri = find('resource', 'kaynak', 'user', 'kullanıcı', 'kullanici', 'sorumlu', 'owner');
    if (ci < 0 || ai < 0 || ti < 0) {
      if (rows[0].length < 3) throw new Error('En az 3 sütun gerekli: vaka, aktivite, zaman');
      ci = 0; ai = 1; ti = 2; ri = rows[0].length > 3 ? 3 : -1;
    }
    const ev = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i], ts = C.parseTime(r[ti] || '');
      if (!r[ci] || !r[ai] || isNaN(ts)) continue;
      ev.push({ case: r[ci].trim(), act: r[ai].trim(), ts, res: ri >= 0 ? (r[ri] || '').trim() : '' });
    }
    if (!ev.length) throw new Error('Geçerli olay satırı bulunamadı (zaman formatını kontrol edin)');
    return ev;
  };

  C.eventsToCSV = (ev) => 'case_id;activity;timestamp;resource\n' +
    ev.map((e) => [e.case, e.act, new Date(e.ts).toISOString(), e.res].join(';')).join('\n');

  /* ---------------- Metin yardımcıları ---------------- */
  const norm = (s) => String(s).toLocaleLowerCase('tr').replace(/[^a-zçğıöşü0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  const stem = (w) => w.slice(0, 5);
  C.fuzzyMatch = function (step, names) {
    const st = norm(step).map(stem); let best = null, bs = 0;
    names.forEach((n) => {
      const nt = norm(n).map(stem);
      const inter = st.filter((x) => nt.includes(x)).length;
      const sc = inter / Math.max(1, Math.min(st.length, nt.length));
      if (sc > bs) { bs = sc; best = n; }
    });
    return bs >= 0.5 ? best : null;
  };
  function ed(a, b) {
    const m = a.length, n = b.length;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[n];
  }

  /* ---------------- Toplantı minute çıkarma ---------------- */
  const UP = 'A-ZÇĞİÖŞÜ';
  const STOP_OWNER = new Set(['Tüm', 'Bu', 'Her', 'Ekip', 'Süreç', 'Karar', 'Risk', 'Hedef', 'Toplantı', 'Önce', 'Sonra', 'Fatura', 'Talep', 'Onay', 'Ayrıca', 'Ancak', 'Ama', 'Yönetim', 'Şirket', 'Müşteri', 'Tedarikçi']);
  const DUE_RE = /(\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?\s*(?:tarihine kadar|tarihinde)?|ay sonu(?:na kadar)?|hafta sonu(?:na kadar)?|bu hafta|haftaya|yarın|pazartesi|salı|çarşamba|perşembe|cuma|Q[1-4]|\d+\s*(?:gün|hafta|ay)\s*içinde|(?:bir|iki|üç|dört|beş|on)\s*(?:gün|hafta|ay)\s*içinde)/i;
  const ACTION_RE = /(acak|ecek|acağız|eceğiz|acaktır|ecektir|malı|meli|malıdır|melidir)\s*[.!]?\s*$|sorumlu|aksiyon/i;
  const SEQ_RE = /(önce|sonra|ardından|sonrasında|ilk olarak|son olarak|daha sonra)/gi;

  C.extractMinutes = function (text) {
    const out = { title: '', people: [], decisions: [], actions: [], risks: [], goals: [], steps: [], source: 'yerel' };
    const lines = String(text).split(/\n+/).map((l) => l.trim()).filter(Boolean);
    const tl = lines.find((l) => /^toplantı\s*:/i.test(l));
    if (tl) out.title = tl.replace(/^toplantı\s*:/i, '').trim();
    const addPerson = (name, role) => {
      name = name.trim(); if (!name || STOP_OWNER.has(name)) return;
      const ex = out.people.find((p) => p.name === name);
      if (ex) { if (role && !ex.role) ex.role = role; } else out.people.push({ name, role: role || '' });
    };
    const pl = lines.find((l) => /^katılımcılar\s*:/i.test(l));
    if (pl) pl.replace(/^katılımcılar\s*:/i, '').split(/[,;]/).forEach((p) => {
      const m = p.trim().match(/^([^()]+?)\s*(?:\(([^)]*)\))?$/);
      if (m) addPerson(m[1], m[2]);
    });
    const body = lines.filter((l) => l !== tl && l !== pl).join('\n');
    const sents = body.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
    const nameRe = new RegExp('^([' + UP + '][a-zçğıöşü]+)\\s');
    const speakRe = new RegExp('([' + UP + '][a-zçğıöşü]+)\\s+(?:[^.]{0,60}?\\s)?(?:dedi|belirtti|söyledi|önerdi|bildirdi|aktardı|ifade etti)');
    for (const s0 of sents) {
      const s = s0.replace(/[.!]+$/, '');
      const sm = s.match(speakRe); if (sm) addPerson(sm[1]);
      // süreç adımları
      const seqHits = (s.match(SEQ_RE) || []).length;
      if (seqHits >= 2 || /^süreç[^:]*:/i.test(s) || /^(önce|sonra|ardından|ilk olarak|son olarak|daha sonra)\s/i.test(s)) {
        let part = s.includes(':') ? s.split(':').slice(1).join(':') : s;
        part.split(/,|;|\s(?:ve son olarak|son olarak|ardından|sonrasında|daha sonra|sonra|önce|ilk olarak|ve)\s/i).forEach((f) => {
          f = f.trim().replace(/^(ve|ile|önce|ilk olarak|sonra|daha sonra|ardından|son olarak)\s+/i, '');
          if (f.length >= 4 && f.length <= 70 && /\p{L}/u.test(f)) out.steps.push(f.charAt(0).toLocaleUpperCase('tr') + f.slice(1));
        });
        continue;
      }
      if (/^karar\b|karar verildi|kararlaştırıl|uzlaşıl|onaylandı/i.test(s)) { out.decisions.push(s.replace(/^karar\s*:\s*/i, '')); continue; }
      if (/^risk\s*:/i.test(s)) { out.risks.push(s.replace(/^risk\s*:\s*/i, '')); continue; }
      if (/^(hedef|kpi)\b/i.test(s) || (/hedef/i.test(s) && /\d/.test(s))) { out.goals.push(s.replace(/^hedef\s*:\s*/i, '')); continue; }
      const nm = s.match(nameRe);
      const owner = nm && !STOP_OWNER.has(nm[1]) && (out.people.some((p) => p.name === nm[1]) || ACTION_RE.test(s)) ? nm[1] : '';
      if (ACTION_RE.test(s) && !/^(risk|sorun)/i.test(s)) {
        const due = (s.match(DUE_RE) || [''])[0].trim();
        const sor = s.match(new RegExp('sorumlu(?:su)?\\s*[:\\-]?\\s*([' + UP + '][a-zçğıöşü]+)'));
        const o = owner || (sor && sor[1]) || '';
        if (o) addPerson(o);
        out.actions.push({ text: s, owner: o, due });
        continue;
      }
      if (/risk|sorun|problem|gecik|darboğaz|tekrar|hata|uyuşmazlık|manuel|eksik|kaybolu|yavaş|bekl/i.test(s)) out.risks.push(s);
    }
    out.steps = out.steps.filter((x, i, a) => a.findIndex((y) => y.toLowerCase() === x.toLowerCase()) === i);
    return out;
  };

  /* ---------------- Process mining ---------------- */
  C.mine = function (events, refSteps) {
    const cases = new Map();
    for (const e of events) { let a = cases.get(e.case); if (!a) cases.set(e.case, a = []); a.push(e); }
    const acts = {}, edges = {}, variants = {};
    const durs = []; const loopBody = {}; const reworkByAct = {};
    let reworkCases = 0, handoffs = 0, reworkMsTotal = 0;
    for (const a of cases.values()) {
      a.sort((x, y) => x.ts - y.ts);
      const seq = a.map((e) => e.act), dur = a[a.length - 1].ts - a[0].ts;
      durs.push(dur);
      const vk = seq.join('\u0001'); const V = variants[vk] || (variants[vk] = { seq, count: 0, total: 0 });
      V.count++; V.total += dur;
      const seen = {}; let rw = false;
      a.forEach((e, i) => {
        const A = acts[e.act] || (acts[e.act] = { name: e.act, count: 0, cases: 0, wait: 0, waitN: 0, pos: 0, res: {}, repeat: 0 });
        A.count++; A.pos += a.length > 1 ? i / (a.length - 1) : 0;
        A.res[e.res || '-'] = (A.res[e.res || '-'] || 0) + 1;
        if (seen[e.act] !== undefined) {
          A.repeat++; rw = true;
          const j0 = seen[e.act]; const rwMs = e.ts - a[j0].ts; reworkMsTotal += rwMs;
          reworkByAct[e.act] = (reworkByAct[e.act] || 0) + rwMs;
          for (let k = j0 + 1; k < i; k++) { const nm = a[k].act; (loopBody[nm] || (loopBody[nm] = { n: 0 })).n++; }
        } else A.cases++;
        seen[e.act] = i;
        if (i > 0) {
          const p = a[i - 1], k = p.act + '\u0001' + e.act, w = e.ts - p.ts;
          const E = edges[k] || (edges[k] = { from: p.act, to: e.act, count: 0, wait: 0 });
          E.count++; E.wait += w; A.wait += w; A.waitN++;
          if ((p.res || '') !== (e.res || '')) handoffs++;
        }
      });
      if (rw) reworkCases++;
    }
    const nCases = cases.size;
    const vlist = Object.values(variants).sort((a, b) => b.count - a.count);
    const happy = new Set(vlist[0].seq);
    const nodes = Object.values(acts).map((A) => ({
      name: A.name, count: A.count, cases: A.cases, share: A.cases / nCases,
      avgWait: A.waitN ? A.wait / A.waitN : 0, totalWait: A.wait, avgPos: A.pos / A.count, repeat: A.repeat,
      topRes: Object.entries(A.res).sort((x, y) => y[1] - x[1]).slice(0, 3).map((x) => x[0]), resCount: Object.keys(A.res).length,
      happy: happy.has(A.name)
    }));
    const byName = Object.fromEntries(nodes.map((x) => [x.name, x]));
    const elist = Object.values(edges).map((E) => ({ ...E, avgWait: E.wait / E.count, back: byName[E.to].avgPos < byName[E.from].avgPos - 1e-9 }));
    const reworkNodes = nodes.filter((x) => !x.happy && loopBody[x.name] && loopBody[x.name].n >= 0.5 * x.count).map((x) => x.name);
    const sorted = durs.slice().sort((a, b) => a - b);
    const q = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
    const m = {
      nCases, nEvents: events.length, nodes, edges: elist,
      variants: vlist.slice(0, 12).map((v) => ({ seq: v.seq, count: v.count, share: v.count / nCases, avg: v.total / v.count })),
      nVariants: vlist.length, reworkNodes,
      stats: {
        mean: durs.reduce((a, b) => a + b, 0) / nCases, median: q(0.5), p90: q(0.9),
        reworkRate: reworkCases / nCases, handoffsPerCase: handoffs / nCases,
        happyShare: vlist[0].count / nCases, reworkMs: reworkMsTotal / nCases
      },
      bottlenecks: elist.slice().sort((a, b) => b.wait - a.wait).slice(0, 6)
    };
    m.reworkByAct = reworkByAct;
    m.conformance = C.conformance(m, vlist, refSteps);
    return m;
  };

  C.conformance = function (m, vlist, refSteps) {
    const names = m.nodes.map((n) => n.name);
    let ref, source;
    if (refSteps && refSteps.length >= 3) {
      ref = []; const missing = [];
      refSteps.forEach((s) => { const mt = C.fuzzyMatch(s, names); if (mt) { if (!ref.includes(mt)) ref.push(mt); } else missing.push(s); });
      source = 'toplantıda anlatılan süreç';
      if (ref.length >= 2) return finish(ref, missing, source);
    }
    return finish(vlist[0].seq.filter((x, i, a) => a.indexOf(x) === i), [], 'en sık varyant (happy path)');
    function finish(ref, missing, source) {
      let fit = 0, exact = 0, tot = 0;
      (vlist || []).forEach((v) => {
        const d = ed(v.seq, ref), f = 1 - d / Math.max(v.seq.length, ref.length);
        fit += f * v.count; tot += v.count; if (d === 0) exact += v.count;
      });
      return {
        source, ref, fitness: fit / tot, exactShare: exact / tot, missing,
        extra: names.filter((n) => !ref.includes(n))
      };
    }
  };

  /* ---------------- To-Be yeniden tasarım ---------------- */
  const AUTO_RE = /kontrol|doğrula|kayıt|eşleş|fatura|bildir|ödeme|hesapla|veri|rapor|belge|mutabakat/i;
  const APPR_RE = /onay|imza|yetki/i;

  C.redesign = function (m) {
    const n = m.nCases, st = m.stats;
    const nodes = m.nodes.slice().sort((a, b) => a.avgPos - b.avgPos);
    const steps = []; let saving = 0; const parallel = [];
    const byName = Object.fromEntries(nodes.map((x) => [x.name, x]));
    // paralelleştirme adayları
    const used = new Set();
    m.edges.forEach((e) => {
      const rev = m.edges.find((x) => x.from === e.to && x.to === e.from);
      if (!rev || used.has(e.from + '|' + e.to) || used.has(e.to + '|' + e.from)) return;
      if (Math.min(e.count, rev.count) >= 0.25 * Math.max(e.count, rev.count) && Math.min(e.count, rev.count) >= 0.05 * n) {
        const a = byName[e.from], b = byName[e.to];
        if (m.reworkNodes.includes(a.name) || m.reworkNodes.includes(b.name)) return;
        // iki yönde de akan ama birbirinin tekrarı olmayan (sıra bağımsız) adımlar
        if (a.repeat > 0.02 * a.count || b.repeat > 0.02 * b.count) return;
        used.add(e.from + '|' + e.to);
        const share = Math.min(a.cases, b.cases) / n;
        const save = Math.min(a.avgWait, b.avgWait) * 0.5 * share;
        parallel.push({ a: a.name, b: b.name, saveMs: save });
      }
    });
    const parSecond = {};
    parallel.forEach((p) => { parSecond[p.b] = p; });
    const reworkSave = 0.8 * st.reworkMs;
    const reworkPer = m.reworkNodes.length ? reworkSave / m.reworkNodes.length : 0;
    const inserted = new Set();
    for (const a of nodes) {
      const share = a.share;
      if (m.reworkNodes.includes(a.name)) {
        const inE = m.edges.filter((e) => e.to === a.name).sort((x, y) => y.count - x.count)[0];
        const gate = inE && byName[inE.from];
        if (gate && !inserted.has(gate.name)) {
          inserted.add(gate.name);
          const idx = steps.findIndex((s) => s.name === gate.name);
          const ns = { name: 'Ön Kontrol: ' + gate.name, type: 'new', share: 1, saveMs: 0, note: 'AI destekli form/veri doğrulama; hatalı girdi sürece girmeden yakalanır (ilk seferde doğru).' };
          if (idx >= 0) steps.splice(idx, 0, ns); else steps.push(ns);
        }
        steps.push({ name: a.name, type: 'remove', share, saveMs: reworkPer, note: 'Tekrar işi (rework) — kök neden önleyici kontrolle ortadan kaldırılır.' });
        saving += reworkPer; continue;
      }
      if (!a.happy && share < 0.25) {
        steps.push({ name: a.name, type: 'exception', share, saveMs: 0, note: 'Yalnız %' + Math.round(share * 100) + ' vakada görülüyor — standart akıştan çıkarıp istisna yoluna al.' });
        continue;
      }
      let step = { name: a.name, type: 'keep', share, saveMs: 0, note: 'Adım korunur.' };
      if (APPR_RE.test(a.name) && a.avgWait > 4 * H) {
        step = { ...step, type: 'approval', saveMs: a.avgWait * 0.6 * share, note: 'Ortalama bekleme ' + C.fmtDur(a.avgWait) + '. Eşiğe/riske bağlı otomatik onay; yalnız istisnada insan onayı.' };
      } else if (AUTO_RE.test(a.name) && share >= 0.4) {
        step = { ...step, type: 'automate', saveMs: a.avgWait * 0.7 * share, note: 'Kural/AI ile otomatikleştir (RPA, belge zekâsı, eşleştirme). Bekleme: ' + C.fmtDur(a.avgWait) + '.' };
      }
      if (parSecond[a.name]) {
        const p = parSecond[a.name];
        step = { ...step, type: step.type === 'keep' ? 'parallel' : step.type, parallelWith: p.a, saveMs: step.saveMs + p.saveMs, note: step.note + ' « ' + p.a + ' » ile paralel yürüt.' };
        if (step.type === 'parallel') step.note = '« ' + p.a + ' » ile aynı anda yürütülür (sıra bağımsız).';
      }
      saving += step.saveMs;
      steps.push(step);
    }
    const asIs = st.mean, toBe = Math.max(asIs * 0.2, asIs - saving);
    return {
      steps, parallel, asIsMs: asIs, toBeMs: toBe, improvement: 1 - toBe / asIs,
      automated: steps.filter((s) => s.type === 'automate' || s.type === 'approval' || s.type === 'new').length,
      total: steps.filter((s) => s.type !== 'remove').length
    };
  };

  /* ---------------- Plan & KPI ---------------- */
  const FOUNDATION = [
    ['Süreç sahibi ata ve dönüşüm yönetişimi kur (haftalık ritim)', 1, 1],
    ['Event log toplamayı otomatikleştir (ERP/CRM entegrasyonu, sürekli mining)', 1, 2],
    ['AI pilot kullanıcıları için eğitim ve değişim yönetimi', 2, 2],
    ['KPI panosunu canlıya al ve haftalık gözden geçirme başlat', 2, 1],
    ['Başarılı pilotları ölçekle, bir sonraki sürece taşı', 3, 3]
  ];
  C.makePlan = function (tobe, minutes, m) {
    const owners = (minutes && minutes.people && minutes.people.length ? minutes.people.map((p) => p.name) : ['Süreç Sahibi', 'BT Lideri', 'İş Birimi Lideri', 'Veri/AI Ekibi']);
    let oi = 0; const nextOwner = () => owners[oi++ % owners.length];
    const acts = []; let id = 1;
    const add = (o) => acts.push({ id: 'A' + id++, owner: nextOwner(), done: false, impactMs: 0, src: 'To-Be', ...o });
    tobe.steps.forEach((s) => {
      if (s.type === 'remove') add({ title: 'Kök neden analizi ve önleyici kontrol: ' + s.name, effort: 2, impactMs: s.saveMs, kpi: 'rework' });
      else if (s.type === 'new') add({ title: s.name + ' — AI ön kontrol uygulaması', effort: 2, impactMs: 0, kpi: 'rework' });
      else if (s.type === 'approval') add({ title: s.name + ': eşik/risk bazlı otomatik onay kuralı', effort: 1, impactMs: s.saveMs, kpi: 'approval' });
      else if (s.type === 'automate') add({ title: s.name + ' adımını otomatikleştir (RPA/AI)', effort: 2, impactMs: s.saveMs, kpi: 'automation' });
      else if (s.type === 'exception') add({ title: s.name + ' için istisna yolunu tanımla', effort: 1, impactMs: 0, kpi: 'happy' });
    });
    tobe.parallel.forEach((p) => add({ title: p.a + ' ∥ ' + p.b + ' adımlarını paralelleştir', effort: 1, impactMs: p.saveMs, kpi: 'cycle' }));
    ((minutes && minutes.actions) || []).forEach((a) => acts.push({
      id: 'A' + id++, title: a.text.replace(/\.$/, ''), owner: a.owner || nextOwner(), done: false, impactMs: 0, effort: 1,
      kpi: 'cycle', src: 'Toplantı', due: a.due
    }));
    FOUNDATION.forEach(([t, ph, ef]) => add({ title: t, effort: ef, phaseOverride: ph, src: 'Temel', kpi: 'cycle' }));
    acts.forEach((a) => { a.phase = a.phaseOverride || Math.min(3, a.effort); delete a.phaseOverride; if (a.src === 'Toplantı') a.phase = /hafta|yarın|gün içinde|bu hafta/i.test(a.due || '') ? 1 : 2; });
    acts.sort((x, y) => x.phase - y.phase || y.impactMs - x.impactMs);
    return acts;
  };

  C.makeKpis = function (m, tobe) {
    const st = m.stats;
    const appr = m.nodes.filter((x) => APPR_RE.test(x.name));
    const apprWait = appr.length ? appr.reduce((a, x) => a + x.avgWait, 0) / appr.length : 0;
    const k = [
      { id: 'cycle', name: 'Ortalama çevrim süresi', unit: 'gün', base: st.mean / D, target: tobe.toBeMs / D, dir: 'down', fmt: 1, why: 'Uçtan uca süreç süresi' },
      { id: 'approval', name: 'Onay bekleme süresi', unit: 'gün', base: apprWait / D, target: apprWait / D * 0.4, dir: 'down', fmt: 1, why: 'Onay adımlarındaki ortalama bekleme' },
      { id: 'rework', name: 'Tekrar iş (rework) oranı', unit: '%', base: st.reworkRate * 100, target: Math.min(5, st.reworkRate * 100 * 0.3), dir: 'down', fmt: 0, why: 'En az bir adımı tekrar edilen vakalar' },
      { id: 'happy', name: 'Standart akış (happy path) oranı', unit: '%', base: st.happyShare * 100, target: Math.min(90, Math.max(75, st.happyShare * 100 * 2)), dir: 'up', fmt: 0, why: 'İstisnasız tamamlanan vakalar' },
      { id: 'handoff', name: 'Vaka başına devir (handoff)', unit: 'adet', base: st.handoffsPerCase, target: st.handoffsPerCase * 0.6, dir: 'down', fmt: 1, why: 'Kaynak değişimi sayısı' },
      { id: 'conf', name: 'Süreç uyum skoru (conformance)', unit: '%', base: m.conformance.fitness * 100, target: Math.min(95, Math.max(85, m.conformance.fitness * 100 + 10)), dir: 'up', fmt: 0, why: 'Gerçek akışın hedef modele uyumu' },
      { id: 'automation', name: 'Otomasyon kapsamı', unit: '%', base: 0, target: Math.max(30, Math.round(100 * tobe.automated / Math.max(1, tobe.total))), dir: 'up', fmt: 0, why: 'AI/otomasyonla yürüyen adım oranı' }
    ];
    k.forEach((x) => { x.current = x.base; });
    return k;
  };
  C.kpiProgress = function (k) {
    const span = k.target - k.base; if (Math.abs(span) < 1e-9) return 1;
    return Math.max(0, Math.min(1, (k.current - k.base) / span));
  };

  return C;
});
