package com.tongji.stock.service;

import com.tongji.stock.dto.HotStockDTO;

import java.util.List;
import java.util.Map;

/**
 * 帖子关联个股（F1 数据底座）。
 */
public interface PostStockService {

    /** 覆盖式同步某帖子关联的股票（先清后写）。codes 为空表示清空。 */
    void sync(long postId, List<String> codes);

    /** 查询某帖子关联的股票列表，元素含 code/name。 */
    List<Map<String, Object>> listByPost(long postId);

    /** 某股票关联的帖子总数。 */
    long countByStock(String code);

    /** 今日热议个股榜 Top N（含实时报价）。 */
    List<HotStockDTO> hotStocks(int limit);
}
