# 功能规划文档 — 2026-06 迭代

> 股票知识交流社区（颐享）新功能规划，以**业务价值**为核心，优先做用户体验最直接的点。

## 一、功能总览

| # | 功能 | 业务价值 | 优先级 | 状态 |
|---|------|---------|--------|------|
| F1 | Bug修复：评论数 entityType 不一致 | 评论数长期显示 0，影响所有帖子 | P0 | ✅ 已完成 |
| F2 | 帖子浏览量 PV | 展示内容热度，用户感知"这篇很多人看" | P1 | ✅ 已完成 |
| F3 | 评论点赞 | 对好评论表示认同，提升互动感 | P1 | ✅ 已完成 |
| F4 | 热榜时间衰减算法 | 热门内容更公平，老帖不霸占首位 | P1 | ✅ 已完成 |
| F5 | 股票 K 线历史行情 | 分析帖搭配价格走势，股票平台核心 | P2 | ✅ 已完成 |
| F6 | 自选股 Watchlist | 用户保存关注的股票，定制化体验 | P2 | ✅ 已完成 |
| F7 | 定时行情数据同步（调度任务） | 行情数据自动刷新，无需手动触发 | P2 | ✅ 已完成 |

---

## 二、各功能详细设计

### F1 — Bug修复：评论数 entityType 不一致

**问题：** `CommentServiceImpl` 调用 `counterService.incrementComment("know_post", ...)` 但其他地方读取用 `"knowpost"`，导致评论计数永远 0。

**修复：**
- `CommentServiceImpl.java` 第67、89行：`"know_post"` → `"knowpost"`

---

### F2 — 帖子浏览量 PV

**业务价值：** 用户判断内容价值的第一指标。"2.3万次浏览"比"100个点赞"更能体现内容影响力。

**后端方案：**
- `CounterSchema`：新增 `IDX_VIEW = 0`（使用预留的 slot-0），加入 `NAME_TO_IDX` 和 `SUPPORTED_METRICS`
- `CounterService`：新增 `recordView(entityType, entityId)` 接口方法
- `CounterServiceImpl`：实现 `recordView`，与 `incrementComment` 相同机制，走 Kafka 聚合异步写入
- `CounterController`：新增 `POST /api/v1/counter/{etype}/{eid}/view` 公开接口（无需登录）
- `KnowPostDetailResponse`：新增 `viewCount` 字段
- `KnowPostServiceImpl`：`getCounts` 调用加入 `"view"` 指标；组装 response 时带上 viewCount

**前端方案：**
- `types/knowpost.ts`：`KnowpostDetailResponse` 新增 `viewCount?: number`
- `PostDetailPage.tsx`：组件挂载时调用 `POST /api/v1/counter/knowpost/{id}/view`；在帖子头部展示 "🔍 xxx 次浏览"
- 不展示在 feed 卡片上（减少视觉噪音，仅详情页显示）

---

### F3 — 评论点赞

**业务价值：** 用户看到一条精彩分析时，想表达认同。没有评论点赞=好评论被埋没。

**后端方案：**
- `CommentDTO`：新增 `likeCount`、`liked` 字段
- `CounterService`：新增 `isLikedBatch(entityType, entityIds, userId)` 批量位图查询
- `CounterServiceImpl`：实现 `isLikedBatch`，使用管道（pipeline）GETBIT，单次 RTT
- `CommentService`：新增 `likeComment(userId, commentId)` 和 `unlikeComment(userId, commentId)`
- `CommentServiceImpl`：
  - 实现 like/unlike：调用 `counterService.like("comment", commentId, userId)`
  - `listTopLevel` / `listReplies`：补批量查询 likeCount；认证用户补 liked 状态
- `CommentController`：新增 `POST /api/v1/comment/{id}/like` 和 `POST /api/v1/comment/{id}/unlike`

**前端方案：**
- `types/comment.ts`：`CommentDTO` 新增 `likeCount?: number`、`liked?: boolean`
- `commentService.ts`：新增 `like(id)` 和 `unlike(id)` 调用 action 接口（复用已有 entityType="comment"）
- `PostDetailPage.tsx`：评论卡片右侧加点赞按钮（ThumbsUp 图标 + 计数），乐观更新

