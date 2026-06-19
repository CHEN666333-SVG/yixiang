import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createChart, type IChartApi, type ISeriesApi } from 'lightweight-charts';
import { ArrowLeft, TrendingUp, TrendingDown, Star, MessageCircle, ThumbsUp } from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';
import { stockService } from '@/services/stockService';
import { watchlistService } from '@/services/watchlistService';
import { useAuth } from '@/context/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { formatCount } from '@/lib/formatters';
import { toast } from 'sonner';
import type { KlinePoint, StockSentiment } from '@/types/stock';
import type { FeedItem } from '@/types/knowpost';

/** K 线蜡烛图（红涨绿跌，A 股惯例）。 */
function KLineChart({ data }: { data: KlinePoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      height: 280,
      layout: { background: { color: 'transparent' }, textColor: '#6b7280' },
      grid: { vertLines: { color: '#f3f4f6' }, horzLines: { color: '#f3f4f6' } },
      rightPriceScale: { borderColor: '#e5e7eb' },
      timeScale: { borderColor: '#e5e7eb' },
      handleScroll: false,
      handleScale: false,
    });
    const series = chart.addCandlestickSeries({
      upColor: '#ef4444', downColor: '#16a34a', borderVisible: false,
      wickUpColor: '#ef4444', wickDownColor: '#16a34a',
    });
    chartRef.current = chart;
    seriesRef.current = series;

    const onResize = () => chart.applyOptions({ width: containerRef.current?.clientWidth });
    onResize();
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); chart.remove(); };
  }, []);

  useEffect(() => {
    if (!seriesRef.current) return;
    seriesRef.current.setData(
      data.map((p) => ({ time: p.date, open: p.open, high: p.high, low: p.low, close: p.close })),
    );
    chartRef.current?.timeScale().fitContent();
  }, [data]);

  return <div ref={containerRef} className="w-full" />;
}

/** 多空情绪条 + 投票。 */
function SentimentBar({ code }: { code: string }) {
  const { isAuthenticated } = useAuth();
  const qc = useQueryClient();
  const { data: s } = useQuery({
    queryKey: ['stock-sentiment', code],
    queryFn: () => stockService.getSentiment(code),
  });

  const voteMut = useMutation({
    mutationFn: (dir: 'bull' | 'bear') => stockService.vote(code, dir),
    onSuccess: (next) => {
      qc.setQueryData(['stock-sentiment', code], next);
      qc.invalidateQueries({ queryKey: ['stock-detail', code] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : '投票失败'),
  });

  const sent: StockSentiment = s ?? { bull: 0, bear: 0, total: 0, bullPercent: 50, myVote: null };
  const vote = (dir: 'bull' | 'bear') => {
    if (!isAuthenticated) { toast.info('登录后才能表态'); return; }
    voteMut.mutate(dir);
  };

  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="font-bold text-gray-900">社区情绪</span>
        <span className="text-xs text-gray-400">{formatCount(sent.total)} 人已表态</span>
      </div>
      <div className="flex h-2.5 rounded-full overflow-hidden mb-3 bg-gray-100">
        <div className="bg-red-500" style={{ width: `${sent.bullPercent}%` }} />
        <div className="bg-green-600" style={{ width: `${100 - sent.bullPercent}%` }} />
      </div>
      <div className="flex gap-3">
        <button
          onClick={() => vote('bull')}
          disabled={voteMut.isPending}
          className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors disabled:opacity-50 ${
            sent.myVote === 'bull' ? 'bg-red-50 border-red-300 text-red-600' : 'border-gray-200 text-gray-600 hover:border-red-200'
          }`}
        >
          看涨 {sent.bullPercent}%
        </button>
        <button
          onClick={() => vote('bear')}
          disabled={voteMut.isPending}
          className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors disabled:opacity-50 ${
            sent.myVote === 'bear' ? 'bg-green-50 border-green-300 text-green-700' : 'border-gray-200 text-gray-600 hover:border-green-200'
          }`}
        >
          看跌 {100 - sent.bullPercent}%
        </button>
      </div>
    </div>
  );
}

