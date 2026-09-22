/** 动效红线：约束连同事由成文 */
const MOTION_RULES = [
	{
		rule: "非必要不使用缩放",
		why: "悬停、选中、打开关闭等常规状态不得靠 scale 制造反馈，优先颜色、描边、阴影与透明度；只有交互语义本身是缩放时（图片预览、画布缩放）才用。",
	},
	{
		rule: "非必要不使用方向性位移",
		why: "普通面板、详情区、卡片与弹层默认直接呈现或仅淡入淡出；只有需要表达明确空间来源或去向时才滑入滑出。",
	},
] as const;

/** 现役动效 token：时长与节奏的既有惯例（如实陈列，非立法） */
const ACTIVE_MOTIONS = [
	{ name: "diagram-enter / tab-panel-in", note: "0.2–0.25s ease-out，内容进场的时间基准。" },
	{ name: "caret-blink", note: "1s 光标闪烁。" },
	{
		name: "blob / nexus-shimmer / marquee",
		note: "7s / 1.6s / 40s，舞台与横滚的舞台级循环动效。",
	},
	{
		name: "View Transitions",
		note: "页面转场走 transitions.css，morph 抖动由统一容器尺寸约束。",
	},
] as const;

/**
 * 动效章程章内容：红线连同事由、现役动效清单，及 reduced-motion 底线。
 */
export function MotionCharter() {
	return (
		<div className="mt-8">
			<ol className="space-y-6">
				{MOTION_RULES.map((item) => (
					<li className="border-l-2 border-border/50 pl-5" key={item.rule}>
						<p className="text-base font-bold">{item.rule}</p>
						<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
							{item.why}
						</p>
					</li>
				))}
			</ol>
			<h4 className="mt-10 text-base font-bold">现役动效</h4>
			<ul className="mt-3">
				{ACTIVE_MOTIONS.map((motion) => (
					<li
						className="grid grid-cols-1 gap-x-6 gap-y-1 border-b border-border/40 py-2.5 sm:grid-cols-[16rem_1fr] sm:items-baseline"
						key={motion.name}
					>
						<code className="font-mono text-xs text-muted-foreground">
							{motion.name}
						</code>
						<span className="text-sm leading-relaxed text-muted-foreground">
							{motion.note}
						</span>
					</li>
				))}
			</ul>
			<p className="mt-8 max-w-prose border-l-2 border-border/50 pl-5 text-sm leading-relaxed text-muted-foreground">
				底线：一切动效尊重 prefers-reduced-motion，降级为直接呈现。
			</p>
		</div>
	);
}
