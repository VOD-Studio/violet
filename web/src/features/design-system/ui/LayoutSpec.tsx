import type { ReactNode } from "react";

/** 间距对照样例：4px 一档的常用档位，条长即实际占宽 */
const SPACING_STEPS = [
	{ utility: "w-1", px: 4 },
	{ utility: "w-2", px: 8 },
	{ utility: "w-4", px: 16 },
	{ utility: "w-6", px: 24 },
	{ utility: "w-8", px: 32 },
	{ utility: "w-12", px: 48 },
	{ utility: "w-16", px: 64 },
] as const;

/** 圆角档位对照样例：功能性圆角到 rounded-2xl 封顶，胶囊是形态不是超限圆角 */
const RADIUS_STEPS = [
	{ utility: "rounded-sm", label: "sm" },
	{ utility: "rounded-md", label: "md" },
	{ utility: "rounded-lg", label: "lg" },
	{ utility: "rounded-2xl", label: "2xl · 上限" },
	{ utility: "rounded-full", label: "胶囊 · 形态豁免" },
] as const;

/** 字号档位对照样例（现状如实陈列，无字号 token） */
const TYPE_STEPS = [
	{ utility: "text-xs", sample: "注释与注文" },
	{ utility: "text-sm", sample: "辅助说明" },
	{ utility: "text-base", sample: "正文" },
	{ utility: "text-lg", sample: "小标目" },
	{ utility: "text-2xl", sample: "章名" },
	{ utility: "text-4xl", sample: "大字" },
] as const;

function SpecRow({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="grid grid-cols-1 gap-x-6 gap-y-3 border-b border-border/40 py-6 sm:grid-cols-[10rem_1fr]">
			<h4 className="text-base font-bold">{label}</h4>
			<div>{children}</div>
		</div>
	);
}

function SampleNote({ children }: { children: ReactNode }) {
	return <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{children}</p>;
}

/**
 * 布局规格章内容：间距、圆角、投影与浮起、容器、字号的法定刻度，
 * 全部配实排版对照样例。
 */
export function LayoutSpec() {
	return (
		<div className="mt-8">
			<SpecRow label="间距">
				<div className="space-y-2">
					{SPACING_STEPS.map((step) => (
						<div className="flex items-center gap-4" key={step.utility}>
							<code className="w-12 font-mono text-xs text-muted-foreground">
								{step.utility}
							</code>
							<div className={`h-3 bg-brand-wash ${step.utility}`} />
							<span className="font-mono text-xs text-muted-foreground">
								{step.px}px
							</span>
						</div>
					))}
				</div>
				<SampleNote>
					Tailwind 默认 4px 一档；任意值豁免仅限非 4px 倍数或非间距尺度。
				</SampleNote>
			</SpecRow>

			<SpecRow label="圆角">
				<div className="flex flex-wrap items-center gap-4">
					{RADIUS_STEPS.map((step) => (
						<div className="text-center" key={step.utility}>
							<div
								className={`h-16 w-24 border border-border bg-muted ${step.utility}`}
							/>
							<code className="mt-1 block font-mono text-xs text-muted-foreground">
								{step.label}
							</code>
						</div>
					))}
				</div>
				<SampleNote>
					功能性圆角上限 rounded-2xl（16px），再大只是装饰；胶囊 rounded-full
					是形态不是超限圆角。
				</SampleNote>
			</SpecRow>

			<SpecRow label="投影与浮起">
				<div className="flex flex-wrap items-start gap-6">
					<div className="rounded-lg bg-card p-4 ring-1 ring-border">
						<p className="text-sm font-medium">描边</p>
						<p className="mt-1 font-mono text-xs text-muted-foreground">
							ring-1 ring-border
						</p>
					</div>
					<div className="rounded-lg bg-card p-4 shadow-[0_4px_24px_rgba(0,0,0,0.05)]">
						<p className="text-sm font-medium">轻微浮起感 · 唯一配方</p>
						<p className="mt-1 font-mono text-xs text-muted-foreground">
							0 4px 24px / 0.05 软影
						</p>
					</div>
					<div className="rounded-lg bg-card p-4 opacity-60 shadow-lg">
						<p className="text-sm font-medium line-through">硬投影</p>
						<p className="mt-1 text-xs text-muted-foreground">又重又俗，禁用</p>
					</div>
				</div>
				<SampleNote>
					ring-1 ring-border 只是描边分界，不是浮起。浮起感唯一配方：0 4px 24px / 0.05
					的轻微软影；硬投影一律禁用。暗色域软影弱，可加描边辅助分界。
				</SampleNote>
			</SpecRow>

			<SpecRow label="容器">
				<SampleNote>
					前台内容页统一容器：container mx-auto，水平内边距 px-4 / md:px-6，垂直 py-8 /
					md:py-12；首页、关于页等全宽沉浸页自行管理布局，不套容器。
				</SampleNote>
			</SpecRow>

			<SpecRow label="字号">
				<div className="space-y-3">
					{TYPE_STEPS.map((step) => (
						<div className="flex items-baseline gap-4" key={step.utility}>
							<code className="w-20 shrink-0 font-mono text-xs text-muted-foreground">
								{step.utility}
							</code>
							<span className={step.utility}>{step.sample}</span>
						</div>
					))}
				</div>
				<SampleNote>
					字号无独立 token，按 Tailwind 档位取用；层级优先靠字重与色彩搭配。
				</SampleNote>
			</SpecRow>
		</div>
	);
}
