import { layoutTransition } from "@shared/lib/motion";
import { motion, useReducedMotion } from "motion/react";
import { type ReactNode, useState } from "react";
import {
	BlurIn,
	BorderBeam,
	FadeIn,
	Magnetic,
	NumberFlow,
	ScaleIn,
	Shine,
	SlideIn,
	StaggerGroup,
	StaggerItem,
	TextReveal,
} from "./motion-effects";

/**
 * 动效四职责：为效果归类。任何动效必居其一，职责不明 = 不该动。
 */
const DUTIES = [
	{ name: "反馈", gloss: "确认操作已被接收" },
	{ name: "浮现", gloss: "新内容进入界面" },
	{ name: "流动", gloss: "状态间保持连续" },
	{ name: "氛围", gloss: "舞台级生命感" },
] as const;

/** 三律法：所有效果的物理约束。 */
const LAWS = [
	{ name: "合成层律", rule: "只动 transform / opacity / paint-only 属性，杜绝布局抖动。" },
	{ name: "场景律", rule: "运动形态由空间语义决定，不脱离场景套动画。" },
	{
		name: "快进快出律",
		rule: "入场温和 ease-out，离场约七成时长；尊重 prefers-reduced-motion。",
	},
] as const;

/** 效果卡：活样例即真相，可重播，附一行用法。 */
function EffectCard({
	name,
	note,
	usage,
	children,
}: {
	name: string;
	note: string;
	usage: string;
	children: (replayKey: number) => ReactNode;
}) {
	const [replayKey, setReplayKey] = useState(0);

	return (
		<div className="flex flex-col rounded-xl border border-border/40 bg-card p-5">
			<div className="flex items-center justify-between gap-2">
				<h5 className="text-sm font-bold">{name}</h5>
				<button
					type="button"
					className="rounded-md border border-border/40 px-2 py-0.5 font-mono text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
					onClick={() => setReplayKey((k) => k + 1)}
				>
					重播
				</button>
			</div>
			<p className="mt-1 text-xs leading-relaxed text-muted-foreground">{note}</p>
			<div className="mt-4 flex min-h-28 items-center justify-center rounded-lg border border-border/30 bg-muted/20 p-4">
				{children(replayKey)}
			</div>
			<code className="mt-3 font-mono text-[11px] text-muted-foreground">{usage}</code>
		</div>
	);
}

/** 画廊演示占位内容：统一观感。 */
function Demo({ children }: { children: ReactNode }) {
	return (
		<div className="rounded-lg border border-border/40 bg-card px-4 py-3 text-sm font-medium shadow-[0_4px_24px_rgba(0,0,0,0.05)]">
			{children}
		</div>
	);
}

/**
 * 动效章程章：效果库画廊。
 * 每个效果都是可直接引用的组件（design-system/ui/motion-effects），
 * 新组件出现时从库里取效果包裹即可，不再绑死于具体控件。
 */
