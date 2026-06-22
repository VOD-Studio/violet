import { useContributions } from "../api/queries";

/** 贡献强度对应的色阶 class（双主题由 CSS 变量驱动） */
const LEVEL_COLORS = [
	"bg-muted",
	"bg-primary/30",
	"bg-primary/50",
	"bg-primary/70",
	"bg-primary",
];

/**
 * Contributions - GitHub 贡献热力图
 *
 * 支持：
 * - Skeleton 加载态
 * - 错误降级（贡献图失败不影响整页，只显示提示文案）
 * - 鼠标 hover 显示当日提交数
 */
const Contributions = () => {
	const { data, isLoading, isError } = useContributions();

	if (isLoading) {
		return <div className="h-32 rounded-lg bg-muted animate-pulse" />;
	}
	if (isError || !data) {
		return <p className="text-sm text-muted-foreground">贡献图加载失败</p>;
	}

	return (
		<div>
			<p className="text-sm text-muted-foreground mb-3">
				过去一年共 {data.total} 次贡献
			</p>
			<div className="grid grid-flow-col grid-rows-7 gap-1">
				{data.contributions.map((c) => (
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
