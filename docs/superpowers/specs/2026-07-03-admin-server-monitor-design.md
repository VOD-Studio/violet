# 后台服务器监控面板设计

- 日期：2026-07-03
- 状态：已批准（设计阶段）
- 范围：后端新增 `system` DDD 模块 + 前端新增 `admin-system` 功能模块

## 1. 背景与目标

后台需要一个服务器监控面板，集中展示服务器硬件、应用运行时、依赖状态，并以历史趋势图呈现近期变化，辅助管理员掌握系统健康状况。

### 核心需求

- **监控指标**：服务器硬件（CPU/内存/磁盘/负载/网络）+ 应用运行时（Goroutine/GC/Uptime/线程）+ 依赖状态（PostgreSQL/Redis 探活与连接池）
- **历史趋势**：全量指标纳入历史曲线，保留约 24h
- **趋势存储**：Redis 缓存（后台 goroutine 定时采样，按时间窗口滚动），轻量、查询快
- **数据刷新**：前端轮询，非 WebSocket
- **位置**：后台 `/admin/system`，admin-only 权限（继承 `/admin` 组的 `Auth` + `AdminRequired`）
- **可视化**：使用 shadcn charts（recharts v3 封装），含动画

## 2. 总体架构

### 方案选型

采用单 DDD 模块 `system`，复用项目现有模式（与 `stats` 模块结构一致），新增依赖 `github.com/shirou/gopsutil/v3` 做跨平台系统指标采集。

排除方案：
- 纯 stdlib（非跨平台，macOS/Linux 行为不一致，易出 bug）
- 不做历史趋势（不满足需求）

### 数据流

```
[gopsutil/runtime]  →  collector  →  service
                                       │
                   ┌───────────────────┼───────────────────┐
                   ▼                   ▼                   ▼
         sampler goroutine      GetSnapshot()       GetHistory()
         (每 30s 采样)          (实时采集当前)      (读 Redis 历史窗口)
                   │                                       │
                   ▼                                       ▼
             Redis (List)                             响应前端
         key: monitor:snapshots
         保留约 24h / 2880 条
```

### API 端点

挂在已有 `/api/v1/admin` 组下，自动继承 `Auth` + `AdminRequired`：

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/admin/system/snapshot` | 实时快照：现场采集一次，返回全量当前指标 |
| GET | `/api/v1/admin/system/history` | 历史趋势：从 Redis 读近 24h 采样点 |

## 3. 后端设计

### 3.1 模块结构

```
api/internal/
├── application/system/
│   ├── service.go          # 应用服务：GetSnapshot() + GetHistory()
│   ├── sampler.go          # 定时采样 goroutine，写 Redis
│   └── dto.go              # Snapshot / History / SamplePoint DTO
├── infrastructure/system/
│   └── collector.go        # gopsutil 封装：采集全部指标
├── interfaces/http/handler/system/
│   └── system.go           # HTTP handler（GetSnapshot + GetHistory）
└── app/
    └── system_container.go # 手写容器（注入 redis client，启动采样 goroutine）
```

遵循手写 `NewXxxContainer` 模式（与 `stats_container.go` 一致），不引入 wire。

### 3.2 DTO 定义

#### Snapshot（实时快照，`/snapshot` 响应）

```go
type Snapshot struct {
    Timestamp    time.Time   `json:"timestamp"`
    Host         HostInfo    `json:"host"`
    CPU          CPUInfo     `json:"cpu"`
    Memory       MemoryInfo  `json:"memory"`
    Disk         []DiskInfo  `json:"disk"`          // 多挂载点
    Network      NetworkInfo `json:"network"`
    Load         LoadInfo    `json:"load"`
    Runtime      RuntimeInfo `json:"runtime"`
    Dependencies DepStatus   `json:"dependencies"`
}

type HostInfo struct {
    Hostname   string    `json:"hostname"`
    OS         string    `json:"os"`           // "linux" / "darwin"
    Platform   string    `json:"platform"`     // "Ubuntu 22.04"
    KernelArch string    `json:"kernelArch"`
    BootTime   time.Time `json:"bootTime"`
}

