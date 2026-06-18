import { apiFetch } from '@/lib/apiClient';

export type WatchlistItem = {
  code: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  addedAt: number;
};

export const watchlistService = {
  list(): Promise<WatchlistItem[]> {
    return apiFetch<WatchlistItem[]>('/api/v1/watchlist');
  },

  add(code: string, name: string): Promise<{ ok: boolean }> {
    return apiFetch<{ ok: boolean }>('/api/v1/watchlist', {
      method: 'POST',
      body: JSON.stringify({ code, name }),
    });
  },

  remove(code: string): Promise<{ ok: boolean }> {
    return apiFetch<{ ok: boolean }>(`/api/v1/watchlist/${code}`, {
      method: 'DELETE',
    });
  },

  status(code: string): Promise<{ watching: boolean }> {
    return apiFetch<{ watching: boolean }>(`/api/v1/watchlist/${code}/status`);
  },
};
