/** admin-system 模块类型定义 */

/** 服务器实时快照，一次采集返回的完整状态切片 */
export interface SystemSnapshotDTO {
	/** 采集时间戳（RFC3339） */
	timestamp: string;
	/** 主机信息 */
	host: SystemHostInfoDTO;
	/** CPU 使用情况 */
	cpu: SystemCPUInfoDTO;
	/** 内存使用情况 */
	memory: SystemMemoryInfoDTO;
	/** 各挂载点磁盘使用情况 */
	disk: SystemDiskInfoDTO[];
	/** 网络信息（接口列表 + IO 累计/速率） */
	network: SystemNetworkInfoDTO;
	/** 系统负载（1/5/15 分钟） */
	load: SystemLoadInfoDTO;
	/** Go 运行时信息 */
	runtime: SystemRuntimeInfoDTO;
	/** 依赖服务（PostgreSQL/Redis）探活状态 */
	dependencies: SystemDepStatusDTO;
}

/** 主机信息 */
export interface SystemHostInfoDTO {
	/** 主机名 */
	hostname: string;
	/** 操作系统 */
	os: string;
	/** 发行版/平台 */
	platform: string;
	/** 内核架构 */
	kernelArch: string;
	/** 启动时间（RFC3339） */
	bootTime: string;
}

/** CPU 使用情况 */
export interface SystemCPUInfoDTO {
	/** 总体使用率（0-100） */
	usagePercent: number;
	/** 逻辑核心数 */
	cores: number;
	/** 每核使用率（长度 = cores） */
	perCore: number[];
	/** CPU 型号 */
	modelName: string;
	/** 主频 MHz */
	mhz: number;
}

/** 内存使用情况 */
export interface SystemMemoryInfoDTO {
	/** 总内存（字节） */
	totalBytes: number;
	/** 已用内存（字节） */
	usedBytes: number;
	/** 内存使用率（0-100） */
	usedPercent: number;
	/** 可用内存（字节） */
	available: number;
	/** 缓存（字节） */
	cached: number;
	/** Swap 总量（字节） */
	swapTotal: number;
	/** Swap 已用（字节） */
	swapUsed: number;
	/** Swap 使用率（0-100） */
	swapPercent: number;
}

/** 单挂载点磁盘使用情况 */
export interface SystemDiskInfoDTO {
	/** 设备名 */
	device: string;
	/** 文件系统类型 */
	fstype: string;
	/** 挂载路径 */
	path: string;
	/** 总容量（字节） */
	totalBytes: number;
	/** 已用（字节） */
	usedBytes: number;
	/** 使用率（0-100） */
	usedPercent: number;
	/** IO 累计读取字节（按设备关联 disk.IOCounters，取不到为 0） */
	readBytes: number;
	/** IO 累计写入字节 */
	writeBytes: number;
}

/** 网络信息 */
export interface SystemNetworkInfoDTO {
	/** 网络接口列表 */
	interfaces: SystemNetInterfaceDTO[];
	/** 网络 IO 累计值与速率 */
	io: SystemNetIODTO;
}

/** 网络接口 */
export interface SystemNetInterfaceDTO {
	/** 接口名 */
	name: string;
	/** MTU */
	mtu: number;
	/** 标志位（up/broadcast 等） */
	flags: string[];
	/** 绑定地址列表 */
	addrs: string[];
}

/** 网络 IO 累计值与速率 */
export interface SystemNetIODTO {
	/** 累计发送字节 */
	bytesSent: number;
	/** 累计接收字节 */
	bytesRecv: number;
	/** 累计发送包数 */
	packetsSent: number;
	/** 累计接收包数 */
	packetsRecv: number;
	/** 发送速率（字节/秒） */
	sendRateBytes: number;
	/** 接收速率（字节/秒） */
	recvRateBytes: number;
}

/** 系统负载 */
export interface SystemLoadInfoDTO {
	/** 1 分钟平均负载 */
	load1: number;
	/** 5 分钟平均负载 */
	load5: number;
	/** 15 分钟平均负载 */
	load15: number;
}

