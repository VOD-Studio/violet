# Violet 页面与基础设计稿

Claude Design 画布「Violet UED 设计」的保留原稿。2026-11-12 按产品负责人要求删除 71 个组件画板、1 个组件展示画板和 3 个不再引用的资源；组件实现仍由 `@violet/ui` 维护，组件陈列室下线。

- 来源：<https://claude.ai/artifact/SfoRCyVtWY1reJd1mkQXU2#page-15fcfa1df1a8>
- 原导出：<https://claude.ai/artifact/1wmjWasieMjQjBJYDoX8b8>，2026-11-06 从来源画布副本导出，副本版本 `1793923319-b913`。
- 前台核对：2026-11-12 读取来源画布版本 `1793891370-19be` 的文件清单，12 个前台画板的 sha256 均与本地原稿一致。核对范围记录在 `manifest.json` 的 `frontendSourceVerification`，不代表后台与基础稿也重新比对过在线版本。
- 设计优先级：[ADR-0030](../../adr/0030-frontend-pages-use-existing-components.md)。已有组件的外观、交互与 API 优先于旧页面稿；页面稿用于布局、内容层级与页面级流程。

## 保留范围

| 页面 | `canvas.json` 的 `page` | 画板数 |
|---|---|---|
| 基础 | `foundation` | 3：基础规范、站点结构、背景 |
| 图标 | `icons` | 1 |
| 页面 | `site` | 12 |
| 后台 | `admin` | 19 |
| 状态 | `states` | 2：加载、空状态与错误 |

`project/` 保存 37 个未改写的 `.dc.html` 原稿和一个裁剪后的 `canvas.json`。`_blob/` 保存仍被这些原稿引用的 44 个资源，包括纸面纹理、字体、插画与示例图。后台稿只保留，不属于本轮前台改版的实施范围。

`canvas.json` 的画板、排序与页面列表已移除组件和组件展示项；它是本地派生索引，不再声明与上游逐字节一致。原索引 sha256 留在 `manifest.json` 的 `selection.originalCanvasSha256`；`project` 和 `blobs` 保存当前文件的校验值。

## 校验

在本目录执行：

```bash
jq -r '.project | to_entries[] | "\(.value)  project/\(.key)"' manifest.json | shasum -a 256 -c --quiet
jq -r '.blobs | to_entries[] | "\(.value.sha256)  _blob/\(.key)"' manifest.json | shasum -a 256 -c --quiet
```

## 阅读限制

原稿保留内联 CSS、`<x-dc>` 模板与 `<script type="text/x-dc">` 取值逻辑，不直接复制为生产代码。页面中的示例数字、昵称、版本号与内容不是产品数据契约。

Claude Design 运行时 `support.js` 未归档。保留原稿中的 `dc-import` 仍引用旧 Header、Footer 等组件，组件稿删除后不承诺离线完整渲染；查看整页用来源画布，开发使用现有组件。原稿不为清除这些历史引用而改写。

组件原稿可从删除前的提交 `e176bfe03` 追溯，例如：

```bash
git show e176bfe03:docs/design/ued/project/Header.dc.html
```

## 更新

后续只更新保留范围内的页面、基础、图标与状态稿；后台原稿独立维护。重新导出时保持 `.dc.html` 原文，重建派生索引和 sha256 清单，不重新引入已删除的组件画板或陈列室。
