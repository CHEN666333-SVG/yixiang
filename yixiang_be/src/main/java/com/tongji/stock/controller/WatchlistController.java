package com.tongji.stock.controller;

import com.tongji.auth.token.JwtService;
import com.tongji.stock.dto.WatchlistItem;
import com.tongji.stock.service.WatchlistService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 自选股接口：添加/删除/查询/状态检查。
 * 存储层使用 Redis ZSet，无需 DB 迁移，支持实时行情聚合。
 */
@RestController
@RequestMapping("/api/v1/watchlist")
public class WatchlistController {

    private final WatchlistService watchlistService;
    private final JwtService jwtService;

    public WatchlistController(WatchlistService watchlistService, JwtService jwtService) {
        this.watchlistService = watchlistService;
        this.jwtService = jwtService;
    }

    /** 添加自选股。 */
    @PostMapping
    public ResponseEntity<Map<String, Object>> add(
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal Jwt jwt) {
        long uid = jwtService.extractUserId(jwt);
        String code = body.get("code");
        String name = body.getOrDefault("name", code);
        if (code == null || code.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "code 不能为空"));
        }
        boolean ok = watchlistService.add(uid, code.trim(), name.trim());
        if (!ok) {
            return ResponseEntity.badRequest().body(Map.of("error", "自选股数量已达上限（50只）"));
        }
        return ResponseEntity.ok(Map.of("ok", true));
    }

    /** 删除自选股。 */
    @DeleteMapping("/{code}")
    public ResponseEntity<Map<String, Boolean>> remove(
            @PathVariable String code,
            @AuthenticationPrincipal Jwt jwt) {
        long uid = jwtService.extractUserId(jwt);
        watchlistService.remove(uid, code);
        return ResponseEntity.ok(Map.of("ok", true));
    }

    /** 查询自选股列表（含实时行情）。 */
    @GetMapping
    public List<WatchlistItem> list(@AuthenticationPrincipal Jwt jwt) {
        long uid = jwtService.extractUserId(jwt);
        return watchlistService.list(uid);
    }

    /** 检查某只股票是否已在自选股中。 */
    @GetMapping("/{code}/status")
    public Map<String, Boolean> status(
            @PathVariable String code,
            @AuthenticationPrincipal Jwt jwt) {
        long uid = jwtService.extractUserId(jwt);
        return Map.of("watching", watchlistService.isWatching(uid, code));
    }
}
