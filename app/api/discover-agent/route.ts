import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { extractCandidates } from '@/lib/sourceSearch';

export const maxDuration = 60;

// Sonnet 5 ölçüldü: aynı sorguda 28sn / ~$0.07, Haiku 4.5 ise 8sn / ~$0.02. Asistanın
// asıl derdi yavaşlıktı, o yüzden Haiku'da kalındı; kalite farkı prompt'la kapatıldı.
// Sonnet 5'e geçilirse WEB_SEARCH_TOOL 'web_search_20260209' yapılabilir (Haiku desteklemiyor).
const MODEL = 'claude-haiku-4-5';
const WEB_SEARCH_TOOL = { type: 'web_search_20250305', name: 'web_search', max_uses: 6 };

// Sunucu taraflı web_search döngüsü 10 turda durup pause_turn dönebiliyor; o noktada
// cevap yarım kalır. Kaç kez devam ettirmeye çalışacağımızın sınırı:
const MAX_CONTINUATIONS = 3;

const SYSTEM_PROMPT = `Sen ContentHub'ın Kaynak Asistanısın. Kullanıcının yazdığı kişi, kurum, kanal veya konu için TAKİP EDİLEBİLİR kaynaklar bulursun: kişisel blog, YouTube kanalı, X hesabı, akademik sayfa.

MUTLAK KURALLAR:

1. ASLA netleştirme sorusu sorma. "Hangisini kastettiniz?", "Biraz daha detay verir misiniz?" gibi cümleler kurma. Girdi belirsizse en olası yorumu kendin seç ve aramaya başla. Birden fazla makul yorum varsa hepsini kapsayan kaynakları getir ve hangisinin hangisi olduğunu tek cümleyle belirt. Kullanıcı tek kelime yazmış olsa bile bu geçerli.

2. Cevap vermeden ÖNCE mutlaka web_search kullan. Hafızandan kaynak yazma — her kaynağı aramayla doğrula. Uydurulmuş bir kanal adı veya handle, boş cevaptan daha kötüdür.

3. Kullanıcı bir KONU yazdıysa (ör. "kuantum bilgisayar", "Osmanlı tarihi") o konuyu ANLATMA. Bu bir ansiklopedi değil, kaynak bulucu. O konuda düzenli içerik üreten kişileri ve kanalları bul.

4. Her zaman Türkçe cevap ver.

5. Hacker News, Reddit, Medium, Wikipedia, haber siteleri gibi toplayıcı/ansiklopedi kaynakları önerme. Doğrudan kişinin veya kurumun kendi yayın kanalını bul. Alanında tanınmış, düzenli üreten kaynakları tercih et.

6. Kısa yaz: en fazla 3-4 cümle, sonra kod bloğu. Uzun açıklama yapma.

Cevabının en sonuna, bulduğun kaynakları şu formatta bir kod bloğunda ekle:

\`\`\`json
[{"type":"blog|youtube|x|academic","name":"...","url_or_handle":"...","platform":"..."}]
\`\`\`

url_or_handle biçimi: YouTube için @handle, X için @handle, blog için alan adı, akademik için tam URL.

Gerçekten hiçbir kaynak bulamadıysan kod bloğunu ekleme ve neyi aradığını tek cümleyle söyle.`;

type IncomingMessage = { role: 'user' | 'assistant'; content: string };

/** Kullanıcının ilgi alanları ve takipleri — "Omnibus" gibi belirsiz girdileri çözmenin asıl anahtarı. */
async function buildUserContext(supabase: ReturnType<typeof createClient>, userId: string): Promise<string | null> {
  const [interestsResult, followsResult] = await Promise.all([
    supabase.from('user_interests').select('interests(label)').eq('user_id', userId),
    supabase.from('follows').select('sources(name, type)').eq('user_id', userId).limit(40),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const interests = (interestsResult.data ?? []).map((row: any) => row.interests?.label).filter(Boolean);
  const follows = (followsResult.data ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((row: any) => (row.sources ? `${row.sources.name} (${row.sources.type})` : null))
    .filter(Boolean);

  if (interests.length === 0 && follows.length === 0) return null;

  const parts = ['Bu kullanıcı hakkında bildiklerin — belirsiz bir girdiyi yorumlarken bunu kullan:'];
  if (interests.length > 0) parts.push(`İlgi alanları: ${interests.join(', ')}.`);
  if (follows.length > 0) parts.push(`Hâlihazırda takip ettiği kaynaklar: ${follows.join(', ')}.`);
  parts.push(
    'Belirsiz bir girdi bu listedeki bir kişinin programı, kanalı veya projesi olabilir — böyle bir bağlantı var mı diye ÖNCE onu araştır ve varsa o yorumu seç.',
    'Bu listede birebir adı geçen bir kaynağı tekrar önerme. Listede olmayan hiçbir şey için "zaten takip ediyorsunuz" deme.'
  );
  return parts.join('\n');
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Giriş yapmalısın' }, { status: 401 });
  }

  const body = await req.json();
  const messages: IncomingMessage[] = body?.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'messages gerekli' }, { status: 400 });
  }

  const userContext = await buildUserContext(supabase, user.id);
  const system = [
    { type: 'text', text: SYSTEM_PROMPT },
    ...(userContext ? [{ type: 'text', text: userContext }] : []),
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const turns: any[] = [...messages];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any = null;

  for (let attempt = 0; attempt <= MAX_CONTINUATIONS; attempt++) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        system,
        tools: [WEB_SEARCH_TOOL],
        messages: turns,
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Anthropic isteği başarısız oldu' }, { status: 502 });
    }

    data = await response.json();

    if (data.stop_reason === 'max_tokens') {
      return NextResponse.json({ error: 'Cevap çok uzun sürdü, tekrar dener misin?' }, { status: 502 });
    }

    // pause_turn: sunucu taraflı arama döngüsü tur sınırına çarptı. Asistan turunu geri
    // gönderince sunucu kaldığı yerden devam ediyor — ek bir kullanıcı mesajı EKLENMEMELİ.
    if (data.stop_reason === 'pause_turn') {
      turns.push({ role: 'assistant', content: data.content });
      continue;
    }

    break;
  }

  const text = (data.content ?? [])
    .filter((block: { type: string }) => block.type === 'text')
    .map((block: { text: string }) => block.text)
    .join('\n');

  const { text: reply, candidates } = extractCandidates(text);
  return NextResponse.json({ reply, candidates });
}
