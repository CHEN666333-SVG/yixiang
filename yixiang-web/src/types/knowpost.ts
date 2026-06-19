export interface UserBrief {
  id: string;
  nickname: string;
  avatar: string;
  verified?: boolean;
  roleTitle?: string;
}

export type CreateDraftResponse = {
  id: string;
};

export type PresignRequest = {
  scene: "knowpost_content" | "knowpost_image";
  postId: string;
  contentType: string;
  ext: string; // with dot, e.g. ".md" 
};

export type PresignResponse = {
  objectKey: string;
  putUrl: string;
  headers: Record<string, string>;
  expiresIn: number;
};

export type ConfirmContentRequest = {
  objectKey: string;
  etag: string;
  size: number;
  sha256: string;
};

export type VisibleScope = "public" | "followers" | "school" | "private" | "unlisted";

export type UpdateKnowPostRequest = {
  title?: string;
  tagId?: number;
  tags?: string[];
  imgUrls?: string[];
  visible?: VisibleScope;
  isTop?: boolean;
  description?: string;
  circleId?: number | null;
  stockCodes?: string[];
};

// 帖子关联的股票引用
export type StockRef = {
  code: string;
  name?: string;
};

// Feed 列表数据结构
export type FeedItem = {
  id: string;
  title: string;
  description: string;
  coverImage?: string;
  tags: string[];
  tagJson?: string;
  authorAvatar?: string;
  authorNickname: string;
  authorId?: string;
  publishTime?: string;
  likeCount?: number;
  favoriteCount?: number;
  commentCount?: number;
  liked?: boolean;
  faved?: boolean;
  isTop?: boolean;
  visible?: VisibleScope;
  // 来自 P1 后端缺口补齐
  recentLikers?: UserBrief[];
  likerSummary?: string;
  isFollowingAuthor?: boolean;
};

export type FeedResponse = {
  items: FeedItem[];
  page: number;
  size: number;
  hasMore: boolean;
};

// 知文详情数据结构
export type KnowpostDetailResponse = {
  id: string;
  title: string;
  description: string;
  contentUrl: string;
  images: string[];
  tags: string[];
  authorAvatar?: string;
  authorNickname: string;
  authorId?: string;
  authorTagJson?: string;
  likeCount: number;
  favoriteCount: number;
  commentCount: number;
  viewCount?: number;
  liked?: boolean;
  faved?: boolean;
  isTop: boolean;
  visible: "public" | "followers" | "school" | "private" | "unlisted";
  type: "image_text" | string;
  publishTime?: string;
  recentLikers?: UserBrief[];
  likerSummary?: string;
  stocks?: StockRef[];
};

// 点赞/取消点赞 响应
export type LikeActionResponse = {
  changed: boolean;
  liked: boolean;
};

// 收藏/取消收藏 响应
export type FavActionResponse = {
  changed: boolean;
  faved: boolean;
};

// 计数查询响应
export type CounterResponse = {
  entityType: string;
  entityId: string;
  counts: {
    like: number;
    fav: number;
  };
};