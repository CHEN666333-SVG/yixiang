# 任务列表 — 2026-06 迭代

> 每完成一个任务立即更新状态。格式：`[ ]` 待做 / `[x]` 已完成 / `[!]` 跳过/阻塞

---

## Section A — Bug修复 + PV浏览量（后端）

- [x] **A1** `CounterSchema.java`：添加 `IDX_VIEW = 0`，更新 `NAME_TO_IDX` 和 `SUPPORTED_METRICS`
- [x] **A2** `CounterService.java`：新增 `recordView()` 和 `isLikedBatch()` 接口方法
- [x] **A3** `CounterServiceImpl.java`：实现 `recordView()` — fire CounterEvent(type="view", idx=0, delta=+1)
- [x] **A4** `CounterServiceImpl.java`：实现 `isLikedBatch()` — pipelined GETBIT
- [x] **A5** `CounterController.java`：新增 `POST /api/v1/counter/{etype}/{eid}/view` 公开接口
- [x] **A6** `KnowPostDetailResponse.java`：新增 `viewCount` 字段
- [x] **A7** `KnowPostServiceImpl.java`：`getCounts` 加入 `"view"`；response 构造加入 viewCount
- [x] **A8** `CommentServiceImpl.java`（Bug Fix）：第67、89行 `"know_post"` → `"knowpost"`

---

## Section B — 评论点赞（后端）

- [x] **B1** `CommentDTO.java`：新增 `likeCount`、`liked` 字段
- [x] **B2** `CommentService.java`：新增 `likeComment(userId, commentId)` 和 `unlikeComment(userId, commentId)` 接口
- [x] **B3** `CommentServiceImpl.java`：实现 `likeComment` 和 `unlikeComment`（调用 counterService）
- [x] **B4** `CommentServiceImpl.listTopLevel()`：补批量 likeCount（`getCountsBatch`）和批量 liked（`isLikedBatch`）
- [x] **B5** `CommentServiceImpl.listReplies()`：同上
- [x] **B6** `CommentController.java`：新增 `POST /api/v1/comment/{id}/like` 和 `POST /api/v1/comment/{id}/unlike`

---

## Section C — 热榜时间衰减算法（后端）

- [x] **C1** `HotServiceImpl.java`：替换 Comparator，改用时间衰减评分 `score = (likes*3 + comments*5 + favs*2 + 1) / (ageHours+2)^1.5`

---

## Section D — 股票 K 线行情（后端）

- [x] **D1** `StockDataService.java`：新增 `getKlineData(String code, String period, int count)` 接口方法
- [x] **D2** 新建 `KlinePoint.java` DTO（date, open, close, high, low, volume）
- [x] **D3** `StockDataServiceImpl.java`：实现 `getKlineData`，调用新浪接口并 Redis 缓存（1小时）
- [x] **D4** `StockDataServiceImpl.java`：新增 `@Scheduled` 方法定时刷新大盘 + 自选股缓存
- [x] **D5** `StockController.java`：新增 `GET /api/v1/stock/kline?code={code}&period={daily}&count=30`

---

## Section E — 自选股 Watchlist（后端）

- [x] **E1** 新建 `WatchlistService.java`（interface，在 `com.tongji.stock.service`）
- [x] **E2** 新建 `WatchlistServiceImpl.java`（Redis ZSet 实现）
- [x] **E3** 新建 `WatchlistController.java`
- [x] **E4** 新建 `WatchlistItem.java` DTO

---

## Section F — 前端接入

- [x] **F1** `types/knowpost.ts`：`KnowpostDetailResponse` 新增 `viewCount?: number`
- [x] **F2** `PostDetailPage.tsx`：mount 时调用 view endpoint；显示浏览量
- [x] **F3** `types/comment.ts`：`CommentDTO` 新增 `likeCount?`、`liked?`
- [x] **F4** `commentService.ts`：新增 `like(id)` 和 `unlike(id)` 方法
- [x] **F5** `PostDetailPage.tsx`：评论卡片加点赞按钮（乐观更新）
- [x] **F6** `stockService.ts`：新增 `kline(code, period, count)` 方法
- [x] **F7** 新建 `watchlistService.ts`
- [x] **F8** `HomePage.tsx`：在右侧栏"大盘行情"下方加"我的自选股"卡片

---

## 进度汇总

| Section | 完成 / 总任务 |
|---------|-------------|
| A (PV + Bug) | 8 / 8 ✅ |
| B (Comment Likes BE) | 6 / 6 ✅ |
| C (Hot Score) | 1 / 1 ✅ |
| D (K线) | 5 / 5 ✅ |
| E (Watchlist BE) | 4 / 4 ✅ |
| F (Frontend) | 8 / 8 ✅ |
| **合计** | **32 / 32** |