/** Go 运行时信息 */
export interface SystemRuntimeInfoDTO {
	/** Go 版本 */
	goVersion: string;
	/** 当前 goroutine 数 */
	goroutines: number;
	/** 累计 CGO 调用次数 */
	numCgoCall: number;
	/** 当前线程数 */
	numThreads: number;
	/** 进程数 */
	processCount: number;
	/** 进程运行时长（秒） */
	uptimeSeconds: number;
	/** 进程启动时间（RFC3339） */
	startTime: string;
	/** Go 内存统计 */
	memStats: SystemGoMemStatsDTO;
	/** GC 统计 */
	gc: SystemGCStatsDTO;
}

/** Go 内存统计 */
export interface SystemGoMemStatsDTO {
	/** 已分配字节 */
	allocBytes: number;
	/** 从系统获取的字节 */
	sysBytes: number;
	/** 堆对象数 */
	heapObjects: number;
	/** 下次 GC 阈值（字节） */
	nextGCBytes: number;
}

/** GC 统计 */
export interface SystemGCStatsDTO {
	/** GC 总次数 */
	numGC: number;
	/** GC 总暂停时间（纳秒） */
	pauseTotalNs: number;
	/** 上次 GC 暂停时间（纳秒） */
	lastPauseNs: number;
}

/** 依赖服务状态 */
export interface SystemDepStatusDTO {
	/** PostgreSQL 探活结果 */
	postgres: SystemDependencyCheckDTO;
	/** Redis 探活结果 */
	redis: SystemDependencyCheckDTO;
}

/** 单依赖探活结果 */
export interface SystemDependencyCheckDTO {
	/** 是否连通 */
	connected: boolean;
	/** 探活延迟（毫秒） */
	latencyMs: number;
	/** 失败时的错误信息 */
	error: string;
	/** 连接池统计 */
	pool: SystemPoolStatsDTO;
}

/** 连接池统计 */
export interface SystemPoolStatsDTO {
	/** 在用连接数 */
	inUse: number;
	/** 空闲连接数 */
	idle: number;
	/** 最大连接数 */
	maxOpen: number;
	/** 等待获取连接的累计次数 */
	waitCount: number;
}

/** 历史趋势响应，interval 固定 30s（与后端 sampler 一致） */
export interface SystemHistoryDTO {
	/** 采样间隔（秒，固定 30） */
	interval: number;
	/** 采样点列表（按时间升序） */
	points: SystemSamplePointDTO[];
}

/** 单个历史采样点；后端为控制 Redis 存储体积用了短键，此处原样保留并在每个字段注释里给出全名映射 */
export interface SystemSamplePointDTO {
	/** 采样时间戳（RFC3339，对应 ts） */
	ts: string;
	/** CPU 指标 */
	cpu: {
		/** 总体使用率（对应 usagePercent） */
		u: number;
		/** 每核使用率（对应 perCore） */
		pc: number[];
	};
	/** 内存指标 */
	m: {
		/** 内存使用率（对应 usedPercent） */
		up: number;
		/** 已用内存字节（对应 usedBytes） */
		ub: number;
		/** Swap 使用率（对应 swapPercent） */
		sp: number;
		/** Go 已分配字节（对应 runtime.memStats.allocBytes） */
		ga: number;
	};
	/** 磁盘指标（每个挂载点） */
	d: {
		/** 挂载路径（对应 path） */
		p: string;
		/** 使用率（对应 usedPercent） */
		up: number;
		/** 读取字节（对应 readBytes） */
		rb: number;
		/** 写入字节（对应 writeBytes） */
		wb: number;
	}[];
	/** 网络指标 */
	n: {
		/** 累计发送字节（对应 bytesSent） */
		s: number;
		/** 累计接收字节（对应 bytesRecv） */
		r: number;
		/** 发送速率（对应 sendRateBytes） */
		sr: number;
		/** 接收速率（对应 recvRateBytes） */
		rr: number;
	};
	/** 负载指标 */
	ld: {
		/** 1 分钟（对应 load1） */
		l1: number;
		/** 5 分钟（对应 load5） */
		l5: number;
		/** 15 分钟（对应 load15） */
		l15: number;
	};
	/** Go 运行时指标 */
	rt: {
		/** goroutine 数（对应 goroutines） */
		gr: number;
		/** GC 次数（对应 gc.numGC） */
		gc: number;
		/** 堆对象数（对应 memStats.heapObjects） */
		ho: number;
		/** 线程数（对应 numThreads） */
		th: number;
		/** CGO 调用数（对应 numCgoCall） */
		cg: number;
	};
	/** 依赖延迟（毫秒） */
	dep: {
		/** PostgreSQL 延迟（对应 postgres.latencyMs） */
		pg: number;
		/** Redis 延迟（对应 redis.latencyMs） */
		rds: number;
	};
}

