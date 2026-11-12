# CodeBlock

阅读源码、页内修改与执行输出共用一个代码块。`CodeBlock` 不请求执行服务，也不保存草稿或本机偏好；宿主负责策略、执行和持久化。

```tsx
import { CodeBlock, InlineCode } from "@violet/ui";
import "@violet/ui/styles.css";

<CodeBlock
  code={'const message = "Hello";\nconsole.log(message);'}
  language="typescript"
  filename="hello.ts"
  highlightedLines={[2]}
/>
<InlineCode>message</InlineCode>
```

只读形态使用 `figure > figcaption + … + pre > code`。超过 12 行默认折叠，`collapseLines={0}` 用于需要完整展开的文件预览；展开后可收起，折叠只裁切显示，不删除源码。行号从 1 开始，不进入复制结果和读屏内容。行号区按设计稿保留 40px 内容宽与 14px 右间距，阅读态 Tab 宽度为 8。`className`、原生属性和 `ref` 落在 `figure`。顶栏常规高度为 40px；宿主窄于 26rem 时允许换行，避免已修改标记、还原与运行动作被裁剪。

服务端直接输出完整、安全转义的源码。近视口后才启动共享 Shiki Worker，语法文件按语言加载；等待、失败与源变更都先保留正确的纯文本，旧高亮不会覆盖新源码。关键字、字符串、注释与函数使用语义色，不因四季或明暗切换重新高亮。宿主可通过 `--font-mono` 提供 Maple Mono；组件包不带站点字体。

代码块与 `InlineCode` 自带 `not-prose` 排版边界。放入 Typography 的 `prose` 正文时，宿主的 `pre` 黑底、`figcaption` 间距与行内代码伪元素不会覆盖单元的语义材质，也不会添加反引号。

发行包自带可重定位的 Worker、按需语法 JSON 与 WASM。消费方的 Vite 负责收集资源，无需复制文件到 `public` 或配置站点绝对路径；开发预构建与生产构建使用同一安装包。

## 接入运行器

提供 `run` 后使用真实 CodeMirror 与 Vim，回调收到读者当前草稿，不是初始 `code`。修改仅在当前实例；改变 `code` 会采用新的原始源码。「还原」恢复该源码，不写入文章。

```tsx
<CodeBlock
  code={source}
  language="python"
  vimEnabled={vimEnabled}
  onVimEnabledChange={setVimEnabled}
  run={{
    availability: { status: "ready" },
    running,
    onRun: execute,
    output,
    result,
  }}
/>
```

宿主在 `execute(code)` 开始时清空旧输出并设置 `running`，按实际到达顺序追加 `{ kind: "stdout" | "stderr" | "info", text }`。分片不等于整行：组件保留分片本身的换行，不额外补换行。终态只在执行结束后传入；未知退出码传 `null`，不能伪造为 0。请求失败使用 `{ status: "failed", message }`。

`availability.status` 表达 `ready`、`loading`、`disabled`、`language-disabled`、`error` 五态。错误态还须提供 `message` 与 `onRetry`。非 ready 或运行中不会调用 `onRun`；快捷键同样受此约束。后端仍须独立鉴权和检查策略。

`CodeBlockOutput` 可单独放入宿主自有的编辑器外壳，接收相同的 `running`、`output`、`result`。未运行时保留折叠的「输出」开关，展开后说明尚未运行；开始新运行时自动展开，之后到达的分片和完成结果不会打断用户的手动收起。内容为 `role="log" aria-live="polite"`，完成与非零退出汇总使用次级色，stderr、超时、OOM 和服务错误使用危险色；展开时淡入 180ms，新增片段不动画。

## 键盘与偏好

- 默认 Vim 开启；不传受控值时由组件维护。跨重载偏好由宿主连接 `vimEnabled` / `onVimEnabledChange`，包不读取 localStorage。
- 编辑区为多行 textbox。Tab / Shift+Tab 离开编辑区；Ctrl+Enter / ⌘↵ 在普通、插入、可视、命令与搜索模式优先触发运行。
- `:` / `/` 使用 Vim 原生命令输入并替换整条状态栏。`:12` 跳到第 12 行，`:w` 说明修改仅保留本页，不冒充已保存文章。完成搜索后显示真实匹配位置与总数，`n` / `N` 更新位置，`:noh` 清除搜索反馈。
- NORMAL 光标静止，插入与命令光标每秒闪烁；模式变化以中文播报。关闭 Vim 不显示模式，重新开启从 NORMAL 开始，保留内容与历史。
- 阅读态复制按钮保留图标与文字；成功后播报「已复制」，1600ms 后恢复「复制」；失败不会显示成功，不产生 toast。编辑态顶栏按设计稿只保留 Vim 与运行操作，修改后增加还原。
- 系统减弱动态与祖先 `data-motion="reduce"` 都停用光标闪烁、旋转与输出淡入。

## 原生 HTML 与编辑器适配

样式入口为 `@violet/ui/components/code-block.css`。原生 `figure.v-code-block`、`figcaption.v-code-block__header`、`pre.v-code-block__pre > code` 可供 Tiptap 等宿主编辑器复用，lowlight 的 `.hljs-*` 在该外壳内使用同一语义配色。没有 React 的页面仍能呈现原始代码；交互动作需宿主自行提供。

CodeMirror 适配样式仅作用于 `.v-code-block`；其未分层规则用于覆盖引擎注入的未分层样式，不改变站点其他编辑器。完整消费示例与真实 tarball 验收在 `fixtures/consumer/`，陈列室 `/ui?open=code-block` 包含阅读、Vim、策略五态和执行结果。陈列室输出流是明确标注的交互演示，不执行用户代码；文章的运行器接入真实执行服务。
