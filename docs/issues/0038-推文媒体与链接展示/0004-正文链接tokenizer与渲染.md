# T4 [tweets] 正文链接 tokenizer 与渲染

前置：无（纯前端，可与 T1/T2 并行）。

## 目标

通用 URL tokenizer（`shared/lib/linkify`）+ `TweetContent` 接入：URL 渲染为可点击链接，与 `#话题#`、`[emote]` 混排正确切分。

## 改动点

- `web/src/shared/lib/linkify/`：纯函数 tokenizer——识别 `http(s)://`、`www.`、裸域名（常见 TLD 白名单）；Unicode/中文路径；尾部标点剥离（`.` `,` `;` `!` `?` `)` `）` 等，左括号包裹启发）；输出 `{url, display}` 段，display 为超长截断形态（头尾保留中间省略，约 60 字符阈值）。配套安全归一化：补全协议、仅 http/https。
- `web/src/features/tweets/ui/TweetContent.tsx`：切分优先级 URL > `#话题#` > `[emote]`——先扫 URL，再在非 URL 文本段跑 hashtag/emote，避免 URL fragment 的 `#` 被话题吞并。链接 `<a target="_blank" rel="noopener noreferrer nofollow">`，阻止卡片导航冒泡。
- 后端 Go 版提取规则常量与前端保持一致（本 ticket 先前端，T2 落地时对齐为共享规格说明）。

## 验收

- tokenizer 单测样本：中文路径、尾部句号/右括号剥离、`#话题#` 与 `https://e.com/a#frag` 混排、裸域名 TLD 白名单内外、超长截断、`javascript:` 不识别。
- TweetContent 测试：链接可点、话题/表情共存、纯文本不变。
- `web-test`、`web-typecheck`、Biome 全绿。
