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
