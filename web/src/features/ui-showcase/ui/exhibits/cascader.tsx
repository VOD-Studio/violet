import { Cascader, type CascaderOption } from "@violet/ui";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useStageContainer } from "../../hooks/use-stage-container";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";

type Variant = "filled" | "outline" | "underline" | "plain";
type ControlSize = "sm" | "md" | "lg";

const VARIANTS: { variant: Variant; label: string }[] = [
	{ variant: "filled", label: "填充" },
	{ variant: "outline", label: "描边" },
	{ variant: "underline", label: "下划线" },
	{ variant: "plain", label: "无框" },
];

const SIZES: { size: ControlSize; label: string }[] = [
	{ size: "sm", label: "小 · 32" },
	{ size: "md", label: "中 · 36" },
	{ size: "lg", label: "大 · 40" },
];

/** 栏目 / 系列 / 章节，三级。 */
const PLACES: CascaderOption[] = [
	{
		value: "tech",
		label: "技术",
		children: [
			{
				value: "frontend",
				label: "前端",
				children: [
					{ value: "season-bg", label: "把一个会随季节变色的背景做成组件" },
					{ value: "input-states", label: "输入框的九种状态" },
					{ value: "float-motion", label: "浮层的进出场" },
				],
			},
			{
				value: "backend",
				label: "后端",
				children: [
					{ value: "go-api", label: "用 Go 写一个博客 API" },
					{ value: "paging", label: "分页与排序的取舍" },
				],
			},
			{
				value: "tools",
				label: "工具",
				children: [{ value: "cli", label: "命令行小工具" }],
			},
		],
	},
	{
		value: "essay",
		label: "随笔",
		children: [
			{
				value: "ride",
				label: "骑行",
				children: [
					{ value: "duku", label: "独库公路，六天" },
					{ value: "bayanbulak", label: "雨天的巴音布鲁克" },
				],
			},
			{
				value: "photo",
				label: "摄影",
				children: [{ value: "film", label: "胶片冲洗笔记" }],
			},
		],
	},
	{
		value: "project",
		label: "项目",
		children: [
			{
				value: "violet",
				label: "Violet",
				children: [
					{ value: "season", label: "季节背景" },
					{ value: "input", label: "输入框设计" },
				],
			},
			{
				value: "inkline",
				label: "inkline",
				children: [{ value: "stroke", label: "落笔动画" }],
			},
		],
	},
];

/** 四级：用来看折叠与横向滚动。 */
const DEEP: CascaderOption[] = [
	{
		value: "project",
		label: "项目",
		children: [
			{
				value: "violet",
				label: "Violet",
				children: [
					{
						value: "ued",
						label: "UED 改版",
						children: [
							{ value: "inputs", label: "输入框设计" },
							{ value: "overlays", label: "浮层族" },
						],
					},
					{
						value: "blog",
						label: "博客重构",
						children: [{ value: "ssr", label: "服务端渲染" }],
					},
				],
			},
		],
	},
];

/** 第三级由「服务端」给出：栏目与系列是静态的，章节要点开系列才加载。 */
const LAZY_ROOT: CascaderOption[] = [
	{
		value: "tech",
		label: "技术",
		children: [
			{ value: "frontend", label: "前端" },
			{ value: "backend", label: "后端" },
		],
	},
	{
		value: "essay",
		label: "随笔",
		children: [{ value: "ride", label: "骑行" }],
	},
];

const LAZY_CHAPTERS: Record<string, CascaderOption[]> = {
	frontend: [
		{ value: "season-bg", label: "季节背景组件", isLeaf: true },
		{ value: "input-states", label: "输入框的九种状态", isLeaf: true },
	],
	backend: [
		{ value: "go-api", label: "用 Go 写一个博客 API", isLeaf: true },
		{ value: "paging", label: "分页与排序的取舍", isLeaf: true },
	],
	ride: [{ value: "duku", label: "独库公路，六天", isLeaf: true }],
};

const LOAD_MS = 700;

