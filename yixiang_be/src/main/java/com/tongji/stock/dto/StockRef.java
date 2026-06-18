package com.tongji.stock.dto;

/**
 * 帖子关联的股票引用（代码 + 名称），用于详情/卡片展示与跳转。
 */
public record StockRef(String code, String name) {}
