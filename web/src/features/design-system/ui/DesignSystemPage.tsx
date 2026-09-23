import { useReducedMotion } from "@shared/lib/motion";
import { cn } from "@shared/lib/utils";
import { PageShell } from "@shared/ui/page-shell";
import type { ReactNode } from "react";
import { useLayoutEffect, useRef, useState } from "react";
import { ComponentSpecimens } from "./ComponentSpecimens";
import { LayoutSpec } from "./LayoutSpec";
import { MotionCharter } from "./MotionCharter";
import { PaletteGenerator } from "./PaletteGenerator";
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

/** 章节标识：菜单取值。 */
type ChapterId =
	| "principles"
	| "decisions"
	| "palette"
	| "tokens"
	| "layout"
	| "specimens"
	| "motion";

/**
 * 营造章节：菜单一次只呈一章，未落地章以「营造中」诚实占位。
 */
interface CodexChapter {
	/** 章节标识 */
	id: ChapterId;
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
		id: "principles",
		num: "壹",
		name: "设计原则",
		scope: "查表无果时回退的最高判据，与贯穿全站的底线。",
		content: <DesignPrinciples />,
	},
	{
		id: "decisions",
		num: "贰",
		name: "快速决策表",
		scope: "不知道该用哪个 token 时，先查这张表。表里没有的，回到基本原则。",
		content: <QuickDecisionTable />,
	},
	{
		id: "palette",
		num: "叁",
		name: "色板生成器",
		scope: "以单一主色为种，推演全域色阶、语义角色与中性基准。",
		content: <PaletteGenerator />,
	},
	{
		id: "tokens",
		num: "肆",
		name: "token 词典",
		scope: "品牌色、功能色、中性色、语义色——全部语义 token 的名称与实时值。",
		content: <TokenDictionary />,
	},
	{
		id: "layout",
		num: "伍",
		name: "布局规格",
		scope: "间距、圆角、投影与容器的法定刻度。",
		content: <LayoutSpec />,
	},
	{
		id: "specimens",
		num: "陆",
		name: "组件活样例",
		scope: "真实控件活体陈列，样例即真相。",
		content: <ComponentSpecimens />,
	},
	{
		id: "motion",
		num: "柒",
		name: "动效章程",
		scope: "运动的时间、幅度与克制的事由。",
		content: <MotionCharter />,
	},
];

/**
 * 营造法式——站点设计系统典籍页。
 *
 * 左侧典籍目录立卷目，滑动墨线指示当前章；
 * 右侧一次只呈一章，换页以淡出淡入交叉过渡。
 */
export function DesignSystemPage() {
	const [activeId, setActiveId] = useState<ChapterId>("principles");
	const active = CHAPTERS.find((chapter) => chapter.id === activeId) ?? CHAPTERS[0];
	const reduce = useReducedMotion();

	const listRef = useRef<HTMLUListElement>(null);
	const [marker, setMarker] = useState<{ top: number; height: number } | null>(null);
	useLayoutEffect(() => {
		const measure = () => {
			const current = listRef.current?.querySelector<HTMLElement>(
				`[data-chapter-id='${active.id}']`,
			);
			if (!current) return;
			setMarker({ top: current.offsetTop, height: current.offsetHeight });
		};
		measure();
		window.addEventListener("resize", measure);
		return () => window.removeEventListener("resize", measure);
	}, [active.id]);

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

			<div className="flex flex-col gap-8 lg:flex-row lg:gap-16">
				<nav aria-label="营造章节" className="lg:sticky lg:top-24 lg:self-start">
					<ul
						ref={listRef}
						className="relative flex flex-row flex-wrap gap-2 lg:w-44 lg:flex-col lg:gap-0"
					>
						{marker && (
							<span
								aria-hidden
								className="absolute left-0 hidden w-0.5 rounded-full bg-primary transition-[top,height] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none lg:block"
								style={{ top: marker.top, height: marker.height }}
							/>
						)}
						{CHAPTERS.map((chapter) => {
							const current = chapter.id === active.id;
							return (
								<li key={chapter.id}>
									<button
										type="button"
										onClick={() => setActiveId(chapter.id)}
										aria-current={current ? "true" : undefined}
										data-chapter-id={chapter.id}
										className={cn(
											"flex items-baseline gap-3 py-2.5 pr-3 pl-5 text-left transition-colors duration-300",
											current
												? "text-foreground"
												: "text-muted-foreground hover:text-foreground",
										)}
									>
										<span
											className={cn(
												"text-xs transition-colors duration-300",
												current
													? "text-primary"
													: "text-muted-foreground/60",
											)}
										>
											{chapter.num}
										</span>
										<span className="text-[15px] tracking-wide">
											{chapter.name}
										</span>
									</button>
								</li>
							);
						})}
					</ul>
				</nav>

				<div className="min-w-0 flex-1">
					<section
						aria-labelledby={`chapter-${active.id}`}
						key={active.id}
						className={cn(
							reduce
								? ""
								: "animate-in fade-in-50 slide-in-from-bottom-1.5 duration-300 ease-out",
						)}
					>
						<div className="flex items-baseline gap-3">
							<span className="font-mono text-sm text-muted-foreground">
								{active.num}
							</span>
							<h2 className="text-2xl font-bold" id={`chapter-${active.id}`}>
								{active.name}
							</h2>
							{active.content ? null : (
								<span className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
									营造中
								</span>
							)}
						</div>
						<p className="mt-3 max-w-prose leading-relaxed text-muted-foreground">
							{active.scope}
						</p>

						{active.content}
					</section>
				</div>
			</div>
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
