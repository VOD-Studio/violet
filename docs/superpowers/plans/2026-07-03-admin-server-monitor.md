# 后台服务器监控面板 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在后台新增一个服务器监控面板 `/admin/system`，展示 CPU/内存/磁盘/网络/负载/运行时/依赖状态的实时快照与历史趋势图（shadcn charts + 动画）。

**Architecture:** 后端新增 DDD 模块 `system`（collector 用 gopsutil 采集 + service 提供快照与历史 + sampler goroutine 每 30s 写 Redis），两个 admin 端点。前端新增 `admin-system` 功能模块（TanStack Query 轮询 + shadcn charts 渲染 6 个动画趋势图 + 实时指标卡 + 详情面板）。

**Tech Stack:** Go 1.25 / Chi / gopsutil v3 / go-redis v9 / GORM；React 19 / TanStack Router+Query / Tailwind v4 / shadcn charts（recharts v3）。

**参考设计文档:** `docs/superpowers/specs/2026-07-03-admin-server-monitor-design.md`

---

## File Structure

### 后端新增文件（`api/internal/`）

| 文件 | 职责 |
|------|------|
| `application/system/dto.go` | Snapshot / SamplePoint / HistoryResponse 等 DTO 定义 |
| `application/system/service.go` | 应用服务：`GetSnapshot()`（实时采集）、`GetHistory()`（读 Redis） |
| `application/system/sampler.go` | 定时采样 goroutine：每 30s 采集 → 序列化 → LPUSH + LTRIM Redis |
| `application/system/service_test.go` | service 单测（mock collector + redis miniredis） |
| `infrastructure/system/collector.go` | gopsutil 封装：采集全部系统指标，内部缓存做 IO 速率差分 |
| `interfaces/http/handler/system/system.go` | HTTP handler：GetSnapshot + GetHistory |

### 后端修改文件

| 文件 | 改动 |
|------|------|
| `go.mod` / `go.sum` | 新增 `github.com/shirou/gopsutil/v3` |
| `cmd/server/main.go` | 实例化 `systemContainer` + 注册 `/admin/system` 路由 |

### 前端新增文件（`web/src/features/admin-system/`）

| 文件 | 职责 |
|------|------|
| `api/keys.ts` | query key 工厂 |
| `api/queries.ts` | `useSystemSnapshot` / `useSystemHistory` hooks（轮询） |
| `model/types.ts` | Snapshot / HistoryResponse / SamplePoint TS 类型 |
| `model/format.ts` | `fmtBytes` / `fmtPercent` / `fmtUptime` / `fmtTime` 格式化 |
| `ui/useCountUp.ts` | 数字滚动 hook（requestAnimationFrame） |
| `ui/MetricCard.tsx` | 指标卡（数值 + 环形进度 + 阈值变色 + 骨架） |
| `ui/SnapshotCards.tsx` | 顶部 4 张实时卡组合 |
| `ui/HistoryCharts.tsx` | Tab 切换 + 6 张 shadcn chart 趋势图 |
| `ui/RuntimePanel.tsx` | 运行时详情面板 |
| `ui/DependencyPanel.tsx` | 依赖状态面板（连接/延迟/连接池） |
| `ui/NetworkPanel.tsx` | 网络接口面板 |
| `model/format.test.ts` | format 工具单测 |

### 前端修改文件

| 文件 | 改动 |
|------|------|
| `src/styles.css` | 补 `--chart-1~5` 变量（`:root`/`.dark`）+ `@theme` 映射 + `@keyframes shake`/`fade-in-up` |
| `src/shared/ui/chart.tsx` | shadcn CLI 生成（chart 组件） |
| `src/routes/admin.system.tsx` | 新增路由页面 |
| `src/features/admin-layout/ui/AdminNavConfig.ts` | 菜单加「服务器监控」 |
| `src/routes/admin.tsx` | `useAdminTitle` 加标题映射 |
| `src/routeTree.gen.ts` | `pnpm generate-routes` 自动生成 |

---

## Task 1: 后端 - 新增 gopsutil 依赖

**Files:**
- Modify: `api/go.mod`
- Modify: `api/go.sum`

- [ ] **Step 1: 添加 gopsutil 依赖**

Run（在 `api/` 目录）:
```bash
cd api && go get github.com/shirou/gopsutil/v3@latest
```

- [ ] **Step 2: 验证依赖已加入 go.mod**

Run: `grep gopsutil api/go.mod`
Expected: 输出含 `github.com/shirou/gopsutil/v3`

- [ ] **Step 3: 验证编译通过**

Run: `cd api && go build ./...`
Expected: 编译成功，无报错

- [ ] **Step 4: Commit**

```bash
git add api/go.mod api/go.sum
git commit -m "chore(api): 添加 gopsutil 系统监控依赖"
```

---

## Task 2: 后端 - DTO 定义

**Files:**
- Create: `api/internal/application/system/dto.go`

- [ ] **Step 1: 创建 DTO 文件**

```go
// Package system 提供服务器监控的应用用例。
package system

import "time"

// Snapshot 服务器实时快照（/admin/system/snapshot 响应）
type Snapshot struct {
	Timestamp    time.Time   `json:"timestamp"`
	Host         HostInfo    `json:"host"`
	CPU          CPUInfo     `json:"cpu"`
	Memory       MemoryInfo  `json:"memory"`
	Disk         []DiskInfo  `json:"disk"`
	Network      NetworkInfo `json:"network"`
	Load         LoadInfo    `json:"load"`
	Runtime      RuntimeInfo `json:"runtime"`
	Dependencies DepStatus   `json:"dependencies"`
}

// HostInfo 主机信息
type HostInfo struct {
	Hostname   string    `json:"hostname"`
	OS         string    `json:"os"`
	Platform   string    `json:"platform"`
	KernelArch string    `json:"kernelArch"`
	BootTime   time.Time `json:"bootTime"`
}

// CPUInfo CPU 使用情况
type CPUInfo struct {
	UsagePercent float64   `json:"usagePercent"`
	Cores        int       `json:"cores"`
	PerCore      []float64 `json:"perCore"`
	ModelName    string    `json:"modelName"`
	Mhz          float64   `json:"mhz"`
}

// MemoryInfo 内存使用情况
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

// DiskInfo 单个挂载点磁盘使用情况
type DiskInfo struct {
	Device      string  `json:"device"`
	Fstype      string  `json:"fstype"`
	Path        string  `json:"path"`
	TotalBytes  uint64  `json:"totalBytes"`
	UsedBytes   uint64  `json:"usedBytes"`
	UsedPercent float64 `json:"usedPercent"`
}

// NetworkInfo 网络信息
type NetworkInfo struct {
	Interfaces []NetInterface `json:"interfaces"`
	IO         NetIO          `json:"io"`
}

// NetInterface 网络接口
type NetInterface struct {
	Name  string   `json:"name"`
	MTU   int      `json:"mtu"`
	Flags []string `json:"flags"`
	Addrs []string `json:"addrs"`
}

// NetIO 网络 IO 累计值与速率
type NetIO struct {
	BytesSent     uint64  `json:"bytesSent"`
	BytesRecv     uint64  `json:"bytesRecv"`
	PacketsSent   uint64  `json:"packetsSent"`
	PacketsRecv   uint64  `json:"packetsRecv"`
	SendRateBytes float64 `json:"sendRateBytes"`
	RecvRateBytes float64 `json:"recvRateBytes"`
}

// LoadInfo 系统负载
type LoadInfo struct {
	Load1  float64 `json:"load1"`
	Load5  float64 `json:"load5"`
	Load15 float64 `json:"load15"`
}

// RuntimeInfo Go 运行时信息
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

// GoMemStats Go 内存统计
type GoMemStats struct {
	AllocBytes  uint64 `json:"allocBytes"`
	SysBytes    uint64 `json:"sysBytes"`
	HeapObjects uint64 `json:"heapObjects"`
	NextGCBytes uint64 `json:"nextGCBytes"`
}

// GCStats GC 统计
type GCStats struct {
	NumGC        uint32 `json:"numGC"`
	PauseTotalNs uint64 `json:"pauseTotalNs"`
	LastPauseNs  uint64 `json:"lastPauseNs"`
}

// DepStatus 依赖服务状态
type DepStatus struct {
	Postgres DependencyCheck `json:"postgres"`
	Redis    DependencyCheck `json:"redis"`
}

// DependencyCheck 单个依赖的探活结果
type DependencyCheck struct {
	Connected bool     `json:"connected"`
	LatencyMs int64    `json:"latencyMs"`
	Error     string   `json:"error"`
	Pool      PoolStats `json:"pool"`
}

// PoolStats 连接池统计
type PoolStats struct {
	InUse     int   `json:"inUse"`
	Idle      int   `json:"idle"`
	MaxOpen   int   `json:"maxOpen"`
	WaitCount int64 `json:"waitCount"`
}

// HistoryResponse 历史趋势响应（/admin/system/history）
type HistoryResponse struct {
	Interval int           `json:"interval"`
	Points   []SamplePoint `json:"points"`
}

// SamplePoint 单个历史采样点（存 Redis，字段精简控体积）
type SamplePoint struct {
	Timestamp time.Time `json:"ts"`
	CPU       struct {
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

- [ ] **Step 2: 验证编译**

Run: `cd api && go build ./internal/application/system/`
Expected: 编译成功

- [ ] **Step 3: Commit**

```bash
git add api/internal/application/system/dto.go
git commit -m "feat(api/system): 定义监控快照与历史采样 DTO"
```

---

## Task 3: 后端 - Collector 采集器

**Files:**
- Create: `api/internal/infrastructure/system/collector.go`

- [ ] **Step 1: 创建 collector**

```go
// Package system 提供系统指标采集（gopsutil 封装）。
package system

