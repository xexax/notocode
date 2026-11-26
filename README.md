# Dönüşüm Stüdyosu

Kurumsal süreç dönüşümü için tarayıcıda çalışan çalışma aracı: **toplantı tutanağı → process mining → hedef süreç (To-Be) → plan ve KPI → AI destekli teslimat.** Sunucu, kurulum veya derleme gerektirmez; veriler yalnızca tarayıcında (localStorage) kalır.

## Nasıl açılır
- **En hızlı:** `index.html` dosyasına çift tıkla (Chrome/Edge önerilir).
- **Ses tanıma için** `localhost` veya https daha güvenilirdir:
  ```bash
  python3 -m http.server 8000   # sonra http://localhost:8000
  ```
- **iPad / iPhone (uygulama gibi):** https adresini Safari'de aç → **Paylaş → Ana Ekrana Ekle**. Tam ekran, kendi ikonuyla ve çevrimdışı çalışır; Safari'de ilk açılışta kurulum ipucu görünür. Dokunmatik hedefler büyütülmüştür, çentik/güvenli alan desteklenir.
- **Yayınlama:** repoyu GitHub Pages ile yayınla (https). Chrome/Edge'de adres çubuğundaki "Yükle" ile masaüstü uygulaması olarak kurulur ve çevrimdışı çalışır (PWA).

## İş hesabı ile giriş (Microsoft 365) — Kaynaklar
**Kaynaklar** sayfasından Microsoft 365 / Entra ID ile (SSO) giriş yapılır; sunucu yoktur, giriş tarayıcıdan OAuth2 kod + PKCE ile doğrudan Microsoft'a yapılır. Yetkiler salt okunurdur (hiçbir şey gönderilmez/silinmez).
- **E-posta:** ara veya son e-postaları getir, seçtiklerini tutanak metnine aktar (alıntı/imza temizlenir).
- **Toplantılar:** son 14 gün / önümüzdeki 7 gün takvimi. Geçmiş Teams toplantıları için **transkript al** (VTT → konuşmacılı metin → tutanak). Gelecek toplantı için **Katıl + canlı not**: toplantıyı açar, cihaz mikrofonuyla dikte başlatır.
- **Kurulum (bir kerelik):** Entra yönetim merkezinde uygulama kaydı → platform *SPA*, yönlendirme URI'si = uygulamanın adresi (örn. `https://notocode.com/studio/`) → Graph *delegated* izinleri `User.Read, Mail.Read, Calendars.Read, OnlineMeetings.Read` (+ transkript için `OnlineMeetingTranscript.Read.All`, genelde yönetici onayı) → Client ID'yi Ayarlar'a gir. Adımlar uygulama içinde de anlatılır.
- **Sınır:** Toplantıya *kendiliğinden* katılıp kayıt alan bot (Azure Bot + Graph Calling API) sunucu servisi gerektirir ve dahil değildir; Teams transkripsiyonunu açıp toplantı sonrası içe aktarmak önerilir. Giriş yalnızca https/localhost adresinde çalışır (dosyadan açılışta çalışmaz).

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
