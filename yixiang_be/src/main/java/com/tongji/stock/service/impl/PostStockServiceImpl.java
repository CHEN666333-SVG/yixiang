package com.tongji.stock.service.impl;

import com.tongji.knowpost.id.SnowflakeIdGenerator;
import com.tongji.stock.dto.HotStockDTO;
import com.tongji.stock.dto.StockQuoteDTO;
import com.tongji.stock.mapper.PostStockMapper;
import com.tongji.stock.service.PostStockService;
import com.tongji.stock.service.StockDataService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ZSetOperations;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class PostStockServiceImpl implements PostStockService {

    private static final Logger log = LoggerFactory.getLogger(PostStockServiceImpl.class);

    /** 单帖最多关联股票数。 */
    private static final int MAX_STOCKS = 10;
    /** 热议个股榜日榜 key 前缀。 */
    private static final String HOT_STOCKS_PREFIX = "hot_stocks:day:";
    private static final DateTimeFormatter DAY_FMT = DateTimeFormatter.ofPattern("yyyyMMdd");

    private final PostStockMapper mapper;
    private final SnowflakeIdGenerator idGen;
    private final StockDataService stockDataService;
    private final StringRedisTemplate redis;

    public PostStockServiceImpl(PostStockMapper mapper,
                                SnowflakeIdGenerator idGen,
                                StockDataService stockDataService,
                                StringRedisTemplate redis) {
        this.mapper = mapper;
        this.idGen = idGen;
        this.stockDataService = stockDataService;
        this.redis = redis;
    }

    @Override
    @Transactional
    public void sync(long postId, List<String> codes) {
        // 先清空旧关联
        mapper.deleteByPostId(postId);
        if (codes == null || codes.isEmpty()) {
            return;
        }

        // 去重 + 限额，保持顺序
        List<String> distinct = new ArrayList<>(new LinkedHashSet<>(codes));
        if (distinct.size() > MAX_STOCKS) {
            distinct = distinct.subList(0, MAX_STOCKS);
        }

        // 批量取股票名（失败不阻断主流程）
        Map<String, String> nameByCode = new HashMap<>();
        try {
            for (StockQuoteDTO q : stockDataService.getQuotes(distinct)) {
                if (q != null && q.code() != null) {
                    nameByCode.put(q.code(), q.name());
                }
            }
        } catch (Exception e) {
            log.warn("同步帖子关联股票时取报价失败 postId={} codes={}", postId, distinct, e);
        }

        List<Map<String, Object>> rows = new ArrayList<>(distinct.size());
        for (String code : distinct) {
            Map<String, Object> row = new HashMap<>();
            row.put("id", idGen.nextId());
            row.put("postId", postId);
            row.put("stockCode", code);
            row.put("stockName", nameByCode.get(code));
            rows.add(row);
        }
        mapper.batchInsert(rows);

        // 计入今日热议个股榜（Redis ZSet，2 天过期自然滚动）
        bumpHotStocks(distinct);
    }

    private void bumpHotStocks(List<String> codes) {
        try {
            String key = HOT_STOCKS_PREFIX + LocalDate.now().format(DAY_FMT);
            for (String code : codes) {
                redis.opsForZSet().incrementScore(key, code, 1);
            }
            redis.expire(key, Duration.ofDays(2));
        } catch (Exception e) {
            log.warn("更新热议个股榜失败 codes={}", codes, e);
        }
    }

    @Override
    public List<Map<String, Object>> listByPost(long postId) {
        return mapper.listByPostId(postId);
    }

    @Override
    public long countByStock(String code) {
        return mapper.countPostsByStock(code);
    }

    @Override
    public List<HotStockDTO> hotStocks(int limit) {
        int safeLimit = Math.min(Math.max(limit, 1), 50);
        String key = HOT_STOCKS_PREFIX + LocalDate.now().format(DAY_FMT);
        Set<ZSetOperations.TypedTuple<String>> top =
                redis.opsForZSet().reverseRangeWithScores(key, 0, safeLimit - 1);
        if (top == null || top.isEmpty()) {
            return List.of();
        }

        // 保序收集 code 与提及次数
        List<String> codes = new ArrayList<>(top.size());
        Map<String, Long> mentionByCode = new HashMap<>();
        for (ZSetOperations.TypedTuple<String> t : top) {
            String code = t.getValue();
            if (code == null) continue;
            codes.add(code);
            mentionByCode.put(code, t.getScore() == null ? 0L : t.getScore().longValue());
        }

        // 批量补实时报价（失败则用占位）
        Map<String, StockQuoteDTO> quoteByCode = new HashMap<>();
        try {
            for (StockQuoteDTO q : stockDataService.getQuotes(codes)) {
                if (q != null && q.code() != null) {
                    quoteByCode.put(q.code(), q);
                }
            }
        } catch (Exception e) {
            log.warn("热议个股榜补报价失败 codes={}", codes, e);
        }

        List<HotStockDTO> out = new ArrayList<>(codes.size());
        for (String code : codes) {
            StockQuoteDTO q = quoteByCode.get(code);
            out.add(new HotStockDTO(
                    code,
                    q != null ? q.name() : code,
                    q != null ? q.price() : 0,
                    q != null ? q.changePercent() : 0,
                    mentionByCode.getOrDefault(code, 0L)
            ));
        }
        return out;
    }
}
