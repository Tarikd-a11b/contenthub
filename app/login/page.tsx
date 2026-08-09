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
    <div className="mx-auto mt-20 max-w-sm">
      <h1 className="mb-6 text-2xl font-semibold">ContentHub&apos;a giriş yap</h1>
      <Auth
        supabaseClient={supabase}
        appearance={{ theme: ThemeSupa }}
        redirectTo={typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined}
      />
    </div>
  );
}
