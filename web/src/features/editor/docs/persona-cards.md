# 人物与语义内容卡片

人物提及和内容卡片从 Markdown 源码模式输入。它们沿用行内代码或围栏代码块载体，保存后在文章页转换为可交互组件；普通代码块仍按原样高亮。

卡片按围栏语言识别，识别规则登记在 `web/src/shared/ui/article-embeds/registry.ts`：内置的对话、项目引用、链接摘要、推文与社交入口已登记；新增卡片由所属 feature 调用 `registerArticleEmbed` 登记语言、配置校验与组件，并加进 `web/src/register-article-embeds.ts`（服务端与客户端都执行），不需要改 `shared` 里的分派代码。配置无效时文章里显示「无法解析 … 卡片配置」与原文，其余内容照常渲染。

富文本模式里，卡片的围栏块显示为代码块，代码下方实时预览文章里的渲染结果（停止输入后刷新，配置无效时同样显示降级提示）；语言下拉里显示卡片的名称。声明了插入入口的卡片（如[路线图](#项目路线图卡片与画布)）还能从 Slash 菜单「嵌入」组用弹层插入，代码块头部另有「编辑…」按钮，重新打开同一个弹层，回填当前参数，更新后替换整块。

> 本章站内页的所有示例围栏都直接渲染为对应组件，不是外层 Markdown 代码示意。

## 行内人物提及

- `` `persona` ``：显示当前公开人设的名字。
- `` `persona:瑠爱` ``：用冒号后的文字作为行内称呼，资料卡仍取当前公开人设。
- 鼠标悬停或键盘聚焦时显示头像、角色定位和简介；点击资料卡进入 `/persona`。
- 当前没有公开人设时降级为普通文字，不发起无意义的资料请求。

## 对话与 GitHub 项目引用

````markdown
```dialogue
{"profile":"active","side":"left","text":"那个……要一起看球吗？"}
```

```dialogue
{"speaker":"访客","side":"right","text":"当然。"}
```

```github
{"repo":"VOD-Studio/violet","description":"个人创作和读者社区。","language":"TypeScript","stars":128,"forks":18}
```
````

- `dialogue.profile` 取值 `active` 时复用当前公开人设；也可用 `speaker` 和 `avatar` 写独立角色。
- `side` 只接受 `left` 或 `right`。
- `github` 使用项目专用引用：仓库名与所有者组成身份区，头像由 GitHub 提供；简介、语言与统计沿阅读顺序展示，不复用通用链接预览。它是作者保存的项目快照，不在阅读时请求 GitHub 元数据；`description`、`language`、`stars`、`forks` 可省略，统计值 `0` 正常展示。仓库名和右上角 GitHub 标识可打开项目，`href` 可覆盖默认地址。
- 点击 Star 统计进入 GitHub 仓库页操作，点击 Fork 统计打开 GitHub 的创建 FORK 页面；登录与确认由 GitHub 完成，本站不读取读者的 GitHub token，不将保存的统计快照伪装成实时结果。

### 对话实际展示案例

以下两轮对话直接显示为左右气泡。左侧复用当前公开人设；右侧使用独立发言人，不提供头像时显示名字首字。

```dialogue
{"profile":"active","side":"left","text":"那个……要一起看球吗？"}
```

```dialogue
{"speaker":"访客","side":"right","text":"当然。"}
```

### GitHub 实际展示案例

以下围栏直接渲染为项目卡片。元数据于 2026-10-05 从 GitHub 公开 API 读取；统计是保存时的快照，不代表实时数值。

**基本引用：只提供仓库名称。**

```github
{"repo":"VOD-Studio/violet"}
```

**完整引用：简介、语言、星标、派生数与显式链接；派生数为 0 时仍展示。**

```github
{"repo":"VOD-Studio/violet","description":"全栈博客平台 · Go 后端 + React 前端，内置 MCP server 供 AI agent 读写文章","language":"TypeScript","stars":3,"forks":0,"href":"https://github.com/VOD-Studio/violet"}
```

## 链接、X 推文与社交链接组

````markdown
```link-preview
{"url":"https://example.com/story","title":"文章标题","description":"一段简短摘要。","image":"/uploads/cover.webp","site":"Example"}
```

```tweet
{"id":"1728987032779694397"}
```

```tweet
{"url":"https://x.com/GenshinImpact/status/1728987032779694397"}
```

```tweet
{"url":"https://x.com/example/status/1","author":"瑠爱","handle":"@wakasumi_rua","text":"月光刚好落在书页上。","avatar":"/uploads/avatar.webp","date":"2026 年 9 月 7 日","verified":true}
```

```social-links
{"links":[{"label":"GitHub","href":"https://github.com/VOD-Studio","handle":"VOD-Studio","icon":"github"},{"label":"来信","href":"mailto:hello@example.com","handle":"hello@example.com","icon":"email"}]}
```
````

- `tweet` 支持两种模式：只写 `id` 或 X / Twitter 原文 `url` 时，客户端通过同源服务加载 FxTwitter 完整正文，并补充 X 官方认证与组织关联信息；填写 `author`、`handle`、`text` 等完整字段时，直接展示随文章保存的快照，不请求来源接口。标识必须写成字符串，避免长 ID 丢失精度。
- 动态引用支持原作者、正文链接、照片、视频、单层引用、发布时间与来源统计。点赞和回复在新标签页打开 X 的真实操作入口，不修改本站计数；姓名、账号和组织标识分别导航。来源加载失败时保留原文入口和手动重试；明确不可用、已删除或私密的结果不伪装成可阅读内容。
- ID、URL 引用与保存快照的正文默认显示 6 行；超出时提供「展示更多／收起」，嵌套引用独立折叠和展开，图片、视频与统计保持展示。`"maxTextLines": 4` 可调整正文行数，`"maxTextLines": 0` 展示全文；只接受非负整数。
- `link-preview` 保持静态快照。上述组件都不加载第三方脚本或 iframe，但配图与视频会请求其资源地址。动态推文的数据源是外部服务，受其可用性与限流影响；需要长期固定内容时使用快照模式。
- 社交链接组支持 1–8 项；`icon` 可选 `github`、`x`、`email`、`website`、`rss` 或 `video`，省略时按链接推断。
- 链接只接受站内路径、`http(s)`；社交链接额外接受 `mailto:`。图片只接受站内上传路径或 `http(s)`。
- JSON 无效或字段不合规时，文章其余内容照常渲染，错误位置显示可读的配置提示。

### X 推文实际展示案例

本组只选用 `@GenshinImpact`、`@thsottiaux` 与 `@NintendoAmerica` 三个账号的真实公开推文，嵌套引用也限于这三个账号。ID、作者、认证类型、正文和媒体已于 2026-10-05 通过 FxTwitter 接口核对。动态卡片读取来源当前结果，认证及组织关联标识以实际返回为准，不按账号名称猜测或补造。以下标题只描述已确认的内容类型。

**短文本与个人认证：189 字符正文，无附件；引用作者自己的另一条无附件推文。**

```tweet
{"id":"2061106703446450392"}
```

**长文本与多段正文：1,808 字符，无附件；正文默认显示 6 行，可展开与收起。引用作者自己的另一条无附件推文独立折叠和展开。**

```tweet
{"id":"2071740419030053227","maxTextLines":6}
```

**较长多段正文：520 字符的公告，附 1 张图片。**

```tweet
{"id":"1949667378637214138"}
```

**单张图片：正文介绍配合 1 张角色图片。**

```tweet
{"id":"1376851698350751751"}
```

**四张图片：4 张壁纸组成的图片组。**

```tweet
{"id":"1728987032779694397"}
```

**三张图片：3 张图片组成的图片组。**

```tweet
{"id":"2070358391411642467"}
```

**视频：附 1 段约 142 秒的视频。**

```tweet
{"id":"1879879950854926422"}
```

**官方认证与正文链接：附 1 张图片及正文链接。**

```tweet
{"id":"1907788934874062911"}
```

**保存正文快照：固定保存另一条无附件推文的作者、完整正文、头像和 UTC 发布时间，不请求推文数据接口。** 头像仍是外部图片资源；此例不填写认证标记，来源当前的认证与组织信息请看动态案例。

```tweet
{"url":"https://x.com/thsottiaux/status/2062329981548802523","author":"Tibo","handle":"@thsottiaux","text":"Hi. Over the last 24 hours we had three separate small incidents that affected Codex reliability. Those are three too many and we are taking active steps for them to not reproduce.\n\nI have reset usage limits for Codex across all paid plans. May the tokens flow again.","avatar":"https://pbs.twimg.com/profile_images/2093807917833281537/2yBgpwVV_200x200.jpg","date":"2026-06-04 00:25:58 UTC"}
```

## 项目路线图卡片与画布

用 `roadmap` 围栏块引用站内项目的路线图。内容读取**阅读时**的当前公开数据，不保存快照。

````markdown
```roadmap
{"project": "kite", "item": 3}
```

```roadmap
{"project": "kite"}
```

```roadmap
{"project": "kite", "display": "canvas"}
```

```roadmap
{"project": "kite", "display": "canvas", "view": "graph", "item": 3}
```
````

| 参数 | 必填 | 说明 |
|---|---|---|
| `project` | 是 | 项目 slug（项目页地址 `/projects/<slug>` 的最后一段） |
| `item` | 否 | 条目编号（`#3` 的 3）。卡片里给出时是条目卡片、省略时是项目卡片；关系画布里给出时以该条目为根 |
| `display` | 否 | 形态：`card`（默认）是卡片，`canvas` 是可平移缩放的画布 |
| `view` | 否 | 画布内容，只用于 `canvas`：`board`（默认）是三阶段看板，`graph` 是关系图 |

- **条目卡片**：阶段、编号、标题、被阻塞标记、标签，以及子项进度或交付版本与完成日期；点击打开与项目页相同的只读详情。
- **项目卡片**：项目名、简介、进度概览（按阶段分段的进度条与计数）、正在进行与最近完成的条目，底部链接到项目页。
- **看板画布**：整个项目的三阶段看板与条目关系连线，固定高度；不接受 `item`。
- **关系画布**：条目仍按阶段分区，列内按关系重排以减少连线交叉，已完成的条目全部画出；给出 `item` 时只画与它直接或间接相连的条目并描边标出根，省略时画整个项目。
- **编辑器入口**：Slash 菜单「路线图」打开弹层，选项目、形态（卡片／看板画布／关系画布）与条目，下方实时预览，插入后即是上面的围栏块；手写围栏块同样在编辑区实时预览。已有的块点代码块头部的「编辑路线图」回填参数修改。
- 卡片在服务端渲染时直接输出内容，首屏不闪；画布只在浏览器里绘制，之前是同样高度的占位，文章不会跳动。
- 画布里普通滚轮仍滚动文章，Ctrl/⌘ 加滚轮缩放、拖动空白处平移；可全屏查看，Esc 退出。条目点开是只读详情。
- 项目或条目已删除时显示「… 不存在或已删除」的占位说明；读取出错时提示稍后刷新；文章其余部分照常渲染。
- 参数不合法（slug 写错格式、编号不是正整数、未知字段、未知形态、`view` 用在卡片上、看板画布带 `item`、不是 JSON）时显示「无法解析 roadmap 卡片配置」与原文。

## 文章末尾签名

文章设置侧栏打开「作者签名」后，公开文章会在正文末尾以文章作者的用户名落款。内置矢量笔迹在落款进入视口时书写；其他用户名显示为文字签名。系统的「减少动态效果」设置会关闭书写过渡。

Mizuki Miru、水月みる、水月见为系统内置笔迹，无需上传或调用 AI。账号 `Mizuki_Miru` 自动使用 Mizuki Miru 款；签名按名字、月牙、下划线顺序书写。文章落款与签名组件共用预设识别，未命中时仍显示作者名字。
