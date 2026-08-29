import Link from 'next/link';
import Constellation from './components/Constellation';
import LandingMotion from './components/LandingMotion';

/* Örnek akış GERÇEK verilerden alındı (canlı veritabanı). Uydurma başlık yok:
   sayfanın iddiası "bu çalışıyor" olduğu için örneğin de gerçek olması gerekiyor. */
type Girdi = { baslik: string; kaynak: string; tur: 'youtube' | 'blog'; onceki: string };

const AKIS: { gun: string; ay: string; tarih: string; sayi: number; girdiler: Girdi[] }[] = [
  {
    gun: '24', ay: 'AĞUSTOS', tarih: '2026-08-24', sayi: 3,
    girdiler: [
      { baslik: 'Yabancı dilde seküler kelimesini çok duymuyorum!', kaynak: 'Mahalle Yanarken', tur: 'youtube', onceki: '5 gün önce' },
      { baslik: '“Bizim millet çocuk yaşta köreltiliyor” — Coşkun Aral & Emrah Safa Gürkan', kaynak: 'OMNIBUS', tur: 'youtube', onceki: '5 gün önce' },
      { baslik: 'It’s impossible to choose a number at random', kaynak: 'Veritasium', tur: 'youtube', onceki: '5 gün önce' },
    ],
  },
  {
    gun: '23', ay: 'AĞUSTOS', tarih: '2026-08-23', sayi: 2,
    girdiler: [
      { baslik: 'Ölüyü gömemezsen ne yaparsın? — Coşkun Aral & Emrah Safa Gürkan', kaynak: 'OMNIBUS', tur: 'youtube', onceki: '6 gün önce' },
      { baslik: 'Moxo360 Testi Sertifikasyon Eğitimi', kaynak: 'Moxo Türkiye', tur: 'youtube', onceki: '6 gün önce' },
    ],
  },
  {
    gun: '22', ay: 'TEMMUZ', tarih: '2026-07-22', sayi: 2,
    girdiler: [
      { baslik: 'Don’t fall for Project Smear, Mr Burnham — Unherd op-ed', kaynak: 'Yanis Varoufakis Blog', tur: 'blog', onceki: '38 gün önce' },
      { baslik: 'AI and the false consciousness trap — Unherd', kaynak: 'Yanis Varoufakis Blog', tur: 'blog', onceki: '38 gün önce' },
    ],
  },
];

const NOKTA: Record<Girdi['tur'], string> = {
  youtube: 'bg-source-youtube',
  blog: 'bg-source-blog',
};

/* Sıralı adımlar — ÖNCE/SONRA/SÜREKLİ. Sıra bilgi taşıyor: kaynak önerisi
   gelmeden akış dolmuyor, ilgi alanı seçilmeden öneri gelmiyor. */
const ADIMLAR = [
  { sira: 'ÖNCE', baslik: 'İlgi alanlarını seç', metin: 'Kozmolojiden siber güvenliğe, ne okumak istediğini sen söylersin. Liste sabit değil, sonradan değiştirirsin.' },
  { sira: 'SONRA', baslik: 'Önerileri gözden geçir', metin: 'Claude web’de arayıp o alanlarda takip edilmeye değer kişi ve yayınları bulur. Her öneriyi tek tek onaylar ya da geçersin.' },
  { sira: 'SÜREKLİ', baslik: 'Akışını oku', metin: 'Onayladığın kaynaklar dört saatte bir taranır. Yeni ne çıktıysa yayımlanma sırasına göre akışta görünür.' },
];

const gutter = 'pl-[var(--lp-gutter)]';

