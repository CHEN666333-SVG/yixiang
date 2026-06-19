package com.tongji.stock.service.impl;

import com.tongji.common.exception.BusinessException;
import com.tongji.common.exception.ErrorCode;
import com.tongji.stock.dto.SentimentDTO;
import com.tongji.stock.service.StockSentimentService;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

@Service
public class StockSentimentServiceImpl implements StockSentimentService {

    private static final String BULL = "bull";
    private static final String BEAR = "bear";

    private final StringRedisTemplate redis;

    public StockSentimentServiceImpl(StringRedisTemplate redis) {
        this.redis = redis;
    }

    /** 计数 Hash：{ bull: n, bear: m } */
    private String countKey(String code) {
        return "stock:sentiment:" + code;
    }

    /** 投票人 Hash：userId -> "bull"|"bear"，用于去重与改票 */
    private String voterKey(String code) {
        return "stock:sentiment:voter:" + code;
    }

    @Override
    public SentimentDTO vote(long userId, String code, String direction) {
        if (!BULL.equals(direction) && !BEAR.equals(direction)) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "投票方向非法");
        }
        String ck = countKey(code);
        String vk = voterKey(code);
        String field = String.valueOf(userId);

        String prev = (String) redis.opsForHash().get(vk, field);
        if (direction.equals(prev)) {
            // 重复投同向，幂等返回
            return get(userId, code);
        }
        if (prev == null) {
            // 首投
            redis.opsForHash().increment(ck, direction, 1);
        } else {
            // 改票：原方向 -1，新方向 +1
            redis.opsForHash().increment(ck, prev, -1);
            redis.opsForHash().increment(ck, direction, 1);
        }
        redis.opsForHash().put(vk, field, direction);
        return get(userId, code);
    }

    @Override
    public SentimentDTO get(Long userId, String code) {
        String ck = countKey(code);
        long bull = parse(redis.opsForHash().get(ck, BULL));
        long bear = parse(redis.opsForHash().get(ck, BEAR));
        long total = bull + bear;
        int bullPercent = total == 0 ? 50 : (int) Math.round(bull * 100.0 / total);
        String myVote = null;
        if (userId != null) {
            myVote = (String) redis.opsForHash().get(voterKey(code), String.valueOf(userId));
        }
        return new SentimentDTO(bull, bear, total, bullPercent, myVote);
    }

    private long parse(Object v) {
        if (v == null) return 0;
        try {
            return Long.parseLong(v.toString());
        } catch (NumberFormatException e) {
            return 0;
        }
    }
}
