# PRD: musicctl 工程化与可发现性(守护/文档/补全/召回池/别名/onboarding/doctor)

> 状态:📋 待实现
> 关联:[CLI 路线图](../../mimo-music/docs/musicctl-roadmap.md)(Phase E)、[CONTEXT.md musicctl CLI 段](../../CONTEXT.md)、[作用域 tag ADR](../adr/mimo-music-musicctl-scoped-release-tags.md)、[输出层 PRD](./0012-musicctl-输出层.md)(已完成)、[实用功能 PRD](./0013-musicctl-实用功能.md)(已完成)
> 范围:musicctl 命令树守护、文档、补全与召回池、别名、裸跑 onboarding、doctor、recent、位置参数铺开。发布渠道整块延期(见 Out of Scope)。不改 endpoint/service 层,不新增 rpc 消费。

## Problem Statement

musicctl 已经「能用」(输出层 + 播放/下载/歌词全部落地),但日常使用的摩擦力集中在五处:

1. **没有发布渠道与版本号**:安装靠 `go install` 源码,没有预编译二进制,换机器/重装成本高;bug report 时连「你跑的哪个版本」都答不上来。发布渠道延期到整体架构定型后再做(命令树与接口面仍在按 357 蓝图扩张,现在固化的发布形态注定反复返工);本 PRD 先解决 `--version` 可读。
2. **发现性差**:全量命令平铺在 help 里;网易云 ID 是纯数字无语义,播过的歌想再播要重新 search 一遍;高频命令(`song play --id`)打字链长。
3. **裸跑无引导**:直接敲 `musicctl` 只出静态命令列表,新用户(以及一周没用的自己)不知道下一步该跑什么。
4. **无环境自检**:出问题时(没登录/网络断/headless 无音频)靠逐个命令试,bug report 缺第一手信息。
5. **工程护栏缺失**:命令树与 rpc 的对应靠人肉对齐;命令文档只有 `--help`,web 可搜索的参考不存在。

## Solution

按 roadmap Phase E 落地(发布渠道延期,仅保留 `--version` 轻量交付,见 Out of Scope),全部围绕「不碰接口层、只加 CLI 工程化」:

- **版本号**:`--version` 经 `debug.ReadBuildInfo()` 读 module version + vcs revision(`go install` 自动嵌入,零构建依赖);ldflags 注入 semver 随发布渠道一并延期。
- **守护测试**:proto 全量 method ↔ cobra 命令树双向 diff,已知缺口显式 allowlist。
- **文档双轨**:手写流程手册 + cobra 生成全命令参考(入库,freshness 守护)。
- **help 分组与补全**:help 按 5 组展示 + `--help-verbose` 列全部;`--id <TAB>` 走召回池补全,kit 层统一挂载。
- **召回池**:三类来源(主动/隐式埋点/远端快照)汇入 JSONL,frecency 排序,补全与 `recent` 共用。
- **别名**:双字符首发六枚(pp/dl/pll/se/rd/whoami),argv 重写实现。
- **onboarding**:裸跑智能引导(未登录→登录引导;已登录→时段/周末场景化推荐)。
- **doctor**:环境自检清单,渲染层输出,fail→exit 1。
- **recent**:列召回池内容(最近搜索/播放/下载)。
- **位置参数铺开**:按 CONTEXT.md 既定规则铺满所有单值 `--id` 命令与 `search --keyword`。

## User Stories

