# musicctl 重构设计(2026-07)

## 背景

musicctl 从接口调试工具起步,77 个命令挤在单个 `cmd/musicctl/main.go`(~1300 行),
手写 usage 已发生漂移,switch 平铺无法承载后续实用功能。本次重构为后续
"调试 + 脚本化工具 + TUI 播放器"的终态定位打底。

## 决策(2026-07-17 与仓库 owner 确认)

1. **框架:Cobra**。kubectl/gh/Hugo 同款,自动 usage、帮助分组、flag 校验、
   shell 补全,消灭手写 usage 的漂移问题。
2. **命令树:分组子命令**。`musicctl playlist tracks --id` 取代平铺的
   `musicctl playlist-tracks --id`。工具未发布,不做旧命令兼容别名。
3. **定位:调试 + 脚本化工具,终态含 TUI 播放器**(参考 go-musicfox)。
   命令层只依赖 `internal/cli/kit` 的薄封装,未来 TUI 可直接复用
   `internal/netease` 的 engine/endpoint,互不阻塞。
4. **节奏:一次性搬迁**。行为保持不变的纯重构:输出仍为 protojson JSON,
   写操作仍 y/N 确认,会话文件格式与路径(`~/.musicctl/session.json`)不变。

## 目标结构

```
cmd/musicctl/main.go            # 仅 cli.Execute()
internal/cli/
├── root.go                     # 装配所有命令组
├── kit/                        # 命令层共享工具包
│   ├── client.go               # engine 封装:Exec/RawDo
│   ├── session.go              # 会话文件读写(env 优先)
│   ├── output.go               # protojson 输出
│   └── confirm.go              # 写操作 y/N 确认
├── auth/                       # login/logout/login-status/send-captcha/login-cellphone
├── song/  album/  artist/      # 每领域一个包,暴露 NewCommand(kit) *cobra.Command
├── playlist/  user/  search/
└── recommend/  fm/
```

每个领域包只 import kit,kit 不 import 领域包,root 单向装配,无循环依赖。

## 命令树映射(节选)

| 旧 | 新 |
|---|---|
| `login` / `logout` / `login-status` | 保持顶层不变 |
| `send-captcha` / `login-cellphone` | 保持顶层不变 |
| `song-detail --id` | `song detail --id` |
| `album --id` | `album detail --id` |
| `artist-top --id` / `top-artists` | `artist top-songs --id` / `artist toplist` |
| `playlist-highquality-tags` | `playlist highquality-tags` |
| `daily-recommend-songs` | `recommend daily-songs` |
| `personal-fm` | `fm` |
| `search --keyword` | `search --keyword`(同时是分组,子命令 suggest/hot/...) |

完整映射见 `internal/cli/root.go` 装配代码。

## 后续方向(不在本次范围)

- 输出层:人类可读表格 + `--json` 全局 flag、退出码规范、TTY 检测
- 写操作 `--yes` 跳过确认
- 配置迁移到 `os.UserConfigDir()` + `config.toml`(默认音质等)
- shell completion、goreleaser 发版
- 实用功能:下载、歌词滚动、收藏批量管理
- TUI 播放器(bubbletea),独立 `internal/tui` 包
