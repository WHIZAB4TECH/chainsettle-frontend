'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Wallet, ShieldCheck, Zap, Globe } from 'lucide-react';
import { connectFreighter, isFreighterInstalled, signNonce } from '@/lib/stellar/freighter';
import { authApi } from '@/lib/api/services';
import { useAuthStore } from '@/lib/hooks/use-auth-store';
import { Networks } from '@stellar/stellar-sdk';

type Step = 'idle' | 'connecting' | 'signing' | 'verifying' | 'done';

function LoginPageContent() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get('callbackUrl') ?? '/dashboard/shipments';

  const setAuth = useAuthStore((s) => s.setAuth);
  const isConnected = useAuthStore((s) => s.isConnected);

  const [step, setStep] = useState<Step>('idle');
  const [error, setError] = useState<string | null>(null);
  const [hasFreighter, setHasFreighter] = useState<boolean | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isConnected) router.replace(callbackUrl);
  }, [isConnected, router, callbackUrl]);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  // Check for Freighter on mount
  useEffect(() => {
    isFreighterInstalled().then(setHasFreighter);
  }, []);

  const handleConnect = async () => {
    setError(null);
    try {
      setStep('connecting');
      const address = await connectFreighter();

      const nonce = await authApi.getNonce(address);

      setStep('signing');
      const networkPassphrase =
        process.env.NEXT_PUBLIC_STELLAR_NETWORK === 'mainnet'
          ? Networks.PUBLIC
          : Networks.TESTNET;

      const signedNonce = await signNonce(nonce, networkPassphrase);

      setStep('verifying');
      const { accessToken, user } = await authApi.login({
        stellarAddress: address,
        signedNonce,
        signature: signedNonce, // backend verifies the XDR
      });

      setAuth(address, accessToken, user);
      setStep('done');
      router.replace(callbackUrl);
    } catch (err: any) {
      setError(err?.message ?? 'Connection failed. Please try again.');
      setStep('idle');
    }
  };

  const stepLabel: Record<Step, string> = {
    idle:      'Connect Freighter Wallet',
    connecting:'Requesting wallet access…',
    signing:   'Sign the message in Freighter…',
    verifying: 'Verifying with server…',
    done:      'Redirecting…',
  };

  const isLoading = step !== 'idle';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-600 mb-4 shadow-lg">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">ChainSettle</h1>
          <p className="text-sm text-gray-500 mt-1">Supply chain escrow on Stellar</p>
        </div>

        {/* Main card */}
        <div className="card p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Sign in</h2>
          <p className="text-sm text-gray-500 mb-6">
            Connect your Freighter wallet to access your shipments.
            No password needed — your Stellar address is your identity.
          </p>

          {/* Freighter not installed */}
          {hasFreighter === false && (
            <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-100">
              <p className="text-sm text-amber-800 font-medium mb-2">
                Freighter wallet not found
              </p>
              <p className="text-xs text-amber-700 mb-3">
                Install the Freighter browser extension to connect your Stellar wallet.
              </p>
              <a
                href="https://freighter.app"
                target="_blank"
                rel="noreferrer"
                className="btn-primary text-xs px-3 py-1.5"
                aria-label="Install Freighter wallet (opens in new tab)"
              >
                Install Freighter →
              </a>
            </div>
          )}

          {/* Error */}
          {error && (
            <div ref={errorRef} tabIndex={-1} className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-100" role="alert" aria-live="assertive">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Connect button */}
          <button
            onClick={handleConnect}
            disabled={isLoading || hasFreighter === false}
            aria-describedby={isLoading ? 'login-status' : undefined}
            className="btn-primary w-full text-base py-3"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                <span id="login-status">{stepLabel[step]}</span>
              </>
            ) : (
              <>
                <Wallet className="w-4 h-4" aria-hidden="true" />
                {stepLabel.idle}
              </>
            )}
          </button>

          {/* Steps indicator */}
          {isLoading && (
            <div ref={statusRef} className="mt-4 space-y-2" role="status" aria-live="polite" aria-label="Login progress">
              {(['connecting', 'signing', 'verifying'] as Step[]).map((s, i) => {
                const stepOrder: Step[] = ['connecting', 'signing', 'verifying'];
                const currentIdx = stepOrder.indexOf(step);
                const thisIdx = stepOrder.indexOf(s);
                const isDone = thisIdx < currentIdx;
                const isCurrent = s === step;

                return (
                  <div key={s} className="flex items-center gap-2.5 text-xs">
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                        isDone
                          ? 'bg-green-500 text-white'
                          : isCurrent
                          ? 'bg-brand-600 text-white'
                          : 'bg-gray-100 text-gray-400'
                      }`}
                      aria-hidden="true"
                    >
                      {isDone ? '✓' : i + 1}
                    </div>
                    <span
                      className={isCurrent ? 'text-gray-900 font-medium' : 'text-gray-400'}
                    >
                      {stepLabel[s]}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Features */}
        <div className="mt-6 grid grid-cols-3 gap-3 text-center">
          {[
            { icon: Zap, label: 'Instant settlement', sub: '<5 seconds' },
            { icon: ShieldCheck, label: 'Non-custodial', sub: 'Your keys, your funds' },
            { icon: Globe, label: 'Cross-border', sub: 'Anywhere, any sector' },
          ].map(({ icon: Icon, label, sub }) => (
            <div key={label} className="card p-3">
              <Icon className="w-4 h-4 text-brand-600 mx-auto mb-1.5" aria-hidden="true" />
              <p className="text-xs font-medium text-gray-700">{label}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <LoginPageContent />
    </Suspense>
  );
}
