import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArrowLeft, ThumbsUp, MessageCircle, Share2, MoreHorizontal,
  CheckCircle2, Star, Image as ImageIcon, ChevronDown, Eye,
} from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';
import { knowpostService } from '@/services/knowpostService';
import { commentService } from '@/services/commentService';
import { relationService } from '@/services/relationService';
import { topicService } from '@/services/topicService';
import { useFollow } from '@/features/relation/useFollow';
import { useUnfollow } from '@/features/relation/useUnfollow';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';
import { formatCount, formatRelativeTime } from '@/lib/formatters';
import { useAuth } from '@/context/AuthContext';
import { buildSseUrl } from '@/lib/sse';
import { toast } from 'sonner';
import type { KnowpostDetailResponse } from '@/types/knowpost';
import type { CommentDTO } from '@/types/comment';

export default function PostDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { isAuthenticated, tokens } = useAuth();
  const [commentText, setCommentText] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isAsking, setIsAsking] = useState(false);

  const { data: post, isLoading, error } = useQuery<KnowpostDetailResponse>({
    queryKey: ['knowpost', 'detail', id],
    queryFn: () => knowpostService.detail(id!, tokens?.accessToken),
    enabled: !!id,
  });

  // 记录浏览量 PV：组件挂载后调一次，忽略失败
  useEffect(() => {
    if (!id) return;
    fetch(`/api/v1/counter/knowpost/${id}/view`, { method: 'POST' }).catch(() => {});
  }, [id]);

  const { data: postContent } = useQuery({
    queryKey: ['knowpost', 'content', post?.contentUrl],
    queryFn: async () => {
      const resp = await fetch(post!.contentUrl);
      if (!resp.ok) throw new Error('正文加载失败');
      return resp.text();
    },
    enabled: !!post?.contentUrl,
  });

  const { data: commentsData } = useQuery({
    queryKey: ['comments', id],
    queryFn: () => commentService.list(id!, undefined, 20),
    enabled: !!id,
  });

  const likeMut = useMutation({
    mutationFn: () => post?.liked ? knowpostService.unlike(id!) : knowpostService.like(id!),
    onMutate: () => {
      qc.setQueryData<KnowpostDetailResponse>(['knowpost', 'detail', id], (old) =>
        old ? { ...old, liked: !old.liked, likeCount: old.likeCount + (old.liked ? -1 : 1) } : old
      );
    },
    onError: () => { qc.invalidateQueries({ queryKey: ['knowpost', 'detail', id] }); },
  });

  const favMut = useMutation({
    mutationFn: () => post?.faved ? knowpostService.unfav(id!) : knowpostService.fav(id!),
    onMutate: () => {
      qc.setQueryData<KnowpostDetailResponse>(['knowpost', 'detail', id], (old) =>
        old ? { ...old, faved: !old.faved, favoriteCount: old.favoriteCount + (old.faved ? -1 : 1) } : old
      );
    },
    onError: () => { qc.invalidateQueries({ queryKey: ['knowpost', 'detail', id] }); },
  });

  const submitComment = useMutation({
    mutationFn: () => commentService.create({ postId: Number(id), content: commentText }),
    onSuccess: () => {
      setCommentText('');
      qc.invalidateQueries({ queryKey: ['comments', id] });
      toast.success('评论成功');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : '评论失败'),
  });

  const comments = commentsData?.items ?? [];

  const authorIdNum = post?.authorId ? Number(post.authorId) : null;
  const { data: authorCounters } = useQuery({
    queryKey: ['relation', 'counters', authorIdNum],
    queryFn: () => relationService.counters(authorIdNum!),
    enabled: authorIdNum != null && Number.isFinite(authorIdNum) && authorIdNum > 0,
  });

  const askQuestion = () => {
    const q = question.trim();
    if (!q || !id) return;
    setAnswer('');
    setIsAsking(true);
    const url = buildSseUrl(
      `/api/v1/knowposts/${id}/qa/stream?question=${encodeURIComponent(q)}&topK=5&maxTokens=1024`,
      tokens?.accessToken ?? null,
    );
    const es = new EventSource(url);
    es.onmessage = (event) => setAnswer((prev) => prev + event.data);
    es.addEventListener('done', () => {
      setIsAsking(false);
      es.close();
    });
    es.onerror = () => {
      setIsAsking(false);
      es.close();
      toast.error('AI 问答连接失败');
    };
  };

  if (isLoading) {
    return (
      <PageShell contentClassName="max-w-[760px]">
        <div className="space-y-4 px-6 py-4">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </PageShell>
    );
  }

  if (error || !post) {
    return (
      <PageShell contentClassName="max-w-[760px]">
        <div className="px-6 py-4">
          <EmptyState
            icon={ImageIcon}
            title="帖子不存在"
            description={error instanceof Error ? error.message : '请检查链接'}
            action={<Button onClick={() => navigate('/')}>返回首页</Button>}
          />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      contentClassName="max-w-[760px]"
      rightRail={<PostRightRail post={post} />}
    >
      <div className="px-6 py-4">
        {/* Back button + title */}
        <div className="flex items-center relative mb-4">
          <button onClick={() => navigate(-1)} className="flex items-center text-gray-600 hover:text-black absolute left-0">
            <ArrowLeft size={18} className="mr-1" /> 返回
          </button>
          <h1 className="text-lg font-bold w-full text-center">帖子详情</h1>
        </div>

        {/* Post article */}
        <article className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          {/* Author */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <img
                src={post.authorAvatar || `https://i.pravatar.cc/150?u=${post.authorId}`}
                className="w-12 h-12 rounded-full"
              />
              <div>
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="font-bold text-base">{post.authorNickname}</span>
                  <CheckCircle2 size={16} className="text-blue-500 fill-blue-500" />
                  {post.authorId && <AuthorFollowInlineBadge authorId={post.authorId} />}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {[
                    (() => { try { const a = JSON.parse(post.authorTagJson ?? '[]'); return Array.isArray(a) && a[0] ? a[0] : null; } catch { return null; } })(),
                    post.publishTime ? formatRelativeTime(post.publishTime) : null,
                    authorCounters?.followers ? `粉丝 ${formatCount(authorCounters.followers)}` : null,
                  ].filter(Boolean).join(' · ')}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {post.authorId && <AuthorFollowButton authorId={post.authorId} size="sm" />}
              <button className="text-gray-400 hover:text-gray-600"><MoreHorizontal size={20} /></button>
            </div>
          </div>

          {/* Title */}
          <h2 className="text-xl font-bold mb-3">{post.title}</h2>

          {/* Content */}
          <div className="flex justify-between items-start gap-4 mb-4">
            <div className="prose prose-sm max-w-none text-gray-700 text-[15px] leading-relaxed">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {postContent ?? post.description}
              </ReactMarkdown>
            </div>
            {post.images?.[0] && (
              <img src={post.images[0]} className="w-40 h-24 object-cover rounded-lg border border-gray-100" />
            )}
          </div>

          {/* Tags */}
          {post.tags?.length > 0 && (
            <div className="flex gap-2 mb-6">
              {post.tags.map((tag) => (
                <span key={tag} className="text-blue-600 bg-blue-50 text-xs px-2 py-1 rounded cursor-pointer">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Recent likers */}
          {post.recentLikers && post.recentLikers.length > 0 && (
            <div className="flex items-center gap-3 mb-4">
              <div className="flex -space-x-2">
                {post.recentLikers.slice(0, 5).map((user, i) => (
                  <img key={i} src={user.avatar || `https://i.pravatar.cc/150?u=${user.id}`} className="w-5 h-5 rounded-full border border-white" />
                ))}
              </div>
              <span className="text-xs text-gray-500">{post.likerSummary ?? `${post.likeCount} 人赞过`}</span>
            </div>
          )}

          {/* Action bar */}
          <div className="flex items-center justify-between border-t border-gray-100 pt-4 text-gray-500 px-4">
            <button
              onClick={() => { if (!isAuthenticated) { toast.info('请先登录'); return; } likeMut.mutate(); }}
              className={`flex items-center gap-1.5 font-medium ${post.liked ? 'text-blue-600' : 'hover:text-blue-600'}`}
            >
              <ThumbsUp size={20} className={post.liked ? 'fill-current' : ''} /> {formatCount(post.likeCount)}
            </button>
            <button
              onClick={() => { if (!isAuthenticated) { toast.info('请先登录'); return; } favMut.mutate(); }}
              className={`flex items-center gap-1.5 font-medium ${post.faved ? 'text-yellow-500' : 'hover:text-yellow-500'}`}
            >
              <Star size={20} className={post.faved ? 'fill-current' : ''} /> {formatCount(post.favoriteCount)}
            </button>
            <button className="flex items-center gap-1.5 hover:text-gray-800">
              <MessageCircle size={20} /> {formatCount(post.commentCount)}
            </button>
            <span className="flex items-center gap-1.5 text-gray-400 text-sm">
              <Eye size={18} /> {formatCount(post.viewCount ?? 0)}
            </span>
            <button className="flex items-center gap-1.5 hover:text-gray-800">
              <Share2 size={20} /> 分享
            </button>
          </div>
        </article>

        <PinnedQA comments={comments} post={post} />

        <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <h3 className="font-bold text-gray-800 mb-4">AI 帖子问答</h3>
          <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg p-2">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') askQuestion();
              }}
              placeholder="输入你的问题..."
              className="flex-1 bg-transparent border-none focus:outline-none text-sm px-2"
            />
            <button
              onClick={askQuestion}
              disabled={!question.trim() || isAsking}
              className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {isAsking ? '生成中...' : '提问'}
            </button>
          </div>
          {answer && (
            <div className="mt-4 rounded-lg bg-blue-50 border border-blue-100 p-4 text-sm text-gray-700 whitespace-pre-wrap">
              {answer}
            </div>
          )}
        </section>

        {/* Comment section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-bold text-gray-800 mb-4">全部评论 {formatCount(post.commentCount)}</h3>

          {/* Comment input */}
          {isAuthenticated && (
            <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg p-2 mb-6">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && commentText.trim()) submitComment.mutate(); }}
                placeholder="写下你的评论..."
                className="flex-1 bg-transparent border-none focus:outline-none text-sm px-2"
              />
              <button className="text-gray-400 hover:text-gray-600 text-xl leading-none px-1">☺</button>
              <button className="text-gray-400 hover:text-gray-600"><ImageIcon size={20} /></button>
              <button
                onClick={() => { if (commentText.trim()) submitComment.mutate(); }}
                disabled={submitComment.isPending}
                className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {submitComment.isPending ? '...' : '发表评论'}
              </button>
            </div>
          )}

          {/* Comment list */}
          {comments.length === 0 ? (
            <div className="py-8 text-center text-gray-400 text-sm">
              暂无评论，来发表第一条评论吧
            </div>
          ) : (
            <div className="space-y-6">
              {comments.map((comment) => (
                <CommentRow key={comment.id} comment={comment} postId={id!} />
              ))}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}

function CommentRow({ comment, postId }: { comment: CommentDTO; postId: string }) {
  const { isAuthenticated } = useAuth();
  const qc = useQueryClient();

  const likeMut = useMutation({
    mutationFn: () => comment.liked ? commentService.unlike(comment.id) : commentService.like(comment.id),
    onMutate: () => {
      qc.setQueryData(['comments', postId], (old: { items: CommentDTO[]; nextCursor: string | null; hasMore: boolean } | undefined) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.map((c) =>
            c.id === comment.id
              ? { ...c, liked: !c.liked, likeCount: (c.likeCount ?? 0) + (c.liked ? -1 : 1) }
              : c
          ),
        };
      });
    },
    onError: () => qc.invalidateQueries({ queryKey: ['comments', postId] }),
  });

  return (
    <div className="flex gap-3">
      <img src={comment.avatar || `https://i.pravatar.cc/150?u=${comment.userId}`} className="w-10 h-10 rounded-full" />
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-bold text-gray-800">{comment.nickname || `用户${comment.userId}`}</span>
          <span className="text-xs text-gray-400">{comment.createdAt ? formatRelativeTime(comment.createdAt) : ''}</span>
        </div>
        <p className="text-[15px] text-gray-800 mb-2">{comment.content}</p>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <button
            onClick={() => {
              if (!isAuthenticated) { toast.info('请先登录'); return; }
              likeMut.mutate();
            }}
            className={`flex items-center gap-1 ${comment.liked ? 'text-blue-600' : 'hover:text-blue-600'}`}
          >
            <ThumbsUp size={14} className={comment.liked ? 'fill-current' : ''} />
            {comment.likeCount ? formatCount(comment.likeCount) : '赞'}
          </button>
          <button className="flex items-center gap-1 hover:text-gray-800"><MessageCircle size={14} /> 回复</button>
        </div>
      </div>
    </div>
  );
}

function AuthorFollowButton({ authorId, size = 'sm' }: { authorId: string; size?: 'sm' | 'md' }) {
  const { isAuthenticated } = useAuth();
  const uid = Number(authorId);
  const { data: status } = useQuery({
    queryKey: ['relation', 'status', uid],
    queryFn: () => relationService.status(uid),
    enabled: isAuthenticated && Number.isFinite(uid) && uid > 0,
  });
  const follow = useFollow(uid);
  const unfollow = useUnfollow(uid);

  if (!isAuthenticated || !Number.isFinite(uid) || uid <= 0) return null;

  const isFollowing = status?.following ?? false;
  const isPending = follow.isPending || unfollow.isPending;
  const handleClick = () => isFollowing ? unfollow.mutate() : follow.mutate();

  if (size === 'md') {
    return (
      <button
        onClick={handleClick}
        disabled={isPending}
        className={`w-full py-2 rounded-full text-sm font-medium transition-colors disabled:opacity-50 ${
          isFollowing
            ? 'border border-gray-300 text-gray-700 hover:bg-gray-50'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
      >
        {isPending ? '...' : isFollowing ? '已关注' : '+ 关注'}
      </button>
    );
  }
  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors disabled:opacity-50 ${
        isFollowing
          ? 'border border-gray-300 text-gray-700 hover:bg-gray-50'
          : 'border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100'
      }`}
    >
      {isPending ? '...' : isFollowing ? '已关注' : '关注'}
    </button>
  );
}

function PostRightRail({ post }: { post: KnowpostDetailResponse }) {
  const navigate = useNavigate();
  const authorId = post.authorId ? Number(post.authorId) : null;

  const { data: counters } = useQuery({
    queryKey: ['relation', 'counters', authorId],
    queryFn: () => relationService.counters(authorId!),
    enabled: authorId != null && authorId > 0,
  });

  const { data: topics } = useQuery({
    queryKey: ['topics', 'hot'],
    queryFn: () => topicService.hot(5),
  });

  const firstTag = post.tags?.[0];
  const { data: relatedData } = useQuery({
    queryKey: ['topic', 'posts', firstTag],
    queryFn: () => topicService.posts(firstTag!, undefined, 4),
    enabled: !!firstTag,
  });
  const relatedPosts = (relatedData?.items ?? []).filter((p) => p.id !== post.id).slice(0, 3);

  const authorRole = (() => {
    try { const a = JSON.parse(post.authorTagJson ?? '[]'); return Array.isArray(a) && a[0] ? a[0] as string : ''; }
    catch { return ''; }
  })();

  return (
    <>
      {/* Author info */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="font-bold text-gray-800 mb-4 text-sm border-b border-gray-100 pb-2">作者信息</h3>
        <div
          className="flex items-center gap-3 mb-4 cursor-pointer"
          onClick={() => navigate(`/users/${post.authorId}`)}
        >
          <img
            src={post.authorAvatar || `https://i.pravatar.cc/150?u=${post.authorId}`}
            className="w-14 h-14 rounded-full object-cover"
          />
          <div>
            <div className="flex items-center gap-1">
              <span className="font-bold text-base">{post.authorNickname}</span>
              <CheckCircle2 size={16} className="text-blue-500 fill-blue-500" />
            </div>
            {authorRole && <div className="text-xs text-gray-500 mt-0.5">{authorRole}</div>}
          </div>
        </div>
        <div className="flex justify-between text-center mb-4">
          <div>
            <div className="font-bold text-gray-800 text-lg">{formatCount(counters?.followings ?? 0)}</div>
            <div className="text-xs text-gray-500">关注</div>
          </div>
          <div className="w-px bg-gray-200" />
          <div>
            <div className="font-bold text-gray-800 text-lg">{formatCount(counters?.followers ?? 0)}</div>
            <div className="text-xs text-gray-500">粉丝</div>
          </div>
          <div className="w-px bg-gray-200" />
          <div>
            <div className="font-bold text-gray-800 text-lg">{formatCount(counters?.likedPosts ?? 0)}</div>
            <div className="text-xs text-gray-500">获赞</div>
          </div>
        </div>
        {post.authorId && <AuthorFollowButton authorId={post.authorId} size="md" />}
      </div>

      {/* Related posts */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="font-bold text-gray-800 mb-4 text-sm border-b border-gray-100 pb-2">相关推荐</h3>
        {relatedPosts.length === 0 ? (
          <p className="text-sm text-gray-400">暂无相关推荐</p>
        ) : (
          <div className="flex flex-col gap-4">
            {relatedPosts.map((item) => (
              <div
                key={item.id}
                className="flex gap-3 cursor-pointer group"
                onClick={() => navigate(`/posts/${item.id}`)}
              >
                {item.coverImage ? (
                  <img src={item.coverImage} className="w-16 h-16 rounded object-cover bg-gray-100 shrink-0" />
                ) : (
                  <div className="w-16 h-16 rounded bg-gray-100 shrink-0 flex items-center justify-center">
                    <ImageIcon size={20} className="text-gray-300" />
                  </div>
                )}
                <div className="flex-1 flex flex-col justify-between">
                  <h4 className="text-sm font-medium text-gray-800 group-hover:text-blue-600 line-clamp-2 leading-tight">
                    {item.title}
                  </h4>
                  <div className="text-xs text-gray-500 mt-1">
                    {item.authorNickname} · {formatCount(item.likeCount ?? 0)} 赞
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hot topics */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="font-bold text-gray-800 mb-4 text-sm border-b border-gray-100 pb-2">热门话题</h3>
        <div className="flex flex-col gap-3">
          {(topics ?? []).slice(0, 5).map((topic) => (
            <div
              key={topic.tag}
              className="flex justify-between items-center cursor-pointer hover:bg-gray-50 -mx-2 px-2 py-1 rounded"
              onClick={() => navigate(`/search?q=${encodeURIComponent(topic.tag)}`)}
            >
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <span className="text-blue-500 font-bold">#</span> {topic.tag}
              </div>
              <span className="text-xs text-gray-400">{formatCount(topic.viewCount)} 讨论</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function PinnedQA({ comments, post }: { comments: CommentDTO[]; post: KnowpostDetailResponse }) {
  const topComment = comments.find((c) => !c.parentId);

  const { data: repliesData } = useQuery({
    queryKey: ['comment', 'replies', topComment?.id],
    queryFn: () => commentService.replies(topComment!.id, undefined, 10),
    enabled: !!topComment?.id && topComment.replyCount > 0,
  });

  if (!topComment) return null;

  const authorReply = post.authorId
    ? (repliesData?.items ?? []).find((c) => String(c.userId) === post.authorId)
    : undefined;

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-6">
      <h3 className="font-bold text-gray-800 mb-4">置顶问答</h3>
      <div className="flex gap-3 relative">
        {authorReply && (
          <div className="absolute left-[19px] top-10 bottom-8 w-px bg-gray-300" />
        )}
        <div className="flex-1">
          {/* Question */}
          <div className="flex items-center gap-2 mb-1">
            <img
              src={topComment.avatar || `https://i.pravatar.cc/150?u=${topComment.userId}`}
              className="w-9 h-9 rounded-full z-10 bg-white"
            />
            <span className="text-sm font-medium text-gray-700">
              {topComment.nickname || `用户${topComment.userId}`}
            </span>
            <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
              提问
            </span>
            <span className="text-xs text-gray-400 ml-auto">
              {formatRelativeTime(topComment.createdAt)}
            </span>
          </div>
          <p className="text-[15px] text-gray-800 ml-11 mb-4 font-medium">{topComment.content}</p>

          {/* Author reply */}
          {authorReply && (
            <div className="flex items-start gap-2 mb-2">
              <img
                src={post.authorAvatar || `https://i.pravatar.cc/150?u=${post.authorId}`}
                className="w-9 h-9 rounded-full z-10 bg-white"
              />
              <div className="flex-1 mt-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-gray-700">{post.authorNickname}</span>
                  <span className="text-xs text-gray-500">(作者)</span>
                </div>
                <p className="text-sm text-gray-600 mb-2">{authorReply.content}</p>
              </div>
            </div>
          )}

          {topComment.replyCount > 0 && (
            <button className="text-blue-500 text-sm hover:underline flex items-center gap-0.5">
              展开更多回复 ({topComment.replyCount}条) <ChevronDown size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function AuthorFollowInlineBadge({ authorId }: { authorId: string }) {
  const { isAuthenticated } = useAuth();
  const uid = Number(authorId);
  const { data: status } = useQuery({
    queryKey: ['relation', 'status', uid],
    queryFn: () => relationService.status(uid),
    enabled: isAuthenticated && Number.isFinite(uid) && uid > 0,
  });
  if (!isAuthenticated || !status) return null;
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded ml-1 ${
      status.following ? 'bg-gray-100 text-gray-500' : 'bg-blue-50 text-blue-500'
    }`}>
      {status.following ? '已关注' : '关注'}
    </span>
  );
}
