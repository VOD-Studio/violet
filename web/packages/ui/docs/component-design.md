## 先写一个消费场景

本流程用于给 `@violet/ui` 新增通用组件，或把 legacy 单元迁入新架构。先打开[架构指南](./architecture.md)和 `web/packages/ui/component-manifest.json`，确认是否已有同类能力。

给场景写一段最小调用代码，再列出谁拥有状态、需要哪些 DOM 语义、什么时候不用该组件。TextField 的最小边界是带 label、说明和错误的原生输入；值、校验与请求状态由调用方管理。不要因为一个字段示例而增加表单引擎。

```tsx
<TextField
  label="显示名称"
  name="displayName"
  value={name}
  onChange={(event) => setName(event.target.value)}
  invalid={name.trim().length < 2}
  errorMessage="至少输入两个非空白字符"
/>
```

如果 API 必须同时维护原生事件与自定义同义事件，先说明额外语义。基础 Input 保留 `onChange(event)`，无需再造 `onValueChange`。涉及浮层、roving focus 或集合选择时先核对 Radix 的实际能力。

## 建立组件单元

落笔前读取仓库的 `frontend-conventions` 与 `violet-ui` skill；写 Tailwind 类时读取 `tailwind-canonical-classes`。查重范围包括包内组件与真实消费方。组件语义、状态和视觉规范从需求与契约确定，不从旧站点案例反推。

```text
web/packages/ui/src/components/<name>/
  index.ts       组件、props 与 recipe 的公开导出
  <name>.tsx     结构、事件和 native / Radix 行为
  styles.ts      有变体时提供类型化 BEM recipe
  <name>.css     唯一视觉实现
  __tests__/     行为与消费契约
```

组件只有两三个文件时保持平铺，测试与实现共置；站点示例放 `web/src/features/design-system/ui/examples/<name>/`，不能把业务请求、路由和 validation schema 放进包。legacy 组件也放在 `src/components/<name>/`，迁移状态由清单表达，不另建一套目录。

没有变体时直接使用稳定 BEM 类名，不建立空 recipe。需要 variant / size 时，recipe 负责选择 `.v-<name>`、`.v-<name>--<variant>` 等稳定类名。尺寸、色值、状态反馈统一写在组件 CSS，使用语义 token。组件 props 从原生属性或行为 primitive 推导，variant 类型从 recipe 推导，避免在 props、文档和样式中各维护一份枚举。

## 决定状态的归属

先写状态表，测试跟随可观察行为。只列组件实际拥有的状态：

| 场景 | 状态所有者 | DOM 契约 |
| --- | --- | --- |
| Button 正常 / disabled | 调用方 | 原生 button 禁用；链接模式阻止交互并表达不可用 |
| Button loading | 调用方 | `aria-busy`、`data-loading`；点击和子 handler 不触发 |
| Input 输入 / readonly / required | 原生控件与调用方 | 保留值、事件、ref 和表单提交语义 |
| Checkbox 选择与表单复位 | 组件或调用方 | 可见状态与 FormData 一致；尊重 reset 取消，校验焦点落可见控件 |
| TextField invalid | 调用方 | `aria-invalid`；错误显示时才加入 describedby |
| Dialog 打开 / 关闭 | Radix 或调用方 | 关闭语义、焦点回退和滚动边界按真实能力验收 |

复合组件先确定 ref 与 `className` 落在哪个元素。TextField 的两者都落 input，`classNames.root` 才是外壳。显式属性优先于组件内部默认值；事件合并要明确 `preventDefault` 是否取消内部行为。

公开类型必须与这些 DOM 归属一致。Button 的原生模式使用 `HTMLButtonElement`，asChild 模式使用 `HTMLElement`，不能把链接事件声明为 button 事件。类型检查同时覆盖合法的 anchor ref 和应被拒绝的原生按钮 anchor ref；运行测试验证合并后的实际节点与卸载清理。

功能圆角最大 16px；浮起只使用规定的软影。普通 hover、loading、面板切换通过颜色、描边、透明度反馈，遵守减弱动态。迁移一个 legacy 单元不等于其他旧组件也满足了这些规则。

