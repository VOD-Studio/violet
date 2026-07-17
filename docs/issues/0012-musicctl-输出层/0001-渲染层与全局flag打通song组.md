# Issue-0001:渲染层 + 全局 flag + 退出码(song 组打通)

## Parent

PRD:`../../prd/0012-musicctl-输出层.md`(user stories 1,3,4,5,8,11;Implementation Decisions 全部)

## What to build

输出层子弹头:渲染器 + 全局接线 + song 命令组端到端打通。

- kit 新增通用渲染器(protoreflect 纯函数,proto.Message → string):
  - 含 repeated message 字段 → 每非空字段一段 tabwriter 表格(多段带小标题);列取标量字段,枚举显示枚举名,嵌套 message 取 name 字段 join,超宽截断
  - 无 repeated 字段 → 键值对;嵌套/repeated 子结构退化紧凑 JSON
- kit 挂全局状态(JSON/Yes)+ TTY 检测(x/term,可注入替身)
- kit 新增 `RenderExec`(三态分派:JSON 模式或非 TTY → protojson;否则表格/键值)
- root 注册 persistent flags `--json`/`--yes` 绑定 kit;`Execute` 按错误类型映射退出码(2=pflag 用法错误,3=ErrNotLogin,1=其余)
- `RequireLogin` 改返回 `ErrNotLogin` 哨兵错误
- song 命令组全部 `PrintExec` → `RenderExec`,验证端到端

## Acceptance criteria

- [ ] 渲染器 golden 测试:单段表格/多段表格/键值对/嵌套取 name/枚举显示/截断/空 repeated 跳过
- [ ] TTY 替身注入,三态分派有单测
- [ ] `--json` 时输出与旧 PrintExec 完全一致(protojson)
- [ ] `song detail --id` TTY 出键值对,管道自动 JSON
- [ ] 未登录命令退出码 3,flag 错误退出码 2,接口错误退出码 1
- [ ] song 组全部命令真机 smoke 通过
- [ ] 其余命令组未接入,行为不变(仍 protojson)

## Blocked by

None - can start immediately
