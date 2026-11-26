# Dönüşüm Arenası

Joystick ve ses ile oynanan, oyun tadında **kurumsal AI dönüşüm** programı. Derleme gerektirmez; `index.html` dosyasını açmak (veya GitHub Pages) yeterli.

## Oyun akışı (5 sahne)
1. **Toplantı Odası** — toplantıyı sesle dikte et ya da yapıştır → minute: süreç adımları, kararlar, aksiyon (sahip + tarih), risk, hedef.
2. **Süreç Radarı (process mining)** — event log (`vaka_id;aktivite;zaman;kaynak` CSV) → gerçek süreç haritası, varyantlar, darboğaz, rework, devir sayısı, **conformance** (toplantıda anlatılan ↔ gerçekleşen).
3. **Tasarım Atölyesi** — olması gereken (To-Be) süreç otomatik yeniden çizilir: otomatik onay, otomasyon, ön kontrol (rework önleme), paralelleştirme, istisna yolu + tahmini kazanım.
4. **Komuta Merkezi** — 30/60/90 gün faz planı, sahipli aksiyonlar, takip edilecek KPI'lar (baseline → hedef, ilerleme takibi).
5. **AI Fabrikası** — yönetici özeti, SOP, RACI, kullanıcı hikayeleri, otomasyon spesifikasyonu, KPI panosu, değişim iletişimi, AI ajan system prompt'u. İsteğe bağlı Claude API anahtarıyla AI üretimi; anahtarsız yerel şablon.

XP, rütbe ve rozetlerle ilerlersin. İlerleme tarayıcıda (localStorage) saklanır.

## Kontroller
| Joystick | İşlev | Klavye |
|---|---|---|
| D-Pad / sol çubuk | odakta gezin | ok tuşları |
| A | seç | Enter |
| B | ana ekran / kapat | Esc |
| X | mikrofon | M |
| Y | sahneyi sesli anlat | Y |
| LB / RB | önceki / sonraki sahne | Q / E |
| Start | Komut ↔ Dikte | — |
| Sağ çubuk | kaydır | — |

**Sesli komutlar:** «toplantı», «süreç radarı», «tasarım», «plan», «teslimat», «analiz et», «demo», «anlat», «sonraki», «geri», «dikte modu», «komut modu».
Ses tanıma Chrome/Edge (Web Speech API, `tr-TR`) gerektirir.

## Kendi verinle
Event log CSV'si (`;`, `,` veya sekme ayraçlı) en az üç sütun içermeli: vaka, aktivite, zaman (+ opsiyonel kaynak). Başlıklar Türkçe/İngilizce tanınır. Süreç Radarı'ndan şablon indirebilirsin.

## Dosyalar
- `core.js` — minute çıkarma, process mining, To-Be, plan/KPI (UI'dan bağımsız, Node'da test edilebilir)
- `app.js` — oyun arayüzü, gamepad, ses, AI teslimat
- `style.css`, `index.html`