import (
	"runtime"
	"runtime/debug"
	"sync"
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/load"
	"github.com/shirou/gopsutil/v3/mem"
	"github.com/shirou/gopsutil/v3/net"
	"github.com/shirou/gopsutil/v3/process"

	appsystem "blog-api/internal/application/system"
)

// startTime 进程启动时刻（包级常量，供 Uptime 计算）
var startTime = time.Now()

// Collector 系统指标采集器
//
// 内部缓存上一次的磁盘/网络累计值，两次采集间差分计算速率。
type Collector struct {
	mu sync.Mutex

	// 上一次 IO 累计值（用于差分算速率）
	lastDiskIO   map[string]disk.IOCountersStat
	lastNetIO    map[string]net.IOCountersStat
	lastDiskTime time.Time
	lastNetTime  time.Time
}

// NewCollector 构造采集器
func NewCollector() *Collector {
	return &Collector{
		lastDiskIO: make(map[string]disk.IOCountersStat),
		lastNetIO:  make(map[string]net.IOCountersStat),
	}
}

// Collect 采集一次完整快照
func (c *Collector) Collect() (*appsystem.Snapshot, error) {
	snap := &appsystem.Snapshot{Timestamp: time.Now()}

	c.collectHost(snap)
	c.collectCPU(snap)
	c.collectMemory(snap)
	c.collectDisk(snap)
	c.collectNetwork(snap)
	c.collectLoad(snap)
	c.collectRuntime(snap)

	return snap, nil
}

func (c *Collector) collectHost(snap *appsystem.Snapshot) {
	info, err := host.Info()
	if err != nil {
		return
	}
	snap.Host = appsystem.HostInfo{
		Hostname:   info.Hostname,
		OS:         info.OS,
		Platform:   info.Platform + " " + info.PlatformVersion,
		KernelArch: info.KernelArch,
		BootTime:   time.Unix(int64(info.BootTime), 0),
	}
}

func (c *Collector) collectCPU(snap *appsystem.Snapshot) {
	// 综合使用率（阻塞约 200ms 采样）
	if usage, err := cpu.Percent(200*time.Millisecond, false); err == nil && len(usage) > 0 {
		snap.CPU.UsagePercent = usage[0]
	}
	if perCore, err := cpu.Percent(200*time.Millisecond, true); err == nil {
		snap.CPU.PerCore = perCore
	}
	if cores, err := cpu.Counts(true); err == nil {
		snap.CPU.Cores = cores
	}
	if infos, err := cpu.Info(); err == nil && len(infos) > 0 {
		snap.CPU.ModelName = infos[0].ModelName
		snap.CPU.Mhz = infos[0].Mhz
	}
}

func (c *Collector) collectMemory(snap *appsystem.Snapshot) {
	if v, err := mem.VirtualMemory(); err == nil {
		snap.Memory.TotalBytes = v.Total
		snap.Memory.UsedBytes = v.Used
		snap.Memory.UsedPercent = v.UsedPercent
		snap.Memory.Available = v.Available
		snap.Memory.Cached = v.Cached
	}
	if s, err := mem.SwapMemory(); err == nil {
		snap.Memory.SwapTotal = s.Total
		snap.Memory.SwapUsed = s.Used
		snap.Memory.SwapPercent = s.UsedPercent
	}
}

func (c *Collector) collectDisk(snap *appsystem.Snapshot) {
	partitions, err := disk.Partitions(false)
	if err != nil {
		return
	}
	for _, p := range partitions {
		usage, err := disk.Usage(p.Mountpoint)
		if err != nil {
			continue
		}
		snap.Disk = append(snap.Disk, appsystem.DiskInfo{
			Device:      p.Device,
			Fstype:      p.Fstype,
			Path:        p.Mountpoint,
			TotalBytes:  usage.Total,
			UsedBytes:   usage.Used,
			UsedPercent: usage.UsedPercent,
		})
	}
}

func (c *Collector) collectNetwork(snap *appsystem.Snapshot) {
	if ifaces, err := net.Interfaces(); err == nil {
		for _, iface := range ifaces {
			addrs := make([]string, 0, len(iface.Addrs))
			for _, a := range iface.Addrs {
				addrs = append(addrs, a.Addr)
			}
			snap.Network.Interfaces = append(snap.Network.Interfaces, appsystem.NetInterface{
				Name:  iface.Name,
				MTU:   int(iface.MTU),
				Flags: iface.Flags,
				Addrs: addrs,
			})
		}
	}

	// 网络 IO 累计值 + 差分速率
	c.mu.Lock()
	defer c.mu.Unlock()
	if counters, err := net.IOCounters(false); err == nil && len(counters) > 0 {
		io := counters[0]
		now := time.Now()
		snap.Network.IO.BytesSent = io.BytesSent
		snap.Network.IO.BytesRecv = io.BytesRecv
		snap.Network.IO.PacketsSent = io.PacketsSent
		snap.Network.IO.PacketsRecv = io.PacketsRecv
		if !c.lastNetTime.IsZero() {
			elapsed := now.Sub(c.lastNetTime).Seconds()
			if elapsed > 0 {
				if prev, ok := c.lastNetIO["total"]; ok {
					snap.Network.IO.SendRateBytes = float64(io.BytesSent-prev.BytesSent) / elapsed
					snap.Network.IO.RecvRateBytes = float64(io.BytesRecv-prev.BytesRecv) / elapsed
				}
			}
		}
		c.lastNetIO["total"] = io
		c.lastNetTime = now
	}
}

func (c *Collector) collectLoad(snap *appsystem.Snapshot) {
	// Windows 无负载，跨平台容错
	if avg, err := load.Avg(); err == nil {
		snap.Load = appsystem.LoadInfo{
			Load1:  avg.Load1,
			Load5:  avg.Load5,
			Load15: avg.Load15,
		}
	}
}

func (c *Collector) collectRuntime(snap *appsystem.Snapshot) {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	gcStats := debug.GCStats{PauseQuantiles: make([]time.Duration, 1)}
	debug.ReadGCStats(&gcStats)

	snap.Runtime = appsystem.RuntimeInfo{
		GoVersion:     runtime.Version(),
		Goroutines:    runtime.NumGoroutine(),
		NumCgoCall:    runtime.NumCgoCall(),
		NumThreads:    pprofThreadCount(),
		ProcessCount:  processCount(),
		UptimeSeconds: int64(time.Since(startTime).Seconds()),
		StartTime:     startTime,
		MemStats: appsystem.GoMemStats{
			AllocBytes:  m.Alloc,
			SysBytes:    m.Sys,
			HeapObjects: m.HeapObjects,
			NextGCBytes: m.NextGC,
		},
		GC: appsystem.GCStats{
			NumGC:        uint32(gcStats.NumGC),
			PauseTotalNs: uint64(gcStats.PauseTotal.Nanoseconds()),
			LastPauseNs:  uint64(gcStats.LastGC.UnixNano()),
		},
	}
}
```

- [ ] **Step 2: 创建辅助函数文件 `collector_helpers.go`**

```go
package system

import (
	"runtime/pprof"

	"github.com/shirou/gopsutil/v3/process"
)

// pprofThreadCount 返回当前进程的 OS 线程数（通过 pprof threadcreate profile）。
// 跨平台兜底：取不到返回 0。
func pprofThreadCount() int {
	if p := pprof.Lookup("threadcreate"); p != nil {
		return p.Count()
	}
	return 0
}

// processCount 返回系统进程总数。
func processCount() int {
	procs, err := process.Processes()
	if err != nil {
		return 0
	}
	return len(procs)
}
```

- [ ] **Step 3: 验证编译**

Run: `cd api && go build ./internal/infrastructure/system/`
Expected: 编译成功

- [ ] **Step 4: Commit**

```bash
git add api/internal/infrastructure/system/
git commit -m "feat(api/system): 实现 gopsutil 系统指标采集器"
```

---

## Task 4: 后端 - 应用 Service（快照 + 历史）

**Files:**
- Create: `api/internal/application/system/service.go`

- [ ] **Step 1: 创建 service**

```go
// Package system 提供服务器监控的应用用例。
package system

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"

	domainshared "blog-api/internal/domain/shared"
)

// snapshotKey Redis 存储历史采样点的 key
const snapshotKey = "monitor:snapshots"

// maxHistoryPoints 保留的最大历史点数（24h / 30s = 2880）
const maxHistoryPoints = 2880

// MetricCollector 指标采集接口（由 infrastructure 实现）
type MetricCollector interface {
	Collect() (*Snapshot, error)
}

// Service 服务器监控用例服务
type Service struct {
	collector MetricCollector
	rdb       *redis.Client
	db        *gorm.DB
}

// NewService 构造监控服务
func NewService(db *gorm.DB, rdb *redis.Client, collector MetricCollector) *Service {
	return &Service{db: db, rdb: rdb, collector: collector}
}

// GetSnapshot 实时采集一次完整快照（含依赖探活）
func (s *Service) GetSnapshot(ctx context.Context) (*Snapshot, error) {
	snap, err := s.collector.Collect()
	if err != nil {
		return nil, domainshared.NewError(string(domainshared.CodeInternal), "采集系统指标失败").WithErr(err)
	}
	s.checkDependencies(ctx, snap)
	return snap, nil
}

// checkDependencies 探活 PostgreSQL 与 Redis，填充依赖状态
func (s *Service) checkDependencies(ctx context.Context, snap *Snapshot) {
	snap.Dependencies.Postgres = s.checkPostgres(ctx)
	snap.Dependencies.Redis = s.checkRedis(ctx)
}

