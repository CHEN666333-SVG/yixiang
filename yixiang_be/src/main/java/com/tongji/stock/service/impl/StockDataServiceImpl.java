package com.tongji.stock.service.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tongji.stock.dto.KlinePoint;
import com.tongji.stock.dto.MarketIndexDTO;
import com.tongji.stock.dto.StockQuoteDTO;
import com.tongji.stock.service.StockDataService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.nio.charset.Charset;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
public class StockDataServiceImpl implements StockDataService {

    private static final String SINA_BRIEF_URL = "https://hq.sinajs.cn/list=";
    private static final String SINA_DETAIL_URL = "https://hq.sinajs.cn/list=";
    private static final Charset GBK = Charset.forName("GBK");

    private static final List<String[]> INDEX_CODES = List.of(
            new String[]{"s_sh000001", "上证指数"},
            new String[]{"s_sz399001", "深证成指"},
            new String[]{"s_sz399006", "创业板指"}
    );

    private static final String SINA_KLINE_URL =
            "https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData";
    private static final String KLINE_CACHE_PREFIX = "stock:kline:";

    private final RestClient restClient;
    private final StringRedisTemplate redis;
    private final ObjectMapper objectMapper;
    private final ConcurrentHashMap<String, StockQuoteDTO> quoteCache = new ConcurrentHashMap<>();
    private volatile long lastMarketFetch = 0;
    private volatile List<MarketIndexDTO> marketCache = List.of();

    public StockDataServiceImpl(StringRedisTemplate redis, ObjectMapper objectMapper) {
        this.redis = redis;
        this.objectMapper = objectMapper;
        this.restClient = RestClient.builder().build();
    }

    @Override
    public List<MarketIndexDTO> getMarketIndices() {
        long now = System.currentTimeMillis();
        if (now - lastMarketFetch < 15_000 && !marketCache.isEmpty()) {
            return marketCache;
        }

        String redisKey = "stock:market";
        String cached = redis.opsForValue().get(redisKey);
        if (cached != null && now - lastMarketFetch < 15_000) {
            return marketCache;
        }

        try {
            StringBuilder codes = new StringBuilder();
            for (String[] idx : INDEX_CODES) {
                if (!codes.isEmpty()) codes.append(",");
                codes.append(idx[0]);
            }

            String body = fetchSina(codes.toString());
            List<MarketIndexDTO> result = new ArrayList<>();

            for (String[] idx : INDEX_CODES) {
                String varName = "var hq_str_" + idx[0] + "=\"";
                int start = body.indexOf(varName);
                if (start < 0) continue;
                start += varName.length();
                int end = body.indexOf("\";", start);
                if (end < 0) continue;

                String data = body.substring(start, end);
                String[] parts = data.split(",");
                if (parts.length >= 5) {
                    result.add(new MarketIndexDTO(
                            idx[0].replace("s_", ""),
                            parts[0],
                            parseDouble(parts[1]),
                            parseDouble(parts[2]),
                            parseDouble(parts[3])
                    ));
                }
            }

            marketCache = result;
            lastMarketFetch = now;
            try {
                redis.opsForValue().set(redisKey, String.valueOf(now), Duration.ofSeconds(30));
            } catch (Exception ignored) {}

            return result;
        } catch (Exception e) {
            log.warn("获取大盘指数失败: {}", e.getMessage());
            return marketCache.isEmpty() ? buildFallbackIndices() : marketCache;
        }
    }

    @Override
    public StockQuoteDTO getQuote(String code) {
        return getQuotes(List.of(code)).stream().findFirst().orElse(null);
    }

    @Override
    public List<StockQuoteDTO> getQuotes(List<String> codes) {
        if (codes == null || codes.isEmpty()) return List.of();

        List<StockQuoteDTO> result = new ArrayList<>();
        List<String> toFetch = new ArrayList<>();

        for (String code : codes) {
            StockQuoteDTO cached = quoteCache.get(code);
            if (cached != null) {
                result.add(cached);
            } else {
                toFetch.add(code);
            }
        }

        if (!toFetch.isEmpty()) {
            try {
                String body = fetchSina(String.join(",", toFetch));
                for (String code : toFetch) {
                    String varName = "var hq_str_" + code + "=\"";
                    int start = body.indexOf(varName);
                    if (start < 0) continue;
                    start += varName.length();
                    int end = body.indexOf("\";", start);
                    if (end < 0) continue;

                    String data = body.substring(start, end);
                    String[] p = data.split(",");
                    if (p.length >= 32) {
                        StockQuoteDTO dto = new StockQuoteDTO(
                                code,
                                p[0],
                                parseDouble(p[1]),
                                parseDouble(p[3]),
                                parseDouble(p[4]),
                                parseDouble(p[5]),
                                parseDouble(p[3]),
                                parseDouble(p[2]),
                                parseDouble(p[3]) - parseDouble(p[2]),
                                (parseDouble(p[2]) != 0) ? (parseDouble(p[3]) - parseDouble(p[2])) / parseDouble(p[2]) * 100 : 0,
                                parseLong(p[8]),
                                parseDouble(p[9]),
                                p[31] + " " + p[30]
                        );
                        quoteCache.put(code, dto);
                        result.add(dto);
                    }
                }
            } catch (Exception e) {
                log.warn("获取股票行情失败: {}", e.getMessage());
            }
        }

        return result;
    }

