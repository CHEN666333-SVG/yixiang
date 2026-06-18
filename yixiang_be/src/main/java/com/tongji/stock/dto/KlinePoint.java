package com.tongji.stock.dto;

public record KlinePoint(
        String date,
        double open,
        double close,
        double high,
        double low,
        long volume
) {}
