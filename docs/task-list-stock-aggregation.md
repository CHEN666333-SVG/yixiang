# 任务清单 —— 个股聚合

> 配合 `feature-plan-stock-aggregation.md`。状态：⬜ 未开始 / 🟡 进行中 / ✅ 已完成

## A 组：F1 帖子关联个股（后端数据底座）
- ✅ A1 新建 `post_stocks` 建表 SQL（放 `docs/sql/` 或迁移脚本）
- ✅ A2 `PostStock` model + MyBatis Mapper（`PostStockMapper.java` + XML）：insert 批量、deleteByPostId、selectByPostId、selectPostIdsByCode（游标分页）
- ✅ A3 `PostStockService` / Impl：`sync(postId, codes)` 覆盖式同步、`listByPost(postId)`
- ✅ A4 `KnowPostPatchRequest` 增 `List<String> stockCodes`；发布/编辑流程调用 sync
- ✅ A5 帖子详情 / Feed DTO 增 `stocks` 字段并回填

## B 组：F2 个股详情页（后端）
- ✅ B1 `StockDetailDTO`、`HotStockDTO` 等 DTO
- ✅ B2 `GET /stock/{code}/detail`：聚合 quote + postCount + sentiment
- ✅ B3 `GET /stock/{code}/posts`：关联帖子游标分页 + Counter enrich
- ✅ B4 SecurityConfig 放开 `GET /stock/**` 公开访问

## C 组：F3 热议个股榜（后端）
- ✅ C1 发帖 sync 时 `ZINCRBY hot_stocks:day:{date}`（含 TTL）
- ✅ C2 `GET /stock/hot?range=day&limit=` ZREVRANGE + 批量补报价

## D 组：F4 情绪投票（后端）
- ✅ D1 `StockSentimentService` / Impl：vote(userId, code, dir) 原子切换、get(userId, code)
- ✅ D2 `POST /stock/{code}/sentiment`、`GET /stock/{code}/sentiment`

## E 组：前端
- ✅ E1 安装 `lightweight-charts`
- ✅ E2 `types/stock.ts` 增 StockDetail / HotStock / Sentiment 类型；`types/knowpost.ts` 帖子增 `stocks`
- ✅ E3 `stockService.ts` 增 detail / posts / hot / getSentiment / vote；新增股票关联相关
- ✅ E4 `StockDetailPage.tsx`：报价卡 + K线图 + 情绪条 + 关联帖子流；路由注册 `/stock/:code`
- ✅ E5 CreatePage：关联股票选择器（搜索校验 + chip）
- ✅ E6 帖子卡片 / PostDetailPage：股票 chip 展示与跳转
- ✅ E7 HomePage 右栏「今日热议个股」卡片
- ✅ E8 个股页 / 帖子页情绪投票交互（乐观更新）

## F 组：收尾
- ✅ F1 后端 `mvn compile`（JDK21）通过
- ✅ F2 前端 `tsc --noEmit` 通过
- ✅ F3 分组中文 commit + push
