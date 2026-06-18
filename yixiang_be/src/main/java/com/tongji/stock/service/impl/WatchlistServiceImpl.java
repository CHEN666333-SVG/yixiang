package com.tongji.stock.service.impl;

import com.tongji.stock.dto.StockQuoteDTO;
import com.tongji.stock.dto.WatchlistItem;
import com.tongji.stock.service.StockDataService;
import com.tongji.stock.service.WatchlistService;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ZSetOperations;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * 自选股服务实现。
 * 存储结构：
 *   watchlist:{userId}          → ZSet{member=code, score=addedTimestamp}（有序，方便按时间展示）
 *   watchlist:name:{userId}:{code} → String 股票名称
 *   watchlist:codes:{userId}    → Set{code}（供定时任务批量刷新行情使用）
 */
@Service
public class WatchlistServiceImpl implements WatchlistService {

    private static final int MAX_WATCHLIST_SIZE = 50;

    private final StringRedisTemplate redis;
    private final StockDataService stockDataService;

    public WatchlistServiceImpl(StringRedisTemplate redis, StockDataService stockDataService) {
        this.redis = redis;
        this.stockDataService = stockDataService;
    }

    @Override
    public boolean add(long userId, String code, String name) {
        String zsetKey = zsetKey(userId);
        Long size = redis.opsForZSet().size(zsetKey);
        if (size != null && size >= MAX_WATCHLIST_SIZE) {
            return false;
        }
        // 幂等：已存在则更新 score（时间戳），保持最新添加时间
        redis.opsForZSet().add(zsetKey, code, System.currentTimeMillis());
        redis.opsForValue().set(nameKey(userId, code), name);
        redis.opsForSet().add(codesKey(userId), code);
        return true;
    }

    @Override
    public void remove(long userId, String code) {
        redis.opsForZSet().remove(zsetKey(userId), code);
        redis.delete(nameKey(userId, code));
        redis.opsForSet().remove(codesKey(userId), code);
    }

    @Override
    public List<WatchlistItem> list(long userId) {
        // 按添加时间倒序（score 越大越新）
        Set<ZSetOperations.TypedTuple<String>> tuples =
                redis.opsForZSet().reverseRangeWithScores(zsetKey(userId), 0, -1);
        if (tuples == null || tuples.isEmpty()) return List.of();

        List<String> codes = new ArrayList<>();
        Map<String, Long> addedAt = new LinkedHashMap<>();
        for (ZSetOperations.TypedTuple<String> t : tuples) {
            codes.add(t.getValue());
            addedAt.put(t.getValue(), t.getScore() == null ? 0L : t.getScore().longValue());
        }

        // 批量拉取实时行情
        List<StockQuoteDTO> quotes = stockDataService.getQuotes(codes);
        Map<String, StockQuoteDTO> quoteMap = new HashMap<>();
        for (StockQuoteDTO q : quotes) {
            quoteMap.put(q.code(), q);
        }

        List<WatchlistItem> result = new ArrayList<>();
        for (String code : codes) {
            String name = redis.opsForValue().get(nameKey(userId, code));
            StockQuoteDTO q = quoteMap.get(code);
            result.add(new WatchlistItem(
                    code,
                    name != null ? name : code,
                    q != null ? q.price() : 0,
                    q != null ? q.change() : 0,
                    q != null ? q.changePercent() : 0,
                    addedAt.getOrDefault(code, 0L)
            ));
        }
        return result;
    }

    @Override
    public boolean isWatching(long userId, String code) {
        Double score = redis.opsForZSet().score(zsetKey(userId), code);
        return score != null;
    }

    private String zsetKey(long userId) {
        return "watchlist:" + userId;
    }

    private String nameKey(long userId, String code) {
        return "watchlist:name:" + userId + ":" + code;
    }

    private String codesKey(long userId) {
        return "watchlist:codes:" + userId;
    }
}
