import { TreeSelect, type TreeSelectOption } from "@violet/ui";
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

const ASSETS: TreeSelectOption[] = [
	{
		value: "2025",
		label: "2025",
		meta: 5,
		children: [
			{
				value: "2025/trip",
				label: "旅行",
				meta: 2,
				children: [
					{ value: "2025/trip/duku", label: "独库公路" },
					{ value: "2025/trip/qinghai", label: "青海湖" },
				],
			},
			{
				value: "2025/daily",
				label: "日常",
				meta: 3,
				children: [
					{ value: "2025/daily/breakfast", label: "早餐" },
					{ value: "2025/daily/desk", label: "书桌" },
					{ value: "2025/daily/cat", label: "猫", disabled: true },
				],
			},
		],
	},
	{
		value: "2026",
		label: "2026",
		meta: 6,
		children: [
			{
				value: "2026/season",
				label: "季节",
				meta: 4,
				children: [
					{ value: "2026/season/spring", label: "春" },
					{ value: "2026/season/summer", label: "夏" },
					{ value: "2026/season/autumn", label: "秋" },
					{ value: "2026/season/winter", label: "冬" },
				],
			},
			{
				value: "2026/shots",
				label: "项目截图",
				meta: 2,
				children: [
					{ value: "2026/shots/input", label: "输入框" },
					{ value: "2026/shots/admin", label: "后台" },
				],
			},
		],
	},
	{ value: "avatar", label: "头像" },
];

const REMOTE: TreeSelectOption[] = [
	{ value: "local", label: "本地素材", meta: 2, children: [{ value: "local/a", label: "封面" }] },
	{ value: "export", label: "导出（取回约 0.7 秒）", lazy: true },
	{ value: "backup", label: "离线备份（第一次取回失败）", lazy: true },
];

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

function SingleStage() {
	const { ref, container } = useStageContainer();
	const { stageProps, ...openProps } = useAutoOpen(container);
	const [value, setValue] = useState("2026/season/spring");
	return (
		<Stage stageRef={ref} {...stageProps}>
			<Caption>单选：点行选中并收起，点前面的箭头只展开收起</Caption>
			<TreeSelect
				aria-label="素材目录"
				placeholder="选择目录"
				className="w-80"
				options={ASSETS}
				value={value}
				onValueChange={setValue}
				container={container}
				collisionBoundary={container}
				{...openProps}
			/>
		</Stage>
	);
}

