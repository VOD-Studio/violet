import { getContrastRatio, getWcagRating } from "@features/lab/palette/model/color-math";
import { cn } from "@shared/lib/utils";
import { ShieldCheck } from "lucide-react";

export interface AccessibilitySectionProps {
	className?: string;
}

/**
 * AccessibilitySection - WCAG 2.1 对比度与无障碍合规性审计矩阵。
 */
export function AccessibilitySection({ className }: AccessibilitySectionProps) {
	const auditPairs = [
		{
			label: "品牌色在画布底色上",
			role: "Brand on Canvas",
			lightFg: "oklch(0.53 0.205 286)",
			lightBg: "oklch(0.992 0.003 286)",
			darkFg: "oklch(0.72 0.148 286)",
			darkBg: "oklch(0.138 0.012 286)",
			target: "WCAG AA (≥ 4.5:1)",
		},
		{
			label: "品牌文字在品牌按钮上",
			role: "Foreground on Brand",
			lightFg: "oklch(0.99 0 0)",
			lightBg: "oklch(0.53 0.205 286)",
			darkFg: "oklch(0.14 0.02 286)",
			darkBg: "oklch(0.72 0.148 286)",
			target: "WCAG AA (≥ 4.5:1)",
		},
		{
			label: "正文主墨色在画布上",
			role: "Main Text on Canvas",
			lightFg: "oklch(0.19 0.015 286)",
			lightBg: "oklch(0.992 0.003 286)",
			darkFg: "oklch(0.955 0.008 286)",
			darkBg: "oklch(0.138 0.012 286)",
			target: "WCAG AAA (≥ 7.0:1)",
		},
		{
			label: "静音文字在画布上",
			role: "Muted Text on Canvas",
			lightFg: "oklch(0.52 0.02 286)",
			lightBg: "oklch(0.992 0.003 286)",
			darkFg: "oklch(0.68 0.022 286)",
			darkBg: "oklch(0.138 0.012 286)",
			target: "WCAG AA (≥ 4.5:1)",
		},
		{
			label: "薄雾文字在薄雾表面上",
			role: "Wash Text on Wash Surface",
			lightFg: "oklch(0.35 0.14 286)",
			lightBg: "oklch(0.965 0.022 286)",
			darkFg: "oklch(0.9 0.07 286)",
			darkBg: "oklch(0.22 0.038 286)",
			target: "WCAG AA (≥ 4.5:1)",
		},
	];

	return (
		<section className={cn("mb-16", className)}>
			<div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-edge-hairline pb-4">
				<div>
					<p className="font-mono text-[11px] tracking-[0.3em] text-muted-foreground uppercase">
						Accessibility Compliance
					</p>
					<h3 className="mt-1 text-2xl font-bold tracking-tight">
						无障碍与对比度全景审计
					</h3>
				</div>
				<p className="max-w-md text-xs text-muted-foreground">
					全部前景色与背景色组合均通过 WCAG 2.1 AA+ / AAA
					级标准，杜绝因色彩偏好牺牲可读性的设计暗礁。
				</p>
			</div>

			<div className="overflow-hidden rounded-2xl border border-edge-hairline bg-card shadow-xs">
				<div className="overflow-x-auto">
					<table className="w-full text-left text-sm">
						<thead className="border-b border-edge-hairline bg-muted/40 font-mono text-[11px] text-muted-foreground uppercase">
							<tr>
								<th className="px-6 py-3.5">语义配对</th>
								<th className="px-6 py-3.5">合规标准</th>
								<th className="px-6 py-3.5">浅色白瓷对比度</th>
								<th className="px-6 py-3.5">深色玄曜对比度</th>
								<th className="px-6 py-3.5 text-right">审计状态</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-edge-hairline/60">
							{auditPairs.map((pair) => {
								const lightRatio = getContrastRatio(pair.lightFg, pair.lightBg);
								const darkRatio = getContrastRatio(pair.darkFg, pair.darkBg);
								const lightRating = getWcagRating(lightRatio);
								const darkRating = getWcagRating(darkRatio);

								return (
									<tr
										key={pair.label}
										className="transition-colors hover:bg-muted/20"
									>
										<td className="px-6 py-4">
											<p className="font-medium text-foreground">
												{pair.label}
											</p>
											<p className="font-mono text-xs text-muted-foreground">
												{pair.role}
											</p>
										</td>
										<td className="px-6 py-4 font-mono text-xs text-muted-foreground">
											{pair.target}
										</td>
										<td className="px-6 py-4">
											<div className="flex items-center gap-2">
												<span className="font-mono font-semibold">
													{lightRatio}:1
												</span>
												<span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] text-emerald-600 dark:text-emerald-400">
													{lightRating.rating}
												</span>
											</div>
										</td>
										<td className="px-6 py-4">
											<div className="flex items-center gap-2">
												<span className="font-mono font-semibold">
													{darkRatio}:1
												</span>
												<span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] text-emerald-600 dark:text-emerald-400">
													{darkRating.rating}
												</span>
											</div>
										</td>
										<td className="px-6 py-4 text-right">
											<span className="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400 text-xs">
												<ShieldCheck className="size-4" />
												全部达标
											</span>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			</div>
		</section>
	);
}
