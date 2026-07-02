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