/** 模拟 700ms 的请求；「后端」第一次必失败，点行重试后成功。 */
function useLazyLoader() {
	const failedOnce = useRef(false);
	const timers = useRef(new Set<number>());
	useEffect(() => {
		const pending = timers.current;
		return () => {
			for (const timer of pending) clearTimeout(timer);
		};
	}, []);
	return (path: readonly CascaderOption[]) =>
		new Promise<CascaderOption[]>((resolve, reject) => {
			const last = path[path.length - 1].value;
			const timer = window.setTimeout(() => {
				timers.current.delete(timer);
				if (last === "backend" && !failedOnce.current) {
					failedOnce.current = true;
					reject(new Error("加载失败"));
					return;
				}
				resolve(LAZY_CHAPTERS[last] ?? []);
			}, LOAD_MS);
			timers.current.add(timer);
		});
}

/** 展柜里的陈列态：舞台进入视野时展开面板；用户操作过之后不再自动展开。 */
function useAutoOpen(container: HTMLElement | null) {
	const [open, setOpen] = useState(false);
	const touched = useRef(false);
	useEffect(() => {
		if (!container || typeof IntersectionObserver === "undefined") return;
		const observer = new IntersectionObserver((entries) => {
			if (entries.at(-1)?.isIntersecting && !touched.current) setOpen(true);
		});
		observer.observe(container);
		return () => observer.disconnect();
	}, [container]);
	return {
		open,
		onOpenChange: setOpen,
		stageProps: {
			onPointerDownCapture: () => {
				touched.current = true;
			},
			onKeyDownCapture: () => {
				touched.current = true;
			},
		},
	};
}

function Caption({ children }: { children: ReactNode }) {
	return <span className="text-12 text-muted-foreground">{children}</span>;
}

function Stage({
	stageRef,
	children,
	...props
}: {
	stageRef: (node: HTMLDivElement | null) => void;
	children: ReactNode;
	onPointerDownCapture: () => void;
	onKeyDownCapture: () => void;
}) {
	return (
		<div ref={stageRef} className="relative flex size-full flex-col gap-2 px-8 pt-6" {...props}>
			{children}
		</div>
	);
}

function DefaultStage() {
	const { ref, container } = useStageContainer();
	const { stageProps, ...openProps } = useAutoOpen(container);
	const [value, setValue] = useState(["tech", "frontend", "input-states"]);
	return (
		<Stage stageRef={ref} {...stageProps}>
			<Caption>发布位置</Caption>
			<Cascader
				aria-label="发布位置"
				className="w-80"
				options={PLACES}
				value={value}
				onValueChange={setValue}
				container={container}
				collisionBoundary={container}
				{...openProps}
			/>
		</Stage>
	);
}

function AnyLevelStage() {
	const { ref, container } = useStageContainer();
	const { stageProps, ...openProps } = useAutoOpen(container);
	const [value, setValue] = useState(["tech", "frontend"]);
	return (
		<Stage stageRef={ref} {...stageProps}>
			<Caption>任意层级可选：点一次展开并选中，再点已选中的行取消选择</Caption>
			<Cascader
				aria-label="发布位置"
				className="w-80"
				options={PLACES}
				changeOnSelect
				value={value}
				onValueChange={setValue}
				container={container}
				collisionBoundary={container}
				{...openProps}
			/>
		</Stage>
	);
}

function SearchStage() {
	const { ref, container } = useStageContainer();
	const { stageProps, ...openProps } = useAutoOpen(container);
	return (
		<Stage stageRef={ref} {...stageProps}>
			<Caption>输入「前端」「季节」「Go」试试，Enter 选高亮项</Caption>
			<Cascader
				aria-label="发布位置"
				className="w-80"
				options={PLACES}
				searchable
				searchPlaceholder="搜索路径"
				container={container}
				collisionBoundary={container}
				{...openProps}
			/>
		</Stage>
	);
}

function LazyStage() {
	const { ref, container } = useStageContainer();
	const { stageProps, ...openProps } = useAutoOpen(container);
	const loadData = useLazyLoader();
	return (
		<Stage stageRef={ref} {...stageProps}>
			<Caption>第三级点开系列时才取，700ms；「后端」第一次失败，点那一行重试</Caption>
			<Cascader
				aria-label="发布位置"
				className="w-80"
				options={LAZY_ROOT}
				loadData={loadData}
				container={container}
				collisionBoundary={container}
				{...openProps}
			/>
		</Stage>
	);
}

