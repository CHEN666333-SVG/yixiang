import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, ChevronDown, Bold, Italic, Underline, List, TextQuote, Code,
  Image as ImageIcon, PlaySquare, Globe, Lock, Save, ImagePlus, X,
  ShieldCheck, AlertCircle, Ban, MessageSquare, ThumbsUp,
  Lightbulb, CheckCircle2, FileEdit, Users, TrendingUp,
} from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { EmptyState } from '@/components/common/EmptyState';
import { draftService, uploadDraftMarkdownContent, type DraftItem } from '@/services/draftService';
import { knowpostService, uploadToPresigned } from '@/services/knowpostService';
import { stockService } from '@/services/stockService';
import { circleService } from '@/services/circleService';
import type { StockRef } from '@/types/knowpost';
import { formatRelativeTime } from '@/lib/formatters';

export default function CreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();
  const { isAuthenticated } = useAuth();
  const draftIdParam = searchParams.get('draftId');
  const editingDraftId = draftIdParam && /^\d+$/.test(draftIdParam) ? draftIdParam : null;
  const [postType, setPostType] = useState<'public' | 'circle'>('public');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [stocks, setStocks] = useState<StockRef[]>([]);
  const [stockInput, setStockInput] = useState('');
  const [stockAdding, setStockAdding] = useState(false);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);
  const [selectedCircleId, setSelectedCircleId] = useState<number | null>(null);
  const [showCirclePicker, setShowCirclePicker] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const { data: joinedCircles = [] } = useQuery({
    queryKey: ['circles', 'joined'],
    queryFn: () => circleService.joined(),
    enabled: isAuthenticated && postType === 'circle',
  });

  const { data: editingDraft } = useQuery({
    queryKey: ['drafts', editingDraftId],
    queryFn: () => draftService.get(editingDraftId!),
    enabled: isAuthenticated && editingDraftId != null,
  });

  useEffect(() => {
    if (!editingDraft) return;
    setTitle(editingDraft.title ?? '');
    setTags(editingDraft.tags ?? []);
    setPostType(editingDraft.circleId ? 'circle' : 'public');
    setVisibility(editingDraft.circleId ? 'private' : 'public');
    setCoverImageUrl(editingDraft.coverImage ?? null);
    setSelectedCircleId(editingDraft.circleId ?? null);

    let cancelled = false;
    if (editingDraft.contentUrl) {
      fetch(editingDraft.contentUrl)
        .then((resp) => (resp.ok ? resp.text() : ''))
        .then((text) => {
          if (!cancelled && text) setContent(text);
        })
        .catch(() => {
          if (!cancelled) toast.error('草稿正文加载失败');
        });
    } else {
      setContent('');
    }
    return () => { cancelled = true; };
  }, [editingDraft]);

  const saveCurrentDraft = async () => {
    const normalizedTitle = title.trim();
    const normalizedContent = content.trim();
    if (!normalizedTitle && !normalizedContent) throw new Error('请输入标题或正文后再保存');

    let draft: DraftItem;
    if (editingDraftId) {
      draft = await draftService.update(editingDraftId, {
        title: normalizedTitle || null,
        tags,
        circleId: postType === 'circle' ? selectedCircleId : null,
        coverImage: coverImageUrl,
      });
    } else {
      draft = await draftService.create({
        title: normalizedTitle || null,
        tags,
        circleId: postType === 'circle' ? selectedCircleId : null,
        coverImage: coverImageUrl,
      });
    }

    let contentUrl = draft.contentUrl;
    if (normalizedContent) {
      contentUrl = await uploadDraftMarkdownContent(draft.id, normalizedContent);
      draft = await draftService.update(draft.id, { contentUrl });
    }

    qc.invalidateQueries({ queryKey: ['drafts'] });
    if (!editingDraftId) navigate(`/create?draftId=${draft.id}`, { replace: true });
    return draft;
  };

  const saveMut = useMutation({
    mutationFn: saveCurrentDraft,
    onSuccess: () => toast.success('草稿已保存'),
    onError: (err) => toast.error(err instanceof Error ? err.message : '保存失败'),
  });

  const publishMut = useMutation({
    mutationFn: async () => {
      const normalizedTitle = title.trim();
      const normalizedContent = content.trim();
      if (normalizedTitle.length < 5) throw new Error('标题至少 5 个字');
      if (normalizedContent.length < 20) throw new Error('正文至少 20 个字');
      const draft = await saveCurrentDraft();
      const resp = await draftService.publish(draft.id);
      // 发布后同步关联个股（草稿无此字段，发布时一并提交）
      if (stocks.length > 0) {
        try {
          await knowpostService.update(String(resp.postId), { stockCodes: stocks.map((s) => s.code) });
        } catch {
          toast.error('关联股票保存失败，可稍后在帖子编辑');
        }
      }
      return resp.postId;
    },
    onSuccess: (postId) => {
      toast.success('发布成功');
      qc.invalidateQueries({ queryKey: ['drafts'] });
      navigate(`/posts/${postId}`);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : '发布失败');
    },
  });

  const handleCoverImageSelect = async (file: File) => {
    setCoverUploading(true);
    try {
      let draftId = editingDraftId;
      if (!draftId) {
        const normalizedTitle = title.trim();
        if (!normalizedTitle) { toast.info('请先输入标题再上传封面'); setCoverUploading(false); return; }
        const draft = await draftService.create({ title: normalizedTitle, tags, coverImage: null });
        draftId = draft.id;
        navigate(`/create?draftId=${draftId}`, { replace: true });
      }
      const ext = file.name.includes('.') ? '.' + file.name.split('.').pop()! : '.jpg';
      const presign = await knowpostService.presign({ scene: 'knowpost_image', postId: String(draftId), contentType: file.type, ext });
      await uploadToPresigned(presign.putUrl, presign.headers, file);
      const url = presign.putUrl.split('?')[0];
      setCoverImageUrl(url);
      await draftService.update(draftId, { coverImage: url });
      qc.invalidateQueries({ queryKey: ['drafts'] });
      toast.success('封面上传成功');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '封面上传失败');
    } finally {
      setCoverUploading(false);
    }
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const t = tagInput.trim().replace(/^#/, '');
      if (!tags.includes(t)) setTags([...tags, t]);
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => setTags(tags.filter((t) => t !== tag));

  const addStock = async () => {
    const code = stockInput.trim().toLowerCase();
    if (!code) return;
    if (stocks.length >= 10) { toast.info('最多关联 10 只股票'); return; }
    if (stocks.some((s) => s.code === code)) { setStockInput(''); return; }
    setStockAdding(true);
    try {
      const q = await stockService.quote(code);
      if (!q || !q.name) { toast.error('未找到该股票，请检查代码（如 sh600000）'); return; }
      setStocks([...stocks, { code: q.code, name: q.name }]);
      setStockInput('');
    } catch {
      toast.error('未找到该股票，请检查代码（如 sh600000）');
    } finally {
      setStockAdding(false);
    }
  };

  const removeStock = (code: string) => setStocks(stocks.filter((s) => s.code !== code));

  if (!isAuthenticated) {
    return (
      <PageShell contentClassName="max-w-[760px]">
        <div className="py-16">
          <EmptyState
            icon={Lock}
            title="请先登录"
            description="登录后即可发布帖子"
            action={<Button onClick={() => navigate('/login')}>去登录</Button>}
          />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      contentClassName="max-w-[760px]"
      rightRail={<CreatePageSidebar />}
    >
      <section className="flex-1 bg-white rounded-2xl shadow-sm flex flex-col mb-12">
        {/* Header */}
        <div className="h-[68px] flex items-center justify-center border-b border-gray-100 relative px-6">
          <button
            onClick={() => navigate(-1)}
            className="absolute left-6 flex items-center gap-1.5 text-gray-700 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft size={20} /> <span className="font-medium text-[15px]">返回</span>
          </button>
          <h2 className="text-[18px] font-bold text-gray-900">{editingDraftId ? '编辑草稿' : '发布帖子'}</h2>
        </div>

        {/* Form */}
        <div className="p-8 flex flex-col gap-8">
          {/* Post type */}
          <section>
            <h3 className="font-bold text-[15px] text-gray-900 mb-4">选择发布位置</h3>
            <div className="flex gap-4">
              {[
                { key: 'public', label: '公开帖子', desc: '所有人可见', Icon: Globe },
                { key: 'circle', label: '圈子帖子', desc: '仅圈内成员可见', Icon: Users as React.FC<{ size?: number }> },
              ].map((opt) => (
                <div
                  key={opt.key}
                  onClick={() => setPostType(opt.key as typeof postType)}
                  className={`flex-1 border-2 rounded-xl p-4 flex items-center gap-4 cursor-pointer transition-colors ${
                    postType === opt.key ? 'border-blue-500 bg-[#f4f8ff]' : 'border-gray-100 bg-gray-50 hover:border-gray-200'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center border-2 ${postType === opt.key ? 'border-blue-500' : 'border-gray-300'}`}>
                    {postType === opt.key && <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-[15px] text-gray-900">{opt.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{opt.desc}</div>
                  </div>
                  {opt.key === 'circle' && postType === 'circle' && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setShowCirclePicker(!showCirclePicker); }}
                        className="border border-gray-200 bg-white rounded-lg px-3 py-1.5 flex items-center gap-2 text-sm text-gray-600 hover:border-blue-400"
                      >
                        {selectedCircleId
                          ? (joinedCircles.find((c) => c.id === selectedCircleId)?.name ?? '选择圈子')
                          : '选择圈子'
                        }
                        <ChevronDown size={14} />
                      </button>
                      {showCirclePicker && (
                        <div className="absolute top-10 right-0 z-50 bg-white rounded-xl shadow-lg border border-gray-100 min-w-[200px] py-2">
                          {joinedCircles.length === 0 ? (
                            <div className="px-4 py-3 text-sm text-gray-400">暂无加入的圈子</div>
                          ) : joinedCircles.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => { setSelectedCircleId(c.id); setShowCirclePicker(false); }}
                              className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${selectedCircleId === c.id ? 'text-blue-600 font-medium' : 'text-gray-700'}`}
                            >
                              {c.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Title */}
          <section>
            <h3 className="font-bold text-[15px] text-gray-900 mb-4">
              输入标题 <span className="font-normal text-xs text-gray-400">(必填)</span>
            </h3>
            <div className="relative">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
                placeholder="请输入一个吸引人的标题 (5-100字)"
                className="w-full bg-gray-50/50 border border-gray-200 hover:border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none rounded-xl px-4 py-3.5 text-[15px] transition-all"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-400">{title.length}/100</span>
            </div>
          </section>

          {/* Content editor */}
          <section>
            <h3 className="font-bold text-[15px] text-gray-900 mb-4">
              正文内容 <span className="font-normal text-xs text-gray-400">(必填)</span>
            </h3>
            <div className="border border-gray-200 rounded-xl overflow-hidden focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
              {/* Toolbar */}
              <div className="bg-gray-50/80 border-b border-gray-200 px-4 py-2 flex items-center gap-4 text-gray-600">
                {[
                  { icon: Bold, tip: '粗体' }, { icon: Italic, tip: '斜体' }, { icon: Underline, tip: '下划线' },
                ].map((item) => (
                  <button key={item.tip} className="p-1.5 hover:bg-gray-200 rounded text-gray-700 transition-colors" title={item.tip}>
                    <item.icon size={18} />
                  </button>
                ))}
                <div className="w-[1px] h-4 bg-gray-300 mx-1" />
                {[List, TextQuote, Code].map((Icon, i) => (
                  <button key={i} className="p-1.5 hover:bg-gray-200 rounded text-gray-700 transition-colors">
                    <Icon size={18} />
                  </button>
                ))}
                <div className="w-[1px] h-4 bg-gray-300 mx-1" />
                <button className="p-1.5 hover:bg-gray-200 rounded text-gray-700 transition-colors"><ImageIcon size={18} /></button>
                <button className="p-1.5 hover:bg-gray-200 rounded text-gray-700 transition-colors"><PlaySquare size={18} /></button>
              </div>
              <div className="relative">
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="分享你的观点、分析、复盘、策略..."
                  className="w-full h-[220px] p-4 text-[15px] resize-none focus:outline-none"
                />
                <span className="absolute right-4 bottom-4 text-xs text-gray-400">{content.length}/10000</span>
              </div>
            </div>
          </section>

          {/* Tags */}
          <section>
            <h3 className="font-bold text-[15px] text-gray-900 mb-4">添加话题</h3>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="relative w-[280px]">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 bg-[#edf2ff] text-blue-600 p-0.5 rounded text-xs font-bold">#</div>
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleAddTag}
                  placeholder="搜索或选择话题"
                  className="w-full bg-gray-50/50 border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <span className="text-sm text-gray-400">按回车键确认，可添加多个</span>
              {tags.map((tag) => (
                <span key={tag} className="bg-[#f0f5ff] text-blue-600 text-sm px-3 py-1 rounded-full flex items-center gap-1 cursor-pointer" onClick={() => removeTag(tag)}>
                  #{tag} ×
                </span>
              ))}
            </div>
          </section>

          {/* 关联个股 */}
          <section>
            <h3 className="font-bold text-[15px] text-gray-900 mb-4">关联个股</h3>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="relative w-[280px]">
                <TrendingUp size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-500" />
                <input
                  type="text"
                  value={stockInput}
                  onChange={(e) => setStockInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addStock(); } }}
                  placeholder="输入股票代码，如 sh600000"
                  className="w-full bg-gray-50/50 border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-orange-400"
                />
              </div>
              <Button type="button" variant="outline" size="sm" disabled={stockAdding} onClick={addStock}>
                {stockAdding ? '校验中…' : '添加'}
              </Button>
              <span className="text-sm text-gray-400">最多 10 只，回车确认</span>
              {stocks.map((s) => (
                <span key={s.code} className="bg-orange-50 text-orange-600 text-sm px-3 py-1 rounded-full flex items-center gap-1 cursor-pointer" onClick={() => removeStock(s.code)}>
                  {s.name} ×
                </span>
              ))}
            </div>
          </section>

          {/* Visibility */}
          <section>
            <h3 className="font-bold text-[15px] text-gray-900 mb-4">可见范围</h3>
            <div className="flex gap-4">
              {[
                { key: 'public', label: '公开可见', desc: '所有人可见，适合分享公开观点', Icon: Globe },
                { key: 'private', label: '仅圈内可见', desc: '仅圈子成员可见，适合深度交流', Icon: Lock },
              ].map((opt) => (
                <div
                  key={opt.key}
                  onClick={() => setVisibility(opt.key as typeof visibility)}
                  className={`flex-1 border-2 rounded-xl p-4 flex items-center gap-4 cursor-pointer transition-colors ${
                    visibility === opt.key ? 'border-blue-500 bg-[#f4f8ff]' : 'border-gray-100 bg-white hover:border-gray-200'
                  }`}
                >
                  <div className={`p-2 rounded-full ${visibility === opt.key ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                    <opt.Icon size={20} />
                  </div>
                  <div>
                    <div className="font-bold text-[15px] text-gray-900">{opt.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{opt.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Cover image */}
          <section>
            <h3 className="font-bold text-[15px] text-gray-900 mb-4">添加封面</h3>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCoverImageSelect(f); e.target.value = ''; }}
            />
            {coverImageUrl ? (
              <div className="relative w-[320px] h-[180px] rounded-xl overflow-hidden border border-gray-200 group">
                <img src={coverImageUrl} className="w-full h-full object-cover" />
                <button
                  onClick={() => { setCoverImageUrl(null); }}
                  className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={14} />
                </button>
                <button
                  onClick={() => coverInputRef.current?.click()}
                  className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  更换
                </button>
              </div>
            ) : (
              <div
                className={`border-2 border-dashed border-gray-200 hover:border-blue-400 bg-gray-50 hover:bg-[#f8faff] rounded-xl p-6 flex items-center gap-4 cursor-pointer transition-colors w-[320px] ${coverUploading ? 'opacity-60 pointer-events-none' : ''}`}
                onClick={() => coverInputRef.current?.click()}
              >
                <div className="bg-white p-2.5 rounded-lg shadow-sm border border-gray-100 text-gray-400">
                  <ImagePlus size={24} />
                </div>
                <div>
                  <div className="font-medium text-gray-700 text-sm">{coverUploading ? '上传中...' : '上传图片'}</div>
                  <div className="text-xs text-gray-400 mt-1">建议尺寸 16:9，大小不超过 5MB</div>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Bottom actions */}
        <div className="border-t border-gray-100 p-6 flex items-center justify-between mt-4">
          <button
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending || publishMut.isPending}
            className="flex items-center gap-2 text-blue-600 font-medium text-[15px] hover:text-blue-700 transition-colors disabled:opacity-50"
          >
            <Save size={18} /> {saveMut.isPending ? '保存中...' : '保存草稿'}
          </button>
          <div className="flex gap-4">
            <button className="px-8 py-2.5 rounded-full border border-gray-300 text-gray-700 font-medium text-[15px] hover:bg-gray-50 transition-colors">
              预览
            </button>
            <button
              onClick={() => publishMut.mutate()}
              disabled={title.trim().length < 5 || content.trim().length < 20 || publishMut.isPending || saveMut.isPending}
              className="px-8 py-2.5 rounded-full bg-blue-600 text-white font-medium text-[15px] hover:bg-blue-700 transition-colors shadow-sm shadow-blue-200 disabled:opacity-50"
            >
              {publishMut.isPending ? '发布中...' : '发布'}
            </button>
          </div>
        </div>
      </section>
    </PageShell>
  );
}

function CreatePageSidebar() {
  const navigate = useNavigate();
  const { data: drafts = [] } = useQuery({
    queryKey: ['drafts'],
    queryFn: () => draftService.list(),
  });
  const recentDrafts = drafts.slice(0, 3);

  return (
    <>
      {/* Publish guidelines */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 mb-5">
          <ShieldCheck className="text-blue-500" size={20} />
          <h3 className="font-bold text-[16px] text-gray-900">发布须知</h3>
        </div>
        <ul className="flex flex-col gap-4">
          {[
            { icon: AlertCircle, text: '内容必须遵守相关法律法规，禁止发布违法违规信息' },
            { icon: Ban, text: '不得发布虚假信息、误导性内容或诱导投资建议' },
            { icon: MessageSquare, text: '禁止恶意攻击、谩骂、广告等不良内容' },
            { icon: ThumbsUp, text: '请理性讨论，尊重他人观点，共同营造良好社区氛围' },
          ].map((rule) => (
            <li key={rule.text} className="flex items-start gap-3">
              <rule.icon size={16} className="text-gray-400 mt-0.5 shrink-0" />
              <span className="text-[13px] text-gray-600 leading-relaxed">{rule.text}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Tips */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 mb-5">
          <Lightbulb className="text-green-500" size={20} />
          <h3 className="font-bold text-[16px] text-gray-900">发布小贴士</h3>
        </div>
        <ul className="flex flex-col gap-4">
          {[
            '标题简洁有力，吸引更多人阅读',
            '内容逻辑清晰，观点明确',
            '可适当添加图片、图表增强说服力',
            '选择合适的话题，增加曝光机会',
            '仅圈内内容建议更深度、有价值的分享',
          ].map((tip) => (
            <li key={tip} className="flex items-start gap-3">
              <CheckCircle2 size={16} className="text-green-500 mt-0.5 shrink-0" />
              <span className="text-[13px] text-gray-600">{tip}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Drafts */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <div className="flex justify-between items-center mb-5">
          <h3 className="font-bold text-[16px] text-gray-900">草稿箱 ({drafts.length})</h3>
          <button onClick={() => navigate('/drafts')} className="text-xs text-gray-400 hover:text-gray-600">全部草稿 &gt;</button>
        </div>
        {recentDrafts.length === 0 ? (
          <p className="text-[13px] text-gray-400">暂无草稿</p>
        ) : (
          <div className="flex flex-col gap-5">
            {recentDrafts.map((draft) => (
              <div key={draft.id} className="flex gap-3 group">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-blue-50 text-blue-600">
                  <FileEdit size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[14px] text-gray-900 truncate mb-1">{draft.title || '未命名草稿'}</div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-400">更新于 {formatRelativeTime(draft.updatedAt)}</span>
                    <button
                      onClick={() => navigate(`/create?draftId=${draft.id}`)}
                      className="text-[12px] text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      继续编辑
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