type CPUInfo struct {
    UsagePercent float64   `json:"usagePercent"` // 综合 0-100
    Cores        int       `json:"cores"`        // 逻辑核数
    PerCore      []float64 `json:"perCore"`      // 每核使用率
    ModelName    string    `json:"modelName"`
    Mhz          float64   `json:"mhz"`
}

type MemoryInfo struct {
    TotalBytes  uint64  `json:"totalBytes"`
    UsedBytes   uint64  `json:"usedBytes"`
    UsedPercent float64 `json:"usedPercent"`
    Available   uint64  `json:"available"`
    Cached      uint64  `json:"cached"`
    SwapTotal   uint64  `json:"swapTotal"`
    SwapUsed    uint64  `json:"swapUsed"`
    SwapPercent float64 `json:"swapPercent"`
}

type DiskInfo struct {
    Device      string  `json:"device"`
    Fstype      string  `json:"fstype"`
    Path        string  `json:"path"`
    TotalBytes  uint64  `json:"totalBytes"`
    UsedBytes   uint64  `json:"usedBytes"`
    UsedPercent float64 `json:"usedPercent"`
}

type NetworkInfo struct {
    Interfaces []NetInterface `json:"interfaces"`
    IO         NetIO          `json:"io"`
}

type NetInterface struct {
    Name  string   `json:"name"`
    MTU   int      `json:"mtu"`
    Flags []string `json:"flags"`     // up/loopback 等
    Addrs []string `json:"addrs"`     // IP 地址
}

type NetIO struct {
    BytesSent     uint64  `json:"bytesSent"`
    BytesRecv     uint64  `json:"bytesRecv"`
    PacketsSent   uint64  `json:"packetsSent"`
    PacketsRecv   uint64  `json:"packetsRecv"`
    SendRateBytes float64 `json:"sendRateBytes"`  // 速率 bytes/s
    RecvRateBytes float64 `json:"recvRateBytes"`
}

type LoadInfo struct {
    Load1  float64 `json:"load1"`
    Load5  float64 `json:"load5"`
    Load15 float64 `json:"load15"`
}

type RuntimeInfo struct {
    GoVersion     string     `json:"goVersion"`
    Goroutines    int        `json:"goroutines"`
    NumCgoCall    int64      `json:"numCgoCall"`
    NumThreads    int        `json:"numThreads"`
    ProcessCount  int        `json:"processCount"`
    UptimeSeconds int64      `json:"uptimeSeconds"`
    StartTime     time.Time  `json:"startTime"`
    MemStats      GoMemStats `json:"memStats"`
    GC            GCStats    `json:"gc"`
}

type GoMemStats struct {
    AllocBytes  uint64 `json:"allocBytes"`
    SysBytes    uint64 `json:"sysBytes"`
    HeapObjects uint64 `json:"heapObjects"`
    NextGCBytes uint64 `json:"nextGCBytes"`
}

type GCStats struct {
    NumGC        uint32 `json:"numGC"`
    PauseTotalNs uint64 `json:"pauseTotalNs"`
    LastPauseNs  uint64 `json:"lastPauseNs"`
}

type DepStatus struct {
    Postgres DependencyCheck `json:"postgres"`
    Redis    DependencyCheck `json:"redis"`
}

type DependencyCheck struct {
    Connected bool   `json:"connected"`
    LatencyMs int64  `json:"latencyMs"`
    Error     string `json:"error"`     // 失败时填，成功为空
    Pool      PoolStats `json:"pool"`
}

