import { type ReactNode, useState } from "react";
import {
	AuroraGlow,
	BorderBeam,
	CheckmarkDraw,
	CopyButton,
	CounterBadge,
	FadeIn,
	HoldToConfirm,
	InfiniteMarquee,
	InkRipple,
	Magnetic,
	NumberFlow,
	PillSlider,
	PulseDot,
	QuoteLine,
	ScaleIn,
	Shake,
	Shine,
	SlideIn,
	StaggerGroup,
	StaggerItem,
	TextReveal,
	TextUnderline,
	TiltCard,
	WavyUnderline,
} from "./motion-effects";

/**
 * 动效四职责：任何动效必居其一，职责不明 = 不该动。
 */
const DUTIES = [
	{ name: "反馈", gloss: "确认操作已被接收，赋予界面物理触感" },
	{ name: "浮现", gloss: "新内容进入界面，表达空间来源" },
	{ name: "流动", gloss: "状态间保持连续，消除突兀跳变" },
	{ name: "氛围", gloss: "舞台级生命感，静水流深" },
] as const;

/** 三律法：所有动效的物理约束。 */
const LAWS = [
	{ name: "合成层律", rule: "只动 transform / opacity / filter / stroke，杜绝布局颠簸。" },
	{ name: "场景律", rule: "运动形态由物理与空间语义决定，不脱离场景套动画。" },
	{
		name: "快进快出律",
		rule: "入场温和 ease-out，离场更快（约七成时长）；尊重 prefers-reduced-motion。",
	},
] as const;

/** 交互类效果卡：提供亲手试玩的交互沙盒。 */
function InteractiveCard({
	name,
	note,
	usage,
	children,
}: {
	name: string;
	note: string;
	usage: string;
	children: ReactNode;
}) {
	return (
		<div className="flex flex-col rounded-xl border border-border/40 bg-card p-5">
			<div className="flex items-center justify-between gap-2">
				<h5 className="text-sm font-bold">{name}</h5>
				<span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
					交互试玩
				</span>
			</div>
			<p className="mt-1 text-xs leading-relaxed text-muted-foreground">{note}</p>
			<div className="mt-4 flex min-h-32 items-center justify-center rounded-lg border border-border/30 bg-muted/20 p-4">
				{children}
			</div>
			<code className="mt-3 font-mono text-[11px] text-muted-foreground">{usage}</code>
		</div>
	);
}

/** 浮现/氛围类效果卡：活样例即真相，可重播，附一行用法。 */
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
			<div className="mt-4 flex min-h-32 items-center justify-center rounded-lg border border-border/30 bg-muted/20 p-4">
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

