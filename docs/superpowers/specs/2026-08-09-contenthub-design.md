# ContentHub — Kişisel İçerik Kürasyon Platformu (Tasarım)

**Tarih:** 2026-08-09
**Durum:** Onaylandı, plana geçilecek
**İlişkili doküman:** `Otomasyon_Projesi_Fizibilite_Raporu.pdf` (2026-07, ilk fikir/fizibilite — bu tasarım onun yerini alır ve genişletir)

## Amaç

Kullanıcının ilgi alanlarını seçtiği, bu alanlarda aktif kaynak/kişileri AI destekli aramayla keşfedip önerdiği,
kullanıcının beğendiklerini profiline eklediği ve takip edilen kaynaklardan gelen yeni içerikleri (blog, YouTube,
sosyal medya, akademik) tek bir web sayfasında toplayan çok kullanıcılı bir platform. Amaç: farklı siteler arasında
kaybolmadan, "ne okusam" sorusuna tek yerden cevap bulmak.

## Kapsam (MVP)

- Web feed (tek sayfa, tüm kaynak türleri karışık, ters kronolojik)
- E-posta/Telegram bildirimi **kapsam dışı** (ileride ayrı bir ek olarak değerlendirilebilir)
- X/Twitter kaynak taraması düşük öncelikli (resmi API ücretli katman gerektiriyor); MVP blog/YouTube/akademik ile başlar

## Mimari

```
┌─────────────┐      ┌──────────────────────────┐
│ Web Frontend │ <--> │        Supabase           │
│ (Next.js)    │      │ - Postgres DB              │
│              │      │ - Auth (kullanıcı girişi)  │
└─────────────┘      │ - Edge Functions (ince API) │
                      └────────▲──────────────────┘
                               │ webhook / Edge Function çağrısı
                      ┌────────┴──────────┐
                      │       n8n           │
                      │ - Zamanlanmış       │
                      │   ingestion job     │
                      │ - Keşif workflow'u  │
                      │   (AI + arama)      │
                      └───┬───────┬────────┘
                          │       │
                   Claude API   RSS/API'ler
                   (keşif)      (RSS-first tarama)
```

**Bileşenler:**
- **Frontend (Next.js):** Kullanıcı girişi, ilgi alanı seçimi, keşif sonuçlarını görme/beğenme, ana feed sayfası.
- **Supabase:** Postgres DB + Auth (hazır kullanıcı girişi, sıfırdan yazılmıyor) + Edge Functions (iş mantığının tek sahibi: dedup, öneri onayı, feed sıralama). n8n'den gelen webhook'ları karşılar.
- **n8n:** İki workflow —
  1. **Keşif:** kullanıcı yeni ilgi alanı eklediğinde tetiklenir, Claude API + web arama ile aday kaynak/kişi bulur, Supabase'e POST eder.
  2. **Ingestion (zamanlanmış):** 4-6 saatte bir, takip edilen kaynakları RSS-first stratejiyle tarar (bkz. aşağıda), yeni içerikleri Supabase'e POST eder.

## Veri Modeli

Supabase Auth zaten `auth.users` tablosunu yönetir; üstüne:

| Tablo | Amaç | Önemli alanlar |
|---|---|---|
| `profiles` | `auth.users`'a 1-1, ek profil bilgisi | `user_id`, `name` |
| `interests` | İlgi alanı tanımları | `id`, `label`, `is_preset` |
| `user_interests` | Kullanıcı ↔ ilgi alanı (çoktan-çoğa) | `user_id`, `interest_id` |
| `sources` | Takip edilebilir kaynak/kişi | `id`, `type` (blog/youtube/x/academic), `name`, `url_or_handle`, `platform`, `status` (active/broken), `discovered_via_interest_id` |
| `discovery_suggestions` | AI keşfinin bulduğu, onay bekleyen adaylar | `user_id`, `source_id`, `interest_id`, `status` (pending/liked/dismissed) |
| `follows` | Kullanıcının profiline eklediği (onaylanmış) kaynaklar | `user_id`, `source_id`, `followed_at` |
| `content_items` | Kaynaklardan çekilen tekil içerikler | `id`, `source_id`, `title`, `url` (unique), `published_at`, `content_type`, `summary`, `fetched_at` |
| `user_content_status` | Okundu/okunmadı takibi | `user_id`, `content_item_id`, `read_at` |

**İlişki akışı:** `user_interests` → n8n keşif → `discovery_suggestions` → kullanıcı beğenir → `follows` → n8n ingestion (periyodik) → `content_items` → frontend feed (`follows` + `content_items` join, `user_content_status` ile okundu ayrımı).

## Keşif Akışı