type PoolStats struct {
    InUse      int `json:"inUse"`
    Idle       int `json:"idle"`
    MaxOpen    int `json:"maxOpen"`
    WaitCount  int64 `json:"waitCount"`
}
```

#### SamplePoint（历史采样点，存 Redis）

全量指标精简字段：

```go
type SamplePoint struct {
    Timestamp time.Time `json:"ts"`
    CPU struct {
        UsagePercent float64   `json:"u"`
        PerCore      []float64 `json:"pc"`
    } `json:"cpu"`
    Mem struct {
        UsedPercent float64 `json:"up"`
        UsedBytes   uint64  `json:"ub"`
        SwapPercent float64 `json:"sp"`
        GoAlloc     uint64  `json:"ga"`
    } `json:"m"`
    Disk []struct {
        Path        string  `json:"p"`
        UsedPercent float64 `json:"up"`
        ReadBytes   uint64  `json:"rb"`
        WriteBytes  uint64  `json:"wb"`
    } `json:"d"`
    Net struct {
        Sent   uint64  `json:"s"`
        Recv   uint64  `json:"r"`
        SendRt float64 `json:"sr"`
        RecvRt float64 `json:"rr"`
    } `json:"n"`
    Load struct {
        L1  float64 `json:"l1"`
        L5  float64 `json:"l5"`
        L15 float64 `json:"l15"`
    } `json:"ld"`
    Rt struct {
        Gr      int     `json:"gr"`
        NumGC   uint32  `json:"gc"`
        HeapObj uint64  `json:"ho"`
        Threads int     `json:"th"`
        NumCgo  int64   `json:"cg"`
    } `json:"rt"`
    Deps struct {
        PgMs  int64 `json:"pg"`
        RdsMs int64 `json:"rds"`
    } `json:"dep"`
}
```

每条约 600 字节，2880 条 ≈ 1.7MB。

#### HistoryResponse（`/history` 响应）

```go
type HistoryResponse struct {
    Interval int           `json:"interval"` // 采样间隔秒（30）
    Points   []SamplePoint `json:"points"`   // 按时间升序
}
```

### 3.3 采集实现（`infrastructure/system/collector.go`）

封装 `github.com/shirou/gopsutil/v3` 各子包：

| 指标 | gopsutil 包 | 说明 |
|------|------------|------|
| Host | `host.Info()` | hostname/os/platform/boottime |
| CPU 使用率 | `cpu.Percent(200ms, false)` / `(true)` | 综合 + 每核 |
| CPU 核数/型号/频率 | `cpu.Counts(true)` / `cpu.Info()` | |
| 内存 | `mem.VirtualMemory()` / `mem.SwapMemory()` | |
| 磁盘 | `disk.Partitions(true)` + `disk.Usage(path)` | 遍历挂载点 |
| 磁盘 IO | `disk.IOCounters()` | 差分算速率 |
| 网络 | `net.Interfaces()` + `net.IOCounters()` | 差分算速率 |
| 负载 | `load.Avg()` | Windows 无，容错返回零值 |
| 运行时 | `runtime` + `runtime/debug` + 进程启动时间常量 | goroutines/GC/memstats |
| OS 线程 | `runtime/debug.SetGCPercent` 无关——用 `pprof.Lookup("threadcreate").Count()` 或 `gopsutil process` 自身进程的 `NumThreads` | 跨平台降级（取不到返回 0） |
| 进程数 | `process.Processes()` 的切片长度 | |

**速率计算**：collector 内部缓存上一次的累计值（磁盘 IO / 网络 IO），两次差分 ÷ 间隔 = 速率。首次调用（无缓存）速率为 0。

**CPU 采集说明**：`cpu.Percent` 首次调用因无基准返回 0 或不准，采样 goroutine 每 30s 调用会自然准确。实时快照的 CPU 用 `cpu.Percent(200ms, false)`（阻塞约 200ms，可接受）。

### 3.4 依赖探活

`service.go` 注入 `*gorm.DB`（`Ping()`）与 `*redis.Client`（`Ping(ctx)`）：
- `time.Now()` 前后差算延迟（ms）
- Postgres 连接池：`sql.DBStats`（通过 `(sqlDB).Stats()` 得到 InUse/Idle/MaxOpen/WaitCount）
- Redis 连接池：`redis.PoolStats()`
- 历史点只存延迟（`PgMs`/`RdsMs`），连接池详情仅实时快照

### 3.5 Redis 存储设计

```
Key:   monitor:snapshots
Type:  List
写入:  LPUSH  monitor:snapshots <json>   (最新在前)
裁剪:  LTRIM  monitor:snapshots 0 2879   (保留 2880 = 24h/30s)
读取:  LRANGE monitor:snapshots 0 -1     (返回后前端按时间升序展示)
TTL:   设 EXPIRE 25h 兜底
```

序列化用 `encoding/json`。`LRANGE` 返回最新在前，service 层反转为升序后返回。

### 3.6 采样 goroutine（`application/system/sampler.go`）

```go
type Sampler struct {
    collector *Collector
    rdb       *redis.Client
    interval  time.Duration  // 30s
    ctx       context.Context
}

