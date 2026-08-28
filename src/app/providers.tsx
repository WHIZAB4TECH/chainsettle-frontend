'use client';

import { useEffect } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { useAuthStore } from '@/lib/hooks/use-auth-store';
import messages from '@/i18n/messages/en.json';

export function Providers({ children }: { children: React.ReactNode }) {
  const rehydrate = useAuthStore((s) => s.rehydrate);

  // Rehydrate JWT from localStorage on app start
  useEffect(() => {
    rehydrate();
  }, [rehydrate]);

  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
