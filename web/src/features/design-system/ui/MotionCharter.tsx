import { layoutTransition, MOTION_EASE, revealTransition } from "@shared/lib/motion";
import { cn } from "@shared/lib/utils";
import { Button } from "@shared/ui/base/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@shared/ui/base/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@shared/ui/base/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@shared/ui/base/popover";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@shared/ui/base/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@shared/ui/base/tooltip";
import { Disclosure } from "@shared/ui/disclosure";
import { Shuffle, Trash2, X } from "lucide-react";
import {
	AnimatePresence,
	animate,
	motion,
	useMotionValue,
	useReducedMotion,
	useTransform,
} from "motion/react";
import { type ReactNode, useEffect, useState } from "react";
import { toast } from "sonner";

/**
 * 场景规格行：左侧场景标目，右侧法定规格 + 真实活样例。
 * 与布局规格章的 SpecRow 同构（sm:grid-cols-[10rem_1fr]）。
 */
function SpecRow({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="grid grid-cols-1 gap-x-6 gap-y-3 border-b border-border/40 py-6 sm:grid-cols-[10rem_1fr]">
			<h4 className="text-base font-bold">{label}</h4>
			<div>{children}</div>
		</div>
	);
}

/** 规格条目：一行动效约定。 */
function Spec({ children }: { children: ReactNode }) {
	return (
		<li className="flex flex-wrap items-baseline gap-x-3 text-sm">
			<span className="leading-relaxed text-muted-foreground">{children}</span>
		</li>
	);
}

/** 活样例舞台：样例即真相。 */
function Stage({ children }: { children: ReactNode }) {
	return (
		<div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl border border-border/40 bg-card/50 p-5">
			{children}
		</div>
	);
}

/**
 * 动效四职责：一切动效必居其一。职责不明 = 不该动。
 */
const DUTIES = [
	{
		name: "反馈",
		gloss: "确认操作已被接收：悬停、按压、链接热线、成功与警示。",
	},
	{
		name: "浮现",
		gloss: "新内容进入界面：气泡、游层、模态、抽屉、通知、骨架屏交接。",
	},
	{
		name: "流动",
		gloss: "状态与位置之间的连续性：切换胶囊、列表重排、数字滚动、滚动显现。",
	},
	{
		name: "氛围",
		gloss: "舞台级生命感：循环背景、光标闪烁、页面转场。仅限装饰位，不承载信息。",
	},
] as const;

/** 三律法：贯穿所有场景的物理约束。 */
const LAWS = [
	{
		name: "合成层律",
		rule: "只动 transform、opacity 与 paint-only 颜色；禁止动画布局属性。",
		why: "width、height、margin 的过渡逐帧触发重排，整页抖动；transform/opacity 由 GPU 合成，长文也不掉帧。",
	},
	{
		name: "场景律",
		rule: "运动形态由空间语义决定：模态原地落座、游层自触发点浮现、抽屉自屏幕边缘进出、链接线沿阅读方向生长。",
		why: "动效回答「它从哪来、到哪去」；脱离场景套用同一种动画是混乱的根源。",
	},
	{
		name: "快进快出律",
		rule: "入场温和（120~300ms ease-out），离场更快（约七成时长）。",
		why: "用户等的是结果不是过程；离场拖沓阻塞下一次操作。一切动效尊重 prefers-reduced-motion，降级为直接呈现。",
	},
] as const;

/** Tab 流体胶囊样例的页签。 */
const FLOW_TABS = ["文章", "关于", "项目", "动态"] as const;

/** 列表重排样例的初始条目。 */
const REORDER_SEED = [
	{ id: "a", label: "设计原则" },
	{ id: "b", label: "快速决策表" },
	{ id: "c", label: "token 词典" },
	{ id: "d", label: "组件活样例" },
	{ id: "e", label: "动效章程" },
];