function DeepStage() {
	const { ref, container } = useStageContainer();
	const { stageProps, ...openProps } = useAutoOpen(container);
	const [value, setValue] = useState(["project", "violet", "ued", "inputs"]);
	return (
		<Stage stageRef={ref} {...stageProps}>
			<Caption>
				多于三级折成「栏目 / … / 章节」，完整路径在 title 与读屏文字里；超出的列横向滚动
			</Caption>
			<Cascader
				aria-label="发布位置"
				className="w-80"
				options={DEEP}
				value={value}
				onValueChange={setValue}
				container={container}
				collisionBoundary={container}
				contentClassName="max-w-[28rem]"
				{...openProps}
			/>
		</Stage>
	);
}

/** 状态格：触发器的真实属性，不展开面板。 */
type CellState = "rest" | "invalid" | "valid" | "loading" | "readonly" | "disabled";

const CELL_STATES: { id: CellState; label: string }[] = [
	{ id: "rest", label: "默认" },
	{ id: "invalid", label: "出错" },
	{ id: "valid", label: "通过" },
	{ id: "loading", label: "加载" },
	{ id: "readonly", label: "只读" },
	{ id: "disabled", label: "禁用" },
];

const GRID_OPTIONS: CascaderOption[] = [
	{
		value: "essay",
		label: "随笔",
		children: [{ value: "ride", label: "骑行" }],
	},
];

function StateCell({
	state,
	variant,
	size,
	label,
	container,
}: {
	state: CellState;
	variant: Variant;
	size: ControlSize;
	label: string;
	container: HTMLElement | null;
}) {
	return (
		<Cascader
			aria-label={label}
			options={GRID_OPTIONS}
			variant={variant}
			controlSize={size}
			defaultValue={state === "rest" || state === "loading" ? undefined : ["essay", "ride"]}
			placeholder={state === "loading" ? "加载选项…" : "选择位置"}
			invalid={state === "invalid"}
			valid={state === "valid"}
			loading={state === "loading"}
			readOnly={state === "readonly"}
			disabled={state === "disabled"}
			container={container}
			collisionBoundary={container}
		/>
	);
}

/** 六种状态 × 四种变体，一页一档尺寸；三档分在三个检视状态里。 */
function StateGrid({ size }: { size: ControlSize }) {
	const { ref, container } = useStageContainer();
	const sizeLabel = SIZES.find((item) => item.size === size)?.label ?? "";
	return (
		<div ref={ref} className="relative flex size-full flex-col gap-3 px-8 pt-5">
			<Caption>{sizeLabel}</Caption>
			<div className="grid grid-cols-[3rem_repeat(4,minmax(0,1fr))] items-center gap-x-3 gap-y-2.5">
				<span />
				{VARIANTS.map(({ variant, label }) => (
					<Caption key={variant}>{label}</Caption>
				))}
				{CELL_STATES.map(({ id, label }) => (
					<StateRow key={id} state={id} label={label} size={size} container={container} />
				))}
			</div>
		</div>
	);
}

function StateRow({
	state,
	label,
	size,
	container,
}: {
	state: CellState;
	label: string;
	size: ControlSize;
	container: HTMLElement | null;
}) {
	return (
		<>
			<Caption>{label}</Caption>
			{VARIANTS.map(({ variant, label: variantLabel }) => (
				<StateCell
					key={variant}
					state={state}
					variant={variant}
					size={size}
					container={container}
					label={`${variantLabel}${label}级联选择`}
				/>
			))}
		</>
	);
}

function CascaderStage({ state }: ExhibitRenderProps) {
	if (state === "any-level") return <AnyLevelStage />;
	if (state === "search") return <SearchStage />;
	if (state === "lazy") return <LazyStage />;
	if (state === "deep") return <DeepStage />;
	if (state === "states-sm") return <StateGrid size="sm" />;
	if (state === "states-md") return <StateGrid size="md" />;
	if (state === "states-lg") return <StateGrid size="lg" />;
	return <DefaultStage />;
}

export const cascaderExhibit: Exhibit = {
	id: "cascader",
	name: "级联选择",
	units: ["cascader"],
	zone: "field",
	category: "form",
	footprint: { width: 640, height: 380 },
	states: [
		{ id: "default", label: "默认 · 三级" },
		{ id: "any-level", label: "任意层级可选" },
		{ id: "search", label: "搜索" },
		{ id: "lazy", label: "按需加载" },
		{ id: "deep", label: "超过三级" },
		{ id: "states-sm", label: "状态 · 小" },
		{ id: "states-md", label: "状态 · 中" },
		{ id: "states-lg", label: "状态 · 大" },
	],
	Render: CascaderStage,
};
