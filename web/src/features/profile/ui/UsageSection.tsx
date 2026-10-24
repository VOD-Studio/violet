import { Button, Segmented, type SegmentedItem } from "@violet/ui";
import { type ReactNode, useState } from "react";
import { useUsage } from "../api/usage-queries";
import type { UsageRange } from "../model/usage";
import { SectionCard } from "./SectionCard";
import { UsageModelsTable } from "./UsageModelsTable";
import { UsageSummaryCards } from "./UsageSummaryCards";
import { UsageTrendChart } from "./UsageTrendChart";

const ranges: SegmentedItem<UsageRange>[] = [
	{ value: "7d", label: "近 7 天" },
	{ value: "30d", label: "近 30 天" },
	{ value: "90d", label: "近 90 天" },
];

/** 当前账号的 OMP 用量面板，仅在用量 Tab 激活后挂载查询。 */
export function UsageSection() {
	const [range, setRange] = useState<UsageRange>("30d");
	const { summary, models, timeseries } = useUsage(range);
	const hasError = summary.isError || models.isError || timeseries.isError;
	const isFetching = summary.isFetching || models.isFetching || timeseries.isFetching;
	const retry = () => {
		void summary.refetch();
		void models.refetch();
		void timeseries.refetch();
	};

	let content: ReactNode;
	if (hasError) {
		content = (
			<SectionCard title="暂时无法加载用量">
				<p role="alert" className="mb-4 text-sm text-muted-foreground">
					用量服务暂时不可用，请稍后重试。此次加载失败不会显示为零用量。
				</p>
				<Button variant="outline" onClick={retry} loading={isFetching}>
					重试
				</Button>
			</SectionCard>
		);
	} else if (!summary.data || !models.data || !timeseries.data) {
		content = (
			<div
				role="status"
				aria-busy="true"
				className="rounded-xl border bg-card p-6 text-sm text-muted-foreground"
			>
				正在加载用量…
			</div>
		);
	} else if (summary.data.requests === 0) {
		content = (
			<SectionCard
				title="这段时间还没有用量记录"
				description="安装 OMP 用量扩展后，请求统计会自动汇总到这里。"
			>
				<ol className="mb-5 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
					<li>创建仅含 usage:write 权限的访问令牌。</li>
					<li>按安装指南配置扩展和接收站点，再发起一次模型请求。</li>
					<li>等待扩展上传后刷新；已有记录也可尝试切换时间范围。</li>
				</ol>
				<div className="flex flex-wrap gap-3">
					<Button asChild variant="outline">
						<a
							href="https://github.com/VOD-Studio/violet/blob/release/2.0/docs/guides/omp-usage.md"
							target="_blank"
							rel="noreferrer"
						>
							查看安装指南
						</a>
					</Button>
					<Button variant="ghost" onClick={retry} loading={isFetching}>
						刷新用量
					</Button>
				</div>
			</SectionCard>
		);
	} else {
		content = (
			<>
				<UsageSummaryCards summary={summary.data} />
				<UsageTrendChart points={timeseries.data.points} />
				<UsageModelsTable models={models.data.models} />
			</>
		);
	}

	return (
		<section aria-label="模型用量" className="space-y-6">
			<div className="flex flex-wrap items-start justify-between gap-4">
				<div>
					<h2 className="text-lg font-semibold">用量</h2>
					<p className="mt-1 max-w-prose text-sm text-muted-foreground">
						仅展示当前账号的 OMP 请求。API 等价成本以美元估算，不代表订阅实际账单。
					</p>
				</div>
				<Segmented
					aria-label="统计时间范围"
					value={range}
					onValueChange={setRange}
					segments={ranges}
				/>
			</div>
			{content}
		</section>
	);
}
