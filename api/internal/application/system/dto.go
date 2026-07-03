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
	// IO 累计读取字节（按设备名关联 disk.IOCounters；取不到时为 0）
	ReadBytes uint64 `json:"readBytes"`
	// IO 累计写入字节
	WriteBytes uint64 `json:"writeBytes"`
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
	Connected bool      `json:"connected"`
	LatencyMs int64     `json:"latencyMs"`
	Error     string    `json:"error"`
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
		Gr      int    `json:"gr"`
		NumGC   uint32 `json:"gc"`
		HeapObj uint64 `json:"ho"`
		Threads int    `json:"th"`
		NumCgo  int64  `json:"cg"`
	} `json:"rt"`
	Deps struct {
		PgMs  int64 `json:"pg"`
		RdsMs int64 `json:"rds"`
	} `json:"dep"`
}