## 登记公开入口

在 `component-manifest.json` 的 `components` 中登记 `name`、`status`、`entry`，以及实际存在的 `css`、`documentation` 路径。已有单元迁移时修改原条目，不能保留重复导出。

```bash
# 在仓库的 web 目录执行
pnpm --filter @violet/ui sync
pnpm --filter @violet/ui check
```

`sync` 更新由清单派生的入口与清单文件；阅读 diff，确认没有带入不相关组件。`check` 只读检查，适合提交前与 CI 使用。根入口继续服务已有消费方，叶子入口用于明确取用，`@violet/ui/legacy` 标明尚未重建的单元。

如果导出 recipe，将它接入 `@violet/ui/variants`，该入口只允许样式依赖。不要让 recipe 导入组件 barrel。CSS 汇集入口和叶子入口从相同源文件构建；组合组件 CSS 需引入它使用的子组件 CSS，不能要求消费方猜测依赖。纯 CSS 应能直接加载，不依赖宿主扫描组件 TSX。

## 用同源示例解释 API

一个示例文件同时提供预览与复制代码。文档页按已有 `CodeCard` 模式引入：

```tsx
import { TextFieldBasicDemo } from "./examples/text-field/basic";
import basicSource from "./examples/text-field/basic.tsx?raw";

<CodeCard code={basicSource} language="tsx" lineNumbers>
  <TextFieldBasicDemo />
</CodeCard>
```

示例必须有真实名称、初值和回调。只展示组件支持的能力；Input 不支持异步请求，就把请求状态留在示例消费方。Button 至少展示动作、禁用、loading 与链接；TextField 展示说明、错误、原生字段属性和受控值。

文档的权威正文留在包内 `docs/`；旧站点需要暂时展示时，wrapper 直接 raw import 包文档，不能复制第二份正文。当前 integration 示例遵循已有 CodeCard 模式；未来更换文档宿主时，保留契约与同源示例，不依赖旧站点设施。

## 跑源码检查与真实消费者

先运行包自己的检查，不借站点 alias 掩盖依赖：

```bash
pnpm --filter @violet/ui check
pnpm --filter @violet/ui typecheck
pnpm --filter @violet/ui test
pnpm --filter @violet/ui build
pnpm --filter @violet/ui check:dist
pnpm --filter @violet/ui consumer
```

`consumer` 将构建产物打包为真实 tgz，在仓库外的临时项目安装，再检查公开类型、SSR、Vite 构建和入口 bundle 依赖图。工作区 import 成功只能证明源码消费；dist 文件存在只能证明构建产物生成。不能用两者替代装包验收。

手工交付给另一个项目时运行：

```bash
pnpm --filter @violet/ui pack --pack-destination /tmp
# 在目标项目安装实际生成的 tgz 路径
pnpm add /tmp/violet-ui-0.1.0.tgz
```

版本号以 package.json 和 pack 输出为准。包尚未发布 npm，文档不使用未存在的 registry 安装流程。

行为测试按组件能力取用：Button 检查 Enter/Space、disabled/loading、asChild 子 handler 和 object/callback ref；TextField 检查可访问名称、ID 去重、原生 onChange、FormData/reset、受控更新和 SSR hydration。真实浏览器检查明暗主题、焦点、错误与减弱动态；弹层增加焦点回退和点击外部。测试断言用户能观察的契约，避免只复述内部实现。

当前 integration 宿主改动还要运行根 Makefile 的 `make web-lint`、`make web-typecheck` 和相关 `make web-test`。检查结果记录实际执行的命令与限制，由独立 reviewer/verifier 复核，作者不自行批准交付。

## 改完同步哪些文档

按 `docs/agents/docs-map.md` 核对根 README、web README、包 README 与 AGENTS.md。新单元进入清单后同步成熟度与用法页；架构改变时同步 `violet-ui` skill。组件代码与相应文档一起提交，使用中文 Conventional Commit，本地 commit 后不推送。

一个单元只有在行为、视觉、公开入口、示例和独立消费者均有证据时才改为 foundation。某个框架、浏览器或交互尚未验证，直接写出范围，不能用“完整支持”补上缺失的检查。
