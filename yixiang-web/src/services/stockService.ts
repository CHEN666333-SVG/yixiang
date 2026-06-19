import { apiFetch } from '@/lib/apiClient';
import type { MarketIndex, KlinePoint, StockDetail, HotStock, StockSentiment, StockQuote } from '@/types/stock';
import type { FeedItem } from '@/types/knowpost';

export type StockPostsPage = {
  items: FeedItem[];
  hasMore: boolean;
  nextCursor: string | null;
};

export const stockService = {
  market(): Promise<MarketIndex[]> {
    return apiFetch<MarketIndex[]>('/api/v1/stock/market');
  },

  quote(code: string): Promise<StockQuote> {
    return apiFetch<StockQuote>(`/api/v1/stock/quote?code=${encodeURIComponent(code)}`);
  },

  kline(code: string, period: 'daily' | 'weekly' = 'daily', count = 30): Promise<KlinePoint[]> {
    const params = new URLSearchParams({ code, period, count: String(count) });
    return apiFetch<KlinePoint[]>(`/api/v1/stock/kline?${params}`);
  },

  detail(code: string): Promise<StockDetail> {
    return apiFetch<StockDetail>(`/api/v1/stock/${encodeURIComponent(code)}/detail`);
  },

  posts(code: string, cursor?: string, size = 10): Promise<StockPostsPage> {
    const params = new URLSearchParams({ size: String(size) });
    if (cursor) params.set('cursor', cursor);
    return apiFetch<StockPostsPage>(`/api/v1/stock/${encodeURIComponent(code)}/posts?${params}`);
  },

  hot(limit = 10): Promise<HotStock[]> {
    return apiFetch<HotStock[]>(`/api/v1/stock/hot?limit=${limit}`);
  },

  getSentiment(code: string): Promise<StockSentiment> {
    return apiFetch<StockSentiment>(`/api/v1/stock/${encodeURIComponent(code)}/sentiment`);
  },

  vote(code: string, direction: 'bull' | 'bear'): Promise<StockSentiment> {
    return apiFetch<StockSentiment>(`/api/v1/stock/${encodeURIComponent(code)}/sentiment`, {
      method: 'POST',
      body: JSON.stringify({ direction }),
    });
  },
};
