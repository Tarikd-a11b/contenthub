import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Korumalı sayfalara giriş yapmadan gelen istekleri /login'e yönlendirir ve aynı
 * istekte Supabase oturumunu tazeler. Tazelemenin burada olması şart: Server
 * Component render'ı sırasında cookie yazılamıyor (bkz. lib/supabase/server.ts
 * içindeki try/catch), dolayısıyla token'ı yenileyebilecek tek yer burası.
 *
 * Sadece config.matcher'daki yollarda çalışır — /login ve /auth/callback bilerek
 * kapsam dışı bırakıldı ki PKCE kod değişimine karışmasın.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          // Oturum cookie'si yazan cevap CDN/Vercel Edge'de cache'lenmemeli:
          // aksi halde bir kullanıcının token'ı başkasına servis edilebilir.
          Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    }
  );

  // getSession() değil getUser(): ikincisi token'ı Supabase'e doğrulatır.
  // Guard kararını doğrulanmamış bir cookie'ye dayandırmak olmaz.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = '';
    const redirect = NextResponse.redirect(loginUrl);
    // Supabase geçersiz bir token'ı temizlemiş olabilir; o silme işlemi
    // yönlendirme cevabına taşınmazsa bozuk cookie tarayıcıda kalır.
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  return response;
}

export const config = {
  matcher: ['/feed/:path*', '/profile/:path*', '/discover/:path*', '/onboarding/:path*'],
};