function MultipleStage() {
	const { ref, container } = useStageContainer();
	const { stageProps, ...openProps } = useAutoOpen(container);
	const [value, setValue] = useState([
		"2025/trip/duku",
		"2025/trip/qinghai",
		"2026/season/spring",
		"avatar",
	]);
	return (
		<Stage stageRef={ref} {...stageProps}>
			<Caption>多选：勾选联动，触发器只列覆盖最少的节点</Caption>
			<TreeSelect
				multiple
				aria-label="素材目录"
				placeholder="选择目录"
				className="w-96"
				options={ASSETS}
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
	const [value, setValue] = useState("");
	return (
		<Stage stageRef={ref} {...stageProps}>
			<Caption>搜索：只留匹配的节点与它们的祖先，祖先自动展开</Caption>
			<TreeSelect
				searchable
				aria-label="素材目录"
				placeholder="搜索目录"
				className="w-80"
				options={ASSETS}
				value={value}
				onValueChange={setValue}
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
	const attempts = useRef(0);
	const loadChildren = async (option: TreeSelectOption): Promise<TreeSelectOption[]> => {
		await new Promise<void>((resolve) => setTimeout(resolve, 700));
		if (option.value === "backup" && attempts.current++ === 0) {
			throw new Error("离线");
		}
		return [
			{ value: `${option.value}/1`, label: "第一组" },
			{ value: `${option.value}/2`, label: "第二组" },
		];
	};
	return (
		<Stage stageRef={ref} {...stageProps}>
			<Caption>懒加载：首次展开出现指示器，失败的行变红，点击重试</Caption>
			<TreeSelect
				aria-label="远程素材"
				placeholder="选择目录"
				className="w-80"
				options={REMOTE}
				loadChildren={loadChildren}
				container={container}
				collisionBoundary={container}
				{...openProps}
			/>
		</Stage>
	);
}

type CellState = "rest" | "invalid" | "valid" | "loading" | "readonly" | "disabled";

const CELL_STATES: { id: CellState; label: string }[] = [
	{ id: "rest", label: "默认" },
	{ id: "invalid", label: "出错" },
	{ id: "valid", label: "通过" },
	{ id: "loading", label: "加载" },
	{ id: "readonly", label: "只读" },
	{ id: "disabled", label: "禁用" },
];

function StateTree({
	state,
	variant,
	size,
	label,
	stage,
}: {
	state: CellState;
	variant: Variant;
	size: ControlSize;
	label: string;
	stage: HTMLElement | null;
}) {
	return (
		<TreeSelect
			aria-label={label}
			placeholder={state === "loading" ? "加载目录…" : "选择目录"}
			options={ASSETS}
			defaultValue={state === "rest" || state === "loading" ? undefined : "avatar"}
			variant={variant}
			controlSize={size}
			invalid={state === "invalid"}
			valid={state === "valid"}
			loading={state === "loading"}
			readOnly={state === "readonly"}
			disabled={state === "disabled"}
			container={stage}
			collisionBoundary={stage}
		/>
	);
}

function RowOf({
	state,
	label,
	stage,
}: {
	state: CellState;
	label: string;
	stage: HTMLElement | null;
}) {
	return (
		<>
			<Caption>{label}</Caption>
			{VARIANTS.map(({ variant, label: variantLabel }) => (
				<StateTree
					key={variant}
					state={state}
					variant={variant}
					size="md"
					label={`${variantLabel}${label}树选择`}
					stage={stage}
				/>
			))}
		</>
	);
}

function StateGrid() {
	const { ref, container } = useStageContainer();
	return (
		<div ref={ref} className="flex flex-col gap-5 p-1">
			<div className="grid grid-cols-[3rem_repeat(4,minmax(0,1fr))] items-center gap-x-3 gap-y-2.5">
				<span />
				{VARIANTS.map(({ variant, label }) => (
					<Caption key={variant}>{label}</Caption>
				))}
				{CELL_STATES.map(({ id, label }) => (
					<RowOf key={id} state={id} label={label} stage={container} />
				))}
			</div>
			<div className="grid grid-cols-3 gap-x-3">
				{SIZES.map(({ size, label }) => (
					<div key={size} className="flex min-w-0 flex-col gap-1.5">
						<Caption>{label}</Caption>
						<StateTree
							state="rest"
							variant="filled"
							size={size}
							label={`${label}树选择`}
							stage={container}
						/>
					</div>
				))}
			</div>
			<div className="grid grid-cols-2 gap-x-3">
				<div className="flex min-w-0 flex-col gap-1.5">
					<Caption>多选</Caption>
					<TreeSelect
						multiple
						aria-label="多选树选择"
						placeholder="选择目录"
						options={ASSETS}
						defaultValue={["2025/trip/duku", "2025/trip/qinghai", "avatar"]}
						container={container}
						collisionBoundary={container}
					/>
				</div>
				<div className="flex min-w-0 flex-col gap-1.5">
					<Caption>可搜索</Caption>
					<TreeSelect
						searchable
						aria-label="可搜索树选择"
						placeholder="搜索目录"
						options={ASSETS}
						defaultValue="2026/season/spring"
						container={container}
						collisionBoundary={container}
					/>
				</div>
			</div>
		</div>
	);
}

function TreeSelectStage({ state }: ExhibitRenderProps) {
	if (state === "multiple") return <MultipleStage />;
	if (state === "search") return <SearchStage />;
	if (state === "lazy") return <LazyStage />;
	if (state === "states") return <StateGrid />;
	return <SingleStage />;
}

export const treeSelectExhibit: Exhibit = {
	id: "tree-select",
	name: "树选择",
	units: ["tree-select"],
	zone: "field",
	category: "form",
	footprint: { width: 560, height: 480 },
	states: [
		{ id: "single", label: "单选" },
		{ id: "multiple", label: "多选" },
		{ id: "search", label: "搜索过滤" },
		{ id: "lazy", label: "懒加载" },
		{ id: "states", label: "状态" },
	],
	Render: TreeSelectStage,
};
