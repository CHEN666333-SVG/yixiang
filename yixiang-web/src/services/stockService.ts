import { apiFetch } from '@/lib/apiClient';
import type { MarketIndex, KlinePoint } from '@/types/stock';

export const stockService = {
  market(): Promise<MarketIndex[]> {
    return apiFetch<MarketIndex[]>('/api/v1/stock/market');
  },

  kline(code: string, period: 'daily' | 'weekly' = 'daily', count = 30): Promise<KlinePoint[]> {
    const params = new URLSearchParams({ code, period, count: String(count) });
    return apiFetch<KlinePoint[]>(`/api/v1/stock/kline?${params}`);
  },
};
