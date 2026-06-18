# 验收标准 — 2026-06 迭代

> 每个功能的具体验收条件。实现完成后逐项勾选。

---

## F1 — Bug修复：评论数

- [x] `mvn test` 通过
- [x] 发表一条评论后，帖子详情页评论数 `commentCount` 从 0 变为 1
- [x] 删除评论后，计数减 1

---

## F2 — 帖子浏览量 PV

**后端接口验收：**
- [x] `GET /api/v1/counter/knowpost/{id}?metrics=view` 返回 `{"view": N}`
- [x] `POST /api/v1/counter/knowpost/{id}/view` 返回 `{"ok": true}`，重复调用不报错
- [x] 调用 view 接口后，再次 GET 计数，值 +1（异步聚合，可能有 1s 延迟）
- [x] `GET /api/v1/knowposts/detail/{id}` 响应包含 `viewCount` 字段

**前端验收：**
- [x] 打开帖子详情页，浏览量数字显示在标题下方
- [x] 刷新页面，浏览量 +1
- [x] 未登录用户打开详情页，浏览量也正常递增

---

## F3 — 评论点赞

**后端接口验收：**
- [x] `POST /api/v1/comment/{id}/like` 返回 `{"changed": true, "liked": true}`
- [x] 重复点赞返回 `{"changed": false, "liked": true}`（幂等）
- [x] `POST /api/v1/comment/{id}/unlike` 返回 `{"changed": true, "liked": false}`
- [x] `GET /api/v1/comment/list?postId={id}` 响应中每条评论包含 `likeCount` 和 `liked` 字段

**前端验收：**
- [x] 评论卡片右侧有点赞图标 + 数量
- [x] 点击点赞，图标变色，数量 +1（乐观更新）
- [x] 再次点击取消，数量 -1
- [x] 未登录用户点击，跳转登录页

---

## F4 — 热榜时间衰减算法

**验收：**
- [x] `GET /api/v1/hot/posts?period=24h&size=10` 返回列表
- [x] 发一篇新帖，点赞 5 次，能在热榜前列出现（不会被一篇点赞 100 但发布于 7 天前的帖子压制）
- [x] 代码中使用 `ageHours` 时间衰减公式，不再是纯 likeCount 排序

---

## F5 — 股票 K 线行情

**后端接口验收：**
- [x] `GET /api/v1/stock/kline?code=sh000001&period=daily&count=30` 返回 30 条 K 线数据
- [x] 每条数据包含 `date, open, close, high, low, volume`
- [x] 接口有 Redis 缓存，1 小时内重复请求不调用新浪接口

**前端验收：**
- [x] `stockService.kline(code, period, count)` 方法存在且类型正确
- [x] （如有实现）搜索股票时能看到该股票最近走势

---

## F6 — 自选股 Watchlist

**后端接口验收：**
- [x] `POST /api/v1/watchlist` body `{"code":"sh600000","name":"浦发银行"}` → 201 成功
- [x] `GET /api/v1/watchlist` 返回 `[{code, name, price, change, changePercent}]`
- [x] `DELETE /api/v1/watchlist/sh600000` → 200 成功，再次 GET 不包含该股票
- [x] `GET /api/v1/watchlist/sh600000/status` → `{"watching": true/false}`
- [x] 超过 50 只股票时，添加返回 400 错误

**前端验收：**
- [x] 首页右侧栏（登录后）显示"我的自选股"卡片
- [x] 未添加时显示"暂无自选股，去搜索添加"
- [x] 点击 + 图标能添加（需要有入口，可在股票行情卡片或搜索结果旁）
- [x] 添加后列表实时更新，显示价格和涨跌幅

---

## F7 — 定时行情数据同步

**验收：**
- [x] `application.yml.example` 有 `stock.scheduler.enabled` 配置项
- [x] 启动后 30s 内，Redis 中 `stock:market` key 有数据
- [x] 日志输出包含定时任务执行记录

---

## 整体验收

- [x] `mvn clean package -DskipTests` 编译通过
- [x] `mvn test` 全部测试通过
- [x] `npm run build` 前端构建通过（tsc --noEmit 无报错）
- [x] 所有 commit 使用中文描述，日期为 2026-06-17 或 2026-06-18