export function MotionCharter() {
	const reduce = useReducedMotion();

	return (
		<div className="mt-8">
			{/* 总纲 */}
			<div className="grid grid-cols-1 gap-x-6 gap-y-3 border-b border-border/40 py-6 sm:grid-cols-[10rem_1fr]">
				<h4 className="text-base font-bold">总纲</h4>
				<div>
					<p className="text-sm leading-relaxed text-muted-foreground">
						本章是全站的动效效果库：下列效果均为可直接引用的组件（
						<code className="font-mono text-xs">design-system/ui/motion-effects</code>
						），新组件从库里取效果包裹即可。归类看动效职责——
						{DUTIES.map((duty) => `${duty.name}（${duty.gloss}）`).join("、")}。
					</p>
					<ol className="mt-3 space-y-1.5">
						{LAWS.map((law) => (
							<li className="text-sm text-muted-foreground" key={law.name}>
								<span className="font-bold text-foreground">{law.name}</span>
								<span className="ml-2">{law.rule}</span>
							</li>
						))}
					</ol>
				</div>
			</div>

			{/* 效果画廊 */}
			<div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
				<EffectCard
					name="FadeIn · 淡入"
					note="最克制的进场，默认优先选它。"
					usage="<FadeIn>{children}</FadeIn>"
				>
					{(key) => (
						<FadeIn key={key}>
							<Demo>花一叶，皆成文章</Demo>
						</FadeIn>
					)}
				</EffectCard>

				<EffectCard
					name="SlideIn · 滑入"
					note="方向性进场，仅用于表达明确空间来源。"
					usage='<SlideIn direction="up">{children}</SlideIn>'
				>
					{(key) => (
						<SlideIn key={key} direction="up">
							<Demo>自下方滑入</Demo>
						</SlideIn>
					)}
				</EffectCard>

				<EffectCard
					name="BlurIn · 模糊聚焦"
					note="内容自虚化对焦，适合标题与主视觉。"
					usage="<BlurIn>{children}</BlurIn>"
				>
					{(key) => (
						<BlurIn key={key}>
							<Demo>对焦完成</Demo>
						</BlurIn>
					)}
				</EffectCard>

				<EffectCard
					name="ScaleIn · 缩放入座"
					note="自 0.92 微缩落座，适合卡片与插图。"
					usage="<ScaleIn>{children}</ScaleIn>"
				>
					{(key) => (
						<ScaleIn key={key}>
							<Demo>平稳落座</Demo>
						</ScaleIn>
					)}
				</EffectCard>

				<EffectCard
					name="TextReveal · 逐词揭示"
					note="文字自下方依序浮现，标题动效的招牌。"
					usage='<TextReveal text="标题文本" />'
				>
					{(key) => (
						<TextReveal
							key={key}
							text="一花一叶 皆成文章"
							className="text-lg font-bold"
						/>
					)}
				</EffectCard>

				<EffectCard
					name="Stagger · 级联编排"
					note="列表与卡组依序进入，节奏 80ms 递进。"
					usage="<StaggerGroup><StaggerItem>…</StaggerItem></StaggerGroup>"
				>
					{(key) => (
						<StaggerGroup key={key} className="flex gap-2">
							{["壹", "贰", "叁"].map((word) => (
								<StaggerItem key={word}>
									<Demo>{word}</Demo>
								</StaggerItem>
							))}
						</StaggerGroup>
					)}
				</EffectCard>

				<EffectCard
					name="NumberFlow · 数字滚动"
					note="数值变化滚动到新值，等宽数字防抖动。"
					usage="<NumberFlow value={12846} />"
				>
					{() => <NumberFlow value={12846} className="text-2xl font-bold" />}
				</EffectCard>

				<EffectCard
					name="Shine · 扫光"
					note="高光周期性掠过，用于勋章、封面与强调卡。"
					usage="<Shine interval={3}>{children}</Shine>"
				>
					{(key) => (
						<Shine key={key} interval={2.4} className="rounded-lg">
							<Demo>扫光掠过</Demo>
						</Shine>
					)}
				</EffectCard>

				<EffectCard
					name="BorderBeam · 流光边框"
					note="一道光斑沿边框环绕，用于焦点态与特性卡。"
					usage="<BorderBeam duration={4}>{children}</BorderBeam>"
				>
					{(key) => (
						<BorderBeam key={key}>
							<div className="rounded-xl px-4 py-3 text-sm font-medium">流光环绕</div>
						</BorderBeam>
					)}
				</EffectCard>

				<EffectCard
					name="Magnetic · 磁吸"
					note="内容向指针方向弹性跟随，用于主要操作。"
					usage="<Magnetic strength={0.25}>{children}</Magnetic>"
				>
					{(key) => (
						<Magnetic key={key} strength={0.3}>
							<motion.button
								type="button"
								className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground select-none"
								whileTap={reduce ? undefined : { scale: 0.97 }}
								transition={reduce ? undefined : layoutTransition}
							>
								移入试试磁吸
							</motion.button>
						</Magnetic>
					)}
				</EffectCard>
			</div>

			{/* 体系与底线 */}
			<div className="mt-6 grid grid-cols-1 gap-x-6 gap-y-3 border-b border-border/40 py-6 sm:grid-cols-[10rem_1fr]">
				<h4 className="text-base font-bold">既有体系</h4>
				<ul className="space-y-1.5 text-sm text-muted-foreground">
					<li>
						页面转场走 View Transitions（纸页翻动 / 交叉溶淡 / 主题涟漪）。锚点：
						<code className="font-mono text-xs">styles/transitions.css</code>
					</li>
					<li>
						内容进场沿用
						<code className="font-mono text-xs">tab-panel-in</code>
						；舞台级循环（blob / marquee / caret）仅限氛围装饰位。
					</li>
					<li>
						控件的浮层与弹窗动效由 Radix 组件自带（fade + 微缩放 +
						方向微距），节奏参照三律法。
					</li>
					<li>新效果先查本章；查无此项时按三律法推导，并把结论沉淀回本章。</li>
				</ul>
			</div>
		</div>
	);
}