1. 作为用户,我希望 `musicctl --version` 报告明确的构建信息(module version + commit),以便 bug report 时说清环境。
2. 作为维护者,我希望新增 rpc 接入 CLI 时,忘记挂命令会立刻红(CI 守护),以便命令与接口一一对应不失守。
3. 作为维护者,我希望守护清单里的已知缺口(rpc 数与命令数之差)必须显式登记理由,以便例外是刻意的而非遗漏。
4. 作为新用户,我希望读一篇手册就能完成安装→登录→搜歌→播放的完整上手,以便不用逐个翻 `--help`。
5. 作为用户/agent,我希望在 web(GitHub)上搜索、链接 musicctl 任意命令的参考文档,以便分享与引用。
6. 作为维护者,我希望命令参考文档由命令树生成且有 freshness 测试,以便文档永不与实现脱节。
7. 作为用户,我希望 `musicctl --help` 按「快速上手/账号/音乐/发现/工具」分组展示,以便不被全量命令淹没。
8. 作为用户,我希望 `--help-verbose` 列出全部命令,以便需要时仍能穷举。
9. 作为用户,我希望敲 `musicctl song play --id <TAB>` 能列出我最近搜索/播放/下载过的歌(带歌名艺人),以便不用背纯数字 ID。
10. 作为用户,我希望 `--level`/`--area` 这类枚举 flag 按 TAB 直接列出取值,以便不查文档。
11. 作为用户,我希望补全候选项绝不触发实时网络请求(只走本地缓存),以便 Tab 不卡、不触发风控。
12. 作为用户,我希望播放/下载成功的歌自动进入召回池(无需任何显式操作),以便越用越好用。
13. 作为用户,我希望召回池候选把「常听的」排在「碰巧最近一次的」前面(frecency),以便夜间复听直达爱听的歌。
14. 作为用户,我希望召回池历史是 append-only JSONL(可用 grep/tail 直读),以便我自己也能检查和处理。
15. 作为用户,我希望补全在离线/弱网时仍然可用(磁盘兜底,后台异步更新),以便不被网络状态绑架。
16. 作为用户,我希望 `pp 347230` 等价 `song play --id 347230`、`dl` 等价 `song download`,以便高频操作两键完成。
17. 作为用户,我希望别名不出现在 TAB 补全里(保持候选干净),但在 `--help` 和裸跑引导里能看到别名表,以便发现它们。
18. 作为用户,我希望透过别名也能补全(`pp --id <TAB>` 照常出候选),以便别名不是二等公民。
19. 作为未登录用户,我希望裸跑 `musicctl` 给我登录引导,以便第一步不迷路。
20. 作为已登录用户,我希望裸跑按时段推荐该跑的命令(晨推日推/夜推复听),以便养成使用节奏;周末推荐与工作日不同。
21. 作为用户,我希望裸跑输出走 stderr 且秒出(本地读 + 后台异步,绝不阻塞),以便不污染管道、不卡在启动。
22. 作为用户,我希望 `musicctl doctor` 逐项告诉我版本/会话与网络/补全/音频后端的状态和修复指引,以便出问题一眼定位。
23. 作为脚本作者,我希望 doctor 存在 fail 项时 exit 1(headless 无音频这类 warn 不算),以便 CI 能拿它做环境守卫。
24. 作为用户,我希望 `musicctl recent` 列出最近的搜索/播放/下载,以便找回「刚才那首叫什么」。
25. 作为用户,我希望所有单值 `--id` 命令和 `search` 都接受位置参数(`musicctl song detail 347230`),以便少打字;同时给 `--id` 和位置参数时报歧义错,以便不猜。

> ⏸ 以下三条随发布渠道延期(见 Out of Scope),不进本期 ticket:
> - 作为用户,我希望从 GitHub Release 下载页拿到 musicctl 预编译二进制,以便不用装 Go 工具链。
> - 作为维护者,我希望打 `musicctl/v0.1.0` 这样的 tag 就自动产出 macOS(arm64/amd64)/Linux/Windows 二进制 + checksums,以便发布零手工。
> - 作为维护者,我希望 musicctl 的 tag 绝不触发博客生产部署,以便两条发布轨互不惊扰。

## Implementation Decisions

### ⏸ 发布(goreleaser + Actions)——延期到整体架构定型后