    /**
     * 获取个股 K 线数据，Redis 缓存 1 小时（日线变化频率低）。
     * 新浪 K 线接口返回 JSON 数组，格式：[{day,open,high,low,close,volume}, ...]
     */
    @Override
    public List<KlinePoint> getKlineData(String code, String period, int count) {
        int safeCount = Math.min(Math.max(count, 1), 100);
        String scale = "weekly".equalsIgnoreCase(period) ? "200" : "240"; // 240=日线，200=周线
        String cacheKey = KLINE_CACHE_PREFIX + code + ":" + scale + ":" + safeCount;

        String cached = redis.opsForValue().get(cacheKey);
        if (cached != null) {
            try {
                return objectMapper.readValue(cached, new TypeReference<>() {});
            } catch (Exception ignored) {}
        }

        try {
            String url = SINA_KLINE_URL
                    + "?symbol=" + code
                    + "&scale=" + scale
                    + "&ma=no"
                    + "&datalen=" + safeCount;
            String body = restClient.get()
                    .uri(url)
                    .header("Referer", "https://finance.sina.com.cn")
                    .retrieve()
                    .body(String.class);

            List<Map<String, String>> raw = objectMapper.readValue(body, new TypeReference<>() {});
            List<KlinePoint> points = new ArrayList<>();
            for (Map<String, String> m : raw) {
                points.add(new KlinePoint(
                        m.getOrDefault("day", ""),
                        parseDouble(m.getOrDefault("open", "0")),
                        parseDouble(m.getOrDefault("close", "0")),
                        parseDouble(m.getOrDefault("high", "0")),
                        parseDouble(m.getOrDefault("low", "0")),
                        parseLong(m.getOrDefault("volume", "0"))
                ));
            }

            try {
                redis.opsForValue().set(cacheKey, objectMapper.writeValueAsString(points), Duration.ofHours(1));
            } catch (Exception ignored) {}

            return points;
        } catch (Exception e) {
            log.warn("获取 K 线数据失败 code={}: {}", code, e.getMessage());
            return List.of();
        }
    }

    /**
     * 定时刷新大盘指数缓存，每 30 秒更新一次。
     * 同时刷新 Redis 中所有 watchlist 持有的股票行情。
     */
    @Scheduled(fixedDelay = 30_000)
    public void refreshMarketCache() {
        try {
            getMarketIndices();
        } catch (Exception e) {
            log.warn("定时刷新大盘行情失败: {}", e.getMessage());
        }
        // 刷新自选股行情：扫描 watchlist:codes:* key，批量更新
        try {
            Set<String> watchlistKeys = redis.keys("watchlist:codes:*");
            if (watchlistKeys == null || watchlistKeys.isEmpty()) return;

            Set<String> allCodes = new HashSet<>();
            for (String key : watchlistKeys) {
                Set<String> members = redis.opsForSet().members(key);
                if (members != null) allCodes.addAll(members);
            }
            if (!allCodes.isEmpty()) {
                // 清理过期本地缓存，强制重新拉取
                allCodes.forEach(quoteCache::remove);
                getQuotes(new ArrayList<>(allCodes));
                log.debug("定时刷新自选股行情，共 {} 只", allCodes.size());
            }
        } catch (Exception e) {
            log.warn("定时刷新自选股行情失败: {}", e.getMessage());
        }
    }

    private String fetchSina(String codes) {
        return restClient.get()
                .uri(SINA_BRIEF_URL + codes)
                .header("Referer", "https://finance.sina.com.cn")
                .retrieve()
                .body(String.class);
    }

    private List<MarketIndexDTO> buildFallbackIndices() {
        return List.of(
                new MarketIndexDTO("sh000001", "上证指数", 0, 0, 0),
                new MarketIndexDTO("sz399001", "深证成指", 0, 0, 0),
                new MarketIndexDTO("sz399006", "创业板指", 0, 0, 0)
        );
    }

    private double parseDouble(String s) {
        try { return Double.parseDouble(s); } catch (Exception e) { return 0; }
    }

    private long parseLong(String s) {
        try { return Long.parseLong(s.split("\\.")[0]); } catch (Exception e) { return 0; }
    }
}
