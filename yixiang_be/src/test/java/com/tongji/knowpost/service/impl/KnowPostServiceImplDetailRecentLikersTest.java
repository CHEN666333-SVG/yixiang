package com.tongji.knowpost.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.github.benmanes.caffeine.cache.Cache;
import com.tongji.cache.hotkey.HotKeyDetector;
import com.tongji.counter.recent.RecentLikersService;
import com.tongji.counter.service.CounterService;
import com.tongji.counter.service.UserCounterService;
import com.tongji.knowpost.api.dto.KnowPostDetailResponse;
import com.tongji.knowpost.id.SnowflakeIdGenerator;
import com.tongji.knowpost.mapper.KnowPostMapper;
import com.tongji.knowpost.model.KnowPostDetailRow;
import com.tongji.llm.rag.RagIndexService;
import com.tongji.relation.outbox.OutboxMapper;
import com.tongji.storage.config.OssProperties;
import com.tongji.user.api.dto.UserBrief;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class KnowPostServiceImplDetailRecentLikersTest {

    @Mock KnowPostMapper mapper;
    @Mock SnowflakeIdGenerator idGen;
    @Mock OssProperties ossProperties;
    @Mock CounterService counterService;
    @Mock UserCounterService userCounterService;
    @Mock StringRedisTemplate redis;
    @Mock Cache<String, KnowPostDetailResponse> knowPostDetailCache;
    @Mock HotKeyDetector hotKey;
    @Mock RagIndexService ragIndexService;
    @Mock OutboxMapper outboxMapper;
    @Mock RecentLikersService recentLikersService;
    @Mock com.tongji.stock.service.PostStockService postStockService;

    @Mock
    @SuppressWarnings("unchecked")
    ValueOperations<String, String> valueOperations;

    @Test
    void getDetail_populates_recentLikers_and_summary() {
        // --- Arrange ---

        long postId = 42L;
        long likeCount = 99L;

        // 1. Caffeine cache miss
        when(knowPostDetailCache.getIfPresent(anyString())).thenReturn(null);

        // 2. Redis cache miss (both initial check and double-check inside synchronized block)
        lenient().when(redis.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get(anyString())).thenReturn(null);

        // 3. DB row
        KnowPostDetailRow row = new KnowPostDetailRow();
        row.setId(postId);
        row.setCreatorId(1L);
        row.setTitle("Test Post");
        row.setDescription("desc");
        row.setContentUrl("https://example.com/content");
        row.setTags("[\"tag1\"]");
        row.setImgUrls("[\"https://img.png\"]");
        row.setAuthorAvatar("avatar.png");
        row.setAuthorNickname("Author");
        row.setAuthorTagJson("[]");
        row.setIsTop(false);
        row.setVisible("public");
        row.setType("image_text");
        row.setStatus("published");
        row.setPublishTime(Instant.now());
        when(mapper.findDetailById(eq(postId))).thenReturn(row);

        // 4. Counter service
        lenient().when(counterService.getCounts(eq("knowpost"), anyString(), any()))
                .thenReturn(Map.of("like", likeCount, "fav", 5L, "comment", 10L));

        // 5. RecentLikersService
        UserBrief liker = new UserBrief(100L, "Alice", "alice.png", true);
        List<UserBrief> recentLikers = List.of(liker);
        when(recentLikersService.top5(eq(postId))).thenReturn(recentLikers);
        String expectedSummary = "Alice 等 99 人觉得很赞";
        when(recentLikersService.summary(eq(recentLikers), eq(likeCount))).thenReturn(expectedSummary);

        // 6. HotKeyDetector
        lenient().when(hotKey.ttlForPublic(anyInt(), anyString())).thenReturn(60);

        // 7. Redis ops for expire checking (recordHotKeyAndExtendTtl)
        lenient().when(redis.getExpire(anyString())).thenReturn(100L);

        // Construct service with all mocked collaborators
        KnowPostServiceImpl service = new KnowPostServiceImpl(
                mapper,
                idGen,
                new ObjectMapper(),
                ossProperties,
                counterService,
                userCounterService,
                redis,
                knowPostDetailCache,
                hotKey,
                ragIndexService,
                outboxMapper,
                recentLikersService,
                postStockService
        );

        // --- Act ---
        KnowPostDetailResponse resp = service.getDetail(postId, null);

        // --- Assert ---
        assertThat(resp).isNotNull();
        assertThat(resp.recentLikers()).hasSize(1);
        assertThat(resp.recentLikers().get(0).nickname()).isEqualTo("Alice");
        assertThat(resp.likerSummary()).isEqualTo(expectedSummary);
        assertThat(resp.likeCount()).isEqualTo(likeCount);
        assertThat(resp.id()).isEqualTo(String.valueOf(postId));
    }
}
