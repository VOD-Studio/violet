# PRD: musicctl 配置目录迁移(Phase B)

> 状态:📋 待实现
> 关联:[CONTEXT.md musicctl CLI 段](../../CONTEXT.md)、[roadmap Phase B](../../mimo-music/docs/musicctl-roadmap.md)、[PRD-0014 工程化与可发现性](./0014-musicctl-工程化与可发现性.md)(召回池/补全/recent 依赖本 PRD 落地)
> 范围:musicctl CLI 的本地状态目录从硬编码 `~/.musicctl/` 迁移到 `os.UserConfigDir()/musicctl/`,旧路径自动迁移,**单点可注入路径解析**为召回池(PRD-0014 G 片段)/补全/doctor 提供测试 seam。`config` 命令组延期——CONTEXT.md 未定义任何 CLI 配置字段,在出现真实可配置项前不立命令组(避免 speculative generality)。

## Problem Statement

musicctl 的本地状态(登录 session)目前硬编码落在 `~/.musicctl/session.json`(`internal/cli/kit/session.go` 的 `SessionPath()` 直接调 `os.UserHomeDir()`)。这造成三处摩擦:

1. **不符合平台规范**:`~/.musicctl/` 是 90 年代 Unix dotfile 惯例;macOS(2026)、Linux(XDG)、Windows 各有既定的应用配置目录(`os.UserConfigDir()` 统一抽象),文件管理器、备份工具、清理工具都按平台目录工作,dotfile 是异类。
2. **召回池(PRD-0014 G 片段)被阻塞**:召回池 JSONL 要落盘,PRD-0014 Further Notes 明确要求「召回池直接写 Phase B 迁移后的配置目录,不写 `~/.musicctl/` 旧路径,零迁移逻辑」——路径不定下来,召回池不能开工。
3. **路径不可测试**:`SessionPath()` 直接调 `os.UserHomeDir()`,测试无法重定向到临时目录;召回池测试计划(PRD-0014 Testing Decisions「临时目录文件」)需要一个可注入的路径 seam,否则召回池测试要么碰用户真实主目录,要么每处自己 mock。

## Solution

把 musicctl 所有本地状态路径的解析**集中到一个可注入的单点**,基目录改用 `os.UserConfigDir()`,旧路径 `~/.musicctl/` 自动迁移。具体:

