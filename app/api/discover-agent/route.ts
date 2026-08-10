import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { extractCandidates } from '@/lib/sourceSearch';

const SYSTEM_PROMPT = `Kullanıcının belirttiği kişi ya da konu için dünya çapında tanınmış, alanında uzman kaynaklar bul (kişisel blog, YouTube kanalı, X hesabı, akademik kaynak). Hacker News, Reddit gibi genel haber/link toplama sitelerini önerme — doğrudan o kişinin/uzmanın kendi yayın kanalını bul.

Önce kullanıcıya normal, doğal bir cevap yaz (bulduklarını kısaca anlat). Cevabının en sonuna, bulduğun kaynakları şu formatta bir kod bloğunda ekle:

\`\`\`json
[{"type":"blog|youtube|x|academic","name":"...","url_or_handle":"...","platform":"..."}]
\`\`\`

Hiç kaynak bulamazsan kod bloğunu hiç ekleme, sadece açıkla.`;

type IncomingMessage = { role: 'user' | 'assistant'; content: string };

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

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages,
    }),
  });

  if (!response.ok) {
    return NextResponse.json({ error: 'Anthropic isteği başarısız oldu' }, { status: 502 });
  }

  const data = await response.json();
  const text = (data.content ?? [])
    .filter((block: { type: string }) => block.type === 'text')
    .map((block: { text: string }) => block.text)
    .join('\n');

  const { text: reply, candidates } = extractCandidates(text);
  return NextResponse.json({ reply, candidates });
}
