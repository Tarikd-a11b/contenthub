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
    <div className="mx-auto mt-20 max-w-sm px-4">
      <h1 className="mb-6 text-2xl font-semibold">ContentHub&apos;a giriş yap</h1>
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
        redirectTo={typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined}
      />
    </div>
  );
}
