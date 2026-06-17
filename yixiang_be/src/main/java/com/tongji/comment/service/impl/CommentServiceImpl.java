package com.tongji.comment.service.impl;

import com.tongji.comment.api.dto.CommentDTO;
import com.tongji.comment.api.dto.CommentListResponse;
import com.tongji.comment.api.dto.CreateCommentRequest;
import com.tongji.comment.event.CommentEvent;
import com.tongji.comment.event.CommentEventProducer;
import com.tongji.comment.mapper.CommentMapper;
import com.tongji.comment.service.CommentService;
import com.tongji.counter.service.CounterService;
import com.tongji.knowpost.mapper.KnowPostMapper;
import com.tongji.knowpost.model.KnowPost;
import com.tongji.user.domain.User;
import com.tongji.user.service.UserService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.*;
import java.util.concurrent.ThreadLocalRandom;

@Slf4j
@Service
public class CommentServiceImpl implements CommentService {

    private final CommentMapper commentMapper;
    private final CounterService counterService;
    private final UserService userService;
    private final KnowPostMapper knowPostMapper;
    private final CommentEventProducer commentEventProducer;

    public CommentServiceImpl(CommentMapper commentMapper,
                              CounterService counterService,
                              UserService userService,
                              KnowPostMapper knowPostMapper,
                              CommentEventProducer commentEventProducer) {
        this.commentMapper = commentMapper;
        this.counterService = counterService;
        this.userService = userService;
        this.knowPostMapper = knowPostMapper;
        this.commentEventProducer = commentEventProducer;
    }

    @Override
    @Transactional
    public Long create(long userId, CreateCommentRequest request) {
        long id = ThreadLocalRandom.current().nextLong(Long.MAX_VALUE);

        Long parentId = request.parentId();
        Long replyToUserId = request.replyToUserId();

        if (parentId != null) {
            Map<String, Object> parent = commentMapper.findById(parentId);
            if (parent == null || Integer.parseInt(String.valueOf(parent.get("status"))) != 1) {
                throw new IllegalArgumentException("父评论不存在");
            }
            Object parentParentId = parent.get("parentId");
            if (parentParentId != null) {
                parentId = Long.parseLong(String.valueOf(parentParentId));
            }
        }

        commentMapper.insert(id, request.postId(), userId, request.content(), parentId, replyToUserId);
        counterService.incrementComment("knowpost", String.valueOf(request.postId()));

        try {
            KnowPost post = knowPostMapper.findById(request.postId());
            if (post != null && post.getCreatorId() != null && post.getCreatorId() != userId) {
                String snippet = request.content().length() > 50
                        ? request.content().substring(0, 50) : request.content();
                commentEventProducer.publish(new CommentEvent(id, request.postId(),
                        post.getCreatorId(), userId, snippet));
            }
        } catch (Exception ignored) {}

        return id;
    }

    @Override
    @Transactional
    public boolean delete(long userId, long commentId) {
        int rows = commentMapper.softDelete(commentId, userId);
        if (rows > 0) {
            Map<String, Object> comment = commentMapper.findById(commentId);
            if (comment != null && comment.get("postId") != null) {
                counterService.decrementComment("knowpost", String.valueOf(comment.get("postId")));
            }
            return true;
        }
        return false;
    }

    @Override
    public CommentListResponse listTopLevel(Long postId, String cursor, int size, Long currentUserId) {
        Instant cursorTime = null;
        Long cursorId = null;
        if (cursor != null && !cursor.isBlank()) {
            String[] parts = cursor.split(":", 2);
            cursorTime = Instant.parse(parts[0]);
            cursorId = Long.parseLong(parts[1]);
        }

        int querySize = size + 1;
        List<Map<String, Object>> rows = commentMapper.listByPostId(postId, cursorTime, cursorId, querySize);

        boolean hasMore = rows.size() > size;
        if (hasMore) {
            rows = rows.subList(0, size);
        }

        Set<Long> userIds = new HashSet<>();
        for (Map<String, Object> row : rows) {
            userIds.add(((Number) row.get("userId")).longValue());
        }
        Map<Long, User> userMap = resolveUsers(userIds);

        List<String> commentIds = rows.stream()
                .map(r -> String.valueOf(((Number) r.get("id")).longValue()))
                .toList();
        Map<String, Map<String, Long>> likeCounts = commentIds.isEmpty()
                ? Map.of()
                : counterService.getCountsBatch("comment", commentIds, List.of("like"));
        List<Boolean> likedBatch = (currentUserId != null && !commentIds.isEmpty())
                ? counterService.isLikedBatch("comment", commentIds, currentUserId)
                : null;

        List<CommentDTO> items = new ArrayList<>();
        String nextCursor = null;

        for (int i = 0; i < rows.size(); i++) {
            Map<String, Object> row = rows.get(i);
            long uid = ((Number) row.get("userId")).longValue();
            User user = userMap.get(uid);
            String cid = String.valueOf(((Number) row.get("id")).longValue());
            long lc = likeCounts.getOrDefault(cid, Map.of()).getOrDefault("like", 0L);
            boolean liked = likedBatch != null && likedBatch.get(i);
            items.add(toDTO(row, user, null, lc, liked));
            nextCursor = buildCursor(row);
        }

        return new CommentListResponse(items, hasMore ? nextCursor : null, hasMore);
    }

