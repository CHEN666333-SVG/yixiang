import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Star, MoreHorizontal, ThumbsUp, MessageCircle, Share, CheckCircle2,
  TrendingUp, TrendingDown,
} from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';
import { knowpostService } from '@/services/knowpostService';
import { activityService } from '@/services/activityService';
import { hotService } from '@/services/hotService';
import { recommendService } from '@/services/recommendService';
import { topicService } from '@/services/topicService';
import { relationService } from '@/services/relationService';
import { stockService } from '@/services/stockService';
import { watchlistService } from '@/services/watchlistService';
import { useAuth } from '@/context/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';
import { formatCount, formatRelativeTime } from '@/lib/formatters';
import { toast } from 'sonner';
import type { FeedItem } from '@/types/knowpost';

const FEED_TABS = ['推荐', '关注', '最新'];

export default function HomePage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState('推荐');
  const [page, setPage] = useState(1);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['feed', activeTab, page],
    queryFn: () => {
      if (activeTab === '推荐') return knowpostService.feed(page, 10);
      if (activeTab === '最新') return hotService.posts('24h', undefined, 10);
      if (activeTab === '关注') return knowpostService.followingFeed(page, 10);
      return Promise.resolve({ items: [], page, size: 10, hasMore: false });
    },
    enabled: activeTab !== '关注' || isAuthenticated,
  });

  const posts = data?.items ?? [];

  return (
    <PageShell
      contentClassName="max-w-[620px]"
      rightRail={<HomeRightRail />}
    >
      <section className="flex-1">
        {/* Feed tabs */}
        <div className="bg-white rounded-t-2xl px-6 pt-4 border-b border-gray-100">
          <div className="flex gap-8">
            {FEED_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setPage(1); }}
                className={`pb-3 text-[16px] font-medium relative ${
                  activeTab === tab ? 'text-blue-600' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {tab}
                {activeTab === tab && (
                  <div className="absolute bottom-0 left-0 w-full h-[3px] bg-blue-600 rounded-t-full" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Post list */}
        {isLoading ? (
          <div className="bg-white p-6 space-y-4 rounded-b-2xl">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-3 pb-4 border-b border-gray-50">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-11 h-11 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="bg-white p-8 rounded-b-2xl">
            <EmptyState
              icon={Star}
              title="加载失败"
              description={error instanceof Error ? error.message : '请稍后重试'}
              action={<Button onClick={() => refetch()}>重试</Button>}
            />
          </div>
        ) : posts.length === 0 ? (
          <div className="bg-white p-8 rounded-b-2xl">
            <EmptyState
              icon={Star}
              title={activeTab === '关注' ? '暂无关注内容' : '暂无内容'}
              description={activeTab === '关注' ? '关注更多用户，即可看到他们发布的帖子' : '还没有人发布帖子，来写第一篇吧'}
              action={isAuthenticated ? <Button onClick={() => navigate(activeTab === '关注' ? '/search' : '/create')}>{activeTab === '关注' ? '发现用户' : '发布帖子'}</Button> : undefined}
            />
          </div>
        ) : (
          <div className="flex flex-col">
            {posts.map((post, i) => (
              <FeedCard
                key={post.id}
                post={post}
                isLast={i === posts.length - 1}
                onClick={() => navigate(`/posts/${post.id}`)}
                activeTab={activeTab}
                page={page}
              />
            ))}
            <div className="bg-white rounded-b-2xl border-t border-gray-50 px-6 py-4 flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                上一页
              </Button>
              <span className="text-sm text-gray-500">第 {page} 页</span>
              <Button
                variant="outline"
                size="sm"
                disabled={!data?.hasMore}
                onClick={() => setPage((p) => p + 1)}
              >
                下一页
              </Button>
            </div>
          </div>
        )}
      </section>
    </PageShell>
  );
}

function FeedCard({ post, isLast, onClick, activeTab, page }: { post: FeedItem; isLast: boolean; onClick: () => void; activeTab: string; page: number }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAuthenticated, user } = useAuth();

  const likeMut = useMutation({
    mutationFn: () => post.liked ? knowpostService.unlike(post.id) : knowpostService.like(post.id),
    onMutate: () => {
      qc.setQueryData<{ items: FeedItem[] }>(['feed', activeTab, page], (old) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.map((p) =>
            p.id === post.id ? { ...p, liked: !p.liked, likeCount: (p.likeCount ?? 0) + (p.liked ? -1 : 1) } : p
          ),
        };
      });
    },
    onError: () => qc.invalidateQueries({ queryKey: ['feed', activeTab, page] }),
  });

  const favMut = useMutation({
    mutationFn: () => post.faved ? knowpostService.unfav(post.id) : knowpostService.fav(post.id),
    onMutate: () => {
      qc.setQueryData<{ items: FeedItem[] }>(['feed', activeTab, page], (old) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.map((p) =>
            p.id === post.id ? { ...p, faved: !p.faved, favoriteCount: (p.favoriteCount ?? 0) + (p.faved ? -1 : 1) } : p
          ),
        };
      });
    },
    onError: () => qc.invalidateQueries({ queryKey: ['feed', activeTab, page] }),
  });

  const followMut = useMutation({
    mutationFn: () => {
      const authorId = Number(post.authorId);
      if (!Number.isFinite(authorId)) throw new Error('作者信息缺失');
      return post.isFollowingAuthor ? relationService.unfollow(authorId) : relationService.follow(authorId);
    },
    onMutate: () => {
      qc.setQueryData<{ items: FeedItem[] }>(['feed', activeTab, page], (old) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.map((p) =>
            p.authorId === post.authorId ? { ...p, isFollowingAuthor: !p.isFollowingAuthor } : p
          ),
        };
      });
    },
    onError: (err) => {
      qc.invalidateQueries({ queryKey: ['feed', activeTab, page] });
      toast.error(err instanceof Error ? err.message : '关注失败');
    },
  });

  const handleAction = (fn: () => void) => {
    if (!isAuthenticated) { toast.info('请先登录'); return; }
    fn();
  };

  return (
    <article className={`bg-white p-6 border-b border-gray-100 shadow-sm mb-4 rounded-2xl ${isLast ? 'rounded-b-2xl' : ''}`}>
      {/* Author */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3" onClick={(e) => { e.stopPropagation(); navigate(`/users/${post.authorId}`); }}>
          <img
            src={post.authorAvatar || `https://i.pravatar.cc/150?u=${post.authorId}`}
            className="w-11 h-11 rounded-full object-cover border border-gray-100"
          />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-gray-900">{post.authorNickname}</span>
              <CheckCircle2 size={16} className="fill-blue-500 text-white" />
            </div>
            <div className="text-xs text-gray-400 mt-0.5">
              {[
                post.publishTime ? formatRelativeTime(post.publishTime) : null,
                (() => { try { const a = JSON.parse(post.tagJson ?? '[]'); return Array.isArray(a) && a[0] ? a[0] : null; } catch { return null; } })(),
              ].filter(Boolean).join(' · ') || null}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!(user && post.authorId && String(user.id) === String(post.authorId)) && (
            <button
              className="border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 px-4 py-1.5 rounded-full text-xs font-medium transition-colors disabled:opacity-50"
              disabled={followMut.isPending}
              onClick={(e) => { e.stopPropagation(); handleAction(() => followMut.mutate()); }}
            >
              {post.isFollowingAuthor ? '已关注' : '关注'}
            </button>
          )}
          <button className="text-gray-400 hover:text-gray-600"><MoreHorizontal size={20} /></button>
        </div>
      </div>

      <div className="flex gap-4" onClick={onClick}>
        <div className="flex-1">
          <h2 className="text-[17px] font-bold text-gray-900 leading-snug mb-2 hover:text-blue-600 cursor-pointer transition-colors">
            {post.title}
          </h2>
          <p className="text-gray-600 text-[15px] leading-relaxed line-clamp-2 mb-3">
            {post.description}
          </p>
          <div className="flex flex-wrap gap-2">
            {post.tags?.map((tag) => (
              <span
                key={tag}
                className="bg-[#f0f5ff] text-blue-600 text-xs px-2.5 py-1 rounded-md cursor-pointer hover:bg-blue-100 transition-colors"
                onClick={(e) => { e.stopPropagation(); navigate(`/search?q=${encodeURIComponent(tag)}`); }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
        {post.coverImage && (
          <div className="shrink-0 w-[140px] h-[90px] rounded-xl overflow-hidden cursor-pointer mt-1">
            <img src={post.coverImage} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
          </div>
        )}
      </div>

      {/* Recent likers */}
      {post.recentLikers && post.recentLikers.length > 0 && (
        <div className="flex items-center gap-3 mt-5 mb-4">
          <div className="flex -space-x-2">
            {post.recentLikers.slice(0, 3).map((u, i) => (
              <img key={i} src={u.avatar || `https://i.pravatar.cc/150?u=${u.id}`} className="w-5 h-5 rounded-full border border-white" />
            ))}
          </div>
          <span className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
            {post.likerSummary ?? `${post.likeCount ?? 0} 人赞过`} &gt;
          </span>
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-50 px-2">
        <button
          onClick={(e) => { e.stopPropagation(); handleAction(() => likeMut.mutate()); }}
          className={`flex items-center gap-2 text-[15px] font-medium transition-colors ${post.liked ? 'text-blue-600' : 'text-gray-500 hover:text-gray-800'}`}
        >
          <ThumbsUp size={20} className={post.liked ? 'fill-blue-600 text-blue-600' : ''} />
          {formatCount(post.likeCount ?? 0)}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleAction(() => favMut.mutate()); }}
          className={`flex items-center gap-2 text-[15px] font-medium transition-colors ${post.faved ? 'text-yellow-500' : 'text-gray-500 hover:text-gray-800'}`}
        >
          <Star size={20} className={post.faved ? 'fill-yellow-500 text-yellow-500' : ''} />
          {formatCount(post.favoriteCount ?? 0)}
        </button>
        <button
          className="flex items-center gap-2 text-[15px] font-medium text-gray-500 hover:text-gray-800 transition-colors"
          onClick={(e) => { e.stopPropagation(); onClick(); }}
        >
          <MessageCircle size={20} />
          {formatCount(post.commentCount ?? 0)}
        </button>
        <button className="flex items-center gap-2 text-[15px] font-medium text-gray-500 hover:text-gray-800 transition-colors">
          <Share size={20} />
          分享
        </button>
      </div>
    </article>
  );
}

function HomeRightRail() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { data: activities } = useQuery({
    queryKey: ['activities', 'following'],
    queryFn: () => activityService.following(undefined, 5),
    enabled: isAuthenticated,
  });
  const { data: circles } = useQuery({
    queryKey: ['recommend', 'circles'],
    queryFn: () => recommendService.circles(3),
  });
  const { data: topics } = useQuery({
    queryKey: ['topics', 'hot'],
    queryFn: () => topicService.hot(5),
  });
  const { data: marketData = [] } = useQuery({
    queryKey: ['stock', 'market'],
    queryFn: () => stockService.market(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const { data: watchlist = [], refetch: refetchWatchlist } = useQuery({
    queryKey: ['watchlist'],
    queryFn: () => watchlistService.list(),
    enabled: isAuthenticated,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  return (
    <>
      {/* Market indices */}
      {marketData.length > 0 && (
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-blue-500" />
            <h3 className="font-bold text-[16px] text-gray-900">大盘行情</h3>
          </div>
          <div className="flex flex-col gap-3">
            {marketData.map((idx) => {
              const up = idx.change >= 0;
              return (
                <div key={idx.code} className="flex items-center justify-between">
                  <span className="text-[14px] text-gray-700">{idx.name}</span>
                  <div className="text-right">
                    <div className={`text-[14px] font-bold ${up ? 'text-red-500' : 'text-green-600'}`}>{idx.price.toFixed(2)}</div>
                    <div className={`text-[12px] flex items-center gap-0.5 justify-end ${up ? 'text-red-500' : 'text-green-600'}`}>
                      {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                      {up ? '+' : ''}{idx.changePercent.toFixed(2)}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* My Watchlist */}
      {isAuthenticated && (
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Star size={16} className="text-yellow-500" />
            <h3 className="font-bold text-[16px] text-gray-900">我的自选股</h3>
          </div>
          {watchlist.length === 0 ? (
            <p className="text-sm text-gray-400">暂无自选股，搜索股票后可添加</p>
          ) : (
            <div className="flex flex-col gap-3">
              {watchlist.map((item) => {
                const up = item.change >= 0;
                return (
                  <div key={item.code} className="flex items-center justify-between">
                    <div>
                      <div className="text-[14px] font-medium text-gray-800">{item.name}</div>
                      <div className="text-[11px] text-gray-400">{item.code}</div>
                    </div>
                    <div className="text-right">
                      <div className={`text-[14px] font-bold ${up ? 'text-red-500' : 'text-green-600'}`}>
                        {item.price > 0 ? item.price.toFixed(2) : '--'}
                      </div>
                      <div className={`text-[12px] flex items-center gap-0.5 justify-end ${up ? 'text-red-500' : 'text-green-600'}`}>
                        {item.price > 0 && <>{up ? <TrendingUp size={11} /> : <TrendingDown size={11} />} {up ? '+' : ''}{item.changePercent.toFixed(2)}%</>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Following activity */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <div className="flex justify-between items-center mb-5">
          <h3 className="font-bold text-[16px] text-gray-900">我的关注动态</h3>
          <button className="text-xs text-gray-400 hover:text-gray-600">查看全部 &gt;</button>
        </div>
        <div className="flex flex-col gap-5">
          {!isAuthenticated ? (
            <p className="text-sm text-gray-400">登录后查看关注动态</p>
          ) : (activities?.items?.length ?? 0) === 0 ? (
            <p className="text-sm text-gray-400">暂无关注动态</p>
          ) : activities!.items.map((activity) => {
            const ACTION_LABEL: Record<string, { text: string; color: string }> = {
              LIKE:     { text: '点赞了帖子', color: 'text-red-500' },
              FAVORITE: { text: '收藏了帖子', color: 'text-yellow-500' },
              POST:     { text: '发布了帖子', color: 'text-blue-600' },
              FOLLOW:   { text: '关注了用户', color: 'text-green-600' },
            };
            const action = ACTION_LABEL[activity.type] ?? { text: activity.type, color: 'text-gray-500' };
            const postTitle = activity.payload?.title as string | undefined;
            return (
              <div key={activity.id} className="flex items-start gap-3">
                <img src={activity.actor?.avatar || `https://i.pravatar.cc/150?u=${activity.actor?.id}`} className="w-9 h-9 rounded-full object-cover shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] leading-snug">
                    <span className="font-medium text-gray-900">{activity.actor?.nickname}</span>
                    <span className={`text-[13px] ml-1 ${action.color}`}>{action.text}</span>
                  </div>
                  {postTitle && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{postTitle}</p>
                  )}
                  <span className="text-xs text-gray-400">{formatRelativeTime(activity.createdAt)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* My circles */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <div className="flex justify-between items-center mb-5">
          <h3 className="font-bold text-[16px] text-gray-900">我的圈子</h3>
          <button onClick={() => navigate('/circles')} className="text-xs text-gray-400 hover:text-gray-600">查看全部 &gt;</button>
        </div>
        <div className="flex flex-col gap-5">
          {(circles ?? []).length === 0 ? (
            <p className="text-sm text-gray-400">暂无推荐圈子</p>
          ) : circles!.map((circle) => (
            <div key={circle.id} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src={circle.avatarUrl || `https://i.pravatar.cc/150?u=circle-${circle.id}`} className="w-10 h-10 rounded-xl object-cover" />
                <div>
                  <div className="font-medium text-[14px] text-gray-900">{circle.name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{formatCount(circle.memberCount)}人加入</div>
                </div>
              </div>
              <button
                onClick={() => navigate(`/circles/${circle.id}`)}
                className="border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1 rounded-full text-xs font-medium transition-colors"
              >
                进入圈子
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Hot topics */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <div className="flex justify-between items-center mb-5">
          <h3 className="font-bold text-[16px] text-gray-900">热门话题</h3>
          <button className="text-xs text-gray-400 hover:text-gray-600">查看全部 &gt;</button>
        </div>
        <div className="flex flex-col gap-4">
          {(topics ?? []).length === 0 ? (
            <p className="text-sm text-gray-400">暂无热门话题</p>
          ) : topics!.map((topic, index) => (
            <div key={topic.tag} className="flex items-center justify-between group cursor-pointer" onClick={() => navigate(`/search?q=${encodeURIComponent(topic.tag)}`)}>
              <div className="flex items-center gap-3">
                <span className={`text-[15px] font-bold w-4 text-center ${index < 3 ? 'text-red-500' : 'text-gray-400'}`}>
                  {index + 1}
                </span>
                <span className="text-[14px] text-gray-800 group-hover:text-blue-600 transition-colors">
                  {topic.tag}
                </span>
              </div>
              <span className="text-xs text-gray-400">{formatCount(topic.viewCount)}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
