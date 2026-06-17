package com.tongji.comment.api.dto;

import java.time.Instant;

public record CommentDTO(
        Long id,
        Long postId,
        Long userId,
        String nickname,
        String avatar,
        String content,
        Long parentId,
        Long replyToUserId,
        String replyToNickname,
        Instant createdAt,
        int replyCount,
        long likeCount,
        boolean liked
) {}
