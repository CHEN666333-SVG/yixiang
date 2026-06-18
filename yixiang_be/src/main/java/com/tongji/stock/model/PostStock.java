package com.tongji.stock.model;

import lombok.Data;

import java.time.Instant;

/**
 * 帖子关联个股（post_stocks 表）。
 */
@Data
public class PostStock {
    private Long id;
    private Long postId;
    private String stockCode;
    private String stockName;
    private Instant createTime;
}