    @Override
    public CommentListResponse listReplies(Long parentId, String cursor, int size, Long currentUserId) {
        Instant cursorTime = null;
        Long cursorId = null;
        if (cursor != null && !cursor.isBlank()) {
            String[] parts = cursor.split(":", 2);
            cursorTime = Instant.parse(parts[0]);
            cursorId = Long.parseLong(parts[1]);
        }

        int querySize = size + 1;
        List<Map<String, Object>> rows = commentMapper.listReplies(parentId, cursorTime, cursorId, querySize);

        boolean hasMore = rows.size() > size;
        if (hasMore) {
            rows = rows.subList(0, size);
        }

        Set<Long> userIds = new HashSet<>();
        for (Map<String, Object> row : rows) {
            userIds.add(((Number) row.get("userId")).longValue());
            Object replyTo = row.get("replyToUserId");
            if (replyTo != null) {
                userIds.add(((Number) replyTo).longValue());
            }
        }
        Map<Long, User> userMap = resolveUsers(userIds);

        List<String> commentIds = rows.stream()
                .map(r -> String.valueOf(((Number) r.get("id")).longValue()))
                .toList();
        Map<String, Map<String, Long>> likeCounts = commentIds.isEmpty()
                ? Map.of()
                : counterService.getCountsBatch("comment", commentIds, List.of("like"));
        List<Boolean> likedBatch = (currentUserId != null && !commentIds.isEmpty())
                ? counterService.isLikedBatch("comment", commentIds, currentUserId)
                : null;

        List<CommentDTO> items = new ArrayList<>();
        String nextCursor = null;

        for (int i = 0; i < rows.size(); i++) {
            Map<String, Object> row = rows.get(i);
            long uid = ((Number) row.get("userId")).longValue();
            User user = userMap.get(uid);

            String replyToNickname = null;
            Object replyToUid = row.get("replyToUserId");
            if (replyToUid != null) {
                User replyToUser = userMap.get(((Number) replyToUid).longValue());
                if (replyToUser != null) {
                    replyToNickname = replyToUser.getNickname();
                }
            }

            String cid = String.valueOf(((Number) row.get("id")).longValue());
            long lc = likeCounts.getOrDefault(cid, Map.of()).getOrDefault("like", 0L);
            boolean liked = likedBatch != null && likedBatch.get(i);
            items.add(toDTO(row, user, replyToNickname, lc, liked));
            nextCursor = buildCursor(row);
        }

        return new CommentListResponse(items, hasMore ? nextCursor : null, hasMore);
    }

    @Override
    public boolean likeComment(long userId, long commentId) {
        return counterService.like("comment", String.valueOf(commentId), userId);
    }

    @Override
    public boolean unlikeComment(long userId, long commentId) {
        return counterService.unlike("comment", String.valueOf(commentId), userId);
    }

    private Map<Long, User> resolveUsers(Set<Long> userIds) {
        Map<Long, User> map = new HashMap<>();
        for (Long uid : userIds) {
            userService.findById(uid).ifPresent(u -> map.put(uid, u));
        }
        return map;
    }

    private CommentDTO toDTO(Map<String, Object> row, User user, String replyToNickname, long likeCount, boolean liked) {
        Object replyCountObj = row.get("replyCount");
        int replyCount = replyCountObj != null ? ((Number) replyCountObj).intValue() : 0;

        Object parentIdObj = row.get("parentId");
        Object replyToUserIdObj = row.get("replyToUserId");

        return new CommentDTO(
                ((Number) row.get("id")).longValue(),
                row.get("postId") != null ? ((Number) row.get("postId")).longValue() : null,
                ((Number) row.get("userId")).longValue(),
                user != null ? user.getNickname() : "未知用户",
                user != null ? user.getAvatar() : null,
                (String) row.get("content"),
                parentIdObj != null ? ((Number) parentIdObj).longValue() : null,
                replyToUserIdObj != null ? ((Number) replyToUserIdObj).longValue() : null,
                replyToNickname,
                toInstant(row.get("createdAt")),
                replyCount,
                likeCount,
                liked
        );
    }

    private Instant toInstant(Object obj) {
        if (obj instanceof Instant i) return i;
        if (obj instanceof LocalDateTime ldt) return ldt.atZone(ZoneId.systemDefault()).toInstant();
        if (obj instanceof java.sql.Timestamp ts) return ts.toInstant();
        return null;
    }

    private String buildCursor(Map<String, Object> row) {
        Instant created = toInstant(row.get("createdAt"));
        Long rowId = ((Number) row.get("id")).longValue();
        return created.toString() + ":" + rowId;
    }
}
