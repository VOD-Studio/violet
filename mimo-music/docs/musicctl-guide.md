# musicctl 使用手册

> musicctl 是 [mimo-music](../README.md) 的命令行入口——网易云接口调试与实用工具。
> 直连 engine + endpoint 声明,不经 gRPC/gateway。

本手册只讲**上手流程**(安装/登录/常用操作)。具体命令的完整参数(所有 flag、子命令)
请查 `musicctl <命令> --help`,或参考[全命令文档](cmd/)。

---

## 安装

需要 Go 1.25+:

```sh
go install github.com/VOD-Studio/mimo-music/cmd/musicctl@latest
```

安装后 `musicctl` 在 `$GOPATH/bin`(确保在 `PATH` 里)。`--version` 可查构建信息
(commit / 构建时间);若显示 `(devel, no vcs info)`,说明是 `go run` 而非 `go install`
构建,bug report 前请用 `go install` 重新安装以嵌入 commit。

环境自检:`musicctl doctor` 逐项检查版本/会话/补全/音频后端状态。

## 登录

登录态接口(播放/下载/红心等)需先登录。两条路径:

```sh
musicctl login              # 扫码登录(推荐,App 扫码)
musicctl login-cellphone    # 手机号 + 短信验证码(先 musicctl send-captcha)
```

- 登录后 cookie 落本地配置目录的 `session.json`(macOS `~/Library/Application Support/musicctl/`、
  Linux `~/.config/musicctl/`、Windows `%AppData%\musicctl\`),后续命令自动携带。
- 临时换号:设环境变量 `NETEASE_COOKIE`,优先级高于会话文件。
- 查看当前登录态:`musicctl login-status`;登出:`musicctl logout`。

## 常用操作

### 搜索

```sh
musicctl search 周杰伦                 # 关键词可作位置参数(≡ --keyword 周杰伦)
musicctl se 周杰伦                     # 别名 se = search(见下方别名表)
```

### 播放

```sh
musicctl song play --id 347230         # 播放(交互式,键盘控制)
musicctl song play 347230              # 位置参数(≡ --id 347230)
musicctl pp 347230                     # 别名 pp = song play
musicctl song play --id 347230 --lyric # 带歌词同步滚动
```

播放时键盘:`空格`暂停、`←/→`∓10s、`↑/↓`音量、`q`退出。headless/无音频环境
用 `song download` 替代。

### 下载

```sh
musicctl song download 347230          # 下载单曲(带元数据)
musicctl dl 347230                     # 别名 dl = song download
musicctl playlist download 1           # 下载整个歌单(批量+并发)
musicctl song download 347230 --level 3   # 指定音质:1标准 2较高 3无损 4Hi-Res
```

### 复听(召回池)

播放/下载/搜索过的歌会自动进入**召回池**。补全与 `recent` 都读它:

```sh
musicctl song play --id <TAB>          # 按 Tab 列出最近听过的歌(带歌名/艺人)
musicctl recent                        # 列出召回池最近条目(按 frecency 排序)
musicctl recent --limit 5              # 只看前 5
```

召回池是 append-only JSONL(`history.jsonl`,与 session 同目录),可被 `grep`/`tail` 直读。

## 别名(跨级简写)

高频命令有双字符别名,`--help` 与裸跑引导里也列出:

| 别名 | 等价于 |
|---|---|
| `pp` | `song play` |
| `dl` | `song download` |
| `pll` | `playlist download` |
| `se` | `search` |
| `rd` | `recommend daily-songs` |
| `whoami` | `login-status` |

别名支持位置参数与补全(`pp 347230`、`pp --id <TAB>` 都可用)。

## 裸跑引导

直接敲 `musicctl`(无参)会给场景化引导:未登录给登录引导;已登录按时段/周末
推荐该跑的命令(晨推日推、晚推 FM、夜推复听)。输出走 stderr,不污染管道。

## 位置参数

所有单值 `--id` 命令和 `search --keyword` 都接受位置参数(`song play 347230` ≡
`--id 347230`)。同时给位置参数和 `--id` 会报歧义错。`--uid`/`--tracks` 等多值
flag 不支持位置参数。

## 补全

Tab 补全(`--id <TAB>` 列召回池候选、`--level <TAB>` 列枚举)只走本地缓存,
**绝不触发网络查询**。安装 shell 补全:

```sh
musicctl completion zsh > ~/.zsh/completions/_musicctl   # 或 bash/fish/powershell
```

## help 分组

`musicctl --help` 按组展示(快速上手/账号/音乐/发现/工具);`--help-verbose`
平铺列出全部命令。

---

## 命令参考

- **流程与上手**:本手册。
- **全命令参数**:每命令的 `--help`(命令语法的唯一真相),或仓库内生成的
  [docs/cmd/](cmd/) 参考(由命令树生成,与安装版本同步)。
- **设计背景**:[musicctl-cli-design.md](musicctl-cli-design.md)、[roadmap](musicctl-roadmap.md)。

> agent 友好:`--help` 是命令语法的唯一真相。skill 或外部文档一律指向 `--help`
> 或生成参考,不要复制命令手册——复制即第二份真相,必然腐烂。
