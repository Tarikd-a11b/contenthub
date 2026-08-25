import { ImageResponse } from 'next/og';

/* WhatsApp/LinkedIn/X'e link atıldığında görünen kart. Önceden hiç yoktu:
   bağlantı çıplak bir başlıkla görünüyordu.

   Kart açılış sayfasının imzasını tekrarlıyor — zaman omurgası ve kaynak
   renkleri — ki paylaşımdan gelen kişi sayfayı açtığında aynı şeyi görsün.
   Görsel çalışma anında üretiliyor, statik dosya yok. */

export const runtime = 'edge';
export const alt = 'ContentHub — takip ettiklerin, sırasıyla';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const SATIRLAR = [
  { renk: '#E5708A', genislik: 520 },
  { renk: '#E5708A', genislik: 430 },
  { renk: '#D9A64E', genislik: 470 },
];

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#08090C',
          padding: '72px 80px',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', color: '#84848E', fontSize: 26, letterSpacing: 2 }}>
          CONTENTHUB
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', color: '#F0F0F5', fontSize: 76, lineHeight: 1.1 }}>
            Takip ettiklerin ne yayımladıysa,
          </div>
          <div style={{ display: 'flex', color: '#6C6CE5', fontSize: 76, lineHeight: 1.1 }}>
            sırasıyla.
          </div>
        </div>

        {/* Zaman omurgası: dikey kural + kaynak rengi taşıyan satırlar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {SATIRLAR.map((s) => (
            <div key={s.genislik} style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
              <div style={{ display: 'flex', width: 14, height: 14, borderRadius: 7, background: s.renk }} />
              <div style={{ display: 'flex', width: s.genislik, height: 12, borderRadius: 6, background: '#22222C' }} />
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
