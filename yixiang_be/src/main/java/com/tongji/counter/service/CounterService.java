package com.tongji.counter.service;

import java.util.List;
import java.util.Map;

public interface CounterService {
    /**
     * 点赞：仅在之前未点赞时置位并 +1。
     * @return 是否发生状态变化（true 表示这次操作生效）
     */
    boolean like(String entityType, String entityId, long userId);

    /**
     * 取消点赞：仅在之前已点赞时清位并 -1。
     * @return 是否发生状态变化（true 表示这次操作生效）
     */
    boolean unlike(String entityType, String entityId, long userId);

    /**
     * 收藏：仅在之前未收藏时置位并 +1。
     */
    boolean fav(String entityType, String entityId, long userId);

    /**
     * 取消收藏：仅在之前已收藏时清位并 -1。
     */
    boolean unfav(String entityType, String entityId, long userId);

    /**
     * 获取指定指标的计数。
     */
    Map<String, Long> getCounts(String entityType, String entityId, List<String> metrics);

    Map<String, Map<String, Long>> getCountsBatch(String entityType, List<String> entityIds, List<String> metrics);

    /**
     * 判断是否点赞/收藏（位图）。
     */
    boolean isLiked(String entityType, String entityId, long userId);
    boolean isFaved(String entityType, String entityId, long userId);

    /**
     * 评论计数 +1。
     */
    void incrementComment(String entityType, String entityId);

    /**
     * 评论计数 -1。
     */
    void decrementComment(String entityType, String entityId);

    /**
     * 记录一次浏览（PV +1）。
     */
    void recordView(String entityType, String entityId);

    /**
     * 批量判断用户是否对多个实体点赞（管道 GETBIT，O(n) RTT=1）。
     * @return 与 entityIds 顺序对应的 boolean 列表
     */
    List<Boolean> isLikedBatch(String entityType, List<String> entityIds, long userId);
}
