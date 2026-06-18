package com.tongji.stock.dto;

public record WatchlistItem(
        String code,
        String name,
        double price,
        double change,
        double changePercent,
        long addedAt
) {}
