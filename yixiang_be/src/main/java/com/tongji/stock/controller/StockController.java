package com.tongji.stock.controller;

import com.tongji.stock.dto.KlinePoint;
import com.tongji.stock.dto.MarketIndexDTO;
import com.tongji.stock.dto.StockQuoteDTO;
import com.tongji.stock.service.StockDataService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/stock")
public class StockController {

    private final StockDataService stockDataService;

    public StockController(StockDataService stockDataService) {
        this.stockDataService = stockDataService;
    }

    @GetMapping("/market")
    public List<MarketIndexDTO> marketIndices() {
        return stockDataService.getMarketIndices();
    }

    @GetMapping("/quote")
    public StockQuoteDTO quote(@RequestParam String code) {
        return stockDataService.getQuote(code);
    }

    @GetMapping("/quotes")
    public List<StockQuoteDTO> quotes(@RequestParam String codes) {
        return stockDataService.getQuotes(List.of(codes.split(",")));
    }

    /**
     * 获取个股 K 线数据。
     * @param code  股票代码，如 sh600000
     * @param period daily（日线）| weekly（周线），默认 daily
     * @param count  返回条数，默认 30，最多 100
     */
    @GetMapping("/kline")
    public List<KlinePoint> kline(@RequestParam String code,
                                   @RequestParam(defaultValue = "daily") String period,
                                   @RequestParam(defaultValue = "30") int count) {
        return stockDataService.getKlineData(code, period, count);
    }
}
