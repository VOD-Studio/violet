import { useUsage } from "@features/profile/api/usage-queries";
import type { UsageRange } from "@features/profile/model/usage";
import { SectionCard } from "@features/profile/ui/SectionCard";
import { UsageModelsTable } from "@features/profile/ui/UsageModelsTable";
import { UsageSetupDialog } from "@features/profile/ui/UsageSetupDialog";
import { UsageSummaryCards } from "@features/profile/ui/UsageSummaryCards";
import { UsageTrendChart } from "@features/profile/ui/UsageTrendChart";
import { Button, Segmented, type SegmentedItem } from "@violet/ui";
import { type ReactNode, useState } from "react";

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
					请稍后重试。
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
			<SectionCard title="暂无用量" description="接入 OMP 后自动记录。">
				<div className="flex flex-wrap gap-3">
					<UsageSetupDialog />
					<Button
						variant="ghost"
						aria-label="刷新用量"
						onClick={retry}
						loading={isFetching}
					>
						刷新
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
			<div className="flex flex-wrap items-center justify-between gap-4">
				<h2 className="text-lg font-semibold">用量</h2>
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