func (s *Service) checkPostgres(ctx context.Context) DependencyCheck {
	start := time.Now()
	sqlDB, err := s.db.DB()
	if err != nil {
		return DependencyCheck{Connected: false, Error: err.Error()}
	}
	if err := sqlDB.PingContext(ctx); err != nil {
		return DependencyCheck{Connected: false, Error: err.Error()}
	}
	stats := sqlDB.Stats()
	return DependencyCheck{
		Connected: true,
		LatencyMs: time.Since(start).Milliseconds(),
		Pool: PoolStats{
			InUse:     stats.InUse,
			Idle:      stats.Idle,
			MaxOpen:   stats.MaxOpenConnections,
			WaitCount: stats.WaitCount,
		},
	}
}

func (s *Service) checkRedis(ctx context.Context) DependencyCheck {
	start := time.Now()
	if err := s.rdb.Ping(ctx).Err(); err != nil {
		return DependencyCheck{Connected: false, Error: err.Error()}
	}
	ps := s.rdb.PoolStats()
	return DependencyCheck{
		Connected: true,
		LatencyMs: time.Since(start).Milliseconds(),
		Pool: PoolStats{
			InUse:     int(ps.TotalConns - ps.IdleConns),
			Idle:      int(ps.IdleConns),
			MaxOpen:   int(ps.TotalConns),
			WaitCount: int64(ps.WaitCount),
		},
	}
}

// GetHistory 从 Redis 读取历史采样点（按时间升序）
func (s *Service) GetHistory(ctx context.Context) (*HistoryResponse, error) {
	if s.rdb == nil {
		return &HistoryResponse{Interval: 30, Points: []SamplePoint{}}, nil
	}
	raw, err := s.rdb.LRange(ctx, snapshotKey, 0, -1).Result()
	if err != nil {
		// Redis 不可用时返回空数组，不报错（实时快照仍可用）
		return &HistoryResponse{Interval: 30, Points: []SamplePoint{}}, nil
	}
	// LPOP 最新在前，反转成升序
	points := make([]SamplePoint, 0, len(raw))
	for i := len(raw) - 1; i >= 0; i-- {
		var p SamplePoint
		if err := json.Unmarshal([]byte(raw[i]), &p); err == nil {
			points = append(points, p)
		}
	}
	return &HistoryResponse{Interval: 30, Points: points}, nil
}

// StoreSample 存储一个采样点到 Redis（供 sampler 调用）
func (s *Service) StoreSample(ctx context.Context, p SamplePoint) error {
	if s.rdb == nil {
		return errors.New("redis unavailable")
	}
	data, err := json.Marshal(p)
	if err != nil {
		return err
	}
	pipe := s.rdb.TxPipeline()
	pipe.LPush(ctx, snapshotKey, data)
	pipe.LTrim(ctx, snapshotKey, 0, int64(maxHistoryPoints-1))
	pipe.Expire(ctx, snapshotKey, 25*time.Hour)
	_, err = pipe.Exec(ctx)
	return err
}

// ToSamplePoint 将完整快照转为精简历史采样点
func ToSamplePoint(snap *Snapshot) SamplePoint {
	p := SamplePoint{Timestamp: snap.Timestamp}
	p.CPU.UsagePercent = snap.CPU.UsagePercent
	p.CPU.PerCore = snap.CPU.PerCore
	p.Mem.UsedPercent = snap.Memory.UsedPercent
	p.Mem.UsedBytes = snap.Memory.UsedBytes
	p.Mem.SwapPercent = snap.Memory.SwapPercent
	p.Mem.GoAlloc = snap.Runtime.MemStats.AllocBytes
	p.Net.Sent = snap.Network.IO.BytesSent
	p.Net.Recv = snap.Network.IO.BytesRecv
	p.Net.SendRt = snap.Network.IO.SendRateBytes
	p.Net.RecvRt = snap.Network.IO.RecvRateBytes
	p.Load.L1 = snap.Load.Load1
	p.Load.L5 = snap.Load.Load5
	p.Load.L15 = snap.Load.Load15
	p.Rt.Gr = snap.Runtime.Goroutines
	p.Rt.NumGC = snap.Runtime.GC.NumGC
	p.Rt.HeapObj = snap.Runtime.MemStats.HeapObjects
	p.Rt.Threads = snap.Runtime.NumThreads
	p.Rt.NumCgo = snap.Runtime.NumCgoCall
	p.Deps.PgMs = snap.Dependencies.Postgres.LatencyMs
	p.Deps.RdsMs = snap.Dependencies.Redis.LatencyMs
	for _, d := range snap.Disk {
		p.Disk = append(p.Disk, struct {
			Path        string  `json:"p"`
			UsedPercent float64 `json:"up"`
			ReadBytes   uint64  `json:"rb"`
			WriteBytes  uint64  `json:"wb"`
		}{Path: d.Path, UsedPercent: d.UsedPercent})
	}
	return p
}
```

- [ ] **Step 2: 验证编译**

Run: `cd api && go build ./internal/application/system/`
Expected: 编译成功

- [ ] **Step 3: Commit**

```bash
git add api/internal/application/system/service.go
git commit -m "feat(api/system): 实现监控快照采集与历史读取服务"
```

---

## Task 5: 后端 - Sampler 采样 goroutine

**Files:**
- Create: `api/internal/application/system/sampler.go`

- [ ] **Step 1: 创建 sampler**

```go
package system

import (
	"context"
	"time"

	"github.com/rs/zerolog/log"
)

// sampleInterval 采样间隔（30s）
const sampleInterval = 30 * time.Second

// Sampler 定时采样 goroutine
type Sampler struct {
	collector MetricCollector
	rdb       redisStore
	svc       *Service
	ctx       context.Context
}

// redisStore Redis 操作所需的最小接口（便于测试 mock）
type redisStore interface {
	StoreSample(ctx context.Context, p SamplePoint) error
}

// NewSampler 构造采样器
func NewSampler(ctx context.Context, collector MetricCollector, svc *Service) *Sampler {
	return &Sampler{ctx: ctx, collector: collector, svc: svc, rdb: svc}
}

// Run 启动定时采样循环，随 ctx 取消退出
func (s *Sampler) Run() {
	// 启动后立即采集一次，避免首屏历史为空
	s.sampleOnce()

	ticker := time.NewTicker(sampleInterval)
	defer ticker.Stop()

	for {
		select {
		case <-s.ctx.Done():
			log.Info().Msg("系统监控采样器已停止")
			return
		case <-ticker.C:
			s.sampleOnce()
		}
	}
}

// sampleOnce 采集一次并存入 Redis，失败仅记日志不阻断
func (s *Sampler) sampleOnce() {
	snap, err := s.collector.Collect()
	if err != nil {
		log.Error().Err(err).Msg("监控采样失败")
		return
	}
	// 依赖探活（历史点中含延迟）
	s.svc.checkDependencies(s.ctx, snap)
	point := ToSamplePoint(snap)
	if err := s.rdb.StoreSample(s.ctx, point); err != nil {
		log.Warn().Err(err).Msg("监控采样写入 Redis 失败")
	}
}
```

- [ ] **Step 2: 验证编译**

Run: `cd api && go build ./internal/application/system/`
Expected: 编译成功

- [ ] **Step 3: Commit**

```bash
git add api/internal/application/system/sampler.go
git commit -m "feat(api/system): 实现 30s 定时采样 goroutine"
```

---

## Task 6: 后端 - HTTP Handler

**Files:**
- Create: `api/internal/interfaces/http/handler/system/system.go`

- [ ] **Step 1: 创建 handler**

```go
// Package system 提供服务器监控的 HTTP handler。
package system

import (
	"net/http"

	appsystem "blog-api/internal/application/system"
	"blog-api/internal/interfaces/http/response"
)

// Handler 服务器监控 HTTP handler
type Handler struct {
	svc *appsystem.Service
}

// NewHandler 构造监控 handler
func NewHandler(svc *appsystem.Service) *Handler {
	return &Handler{svc: svc}
}

// GetSnapshot 实时快照 GET /admin/system/snapshot
func (h *Handler) GetSnapshot(w http.ResponseWriter, r *http.Request) {
	data, err := h.svc.GetSnapshot(r.Context())
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, data)
}

// GetHistory 历史趋势 GET /admin/system/history
func (h *Handler) GetHistory(w http.ResponseWriter, r *http.Request) {
	data, err := h.svc.GetHistory(r.Context())
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, data)
}
```

- [ ] **Step 2: 验证编译**

Run: `cd api && go build ./internal/interfaces/http/handler/system/`
Expected: 编译成功

- [ ] **Step 3: Commit**

```bash
git add api/internal/interfaces/http/handler/system/
git commit -m "feat(api/system): 实现监控快照与历史 HTTP handler"
```

---

## Task 7: 后端 - DI 容器与 main.go 接入

**Files:**
- Create: `api/internal/app/system_container.go`
- Modify: `api/cmd/server/main.go`（容器实例化 ~第 133 行附近 + 路由注册 admin 组内 ~第 503 行附近）

- [ ] **Step 1: 创建容器**

```go
package app

import (
	"context"

	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"

	appsystem "blog-api/internal/application/system"
	infrasystem "blog-api/internal/infrastructure/system"
	systemhttp "blog-api/internal/interfaces/http/handler/system"
)

// SystemContainer 服务器监控模块容器
type SystemContainer struct {
	SystemHandler *systemhttp.Handler
	Service       *appsystem.Service
}

