# Issue-0002：about_config 端到端骨架（后端存储 + 后台配置子页 + 前台渲染框架）

## Parent

PRD-0009（`../../prd/0009-about-redesign.md`）

## What to build

打通 `about_config`（区块版面配置聚合 JSON）的**完整 tracer bullet**：后端能存能取 → 后台能可视化编辑 → 前台能按配置渲染。这是后续所有区块（A 线 / B 线）的承载骨架——区块组件此 issue 可先用占位，重点验证"配置 → 渲染"链路端到端打通。

`about_config` 结构（PRD-0009 决策）：`{ sections: [{ id, enabled, order, params }] }`，存于 `site_settings` 表单一键 `about_config`（复用现有 key-value 表，**不新建表**）。

端到端切片：
- 后端：`about_config` 键读写（JSON 值编解码）+ `GetPublic` 白名单加入 `about_config` + 定义各 About 内容字段（avatar_url/tagline/role/location/social 矩阵等作为新 settings 键加入 `SiteSettings` 聚合与 `UpdateInput`，本 issue 至少落几个示例字段验证链路）。
- 后台：新建「关于页配置」子页（依赖 Issue-0001 的子菜单能力），承载区块列表的开关 + 拖拽排序 + 参数表单，提交 `about_config` 聚合 JSON。
- 前台：About 页（`about/index.tsx`）改为消费 `about_config`，遍历区块数组，按 `order` 排序、按 `enabled` 过滤渲染。区块组件先用占位（如「区块: {id}」），后续 issue 填实。

## Acceptance criteria

### 后端配置存储（settings 域，DDD 四层）
- [ ] `about_config` 键支持读写：值是聚合 JSON，后端正确序列化/反序列化（不破坏现有 key-value 读写）
- [ ] `GetPublic` 白名单新增 `about_config`（公开，供前台渲染）
- [ ] `SiteSettings` 聚合 + `UpdateInput` 新增若干 About 内容示例字段（如 `avatar_url` / `tagline`），验证新字段加入链路通畅
- [ ] admin `PUT /admin/settings` 支持更新 `about_config` 与新内容字段（部分更新，指针字段）

### 后台配置子页（admin.settings.about）
- [ ] 新建子页路由，挂载到 Issue-0001 预留的「关于页配置」导航位置
- [ ] 区块列表：每行一个区块（A1-A4、B2-B7、B5-B7），带显隐开关
- [ ] 拖拽排序：拖动调整 `order`（复用现有拖拽组件或引入，对齐仓库惯例）
- [ ] 参数表单：点开区块编辑其 `params`（至少示例字段可填，如 avatar_url）
- [ ] 保存提交 `about_config` 聚合 JSON 到 `PUT /admin/settings`

### 前台渲染框架（about/index.tsx）
- [ ] About 页消费 `about_config`（从 `GET /api/v1/settings` 公开响应取）
- [ ] 遍历 `sections`：按 `order` 排序、`enabled:false` 不渲染、`enabled:true` 渲染对应区块组件
- [ ] `about_config` 缺失或为空时不报错（优雅降级，渲染默认或空）
- [ ] 区块组件此 issue 可占位，但 `id` 与区块的映射关系已建立（后续 issue 填实各区块）

### 测试（Seam 1 · 前端区块渲染行为）
- [ ] 给定含 enabled/order/params 的 `about_config`，断言渲染出正确区块集合（disabled 不渲染、order 决定顺序、params 透传）
- [ ] 对齐现有组件测试 seam（vi + RTL，参照 `ArticleToc.test.tsx`）

### 验收
- [ ] 端到端：后台改配置 → 保存 → 刷新前台 About 页，按新配置（显隐+顺序）渲染
- [ ] `make api-test` / `make web-typecheck` / `make web-test` / `make api-lint` / `make web-lint` 全绿

## Blocked by

- Issue-0001（依赖其子菜单导航能力与设置子页拆分基础）
