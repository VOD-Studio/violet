import { DECISION_CATEGORIES } from "../model/decisions";

/**
 * 快速决策表章内容：按裁定分类陈列「场景 → token → 理由」，
 * token 名为真实文本可直接复制；表尾指向壹·设计原则的回退指引。
 */
export function QuickDecisionTable() {
	return (
		<div className="mt-8">
			{DECISION_CATEGORIES.map((category) => (
				<section aria-label={category.title} className="mb-8 last:mb-0" key={category.id}>
					<h3 className="text-lg font-bold">{category.title}</h3>
					<ul className="mt-3">
						{category.rows.map((row) => (
							<li
								className="grid grid-cols-1 gap-x-6 gap-y-1 border-b border-border/40 py-2.5 sm:grid-cols-[14rem_1fr_1.5fr] sm:items-baseline"
								key={row.className}
							>
								<span className="text-sm font-medium">{row.scene}</span>
								<code className="font-mono text-xs text-muted-foreground">
									{row.className}
								</code>
								<span className="text-sm leading-relaxed text-muted-foreground">
									{row.reason}
								</span>
							</li>
						))}
					</ul>
				</section>
			))}
			<p className="mt-8 max-w-prose border-l-2 border-border/50 pl-5 text-sm leading-relaxed text-muted-foreground">
				查无此项：回壹·设计原则，以「有效、清晰、准确、美」自行推导；
				推导出的新裁定经人工确认后入表，表永远是判例汇编而非立法者。
			</p>
		</div>
	);
}
