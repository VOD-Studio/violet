## 构建与打包

仓库没有独立的 `violet-ui` 安装 CLI。使用 pnpm 构建并打包 `@violet/ui`：

```bash
cd web
pnpm install --frozen-lockfile
pnpm --filter @violet/ui build
pnpm --filter @violet/ui pack --pack-destination /tmp
```

`build` 在 dist 下产出 ESM、类型声明与单文件主题 CSS；`pack` 产出可安装的 tarball（如 `violet-ui-0.1.0.tgz`）。发布到 scoped npm registry 是未来的人工操作，当前请安装 tarball，而非直接运行 `pnpm add @violet/ui`。

## 在独立项目安装

```bash
pnpm add /tmp/violet-ui-0.1.0.tgz
```

安装后在全局 CSS 中先导入 Tailwind、再导入 `@violet/ui/styles.css`，步骤见[快速入门](/design-system/guides/quick-start)；不用 Tailwind 的宿主可改导入 `tokens.css`，见[框架集成](/design-system/guides/integration)。

## 开发命令

开发站点使用 `pnpm dev`（web 目录）；命令定义以各 package.json 为准。整仓完整环境（PostgreSQL、Redis、API 与 Web）由根目录 Makefile 的 `make dev` 一键启动。
