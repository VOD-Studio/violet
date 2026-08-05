import { Database, Wifi } from "lucide-react";
import type { ReactNode } from "react";
import type { SystemSnapshotDTO } from "../model/types";

/** DependencyPanelProps - 依赖状态面板 props */
interface DependencyPanelProps {
	/** 实时快照（取 dependencies 字段）；未就绪时返回 null */
	data?: SystemSnapshotDTO;
}

/** DependencyPanel - 依赖状态面板（PostgreSQL / Redis 探活 + 连接池） */
export function DependencyPanel({ data }: DependencyPanelProps) {
	if (!data) return null;
	return (
		<div>
			<h3 className="mb-3 font-semibold">依赖状态</h3>
			<div className="grid gap-3 sm:grid-cols-2">
				<DepCard
					name="PostgreSQL"
					icon={<Database className="size-4" />}
					dep={data.dependencies.postgres}
				/>
				<DepCard
					name="Redis"
					icon={<Wifi className="size-4" />}
					dep={data.dependencies.redis}
				/>
			</div>
		</div>
	);
}

/** DepCardProps - 单依赖卡片 props */
interface DepCardProps {
	/** 依赖名 */
	name: string;
	/** lucide 图标 */
	icon: ReactNode;
	/** 单依赖探活结果 */
	dep: SystemSnapshotDTO["dependencies"]["postgres"];
}

/** DepCard - 单依赖卡片（连通脉动 / 断开 shake + 延迟进度条 + 连接池统计） */
function DepCard({ name, icon, dep }: DepCardProps) {
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
					<div className="bg-muted mt-1 h-1.5 overflow-hidden rounded-full">
						<div
							className="h-full rounded-full transition-all duration-500"
							style={{
								width: `${Math.min(dep.latencyMs, 100)}%`,
								background: "var(--chart-2)",
							}}
						/>
					</div>
					<p className="text-muted-foreground mt-1 text-xs">
						连接池: {dep.pool.inUse} 使用 / {dep.pool.idle} 空闲 / {dep.pool.maxOpen}{" "}
						上限
					</p>
				</>
			) : (
				<p className="text-destructive text-xs">{dep.error}</p>
			)}
		</div>
	);
}
