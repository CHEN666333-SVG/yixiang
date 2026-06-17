package com.tongji.hot.service.impl;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.tongji.counter.service.CounterService;
import com.tongji.hot.api.dto.HotPostListResponse;
import com.tongji.hot.api.dto.HotPostResponse;
import com.tongji.hot.service.HotPeriod;
import com.tongji.hot.service.HotService;
import com.tongji.knowpost.mapper.KnowPostMapper;
import com.tongji.knowpost.model.KnowPost;
import com.tongji.user.api.dto.UserBrief;
import com.tongji.user.domain.User;
import com.tongji.user.mapper.UserMapper;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class HotServiceImpl implements HotService {

    private static final int MAX_SIZE = 50;
    private static final int CANDIDATE_POOL = 200;
    private static final List<String> METRICS = List.of("like", "comment", "fav");

    private final KnowPostMapper postMapper;
    private final UserMapper userMapper;
    private final CounterService counterService;
    private final ObjectMapper objectMapper;

    private final Cache<String, HotPostListResponse> cache = Caffeine.newBuilder()
            .expireAfterWrite(Duration.ofSeconds(60))
            .maximumSize(300)
            .build();

    public HotServiceImpl(KnowPostMapper postMapper,
                          UserMapper userMapper,
                          CounterService counterService,
                          ObjectMapper objectMapper) {
        this.postMapper = postMapper;
        this.userMapper = userMapper;
        this.counterService = counterService;
        this.objectMapper = objectMapper;
    }

    @Override
    public HotPostListResponse listHotPosts(HotPeriod period, String cursor, int size) {
        int effective = Math.min(Math.max(size, 1), MAX_SIZE);
        String cacheKey = period.code() + "|" + (cursor == null ? "" : cursor) + "|" + effective;
        return cache.get(cacheKey, k -> compute(period, cursor, effective));
    }

    private HotPostListResponse compute(HotPeriod period, String cursor, int size) {
        Instant since = Instant.now().minus(period.window());
        int offset = decodeCursor(cursor);

        List<KnowPost> candidates = postMapper.listPublishedSince(since, CANDIDATE_POOL);
        if (candidates.isEmpty()) {
            return new HotPostListResponse(List.of(), null);
        }

        List<String> postIds = candidates.stream()
                .map(p -> String.valueOf(p.getId()))
                .toList();

        Map<String, Map<String, Long>> countsBatch = counterService.getCountsBatch("knowpost", postIds, METRICS);

        Instant now = Instant.now();
        List<KnowPost> sorted = candidates.stream()
                .sorted((a, b) -> {
                    double sa = hotScore(a, countsBatch, now);
                    double sb = hotScore(b, countsBatch, now);
                    return Double.compare(sb, sa);
                })
                .toList();

        int from = Math.min(offset, sorted.size());
        int to = Math.min(from + size, sorted.size());
        List<KnowPost> page = sorted.subList(from, to);

        Set<Long> authorIds = page.stream().map(KnowPost::getCreatorId).collect(Collectors.toSet());
        Map<Long, UserBrief> authors = userMapper.listSummariesByIds(authorIds).stream()
                .collect(Collectors.toMap(User::getId, UserBrief::from));

        List<HotPostResponse> items = page.stream().map(p -> {
            Map<String, Long> c = countsBatch.getOrDefault(String.valueOf(p.getId()), Map.of());
            return new HotPostResponse(
                    p.getId(),
                    p.getTitle(),
                    p.getDescription(),
                    firstImage(p.getImgUrls()),
                    parseTags(p.getTags()),
                    authors.get(p.getCreatorId()),
                    c.getOrDefault("like", 0L),
                    c.getOrDefault("comment", 0L),
                    c.getOrDefault("fav", 0L),
                    p.getCreateTime()
            );
        }).toList();

        String nextCursor = to < sorted.size() ? encodeCursor(to) : null;
        return new HotPostListResponse(items, nextCursor);
    }

    private String firstImage(String imgUrlsJson) {
        if (imgUrlsJson == null || imgUrlsJson.isBlank()) return null;
        try {
            List<String> imgs = objectMapper.readValue(imgUrlsJson, new TypeReference<>() {});
            return imgs.isEmpty() ? null : imgs.get(0);
        } catch (Exception e) {
            return null;
        }
    }

    private List<String> parseTags(String tagsJson) {
        if (tagsJson == null || tagsJson.isBlank()) return List.of();
        try {
            return objectMapper.readValue(tagsJson, new TypeReference<>() {});
        } catch (Exception e) {
            return List.of();
        }
    }

    /**
     * 时间衰减热度评分（改版 Hacker News 算法）。
     * score = (likes*3 + comments*5 + favs*2 + 1) / (ageHours + 2)^1.5
     * - 评论权重 > 点赞权重（愿意回复 = 内容更有价值）
     * - +1 保证零互动新帖也有基础排名，避免被埋没
     * - 指数 1.5（比 HN 的 1.8 更平缓，让内容社区老帖不消失太快）
     */
    private double hotScore(KnowPost post, Map<String, Map<String, Long>> countsBatch, Instant now) {
        Map<String, Long> c = countsBatch.getOrDefault(String.valueOf(post.getId()), Map.of());
        long likes = c.getOrDefault("like", 0L);
        long comments = c.getOrDefault("comment", 0L);
        long favs = c.getOrDefault("fav", 0L);

        double engagement = likes * 3 + comments * 5 + favs * 2 + 1;
        long ageSeconds = now.getEpochSecond() - post.getCreateTime().getEpochSecond();
        double ageHours = Math.max(ageSeconds / 3600.0, 0);
        return engagement / Math.pow(ageHours + 2, 1.5);
    }

    private int decodeCursor(String cursor) {
        if (cursor == null || cursor.isBlank()) return 0;
        try { return Math.max(0, Integer.parseInt(cursor)); }
        catch (NumberFormatException e) { return 0; }
    }

    private String encodeCursor(int offset) {
        return String.valueOf(offset);
    }
}
