-- supabase/migrations/0003_saved_items.sql
-- "Sonra oku": kullanıcı bir içeriği kaydedip sonra ayrı olarak bulabilsin.
--
-- YENİ TABLO AÇILMADI. user_content_status zaten (user_id, content_item_id)
-- birincil anahtarıyla tam bu birimi tutuyor ve "bu kullanıcı bu içerikle ne
-- yaptı" sorusunun doğal yeri orası. Ayrı bir saved_items tablosu aynı çifti
-- ikinci kez modellemek, ikinci bir RLS takımı ve her okumada ek bir join
-- demek olurdu.
--
-- read_at ile aynı biçim: NULL = kaydedilmemiş, dolu = ne zaman kaydedildiği.
-- Boolean yerine zaman damgası, çünkü "ne zaman kaydettim" ileride sıralama
-- için gerekecek ve boolean'dan zaman damgasına geçmek geri dönük veri kaybı.
alter table public.user_content_status
  add column if not exists saved_at timestamptz;

-- RLS: mevcut politikalar SATIR bazlı (auth.uid() = user_id), sütun bazlı
-- değil — bu yüzden yeni sütun kendiliğinden aynı korumayı devralıyor,
-- ek politika gerekmiyor. Doğrulama: başka bir kullanıcının satırını
-- okumaya/yazmaya çalışmak zaten select/insert/update politikalarına takılır.

-- Kaydedilenler listesi user_id'ye göre ve saved_at dolu olanlar üzerinden
-- sorgulanıyor; kısmi indeks yalnızca kaydedilmiş satırları taşır (kayıtların
-- büyük çoğunluğu yalnızca okundu bilgisi olacak, onları indekslemek boşuna).
create index if not exists user_content_status_saved_idx
  on public.user_content_status (user_id, saved_at desc)
  where saved_at is not null;
