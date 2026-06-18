package com.tongji.stock.service;

import com.tongji.stock.dto.KlinePoint;
import com.tongji.stock.dto.MarketIndexDTO;
import com.tongji.stock.dto.StockQuoteDTO;

import java.util.List;

public interface StockDataService {
    List<MarketIndexDTO> getMarketIndices();
    StockQuoteDTO getQuote(String code);
    List<StockQuoteDTO> getQuotes(List<String> codes);
    /**
     * 获取个股 K 线数据（日线/周线）。
     * @param code 股票代码（如 sh600000）
     * @param period "daily" | "weekly"
     * @param count 返回条数（最多 100）
     */
    List<KlinePoint> getKlineData(String code, String period, int count);
}