/** 章程内部样例：链接热线。 */
function LinkLine() {
	const [active, setActive] = useState("feed");

	return (
		<Stage>
			<button
				type="button"
				onClick={() => setActive("feed")}
				className="relative text-primary after:absolute after:-bottom-0.5 after:left-0 after:h-px after:w-full after:origin-right after:scale-x-0 after:bg-current after:transition-transform after:duration-200 after:ease-out after:content-[''] hover:after:origin-left hover:after:scale-x-100 active:opacity-70"
			>
				正文内链 · 悬停看底线生长
			</button>
			<button
				type="button"
				onClick={() => setActive("archive")}
				className="relative inline-flex items-center gap-1 font-medium text-foreground after:absolute after:-bottom-0.5 after:left-0 after:h-px after:w-full after:origin-right after:scale-x-0 after:bg-current after:transition-transform after:duration-200 after:ease-out after:content-[''] hover:after:origin-left hover:after:scale-x-100 active:opacity-70"
			>
				卡片标题链接
			</button>
			<span className="text-xs text-muted-foreground">
				当前选择：<code className="font-mono">{active}</code>
			</span>
		</Stage>
	);
}

/** 章程内部样例：成功描边对勾，可重播。 */
function SuccessDraw() {
	const [run, setRun] = useState(0);

	return (
		<Stage>
			<button
				type="button"
				onClick={() => setRun((n) => n + 1)}
				className="inline-flex items-center gap-3 rounded-lg border border-border/40 bg-background px-4 py-3 text-sm transition-colors hover:bg-muted/40"
			>
				<motion.svg
					key={run}
					viewBox="0 0 20 20"
					className="size-5"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					<motion.circle
						cx="10"
						cy="10"
						r="8.5"
						className="text-success"
						initial={{ pathLength: 0 }}
						animate={{ pathLength: 1 }}
						transition={{ duration: 0.35, ease: "easeOut" }}
					/>
					<motion.path
						d="M6 10.2l2.6 2.6L14 7.4"
						className="text-success"
						initial={{ pathLength: 0 }}
						animate={{ pathLength: 1 }}
						transition={{ duration: 0.3, delay: 0.3, ease: "easeOut" }}
					/>
				</motion.svg>
				成功 · 点击重播描边
			</button>
			<Button
				variant="outline"
				onClick={() => toast.success("已保存", { description: "更改已写入数据库" })}
			>
				触发 Toast 通知
			</Button>
		</Stage>
	);
}

/** 章程内部样例：警示摇晃。 */
function ShakeDemo() {
	const [shakeKey, setShakeKey] = useState(0);

	return (
		<Stage>
			<Button variant="destructive" onClick={() => setShakeKey((n) => n + 1)}>
				触发警示摇晃
			</Button>
			<motion.span
				key={shakeKey}
				className="inline-flex items-center gap-2 text-sm text-destructive"
				initial={{ x: 0 }}
				animate={shakeKey > 0 ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
				transition={{ duration: 0.4, ease: "easeInOut" }}
			>
				<X className="size-4" />
				输入不合法，请检查后重试
			</motion.span>
		</Stage>
	);
}

/** 章程内部样例：骨架屏 → 内容交叉交接。 */
function SkeletonHandoff() {
	const [loaded, setLoaded] = useState(false);

	useEffect(() => {
		const timer = setTimeout(() => setLoaded(true), 1600);
		return () => clearTimeout(timer);
	}, []);

	return (
		<Stage>
			<div className="w-full max-w-sm">
				<AnimatePresence mode="wait" initial={false}>
					{loaded ? (
						<motion.div
							key="content"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.3, ease: MOTION_EASE.softOut }}
							className="rounded-lg border border-border/40 bg-background p-4"
						>
							<p className="text-sm font-bold">真实内容已就位</p>
							<p className="mt-1 text-xs leading-relaxed text-muted-foreground">
								骨架与内容交叉溶入，容器尺寸一致，页面不跳。
							</p>
						</motion.div>
					) : (
						<motion.div
							key="skeleton"
							exit={{ opacity: 0 }}
							transition={{ duration: 0.2 }}
							className="rounded-lg border border-border/40 bg-background p-4"
						>
							<div className="h-4 w-24 animate-pulse rounded-sm bg-muted" />
							<div className="mt-3 space-y-2">
								<div className="h-3 w-full animate-pulse rounded-sm bg-muted" />
								<div className="h-3 w-4/5 animate-pulse rounded-sm bg-muted" />
							</div>
						</motion.div>
					)}
				</AnimatePresence>
				<Button
					variant="outline"
					size="sm"
					className="mt-3"
					onClick={() => setLoaded((v) => !v)}
				>
					重播交接
				</Button>
			</div>
		</Stage>
	);
}

