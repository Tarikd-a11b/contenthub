'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        router.push('/onboarding');
        router.refresh();
      }
    });
    return () => subscription.unsubscribe();
  }, [supabase, router]);

  return (
    <div className="mx-auto mt-24 max-w-sm px-6 pb-24">
      {/* Açılış sayfasıyla aynı marka işareti — giriş ekranı kopuk bir ada gibi durmasın. */}
      <p className="mb-10 font-mono text-sm tracking-tight">
        ContentHub<span className="text-accent">.</span>
      </p>
      <h1 className="text-2xl font-medium tracking-tight">Giriş yap</h1>
      <p className="mb-8 mt-2 text-sm leading-relaxed text-muted">
        Akışın hesabına bağlı. Girdiğin anda takip ettiğin kaynaklar seni bekliyor olacak.
      </p>
      <Auth
        supabaseClient={supabase}
        appearance={{
          theme: ThemeSupa,
          variables: {
            default: {
              colors: {
                brand: '#6C6CE5',
                brandAccent: '#5A5AD1',
                brandButtonText: '#FFFFFF',
                defaultButtonBackground: '#111117',
                defaultButtonBackgroundHover: '#1A1A22',
                defaultButtonBorder: '#22222C',
                defaultButtonText: '#F0F0F5',
                dividerBackground: '#22222C',
                inputBackground: '#111117',
                inputBorder: '#22222C',
                inputBorderHover: '#6C6CE5',
                inputBorderFocus: '#6C6CE5',
                inputText: '#F0F0F5',
                inputLabelText: '#84848E',
                inputPlaceholder: '#84848E',
                messageText: '#84848E',
                messageTextDanger: '#F87171',
                anchorTextColor: '#84848E',
                anchorTextHoverColor: '#F0F0F5',
              },
              radii: {
                borderRadiusButton: '0.5rem',
                buttonBorderRadius: '0.5rem',
                inputBorderRadius: '0.5rem',
              },
            },
          },
        }}
        // Supabase Auth UI varsayılan olarak İngilizce metinlerle geliyor; başlık
        // Türkçe, formun tamamı İngilizceydi. Yalnızca kullandığımız iki görünüm
        // (giriş / kayıt) çevrildi — kullanılmayan görünümleri çevirmek ölü metin olurdu.
        localization={{
          variables: {
            sign_in: {
              email_label: 'E-posta adresin',
              password_label: 'Parolan',
              email_input_placeholder: 'ornek@eposta.com',
              password_input_placeholder: 'Parolan',
              button_label: 'Giriş yap',
              loading_button_label: 'Giriş yapılıyor…',
              social_provider_text: '{{provider}} ile devam et',
              link_text: 'Zaten hesabın var mı? Giriş yap',
            },
            sign_up: {
              email_label: 'E-posta adresin',
              password_label: 'Parola oluştur',
              email_input_placeholder: 'ornek@eposta.com',
              password_input_placeholder: 'Parolan',
              button_label: 'Hesap oluştur',
              loading_button_label: 'Hesap oluşturuluyor…',
              social_provider_text: '{{provider}} ile devam et',
              link_text: 'Hesabın yok mu? Oluştur',
              confirmation_text: 'Onay bağlantısı için e-postana bak',
            },
            forgotten_password: {
              email_label: 'E-posta adresin',
              email_input_placeholder: 'ornek@eposta.com',
              button_label: 'Sıfırlama bağlantısı gönder',
              loading_button_label: 'Gönderiliyor…',
              link_text: 'Parolanı mı unuttun?',
              confirmation_text: 'Sıfırlama bağlantısı için e-postana bak',
            },
          },
        }}
        redirectTo={typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined}
      />
    </div>
  );
}
