package com.tongji.comment.api;

import com.tongji.auth.token.JwtService;
import com.tongji.comment.api.dto.CommentListResponse;
import com.tongji.comment.api.dto.CreateCommentRequest;
import com.tongji.comment.service.CommentService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/comment")
public class CommentController {

    private final CommentService commentService;
    private final JwtService jwtService;

    public CommentController(CommentService commentService, JwtService jwtService) {
        this.commentService = commentService;
        this.jwtService = jwtService;
    }

    @PostMapping
    public Long create(@AuthenticationPrincipal Jwt jwt, @RequestBody CreateCommentRequest request) {
        long uid = jwtService.extractUserId(jwt);
        return commentService.create(uid, request);
    }

    @DeleteMapping("/{id}")
    public boolean delete(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        long uid = jwtService.extractUserId(jwt);
        return commentService.delete(uid, id);
    }

    @GetMapping("/list")
    public CommentListResponse list(@RequestParam Long postId,
                                     @RequestParam(required = false) String cursor,
                                     @RequestParam(defaultValue = "20") int size,
                                     @AuthenticationPrincipal Jwt jwt) {
        size = Math.min(Math.max(size, 1), 50);
        Long uid = jwt != null ? jwtService.extractUserId(jwt) : null;
        return commentService.listTopLevel(postId, cursor, size, uid);
    }

    @GetMapping("/replies")
    public CommentListResponse replies(@RequestParam Long parentId,
                                        @RequestParam(required = false) String cursor,
                                        @RequestParam(defaultValue = "20") int size,
                                        @AuthenticationPrincipal Jwt jwt) {
        size = Math.min(Math.max(size, 1), 50);
        Long uid = jwt != null ? jwtService.extractUserId(jwt) : null;
        return commentService.listReplies(parentId, cursor, size, uid);
    }

    @PostMapping("/{id}/like")
    public ResponseEntity<Map<String, Object>> like(@PathVariable Long id,
                                                    @AuthenticationPrincipal Jwt jwt) {
        long uid = jwtService.extractUserId(jwt);
        boolean changed = commentService.likeComment(uid, id);
        return ResponseEntity.ok(Map.of("changed", changed, "liked", true));
    }

    @PostMapping("/{id}/unlike")
    public ResponseEntity<Map<String, Object>> unlike(@PathVariable Long id,
                                                      @AuthenticationPrincipal Jwt jwt) {
        long uid = jwtService.extractUserId(jwt);
        boolean changed = commentService.unlikeComment(uid, id);
        return ResponseEntity.ok(Map.of("changed", changed, "liked", false));
    }
}
