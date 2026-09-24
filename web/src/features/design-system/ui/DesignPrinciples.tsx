import { BASELINES, PRINCIPLES } from "../model/navigation";

/**
 * 设计原则章视图：箴言四柱立纲，全站底线压舱。
 */
export function DesignPrinciples() {
	return (
		<div className="space-y-12">
			{/* 四柱箴言 */}
			<dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-10 md:grid-cols-4">
				{PRINCIPLES.map((principle) => (
					<div
						className="border-l-2 border-primary/30 pl-5 transition-colors hover:border-primary"
						key={principle.word}
					>
						<dt className="font-serif text-4xl font-bold tracking-wide text-foreground">
							{principle.word}
						</dt>
						<dd className="mt-3 text-sm leading-relaxed text-muted-foreground">
							{principle.gloss}
						</dd>
					</div>
				))}
			</dl>

			{/* 底线四条 */}
			<div className="mt-12 max-w-prose border-t border-border/40 pt-8">
				<div className="mb-4 flex items-center justify-between">
					<h3 className="font-serif text-base font-semibold tracking-wide text-foreground">
						贯穿全站的底线
					</h3>
					<span className="font-mono text-xs text-muted-foreground/60">不可逾越</span>
				</div>
				<ul className="space-y-3.5">
					{BASELINES.map((line, index) => (
						<li className="flex items-baseline gap-4 text-sm" key={line}>
							<span className="font-mono text-xs text-primary/70">
								{String(index + 1).padStart(2, "0")}
							</span>
							<span className="leading-relaxed text-foreground/90">{line}</span>
						</li>
					))}
				</ul>
			</div>
		</div>
	);
}