/** 章程内部样例：Tab 流体胶囊（layoutId 共享位移）。 */
function FlowTabs() {
	const [tab, setTab] = useState<string>("文章");
	const reduce = useReducedMotion();

	return (
		<Stage>
			<div className="flex rounded-full border border-border/60 bg-muted/40 p-1">
				{FLOW_TABS.map((item) => {
					const isActive = tab === item;
					return (
						<button
							type="button"
							key={item}
							onClick={() => setTab(item)}
							className={cn(
								"relative rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
								isActive
									? "text-primary-foreground font-semibold"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							{isActive && (
								<motion.span
									layoutId="charter-flow-capsule"
									className="absolute inset-0 rounded-full bg-primary"
									transition={reduce ? { duration: 0 } : layoutTransition}
								/>
							)}
							<span className="relative z-10">{item}</span>
						</button>
					);
				})}
			</div>
			<span className="text-xs text-muted-foreground">
				选中胶囊在页签间连续流动，无闪烁灭活
			</span>
		</Stage>
	);
}

/** 章程内部样例：列表重排与删除（layout FLIP）。 */
function ReorderList() {
	const [items, setItems] = useState(REORDER_SEED);
	const reduce = useReducedMotion();

	return (
		<Stage>
			<ul className="w-full max-w-sm space-y-2">
				<AnimatePresence initial={false}>
					{items.map((item) => (
						<motion.li
							layout
							key={item.id}
							className="flex items-center justify-between rounded-lg border border-border/40 bg-background px-3 py-2"
							transition={reduce ? { duration: 0 } : layoutTransition}
							initial={{ opacity: 0, scale: 0.96 }}
							animate={{ opacity: 1, scale: 1 }}
							exit={{ opacity: 0, scale: 0.96 }}
						>
							<span className="text-sm">{item.label}</span>
							<button
								type="button"
								aria-label={`移除 ${item.label}`}
								className="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
								onClick={() =>
									setItems((list) => list.filter((it) => it.id !== item.id))
								}
							>
								<Trash2 className="size-3.5" />
							</button>
						</motion.li>
					))}
				</AnimatePresence>
			</ul>
			<div className="flex flex-col gap-2">
				<Button
					variant="outline"
					size="sm"
					onClick={() => setItems((list) => [...list].sort(() => Math.random() - 0.5))}
					disabled={items.length < 2}
				>
					<Shuffle className="mr-1 size-3.5" />
					打乱顺序
				</Button>
				<Button variant="ghost" size="sm" onClick={() => setItems(REORDER_SEED)}>
					还原
				</Button>
			</div>
			<span className="w-full text-xs text-muted-foreground">
				删除与重排时其余条目平滑让位（FLIP），无跳变
			</span>
		</Stage>
	);
}

/** 章程内部样例：数字滚动。 */
function CountUp() {
	const [target, setTarget] = useState(12846);
	const mv = useMotionValue(0);
	const text = useTransform(mv, (v) => Math.round(v).toLocaleString());

	useEffect(() => {
		const controls = animate(mv, target, { duration: 1.2, ease: MOTION_EASE.out });
		return () => controls.stop();
	}, [mv, target]);

	return (
		<Stage>
			<div className="text-2xl font-bold tabular-nums">
				<motion.span>{text}</motion.span>
			</div>
			<Button variant="outline" size="sm" onClick={() => setTarget((v) => v + 4213)}>
				变更数值
			</Button>
			<span className="text-xs text-muted-foreground">
				统计数字滚动到新值；等宽数字（tabular-nums）防止宽度抖动
			</span>
		</Stage>
	);
}

/** 章程内部样例：滚动显现（whileInView）。 */
function ScrollReveal() {
	return (
		<Stage>
			<div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
				{["有效", "清晰", "准确"].map((word, index) => (
					<motion.div
						key={word}
						initial={{ opacity: 0, y: 16 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true, margin: "-40px" }}
						transition={{ ...revealTransition, delay: index * 0.08 }}
						className="rounded-lg border border-border/40 bg-background p-4 text-center"
					>
						<p className="text-lg font-bold">{word}</p>
					</motion.div>
				))}
			</div>
			<span className="w-full text-xs text-muted-foreground">
				进入视口时逐张淡入上移（stagger 编排 80ms 递进），once 保证只播一次
			</span>
		</Stage>
	);
}

/**
 * 动效章程章：四职责 × 15 场景的法定规格与活样例。
 * 参数与曲线唯一出处：@shared/lib/motion。
 */
export function MotionCharter() {
	return (
		<div className="mt-8">
			{/* 〇、总纲 */}
			<SpecRow label="总纲">
				<ol className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
					{DUTIES.map((duty, index) => (
						<li className="border-l-2 border-border/50 pl-4" key={duty.name}>
							<p className="text-sm font-bold">
								{["壹", "贰", "叁", "肆"][index]} · {duty.name}
							</p>
							<p className="mt-1 text-xs leading-relaxed text-muted-foreground">
								{duty.gloss}
							</p>
						</li>
					))}
				</ol>
				<ol className="mt-5 space-y-3">
					{LAWS.map((law) => (
						<li className="border-l-2 border-border/50 pl-5" key={law.name}>
							<p className="text-sm font-bold">
								{law.name}
								<span className="ml-2 font-normal text-muted-foreground">
									{law.rule}
								</span>
							</p>
							<p className="mt-1 text-sm leading-relaxed text-muted-foreground">
								{law.why}
							</p>
						</li>
					))}
				</ol>
			</SpecRow>

			{/* 一、反馈 · 悬停与按压 */}
			<SpecRow label="反馈 · 悬停按压">
				<ul className="space-y-1.5">
					<Spec>
						悬停：颜色与背景过渡{" "}
						<code className="font-mono text-xs">150ms · ease-out</code>
						；不改变几何（描边宽度、字重、外边距一律不动）。
					</Spec>
					<Spec>
						按压：可点控件 scale 0.98 <code className="font-mono text-xs">120ms</code>
						；幅度止于亚像素级，禁止 scale-90/95 让文字发虚。
					</Spec>
					<Spec>
						锚点：<code className="font-mono text-xs">shared/ui/base/button.tsx</code>
					</Spec>
				</ul>
				<Stage>
					<Button>主要动作</Button>
					<Button variant="secondary">次要动作</Button>
					<Button variant="outline">描边动作</Button>
					<Button variant="ghost">幽灵动作</Button>
				</Stage>
			</SpecRow>

			{/* 二、反馈 · 链接热线 */}
			<SpecRow label="反馈 · 链接热线">
				<ul className="space-y-1.5">
					<Spec>
						悬停：底线自左生长（scaleX 0→1，origin-left），离开向右收回；{" "}
						<code className="font-mono text-xs">180ms · ease-out</code>
					</Spec>
					<Spec>
						底线用伪元素 transform 实现、与文字同色；点击态 opacity 0.7。禁用{" "}
						<code className="font-mono text-xs">hover:underline</code> 硬切。
					</Spec>
				</ul>
				<LinkLine />
			</SpecRow>

			{/* 三、反馈 · 成功与警示 */}
			<SpecRow label="反馈 · 成功警示">
				<ul className="space-y-1.5">
					<Spec>
						成功：对勾描边绘制{" "}
						<code className="font-mono text-xs">pathLength 0→1 · 350ms</code>
						；轻量通知走 Toast（自边缘滑入、4s 自动收回）。
					</Spec>
					<Spec>
						警示：短促横移摇晃 <code className="font-mono text-xs">±6px · 400ms</code>
						，只用于错误语义；禁止拿摇晃当普通反馈。
					</Spec>
					<Spec>
						锚点：<code className="font-mono text-xs">shared/ui/base/sonner.tsx</code>
					</Spec>
				</ul>
				<SuccessDraw />
				<ShakeDemo />
			</SpecRow>

			{/* 四、浮现 · 气泡提示 */}
			<SpecRow label="浮现 · 气泡提示">
				<ul className="space-y-1.5">
					<Spec>
						悬停等待 ~300ms 再显示，防划过误触；fade + 缩放 0.95 + 2~4px 方向微距， 入场{" "}
						<code className="font-mono text-xs">100ms</code>
						、隐藏 <code className="font-mono text-xs">75ms</code>
						——提示不阻挡下一步操作。
					</Spec>
					<Spec>
						锚点：<code className="font-mono text-xs">shared/ui/base/tooltip.tsx</code>
					</Spec>
				</ul>
				<Stage>
					<TooltipProvider delayDuration={300}>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button variant="outline">上方气泡</Button>
							</TooltipTrigger>
							<TooltipContent>我是气泡：淡入 + 缩放浮现</TooltipContent>
						</Tooltip>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button variant="outline">下方气泡</Button>
							</TooltipTrigger>
							<TooltipContent side="bottom">方向跟随触发边</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				</Stage>
			</SpecRow>

			{/* 五、浮现 · 弹出游层 */}
			<SpecRow label="浮现 · 弹出游层">
				<ul className="space-y-1.5">
					<Spec>
						自触发点浮现：fade + 缩放 0.98→1 + 4px 方向微距（data-side 决定方向）。
					</Spec>
					<Spec>
						法定节奏：入场{" "}
						<code className="font-mono text-xs">
							200ms · ease-[cubic-bezier(0.16,1,0.3,1)]
						</code>
						，离场 <code className="font-mono text-xs">150ms · ease-in</code>。
					</Spec>
					<Spec>
						适用：Popover、DropdownMenu、Select、ContextMenu、命令面板。锚点：
						<code className="font-mono text-xs">
							shared/ui/base/popover.tsx · dropdown-menu.tsx
						</code>
					</Spec>
				</ul>
				<Stage>
					<Popover>
						<PopoverTrigger asChild>
							<Button variant="outline">打开 Popover</Button>
						</PopoverTrigger>
						<PopoverContent className="w-64">
							<p className="text-sm font-bold">浮动卡片</p>
							<p className="mt-1 text-xs leading-relaxed text-muted-foreground">
								自按钮方向浮现：淡入、轻微缩放与 8px 微距，离场更快收回。
							</p>
						</PopoverContent>
					</Popover>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline">打开菜单</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent>
							<DropdownMenuLabel>操作</DropdownMenuLabel>
							<DropdownMenuSeparator />
							<DropdownMenuItem>重命名</DropdownMenuItem>
							<DropdownMenuItem>移动到…</DropdownMenuItem>
							<DropdownMenuItem variant="destructive">删除</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</Stage>
			</SpecRow>

			{/* 六、浮现 · 模态对话框 */}
			<SpecRow label="浮现 · 模态对话框">
				<ul className="space-y-1.5">
					<Spec>
						遮罩纯透明度缓溶（200ms）；内容原地落座：fade + 上移 8px→0 + 缩放 0.98→1。
					</Spec>
					<Spec>
						入场{" "}
						<code className="font-mono text-xs">
							200ms · ease-[cubic-bezier(0.16,1,0.3,1)]
						</code>
						，关闭 <code className="font-mono text-xs">150ms</code>
						；无方向语义，不滑入不弹簧。
					</Spec>
					<Spec>
						锚点：<code className="font-mono text-xs">shared/ui/base/dialog.tsx</code>
					</Spec>
				</ul>
				<Stage>
					<Dialog>
						<DialogTrigger asChild>
							<Button>打开对话框</Button>
						</DialogTrigger>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>原地落座</DialogTitle>
								<DialogDescription>
									内容自 8px
									微距淡入归位，遮罩同步缓溶；关闭时加速退出，无方向位移。
								</DialogDescription>
							</DialogHeader>
						</DialogContent>
					</Dialog>
				</Stage>
			</SpecRow>

			{/* 七、浮现 · 抽屉侧栏 */}
			<SpecRow label="浮现 · 抽屉侧栏">
				<ul className="space-y-1.5">
					<Spec>抽屉有明确空间来源（屏幕边缘），完整方向滑入滑出是语义正确的例外。</Spec>
					<Spec>
						法定曲线{" "}
						<code className="font-mono text-xs">
							ease-[cubic-bezier(0.32,0.72,0,1)]
						</code>
						：滑入 <code className="font-mono text-xs">300ms</code>
						、滑出 <code className="font-mono text-xs">250ms</code>
						；确定性曲线不用弹簧——导航运动要干脆可预期。
					</Spec>
					<Spec>
						锚点：<code className="font-mono text-xs">shared/ui/base/sheet.tsx</code>
					</Spec>
				</ul>
				<Stage>
					<Sheet>
						<SheetTrigger asChild>
							<Button variant="outline">打开右侧抽屉</Button>
						</SheetTrigger>
						<SheetContent>
							<SheetHeader>
								<SheetTitle>自屏幕边缘滑入</SheetTitle>
								<SheetDescription>
									方向性运动在此是语义而非装饰：抽屉的来源就是屏幕边缘。
								</SheetDescription>
							</SheetHeader>
						</SheetContent>
					</Sheet>
				</Stage>
			</SpecRow>

			{/* 八、浮现 · 骨架屏交接 */}
			<SpecRow label="浮现 · 骨架屏交接">
				<ul className="space-y-1.5">
					<Spec>
						骨架 shimmer 等待数据；内容就位后与骨架交叉溶入{" "}
						<code className="font-mono text-xs">300ms</code>
						，容器尺寸保持一致，页面不跳。
					</Spec>
					<Spec>禁：骨架消失后内容从零弹跳撑开；禁：加载完成后整页闪烁。</Spec>
				</ul>
				<SkeletonHandoff />
			</SpecRow>

			{/* 九、流动 · 状态切换 */}
			<SpecRow label="流动 · 状态切换">
				<ul className="space-y-1.5">
					<Spec>
						分段控件、Tab 的选中指示用共享元素（layoutId）连续流动； 弹簧{" "}
						<code className="font-mono text-xs">stiffness 450 · damping 34</code>。
					</Spec>
					<Spec>禁：指示器生硬灭活再点亮——焦点转移必须可追踪。</Spec>
				</ul>
				<FlowTabs />
			</SpecRow>

			{/* 十、流动 · 列表重排 */}
			<SpecRow label="流动 · 列表重排">
				<ul className="space-y-1.5">
					<Spec>
						增删、排序、筛选后的位置变化用 layout FLIP 平滑让位：
						<code className="font-mono text-xs">motion.li layout</code>
						；退场项缩放淡出，其余项补位。
					</Spec>
					<Spec>禁：重排瞬间整组闪烁重挂。</Spec>
				</ul>
				<ReorderList />
			</SpecRow>

			{/* 十一、流动 · 数字滚动 */}
			<SpecRow label="流动 · 数字滚动">
				<ul className="space-y-1.5">
					<Spec>
						统计数字变化滚动到新值{" "}
						<code className="font-mono text-xs">1.2s · 长尾缓出</code>
						；必须配 tabular-nums 等宽数字，防止逐帧宽度抖动。
					</Spec>
					<Spec>适用：仪表盘计数、阅读量、进度百分比。</Spec>
				</ul>
				<CountUp />
			</SpecRow>

			{/* 十二、流动 · 滚动显现 */}
			<SpecRow label="流动 · 滚动显现">
				<ul className="space-y-1.5">
					<Spec>
						内容进入视口时淡入上移{" "}
						<code className="font-mono text-xs">500ms · softOut</code>
						，同组元素 80ms 递进（stagger 编排）；once 保证只播一次。
					</Spec>
					<Spec>适用：列表页首屏、卡片组；长文章正文不整体显现（影响阅读与检索）。</Spec>
				</ul>
				<ScrollReveal />
			</SpecRow>

			{/* 十三、展开折叠 */}
			<SpecRow label="展开折叠">
				<ul className="space-y-1.5">
					<Spec>
						高度过渡用 grid-template-rows 0fr→1fr 或受控 height + overflow-hidden 剪裁，
						内容透明度延迟跟进；{" "}
						<code className="font-mono text-xs">220ms · ease-out</code>
						，指示符旋转 180° 同步。
					</Spec>
					<Spec>
						锚点：<code className="font-mono text-xs">shared/ui/disclosure/</code>
					</Spec>
				</ul>
				<Stage>
					<Disclosure summary="点击展开折叠面板" className="w-full max-w-md">
						<p className="text-sm leading-relaxed text-muted-foreground">
							高度变化约束在剪裁容器内完成，面板下方内容平滑推移，没有像素级震颤。
						</p>
					</Disclosure>
				</Stage>
			</SpecRow>

			{/* 十四、氛围与页面 */}
			<SpecRow label="氛围与页面">
				<ul className="space-y-1.5">
					<Spec>
						页面转场走 View Transitions：forward/back 纸页翻动 300ms、同段导航交叉溶淡
						220ms、 主题切换圆形扩散 400ms。锚点：
						<code className="font-mono text-xs">styles/transitions.css</code>
					</Spec>
					<Spec>
						内容进场沿用
						<code className="font-mono text-xs">
							tab-panel-in（0.2s ease-out，4px 上移）
						</code>
						；舞台级循环（blob / nexus-shimmer / marquee /
						caret-blink）仅限氛围装饰位，不承载信息。
					</Spec>
					<Spec>新场景先查本章；查无此项时回到三律法推导，并把结论沉淀回本章。</Spec>
				</ul>
			</SpecRow>
		</div>
	);
}