export default function Landing() {
  return (
    <main className="min-h-dvh bg-background text-foreground [--lp-gutter:2.25rem] sm:[--lp-gutter:3.25rem]">
      <LandingMotion />

      {/* ── üst şerit ──────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="font-display text-sm font-semibold tracking-tight" style={{ fontVariationSettings: "'wdth' 112, 'wght' 620" }}>
            ContentHub<span className="text-accent">.</span>
          </span>
          <Link
            href="/feed"
            className="border-b border-transparent pb-0.5 font-mono text-xs text-muted transition-colors hover:border-accent hover:text-foreground"
          >
            Giriş yap
          </Link>
        </div>
      </header>

      {/* ── takımyıldız sahnesi (tam ekran hero) ───────────────── */}
      <section data-lp-host className="relative flex min-h-dvh flex-col justify-center overflow-hidden px-6">
        <Constellation />

        {/* metnin arkasını okunur tut: sola doğru koyulaşan vignette */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{
            background:
              'radial-gradient(115% 85% at 28% 46%, rgba(8,9,12,0.88) 0%, rgba(8,9,12,0.60) 34%, rgba(8,9,12,0.12) 64%, transparent 100%)',
          }}
        />
        {/* alt kenardan feed'e yumuşak geçiş */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[20vh]"
          style={{ background: 'linear-gradient(to bottom, transparent, #08090C)' }}
        />

        <div className={`relative z-[2] mx-auto w-full max-w-5xl ${gutter}`}>
          <p className="flex items-center gap-2.5 font-mono text-[0.7rem] tracking-[0.13em] text-[#585863]">
            <span className="lp-beat" aria-hidden />
            <span id="lp-today">29 AĞU 2026</span>
            <span id="lp-clock" className="tabular-nums text-muted">00:00:00</span>
          </p>

          <h1 className="lp-h1 mt-[2.1rem]">
            Takip ettiklerin<br />
            <span className="quiet">ne yayımladıysa,</span>
            <span className="turn">sırasıyla.</span>
          </h1>

          <p className="mt-9 max-w-[34rem] font-read text-[1.075rem] font-light leading-[1.68] text-muted">
            Kaynakları sen seçersin, sıralamayı zaman yapar.{' '}
            <em className="font-normal not-italic text-foreground">Öneri motoru yok, sonsuz kaydırma yok</em> — sadece
            takip ettiğin insanların yeni işleri, çıktıkları sırayla.
          </p>

          <p className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3">
            <Link href="/feed" className="lp-go border-b border-accent pb-1.5 font-mono text-[0.775rem] text-foreground">
              Akışını kur<span className="ml-1.5 text-accent">→</span>
            </Link>
            <a
              href="https://github.com/Tarikd-a11b/contenthub"
              target="_blank"
              rel="noreferrer"
              className="border-b border-transparent pb-1.5 font-mono text-xs text-[#585863] transition-colors hover:border-border hover:text-muted"
            >
              Kaynak kodu
            </a>
          </p>
        </div>

        <div className="lp-cue absolute bottom-9 left-1/2 z-[2] flex -translate-x-1/2 flex-col items-center gap-2.5 font-mono text-[0.6rem] tracking-[0.24em] text-[#585863]">
          <span>AKIŞ</span>
          <span className="bar" aria-hidden />
        </div>
      </section>

      {/* ── kaynak evreni (tam ekran ara sahne) ─────────────────────
           min-h-dvh: kaydırırken SADECE bu bölüm ekranda olsun diye
           hero'nun kuyruğu / feed'in başlığı aynı anda görünmesin.
           data-lp-host: Constellation'ın boyut ölçtüğü sabit kapsayıcı.
           .lp-approach sarmalayıcısı kaydırma miktarına göre JS'te
           ölçekleniyor (LandingMotion.tsx) ama bu ölçüm noktasını
           etkilemiyor (bkz. Constellation.tsx). */}
      <section data-lp-host className="relative min-h-dvh overflow-hidden border-t border-border">
        <div className="lp-approach absolute inset-0">
          <Constellation />
        </div>
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] mx-auto max-w-5xl px-6">
          <div data-lp-mark className={`lp-dateline relative pt-[2.6rem] ${gutter}`}>
            <span aria-hidden className="absolute left-[calc(var(--lp-gutter)-2.1rem)] top-[3.35rem] h-px w-[1.35rem] bg-border" />
            <h2 className="lp-reveal font-mono text-[0.7rem] tracking-[0.19em] text-[#585863]">KAYNAK EVRENİ</h2>
            <p className="lp-reveal mt-2.5 max-w-[26rem] font-read text-[0.9rem] font-light leading-[1.6] text-muted">
              Bunlar senin takip ettiklerin değil — herkesin seçebileceği geniş bir ağ.
              Akışını bu evrenden sen kurarsın.
            </p>
          </div>
        </div>
      </section>

      {/* ── tel (feed) + zaman omurgası ────────────────────────── */}
      <div className="relative mx-auto max-w-5xl px-6">
        {/* zaman teli */}
        <div id="lp-spine" aria-hidden className="absolute bottom-0 top-0 w-px bg-border left-[calc(1.5rem+var(--lp-gutter)-2.1rem)]">
          <div id="lp-spine-fill" className="lp-spine-fill absolute left-0 top-0 h-0 w-px" style={{ background: 'linear-gradient(to bottom, #2E2E3C, rgba(108,108,229,0.2))' }} />
        </div>

        {AKIS.map((grup) => (
          <div key={grup.tarih}>
            <div data-lp-mark className="lp-dateline relative pb-[0.9rem] pt-[2.6rem]">
              <div className={gutter}>
                <span aria-hidden className="absolute left-[calc(var(--lp-gutter)-2.1rem)] top-[3.35rem] h-px w-[1.35rem] bg-border" />
                <time dateTime={grup.tarih} className="font-mono text-[0.72rem] tracking-[0.19em] text-[#585863]">
                  {grup.gun} {grup.ay}
                </time>
                <span className="ml-3 font-mono text-[0.68rem] text-[#2E2E3C]">{grup.sayi} içerik</span>
              </div>
            </div>

            <ul className={gutter}>
              {grup.girdiler.map((g) => (
                <li key={g.baslik} className="lp-item lp-reveal relative border-b border-transparent py-[0.85rem] transition-colors hover:border-border">
                  <span aria-hidden className={`lp-dot absolute left-[-2.1rem] top-[1.42rem] h-[5px] w-[5px] -translate-x-0.5 rounded-full ${NOKTA[g.tur]}`} />
                  <div className="flex items-baseline justify-between gap-6">
                    <h3 className="font-read text-[1.02rem] font-normal leading-[1.42] tracking-[-0.005em]">{g.baslik}</h3>
                    <span className="lp-ago shrink-0 whitespace-nowrap font-mono text-[0.66rem] text-[#2E2E3C]">{g.onceki}</span>
                  </div>
                  <p className="mt-1.5 font-mono text-[0.68rem] tracking-[0.05em] text-[#585863]">{g.kaynak}</p>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {/* ── nasıl çalışır ──────────────────────────────────────── */}
        <section data-lp-mark className={`lp-dateline relative pt-[5.5rem] ${gutter}`}>
          <span aria-hidden className="absolute left-[calc(var(--lp-gutter)-2.1rem)] top-[6.05rem] h-px w-[1.35rem] bg-border" />
          <h2 className="font-mono text-[0.7rem] tracking-[0.19em] text-[#585863]">NASIL ÇALIŞIR</h2>
          <ol className="mt-[2.6rem] grid gap-[2.4rem] sm:grid-cols-3 sm:gap-[2.6rem]">
            {ADIMLAR.map((adim) => (
              <li key={adim.baslik} className="lp-reveal relative border-t border-border pt-[1.1rem]">
                <span className="absolute -top-[0.68rem] left-0 bg-background pr-2.5 font-mono text-[0.66rem] tracking-[0.12em] text-[#585863]">{adim.sira}</span>
                <h3 className="font-display text-[1.02rem] tracking-[-0.025em]" style={{ fontVariationSettings: "'wdth' 108, 'wght' 560" }}>{adim.baslik}</h3>
                <p className="mt-2.5 text-[0.925rem] font-light leading-[1.66] text-muted">{adim.metin}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ── kaynak türleri ─────────────────────────────────────── */}
        <section data-lp-mark className={`lp-dateline relative pt-[5.5rem] ${gutter}`}>
          <span aria-hidden className="absolute left-[calc(var(--lp-gutter)-2.1rem)] top-[6.05rem] h-px w-[1.35rem] bg-border" />
          <h2 className="font-mono text-[0.7rem] tracking-[0.19em] text-[#585863]">KAYNAK TÜRLERİ</h2>
          <dl className="mt-[2.6rem] grid gap-[1.9rem] sm:grid-cols-2 sm:gap-[2.4rem]">
            <div className="lp-reveal relative pl-[1.4rem]">
              <span aria-hidden className="absolute left-0 top-[0.62rem] h-1.5 w-1.5 rounded-full bg-source-youtube" />
              <dt className="font-display text-[0.95rem] tracking-[-0.02em]" style={{ fontVariationSettings: "'wdth' 106, 'wght' 540" }}>YouTube kanalları</dt>
              <dd className="mt-1.5 text-[0.9rem] font-light leading-[1.62] text-muted">Kanal adresini verirsin, yeni videolar kapak görselleriyle akışa düşer.</dd>
            </div>
            <div className="lp-reveal relative pl-[1.4rem]">
              <span aria-hidden className="absolute left-0 top-[0.62rem] h-1.5 w-1.5 rounded-full bg-source-blog" />
              <dt className="font-display text-[0.95rem] tracking-[-0.02em]" style={{ fontVariationSettings: "'wdth' 106, 'wght' 540" }}>Bloglar ve bültenler</dt>
              <dd className="mt-1.5 text-[0.9rem] font-light leading-[1.62] text-muted">RSS yayını olan her site çalışır; adresi verirsin, yayını ContentHub bulur.</dd>
            </div>
            <div className="lp-reveal relative pl-[1.4rem]">
              <span aria-hidden className="absolute left-0 top-[0.62rem] h-1.5 w-1.5 rounded-full bg-source-x opacity-35" />
              <dt className="font-display text-[0.95rem] tracking-[-0.02em] text-[#585863]" style={{ fontVariationSettings: "'wdth' 106, 'wght' 540" }}>
                X hesapları<span className="ml-2.5 align-[0.1em] font-mono text-[0.62rem] tracking-[0.1em] text-[#2E2E3C]">YAKINDA</span>
              </dt>
              <dd className="mt-1.5 text-[0.9rem] font-light leading-[1.62] text-[#585863]">Kaynak olarak eklenebiliyor, içerik çekme henüz çalışmıyor.</dd>
            </div>
            <div className="lp-reveal relative pl-[1.4rem]">
              <span aria-hidden className="absolute left-0 top-[0.62rem] h-1.5 w-1.5 rounded-full bg-source-academic opacity-35" />
              <dt className="font-display text-[0.95rem] tracking-[-0.02em] text-[#585863]" style={{ fontVariationSettings: "'wdth' 106, 'wght' 540" }}>
                Akademik yayınlar<span className="ml-2.5 align-[0.1em] font-mono text-[0.62rem] tracking-[0.1em] text-[#2E2E3C]">YAKINDA</span>
              </dt>
              <dd className="mt-1.5 text-[0.9rem] font-light leading-[1.62] text-[#585863]">Kaynak olarak eklenebiliyor, içerik çekme henüz çalışmıyor.</dd>
            </div>
          </dl>
        </section>

        {/* ── kapanış ────────────────────────────────────────────── */}
        <section className={`pt-[6.5rem] ${gutter}`}>
          <p className="lp-reveal max-w-[18ch] font-display text-[clamp(1.5rem,3.6vw,2.3rem)] leading-[1.16] tracking-[-0.04em]" style={{ fontVariationSettings: "'wdth' 114, 'wght' 480" }}>
            Akışını kim doldurduğunu bilmek, doldurulmuş bir akıştan iyidir.
          </p>
          <Link href="/feed" className="lp-go mt-9 inline-block border-b border-accent pb-1.5 font-mono text-[0.775rem] text-foreground">
            Akışını kur<span className="ml-1.5 text-accent">→</span>
          </Link>
        </section>

        {/* ── alt ────────────────────────────────────────────────── */}
        <footer className={`mt-[6.5rem] flex flex-wrap gap-x-8 gap-y-3 border-t border-border py-[1.9rem] font-mono text-[0.68rem] text-[#585863] ${gutter}`}>
          <span>ContentHub</span>
          <span>Next.js · Supabase · Claude</span>
          <a href="https://github.com/Tarikd-a11b/contenthub" target="_blank" rel="noreferrer" className="border-b border-transparent transition-colors hover:border-border hover:text-muted">
            github.com/Tarikd-a11b/contenthub
          </a>
        </footer>
      </div>
    </main>
  );
}
