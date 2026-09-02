import { LABS } from "@features/lab/model/registry";
import { cn } from "@shared/lib/utils";
import { BackLink } from "@shared/ui/back-link";

/**
 * LabHeader - lab 子页统一页头
 *
 * 只传路由 to，序号 / 英文签 / 标题 / 描述 / meta 全部取自 LABS 注册表，
 * 索引页与子页共用同一数据源，文案永不漂移。布局与其他 lab 页的
 * Segmented/Intent/Preview 陈列同语言：mono 小签 + hairline 分隔线。
 */
export function LabHeader({
	to,
	className,
}: {
	to: (typeof LABS)[number]["to"];
	className?: string;
}) {
	const index = LABS.findIndex((l) => l.to === to);
	if (index < 0) return null;
	const lab = LABS[index];
	const no = String(index + 1).padStart(2, "0");
	const total = String(LABS.length).padStart(2, "0");

	return (
		<header className={cn("mb-16", className)}>
			<BackLink to="/lab" label="Labs" className="mb-10" />
			<div className="flex flex-wrap items-end justify-between gap-4 border-b border-edge-hairline pb-8">
				<div>
					<p className="mb-4 font-mono text-[11px] tracking-[0.3em] text-muted-foreground uppercase">
						Exp {no} / {total} · {lab.en}
					</p>
					<h1 className="text-4xl font-bold tracking-tight md:text-5xl">{lab.title}</h1>
				</div>
				<p className="shrink-0 pb-1 font-mono text-[11px] text-muted-foreground">
					{lab.meta}
				</p>
			</div>
			<p className="mt-6 text-muted-foreground">{lab.description}</p>
		</header>
	);
}
