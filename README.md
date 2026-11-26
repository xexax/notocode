# Dönüşüm Stüdyosu

Kurumsal süreç dönüşümü için tarayıcıda çalışan çalışma aracı: **toplantı tutanağı → process mining → hedef süreç (To-Be) → plan ve KPI → AI destekli teslimat.** Sunucu, kurulum veya derleme gerektirmez; veriler yalnızca tarayıcında (localStorage) kalır.

## Nasıl açılır
- **En hızlı:** `index.html` dosyasına çift tıkla (Chrome/Edge önerilir).
- **Ses tanıma için** `localhost` veya https daha güvenilirdir:
  ```bash
  python3 -m http.server 8000   # sonra http://localhost:8000
  ```
- **Yayınlama:** repoyu GitHub Pages ile yayınla (https). Chrome/Edge'de adres çubuğundaki "Yükle" ile masaüstü uygulaması olarak kurulur ve çevrimdışı çalışır (PWA).

## Özellikler
1. **Toplantılar** — metni yapıştır veya mikrofonla dikte et → katılımcılar, anlatılan süreç adımları, kararlar, aksiyonlar (sahip + termin), riskler, hedefler. İsteğe bağlı Claude ile zenginleştirme.
2. **Süreç Analizi** — event log CSV (`vaka_id;aktivite;zaman;kaynak`) → süreç haritası, varyantlar, darboğaz, rework, devir sayısı, çevrim süresi (ort./medyan/P90) ve **conformance** (toplantıda anlatılan ↔ gerçekleşen).
3. **Hedef Süreç** — otomatik onay, otomasyon, ön kontrol (rework önleme), paralelleştirme, istisna yolu önerileri ve tahmini kazanım.
4. **Plan & KPI** — 30/60/90 gün fazlı yol haritası, sahipli aksiyonlar, takip edilen KPI'lar (başlangıç → hedef → güncel).
5. **Teslimat** — yönetici özeti, SOP, RACI, kullanıcı hikayeleri, otomasyon spesifikasyonu, KPI panosu, değişim iletişimi, AI ajan komutu. Claude API anahtarı girilirse AI ile üretilir; yoksa yerel şablon.

**Çoklu proje**, **dışa aktarma** (rapor .md, yazdır/PDF, aksiyon ve KPI .csv, proje yedeği .json) ve **içe aktarma** desteklenir.

## Ses ve joystick (isteğe bağlı)
- Mikrofon (`M`): komutlar — «toplantı», «süreç analizi», «hedef süreç», «plan», «teslimat», «analiz et», «anlat». **Dikte** modunda söylediklerin toplantı notuna yazılır. Chrome/Edge gerekir (tr-TR).
- Joystick: D-Pad/sol çubuk gez, A seç, B genel bakış, X mikrofon, Y sesli anlat, LB/RB bölüm değiştir, Start komut↔dikte, sağ çubuk kaydır.
- Klavye: ok tuşları, Enter, Esc, M, Q/E.

## Kendi verinle
CSV (`;`, `,` veya sekme ayraçlı) en az üç sütun içermeli: vaka, aktivite, zaman (+ opsiyonel kaynak); Türkçe/İngilizce başlıklar tanınır. Şablon, Süreç Analizi sayfasından indirilebilir.

## Dosyalar
`core.js` (mantık, Node'da test edilebilir) · `app.js` (arayüz) · `style.css` · `index.html` · `sw.js` + `manifest.webmanifest` + `icons/` (PWA)

## Sınırlar
Tutanak çıkarma ve To-Be önerileri kural tabanlıdır (LLM değil); kazanım değerleri tahmindir. API anahtarı yalnızca bu tarayıcıda saklanır; paylaşılan bilgisayarlarda girme.
