import { Link } from "@tanstack/react-router";
import { ArrowUpRight, UserRound } from "lucide-react";

/** 快捷模块配置项契约 */
export interface QuickModuleItem {
	id: string;
	name: string;
	icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
	to: string;
}

interface HeaderContributionModulesProps {
	onNavigate?: () => void;
}

/** 预设模块入口列表：第一项为人设，后续新模块在此统一配置追加 */
const DEFAULT_QUICK_MODULES: QuickModuleItem[] = [
	{
		id: "persona",
		name: "人设",
		icon: UserRound,
		to: "/persona",
	},
];

/**
 * 站长档案卡片快捷模块入口列表
 *
 * 紧随倒计时下方自上而下顺排，通栏卡片兼顾单项饱满度与多模块垂直扩展。
 */
export function HeaderContributionModules({ onNavigate }: HeaderContributionModulesProps) {
	return (
		<div className="border-t border-border/40 pt-3">
			<div className="space-y-1.5">
				{DEFAULT_QUICK_MODULES.map((item) => {
					const Icon = item.icon;
					return (
						<Link
							key={item.id}
							to={item.to}
							onClick={onNavigate}
							className="group flex w-full items-center justify-between rounded-lg border border-border/50 bg-muted/20 px-2.5 py-1.5 text-xs font-medium text-foreground transition-all duration-200 hover:border-foreground/30 hover:bg-muted/50 active:scale-[0.99]"
						>
							<div className="flex items-center gap-2">
								<span className="flex size-5 items-center justify-center rounded-md bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
									<Icon className="size-3" aria-hidden="true" />
								</span>
								<span>{item.name}</span>
							</div>
							<ArrowUpRight
								className="size-3 text-muted-foreground/40 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground"
								aria-hidden="true"
							/>
						</Link>
					);
				})}
			</div>
		</div>
	);
}