// NewSystemContainer 装配监控模块并启动采样 goroutine。
// ctx 用于优雅退出（随 HTTP server shutdown 取消）。
func NewSystemContainer(db *gorm.DB, rdb *redis.Client, ctx context.Context) *SystemContainer {
	collector := infrasystem.NewCollector()
	svc := appsystem.NewService(db, rdb, collector)
	sampler := appsystem.NewSampler(ctx, collector, svc)
	go sampler.Run()
	return &SystemContainer{
		SystemHandler: systemhttp.NewHandler(svc),
		Service:       svc,
	}
}
```

- [ ] **Step 2: 在 main.go 实例化容器**

在 `api/cmd/server/main.go` 第 134 行（`commentReactionContainer := ...` 之后）追加：

```go
	commentReactionContainer := app.NewCommentReactionContainer(gormDB)

	// 服务器监控模块（DDD）：启动 30s 采样 goroutine，随 appCtx 退出
	systemContainer := app.NewSystemContainer(gormDB, redisClient, ctx)
```

- [ ] **Step 3: 在 main.go admin 组注册路由**

在 `api/cmd/server/main.go` 的 admin 组内（约第 503 行 `r.Get("/media", ...)` 之后、admin 组闭合 `})` 之前）追加：

```go
			// 服务器监控（admin-only）
			r.Route("/system", func(r chi.Router) {
				r.Get("/snapshot", systemContainer.SystemHandler.GetSnapshot) // 实时快照
				r.Get("/history", systemContainer.SystemHandler.GetHistory)   // 历史趋势
			})
```

- [ ] **Step 4: 验证整体编译**

Run: `cd api && go build ./...`
Expected: 编译成功

- [ ] **Step 5: 验证 lint**

Run: `cd api && go vet ./...`
Expected: 无报错

- [ ] **Step 6: Commit**

```bash
git add api/internal/app/system_container.go api/cmd/server/main.go
git commit -m "feat(api/system): 接入 DI 容器并注册监控路由"
```

---

## Task 8: 后端 - Service 单测

**Files:**
- Create: `api/internal/application/system/service_test.go`

- [ ] **Step 1: 编写 service 测试**

```go
package system

import (
	"context"
	"testing"
)

// fakeCollector 测试用采集器桩
type fakeCollector struct {
	snap *Snapshot
	err  error
}

func (f *fakeCollector) Collect() (*Snapshot, error) {
	if f.err != nil {
		return nil, f.err
	}
	return f.snap, nil
}

func TestGetSnapshot_ReturnsSnapshot(t *testing.T) {
	collector := &fakeCollector{snap: &Snapshot{
		CPU: CPUInfo{UsagePercent: 42.5, Cores: 4},
	}}
	// db/redis 传 nil：GetSnapshot 不应 panic，依赖探活会记录失败但返回
	svc := NewService(nil, nil, collector)

	snap, err := svc.GetSnapshot(context.Background())
	if err != nil {
		t.Fatalf("GetSnapshot 返回错误: %v", err)
	}
	if snap.CPU.UsagePercent != 42.5 {
		t.Errorf("CPU 使用率 = %v, 期望 42.5", snap.CPU.UsagePercent)
	}
	if snap.CPU.Cores != 4 {
		t.Errorf("核心数 = %v, 期望 4", snap.CPU.Cores)
	}
}

func TestGetHistory_RedisNil_ReturnsEmpty(t *testing.T) {
	svc := NewService(nil, nil, &fakeCollector{snap: &Snapshot{}})
	resp, err := svc.GetHistory(context.Background())
	if err != nil {
		t.Fatalf("GetHistory 返回错误: %v", err)
	}
	if len(resp.Points) != 0 {
		t.Errorf("历史点数 = %v, 期望 0", len(resp.Points))
	}
	if resp.Interval != 30 {
		t.Errorf("间隔 = %v, 期望 30", resp.Interval)
	}
}

func TestToSamplePoint_MapsFields(t *testing.T) {
	snap := &Snapshot{
		CPU: CPUInfo{UsagePercent: 55.0, PerCore: []float64{50, 60}},
	}
	p := ToSamplePoint(snap)
	if p.CPU.UsagePercent != 55.0 {
		t.Errorf("CPU 使用率 = %v, 期望 55", p.CPU.UsagePercent)
	}
	if len(p.CPU.PerCore) != 2 {
		t.Errorf("每核数 = %v, 期望 2", len(p.CPU.PerCore))
	}
}
```

- [ ] **Step 2: 运行测试验证通过**

Run: `cd api && go test ./internal/application/system/ -v`
Expected: 3 个测试全部 PASS

- [ ] **Step 3: Commit**

```bash
git add api/internal/application/system/service_test.go
git commit -m "test(api/system): 添加监控 service 单元测试"
```

---

## Task 9: 前端 - 添加 chart 主题色与动画 keyframes

**Files:**
- Modify: `web/src/styles.css`

- [ ] **Step 1: 在 `:root` 块（约第 75 行 `}` 前）追加 chart 颜色**

追加到 `:root { ... }` 内（`--glow-soft` 行之后、闭合 `}` 之前）：

```css
  /* shadcn charts 调色板（5 色） */
  --chart-1: oklch(0.646 0.222 41.116);
  --chart-2: oklch(0.6 0.118 184.704);
  --chart-3: oklch(0.398 0.07 227.392);
  --chart-4: oklch(0.828 0.189 84.429);
  --chart-5: oklch(0.769 0.188 70.08);
```

- [ ] **Step 2: 在 `.dark` 块（约第 108 行 `}` 前）追加暗色 chart 颜色**

```css
  /* shadcn charts 调色板（暗色 5 色） */
  --chart-1: oklch(0.488 0.243 264.376);
  --chart-2: oklch(0.696 0.17 162.48);
  --chart-3: oklch(0.769 0.188 70.08);
  --chart-4: oklch(0.627 0.265 303.9);
  --chart-5: oklch(0.645 0.246 16.439);
```

- [ ] **Step 3: 在 `@theme` 块（约第 40 行 `}` 前）追加颜色映射**

```css
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
```

- [ ] **Step 4: 在文件末尾追加动画 keyframes**

```css

/* 监控面板动画 */
@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}

.animate-fade-in-up {
  animation: fade-in-up 0.5s ease-out both;
}

.animate-shake {
  animation: shake 0.4s ease-in-out;
}
```

- [ ] **Step 5: 验证样式无语法错误**

Run: `cd web && pnpm exec tailwindcss --input src/styles.css --output /dev/null 2>&1 | head`（或直接启动 dev 确认无报错）
Expected: 无 CSS 解析错误

- [ ] **Step 6: Commit**

```bash
git add web/src/styles.css
git commit -m "feat(web): 添加 chart 主题色与监控面板动画"
```

---

## Task 10: 前端 - 添加 shadcn chart 组件

**Files:**
- Create: `web/src/shared/ui/chart.tsx`（CLI 生成）
- Modify: `web/package.json`（自动加 recharts）

- [ ] **Step 1: 用 shadcn CLI 添加 chart 组件**

Run: `cd web && pnpm dlx shadcn@latest add chart`
Expected: 生成 `src/shared/ui/chart.tsx`，自动安装 `recharts` 依赖

- [ ] **Step 2: 确认 chart.tsx 已生成且导出 ChartContainer 等**

Run: `grep -E "ChartContainer|ChartTooltip|chartConfig" web/src/shared/ui/chart.tsx | head`
Expected: 输出含这些导出

- [ ] **Step 3: 确认 recharts 已加入 package.json**

Run: `grep recharts web/package.json`
Expected: 输出含 `"recharts":`

- [ ] **Step 4: Commit**

```bash
git add web/src/shared/ui/chart.tsx web/package.json web/pnpm-lock.yaml
git commit -m "feat(web): 添加 shadcn chart 图表组件"
```

---

## Task 11: 前端 - 类型定义与格式化工具

**Files:**
- Create: `web/src/features/admin-system/model/types.ts`
- Create: `web/src/features/admin-system/model/format.ts`
- Create: `web/src/features/admin-system/model/format.test.ts`

- [ ] **Step 1: 创建类型定义 `types.ts`**

```ts
/** 后端 Snapshot 响应类型（与 api dto.go 对应） */
export interface Snapshot {
	timestamp: string;
	host: HostInfo;
	cpu: CPUInfo;
	memory: MemoryInfo;
	disk: DiskInfo[];
	network: NetworkInfo;
	load: LoadInfo;
	runtime: RuntimeInfo;
	dependencies: DepStatus;
}

export interface HostInfo {
	hostname: string;
	os: string;
	platform: string;
	kernelArch: string;
	bootTime: string;
}

export interface CPUInfo {
	usagePercent: number;
	cores: number;
	perCore: number[];
	modelName: string;
	mhz: number;
}

export interface MemoryInfo {
	totalBytes: number;
	usedBytes: number;
	usedPercent: number;
	available: number;
	cached: number;
	swapTotal: number;
	swapUsed: number;
	swapPercent: number;
}

export interface DiskInfo {
	device: string;
	fstype: string;
	path: string;
	totalBytes: number;
	usedBytes: number;
	usedPercent: number;
}

export interface NetworkInfo {
	interfaces: NetInterface[];
	io: NetIO;
}

export interface NetInterface {
	name: string;
	mtu: number;
	flags: string[];
	addrs: string[];
}

export interface NetIO {
	bytesSent: number;
	bytesRecv: number;
	packetsSent: number;
	packetsRecv: number;
	sendRateBytes: number;
	recvRateBytes: number;
}

export interface LoadInfo {
	load1: number;
	load5: number;
	load15: number;
}

export interface RuntimeInfo {
	goVersion: string;
	goroutines: number;
	numCgoCall: number;
	numThreads: number;
	processCount: number;
	uptimeSeconds: number;
	startTime: string;
	memStats: GoMemStats;
	gc: GCStats;
}

