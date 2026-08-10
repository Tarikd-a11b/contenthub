# ContentHub — Görsel Tasarım Sistemi (Tasarım)

**Tarih:** 2026-08-10
**Durum:** Onaylandı, plana geçilecek
**İlişkili doküman:** `docs/superpowers/specs/2026-08-09-contenthub-design.md` (ana platform tasarımı)

## Amaç

Bugüne kadar tüm sayfalar (`login`, `onboarding`, `discover`, `feed`, `profile`) ve bileşenler (`NavBar`, `DiscoveryAgent`) çıplak Tailwind varsayılan sınıflarıyla (`rounded border p-4`, `bg-black text-white`) yazıldı — gerçek bir renk paleti, tipografi hiyerarşisi ya da tutarlı bileşen stili yok. Bu, bir kontrast bug'ının (sohbet asistanı balonunun okunamaz olması) fark edilmesiyle ortaya çıktı: `globals.css`, `prefers-color-scheme`'e göre otomatik light/dark CSS değişkeni tanımlıyor ama Tailwind'in `dark:` varyantı hiç kullanılmıyor, bu yüzden light-mode'a özel açık renkli bir arka plan (`bg-gray-100`) kullanan herhangi bir yer, dark-mode'un miras aldığı açık renkli metinle çarpışıp okunmaz hale geliyor.

Bu tasarım, siteyi tek, tutarlı bir koyu-tema tasarım sistemine geçirir: adlandırılmış renk token'ları, iki-rollü bir tipografi sistemi (Geist Sans + Geist Mono, ikisi de zaten projede yüklü), ve kaynak türünü tek bakışta ayırt eden bir "imza" detay (tür-noktaları).

## Kapsam

- **Tüm sayfalar**: login, onboarding, discover, feed, profile
- **Tüm paylaşılan bileşenler**: NavBar, DiscoveryAgent
- **Sadece koyu tema** — `prefers-color-scheme` ile otomatik light-mode desteği kaldırılıyor, tek bir sabit koyu palet kullanılıyor. Açık tema desteği kapsam dışı.
- Yeni sayfa/özellik eklenmiyor — sadece mevcut sayfaların görsel katmanı değişiyor. Veri modeli, RLS, API route'lar bu tasarımın kapsamı dışında.

## Renk Paleti

`tailwind.config.ts`'in `theme.extend.colors` bölümüne sabit hex değerleri olarak eklenir (dark-only olduğu için runtime CSS-değişken anahtarlamasına gerek yok):

| Token | Hex | Kullanım |
|---|---|---|
| `background` | `#08090C` | Sayfa zemini (`body`) |
| `surface` | `#111117` | Kartlar, input'lar, sohbet balonları |
| `border` | `#22222C` | Hairline çizgiler, kart çerçeveleri |
| `foreground` | `#F0F0F5` | Ana metin |
| `muted` | `#84848E` | İkincil metin, metadata, placeholder |
| `accent` | `#6C6CE5` | Birincil aksiyon butonları, aktif nav sekmesi, linkler |

**Tür-noktaları** (yukarıdaki paletten ayrı, sadece kaynak türü göstergesi için — `accent` ile karışmasın diye interaktif elemanlardan farklı bir küçük palet):

| Tür | Hex |
|---|---|
| `blog` | `#D9A64E` (amber) |
| `youtube` | `#E5708A` (mercan) |
| `x` | `#B4B4C4` (nötr gri — X'in kendi kimliği zaten monokrom) |
| `academic` | `#4CBB8A` (yeşilimsi) |

## Tipografi

İki rol, ikisi de zaten `app/layout.tsx`'te yerel font olarak yüklü, yeni font eklenmiyor:
- **Geist Sans** — başlıklar (semibold) ve gövde metni (regular). Sayfa başlığı `text-2xl font-semibold`, bölüm başlığı (`Akış`, `Keşfet`, `Profil`) `text-xl font-semibold`, kart başlığı `text-[15px] font-semibold`, gövde `text-sm`.
- **Geist Mono** — sadece metadata: kaynak türü+handle satırı (`youtube · @veritasium`), tarih, sohbet asistanındaki kaynak URL'i. `text-xs`, `muted` renk, hafif harf aralığı (`tracking-wide`).

## Bileşen Değişiklikleri

- **Kartlar** (`feed`, `discover`, `profile` listeleri, sohbet kaynak kartları): `bg-surface border border-border rounded-lg p-4` — mevcut varsayılan `rounded`den (0.25rem) biraz daha yuvarlak (`rounded-lg`, 0.5rem) köşe.
- **Input'lar** (profil adı, sohbet kutusu, arama): şu an tarayıcı varsayılanı beyaz zeminle koyu kartların arasında göze batıyor — `bg-surface border border-border text-foreground placeholder:text-muted rounded-lg px-3 py-2` ile temaya alınır.
- **Birincil butonlar** (Gönder, Kaydet, Beğen, Takip et): `bg-accent text-white rounded-lg px-4 py-2 hover:opacity-90`.
- **İkincil butonlar** (Geç, Çıkış yap, Takibi bırak): `border border-border text-foreground rounded-lg px-4 py-2 hover:bg-surface`.
- **NavBar**: aktif sekme `text-foreground` + altında `accent` renginde 2px alt çizgi; pasif sekmeler `text-muted`.
- **DiscoveryAgent sohbet balonları**: kullanıcı balonu `bg-accent text-white`; asistan balonu `bg-surface text-foreground` (bugünkü `bg-gray-100` özel-durum düzeltmesi yerine, genel sisteme uyan kalıcı çözüm).
- **Tür-noktası**: her kaynak kartında/metadata satırının başında `w-2 h-2 rounded-full` küçük nokta, türe göre yukarıdaki tür-renginde — `feed`, `discover`, `profile`'daki takip listesi ve sohbet asistanının kaynak kartlarının hepsinde tutarlı.

## globals.css Sadeleştirmesi

`prefers-color-scheme` media query'si ve light-mode CSS değişkenleri kaldırılır; `:root` sadece sabit koyu değerleri tutar (ya da tamamen kaldırılıp `tailwind.config.ts`'teki token'lar `body`ye `@apply bg-background text-foreground` ile uygulanır). Sonuç: sistem tercihi light olan bir kullanıcı da siteyi hep koyu temada görür (kapsamda belirtildiği gibi, açık tema desteği kasıtlı olarak kaldırılıyor).

## Test

Görsel/stil değişiklikleri için otomatik test yazılmaz (projede hiçbir sayfa/bileşen için görsel/component testi yok, bu tasarım da o kuralı bozmuyor). Doğrulama: `npm run build` (tip hatası olmaması) + her sayfanın tarayıcıda elle kontrolü (özellikle input'ların ve sohbet balonlarının okunabilirliği, tür-noktalarının doğru renklerde göründüğü).
