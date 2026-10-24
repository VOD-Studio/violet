# 开发说明

使用说明与完整 API 见 [README](./README.zh-CN.md)（包只导出三个函数，不另设 API 文档），决策见 [ADR-0024](../../../docs/adr/0024-theme-color-generation.md)。本文件说明如何维护算法与验收，不进入 npm 包。

## 常用命令

在本目录执行，或在仓库根目录用 `make theme-*`：

```sh
pnpm typecheck  # 类型检查
pnpm test       # 门槛遍历与行为测试
pnpm build      # 输出 dist：ESM 与声明
pnpm consumer   # 打包 tarball，在临时独立项目中安装，验证类型、README 示例、Node 运行与 Chromium 导入
```

`pnpm consumer` 需要本机已安装 Playwright Chromium（`pnpm exec playwright install chromium`），`--keep` 保留临时项目供排查。

## 测试

测试只经过三个公开函数。`src/test/sweep.ts` 以 1° 步长遍历全部色相，乘以多档色度与种子亮度，再对其中三分之一取旋钮两端；每种外观与对比度档位各一个测试文件，并行执行：

| 文件 | 断言 |
| --- | --- |
| `sweep.<外观>-<档位>.test.ts` | 共用 `src/test/describe-sweep.ts`：每组门槛在浮点值与 8 位量化值下都同时通过 WCAG 2.2 与 APCA；全部颜色在 sRGB 内、除实色外各档亮度单调、保持种子色相、实色档只调亮度、悬停不降低文字对比度、前景只取近白或近黑、透明度色阶叠加后与实色档无可察觉色差、结果可重复 |
| `generate.test.ts` | 典型种子在两种外观下原样保留、前景的选择、旋钮与确定性 |
| `css.test.ts` | 自定义属性名称、`light-dark()` 合并、`prefers-contrast: more` 媒体查询与不安全输入 |
| `normalize.test.ts` | 非法输入回落、旋钮单独回落与丢弃未知旋钮 |

门槛数值写在 `src/test/gates.ts`，来自规范而不是实现。颜色解析、色差与 WCAG 比值用 CSS Color 4 编辑维护的 `colorjs.io`，APCA 用官方 `apca-w3`，都不复用包内的换算。

## 调整算法

亮度目标、组件底色的亮度差与色度曲线都在 `src/rules.ts`，相邻档的最小亮度差在 `src/generate.ts`。求解只用 WCAG 比值，APCA 门槛先折算成 WCAG 比值目标。改动后运行 `pnpm test`：门槛遍历失败时列出前 20 个不达标的组合及其 WCAG 与 APCA 值，按差额上调对应目标；通过后再随机抽取种子色复核，确认余量不只在遍历网格上成立。

## 约定

- 运行时零依赖，不使用 Node API；`pnpm consumer` 断言发布清单的 `dependencies` 为空。
- 源码相对导入写 `.ts` 扩展名，由 TypeScript 构建改写为 `.js`。
- 站点若转为商业用途，删除 `gates.test.ts` 中的 APCA 断言与 `apca-w3` 开发依赖即可，产品代码不变。

## 发布

尚未发布 npm，`publish-npm.yml` 暂不包含本包。发布前流程同[发布手册的 npm 独立包发布一节](../../../docs/deploy/release-runbook.md#npm-独立包发布)。