---

### F4 — 热榜时间衰减算法

**业务价值：** 当前热榜只按点赞数排序，一篇老帖可以永远占据第一，新的好内容无法被发现。

**方案（HN 改版）：**
```
score = (likes*3 + comments*5 + favs*2 + 1) / (ageHours + 2)^1.5
```
- 评论权重高于点赞（有人愿意回复说明内容更有价值）
- `+1` 防止全零帖子 score=0，让新帖有基础排名
- 重力指数 1.5（原 HN 是 1.8，稍低些适合内容社区）

**后端方案：**
- `HotServiceImpl.java`：替换 `sorted` 的 `Comparator`，加入时间衰减计算
- 需要 KnowPost 有 `publishTime` 字段（已存在：`getCreateTime()`）

---

### F5 — 股票 K 线历史行情

**业务价值：** 用户发布 "$宁德时代" 分析帖时，旁边能看到最近 30 天的日线图，大幅提升平台专业感。

**数据来源：** 新浪财经 K 线接口 `https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData`

**后端方案：**
- `StockDataService`：新增 `getKlineData(String code, String period, int count)`
- `StockDataServiceImpl`：实现调用新浪 K 线接口，Redis 缓存（日线缓存 1 小时，分钟线缓存 2 分钟）
- `StockController`：新增 `GET /api/v1/stock/kline?code={code}&period={daily|weekly}&count=30`
- 新增 `KlinePoint` DTO（date, open, close, high, low, volume）

**前端方案：**
- `stockService.ts`：新增 `kline(code, period, count)` 方法
- 在 `PostDetailPage.tsx` 或帖子搜索结果旁：若帖子 tag 包含股票代码，侧边展示简单价格走势（折线图用 CSS 渲染，避免引入大型图表库）

---

### F6 — 自选股 Watchlist

**业务价值：** 用户关注几只股票，每次进首页就能看到它们的实时行情，是股票 App 的标配功能。

**存储方案：** Redis ZSet，`watchlist:{userId}` → `{member: stockCode, score: addedTimestamp}`，无需 DB 迁移。附加 `stockName` 存在 Hash：`watchlist:name:{userId}:{code}`。

**后端方案（新增模块）：**
- `WatchlistService.java`（interface）
- `WatchlistServiceImpl.java`：
  - `add(userId, code, name)`：ZADD + HSET stockName
  - `remove(userId, code)`：ZREM + HDEL
  - `list(userId)`：ZRANGE + 批量拉取实时行情（复用 `StockDataService.getQuotes`）
  - `isWatching(userId, code)`：ZSCORE
  - 限制每用户最多 50 只股票
- `WatchlistController.java`：
  - `POST /api/v1/watchlist` + body `{code, name}`
  - `DELETE /api/v1/watchlist/{code}`
  - `GET /api/v1/watchlist`
  - `GET /api/v1/watchlist/{code}/status`

**前端方案：**
- `types/watchlist.ts`：`WatchlistItem { code, name, price?, change?, changePercent? }`
- `watchlistService.ts`：add/remove/list/status
- `HomePage.tsx` 右侧栏：在"大盘行情"下方新增"我的自选股"卡片，显示用户关注的股票实时价格，带 +/- 操作

---

### F7 — 定时行情数据同步（调度任务）

**业务价值：** 目前股票行情数据在每次请求时才从新浪拉取，高并发时慢且不稳定。定时任务提前刷新缓存，用户访问直接走 Redis。

**后端方案：**
- `StockDataServiceImpl`：新增 `@Scheduled(fixedDelay = 30_000)` 方法 `refreshWatchlistCache()`
  - 从 Redis 扫描所有 `watchlist:*` key，收集所有 stockCode
  - 批量调用新浪接口更新行情缓存
  - 同时刷新大盘指数缓存（`stock:market`）
- 支持在 `application.yml` 配置 `stock.scheduler.enabled: true` 开关
