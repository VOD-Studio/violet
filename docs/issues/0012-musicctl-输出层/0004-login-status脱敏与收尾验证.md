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

- [ ] login-status 人类模式不含完整 cookie,JSON 模式含完整 cookie
- [ ] 验证矩阵全部通过并记录在 issue 文件 Comments 区
- [ ] roadmap Phase A 标记完成
- [ ] issues README 登记

## Blocked by

- Issue-0001、Issue-0002、Issue-0003
