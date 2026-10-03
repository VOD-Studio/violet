## 包内命令

在 violet 的 `web` 目录运行：

```bash
pnpm --filter @violet/ui sync
pnpm --filter @violet/ui check
pnpm --filter @violet/ui typecheck
pnpm --filter @violet/ui test
pnpm --filter @violet/ui build
pnpm --filter @violet/ui check:dist
pnpm --filter @violet/ui consumer
```

`sync` 从组件清单更新派生入口；`check` 只读核对源码架构。`build` 生成 preserveModules ESM、声明文件与 CSS，`check:dist` 核对产物，`consumer` 在外部临时项目安装真实 tgz 并检查类型、SSR、Vite 构建与入口依赖图。新增组件按[组件设计方法](/design-system/guides/component-design)执行，不逐处手工维护出口。

## 交付 tarball

```bash
pnpm --filter @violet/ui pack --pack-destination /tmp

# 在目标项目安装实际 pack 结果
pnpm add /tmp/violet-ui-0.1.0.tgz
```

版本与文件路径以 pack 输出为准。当前没有专用 `violet-ui` 安装 CLI，npm 发布尚未执行。安装后的样式接入见[快速入门](/design-system/guides/quick-start)。

## 运行文档站

`web` 目录的 `pnpm dev` 启动站点；整仓环境由根 Makefile 的 `make dev` 启动。站点检查使用 `make web-lint`、`make web-typecheck` 和 `make web-test`，具体脚本以 package.json 与 Makefile 为准。
