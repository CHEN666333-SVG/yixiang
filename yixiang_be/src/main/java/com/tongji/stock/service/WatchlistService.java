package com.tongji.stock.service;

import com.tongji.stock.dto.WatchlistItem;

import java.util.List;

public interface WatchlistService {
    /** 添加自选股，同一只股票幂等，超限返回 false。 */
    boolean add(long userId, String code, String name);

    /** 删除自选股。 */
    void remove(long userId, String code);

    /** 获取自选股列表，附带实时行情（价格/涨跌）。 */
    List<WatchlistItem> list(long userId);

    /** 是否已加入自选。 */
    boolean isWatching(long userId, String code);
}
