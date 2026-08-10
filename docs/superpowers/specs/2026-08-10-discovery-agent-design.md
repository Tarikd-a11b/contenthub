# ContentHub — Keşfet Sayfasında Sohbet Asistanı (Tasarım)

**Tarih:** 2026-08-10
**Durum:** Onaylandı, plana geçilecek
**İlişkili doküman:** `docs/superpowers/specs/2026-08-09-contenthub-design.md` (ana platform tasarımı — bu doküman onu genişletir)

## Amaç

Bugünkü Keşif akışı (n8n Discovery workflow), yalnızca kullanıcının seçtiği geniş ilgi alanı etiketlerine (ör. "Yapay Zeka") göre otomatik olarak 5 kaynak öneriyor. Kullanıcı belirli bir **isim** (ör. "Daron Acemoğlu", "Yanis Varoufakis") aratmak ya da bulunan sonuçlar üzerine konuşarak inceltmek ("bunlardan Türkçe olanları da bul") isteyince elinde bir yol yok. Bu tasarım, Keşfet sayfasına Copilot tarzı bir sohbet asistanı ekleyerek kullanıcının serbest metinle (isim veya konu) arama yapıp bulunan kaynakları doğrudan takibe alabilmesini sağlar.

Bu, önceden konuşulan "arama kutusu + tek seferlik sonuç" tasarımının yerine geçer — sohbet, tekli aramanın yapabildiği her şeyi yapar ve üstüne çok turlu inceltmeyi ekler.

## Kapsam (MVP)

- Sohbet geçmişi **kalıcı değil** — sayfa yenilenince sıfırlanır, veritabanına yazılmaz.
- Sosyal/paylaşımlı keşif (başka kullanıcıların takip ettiklerini görme) **kapsam dışı** — ayrı bir konu.
- Asistan yalnızca Keşfet sayfasında yaşar, ayrı bir route/nav girdisi eklenmez.

## Mimari

```
┌──────────────────────────┐      ┌────────────────────────────┐
│ /discover sayfası         │      │ app/api/discover-agent      │
│ DiscoveryAgent.tsx         │ ---> │ (Next.js Route Handler)     │
│ (mesaj listesi + input)    │ <--- │ - Anthropic Messages API'ye  │
│ - candidate kartları        │      │   doğrudan istek atar        │
│ - "Takip et" butonu         │      │ - claude-haiku-4-5 + web_search│
└──────────┬─────────────────┘      └────────────────────────────┘
           │ Takip et → lib/sourceSearch.ts
           ▼
   Supabase: sources (upsert) + follows (insert)
```

n8n'e hiç uğramaz — bu, otomatik Discovery workflow'undan (ilgi alanı bazlı, arka planda çalışan) bağımsız, kullanıcı tetiklemeli bir özellik. `ANTHROPIC_API_KEY` zaten `.env.local`'da mevcut (n8n Discovery ile aynı anahtar/model kullanılır).

## Bileşenler

- **`app/components/DiscoveryAgent.tsx`** (client component): Mesaj balonları (kullanıcı/asistan), input kutusu, "Gönder". Her turda tüm mesaj geçmişini `/api/discover-agent`'a POST eder. Asistan cevabındaki `candidates` listesini balonun altında kart olarak render eder.
- **`app/api/discover-agent/route.ts`** (server route handler): `{ messages: {role, content}[] }` alır. Sistem promptu ekler (aşağıda), Anthropic Messages API'yi `web_search` tool'uyla çağırır, tool-use turlarını sunucu tarafında döngüyle çözer (n8n Discovery'deki tek-turluk çağrının aksine, burada model birkaç kez arama yapıp sonra son cevabı üretebilir). Modelin son metninden sondaki JSON kaynak listesini ayıklar, `{ reply: string, candidates: Candidate[] }` döner.
- **`lib/sourceSearch.ts`**: `extractCandidates(assistantText): { text: string; candidates: Candidate[] }` — metnin sonundaki JSON bloğunu ayıklayıp temiz metni ayırır (JSON yoksa `candidates: []`, `text` değişmez). `followCandidate(supabase, userId, candidate)` — `sources`'a upsert (`discovered_via_interest_id: null`, manuel eklendiğini işaretler), `follows`'a insert; zaten takipteyse sessizce geçer (mevcut `approveSuggestion`'daki `23505` hata kodu toleransıyla aynı desen).

## Sistem Promptu (özet)

Discovery'nin güncellenmiş promptuyla aynı ruhta: "Kullanıcının belirttiği kişi/konu için dünya çapında tanınmış, alanında uzman kaynaklar bul (kişisel blog, YouTube, X, akademik). Genel haber/link toplama sitelerini önerme. Konuşmanın sonunda bulduğun kaynakları şu JSON formatında ekle: `[{"type":"blog|youtube|x|academic","name":"...","url_or_handle":"...","platform":"..."}]`. JSON'dan önce kullanıcıya normal, doğal bir cevap yaz." Çok turlu konuşmada önceki turlardaki kaynaklar tekrar aranmaz, model konuşma geçmişini bağlam olarak kullanır.

## Veri Akışı

1. Kullanıcı "Daron Acemoğlu" yazar → client `messages` state'ine eklenir → API'ye POST.
2. Sunucu Claude'u çağırır, `web_search` tool-use turlarını çözer, son metni alır.
3. `extractCandidates` ile metin ve kaynak listesi ayrılır → client'a dönülür.
4. Client asistan balonunu (`reply`) ve altında kaynak kartlarını (`candidates`) render eder. Her kart: isim, tür, url_or_handle, "Takip et" butonu (zaten `follows`'ta varsa "Zaten takip ediyorsun", disabled).
5. "Takip et"e basınca `followCandidate` çağrılır, buton "Takip ediliyor ✓" olur.
6. Kullanıcı aynı sohbette devam edebilir ("Türkçe kaynak da var mı?") — tüm geçmiş bir sonraki isteğe eklenir.

## Hata Durumları

- Anthropic API hatası/timeout → sohbette hata balonu: "Bir şeyler ters gitti, tekrar dener misin?", kullanıcı input'u kaybetmez.
- Kaynak bulunamazsa → asistan bunu düz yazıyla açıklar, `candidates: []`, kart gösterilmez.
- `followCandidate` hata verirse (RLS, ağ) → kart üzerinde satır içi hata mesajı, buton tekrar aktif olur (retry edilebilir).

## Test

- `extractCandidates`: JSON bloklu/bloksuz/bozuk-JSON'lu metin girdileriyle birim test (en riskli saf mantık — metin ayrıştırma).
- `followCandidate`: mevcut `discovery.test.ts` kalıbında, fake Supabase client ile upsert/insert çağrılarının doğru argümanlarla yapıldığını doğrulayan birim test.
- `DiscoveryAgent.tsx` ve API route: component/entegrasyon testi yok (projede diğer sayfalarda da yok, aynı seviye) — tarayıcıda elle uçtan uca doğrulanacak.
