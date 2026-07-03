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
