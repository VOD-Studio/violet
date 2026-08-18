---
name: module-scaffolding
description: Use when adding a new backend module or frontend feature to a DDD-layered codebase — creating domain entities and repository interfaces, wiring a service through the DI container, registering HTTP handlers and routes, or scaffolding a feature directory with api/model/ui sublayers.
---

# 新增模块装配手册

适用于 DDD 分层仓库(domain / application / infrastructure / interfaces)。**以仓库里最近新增的一个同类模块为模板**——它的 commit 就是装配清单的活样本(`git log --diff-filter=A --name-only -- <domain 目录>` 可列出全部落点)。

## 后端模块七处落点

按依赖顺序创建,每处一行职责:

| # | 层 | 职责 | 探测方式 |
|---|---|---|---|
| 1 | domain/`<mod>`/ | 实体、值对象、仓储**接口** | 看最近模块的 entity/repository 文件对 |
| 2 | application/`<mod>`/ | 用例编排 service;跨层依赖的端口接口 | ports.go 可选,无跨层依赖不建 |
| 3 | infrastructure 持久层 | 仓储实现 + PO 模型(ORM 映射) | 与 domain 仓储接口成对 |
| 4 | interfaces HTTP handler | 请求/响应 DTO 与 HTTP 适配 | 一个 `<mod>.go` 起步 |
| 5 | DI 容器文件 | 模块级 `*Container`,构造函数装配 1-4 | 手工 DI 仓库必有;wire 仓库则改 provider set |
| 6 | 根容器挂载 | 容器聚合 struct 加字段 + 构造两行 | grep 根容器文件找最近模块的挂载行照抄 |
| 7 | 路由注册 | 路由依赖 struct 加 handler 字段 + 子路由注册 | 公开路由与 admin 路由分开注册;admin 侧挂权限中间件 |

配套:数据库迁移 `{NNN}_{slug}.{up,down}.sql` 成对,NNN 取当前最大值 +1。

## 前端 feature 骨架

```
features/<name>/
  api/client.ts      # 端点函数,收/发散请求响应类型
  api/queries.ts     # TanStack Query hooks(useQuery/useMutation)
  api/keys.ts        # query key 工厂
  model/types.ts     # 命名 interface 的 DTO 与领域类型
  ui/                # 组件(Feature 私有,通用件待第二消费方出现再上提)
```

路由页是薄壳:取数 + 组装 feature 组件。admin 页接入见 admin-data-table(若该项目有对应 skill)。

## 完成判据

- 后端:编译通过 + 新端点路由可达(起服务 curl 或看路由表测试);有仓储实现必有对应接口在 domain。
- 前端:typecheck 通过 + 页面渲染真实数据。
- 文档:按仓库文档责任地图(若有)同步模块清单。

## 反指标

- domain 引用 infrastructure/application(依赖方向反了)。
- handler 里写业务分支(该下沉 application)。
- repository 返回 DTO(该留在 interfaces 层转换)。
- 新建全局工具函数而最近的模块里已有同款(先 grep 再写)。
