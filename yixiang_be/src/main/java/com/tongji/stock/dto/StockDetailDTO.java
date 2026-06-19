package com.tongji.stock.dto;

/**
 * 个股详情聚合（报价 + 帖子数 + 情绪）。
 */
public record StockDetailDTO(StockQuoteDTO quote, long postCount, SentimentDTO sentiment) {}
