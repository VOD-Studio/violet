import { formatUsageCost, formatUsageNumber, formatUsagePercent } from "../lib/usage-format";
import type { UsageSummary } from "../model/usage";

/** 当前窗口的六项用量指标。 */
export function UsageSummaryCards({ summary }: { summary: UsageSummary }) {
	const metrics = [
		{ label: "请求数", value: formatUsageNumber(summary.requests), detail: "包含失败请求" },
		{
			label: "总 token",
			value: formatUsageNumber(summary.total_tokens),
			detail: "含缓存；推理不重复计入",
		},
		{
			label: "API 等价成本",
			value: formatUsageCost(summary.api_cost_estimate),
			detail: "USD 估算，非订阅账单",
		},
		{
			label: "缓存命中率",
			value: formatUsagePercent(summary.cache_rate),
			detail: "缓存读取 / 输入与缓存 token",
		},
		{
			label: "生成速度",
			value: `${formatUsageNumber(summary.avg_tokens_per_second)} tokens/s`,
			detail: "仅统计有效计时的成功请求",
		},
		{
			label: "错误率",
			value: formatUsagePercent(summary.error_rate),
			detail: `${formatUsageNumber(summary.errors)} 次失败请求`,
		},
	];

	return (
		<dl className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 xl:grid-cols-3">
			{metrics.map(({ label, value, detail }) => (
				<div key={label} className="min-w-0 rounded-xl border bg-card p-4">
					<dt className="text-sm text-muted-foreground">{label}</dt>
					<dd className="mt-2 wrap-break-word text-xl font-semibold tabular-nums">
						{value}
					</dd>
					<dd className="mt-1 text-xs leading-relaxed text-muted-foreground">{detail}</dd>
				</div>
			))}
		</dl>
	);
}
