## 当前重建范围

2026 年 10 月 2 日的架构批次保持包名 `@violet/ui` 和现有根入口。包版本仍以 package.json 为准，文档日期不表示已经发布了新版本。

| 状态 | 单元 | 当前约束 |
| --- | --- | --- |
| foundation | Button、Input、Label、Textarea、TextField | 使用新组件单元、typed BEM recipe 与同源 CSS；补齐 native / ref / SSR / 消费契约 |
| legacy | 清单中的其他组件，包括 Dialog、Tabs、Checkbox | 保留现有 API，目录统一；行为、视觉、双轨样式逐个迁移 |

`web/packages/ui/component-manifest.json` 是单元状态与公开路径的事实源。`@violet/ui/legacy` 是兼容导出入口，组件实现仍放在各自的 `src/components/<name>/`，没有副本。

本批次还建立清单派生入口、纯 recipe 导出、preserveModules ESM 和类型声明、按组件 CSS，以及构建后真实 tarball 的外部消费者流程。验证命令与边界见[组件设计方法](/design-system/guides/component-design)。

## 下一批如何迁移

按真实消费需要挑一个 legacy 单元。先记录现有调用与状态表，补键盘、焦点、事件、ref 及表单契约，再统一 recipe 与 CSS。用同源示例解释变化，构建并安装 tarball 后检查依赖图；达到验收条件才修改清单状态。

普通圆角、投影与动效按[布局规格](/design-system/layout)和[动效章程](/design-system/motion)收敛。第一批基础单元遵从这些约束，不代表全部 legacy 视觉已重建。

## 分发与尚未交付的能力

工作区消费源码，独立项目安装 tgz。npm 公开发布、版本化 CHANGELOG、专用安装 CLI、组件文档 MCP 和 Figma 资产尚未交付。需要这些能力时先完成产物与对应验证，再改变接入说明。

早期 v0.1.0 已完成组件迁入工作区包、默认明暗主题、ESM / 类型 / CSS 构建入口和营造法式文档站。本批次在该基础上重建单元边界；旧组件的使用历史不计为新架构验收证据。