**延期决策**:发布渠道整块推迟到 musicctl 架构定型(命令树规模与接口面基本稳定)后再做。理由:接口按 357 蓝图持续扩张,命令树、help 分组、别名都在演化,现在固化发布形态只会反复返工;`go install` 对个人项目现阶段够用。本节内容保留作为延期预案,届时直接启用。

- 新增 goreleaser 配置与发布 workflow;触发面 `tags: ['musicctl/v*']`,与博客 `deploy.yml` 的 `v*` 完全隔离(决策见[作用域 tag ADR](../adr/mimo-music-musicctl-scoped-release-tags.md))。
- 产物:macOS arm64/amd64、Linux、Windows 二进制 + checksums;版本号经 ldflags 注入;首版 0.1.0。
- **配置禁项**:不写 `brews:` 段——brew tap 后置是既定决策,防止 release workflow 尝试推 tap。
- **macOS quarantine 对策**:首版二进制不做 Apple 签名/公证(Apple Developer $99/年,个人项目不划算),Gatekeeper 会拦首次运行;安装文档显式给出两种解法——浏览器下载后 `xattr -d com.apple.musicctl <binary>`,或 `curl -L ... | tar xz` 管道下载(不经浏览器、不带 quarantine 属性)。
- **供应链加固(可选)**:cosign keyless 签名(GitHub Actions OIDC,免密钥管理)+ syft SBOM;单维护者个人项目风险面小,首版只做 checksums。
- CI 每次 push 跑 `goreleaser check` + `release --snapshot` 冒烟(不发布),防止配置腐烂。

**本 PRD 内只交付**:`--version` 经 `debug.ReadBuildInfo()` 报告 module version + vcs revision(`go install` 安装时自动嵌入,无需 goreleaser);doctor 的「版本(build info)」检查项同源,不受影响。

### 命令树守护测试

- proto `ServiceDesc` 全量 method ↔ cobra 命令树全遍历,**双向 diff**:有 rpc 无命令、有命令无 rpc 都红。**动态发现,禁止硬编码命令/rpc 总数**——接口按蓝图(当前 78 → 全量 357)持续增长,守护机制对新 rpc 自动生效,测试代码与 PRD 文本都不随接口数改动。
- rpc 与命令的数量缺口用**显式 allowlist** 登记(每条形同「rpc X 无命令,理由 Y」);新增缺口必须登记,否则红。**allowlist 增长是预期行为**:musicctl 定位调试/实用工具,357 接口不无脑 1:1 进 CLI(云贝/签到/音乐人后台这类大概率只登记),「rpc 不进 CLI」是合法且受守护保护的决策,不是待消灭的债。
- **help 分组守护**:每命令必须属于某 help 组,或显式登记「不分组」——cobra 对无 group 命令静默落入 "Additional Commands",不红不报警,漏挂组会随接口增长 silently 腐烂。
- 附命令构造校验:每命令 flag 注册、required 标记、别名表与首发清单一致。

### 文档双轨

- 手写流程手册:只写安装/登录/常用流(搜索/播放/下载/歌单/补全 onboarding),命令细节一律指向 `--help`(clig.dev tutorial 角色)。
- 生成参考:cobra `GenMarkdownTree` 产全命令 markdown 入库;**freshness 守护测试**重新生成并 diff,不一致即红——生成物非手写真相,天然不腐烂。
- 依据 clig.dev 文档双轨:web 可搜索可链接 + 与安装版本同步。

### help 分组与补全

- help 用 cobra 原生 `Group` 机制分 5 组(快速上手/账号/音乐/发现/工具);`--help-verbose` 列全部命令;静态别名节显式列出六枚别名。
- **新领域入组规则**:新 Bounded Context(评论/排行榜/MV/云盘等)接入时默认归入既有 5 组之一;单组命令数超 ~30 时再评估拆组或新立组,届时的分组形态(组数上限/二级分组)留作独立决策——当前 5 组对数十命令规模有效,不预设 300+ 命令的结构。
- `completion` 子命令为 cobra 自带(bash/zsh/fish/powershell),开箱启用。
- 参数补全由 kit 层在 root 构造后**一次树遍历统一挂载**,表驱动(flag 名 → 数据源):`--id` → 召回池候选(带歌名/艺人描述列),`--level`/`--area`/`--op` 等 → 固定枚举;个别命令异构需求可就地覆盖注册。新命令(A 类 rpc 1:1 接入)零登记。
- 补全**绝不实时查网络**(CONTEXT.md「补全只走缓存」)。