export default function StockDetailPage() {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const qc = useQueryClient();
  const [period, setPeriod] = useState<'daily' | 'weekly'>('daily');

  const { data: detail, isLoading } = useQuery({
    queryKey: ['stock-detail', code],
    queryFn: () => stockService.detail(code),
    enabled: !!code,
    refetchInterval: 30_000,
  });

  const { data: kline = [] } = useQuery({
    queryKey: ['stock-kline', code, period],
    queryFn: () => stockService.kline(code, period, 60),
    enabled: !!code,
  });

  const { data: postsPage } = useQuery({
    queryKey: ['stock-posts', code],
    queryFn: () => stockService.posts(code, undefined, 20),
    enabled: !!code,
  });

  const { data: watchStatus } = useQuery({
    queryKey: ['watchlist-status', code],
    queryFn: () => watchlistService.status(code),
    enabled: isAuthenticated && !!code,
  });

  const watchMut = useMutation({
    mutationFn: () =>
      watchStatus?.watching
        ? watchlistService.remove(code)
        : watchlistService.add(code, detail?.quote.name ?? code),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['watchlist-status', code] });
      qc.invalidateQueries({ queryKey: ['watchlist'] });
      toast.success(watchStatus?.watching ? '已移出自选' : '已加入自选');
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : '操作失败'),
  });

  if (!code) return <EmptyState title="无效的股票代码" />;

  const quote = detail?.quote;
  const up = (quote?.change ?? 0) >= 0;
  const posts: FeedItem[] = postsPage?.items ?? [];

  return (
    <PageShell>
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-gray-500 hover:text-gray-800 mb-4 text-sm">
        <ArrowLeft size={16} /> 返回
      </button>

      {/* 报价卡 */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm mb-4">
        {isLoading || !quote ? (
          <Skeleton className="h-20 w-full" />
        ) : (
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900">{quote.name}</h1>
                <span className="text-sm text-gray-400">{quote.code}</span>
              </div>
              <div className={`mt-2 flex items-baseline gap-3 ${up ? 'text-red-500' : 'text-green-600'}`}>
                <span className="text-3xl font-bold">{quote.price > 0 ? quote.price.toFixed(2) : '--'}</span>
                <span className="flex items-center gap-1 text-sm font-medium">
                  {up ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                  {up ? '+' : ''}{quote.change.toFixed(2)} ({up ? '+' : ''}{quote.changePercent.toFixed(2)}%)
                </span>
              </div>
              <div className="mt-2 text-xs text-gray-400">
                {formatCount(detail?.postCount ?? 0)} 篇相关讨论
              </div>
            </div>
            <button
              onClick={() => { if (!isAuthenticated) { toast.info('请先登录'); return; } watchMut.mutate(); }}
              disabled={watchMut.isPending}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border transition-colors disabled:opacity-50 ${
                watchStatus?.watching ? 'bg-yellow-50 border-yellow-300 text-yellow-600' : 'border-gray-200 text-gray-600 hover:border-yellow-300'
              }`}
            >
              <Star size={15} className={watchStatus?.watching ? 'fill-yellow-400 text-yellow-500' : ''} />
              {watchStatus?.watching ? '已自选' : '加自选'}
            </button>
          </div>
        )}
      </div>

      {/* K 线图 */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="font-bold text-gray-900">{period === 'daily' ? '日 K 线' : '周 K 线'}</span>
          <div className="flex gap-1 text-xs">
            {(['daily', 'weekly'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 rounded-full ${period === p ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
              >
                {p === 'daily' ? '日线' : '周线'}
              </button>
            ))}
          </div>
        </div>
        {kline.length === 0 ? <Skeleton className="h-[280px] w-full" /> : <KLineChart data={kline} />}
      </div>

      {/* 情绪 */}
      <div className="mb-4">
        <SentimentBar code={code} />
      </div>

      {/* 相关讨论 */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <h3 className="font-bold text-gray-900 mb-4">相关讨论</h3>
        {posts.length === 0 ? (
          <EmptyState title="还没有关于该股票的讨论" description="发帖时关联它，成为第一个讨论者" />
        ) : (
          <div className="divide-y divide-gray-50">
            {posts.map((p) => (
              <div
                key={p.id}
                onClick={() => navigate(`/posts/${p.id}`)}
                className="py-3 cursor-pointer hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors"
              >
                <div className="font-medium text-gray-900 text-[15px] line-clamp-1">{p.title}</div>
                <div className="text-gray-500 text-sm line-clamp-1 mt-0.5">{p.description}</div>
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                  <span>{p.authorNickname}</span>
                  <span className="flex items-center gap-1"><ThumbsUp size={12} /> {formatCount(p.likeCount ?? 0)}</span>
                  <span className="flex items-center gap-1"><MessageCircle size={12} /> {formatCount(p.commentCount ?? 0)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}
