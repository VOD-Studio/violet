# 开发说明

使用说明见 [README](./README.md)，完整契约见 [API 文档](./docs/api.md)。本文件说明如何维护示例与分发产物，不进入 npm 包。

## 常用命令

开发工具要求 Node.js **22.18 及以上**（原生执行 TypeScript）与 pnpm 10；发布产物为 ES2022 ESM，Node.js 18 及以上可消费。在本目录执行：

```sh
pnpm typecheck   # 类型检查
pnpm test        # 单元与行为测试（使用 web/ 的 Vitest 配置）
pnpm build       # 输出 dist：ESM、声明与 sourcemap
pnpm consumer    # 打包 tarball，在临时独立项目中安装并验证类型、运行与打包体积
pnpm examples    # 运行 examples/ 生成 docs/images 下的样例图，并把样例代码同步进两份 README
pnpm examples:check # 重新计算 SVG 并逐字节比较现有图，核对 Mermaid 图的来源指纹，同时检查中英文 README 代码块
```

## README 样例

`examples/` 下每个文件都是可运行的样例，`docs/images/` 中同名的图就是它的输出。README 里 `<!-- example: 名称 -->` 与 `<!-- /example -->` 之间的代码块由 `scripts/sync-readme.mjs` 从对应文件同步：文件里有 `// #region readme` 区域时只展示区域内的 `style` 与 `items`，导入与渲染留在文件里。不要手改这些代码块；`pnpm consumer` 会先运行 `pnpm examples:check`，检查代码与图均无漂移。首图通过 `examples/artwork.ts` 的 `inkArtwork` 处理单份咖啡少女 JSON 生成，保留每条墨区和中心线的独立角色（例如嘴唇），不导入应用运行时代码。

Mermaid 样例 `examples/mermaid.ts` 需要浏览器：`node scripts/render-mermaid.mjs` 用 esbuild 打包后在 Chromium 中执行，把重画后的 SVG 写入 `docs/images/mermaid.svg`，并在 `mermaid.json` 记录 Mermaid 版本、`src/`（不含测试）、样例与脚本的哈希以及图片哈希。Mermaid 排版依赖本机字体，不能跨机器逐字节比对，`--check` 只核对这些指纹、不启动浏览器；改动 `src/` 后须在本机重新生成。

`node scripts/render-examples.ts [--artwork path/to/artwork.json] [--check]` 生成六张基础示例；传入画稿时同时生成首图。`--check` 只比较、不写文件。`node scripts/sync-readme.mjs [--check]` 同步或检查两份 README。`node scripts/consumer-smoke.mjs [--keep]` 打包并在系统临时目录内独立安装，验证 tarball 文件白名单、ESM 入口、Bundler/NodeNext 类型消费、Node SVG 执行、确定性与默认 SVG bundle 的 12 KiB gzip 上限，以及未用到的笔、淡彩与 Canvas 模块是否被摇树移除。`--keep` 保留临时消费项目供排查；默认结束后清理。

## 目录

| 目录 | 内容 |
| --- | --- |
| `src/core/` | 路径与图元、展平与角点、确定性随机、渲染批次构造 |
| `src/hand/` | 笔画规划、最小 jerk 手法、压力与预设 |
| `src/pen/` | 条带轮廓、签字笔、钢笔、马克笔、G 笔 |
| `src/fill/` | 扫描线、图案填充与淡彩填充 |
| `src/animate/` | 编排与播放器 |
| `src/render/` | SVG、Canvas、显现轨迹与配色解析 |
| `src/dom/` | `inkSvg`：在已渲染的 SVG 上原地换成手绘笔触 |
| `examples/` | README 样例，每个文件生成一张图 |
| `docs/` | 样例图与 API 文档（不进入 npm 包） |
| `scripts/` | 样例图生成、README 同步与装包验收 |
| `bench/` | 与 Rough.js 的性能对照 |

## 约定

- 内置随机通道名保留更名前的 `sketch:` 前缀。通道名参与哈希，改名会让所有既有画面整体变样。
- 源码相对导入写实际的 `.ts` 扩展名；JS 由打包器输出为 `.js`，声明通过 TypeScript 构建。独立消费同时使用 NodeNext 与 Bundler 解析，且不跳过声明检查。
- 修改算法后运行 `pnpm examples` 更新样例图，并在 `CHANGELOG.md` 的未发布版本下记一条。

## 发布

流程见[发布手册的 npm 独立包发布一节](../../../docs/deploy/release-runbook.md#npm-独立包发布)。

维护时先生成示例，再运行类型、测试与独立消费检查。`prepack` 自动构建，不发布；只能使用 pnpm 打包，以便将 `publishConfig` 中的 `dist` 入口写入发布清单。包内不分发源码、脚本、API 文档和示例图片；README 使用公开 GitHub 文档链接与 raw 图片链接，这些文件须在公开的 `release/2.0` 分支存在后再发布 npm 包。