export function MotionCharter() {
	const [activeSegment, setActiveSegment] = useState("week");
	const [checked, setChecked] = useState(true);
	const [shakeTrigger, setShakeTrigger] = useState(0);
	const [counter, setCounter] = useState(42);

	return (
		<div className="mt-8 space-y-10">
			<div className="grid grid-cols-1 gap-x-6 gap-y-3 border-b border-border/40 py-6 sm:grid-cols-[10rem_1fr]">
				<h4 className="text-base font-bold">总纲</h4>
				<div>
					<p className="text-sm leading-relaxed text-muted-foreground">
						本章是全站的自研动效效果库：零三方动画运行时（无 motion/react
						依赖），纯粹基于现代 CSS 合成层与 Web API 构建。组件直接从{" "}
						<code className="font-mono text-xs">design-system/ui/motion-effects</code>{" "}
						取用包裹。 任何动效必居四职责之一——
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

			<div>
				<div className="mb-4">
					<h4 className="text-base font-bold tracking-wide">
						一、交互类动效（反馈与流体连续）
					</h4>
					<p className="mt-1 text-xs text-muted-foreground">
						操作的即时反馈与物理连续性，赋予界面真实的质感与操纵乐趣。
					</p>
				</div>
				<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
					<InteractiveCard
						name="TiltCard · 3D 聚光灯卡片"
						note="鼠标移入产生立体透视俯仰微倾斜，伴随聚光灯高光随光标流转。"
						usage="<TiltCard spotlight maxAngle={8}>{children}</TiltCard>"
					>
						<TiltCard className="w-64 border border-border/40 bg-card p-4 shadow-[0_4px_24px_rgba(0,0,0,0.05)]">
							<div className="font-serif text-sm font-bold">典籍纸面微光</div>
							<p className="mt-1 text-xs text-muted-foreground">
								移入并在卡片四周移动指针体验立体倾斜与聚光高光
							</p>
						</TiltCard>
					</InteractiveCard>

					<InteractiveCard
						name="PillSlider · 流体滑动胶囊"
						note="多选项切换时，背景胶囊利用纯 CSS 平滑滑移拉伸，无需 layoutId。"
						usage="<PillSlider items={items} activeId={id} onChange={setId} />"
					>
						<PillSlider
							items={[
								{ id: "day", label: "日刻" },
								{ id: "week", label: "周序" },
								{ id: "month", label: "月览" },
								{ id: "year", label: "年鉴" },
							]}
							activeId={activeSegment}
							onChange={setActiveSegment}
						/>
					</InteractiveCard>

					<InteractiveCard
						name="Magnetic · 磁吸纽扣"
						note="光标靠近时向指针弹性偏移，移出时弹簧阻尼回弹，用于主要操作。"
						usage="<Magnetic strength={0.3}>{button}</Magnetic>"
					>
						<Magnetic strength={0.35}>
							<button
								type="button"
								className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground shadow-sm transition-transform active:scale-95"
							>
								移入试试磁吸
							</button>
						</Magnetic>
					</InteractiveCard>

					<InteractiveCard
						name="InkRipple · 墨晕水波"
						note="点击交互时，以触点坐标为圆心泛起一圈东方墨韵微澜自然淡隐。"
						usage="<InkRipple color='...'>{children}</InkRipple>"
					>
						<InkRipple className="rounded-lg border border-border/40 bg-card px-5 py-2.5 text-xs font-medium text-foreground shadow-xs">
							点击任意位置激荡涟漪
						</InkRipple>
					</InteractiveCard>

					<InteractiveCard
						name="CheckmarkDraw · 交互打勾"
						note="操作成功时，SVG 圆环与对勾笔触通过描边偏移一气呵成勾勒。"
						usage="<CheckmarkDraw checked={checked} size={24} />"
					>
						<button
							type="button"
							onClick={() => setChecked((c) => !c)}
							className="flex items-center gap-3 rounded-lg border border-border/40 bg-card px-4 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted/40"
						>
							<CheckmarkDraw checked={checked} size={20} className="text-primary" />
							<span>{checked ? "已完成（点击取消）" : "未完成（点击打勾）"}</span>
						</button>
					</InteractiveCard>

					<InteractiveCard
						name="HoldToConfirm · 蓄力长按"
						note="防误触保护：按住墨线注入蓄满方才确认，松开立即平滑回弹。"
						usage="<HoldToConfirm duration={1.0} onConfirm={handleConfirm} />"
					>
						<HoldToConfirm
							duration={1.0}
							label="按住 1 秒以确认"
							holdingLabel="注入蓄力中…"
							confirmedLabel="✓ 确认成功"
							onConfirm={() => {}}
						/>
					</InteractiveCard>

					<InteractiveCard
						name="Shake · 物理警示摇晃"
						note="表单非法或操作拦截时的阻尼水平摆动，纯合成层无抖动。"
						usage="<Shake shakeKey={key}>{inputOrCard}</Shake>"
					>
						<div className="flex flex-col items-center gap-2">
							<Shake shakeKey={shakeTrigger}>
								<div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-xs font-medium text-destructive">
									输入内容格式有误
								</div>
							</Shake>
							<button
								type="button"
								onClick={() => setShakeTrigger((k) => k + 1)}
								className="mt-1 text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
							>
								点击触发警示摇晃
							</button>
						</div>
					</InteractiveCard>

					<InteractiveCard
						name="CopyButton · 就地复制反馈"
						note="图标与文案原位平滑交接，外层尺寸严格锚定，杜绝挤压变形。"
						usage='<CopyButton text="npm i @violet/ui" />'
					>
						<CopyButton text="https://violet.dev/design-system" label="点击复制" />
					</InteractiveCard>

					<InteractiveCard
						name="CounterBadge · 计数微弹气泡"
						note="数字变动时向上微弹淡入，用于点赞、收藏与未读数更新。"
						usage="<CounterBadge count={count} />"
					>
						<div className="flex items-center gap-3">
							<button
								type="button"
								onClick={() => setCounter((c) => Math.max(0, c - 1))}
								className="rounded-md border border-border/40 px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted"
							>
								-1
							</button>
							<CounterBadge count={counter} />
							<button
								type="button"
								onClick={() => setCounter((c) => c + 1)}
								className="rounded-md border border-border/40 px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted"
							>
								+1
							</button>
						</div>
					</InteractiveCard>

					<InteractiveCard
						name="TextUnderline · 墨线生长下划线"
						note="悬停时底线自左至右行云流水生长，移出顺滑收缩，链接与词条标配。"
						usage="<TextUnderline>{children}</TextUnderline>"
					>
						<p className="text-sm font-serif">
							移入试探{" "}
							<TextUnderline className="font-semibold text-primary">
								此间风物
							</TextUnderline>{" "}
							与{" "}
							<TextUnderline className="font-semibold text-foreground">
								浮光掠影
							</TextUnderline>
						</p>
					</InteractiveCard>

					<InteractiveCard
						name="WavyUnderline · 流水波浪线"
						note="书卷批注意象，悬停如春水微澜向右流淌，移出顺滑收缩。"
						usage="<WavyUnderline flow>{children}</WavyUnderline>"
					>
						<p className="text-sm font-serif">
							移入体验{" "}
							<WavyUnderline className="font-semibold text-primary">
								春水微澜
							</WavyUnderline>{" "}
							与{" "}
							<WavyUnderline mode="always" className="font-semibold text-foreground">
								常驻圈点
							</WavyUnderline>
						</p>
					</InteractiveCard>
				</div>
			</div>

			<div>
				<div className="mb-4">
					<h4 className="text-base font-bold tracking-wide">二、浮现与流动类动效</h4>
					<p className="mt-1 text-xs text-muted-foreground">
						新内容入场与节奏编排，默认进入视口触发一次，均支持点击重播。
					</p>
				</div>
				<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
						name="QuoteLine · 引用墨脊注入"
						note="书卷引文进场：左侧墨脊自上至下平滑注入生长，引文温和淡入。"
						usage='<QuoteLine citation="出处">{children}</QuoteLine>'
					>
						{(key) => (
							<QuoteLine key={key} citation="营造法式 · 动效章">
								物各从其类，运动皆有其序，墨线由上而下注入，静水流深。
							</QuoteLine>
						)}
					</EffectCard>

					<EffectCard
						name="ScaleIn · 缩放入座"
						note="自 0.94 微缩落座，适合卡片与插图。"
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
						note="文字自纸面 3D 活字翻转立起伴随虚实凝聚，标题动效的招牌。"
						usage='<TextReveal text="标题文本" />'
					>
						{(key) => (
							<div className="py-2 text-center">
								<TextReveal
									key={key}
									text="一花一叶 皆成文章"
									className="font-serif text-2xl font-bold tracking-wider text-foreground"
								/>
							</div>
						)}
					</EffectCard>

					<EffectCard
						name="Stagger · 级联编排"
						note="结构化卡片流依序错落入场，双轴微倾角层叠，节奏 90ms 递进。"
						usage="<StaggerGroup><StaggerItem index={0}>…</StaggerItem></StaggerGroup>"
					>
						{(key) => (
							<StaggerGroup key={key} className="w-full max-w-xs space-y-2">
								{[
									{ title: "《营造法式·卷一》", time: "4 分钟前", tag: "已落定" },
									{ title: "《东坡题跋·墨池记》", time: "昨天", tag: "研读中" },
									{ title: "《文心雕龙·神思》", time: "3 天前", tag: "典藏" },
								].map((card, idx) => (
									<StaggerItem key={card.title} index={idx}>
										<div className="flex items-center justify-between rounded-lg border border-border/40 bg-card px-3 py-2 text-xs shadow-xs">
											<div className="flex items-center gap-2">
												<span className="h-1.5 w-1.5 rounded-full bg-primary" />
												<span className="font-serif font-medium text-foreground">
													{card.title}
												</span>
											</div>
											<div className="flex items-center gap-2 text-[10px] text-muted-foreground">
												<span>{card.time}</span>
												<span className="rounded bg-muted px-1.5 py-0.5 font-mono">
													{card.tag}
												</span>
											</div>
										</div>
									</StaggerItem>
								))}
							</StaggerGroup>
						)}
					</EffectCard>

					<EffectCard
						name="NumberFlow · 数字滚动"
						note="基于 requestAnimationFrame 缓动滚动到新值，等宽数字防抖动。"
						usage="<NumberFlow value={12846} />"
					>
						{(key) => (
							<NumberFlow key={key} value={12846} className="text-2xl font-bold" />
						)}
					</EffectCard>
				</div>
			</div>

			<div>
				<div className="mb-4">
					<h4 className="text-base font-bold tracking-wide">
						三、氛围与持续动效（舞台级常驻循环）
					</h4>
					<p className="mt-1 text-xs text-muted-foreground">
						无须交互介入、全时段在后台静默运转的生命感原语，GPU 合成层 0 线程占用。
					</p>
				</div>
				<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
					<EffectCard
						name="InfiniteMarquee · 无缝走马灯"
						note="元素静默匀速首尾循环流动，悬停驻留，两端渐变羽化。"
						usage="<InfiniteMarquee speed={24}>{items}</InfiniteMarquee>"
					>
						{() => (
							<InfiniteMarquee speed={18} className="w-full max-w-sm py-2">
								{["一花一叶", "营造法式", "东坡题跋", "兰亭修禊", "墨池遗韵"].map(
									(tag) => (
										<span
											key={tag}
											className="rounded-full border border-border/40 bg-card px-3 py-1 font-serif text-xs text-muted-foreground shadow-2xs"
										>
											{tag}
										</span>
									),
								)}
							</InfiniteMarquee>
						)}
					</EffectCard>

					<EffectCard
						name="PulseDot · 呼吸状态光晕"
						note="同心水波向外脉冲呼吸扩散，用于在线状态与活体进程指示。"
						usage="<PulseDot color='var(--primary)' size={8} />"
					>
						{() => (
							<div className="flex items-center gap-6">
								<div className="flex items-center gap-2 text-xs text-muted-foreground">
									<PulseDot color="var(--primary)" size={8} />
									<span>系统运行中</span>
								</div>
								<div className="flex items-center gap-2 text-xs text-muted-foreground">
									<PulseDot color="#10b981" size={8} />
									<span>实时同步</span>
								</div>
							</div>
						)}
					</EffectCard>

					<EffectCard
						name="AuroraGlow · 水墨弥散极光"
						note="双色柔光斑在后台缓慢浮动漫游，提供舞台级生命质感。"
						usage="<AuroraGlow>{children}</AuroraGlow>"
					>
						{() => (
							<AuroraGlow className="w-full max-w-xs text-center">
								<span className="font-serif text-xs font-semibold tracking-wider text-foreground">
									水墨漫游 · 极光流动
								</span>
							</AuroraGlow>
						)}
					</EffectCard>

					<EffectCard
						name="BorderBeam · 流光边框"
						note="一道纯 CSS 光斑沿边框环绕，用于焦点态与特性卡。"
						usage="<BorderBeam duration={4}>{children}</BorderBeam>"
					>
						{() => (
							<BorderBeam duration={4}>
								<div className="rounded-xl px-4 py-3 text-sm font-medium">
									流光环绕
								</div>
							</BorderBeam>
						)}
					</EffectCard>

					<EffectCard
						name="Shine · 微光扫影"
						note="高光周期性斜向掠过，用于勋章、封面与强调卡。"
						usage="<Shine interval={3}>{children}</Shine>"
					>
						{(key) => (
							<Shine key={key} interval={2.4} className="rounded-lg">
								<Demo>扫光掠过</Demo>
							</Shine>
						)}
					</EffectCard>
				</div>
			</div>
			<div className="grid grid-cols-1 gap-x-6 gap-y-3 border-t border-border/40 py-6 sm:grid-cols-[10rem_1fr]">
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
						全部动效均内置
						<code className="font-mono text-xs">prefers-reduced-motion</code>
						检测，开启减少动效时平滑退化为即时呈现。
					</li>
					<li>新效果先查本章；查无此项时按三律法推导，并把结论沉淀回本章。</li>
				</ul>
			</div>
		</div>
	);
}
