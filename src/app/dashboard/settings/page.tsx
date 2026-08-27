'use client';

import { useState } from 'react';
import { Copy, LogOut, UserRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore, type NotificationPreferences } from '@/lib/hooks/use-auth-store';
import { useWalletBalance } from '@/lib/hooks/use-wallet-balance';

export default function SettingsPage() {
  const router = useRouter();
  const {
    address,
    user,
    displayName,
    notificationPreferences,
    logout,
    setDisplayName,
    setNotificationPreferences,
  } = useAuthStore();
  const [name, setName] = useState(displayName ?? '');
  const { balances, loading, error } = useWalletBalance(address);

  const handleDisconnect = () => {
    logout();
    router.push('/auth/login');
  };

  const updatePreference = (key: keyof NotificationPreferences) => {
    setNotificationPreferences({
      ...notificationPreferences,
      [key]: !notificationPreferences[key],
    });
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Profile & settings</h1>
        <p className="mt-0.5 text-sm text-gray-500">Manage your connected Stellar account.</p>
      </div>

      <section className="card p-5">
        <div className="flex items-center gap-3 border-b border-gray-100 pb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
            <UserRound className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Wallet profile</h2>
            <p className="text-xs text-gray-500">{user?.role ?? 'Connected account'}</p>
          </div>
        </div>

        <div className="space-y-4 pt-5">
          <div>
            <label htmlFor="display-name" className="label">Display name</label>
            <div className="flex items-center gap-2">
              <input
                id="display-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="How should we address you?"
                className="input"
              />
              <button type="button" onClick={() => setDisplayName(name)} className="btn-primary whitespace-nowrap">
                Save name
              </button>
            </div>
          </div>

          <div>
            <p className="label">Notification preferences</p>
            <div className="divide-y divide-gray-100 rounded-xl border border-gray-100">
              {([
                ['shipmentUpdates', 'Shipment updates', 'Status changes and shipment activity'],
                ['milestoneUpdates', 'Milestone updates', 'Proofs, confirmations, and disputes'],
                ['systemAlerts', 'System alerts', 'Important account and service messages'],
              ] as const).map(([key, title, description]) => (
                <label key={key} className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3">
                  <span>
                    <span className="block text-sm font-medium text-gray-800">{title}</span>
                    <span className="block text-xs text-gray-500">{description}</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={notificationPreferences[key]}
                    onChange={() => updatePreference(key)}
                    className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                  />
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="label">Stellar address</p>
            <div className="flex items-center gap-2">
              <p className="min-w-0 flex-1 truncate rounded-xl bg-gray-50 px-3.5 py-2.5 font-mono text-xs text-gray-600">
                {address ?? 'Not connected'}
              </p>
              {address && (
                <button
                  type="button"
                  title="Copy Stellar address"
                  aria-label="Copy Stellar address"
                  onClick={() => navigator.clipboard.writeText(address)}
                  className="btn-secondary px-3"
                >
                  <Copy className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div>
            <p className="label">Wallet balance</p>
            <div className="grid grid-cols-2 gap-3">
              {['USDC', 'XLM'].map((asset) => (
                <div key={asset} className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                  <p className="text-xs text-gray-500">{asset}</p>
                  <p className="mt-1 text-lg font-semibold text-gray-900">
                    {loading ? '...' : error ? '--' : Number(asset === 'USDC' ? balances?.usdc : balances?.xlm ?? 0).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
            {error && <p className="mt-2 text-xs text-red-600">Balance unavailable. Please try again shortly.</p>}
          </div>

          <button type="button" onClick={handleDisconnect} className="btn-secondary text-red-600 hover:bg-red-50">
            <LogOut className="h-4 w-4" />
            Disconnect wallet
          </button>
        </div>
      </section>
    </div>
  );
}