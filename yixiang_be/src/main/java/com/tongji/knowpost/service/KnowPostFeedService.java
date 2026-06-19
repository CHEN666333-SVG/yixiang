package com.tongji.knowpost.service;

import com.tongji.knowpost.api.dto.FeedPageResponse;

/**
 * 知文 Feed 业务接口。
 */
public interface KnowPostFeedService {
    FeedPageResponse getPublicFeed(int page, int size, Long currentUserIdNullable);

    FeedPageResponse getMyPublished(long userId, int page, int size);

    FeedPageResponse getUserPublished(long userId, int page, int size, Long viewerUserId);

    FeedPageResponse getLikedFeed(long ownerUserId, Long viewerUserId, int page, int size);

    FeedPageResponse getCirclePosts(long circleId, Boolean featured, String cursor, int size, Long viewerUserId);

    FeedPageResponse getStockPosts(String stockCode, String cursor, int size, Long viewerUserId);

    FeedPageResponse getFollowingFeed(long userId, int page, int size);
}
