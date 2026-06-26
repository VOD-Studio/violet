import Empty from "@shared/ui/empty";
import Loader from "@shared/ui/loader";

import { useContributions } from "../api/queries";

/** 贡献强度对应的色阶 class（双主题由 CSS 变量驱动） */
const LEVEL_COLORS = [
	"bg-muted/50",
	"bg-sky-200/40 dark:bg-sky-900/40",
	"bg-sky-400/60 dark:bg-sky-700/60",
	"bg-sky-600/80 dark:bg-sky-500/80",
	"bg-sky-800 dark:bg-sky-400",
];

/**
 * Contributions - GitHub 贡献热力图
 *
 * 支持：
 * - Loader 加载态
 * - 错误/空降级（贡献图失败不影响整页，显示 Empty）
 * - 鼠标 hover 显示当日提交数
 */
const Contributions = () => {
	const { data, isLoading, isError } = useContributions();

	if (isLoading) {
		return <Loader size="sm" />;
	}
	// 后端在 GitHub token 未配置或上游失败时可能返回 contributions: null
	// （而非空数组）。这里对内层数组再兜一层，避免 null.map 崩整页。
	const contributions = Array.isArray(data?.contributions) ? data.contributions : [];
	if (isError || !data || contributions.length === 0) {
		return (
			<Empty
				size="sm"
				title="无贡献数据"
				description={isError ? "加载失败" : undefined}
				className="py-4"
			/>
		);
	}

	return (
		<div>
			<p className="text-sm text-muted-foreground mb-3">过去一年共 {data.total} 次贡献</p>
			<div className="grid grid-flow-col grid-rows-7 gap-1">
				{contributions.map((c) => (
					<div
						key={c.date}
						title={`${c.date}: ${c.count} 次`}
						className={`w-3 h-3 rounded-sm ${LEVEL_COLORS[c.level]}`}
					/>
				))}
			</div>
		</div>
	);
};

export default Contributions;
