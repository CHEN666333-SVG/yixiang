package com.tongji.stock.dto;

/**
 * 热议个股榜条目。
 */
public record HotStockDTO(String code, String name, double price, double changePercent, long mentionCount) {}