func (s *Sampler) Run() {
    ticker := time.NewTicker(s.interval)
    defer ticker.Stop()
    for {
        select {
        case <-s.ctx.Done():
            return
        case <-ticker.C:
            s.sampleAndStore()  // 采集 → 序列化 → LPUSH + LTRIM + EXPIRE
        }
    }
}
```

失败不 panic，记录日志后继续下一轮（采样失败不影响 API 服务）。

### 3.7 容器与生命周期（`app/system_container.go`）

```go
type SystemContainer struct {
    SystemHandler *systemhttp.Handler
}

func NewSystemContainer(db *gorm.DB, rdb *redis.Client, ctx context.Context) *SystemContainer {
    collector := appsystem.NewCollector()
    svc := appsystem.NewService(db, rdb, collector)
    sampler := appsystem.NewSampler(collector, rdb, 30*time.Second, ctx)
    go sampler.Run()  // 随进程存活，ctx 取消时退出
    return &SystemContainer{
        SystemHandler: systemhttp.NewHandler(svc),
    }
}
```

`main.go` 中用应用级 `context`（与 HTTP server shutdown 共享）传入，支持优雅退出。

### 3.8 main.go 接入

```go
// 实例化（与其他容器并列）
systemContainer := app.NewSystemContainer(gormDB, redisClient, appCtx)

// 路由（admin 组内）
r.Route("/system", func(r chi.Router) {
    r.Get("/snapshot", systemContainer.SystemHandler.GetSnapshot)
    r.Get("/history", systemContainer.SystemHandler.GetHistory)
})
```

### 3.9 Handler 模式

遵循 `stats.go` 形状：

```go
func (h *Handler) GetSnapshot(w http.ResponseWriter, r *http.Request) {
    data, err := h.svc.GetSnapshot(r.Context())
    if err != nil {
        response.RespondError(w, r, err)
        return
    }
    response.RespondOK(w, data)
}
```

错误用 `domainshared.Internal(...)` 等构造，由 `response.RespondError` 自动映射 HTTP 状态码。

## 4. 前端设计

### 4.1 依赖与基础组件

```bash
# 添加 shadcn chart 组件（自动安装 recharts v3，生成 src/shared/ui/chart.tsx）
pnpm dlx shadcn@latest add chart
```

shadcn `chart` 组件提供：
- `ChartContainer` — 包裹图表，自动读 `--chart-1~5` 主题色、处理响应式
- `ChartTooltip` / `ChartTooltipContent` — 统一毛玻璃 Tooltip
- `ChartLegend` / `ChartLegendContent` — 图例
- `chartConfig` — 声明式定义每条数据的 label/颜色/icon

底层 recharts v3（React 19 兼容），动画通过 `<Line isAnimationActive animationDuration={1200}>` 等配置。

### 4.2 chart 主题色补充（`styles.css`）

```css
:root {
  --chart-1: oklch(0.646 0.222 41.116);   /* 橙红 - CPU */
  --chart-2: oklch(0.6 0.118 184.704);    /* 青 - 内存 */
  --chart-3: oklch(0.398 0.07 227.392);   /* 蓝 - 磁盘 */
  --chart-4: oklch(0.828 0.189 84.429);   /* 金 - 网络 */
  --chart-5: oklch(0.769 0.188 70.08);    /* 棕 - 负载/其他 */
}
.dark {
  --chart-1: oklch(0.488 0.243 264.376);
  --chart-2: oklch(0.696 0.17 162.48);
  --chart-3: oklch(0.769 0.188 70.08);
  --chart-4: oklch(0.627 0.265 303.9);
  --chart-5: oklch(0.645 0.246 16.439);
}
```

`@theme` 块补映射：`--color-chart-1: var(--chart-1);`（5 个），让 Tailwind 生成 `text-chart-1`/`fill-chart-1` 工具类。

### 4.3 模块结构

```
web/src/features/admin-system/
├── api/
│   ├── keys.ts        # query key 工厂
│   └── queries.ts     # useQuery hooks（snapshot/history）
├── model/
│   ├── types.ts       # Snapshot/HistoryResponse/SamplePoint 类型
│   └── format.ts      # fmtBytes/fmtPercent/fmtUptime/fmtTime
└── ui/
    ├── MetricCard.tsx          # 指标卡（数值+环形进度+阈值变色+骨架）
    ├── SnapshotCards.tsx       # 顶部 4 张实时卡组合
    ├── HistoryCharts.tsx       # Tab 切换 + 6 张趋势图
    ├── RuntimePanel.tsx        # 运行时详情
    ├── DependencyPanel.tsx     # 依赖状态（连接+延迟+连接池）
    ├── NetworkPanel.tsx        # 网络接口
    └── useCountUp.ts           # 数字滚动 hook