/** PostgreSQL 运行状态与统计视图聚合。 */
export interface DatabaseStatusDTO {
	collected_at: string;
	database_size: number;
	total_connections: number;
	max_connections: number;
	table_count: number;
	migration: MigrationStatusDTO;
	pool: DatabasePoolStatsDTO;
	tables: DatabaseTableDTO[];
	top_indexes: DatabaseIndexDTO[];
	active_queries: DatabaseActivityDTO[];
}

export interface MigrationStatusDTO {
	version: number;
	dirty: boolean;
}

export interface DatabasePoolStatsDTO {
	inUse: number;
	idle: number;
	maxOpen: number;
	waitCount: number;
}

export interface DatabaseTableDTO {
	schema: string;
	name: string;
	estimated_rows: number;
	table_size: number;
	index_size: number;
	total_size: number;
	dead_tuples: number;
	last_vacuum: string | null;
	last_analyze: string | null;
	statistics_fresh: boolean;
}

export interface DatabaseIndexDTO {
	schema: string;
	table: string;
	name: string;
	scans: number;
	tuples_read: number;
	size: number;
}

export interface DatabaseActivityDTO {
	pid: number;
	user: string;
	state: string;
	wait_event_type: string;
	wait_event: string;
	query_started_at: string | null;
	duration_seconds: number;
	query: string;
}

export interface DatabaseSchemaDTO {
	tables: DatabaseSchemaTableDTO[];
	relationships: DatabaseSchemaRelationshipDTO[];
}

export interface DatabaseSchemaTableDTO {
	schema: string;
	name: string;
	columns: DatabaseSchemaColumnDTO[];
}

export interface DatabaseSchemaColumnDTO {
	name: string;
	data_type: string;
	nullable: boolean;
}

export interface DatabaseSchemaRelationshipDTO {
	name: string;
	source_schema: string;
	source_table: string;
	source_columns: string[];
	target_schema: string;
	target_table: string;
	target_columns: string[];
	/** PostgreSQL 外键更新动作，如 CASCADE 或 NO ACTION。 */
	on_update: string;
	/** PostgreSQL 外键删除动作，如 CASCADE 或 NO ACTION。 */
	on_delete: string;
}

export interface ExecuteSQLInput {
	sql: string;
	allow_multi: boolean;
	confirm_dangerous: boolean;
	with_explain: boolean;
}

export interface SQLResultDTO {
	columns: string[];
	rows: unknown[][];
	affected_rows: number;
	elapsed_ms: number;
	statement_type: string;
	truncated: boolean;
}

export interface ExportInput {
	source: "table" | "query";
	schema: string;
	table: string;
	query: string;
	format: "csv" | "sql";
	include_columns: boolean;
}

export interface BackupInfoDTO {
	filename: string;
	origin: "manual" | "auto" | "import";
	created_at: string;
	size: number;
	uploads_filename?: string;
	uploads_size?: number;
	database_tool: string;
}

export interface BackupSettingsDTO {
	auto_enabled: boolean;
	/** UTC HH:mm。 */
	time_utc: string;
	retention_count: number;
	include_uploads: boolean;
}

export interface BackupRunResultDTO {
	at: string;
	ok: boolean;
	filename?: string;
	error?: string;
}

export interface BackupSettingsViewDTO extends BackupSettingsDTO {
	next_run_at?: string;
	last_run?: BackupRunResultDTO;
}

export interface BackupListDTO {
	backups: BackupInfoDTO[];
	settings: BackupSettingsViewDTO;
}

export interface BackupTaskDTO {
	id: string;
	kind: "backup" | "restore";
	status: "running" | "succeeded" | "failed";
	message: string;
	progress: number;
	error?: string;
	result_file?: string;
	started_at: string;
	finished_at?: string;
}
