---
kind: post
operation: create
target_id: ""
status: draft
title: "首页聚合读模型应把首屏与延迟资源分成两条链"
tags:
  - frontend
  - react-query
  - performance
  - ddd
excerpt: "记录统一发布物读模型、首屏与延迟加载编排、游标完整性、分区失败语义和 RSS 收口。"
dedupe_status: done
scan_status: clean
created_at: "2026-09-07T09:05:21Z"
last_error: "当前会话未挂载 violet-posts MCP"
---

# 首页聚合读模型应把首屏与延迟资源分成两条链

这次把首页从“分别请求文章、笔记、图集、系列和归档，再由浏览器拼装”切到三个面向首页的公开资源：`site-identity`、`publications`、`site-impressions`。边界保持清楚：文章、笔记、图集进入统一发布物流；推文仍走 tweets；公告仍由全局公告栏负责。前端不再拥有跨领域 DTO 的合并规则，只保留月份、季节、节点位置和 marker size 这些纯展示计算。

## 首屏关键路径与延迟路径

关键路径只并发请求站点身份和 `publications?limit=5`。站点身份失败会阻止页面形成；最近发布物失败只显示“近稿”区块错误态，不再伪装为空列表。十二个月足迹、推文和匿名印记放到客户端查询中，不阻塞序章。

浏览器冷导航记录显示，身份请求约 624 B，最近发布物约 45 B，二者同时发起；序章与近稿约 353 ms 可见。人为把足迹延迟 2 秒后，首屏仍先完成。热导航命中 TanStack Query 缓存时没有新增 API 请求。这里验证的是实际浏览器请求顺序和可见状态，不是单元测试推断。

## 完整窗口不能等同于单页

足迹查询使用最近十二个自然月的 UTC 半开区间，并以 `limit=100` 按 cursor 续取，直到 `has_more=false`。客户端同时拒绝“声明还有下一页但没有 cursor”和重复 cursor，避免接口异常时形成死循环。浏览器插入跨边界发布物后验证了十二个月刻度、窗口边界、最近五项顺序和同刻稳定排序；验收数据随后删除。

## 失败状态按资源隔离

发布物流失败只影响近稿；足迹失败只影响时间轴；印记 POST 失败后按钮切换为可重试状态，其他区块保持可用。测试中还发现 Cookie 曾固定写成 `Secure=true`，导致本地 HTTP 下 POST 返回计数、刷新却恢复为未留下。修复后 Cookie 的 `Domain` 与 `Secure` 完全遵循运行配置，并用 handler 测试覆盖非 Secure 环境。

站点身份默认返回 `/feed.xml`，而静态入口实际不存在。最终增加动态 RSS 2.0 服务端路由，并让生产反向代理精确转发该路径；浏览器跳转和原始响应均确认 `application/rss+xml`。剩余风险是 feed 中的绝对地址仍取决于部署时的站点 URL 配置，配置错误会生成语法合法但指向错误域名的订阅条目。
