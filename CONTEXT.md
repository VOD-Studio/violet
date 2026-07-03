# mimo-blog

全栈博客平台：Go (Chi) 后端 + React (Vite) 前端，PostgreSQL + Redis。本文档是项目领域语言的术语表，仅定义概念，不含实现细节。

## 认证（Authentication）

**Access Token**:
短期 JWT（默认 15m），承载用户身份，用于访问受保护资源。其 `exp` claim 是过期**权威判据**。
_Avoid_: session token, login token

**Refresh Token**:
长期 JWT（默认 7d），仅用于在 Access Token 过期后换取新的 Access Token。存于 Path 限定为 `/api/v1/auth` 的 HttpOnly Cookie，每个用户同一时刻只有**一个**有效（单槽白名单）。
_Avoid_: session token, long-lived token

**Token Envelope（信封）**:
承载 JWT 的 Cookie。Cookie 的 `MaxAge` 只是信封寿命，与 JWT 的 `exp` 是**两套独立**的过期机制——信封可先于或后于信件失效。信封先失效会导致"JWT 仍有效但取不到"，对 Refresh Token 致命（需重新登录）。
_Avoid_: cookie lifetime（混淆了信封与信件）

**CSRF Token**:
随机不可预测串，采用 double-submit 模式：非 HttpOnly Cookie（前端可读）+ `X-CSRF-Token` header 回传比对。保护**除 `/auth/refresh` 外**的所有写操作；refresh 自身被显式豁免。
_Avoid_: anti-forgery token（笼统）

**Token Rotation（轮换）**:
每次刷新都签发全新的 Refresh Token 并废弃旧的。用于限制单个 refresh token 的暴露窗口，并为"重用检测"提供基础。
_Avoid_: refresh token reuse（这是要检测的攻击，不是机制）

**Token Family（家族）**:
由同一次登录派生、经多次轮换形成的一条 refresh token 链。家族中任何**已被轮换掉的旧 token 再次出现**，几乎必然意味着 token 被窃取——标准响应是吊销整个家族。

**Refresh Token Revocation（吊销）**:
使一个仍有效的 Refresh Token 失效。触发场景：登出、改密码、重置密码、检测到重用。通过删除 Redis 白名单单槽实现。
_Avoid_: logout（吊销是机制，登出是触发场景之一）

## 文章导航（Article Navigation）

**TOC（Table of Contents）**:
文章目录，从正文 H2/H3/H4 提取的层级导航列表。在桌面端固定于文章左侧，在移动端通过浮动按钮呼出底部 Sheet。
_Avoid_: 目录树（在本文档域内与文件树、分类树混淆）

**Focus TOC**:
长目录下的 TOC 交互模式。目录面板始终围绕当前阅读位置展开一个"上下文窗口"：显示当前项的父级链、前后兄弟项、直接子项，其余节点折叠或隐藏。解决长目录中当前高亮项滚出可视区、用户失去方位感的问题。
_Avoid_: 智能目录、动态目录（过于笼统）

**上下文窗口（Context Window）**:
Focus TOC 中当前阅读位置周围被渲染出来的节点集合。由父级链、当前项、前后兄弟项、直接子项组成，并通过"智能截断"控制总长度。

**智能截断（Smart Truncation）**:
Focus TOC 控制上下文窗口长度的策略。当当前项前后存在大量兄弟项时，只渲染前后各 N 个兄弟，并用省略号 + 首尾锚点代替被隐藏的远处兄弟。

**阅读罗盘（Reading Compass）**:
Focus TOC 的隐喻：目录不是静态列表，而是随阅读滚动动态重新定位的导航仪器，始终指向"当前在哪"。

**已读指示（Read Indicator）**:
Focus TOC 中当前项之前的节点所呈现的"已完成"视觉状态，帮助用户快速感知阅读进度。
_Avoid_: 进度点、完成标记（未说明与 TOC 的关联）
