# musicctl 播放屏直接重写为 bubbletea 全屏形态(supersede Phase D 小验证步骤)

roadmap Phase D 原定两步:第一步用 bubbletea 列表选择器做小验证,第二步才谈全屏播放器。owner 决策(2026-07-24 访谈):跳过列表选择器,直接把 `song play` 的手写 ANSI 状态栏重写为 bubbletea v2 全屏播放屏(charm.land 设计语言:封面取色/歌词舞台弹簧滚动/浮层弹出,PRD-0016),技术栈验证在重写中一并完成。手写 ANSI UI 删除,不做 flag 并存。

## Considered Options

- **按 roadmap 先列表选择器小验证**——否决:小验证不解决「播放屏是手写 ANSI、视觉形态到顶」的核心痛点;owner 对界面形态已有明确期望(charm.land 设计语言 + oh-my-pi 式图片协议矩阵),小验证变成额外一圈。
- **ANSI 旧 UI 与新 TUI flag 并存**——否决:工具未发布,不做兼容形态(沿 CLI 重构「不做旧命令兼容别名」同一惯例);双 UI 路径双倍维护。
- **直接做 Phase D 第二步全屏播放器**(队列/菜单/浏览)——否决:范围过大,roadmap 原定单独立项;播放屏重写是全屏播放器的地基(`internal/tui` 包),先行合理。

## Consequences

- `internal/tui` 包建立,Phase D 第二步全屏播放器复用其 model/组件基础。
- bubbletea v2 + lipgloss + harmonica + bubbles 进入 go.mod(charmbracelet 自家 crush 生产验证的 v2,非 v1)。
- 封面渲染采用 oh-my-pi 式协议矩阵(kitty → iterm2 → 半块字符画)与 **transmit-once, place-many** 规则;`MUSICCTL_IMAGE_PROTOCOL` env 覆盖对齐 `PI_FORCE_IMAGE_PROTOCOL`。
- roadmap Phase D 段已同步标注第一步 superseded;第二步(全屏播放器)仍待单独立项。
- 裸跑 onboarding 行为不变(CONTEXT.md 工具型定位不受本决策影响);`musicctl tui` 入口仍属第二步。