export interface GoMemStats {
	allocBytes: number;
	sysBytes: number;
	heapObjects: number;
	nextGCBytes: number;
}

export interface GCStats {
	numGC: number;
	pauseTotalNs: number;
	lastPauseNs: number;
}

export interface DepStatus {
	postgres: DependencyCheck;
	redis: DependencyCheck;
}

export interface DependencyCheck {
	connected: boolean;
	latencyMs: number;
	error: string;
	pool: PoolStats;
}

export interface PoolStats {
	inUse: number;
	idle: number;
	maxOpen: number;
	waitCount: number;
}

/** 历史采样点（与 api SamplePoint 对应，字段名精简） */
export interface SamplePoint {
	ts: string;
	cpu: { u: number; pc: number[] };
	m: { up: number; ub: number; sp: number; ga: number };
	d: { p: string; up: number; rb: number; wb: number }[];
	n: { s: number; r: number; sr: number; rr: number };
	ld: { l1: number; l5: number; l15: number };
	rt: { gr: number; gc: number; ho: number; th: number; cg: number };
	dep: { pg: number; rds: number };
}

export interface HistoryResponse {
	interval: number;
	points: SamplePoint[];
}
```

- [ ] **Step 2: 创建格式化工具 `format.ts`**

```ts
/** 字节转人类可读（KB/MB/GB） */
export function fmtBytes(bytes: number, decimals = 1): string {
	if (bytes === 0) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB", "TB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${(bytes / k ** i).toFixed(decimals)} ${sizes[i]}`;
}

/** 速率（bytes/s）转人类可读 */
export function fmtRate(bytesPerSec: number): string {
	return `${fmtBytes(bytesPerSec)}/s`;
}

/** 百分比格式化 */
export function fmtPercent(value: number, decimals = 1): string {
	return `${value.toFixed(decimals)}%`;
}

/** 秒数转运行时长（3d 2h） */
export function fmtUptime(seconds: number): string {
	const d = Math.floor(seconds / 86400);
	const h = Math.floor((seconds % 86400) / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	if (d > 0) return `${d}d ${h}h`;
	if (h > 0) return `${h}h ${m}m`;
	return `${m}m`;
}

/** ISO 时间转 HH:MM */
export function fmtTime(iso: string): string {
	const d = new Date(iso);
	return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

/** 纳秒转毫秒（GC 暂停） */
export function fmtNsToMs(ns: number): string {
	return `${(ns / 1e6).toFixed(2)}ms`;
}

/** 根据百分比返回阈值颜色 token */
export function thresholdColor(percent: number): string {
	if (percent > 85) return "var(--destructive)";
	if (percent > 60) return "var(--chart-4)";
	return "var(--chart-2)";
}
```

- [ ] **Step 3: 创建格式化单测 `format.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { fmtBytes, fmtPercent, fmtUptime, thresholdColor } from "./format";

describe("fmtBytes", () => {
	it("0 字节", () => {
		expect(fmtBytes(0)).toBe("0 B");
	});
	it("KB", () => {
		expect(fmtBytes(1024)).toBe("1.0 KB");
	});
	it("MB", () => {
		expect(fmtBytes(1024 * 1024 * 512)).toBe("512.0 MB");
	});
	it("GB", () => {
		expect(fmtBytes(1024 ** 3 * 2)).toBe("2.0 GB");
	});
});

describe("fmtPercent", () => {
	it("保留一位小数", () => {
		expect(fmtPercent(42.56)).toBe("42.6%");
	});
});

describe("fmtUptime", () => {
	it("分钟", () => {
		expect(fmtUptime(300)).toBe("5m");
	});
	it("小时+分", () => {
		expect(fmtUptime(3600 * 2 + 60)).toBe("2h 1m");
	});
	it("天+时", () => {
		expect(fmtUptime(86400 * 3 + 3600 * 2)).toBe("3d 2h");
	});
});

describe("thresholdColor", () => {
	it("低于 60% 返回绿色", () => {
		expect(thresholdColor(40)).toBe("var(--chart-2)");
	});
	it("60-85% 返回金色", () => {
		expect(thresholdColor(70)).toBe("var(--chart-4)");
	});
	it("高于 85% 返回红色", () => {
		expect(thresholdColor(90)).toBe("var(--destructive)");
	});
});
```

- [ ] **Step 4: 运行测试**

Run: `cd web && pnpm vitest run src/features/admin-system/model/format.test.ts`
Expected: 全部 PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/features/admin-system/model/
git commit -m "feat(web/system): 添加监控类型定义与格式化工具"
```

---

## Task 12: 前端 - API 查询 hooks

**Files:**
- Create: `web/src/features/admin-system/api/keys.ts`
- Create: `web/src/features/admin-system/api/queries.ts`

- [ ] **Step 1: 创建 query key 工厂 `keys.ts`**

```ts
/** 监控模块 query key 工厂 */
export const systemKeys = {
	all: ["admin-system"] as const,
	snapshot: () => [...systemKeys.all, "snapshot"] as const,
	history: () => [...systemKeys.all, "history"] as const,
};
```

- [ ] **Step 2: 创建查询 hooks `queries.ts`**

```ts
import { apiGet } from "@shared/api/request";
import { useQuery } from "@tanstack/react-query";

import type { HistoryResponse, Snapshot } from "../model/types";
import { systemKeys } from "./keys";

/** 服务器实时快照（5s 轮询，可被开关控制） */
export const useSystemSnapshot = (autoRefresh: boolean) =>
	useQuery({
		queryKey: systemKeys.snapshot(),
		queryFn: () => apiGet<Snapshot>("/admin/system/snapshot"),
		refetchInterval: autoRefresh ? 5000 : false,
		refetchIntervalInBackground: false,
	});

/** 历史趋势（30s 刷新） */
export const useSystemHistory = (autoRefresh: boolean) =>
	useQuery({
		queryKey: systemKeys.history(),
		queryFn: () => apiGet<HistoryResponse>("/admin/system/history"),
		refetchInterval: autoRefresh ? 30000 : false,
		refetchIntervalInBackground: false,
	});
```

- [ ] **Step 3: 验证类型检查**

Run: `cd web && pnpm tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 4: Commit**

```bash
git add web/src/features/admin-system/api/
git commit -m "feat(web/system): 添加监控快照与历史查询 hooks"
```

---

## Task 13: 前端 - useCountUp 数字滚动 hook

**Files:**
- Create: `web/src/features/admin-system/ui/useCountUp.ts`

- [ ] **Step 1: 创建 hook**

```ts
import { useEffect, useRef, useState } from "react";

/**
 * useCountUp - 数字平滑滚动 hook
 *
 * target 变化时从当前显示值用 requestAnimationFrame 平滑过渡到新值。
 * 适用于轮询场景：每次数据刷新时数字从旧值动画到新值。
 *
 * @param target 目标值
 * @param duration 动画时长（ms），默认 800
 * @param decimals 保留小数位，默认 0
 */
export function useCountUp(target: number, duration = 800, decimals = 0): number {
	const [display, setDisplay] = useState(target);
	const fromRef = useRef(target);
	const rafRef = useRef<number>(0);

	useEffect(() => {
		const from = fromRef.current;
		const diff = target - from;
		if (diff === 0) return;

		const start = performance.now();
		cancelAnimationFrame(rafRef.current);

		const tick = (now: number) => {
			const elapsed = now - start;
			const progress = Math.min(elapsed / duration, 1);
			// ease-out cubic
			const eased = 1 - (1 - progress) ** 3;
			const current = from + diff * eased;
			const factor = 10 ** decimals;
			setDisplay(Math.round(current * factor) / factor);
			if (progress < 1) {
				rafRef.current = requestAnimationFrame(tick);
			} else {
				fromRef.current = target;
			}
		};

		rafRef.current = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(rafRef.current);
	}, [target, duration, decimals]);

	return display;
}
```

- [ ] **Step 2: 验证类型检查**

Run: `cd web && pnpm tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 3: Commit**

```bash
git add web/src/features/admin-system/ui/useCountUp.ts
git commit -m "feat(web/system): 添加数字滚动 hook"
```

---

## Task 14: 前端 - MetricCard 指标卡组件

**Files:**
- Create: `web/src/features/admin-system/ui/MetricCard.tsx`

- [ ] **Step 1: 创建 MetricCard 组件**

```tsx
import { cn } from "@shared/lib/utils";

import { fmtPercent, thresholdColor } from "../model/format";
import { useCountUp } from "./useCountUp";

interface MetricCardProps {
	/** 标题（如「CPU」） */
	title: string;
	/** 主数值（百分比 0-100，用于环形进度与变色） */
	percent: number;
	/** 副信息行 */
	subtitle?: string;
	/** lucide 图标 */
	icon: React.ReactNode;
	/** 是否正在加载（显示骨架） */
	isLoading?: boolean;
	/** stagger 入场延迟（ms） */
	delay?: number;
}

/**
 * MetricCard - 实时指标卡
 *
 * 大号百分比数字（useCountUp 滚动）+ SVG 环形进度环 + 阈值变色 + 入场动画。
 */
export function MetricCard({ title, percent, subtitle, icon, isLoading, delay = 0 }: MetricCardProps) {
	const display = useCountUp(percent, 800, 1);
	const color = thresholdColor(percent);
	// 环形进度参数
	const radius = 28;
	const circumference = 2 * Math.PI * radius;
	const offset = circumference - (display / 100) * circumference;

	if (isLoading) {
		return (
			<div className="bg-card h-32 animate-pulse rounded-xl border" />
		);
	}

	return (
		<div
			className="bg-card animate-fade-in-up flex items-center gap-4 rounded-xl border p-4"
			style={{ animationDelay: `${delay}ms` }}
		>
			{/* 环形进度环 */}
			<div className="relative h-16 w-16 shrink-0">
				<svg className="h-16 w-16 -rotate-90" viewBox="0 0 64 64">
					<circle
						cx="32"
						cy="32"
						r={radius}
						fill="none"
						strokeWidth="6"
						className="stroke-muted"
					/>
					<circle
						cx="32"
						cy="32"
						r={radius}
						fill="none"
						strokeWidth="6"
						strokeLinecap="round"
						stroke={color}
						strokeDasharray={circumference}
						strokeDashoffset={offset}
						style={{ transition: "stroke-dashoffset 0.7s ease-out, stroke 0.5s ease" }}
					/>
				</svg>
				<span className="text-muted-foreground absolute inset-0 flex items-center justify-center text-lg">
					{icon}
				</span>
			</div>
			{/* 文本 */}
			<div className="min-w-0">
				<p className="text-muted-foreground truncate text-sm">{title}</p>
				<p
					className={cn("text-2xl font-bold tabular-nums")}
					style={{ color, transition: "color 0.5s ease" }}
				>
					{fmtPercent(display)}
				</p>
				{subtitle && <p className="text-muted-foreground truncate text-xs">{subtitle}</p>}
			</div>
		</div>
	);
}
```

- [ ] **Step 2: 验证类型检查**

Run: `cd web && pnpm tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 3: Commit**

```bash
git add web/src/features/admin-system/ui/MetricCard.tsx
git commit -m "feat(web/system): 添加实时指标卡组件"
```

---

## Task 15: 前端 - 历史趋势图组件（6 Tab shadcn charts）

**Files:**
- Create: `web/src/features/admin-system/ui/HistoryCharts.tsx`

- [ ] **Step 1: 创建 HistoryCharts 组件**

```tsx
import { Cpu, HardDrive, MemoryStick, Network, Activity, Gauge } from "lucide-react";
import { useMemo, useState } from "react";
import {
	Area,
	AreaChart,
	CartesianGrid,
	Line,
	LineChart,
	XAxis,
	YAxis,
} from "recharts";
import {
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
	type ChartConfig,
} from "@/shared/ui/chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/base/tabs";
import type { HistoryResponse } from "../model/types";
import { fmtBytes, fmtPercent, fmtTime } from "../model/format";

interface HistoryChartsProps {
	data?: HistoryResponse;
	isLoading: boolean;
}

const tabsConfig = [
	{ value: "cpu", label: "CPU", icon: Cpu },
	{ value: "mem", label: "内存", icon: MemoryStick },
	{ value: "disk", label: "磁盘 IO", icon: HardDrive },
	{ value: "net", label: "网络 IO", icon: Network },
	{ value: "load", label: "负载", icon: Gauge },
	{ value: "runtime", label: "运行时", icon: Activity },
] as const;

/**
 * HistoryCharts - 历史趋势图区（6 Tab，shadcn chart + 动画）
 *
 * 数据更新时 recharts 自动播放新旧值过渡动画。
 */
export function HistoryCharts({ data, isLoading }: HistoryChartsProps) {
	if (isLoading || !data) {
		return <div className="bg-card h-80 animate-pulse rounded-xl border" />;
	}
	if (data.points.length === 0) {
		return (
			<div className="bg-card text-muted-foreground flex h-80 items-center justify-center rounded-xl border text-sm">
				暂无历史数据（采样器启动后将逐步生成）
			</div>
		);
	}

	return (
		<Tabs defaultValue="cpu" className="bg-card rounded-xl border p-4">
			<TabsList className="flex-wrap">
				{tabsConfig.map((t) => (
					<TabsTrigger key={t.value} value={t.value} className="gap-1.5">
						<t.icon className="size-4" />
						{t.label}
					</TabsTrigger>
				))}
			</TabsList>
			<ChartsContent points={data.points} />
		</Tabs>
	);
}

function ChartsContent({ points }: { points: HistoryResponse["points"] }) {
	return (
		<div className="mt-4 h-72">
			<TabsContent value="cpu" className="mt-0 h-full">
				<CPUChart points={points} />
			</TabsContent>
			<TabsContent value="mem" className="mt-0 h-full">
				<MemoryChart points={points} />
			</TabsContent>
			<TabsContent value="disk" className="mt-0 h-full">
				<DiskChart points={points} />
			</TabsContent>
			<TabsContent value="net" className="mt-0 h-full">
				<NetworkChart points={points} />
			</TabsContent>
			<TabsContent value="load" className="mt-0 h-full">
				<LoadChart points={points} />
			</TabsContent>
			<TabsContent value="runtime" className="mt-0 h-full">
				<RuntimeChart points={points} />
			</TabsContent>
		</div>
	);
}

// ---- 各 Tab 图表 ----

function CPUChart({ points }: { points: HistoryResponse["points"] }) {
	const cpuConfig = { usage: { label: "综合使用率", color: "var(--chart-1)" } } satisfies ChartConfig;
	return (
		<ChartContainer config={cpuConfig} className="h-full">
			<LineChart data={points}>
				<CartesianGrid strokeDasharray="3 3" vertical={false} />
				<XAxis dataKey="ts" tickFormatter={fmtTime} tickLine={false} axisLine={false} />
				<YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} width={48} />
				<ChartTooltip content={<ChartTooltipContent indicator="line" labelKey="usage" />} />
				<Line
					dataKey="cpu.u"
					name="综合使用率"
					type="monotone"
					stroke="var(--chart-1)"
					strokeWidth={2}
					dot={false}
					isAnimationActive
					animationDuration={1200}
					animationEasing="ease-out"
				/>
			</LineChart>
		</ChartContainer>
	);
}

function MemoryChart({ points }: { points: HistoryResponse["points"] }) {
	const memConfig = {
		used: { label: "已用 %", color: "var(--chart-2)" },
	} satisfies ChartConfig;
	return (
		<ChartContainer config={memConfig} className="h-full">
			<AreaChart data={points}>
				<defs>
					<linearGradient id="memGrad" x1="0" y1="0" x2="0" y2="1">
						<stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.8} />
						<stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0.1} />
					</linearGradient>
				</defs>
				<CartesianGrid strokeDasharray="3 3" vertical={false} />
				<XAxis dataKey="ts" tickFormatter={fmtTime} tickLine={false} axisLine={false} />
				<YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} width={48} />
				<ChartTooltip content={<ChartTooltipContent indicator="line" />} />
				<Area
					dataKey="m.up"
					name="已用 %"
					type="monotone"
					stroke="var(--chart-2)"
					strokeWidth={2}
					fill="url(#memGrad)"
					isAnimationActive
					animationDuration={1200}
					animationEasing="ease-out"
				/>
			</AreaChart>
		</ChartContainer>
	);
}

function DiskChart({ points }: { points: HistoryResponse["points"] }) {
	// 取第一个挂载点的读写速率（由累计值差分近似）
	const chartData = useMemo(() => {
		return points.map((p, i) => {
			const cur = p.d[0];
			const prev = i > 0 ? points[i - 1].d[0] : null;
			let readRate = 0;
			let writeRate = 0;
			if (cur && prev) {
				readRate = cur.rb - prev.rb;
				writeRate = cur.wb - prev.wb;
			}
			return { ts: p.ts, readRate, writeRate };
		});
	}, [points]);
	const diskConfig = {
		read: { label: "读取", color: "var(--chart-3)" },
		write: { label: "写入", color: "var(--chart-4)" },
	} satisfies ChartConfig;
	return (
		<ChartContainer config={diskConfig} className="h-full">
			<LineChart data={chartData}>
				<CartesianGrid strokeDasharray="3 3" vertical={false} />
				<XAxis dataKey="ts" tickFormatter={fmtTime} tickLine={false} axisLine={false} />
				<YAxis tickFormatter={(v) => fmtBytes(v)} tickLine={false} axisLine={false} width={64} />
				<ChartTooltip content={<ChartTooltipContent indicator="line" />} />
				<Line dataKey="readRate" name="读取" type="monotone" stroke="var(--chart-3)" strokeWidth={2} dot={false} isAnimationActive animationDuration={1200} />
				<Line dataKey="writeRate" name="写入" type="monotone" stroke="var(--chart-4)" strokeWidth={2} dot={false} isAnimationActive animationDuration={1200} />
			</LineChart>
		</ChartContainer>
	);
}

function NetworkChart({ points }: { points: HistoryResponse["points"] }) {
	const netConfig = {
		sent: { label: "发送", color: "var(--chart-4)" },
		recv: { label: "接收", color: "var(--chart-2)" },
	} satisfies ChartConfig;
	return (
		<ChartContainer config={netConfig} className="h-full">
			<AreaChart data={points}>
				<defs>
					<linearGradient id="netSendGrad" x1="0" y1="0" x2="0" y2="1">
						<stop offset="5%" stopColor="var(--chart-4)" stopOpacity={0.6} />
						<stop offset="95%" stopColor="var(--chart-4)" stopOpacity={0.05} />
					</linearGradient>
					<linearGradient id="netRecvGrad" x1="0" y1="0" x2="0" y2="1">
						<stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.6} />
						<stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0.05} />
					</linearGradient>
				</defs>
				<CartesianGrid strokeDasharray="3 3" vertical={false} />
				<XAxis dataKey="ts" tickFormatter={fmtTime} tickLine={false} axisLine={false} />
				<YAxis tickFormatter={(v) => fmtBytes(v)} tickLine={false} axisLine={false} width={64} />
				<ChartTooltip content={<ChartTooltipContent indicator="line" />} />
				<Area dataKey="n.sr" name="发送" type="monotone" stroke="var(--chart-4)" strokeWidth={2} fill="url(#netSendGrad)" isAnimationActive animationDuration={1200} />
				<Area dataKey="n.rr" name="接收" type="monotone" stroke="var(--chart-2)" strokeWidth={2} fill="url(#netRecvGrad)" isAnimationActive animationDuration={1200} />
			</AreaChart>
		</ChartContainer>
	);
}

function LoadChart({ points }: { points: HistoryResponse["points"] }) {
	const loadConfig = {
		l1: { label: "1 min", color: "var(--chart-1)" },
		l5: { label: "5 min", color: "var(--chart-2)" },
		l15: { label: "15 min", color: "var(--chart-3)" },
	} satisfies ChartConfig;
	return (
		<ChartContainer config={loadConfig} className="h-full">
			<LineChart data={points}>
				<CartesianGrid strokeDasharray="3 3" vertical={false} />
				<XAxis dataKey="ts" tickFormatter={fmtTime} tickLine={false} axisLine={false} />
				<YAxis tickLine={false} axisLine={false} width={40} />
				<ChartTooltip content={<ChartTooltipContent indicator="line" />} />
				<Line dataKey="ld.l1" name="1 min" type="monotone" stroke="var(--chart-1)" strokeWidth={2} dot={false} isAnimationActive animationDuration={1200} />
				<Line dataKey="ld.l5" name="5 min" type="monotone" stroke="var(--chart-2)" strokeWidth={2} dot={false} isAnimationActive animationDuration={1200} />
				<Line dataKey="ld.l15" name="15 min" type="monotone" stroke="var(--chart-3)" strokeWidth={2} dot={false} isAnimationActive animationDuration={1200} />
			</LineChart>
		</ChartContainer>
	);
}

function RuntimeChart({ points }: { points: HistoryResponse["points"] }) {
	const rtConfig = {
		goroutines: { label: "Goroutines", color: "var(--chart-1)" },
		gc: { label: "GC 次数", color: "var(--chart-5)" },
	} satisfies ChartConfig;
	return (
		<ChartContainer config={rtConfig} className="h-full">
			<LineChart data={points}>
				<CartesianGrid strokeDasharray="3 3" vertical={false} />
				<XAxis dataKey="ts" tickFormatter={fmtTime} tickLine={false} axisLine={false} />
				<YAxis yAxisId="left" tickLine={false} axisLine={false} width={40} />
				<YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} width={40} />
				<ChartTooltip content={<ChartTooltipContent indicator="line" />} />
				<Line yAxisId="left" dataKey="rt.gr" name="Goroutines" type="monotone" stroke="var(--chart-1)" strokeWidth={2} dot={false} isAnimationActive animationDuration={1200} />
				<Line yAxisId="right" dataKey="rt.gc" name="GC 次数" type="monotone" stroke="var(--chart-5)" strokeWidth={2} dot={false} isAnimationActive animationDuration={1200} />
			</LineChart>
		</ChartContainer>
	);
}
```

- [ ] **Step 2: 确认 tabs 组件存在**

Run: `ls web/src/shared/ui/base/tabs* 2>/dev/null || ls web/src/shared/ui/tabs* 2>/dev/null`
Expected: 存在 tabs.tsx。若不存在，运行 `pnpm dlx shadcn@latest add tabs` 生成，并相应修正 import 路径。

- [ ] **Step 3: 验证类型检查**

Run: `cd web && pnpm tsc --noEmit`
Expected: 无类型错误（如有 import 路径问题，按实际 tabs.tsx 位置修正）

- [ ] **Step 4: Commit**

```bash
git add web/src/features/admin-system/ui/HistoryCharts.tsx
git commit -m "feat(web/system): 添加历史趋势图组件（6 Tab shadcn charts）"
```

---

## Task 16: 前端 - 详情面板组件（运行时/依赖/网络）

**Files:**
- Create: `web/src/features/admin-system/ui/RuntimePanel.tsx`
- Create: `web/src/features/admin-system/ui/DependencyPanel.tsx`
- Create: `web/src/features/admin-system/ui/NetworkPanel.tsx`

- [ ] **Step 1: 创建 RuntimePanel**

```tsx
import { fmtBytes, fmtNsToMs, fmtUptime } from "../model/format";
import type { Snapshot } from "../model/types";

/** RuntimePanel - Go 运行时详情面板 */
export function RuntimePanel({ data }: { data?: Snapshot }) {
	if (!data) return null;
	const { runtime } = data;
	const items = [
		{ label: "Go 版本", value: runtime.goVersion },
		{ label: "Goroutines", value: runtime.goroutines.toString() },
		{ label: "OS 线程", value: runtime.numThreads.toString() },
		{ label: "CGO 调用", value: runtime.numCgoCall.toString() },
		{ label: "系统进程数", value: runtime.processCount.toString() },
		{ label: "运行时长", value: fmtUptime(runtime.uptimeSeconds) },
		{ label: "堆分配", value: fmtBytes(runtime.memStats.allocBytes) },
		{ label: "系统内存", value: fmtBytes(runtime.memStats.sysBytes) },
		{ label: "堆对象数", value: runtime.memStats.heapObjects.toString() },
		{ label: "GC 次数", value: runtime.gc.numGC.toString() },
		{ label: "GC 总耗时", value: fmtNsToMs(runtime.gc.pauseTotalNs) },
		{ label: "上次 GC", value: fmtNsToMs(runtime.gc.lastPauseNs) },
	];
	return (
		<div className="bg-card rounded-xl border p-4">
			<h3 className="mb-3 font-semibold">运行时</h3>
			<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
				{items.map((it) => (
					<div key={it.label} className="bg-muted/50 rounded-lg p-2">
						<p className="text-muted-foreground text-xs">{it.label}</p>
						<p className="truncate text-sm font-medium">{it.value}</p>
					</div>
				))}
			</div>
		</div>
	);
}
```

- [ ] **Step 2: 创建 DependencyPanel**

```tsx
import { Database, Wifi } from "lucide-react";
import type { Snapshot } from "../model/types";

/** DependencyPanel - 依赖状态面板（Postgres / Redis） */
export function DependencyPanel({ data }: { data?: Snapshot }) {
	if (!data) return null;
	return (
		<div className="bg-card rounded-xl border p-4">
			<h3 className="mb-3 font-semibold">依赖状态</h3>
			<div className="grid gap-3 sm:grid-cols-2">
				<DepCard name="PostgreSQL" icon={<Database className="size-4" />} dep={data.dependencies.postgres} />
				<DepCard name="Redis" icon={<Wifi className="size-4" />} dep={data.dependencies.redis} />
			</div>
		</div>
	);
}

function DepCard({
	name,
	icon,
	dep,
}: {
	name: string;
	icon: React.ReactNode;
	dep: Snapshot["dependencies"]["postgres"];
}) {
	return (
		<div className="bg-muted/50 rounded-lg p-3">
			<div className="mb-2 flex items-center justify-between">
				<span className="flex items-center gap-1.5 text-sm font-medium">
					{icon}
					{name}
				</span>
				{dep.connected ? (
					<span className="bg-chart-2/20 text-chart-2 animate-pulse rounded-full px-2 py-0.5 text-xs font-medium">
						已连接
					</span>
				) : (
					<span className="bg-destructive/20 text-destructive animate-shake rounded-full px-2 py-0.5 text-xs font-medium">
						断开
					</span>
				)}
			</div>
			{dep.connected ? (
				<>
					<p className="text-muted-foreground text-xs">延迟: {dep.latencyMs}ms</p>
					<div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
						<div
							className="h-full rounded-full transition-all duration-500"
							style={{ width: `${Math.min(dep.latencyMs, 100)}%`, background: "var(--chart-2)" }}
						/>
					</div>
					<p className="text-muted-foreground mt-1 text-xs">
						连接池: {dep.pool.inUse} 使用 / {dep.pool.idle} 空闲 / {dep.pool.maxOpen} 上限
					</p>
				</>
			) : (
				<p className="text-destructive text-xs">{dep.error}</p>
			)}
		</div>
	);
}
```

- [ ] **Step 3: 创建 NetworkPanel**

```tsx
import { fmtBytes, fmtRate } from "../model/format";
import type { Snapshot } from "../model/types";

/** NetworkPanel - 网络接口面板 */
export function NetworkPanel({ data }: { data?: Snapshot }) {
	if (!data) return null;
	const { network } = data;
	return (
		<div className="bg-card rounded-xl border p-4">
			<h3 className="mb-3 font-semibold">网络</h3>
			<div className="mb-3 grid grid-cols-2 gap-3">
				<div className="bg-muted/50 rounded-lg p-2">
					<p className="text-muted-foreground text-xs">累计发送</p>
					<p className="text-sm font-medium">{fmtBytes(network.io.bytesSent)}</p>
					<p className="text-chart-4 text-xs">{fmtRate(network.io.sendRateBytes)}</p>
				</div>
				<div className="bg-muted/50 rounded-lg p-2">
					<p className="text-muted-foreground text-xs">累计接收</p>
					<p className="text-sm font-medium">{fmtBytes(network.io.bytesRecv)}</p>
					<p className="text-chart-2 text-xs">{fmtRate(network.io.recvRateBytes)}</p>
				</div>
			</div>
			<div className="space-y-1">
				{network.interfaces.map((iface) => (
					<div key={iface.name} className="text-muted-foreground flex justify-between text-xs">
						<span>{iface.name} ({iface.addrs[0] ?? "无 IP"})</span>
						<span>MTU {iface.mtu}</span>
					</div>
				))}
			</div>
		</div>
	);
}
```

- [ ] **Step 4: 验证类型检查**

Run: `cd web && pnpm tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 5: Commit**

```bash
git add web/src/features/admin-system/ui/RuntimePanel.tsx web/src/features/admin-system/ui/DependencyPanel.tsx web/src/features/admin-system/ui/NetworkPanel.tsx
git commit -m "feat(web/system): 添加运行时/依赖/网络详情面板"
```

---

## Task 17: 前端 - 路由页面与菜单接入

**Files:**
- Create: `web/src/routes/admin.system.tsx`
- Modify: `web/src/features/admin-layout/ui/AdminNavConfig.ts`
- Modify: `web/src/routes/admin.tsx`
- Regenerate: `web/src/routeTree.gen.ts`

- [ ] **Step 1: 创建路由页面 `admin.system.tsx`**

```tsx
import { Activity, Cpu, HardDrive, MemoryStick, RefreshCw } from "lucide-react";
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/shared/ui/base/button";
import { Switch } from "@/shared/ui/base/switch";
import { PageShell } from "@features/admin-layout/ui/PageShell";
import { DependencyPanel } from "@features/admin-system/ui/DependencyPanel";
import { HistoryCharts } from "@features/admin-system/ui/HistoryCharts";
import { MetricCard } from "@features/admin-system/ui/MetricCard";
import { NetworkPanel } from "@features/admin-system/ui/NetworkPanel";
import { RuntimePanel } from "@features/admin-system/ui/RuntimePanel";
import { useSystemHistory, useSystemSnapshot } from "@features/admin-system/api/queries";
import { fmtBytes, fmtUptime } from "@features/admin-system/model/format";

export const Route = createFileRoute("/admin/system")({ component: SystemMonitorPage });

function SystemMonitorPage() {
	const [autoRefresh, setAutoRefresh] = useState(true);
	const snapshot = useSystemSnapshot(autoRefresh);
	const history = useSystemHistory(autoRefresh);
	const snap = snapshot.data;
	const rootDisk = snap?.disk.find((d) => d.path === "/") ?? snap?.disk[0];

	return (
		<PageShell
			description="服务器硬件、应用运行时与依赖状态的实时监控"
			action={
				<div className="flex items-center gap-3">
					<label className="flex items-center gap-2 text-sm">
						<Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
						<span className="text-muted-foreground">自动刷新</span>
						{autoRefresh && (
							<span className="bg-chart-2 size-2 animate-pulse rounded-full" />
						)}
					</label>
					<Button
						variant="outline"
						size="sm"
						onClick={() => {
							snapshot.refetch();
							history.refetch();
						}}
					>
						<RefreshCw className="size-4" />
						刷新
					</Button>
				</div>
			}
		>
			<div className="space-y-6">
				{/* 实时指标卡 */}
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<MetricCard
						title="CPU"
						percent={snap?.cpu.usagePercent ?? 0}
						subtitle={snap ? `${snap.cpu.cores} 核 ${snap.cpu.modelName}` : undefined}
						icon={<Cpu className="size-5" />}
						isLoading={snapshot.isLoading}
						delay={0}
					/>
					<MetricCard
						title="内存"
						percent={snap?.memory.usedPercent ?? 0}
						subtitle={snap ? `${fmtBytes(snap.memory.usedBytes)} / ${fmtBytes(snap.memory.totalBytes)}` : undefined}
						icon={<MemoryStick className="size-5" />}
						isLoading={snapshot.isLoading}
						delay={80}
					/>
					<MetricCard
						title="磁盘"
						percent={rootDisk?.usedPercent ?? 0}
						subtitle={rootDisk ? `${fmtBytes(rootDisk.usedBytes)} / ${fmtBytes(rootDisk.totalBytes)}` : undefined}
						icon={<HardDrive className="size-5" />}
						isLoading={snapshot.isLoading}
						delay={160}
					/>
					<MetricCard
						title="运行时长"
						percent={Math.min(((snap?.runtime.uptimeSeconds ?? 0) / (86400 * 30)) * 100, 100)}
						subtitle={snap ? fmtUptime(snap.runtime.uptimeSeconds) : undefined}
						icon={<Activity className="size-5" />}
						isLoading={snapshot.isLoading}
						delay={240}
					/>
				</div>

				{/* 历史趋势图 */}
				<HistoryCharts data={history.data} isLoading={history.isLoading} />

				{/* 详情面板 */}
				<div className="grid gap-4 lg:grid-cols-2">
					<RuntimePanel data={snap} />
					<div className="space-y-4">
						<DependencyPanel data={snap} />
						<NetworkPanel data={snap} />
					</div>
				</div>
			</div>
		</PageShell>
	);
}
```

- [ ] **Step 2: 在 AdminNavConfig.ts 添加菜单项**

在 `api/internal/...`——修正：编辑 `web/src/features/admin-layout/ui/AdminNavConfig.ts`。

在 import 中添加 `Server` 图标，并在 `ADMIN_NAV_ITEMS` 数组末尾（「操作日志」之后）追加：

```ts
// import 追加 Server
import {
	// ...existing imports...
	Server,
} from "lucide-react";

// 数组末尾追加
    { label: "服务器监控", to: "/admin/system", icon: Server },
```

- [ ] **Step 3: 在 admin.tsx 的 useAdminTitle 添加标题映射**

在 `web/src/routes/admin.tsx` 的 `useAdminTitle()` 中，`return "后台管理";` 之前追加：

```ts
    if (pathname.startsWith("/admin/system")) return "服务器监控";
```

- [ ] **Step 4: 重新生成路由树**

Run: `cd web && pnpm generate-routes`
Expected: `src/routeTree.gen.ts` 更新，包含 `admin/system` 路由

- [ ] **Step 5: 验证类型检查**

Run: `cd web && pnpm tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 6: Commit**

```bash
git add web/src/routes/admin.system.tsx web/src/features/admin-layout/ui/AdminNavConfig.ts web/src/routes/admin.tsx web/src/routeTree.gen.ts
git commit -m "feat(web/system): 添加监控面板路由与后台菜单"
```

---

## Task 18: 前端 - 代码检查与格式化

**Files:** 全量检查

- [ ] **Step 1: 运行 Biome lint**

Run: `cd web && pnpm biome check src/features/admin-system src/routes/admin.system.tsx src/routes/admin.tsx src/features/admin-layout/ui/AdminNavConfig.ts`
Expected: 无 lint 错误（如有，运行 `pnpm biome check --write ...` 自动修复）

- [ ] **Step 2: 运行 Biome format**

Run: `cd web && pnpm biome format --write src/features/admin-system src/routes/admin.system.tsx`
Expected: 格式化完成

- [ ] **Step 3: 再次类型检查**

Run: `cd web && pnpm tsc --noEmit`
Expected: 无错误

- [ ] **Step 4: 如有改动则提交**

```bash
git add -A web/
git commit -m "style(web/system): Biome 代码检查与格式化"
```

---

## Task 19: 集成验证

**Files:** 无（验证步骤）

- [ ] **Step 1: 后端全量测试**

Run: `make api-test`
Expected: 全部 PASS

- [ ] **Step 2: 后端 lint**

Run: `make api-lint`
Expected: 无报错

- [ ] **Step 3: 前端全量测试**

Run: `make web-test`
Expected: 全部 PASS

- [ ] **Step 4: 前端类型检查**

Run: `make web-typecheck`
Expected: 无错误

- [ ] **Step 5: 启动开发环境手动验证**

Run: `make dev`

手动验证清单：
1. 访问 `/admin/system`，页面正常渲染
2. 顶部 4 张指标卡显示数值，环形进度有动画
3. 6 个趋势 Tab 可切换，图表渲染含动画
4. 等 30s 后历史图出现数据点
5. 底部运行时/依赖/网络面板正常
6. 关闭「自动刷新」后轮询停止
7. 暗色主题下图表颜色正确

- [ ] **Step 6: 如有修复则提交，否则无操作**

---

## Self-Review 结果

**1. Spec 覆盖：**
- ✅ 服务器硬件指标（CPU/内存/磁盘/网络/负载）→ Task 3 collector
- ✅ 应用运行时指标（Goroutine/GC/线程/CGO/进程数/Uptime）→ Task 3 collector
- ✅ 依赖状态（Postgres/Redis 探活+连接池）→ Task 4 service checkDependencies
- ✅ 历史趋势（全量指标）→ Task 5 sampler + Task 15 HistoryCharts
- ✅ Redis 缓存（24h/30s）→ Task 4 StoreSample + Task 5 sampler
- ✅ 前端轮询（5s/30s）→ Task 12 queries
- ✅ shadcn charts + 动画 → Task 9-15
- ✅ admin-only 权限 → Task 7（路由挂在 admin 组内，继承 Auth+AdminRequired）
- ✅ 两个端点 `/admin/system/snapshot` + `/history` → Task 7

**2. 占位符扫描：** 无 TBD/TODO，所有步骤含完整代码。

**3. 类型一致性：** 已核对：`MetricCollector` 接口（Task 4 定义，Task 3 collector 实现，Task 5 sampler 依赖）、`redisStore` 接口（Task 5 定义，Task 4 Service 实现）、DTO 字段名（Go `dto.go` 与 TS `types.ts` 对应，含 `SamplePoint` 精简字段如 `cpu.u`/`m.up` 等）。

**4. 已知需注意点：**
- Task 15 的 `tabs` 组件 import 路径需按实际确认（Step 2 已含验证步骤）。
- Task 17 的 `button`/`switch` import 路径用了 `@/shared/ui/base/...`，若实际在 `@/shared/ui/` 下需修正——已在 Step 5 类型检查兜底。

---

## Execution Handoff

计划已保存到 `docs/superpowers/plans/2026-07-03-admin-server-monitor.md`。
