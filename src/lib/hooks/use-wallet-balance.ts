'use client';

import { useEffect, useState } from 'react';
import { getWalletBalances, type WalletBalances } from '@/lib/stellar/balance';

export function useWalletBalance(address: string | null) {
  const [balances, setBalances] = useState<WalletBalances | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setBalances(null);
      setError(null);
      return;
    }

    let active = true;
    const refresh = async () => {
      setLoading(true);
      setError(null);
      try {
        const nextBalances = await getWalletBalances(address);
        if (active) setBalances(nextBalances);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Unable to load wallet balance.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    const handleTransaction = () => refresh();
    window.addEventListener('chainsettle:transaction-complete', handleTransaction);
    refresh();

    return () => {
      active = false;
      window.removeEventListener('chainsettle:transaction-complete', handleTransaction);
    };
  }, [address]);

  return { balances, loading, error };
}