```

### 4.4 页面结构（`routes/admin.system.tsx`）

```
PageShell (title="服务器监控")
├── 顶部工具栏：自动刷新开关 + 脉冲指示点 + 最后更新时间 + 手动刷新
├── SnapshotCards（4 列 grid）
├── HistoryCharts（Tabs，每个 Tab 一张 shadcn chart）
└── 详情面板（RuntimePanel / DependencyPanel / NetworkPanel / 磁盘）
```

### 4.5 实时指标卡

每张卡：
- 大号数值（`useCountUp` 平滑滚动）+ 单位
- SVG 环形进度环（`stroke-dashoffset` + CSS `transition-all duration-700 ease-out`）
- 阈值变色：`<60%` 用 `--chart-2`（绿青）、`60-85%` 用 `--chart-4`（金）、`>85%` 用 `--destructive`（红），切换有过渡
- 卡片入场：stagger 淡入上浮（CSS `@keyframes fade-in-up` + `animation-delay` 错峰）
- 加载态用 `shimmer-skeleton`

| 卡 | 主数值 | 副信息 |
|----|--------|--------|
| CPU | 综合使用率 % | 核心数、型号 |
| 内存 | 已用 % | 已用/总量（GB） |
| 磁盘 | 根分区 % | 已用/总量（GB） |
| 运行时长 | 3d 2h | 进程启动时刻 |

### 4.6 历史趋势图（6 个 Tab）

每个 Tab 用 `chartConfig` 定义数据系列，`ChartContainer` 包裹：

| Tab | 图表类型 | chartConfig 系列 | 动画 |
|-----|---------|------------------|------|
| **CPU** | `<LineChart>` 综合线 + 每核细线 | `usage: {label:"综合", color:"--chart-1"}` + core 系列 | `isAnimationActive duration=1200 easing=ease-out` |
| **内存** | `<AreaChart>` 堆叠 | `used/available/swap` 三层 + 渐变 fill | 面积展开动画 |
| **磁盘 IO** | `<LineChart>` 读/写速率 | `read:{color:"--chart-3"}` `write:{color:"--chart-4"}` | 线条绘制动画 |
| **网络 IO** | `<AreaChart>` 发送/接收 | `sent/recv` 渐变填充 | 面积展开动画 |
| **负载** | `<LineChart>` 1/5/15min | 三条 `--chart-1/2/3` | 线条绘制动画 |
| **运行时** | 双 `<LineChart>`（左轴 Goroutine，右轴 GC） | `goroutines/gc` | 线条绘制动画 |

recharts 元素配置：
- `<Line type="monotone" strokeWidth={2} dot={false} isAnimationActive animationDuration={1200}>`
- `<Area>` 配 `<defs><linearGradient>` 从 `--chart-x` 到透明
- `<XAxis dataKey="ts" tickFormatter={fmtTime} tickLine={false} axisLine={false}>`
- `<YAxis tickFormatter={fmtBytes/fmtPercent} width={48}>`
- `<ChartTooltip content={<ChartTooltipContent indicator="line" />}>`

数据更新动画：轮询拉到新数据 → recharts 数据数组更新 → 自动触发新旧值间平滑过渡。

### 4.7 详情面板

- **RuntimePanel**：Go 版本、Goroutine、线程数、CGO 调用、GC 次数/耗时、堆分配。数值更新时短暂高亮闪烁。
- **DependencyPanel**：Postgres/Redis 各一张卡。
  - 连接状态 `<Badge>`：成功 = 绿色 + 微脉冲；失败 = 红色 + `animate-shake`
  - 延迟：横向条形（`transition-all duration-500`）
  - 连接池：InUse/Idle/MaxOpen 堆叠条形
- **NetworkPanel**：网卡列表（名称/IP/MTU/标志），发送/接收速率动态条形
- **磁盘**：多挂载点水平进度条 + 百分比，动画填充

### 4.8 自封装 hooks / 组件

- `useCountUp(target, duration)` — 数字滚动（`requestAnimationFrame`，轮询时旧→新平滑过渡）
- `<MetricCard>` — 指标卡（数值 + 环形进度 + 阈值变色 + 骨架态）
- `fmtBytes / fmtPercent / fmtUptime / fmtTime` — 格式化工具

### 4.9 数据获取

```ts
export const useSystemSnapshot = (autoRefresh: boolean) =>
  useQuery({
    queryKey: systemKeys.snapshot(),
    queryFn: () => apiGet<Snapshot>("/admin/system/snapshot"),
    refetchInterval: autoRefresh ? 5000 : false,
    refetchIntervalInBackground: false,
  });

