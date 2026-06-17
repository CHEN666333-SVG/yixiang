package com.tongji.comment.service;

import com.tongji.comment.api.dto.CommentListResponse;
import com.tongji.comment.api.dto.CreateCommentRequest;

public interface CommentService {

    Long create(long userId, CreateCommentRequest request);

    boolean delete(long userId, long commentId);

    CommentListResponse listTopLevel(Long postId, String cursor, int size, Long currentUserId);

    CommentListResponse listReplies(Long parentId, String cursor, int size, Long currentUserId);

    boolean likeComment(long userId, long commentId);

    boolean unlikeComment(long userId, long commentId);
}
