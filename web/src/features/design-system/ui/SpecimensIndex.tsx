import { Link } from "@tanstack/react-router";
import { ArrowUpRight, MessageSquareCode } from "lucide-react";
import { ALL_NAV_ITEMS } from "../model/navigation";
import { DesignSystemDocHeader } from "./DesignSystemDocHeader";

const SPECIMENS_ITEM = ALL_NAV_ITEMS.find((item) => item.id === "specimens");
const COMPONENTS = SPECIMENS_ITEM?.children ?? [];

/**
 * 组件目录入口页：提供各独立组件文档的导览索引。
 */
export function SpecimensIndex() {
	return (
		<div className="space-y-10">
			<DesignSystemDocHeader
				num="柒"
				title="组件目录"
				scope="全站通用复合组件索引与高保真交互文档。每个组件享有独立路由、完整状态沙盒与属性契约。"
			/>

			{/* 分类索引列表 */}
			<section aria-label="组件列表" className="space-y-4">
				<div className="flex items-center justify-between border-b border-border/40 pb-2">
					<h3 className="text-sm font-bold text-foreground">复合交互套件 (Composite)</h3>
					<span className="font-mono text-xs text-muted-foreground">
						{COMPONENTS.length} 篇文档
					</span>
				</div>

				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					{COMPONENTS.map((item) => (
						<Link
							key={item.id}
							to={item.to}
							className="group relative flex flex-col justify-between rounded-xl border border-border/70 bg-card/60 p-5 transition-all hover:border-primary/40 hover:bg-card hover:shadow-[0_4px_24px_rgba(0,0,0,0.04)]"
						>
							<div className="space-y-2.5">
								<div className="flex items-center justify-between">
									<div className="flex size-9 items-center justify-center rounded-lg bg-brand-wash text-brand-wash-foreground">
										<MessageSquareCode className="size-4.5" />
									</div>
									<ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary" />
								</div>
								<div>
									<h4 className="text-sm font-bold tracking-tight text-foreground group-hover:text-primary">
										{item.title}
									</h4>
									<p className="mt-1 text-xs leading-relaxed text-muted-foreground">
										{item.description}
									</p>
								</div>
							</div>

							<div className="mt-4 flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/30 font-mono text-[10px] text-muted-foreground">
								<span className="rounded bg-muted/60 px-1.5 py-0.5">
									纯展示解耦
								</span>
								<span className="rounded bg-muted/60 px-1.5 py-0.5">两层扁平</span>
								<span className="rounded bg-muted/60 px-1.5 py-0.5">插槽扩展</span>
							</div>
						</Link>
					))}
				</div>
			</section>
		</div>
	);
}