export const useSystemHistory = (autoRefresh: boolean) =>
  useQuery({
    queryKey: systemKeys.history(),
    queryFn: () => apiGet<HistoryResponse>("/admin/system/history"),
    refetchInterval: autoRefresh ? 30000 : false,
  });
```

5s 轮询快照 + 30s 刷新历史，自动刷新默认开启，可手动关闭。

### 4.10 改动清单

| 改动 | 文件 |
|------|------|
| 新增 chart 组件 | `pnpm dlx shadcn@latest add chart` → `src/shared/ui/chart.tsx` |
| 补 chart 主题色 | `src/styles.css`（`:root`/`.dark`/`@theme`） |
| 新增前端模块 | `src/features/admin-system/{api,model,ui}/` |
| 新增路由 | `src/routes/admin.system.tsx` |
| 侧边栏菜单 | `src/features/admin-layout/ui/AdminNavConfig.ts` 加一项 |
| 顶栏标题 | `src/routes/admin.tsx` 的 `useAdminTitle` 加映射 |
| 重新生成路由树 | `pnpm generate-routes` |

## 5. 错误处理

- **后端采集失败**：单个指标采集失败不影响整体，对应字段返回零值/空，错误记日志不阻断。gopsutil 跨平台缺失字段（如 Windows 无负载）返回零值。
- **Redis 不可用**：`GetHistory` 返回空数组 + 错误日志，不返回 500；采样 goroutine 写失败记日志继续。实时快照不依赖 Redis，仍正常工作。
- **依赖探活失败**：`Connected=false`，`Error` 填失败原因，`LatencyMs=0`。
- **前端加载态**：snapshot/history 各自独立的 loading/error 分支，用骨架/错误重试。

## 6. 安全考虑

- 端点位于 `/admin` 组内，强制 `Auth` + `AdminRequired`（仅 admin/superadmin 角色可访问）。
- 不暴露敏感路径细节：磁盘只显示挂载点路径与使用率，不暴露目录内容。
- 采样数据仅存 Redis 内存，不持久化到 DB，无隐私风险。

## 7. 测试策略

- **后端**：collector 单测（mock gopsutil 或验证字段非零/结构正确）、service 单测（mock redis 验证 LPUSH/LTRIM 调用、history 升序返回）、sampler 单测（验证 ticker + ctx.Done 退出）。
- **前端**：`useCountUp` 单测（验证数值过渡）、`fmtBytes`/`fmtUptime` 单测。组件渲染用 Vitest + Testing Library 验证骨架/数据态分支。
- 运行命令：`make api-test`、`make web-test`。

## 8. 不在范围内

- WebSocket/SSE 实时推送（采用轮询）
- PostgreSQL 持久化历史（采用 Redis 缓存，重启丢失）
- 告警/阈值通知（仅展示，不发告警）
- 多服务器/集群监控（单节点）
- Prometheus metrics 端点（独立需求，不在本设计内）
