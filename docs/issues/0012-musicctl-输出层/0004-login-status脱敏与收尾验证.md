# Issue-0004:login-status 脱敏 + 收尾验证与文档

## Parent

PRD:`../../prd/0012-musicctl-输出层.md`(user stories 8,9)

## What to build

凭证脱敏与 Phase A 收尾。

- `login-status` 人类模式:cookie 各段只保留首尾 8 字符,中间省略,附提示「完整值用 --json」;JSON 模式保持全量
- 全量真机验证矩阵并记录结果:
  - 表格渲染(search 多段/playlist tracks/单对象键值)
  - 管道自动 JSON + `jq` 消费
  - `--yes` 免交互写操作(真实会话)
  - 非 TTY 写操作退出码 2
  - 未登录退出码 3 / flag 错误退出码 2 / 接口错误退出码 1
- 更新 `docs/musicctl-roadmap.md`:Phase A 各项勾选完成状态
- 更新 `docs/issues/README.md` 登记 0012 目录

## Acceptance criteria

- [x] login-status 人类模式不含完整 cookie,JSON 模式含完整 cookie
- [x] 验证矩阵全部通过并记录在 issue 文件 Comments 区
- [x] roadmap Phase A 标记完成
- [x] issues README 登记(发布 issue 时已登记)

## Blocked by

- Issue-0001、Issue-0002、Issue-0003

## Comments

**2026-07-17 完成**(commit 7a48fa56)

脱敏实现:kit.MaskCookie 分段保留首尾 8 位、短值整体打码;
login-status TTY 键值对脱敏输出 + stderr 提示,--json/管道完整 protojson。

**真机验证矩阵**(全部实测通过):

| 项 | 结果 |
|---|---|
| 表格渲染(search 多段/playlist tracks/highquality/artist toplist) | ✅ CJK 对齐 |
| 单对象键值对(song detail 嵌套展开) | ✅ |
| 管道自动 JSON + jq 消费 | ✅ `search hot \| jq` 取到热词 |
| `--yes` 免交互写操作(song trash) | ✅ exit 0 |
| 非 TTY 写操作无 `--yes` | ✅ exit 2 |
| 未登录(user account 无会话) | ✅ exit 3 |
| flag 错误(缺必填/未知 flag) | ✅ exit 2 |
| 接口错误(无效 id) | ✅ exit 1 |
| login-status TTY 脱敏 / --json 完整 | ✅ |

**Phase A 完结**:4 个 issue 全部交付。backlog:like 接口对当前账号恒返回
code=-460(网易云风控,非 CLI 问题),留待后续观察。