- **单点路径包**:提取一个集中的路径解析(沿 `kit/session.go` 既有 `SessionPath()` 模式,但基目录从 `os.UserHomeDir()+/.musicctl` 改为 `os.UserConfigDir()+/musicctl`)。所有路径(`session.json`、未来的 `history.jsonl`、未来的 `config`)都从这一个基函数派生。
- **可注入基函数**:`var userConfigDir = os.UserConfigDir`(包级变量,默认指标准库),测试覆写为返回 `t.TempDir()`,整棵路径树随之重定向。**这是本 PRD 的唯一新 seam**,也是 PRD-0014 召回池(#G)测试计划预设的 seam。
- **自动迁移**:启动时检测旧路径 `~/.musicctl/` 存在、新路径无文件 → 迁移(move)旧 session.json 到新路径 + 一次性 stderr 提示。已迁移或旧路径不存在则静默。一次性、无感,避免已登录用户「突然登出」重新登录。
- **`config` 命令组延期**:CONTEXT.md 未定义任何 CLI 配置字段(默认音质、默认下载目录等都不是既定决策);在出现真实可配置项前不立 `config get/set`/`config path`/`config show` 命令组——speculative generality,违背 YAGNI。doctor(#J,PRD-0014)的「会话」检查项可以直接复用路径包读 session,不需要 `config` 命令。

## User Stories

1. 作为 macOS 用户,我希望 musicctl 的本地状态落在 `~/Library/Application Support/musicctl/`(`os.UserConfigDir()` 在 macOS 的解析),以便备份工具(Time Machine)/文件管理器(Finder)按平台惯例管理。
2. 作为 Linux 用户,我希望 musicctl 的本地状态落在 `~/.config/musicctl/`(XDG 规范),以便符合 XDG 工具链(`chezmoi`/`stow`/`xdg-ninja`)的预期。
3. 作为 Windows 用户,我希望 musicctl 的本地状态落在 `%AppData%\musicctl`,以便符合 Windows 应用惯例。
4. 作为已登录用户(在旧路径 `~/.musicctl/session.json` 有会话),我希望升级 musicctl 后自动迁移到新路径,无需重新登录、无需手动搬文件。
5. 作为已迁移用户(新路径已有文件),我希望启动时不再看到迁移提示,也不重复迁移。
6. 作为从零开始的新用户(两路径都不存在),我希望 musicctl 直接用新路径,不产生任何迁移相关输出。
7. 作为维护者,我希望所有本地状态路径从一个集中的路径函数派生,以便新增状态文件(召回池 JSONL 等)时只改一处、不散落硬编码。
8. 作为维护者,我希望路径基函数可注入,以便召回池(#G)/doctor(#J)/session 测试都能重定向到 `t.TempDir()`,不碰用户真实主目录。
9. 作为已登录用户,我希望 session.json 的新路径与旧路径一样保持 0600 权限、目录 0700(cookie 是敏感信息),迁移不降低安全姿态。
10. 作为用户,我希望迁移失败(如新路径不可写)时 musicctl 明确报错而非静默丢会话,以便我知道要手动处理。
11. 作为召回池实现者(未来的 #G 片段),我希望直接复用路径包拿到 `history.jsonl` 的落盘路径,路径规则与 session 同源、零额外决策。
12. 作为脚本作者,我希望迁移提示走 stderr(stdout 保持干净),以便管道消费不被污染。

## Implementation Decisions

### 基目录:os.UserConfigDir()

- 基目录从 `os.UserHomeDir() + "/.musicctl"` 改为 `os.UserConfigDir() + "/musicctl"`(注意:`os.UserConfigDir()` 已含平台子目录——macOS 是 `~/Library/Application Support`,Linux 是 `~/.config`,Windows 是 `%AppData%`;只需再拼 `musicctl`)。
- `os.UserConfigDir()` 失败(如 `$HOME` 未设置)时返回 error,不静默回落到 `os.UserHomeDir()`——保持单一真相,错误向上传播让调用方决定(沿既有 `SessionPath() (string, error)` 签名)。
- **CONTEXT.md 同步**:召回池持久化段(第 182 行)的 `~/.musicctl/history.jsonl` 改为新路径;session 相关描述同步。本 PRD 落地后修订 CONTEXT.md,作为交付物的一部分。

### 单点可注入路径包

- 路径解析集中在 `internal/cli/kit/`(沿 `SessionPath()` 既有位置),不另立新包——`kit` 已是「CLI 装配基础设施」的归属,路径解析属同一层。
- 派生函数:`ConfigDir()`(基)、`SessionPath()`(= ConfigDir + `session.json`)、`HistoryPath()`(= ConfigDir + `history.jsonl`,**本 PRD 只定义不实现**,为 #G 预留 seam,函数体可返回路径字符串,调用者尚未存在)。**不**为不存在的文件造路径函数(YAGNI)——`HistoryPath()` 之所以预留,是因为它和 session 同源、且 #G PRD 已经按「同目录」设计,定义零成本。
- 可注入点:`var userConfigDir = os.UserConfigDir`(包级变量)。`ConfigDir()` 调用它而非直接调标准库。测试用 `userConfigDir = func() (string, error) { return t.TempDir(), nil }` 覆写,测试结束 defer 还原。
- 目录/文件权限沿既有:目录 `0o700`、文件 `0o600`(cookie 敏感),迁移目标路径同样 `MkdirAll(dir, 0o700)`。

### 自动迁移

- 触发点:首次需要读/写 session 时(`LoadSession`/`SaveSession`),或更早的 root `PersistentPreRun`。**惰性触发**(读 session 时)优于启动即检查——musicctl 大量命令不碰 session(如 `--help`、`--version`、`completion`),启动检查会给它们加无谓 IO。
- 迁移逻辑(在 `LoadSession` 发现新路径无文件时,或独立 `migrateIfNeeded()` 由 session 相关命令调用):
  1. 新路径文件存在 → 已迁移或新用户,直接走新路径,不检查旧路径。
  2. 新路径无文件 → 查旧路径 `~/.musicctl/session.json`(`os.UserHomeDir()+/.musicctl/session.json`,**仅迁移期使用**,不作为长期读路径)。
  3. 旧路径存在 → `MkdirAll` 新目录 → `os.Rename`(原子 move,同文件系统内)旧文件到新路径 → 设置新目录/文件权限 → stderr 打一次性提示 `已迁移会话到 <新路径>,旧目录 ~/.musicctl/ 可手动删除`。
  4. 旧路径不存在 → 新用户,直接用新路径,无迁移输出。
- **只迁 session.json**:召回池 `history.jsonl` 在本 PRD 时点尚不存在(#G 未落地),旧路径里只有 session.json,无需批量迁移目录内容。未来 #G 落地时新用户直接写新路径,无历史包袱。
- **迁移失败处理**:`MkdirAll`/`Rename` 失败 → 返回明确 error(如 `迁移会话失败: <原因>; 可手动将 ~/.musicctl/session.json 复制到 <新路径>`),不静默吞错、不丢会话。迁移失败时 `LoadSession` 按新路径无文件处理(返回未登录),不阻塞命令。
- **不删旧目录**:迁移只 move 文件,旧 `~/.musicctl/` 目录留给用户手动删(避免误删用户可能放的其他文件);提示文本说明可手动清理。

### 路径在代码中的引用点(迁移面)

- `internal/cli/kit/session.go`:`SessionPath()` 改为派生自 `ConfigDir()`。
- `internal/cli/auth/auth.go:23`、`internal/cli/root.go:28,42`、`cmd/musicctl/main.go:9`:注释/帮助文本里的 `~/.musicctl/session.json` 字面量改为不写死具体平台路径(如 `配置目录下的 session.json,见 musicctl doctor`),或注明「macOS: ~/Library/Application Support/musicctl/;Linux: ~/.config/musicctl/」。具体措辞实现时定,关键是别留过时的 `~/.musicctl/` 硬编码。
- doctor(#J,PRD-0014)的「会话」检查项复用 `SessionPath()`/`ConfigDir()`,显示实际路径——本 PRD 落地后 doctor 自然反映新路径。

### `config` 命令组——延期

- 本 PRD 不建 `config path`/`config show`/`config get/set`/`config edit` 任何子命令。
- 理由:CONTEXT.md 未定义任何 CLI 配置字段(默认音质、默认下载目录、默认输出格式都不是既定决策);无 schema 先建命令是 speculative generality,违背 YAGNI(仓库提交规范反例明示此反模式)。
- doctor(#J)作为环境自检已能展示配置目录路径与 session 存在性,覆盖「我想知道配置在哪」的用例,无需 `config path`。
- 未来出现真实可配置项时(如「默认下载目录」成为共识决策),再立独立小 PRD 定义 schema + `config` 命令组;届时本路径包已就绪,config 文件路径 `ConfigDir() + "/config.yaml"`(或 TOML)直接派生。

## Testing Decisions

好测试的标准:只测外部行为(路径解析对不对、迁移后文件在哪、权限对不对、提示文本对不对),不测内部实现;通过 `userConfigDir` 注入重定向到 `t.TempDir()`,绝不碰用户真实主目录。

**Seam:可注入路径包(本 PRD 唯一新 seam,也是 #G 预设 seam)**

- `ConfigDir()`/`SessionPath()`/`HistoryPath()` 路径解析:注入 `userConfigDir` 返回临时目录,断言拼出的路径正确(含 `musicctl` 子目录 + 正确文件名)。
- `os.UserConfigDir()` 失败路径:注入返回 error,断言路径函数把 error 向上传播(不静默回落)。
- 迁移逻辑(`migrateIfNeeded`):
  - 新用户(两路径都不存在)→ 无迁移、无输出。
  - 已迁移(新路径有文件)→ 不检查旧路径、无输出(注入旧路径存在也不迁)。
  - 旧路径有文件、新路径无 → move 到新路径 + 权限 0600/0700 + stderr 一次性提示 + 旧文件不再存在。
  - 迁移失败(注入 `MkdirAll` 失败,如新路径父目录只读)→ 明确 error、不丢旧文件、`LoadSession` 回落未登录。
- `LoadSession`/`SaveSession`/`ClearSession`:注入临时目录,断言新路径读写、权限、损坏文件处理沿既有行为不变(只是路径变了)。

**Prior art(沿既有 seam)**:
- `internal/cli/kit/session.go` 既有 `SessionPath()`/`SaveSession`(tmp+rename 原子写)/`LoadSession`/`ClearSession` 是直接先例,本 PRD 只是把基函数可注入化 + 改基目录,测试结构不变。
- PRD-0014 召回池测试计划(`internal/cli/kit` 下「JSONL 读写/追加/裁剪/单行损坏容忍(临时目录文件)」)预设的就是这个 seam——本 PRD 把 seam 建出来,#G 直接复用。
- `internal/cli/root_test.go`(已存在)的注入式测试风格。

**不测的**:
- 真实 `os.UserConfigDir()` 在各平台的解析(标准库行为,信任之;测试只注入假值)。
- 真实主目录的迁移(用 `t.TempDir()` 伪造新旧两路径)。

## Out of Scope

- **`config` 命令组**(`config path`/`show`/`get`/`set`/`edit`)——CONTEXT.md 未定义 CLI 配置字段,无 schema 先建命令是 speculative generality。延期到出现真实可配置项时独立 PRD。
- **召回池 history.jsonl 实现**——属 PRD-0014 G 片段,本 PRD 只为其预留路径 seam(`HistoryPath()` 可定义),不实现召回池逻辑。
- **批量迁移目录内容**——旧路径在迁移期只有 session.json,不迁目录;未来 #G 落地时新用户无历史包袱。
- **删除旧目录**——只 move 文件,旧 `~/.musicctl/` 目录留给用户手动清理(防误删用户其他文件)。
- **配置文件 schema**(YAML/TOML/config 文件格式)——随 `config` 命令组延期。
- **doctor 命令本身**——属 PRD-0014 J 片段,本 PRD 只保证 doctor 复用的路径 seam 就绪。
- **多账号/多 profile**——单用户单 session 沿既有,不引入 profile 概念。

## Further Notes

- **解阻 PRD-0014**:本 PRD 落地后,PRD-0014 的 G(召回池核心)、H(recent)、I 的 `--id` 补全部分即可发布——它们的「写配置目录」「读召回池」「补全候选源」全部依赖本 PRD 的路径 seam。届时 G 直接调 `HistoryPath()` 落盘,测试注入 `userConfigDir` 重定向。
- **CONTEXT.md 修订作为交付物**:本 PRD 落地时,CONTEXT.md 第 182 行召回池持久化段的 `~/.musicctl/history.jsonl`、以及 session 相关描述,需同步为新路径描述(不写死平台特定路径,或注明三平台解析)。这是「CONTEXT.md 是活文档」既定要求的执行,不是附赠。
- **迁移期的双路径**:迁移逻辑读旧路径 `~/.musicctl/session.json` 是**迁移期专属**(仅在新路径无文件时查一次),不作为长期读路径——长期读路径只有新路径。避免「读兼容旧路径」造成长期双真相。
- **agent-friendly 口径**:路径解析是内部实现,不进 `--help` 真相;doctor(#J)展示实际路径供用户/agent 查询。`os.UserConfigDir()` 的平台解析交给标准库,不复制到文档(第二份真相)。
- **决策依据**:`os.UserConfigDir()` 是 Go 1.14+ 标准(跨平台 XDG/macOS/Windows 抽象),`gh` CLI、`atuin`、`zoxide` 等 2026 主流 CLI 均用此模式;自动一次性迁移是 `gh config` 迁移的同款工程实践。
