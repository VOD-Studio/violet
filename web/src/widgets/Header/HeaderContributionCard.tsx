import type { PublicPersona } from "@entities/persona/model/types";
import { useContributions } from "@features/github/api/queries";
import { useSettings } from "@features/settings/api/queries";
import { HeaderContributionHeatmap } from "./HeaderContributionHeatmap";
import { HeaderContributionIdentity } from "./HeaderContributionIdentity";
import { HeaderContributionModules } from "./HeaderContributionModules";
import { HeaderTimeCountdowns } from "./HeaderTimeCountdowns";
import { HeaderYearProgress } from "./HeaderYearProgress";

interface HeaderContributionCardProps {
	onNavigate?: () => void;
	persona?: PublicPersona;
}

/**
 * 站长开源档案与贡献卡片
 *
 * 聚合左栏（身份档案、社交矩阵、近 3 个月日粒度热力图）与右栏（时光倒计时、独立模块入口、年度历程进度）。
 */
export function HeaderContributionCard({ persona, onNavigate }: HeaderContributionCardProps) {
	const { data: settings } = useSettings();
	const { data: githubData } = useContributions();

	return (
		<div className="w-112.5 max-w-[calc(100vw-2rem)] p-1 text-foreground">
			<div className="grid grid-cols-1 gap-5 sm:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
				{/* 左侧：站长身份、社交与开源热力图 */}
				<div className="space-y-4">
					<HeaderContributionIdentity
						settings={settings}
						persona={persona}
						onNavigate={onNavigate}
					/>
					<HeaderContributionHeatmap
						githubUsername={settings?.github_username}
						contributions={githubData?.contributions}
						totalContributions={githubData?.total_contributions}
					/>
				</div>

				{/* 右侧：时光倒计时、独立模块区与里程碑进度 */}
				<div className="flex flex-col justify-between border-t border-border/40 pt-4 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-5">
					<div className="space-y-3.5">
						<HeaderTimeCountdowns />
						<HeaderContributionModules onNavigate={onNavigate} />
					</div>
					<HeaderYearProgress />
				</div>
			</div>
		</div>
	);
}
