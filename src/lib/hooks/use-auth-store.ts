/**
 * lib/hooks/use-auth-store.ts
 *
 * Global Zustand store for authentication state.
 * Manages the connected Stellar address, JWT token, and user profile.
 */

import { create } from 'zustand';
import type { User } from '@/types';

export interface NotificationPreferences {
  shipmentUpdates: boolean;
  milestoneUpdates: boolean;
  systemAlerts: boolean;
}

export const defaultNotificationPreferences: NotificationPreferences = {
  shipmentUpdates: true,
  milestoneUpdates: true,
  systemAlerts: true,
};

interface AuthState {
  address: string | null;
  token: string | null;
  user: User | null;
  displayName: string | null;
  notificationPreferences: NotificationPreferences;
  isConnected: boolean;

  // Actions
  setAuth: (address: string, token: string, user: User) => void;
  setAddress: (address: string) => void;
  setDisplayName: (displayName: string) => void;
  setNotificationPreferences: (preferences: NotificationPreferences) => void;
  logout: () => void;
  rehydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  address: null,
  token: null,
  user: null,
  displayName: null,
  notificationPreferences: defaultNotificationPreferences,
  isConnected: false,

  setAuth: (address, token, user) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('chainsetttle_token', token);
      localStorage.setItem('chainsetttle_address', address);
      document.cookie = `chainsetttle_token=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
    }
    const displayName = typeof window !== 'undefined'
      ? localStorage.getItem(`chainsetttle_display_name_${address}`)
      : null;
    const storedPreferences = typeof window !== 'undefined'
      ? localStorage.getItem(`chainsetttle_notification_preferences_${address}`)
      : null;
    set({
      address,
      token,
      user,
      displayName,
      notificationPreferences: storedPreferences
        ? { ...defaultNotificationPreferences, ...JSON.parse(storedPreferences) }
        : defaultNotificationPreferences,
      isConnected: true,
    });
  },

  setAddress: (address) => {
    set({ address, isConnected: true });
  },

  setDisplayName: (displayName) => {
    const value = displayName.trim() || null;
    const address = useAuthStore.getState().address;
    if (typeof window !== 'undefined' && address) {
      if (value) localStorage.setItem(`chainsetttle_display_name_${address}`, value);
      else localStorage.removeItem(`chainsetttle_display_name_${address}`);
    }
    set({ displayName: value });
  },

  setNotificationPreferences: (preferences) => {
    const address = useAuthStore.getState().address;
    if (typeof window !== 'undefined' && address) {
      localStorage.setItem(
        `chainsetttle_notification_preferences_${address}`,
        JSON.stringify(preferences),
      );
    }
    set({ notificationPreferences: preferences });
  },

  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('chainsetttle_token');
      localStorage.removeItem('chainsetttle_address');
      document.cookie = 'chainsetttle_token=; path=/; max-age=0';
    }
    set({
      address: null,
      token: null,
      user: null,
      displayName: null,
      notificationPreferences: defaultNotificationPreferences,
      isConnected: false,
    });
  },

  rehydrate: () => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('chainsetttle_token');
      const address = localStorage.getItem('chainsetttle_address');
      if (token && address) {
        const storedPreferences = localStorage.getItem(`chainsetttle_notification_preferences_${address}`);
        set({
          token,
          address,
          displayName: localStorage.getItem(`chainsetttle_display_name_${address}`),
          notificationPreferences: storedPreferences
            ? { ...defaultNotificationPreferences, ...JSON.parse(storedPreferences) }
            : defaultNotificationPreferences,
          isConnected: true,
        });
      }
    }
  },
}));
