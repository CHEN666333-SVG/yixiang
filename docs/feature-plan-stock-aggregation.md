# 功能设计文档 —— 个股聚合（打通行情与社区）

> 轮次：2026-06 第二轮
> 主题：把「行情数据」和「社区内容」打通，让一只股票的报价、K 线、讨论、多空情绪聚合在一处。
> 状态标记：⬜ 未开始 / 🟡 进行中 / ✅ 已完成

---

## 背景与痛点

当前平台行情数据（报价 / K 线 / 大盘 / 自选股）与社区内容（帖子 / 评论 / 热榜）**完全割裂**：
- 自选股只能看价格，点不进任何讨论；
- 帖子无法关联具体股票，无法按票聚合内容；
- 没有「某只票社区情绪如何」的直观表达。

股票知识社区的命脉恰恰是「行情 ↔ 讨论」的闭环（参考雪球、StockTwits）。本轮补齐这条闭环。

## 闭环逻辑

```
发帖关联个股 (F1) → 个股有了聚合页 (F2) → 聚合页沉淀讨论 + 多空情绪 (F4)
        ↑                                                    │
        └──────── 热议个股榜发现热门票 (F3) ←──── 引流回聚合页 ┘
```

---

## F1：帖子关联个股（数据底座）

**业务价值**：让每条讨论挂到具体股票上，是后续所有聚合的基础。

### 后端
- 新增表 `post_stocks`：

  | 字段 | 类型 | 说明 |
  |------|------|------|
  | id | BIGINT | Snowflake 主键 |
  | post_id | BIGINT | 关联帖子 |
  | stock_code | VARCHAR(16) | 如 `sh600000` |
  | stock_name | VARCHAR(64) | 冗余股票名，免二次查 |
  | create_time | DATETIME | |

  索引：`UNIQUE(post_id, stock_code)`、`idx_stock_code`、`idx_post_id`。

- `KnowPostPatchRequest` 增加 `List<String> stockCodes`（≤10 只）。
- 发布/编辑帖子时，`PostStockService.sync(postId, codes)` 全量覆盖式同步 `post_stocks`（先删后插或 diff）。
- 帖子详情 / Feed 项附带 `stocks: [{code, name}]`。

### 前端
- CreatePage / 编辑页：新增「关联股票」选择器 —— 输入代码或名称，调 `/stock/quote` 校验并回显名称，最多 10 只，chip 形式增删。
- 帖子卡片 / 详情：展示关联股票 chip，点击跳 `/stock/:code`。

---

## F2：个股详情页（核心聚合页）

**业务价值**：一只票的行情 + 讨论一站式，平台从「内容社区」升级为「投资决策入口」。

### 后端
- `GET /api/v1/stock/{code}/detail` → `StockDetailDTO { quote, postCount, sentiment }`（聚合实时报价 + 帖子数 + 多空情绪）。
- `GET /api/v1/stock/{code}/posts?cursor=&size=` → 该股票关联帖子流（`post_stocks JOIN know_posts`，游标分页，复用 Counter enrich 出点赞/浏览/评论数）。
- K 线复用已有 `GET /api/v1/stock/kline`。

### 前端
- 新增路由 `/stock/:code` → `StockDetailPage`：
  - 顶部实时报价卡（价格、涨跌幅红涨绿跌、加自选按钮复用 watchlist）；
  - K 线图（引入 `lightweight-charts`，日线/周线切换）；
  - 多空情绪条（F4）；
  - 关联帖子信息流（无限滚动，复用 InfiniteList）。

---

## F3：热议个股榜（行情 × 内容）

**业务价值**：发现「今天大家在聊什么票」，是社区流量分发的核心入口。

### 后端
- 发帖关联股票时，对每只票 `ZINCRBY hot_stocks:day:{yyyyMMdd} 1 {code}`，key 设 2 天 TTL。
- `GET /api/v1/stock/hot?range=day&limit=10` → `ZREVRANGE` 取 Top N → 批量补实时报价 + 名称 → `List<HotStockDTO {code, name, price, changePercent, mentionCount}>`。

### 前端
- HomePage 右栏新增「今日热议个股」卡片（位于「大盘行情」下方），展示名称 / 涨跌幅 / 被提及次数，点击跳个股页。

---

## F4：看涨 / 看跌情绪投票

**业务价值**：一眼看懂社区对某票的多空情绪，是股票社区独有的高互动表达。

### 后端（Redis 存储，免迁移）
- `stock:sentiment:{code}` Hash：`{ bull: n, bear: m }` 计数。
- `stock:sentiment:voter:{code}` Hash：`userId -> "bull"|"bear"`，用于去重 + 改票（一人一票，多空互斥，可切换）。
- `POST /api/v1/stock/{code}/sentiment` body `{ direction }` → 记录/切换投票，原子更新计数。
- `GET /api/v1/stock/{code}/sentiment` → `{ bull, bear, total, bullPercent, myVote }`。

### 前端
- 个股详情页展示情绪进度条（看涨 % vs 看跌 %）+ 两个投票按钮，登录后可投，乐观更新。

---

## 技术选型与权衡

| 决策 | 选择 | 理由 |
|------|------|------|
| 帖子↔股票存储 | MySQL 关联表 `post_stocks` | 需按 code 高效查帖、需持久化与索引，ZSet 不胜任 |
| 热议榜存储 | Redis ZSet + 日 key + TTL | 实时累加、自动过期、无需定时聚合 |
| 情绪投票存储 | Redis Hash | 计数 + 去重一人一票，免 DB 迁移，量级小 |
| 前端图表 | `lightweight-charts` | TradingView 出品，专为蜡烛图设计，体积小（~40KB gzip） |

## 非目标（本轮不做）
- 个股基本面 / 财报数据（外部数据源成本高）
- 股票代码标准化映射库（仅支持新浪可查的 A 股代码）
- 情绪的历史时间序列（仅当前快照）
