import { PageShell } from "@shared/ui/page-shell";
import type { ReactNode } from "react";
import { ComponentSpecimens } from "./ComponentSpecimens";
import { LayoutSpec } from "./LayoutSpec";
import { MotionCharter } from "./MotionCharter";
import { QuickDecisionTable } from "./QuickDecisionTable";
import { TokenDictionary } from "./TokenDictionary";

/**
 * 设计总纲四字箴言：快速决策表查无此项时回退的最高判据。
 */
const PRINCIPLES = [
	{ word: "有效", gloss: "一切样式服务于内容与任务，装饰不越位。" },
	{ word: "清晰", gloss: "层级靠字号、字重、间距与对比表达，一眼可知主次。" },
	{ word: "准确", gloss: "token 即法定用量：语义类名优先，规格照表，不引用不存在之物。" },
	{ word: "美", gloss: "克制而后独特：动效克制、留白大方，在统一中露出本站气质。" },
] as const;

/**
 * 贯穿全站的底线：任何界面不得逾越，数字细则归各规格章节。
 */
const BASELINES = [
	"语义 token 优先，不引用不存在的 token。",
	"文字与背景满足 WCAG AA 对比度。",
	"非必要不用缩放与方向位移动效。",
	"功能性圆角不过 rounded-2xl，硬投影一律禁用。",
] as const;

/**
 * 营造章节骨架：content 的章节已在卷内成文，其余由后续营造逐章落地。
 */
interface CodexChapter {
	/** 汉字数字章号 */
	num: string;
	name: string;
	/** 一句范围说明 */
	scope: string;
	/** 章内已成文的内容；缺省渲染「营造中」占位 */
	content?: ReactNode;
}

export const CHAPTERS: CodexChapter[] = [
	{
		num: "壹",
		name: "设计原则",
		scope: "查表无果时回退的最高判据，与贯穿全站的底线。",
		content: <DesignPrinciples />,
	},
	{
		num: "贰",
		name: "快速决策表",
		scope: "不知道该用哪个 token 时，先查这张表。表里没有的，回到基本原则。",
		content: <QuickDecisionTable />,
	},
	{
		num: "叁",
		name: "色板生成器",
		scope: "选择一个主色，色彩生成算法为你生成完整的色板。",
	},
	{
		num: "肆",
		name: "token 词典",
		scope: "品牌色、功能色、中性色、语义色——全部语义 token 的名称与实时值。",
		content: <TokenDictionary />,
	},
	{
		num: "伍",
		name: "布局规格",
		scope: "间距、圆角、投影与容器的法定刻度。",
		content: <LayoutSpec />,
	},
	{
		num: "陆",
		name: "组件活样例",
		scope: "真实控件活体陈列，样例即真相。",
		content: <ComponentSpecimens />,
	},
	{
		num: "柒",
		name: "动效章程",
		scope: "运动的时间、幅度与克制的事由。",
		content: <MotionCharter />,
	},
];

/**
 * 营造法式——站点设计系统典籍页。
 *
 * 宋体典籍呈现：箴言立四柱，章节按「章号 + 章名 + 范围」成卷，
 * 已成文章节在卷内成文，未落地章节以「营造中」诚实占位。
 */
export function DesignSystemPage() {
	return (
		<PageShell className="font-serif">
			<header className="mb-12">
				<p className="mb-2 font-mono text-xs tracking-[0.3em] text-muted-foreground uppercase">
					The Design System
				</p>
				<h1 className="text-5xl font-bold tracking-wide">营造法式</h1>
				<p className="mt-4 leading-relaxed text-muted-foreground">
					站点的用色、用料与营造章程。
				</p>
			</header>

			{CHAPTERS.map((chapter) => (
				<section
					aria-labelledby={`codex-chapter-${chapter.num}`}
					className="border-t border-border/60 py-10 first:border-t-0 first:pt-0"
					key={chapter.name}
				>
					<div className="flex items-baseline gap-3">
						<span className="font-mono text-sm text-muted-foreground">
							{chapter.num}
						</span>
						<h2 className="text-2xl font-bold" id={`codex-chapter-${chapter.num}`}>
							{chapter.name}
						</h2>
						{chapter.content ? null : (
							<span className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
								营造中
							</span>
						)}
					</div>
					<p className="mt-3 max-w-prose leading-relaxed text-muted-foreground">
						{chapter.scope}
					</p>

					{chapter.content}
				</section>
			))}
		</PageShell>
	);
}

/**
 * 设计原则章内容：四柱箴言立纲，底线四条压舱。
 */
function DesignPrinciples() {
	return (
		<>
			<dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-10 md:grid-cols-4">
				{PRINCIPLES.map((principle) => (
					<div className="border-l-2 border-border/50 pl-5" key={principle.word}>
						<dt className="text-4xl font-bold tracking-wide">{principle.word}</dt>
						<dd className="mt-3 text-sm leading-relaxed text-muted-foreground">
							{principle.gloss}
						</dd>
					</div>
				))}
			</dl>
			<ul className="mt-10 max-w-prose space-y-3">
				{BASELINES.map((line, index) => (
					<li className="flex items-baseline gap-4 text-sm" key={line}>
						<span className="font-mono text-xs text-muted-foreground">
							{String(index + 1).padStart(2, "0")}
						</span>
						<span className="leading-relaxed">{line}</span>
					</li>
				))}
			</ul>
		</>
	);
}