### 召回池

- 存储:append-only JSONL,1000 行上限 drop oldest,0600 权限,tmp+rename 原子写,单行损坏只丢该行——全部沿 CONTEXT.md 既定。路径跟随 Phase B 迁移后的配置目录(Phase B 独立 PRD 先行,见 Further Notes)。
- 三类来源:主动(search/detail)、隐式(kit 层在 `--id` **成功消费**后统一埋点,失败不进池,命令层无感)、远端(红心/歌单快照,24h TTL)。
- 预热:启动读磁盘 + 后台 fire-and-forget 拉远端,绝不阻塞主命令与裸跑(gh 更新检查同款模式)。
- 排序:**frecency**——score = Σ(每次事件 × 时段桶权重 × src 类型权重)。时段桶:1h ×4 / 1d ×2 / 1w ×0.5 / 更早 ×0.25(atuin-z 工程化分法);src 权重:`play`/`download` > `search`/`detail` > `remote`(Mozilla frecency 访问类型加权)。装载时对事件流聚合,存储不变、无新字段。
- **事件流 vs 聚合(已验证的选型)**:保留全事件流而非 zoxide 式「rank 计数 + last-access 时间戳」聚合——聚合无法区分「上周密集 100 次」与「三个月分散 100 次」,且阈值式低分删除会把假期不用的条目永久丢弃;FIFO drop oldest 解耦打分与裁剪,只有真正退出保留窗口的条目才丢失(zoxide #1195 讨论佐证)。**已知权衡**:wall-clock 老化存在「假期问题」(一周不听,常听歌掉桶),评估后保持 wall-clock——音乐召回的「最近听过」语义本身是时间语义,与 Mozilla frecency/atuin-z 一致;事件计数时钟对 run-and-exit CLI 无明确收益。

### 别名

- **argv 重写**(git `run_argv` / gh `expandedArgs` / cargo `[alias]` 同款):执行路径重写 `args[0]`;`__complete`/`__completeNoDesc` 路径重写 `args[1]`,透过别名补全可用。
- 别名不进命令树 → tab 补全天然不含别名;`--help` 静态节显式列出。
- 首发六枚固定内置:`pp`/`dl`/`pll`/`se`/`rd`/`whoami`;不做用户自定义别名(cargo #6221 的遮蔽教训)。

### onboarding(裸跑)

- 规则全部沿 CONTEXT.md:未登录→登录引导;已登录→时段场景化(晨 daily-songs/午 playlists/晚 fm/夜复听),**周末优先级高于时段**;映射硬编码零新依赖;本地时区;可补全命令用 `<TAB>` 标注。
- 输出走 stderr;本地 session 读 + fire-and-forget,绝不阻塞(clig.dev 100ms 响应约束)。

### doctor

- 检查项:版本(build info)/会话与网络(一次轻量 rpc 自检合一)/补全安装指引/音频后端。
- 渲染层输出(✓/✗/! 清单 + 每项修复指引),`--json` 白拿,bug report 可粘贴。
- 退出码:任一 fail → exit 1(入输出层退出码体系);warn(headless 无音频——合法场景,指引 `song download`)不影响。

### recent 与位置参数

- `musicctl recent`:读召回池,按 frecency 展示最近条目(类型/名称/时间/来源),走渲染层。
- 位置参数:沿 CONTEXT.md 规则铺满所有单值 `--id` 命令 + `search --keyword`(机制已由 #24 验证);`--uid`/`--tracks` 不纳入;同时给报歧义错。

## Testing Decisions

好测试的标准:只测外部行为(命令树长什么样、输出什么、退出码多少),不测内部实现;fake 注入走既有的依赖注入结构(playDeps/downloadDeps 的社区共识)。

**Seam 1:cobra 命令树(构造产物)**——一个 seam 盖五个特性:

- 双向 diff 守护:proto ServiceDesc ↔ 树遍历。
- freshness 文档守护:树 → GenMarkdownTree → diff 入库生成物。
- help 分组/`--help-verbose`/别名节:树构造 → help 输出断言。
- 统一补全挂载:遍历后每个 `--id` 必有注册;候选由 fake 召回池喂。
- 别名:`expand(args)` 纯函数单测 + root 执行集成两层。

**Seam 2:召回池包(唯一新存储 seam)**:

- JSONL 读写/追加/裁剪/单行损坏容忍(临时目录文件)。
- frecency 打分纯函数(事件流 → 排序)。
- kit.Exec 成功路径埋点(fake executor)。
- 预热 fire-and-forget(fake remote fetcher,断言主命令不被阻塞)。

零散纯函数:onboarding 场景映射(注入时钟)、doctor 检查项(fake 网络/session/audio + 渲染层断言 + exit code)。

先例:`beep_seek_repro_test.go`(httptest fake)、`play_test.go`(fakePlayer/testPlayDeps)、`kit/positional_test.go`、`endpoint/song/song_test.go`(fixture 映射)。

## Out of Scope

- **发布渠道整块**(goreleaser/预编译二进制/cosign 签名/SBOM/Apple 签名公证/brew tap)——延期到 musicctl 整体架构定型后;触发条件:命令树规模与接口面基本稳定(357 蓝图大部接入或明确裁剪)。本 PRD 仅交付 `--version`(build info)。brew 未来落地时用 **Cask** 而非 Formula(预编译二进制走 Cask 是 2026 生态共识)。
- man pages(clig.dev consider 项,投入产出低)。
- TUI(Phase D,独立立项;onboarding 不抢占裸跑)。
- 用户自定义别名(cargo #6221 遮蔽教训;首发六枚内置固定)。
- 实时网络补全(CONTEXT.md 明确 Avoid)。
- Phase B(配置目录迁移、`config` 命令组)——独立小 PRD,先行落地,本 PRD 不覆盖。
- 个性化推荐(onboarding 不读召回池,CONTEXT.md 既定 Avoid)。
- endpoint/service 层任何改动;新 rpc 消费。

## Further Notes

- **Phase B 先行**:召回池 JSONL 直接写 Phase B 迁移后的配置目录(`os.UserConfigDir()/musicctl/`),不写 `~/.musicctl/` 旧路径,零迁移逻辑。ticket 排序上召回池依赖 B 完成;其余各项(守护/文档/doctor 等)与 B 无依赖,可并行先行。
- **别名与补全的交互细节**:argv 重写必须同时覆盖执行路径与 `__complete` 路径,否则 `pp --id <TAB>` 静默无候选,用户会当 bug 报。
- **agent-friendly 口径**:`--help` 是命令语法的唯一真相(生成文档与安装版本同步),agent skill 或外部文档一律指向 `--help`/生成参考,不复制命令手册——复制即第二份真相,必然腐烂(2026 agent-skill 设计共识)。机器可读输出已由输出层(PRD-0012)`--json` 全覆盖,doctor `--json` 白拿,musicctl 天然可被 agent 消费,本 PRD 零新增工作量。
- **隐式埋点只记成功**:写操作(like/trash)经确认且执行成功才进池;失败/取消不进。
- 决策过程:本 PRD 经 grill 九问收敛,关键外部依据——clig.dev(文档双轨/100ms 响应)、cobra 官方 doc-gen 与 Group 机制、Mozilla/atuin-z frecency、git/gh/cargo argv 展开、gh fire-and-forget 更新检查。
