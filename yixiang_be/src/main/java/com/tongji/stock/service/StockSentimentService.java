package com.tongji.stock.service;

import com.tongji.stock.dto.SentimentDTO;

/**
 * 个股看涨/看跌情绪投票（F4，Redis 存储）。
 */
public interface StockSentimentService {

    /**
     * 投票或改票（一人一票，多空互斥，可切换；重复投同向不变）。
     * @param direction "bull" | "bear"
     * @return 投票后的最新情绪
     */
    SentimentDTO vote(long userId, String code, String direction);

    /** 查询某股票情绪聚合；userId 为 null 时 myVote 为 null。 */
    SentimentDTO get(Long userId, String code);
}
