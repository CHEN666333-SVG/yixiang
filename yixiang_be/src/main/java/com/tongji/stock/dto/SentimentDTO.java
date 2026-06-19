package com.tongji.stock.dto;

/**
 * 个股多空情绪聚合。
 * @param bull        看涨票数
 * @param bear        看跌票数
 * @param total       总票数
 * @param bullPercent 看涨占比（0~100 整数，total 为 0 时返回 50）
 * @param myVote      当前用户的投票："bull" | "bear" | null（未投/未登录）
 */
public record SentimentDTO(long bull, long bear, long total, int bullPercent, String myVote) {}
