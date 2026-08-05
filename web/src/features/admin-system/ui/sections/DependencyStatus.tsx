import { Badge } from "@shared/ui/base/badge";
import type { SystemDepStatusDTO } from "../../model/types";
import { formatLatency } from "../format";

/** DependencyStatusProps - 依赖状态条 props */
interface DependencyStatusProps {
	/** 依赖探活结果（PostgreSQL / Redis） */
	dependencies: SystemDepStatusDTO;
	/** 紧凑模式：控制台视图用单行，否则用卡片栅格 */
	compact?: boolean;
}

/** DependencyStatus - PostgreSQL / Redis 探活状态展示 */
export function DependencyStatus({ dependencies, compact = false }: DependencyStatusProps) {
	if (compact) {
		return (
			<div className="flex items-center gap-3 text-xs">
				<DepBadge name="PostgreSQL" dep={dependencies.postgres} />
				<DepBadge name="Redis" dep={dependencies.redis} />
			</div>
		);
	}
	return (
		<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
			<DepCard name="PostgreSQL" dep={dependencies.postgres} />
			<DepCard name="Redis" dep={dependencies.redis} />
		</div>
	);
}

/** DepBadge - 紧凑模式单依赖标签（绿点 + 名称 + 延迟） */
function DepBadge({ name, dep }: { name: string; dep: SystemDepStatusDTO["postgres"] }) {
	const ok = dep.connected;
	return (
		<span className="text-muted-foreground inline-flex items-center gap-1.5">
			<span
				className={`inline-block size-1.5 rounded-full ${ok ? "bg-emerald-500" : "bg-red-500"}`}
			/>
			<span className="text-foreground font-medium">{name}</span>
			<span className="tabular-nums">{ok ? formatLatency(dep.latencyMs) : "断开"}</span>
		</span>
	);
}

/** DepCard - 完整模式单依赖卡片（含连接池统计） */
function DepCard({ name, dep }: { name: string; dep: SystemDepStatusDTO["postgres"] }) {
	const ok = dep.connected;
	return (
		<div className="border-border bg-card rounded-lg border p-3">
			<div className="mb-2 flex items-center justify-between">
				<span className="text-sm font-medium">{name}</span>
				<Badge variant={ok ? "secondary" : "destructive"}>{ok ? "正常" : "异常"}</Badge>
			</div>
			<dl className="text-muted-foreground grid grid-cols-2 gap-x-3 gap-y-1 text-xs tabular-nums">
				<dt>延迟</dt>
				<dd className="text-foreground text-right">
					{ok ? formatLatency(dep.latencyMs) : "-"}
				</dd>
				<dt>在用/空闲</dt>
				<dd className="text-foreground text-right">
					{ok ? `${dep.pool.inUse}/${dep.pool.idle}` : "-"}
				</dd>
				<dt>最大连接</dt>
				<dd className="text-foreground text-right">{ok ? dep.pool.maxOpen : "-"}</dd>
				<dt>等待次数</dt>
				<dd className="text-foreground text-right">{ok ? dep.pool.waitCount : "-"}</dd>
			</dl>
			{!ok && dep.error && (
				<p className="text-destructive mt-2 truncate text-xs" title={dep.error}>
					{dep.error}
				</p>
			)}
		</div>
	);
}
