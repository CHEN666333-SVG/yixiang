package com.tongji.stock.controller;

import com.tongji.auth.token.JwtService;
import com.tongji.knowpost.api.dto.FeedPageResponse;
import com.tongji.knowpost.service.KnowPostFeedService;
import com.tongji.stock.dto.HotStockDTO;
import com.tongji.stock.dto.SentimentDTO;
import com.tongji.stock.dto.StockDetailDTO;
import com.tongji.stock.dto.StockQuoteDTO;
import com.tongji.stock.service.PostStockService;
import com.tongji.stock.service.StockDataService;
import com.tongji.stock.service.StockSentimentService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 个股聚合：详情、关联帖子、热议榜、多空情绪。
 */
@RestController
@RequestMapping("/api/v1/stock")
public class StockAggregateController {

    private final StockDataService stockDataService;
    private final PostStockService postStockService;
    private final StockSentimentService sentimentService;
    private final KnowPostFeedService feedService;
    private final JwtService jwtService;

    public StockAggregateController(StockDataService stockDataService,
                                    PostStockService postStockService,
                                    StockSentimentService sentimentService,
                                    KnowPostFeedService feedService,
                                    JwtService jwtService) {
        this.stockDataService = stockDataService;
        this.postStockService = postStockService;
        this.sentimentService = sentimentService;
        this.feedService = feedService;
        this.jwtService = jwtService;
    }

    /** 今日热议个股榜（公开）。注意：放在 {code} 之前，避免被路径变量吞掉。 */
    @GetMapping("/hot")
    public List<HotStockDTO> hot(@RequestParam(defaultValue = "10") int limit) {
        return postStockService.hotStocks(limit);
    }

    /** 个股详情聚合：报价 + 帖子数 + 情绪（公开）。 */
    @GetMapping("/{code}/detail")
    public StockDetailDTO detail(@PathVariable String code,
                                 @AuthenticationPrincipal Jwt jwt) {
        Long uid = jwt != null ? jwtService.extractUserId(jwt) : null;
        StockQuoteDTO quote = stockDataService.getQuote(code);
        long postCount = postStockService.countByStock(code);
        SentimentDTO sentiment = sentimentService.get(uid, code);
        return new StockDetailDTO(quote, postCount, sentiment);
    }

    /** 个股关联帖子流（公开，游标分页）。 */
    @GetMapping("/{code}/posts")
    public FeedPageResponse posts(@PathVariable String code,
                                  @RequestParam(required = false) String cursor,
                                  @RequestParam(defaultValue = "10") int size,
                                  @AuthenticationPrincipal Jwt jwt) {
        Long uid = jwt != null ? jwtService.extractUserId(jwt) : null;
        return feedService.getStockPosts(code, cursor, size, uid);
    }

    /** 查询个股情绪（公开）。 */
    @GetMapping("/{code}/sentiment")
    public SentimentDTO getSentiment(@PathVariable String code,
                                     @AuthenticationPrincipal Jwt jwt) {
        Long uid = jwt != null ? jwtService.extractUserId(jwt) : null;
        return sentimentService.get(uid, code);
    }

    /** 投票看涨/看跌（需登录）。 */
    @PostMapping("/{code}/sentiment")
    public SentimentDTO vote(@PathVariable String code,
                             @RequestBody Map<String, String> body,
                             @AuthenticationPrincipal Jwt jwt) {
        long uid = jwtService.extractUserId(jwt);
        return sentimentService.vote(uid, code, body.get("direction"));
    }
}