1. Kullanıcı ilgi alanı ekler (hazır kategori veya serbest metin) → `user_interests`'e satır.
2. Bu ekleme bir Edge Function'ı tetikler → n8n'e webhook.
3. n8n, Claude API'ye (web arama tool'u ile) "bu konuda aktif, takip edilebilir kaynak öner" sorar.
4. Sonuçlar Supabase'e POST edilir → `sources`'a (yoksa) eklenir, `discovery_suggestions`'a `status=pending` yazılır.
5. Frontend "keşfet" sekmesinde pending önerileri kart halinde gösterir.
6. Kullanıcı beğenince → `status='liked'` + `follows`'a satır. Beğenmeyince → `dismissed`, bir daha önerilmez.

Keşif asenkron: sonuçlar birkaç saniye/dakika içinde belirir, frontend "aranıyor..." durumu gösterir.

## Tarama & Feed Akışı (Ingestion)

**RSS-First strateji (maliyet sıfır, kota riski yok):**
- **Blog/haber:** RSS/Atom beslemeleri (n8n RSS node).
- **YouTube:** Resmi API yerine doğrudan kanal RSS'i — `youtube.com/feeds/videos.xml?channel_id=...` (kotasız, ücretsiz).
- **Akademik:** arXiv XML feed.
- **X:** MVP'de düşük öncelik/atlanabilir (resmi API artık ücretli katman gerektiriyor).

**Akış:**
1. n8n'de 4-6 saatte bir çalışan zamanlanmış trigger.
2. `follows`'taki benzersiz kaynaklar Supabase'den çekilir.
3. Her kaynak türüne göre ilgili RSS/feed kaynağı okunur (loop node, her kaynak izole işlenir).
4. Yeni öğeler Supabase'e POST edilir; `content_items.url` unique constraint + `ON CONFLICT DO NOTHING` ile dedup.

**Feed (frontend):** Kullanıcının `follows`'undaki kaynaklara ait `content_items`, `published_at`'e göre ters kronolojik, tek sayfa, tüm kaynak türleri karışık; ilgi alanına göre filtre sekmesi; `user_content_status` ile okundu/okunmadı ayrımı (gri/soluk gösterim).

## Frontend / Sayfa Yapısı

- **`/onboarding`** — ilk girişte ilgi alanı seçimi (hazır kategori + serbest metin)
- **`/discover`** — pending `discovery_suggestions` kart listesi, beğen/geç
- **`/feed`** — ters kronolojik içerik akışı, okundu/okunmadı, ilgi alanı filtresi

Auth: Supabase Auth hazır UI (`@supabase/auth-ui-react`) ile email/şifre veya Google girişi.

## Hata Yönetimi

- **Kaynak bazlı izolasyon:** n8n ingestion'da her kaynak ayrı işlenir; bir kaynağın hatası diğerlerini etkilemez, loglanır, sıradakine geçilir.
- **Claude API/arama hataları (keşif):** 1-2 otomatik retry; yine olmazsa kullanıcıya "şu an öneri bulunamadı, tekrar dene" — sistem kilitlenmez.
- **Rate limit/kota:** n8n'de exponential backoff + günlük çağrı sınırı; aşılırsa kaynak bir sonraki cron'a ertelenir.
- **Dedup çakışmaları:** `content_items.url` unique constraint + `ON CONFLICT DO NOTHING`, sessizce geçilir.
- **Ölü/geçersiz kaynaklar:** art arda 3 taramada hata alan kaynak `sources.status='broken'`, tarama listesinden düşer, kullanıcıya bilgi verilir.
- **Webhook güvenilirliği (n8n → Supabase):** n8n'in yerleşik retry (3 deneme, artan bekleme); son çare execution log'una düşer.

## Test Yaklaşımı

- **Edge Functions (iş mantığı):** Dedup, öneri onayı, feed sıralama gibi saf mantık Vitest ile birim test edilir; yerel/test Supabase (Supabase CLI) kullanılır.
- **n8n workflow'ları:** Otomatik test altyapısı yok; örnek payload'larla manuel tetikleme + execution log'undan doğrulama, sonra zamanlama aktif edilir.
- **Frontend:** Golden path elle test edilir — ilgi alanı ekle → keşif sonucu gör → beğen → feed'de belirdiğini doğrula → okundu işaretle. Ağır E2E framework MVP'de kurulmaz.
- **Veri bütünlüğü:** `url` unique constraint veritabanı seviyesinde zaten garanti.

## Kapsam Dışı (MVP sonrası değerlendirilebilir)

- E-posta bülteni / Telegram bot bildirimi (eski fizibilite raporundan)
- X/Twitter entegrasyonu (ücretli API katmanı gerektirdiği için)
- Çok kullanıcılı ölçeklendirme optimizasyonları (kullanıcı bazlı cron optimizasyonu vb.)
