export type CommentDTO = {
  id: number;
  postId: number;
  userId: number;
  nickname: string;
  avatar?: string;
  content: string;
  parentId?: number;
  replyToUserId?: number;
  replyToNickname?: string;
  createdAt: string;
  replyCount: number;
  likeCount?: number;
  liked?: boolean;
};

export type CommentListResponse = {
  items: CommentDTO[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type CreateCommentRequest = {
  postId: number;
  content: string;
  parentId?: number;
  replyToUserId?: number;
};
