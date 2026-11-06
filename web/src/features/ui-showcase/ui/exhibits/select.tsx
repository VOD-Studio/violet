import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "@violet/ui";
import { BookOpen, FileText, Link2, Pencil } from "lucide-react";
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

const STATUS = [
	{ value: "draft", label: "草稿" },
	{ value: "published", label: "已发布" },
	{ value: "archived", label: "已归档" },
	{ value: "removed", label: "已删除", disabled: true },
	{ value: "review", label: "审核中" },
];

const KINDS = [
	{
		group: "站内",
		items: [
			{ value: "blog", label: "博客", description: "长文章，带目录与系列", icon: BookOpen },
			{ value: "note", label: "手记", description: "按天的时间线", icon: Pencil },
			{ value: "tweet", label: "推文", description: "短内容，可带图", icon: FileText },
		],
	},
	{
		group: "站外",
		items: [
			{ value: "feed", label: "转载订阅", description: "来自外部站点的更新", icon: Link2 },
		],
	},
];

const TAGS = ["Go", "Rust", "React", "TypeScript", "Postgres", "Redis", "Docker", "Tailwind"];

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
	const [value, setValue] = useState("published");
	return (
		<Stage stageRef={ref} {...stageProps}>
			<Caption>文章状态</Caption>
			<Select value={value} onValueChange={setValue} {...openProps}>
				<SelectTrigger aria-label="文章状态" className="w-72">
					<SelectValue placeholder="选择状态" />
				</SelectTrigger>
				<SelectContent container={container} collisionBoundary={container}>
					{STATUS.map((item) => (
						<SelectItem key={item.value} value={item.value} disabled={item.disabled}>
							{item.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</Stage>
	);
}

function RichStage() {
	const { ref, container } = useStageContainer();
	const { stageProps, ...openProps } = useAutoOpen(container);
	const [value, setValue] = useState("note");
	return (
		<Stage stageRef={ref} {...stageProps}>
			<Caption>发布到</Caption>
			<Select value={value} onValueChange={setValue} {...openProps}>
				<SelectTrigger aria-label="发布到" className="w-80">
					<SelectValue placeholder="选择发布位置" />
				</SelectTrigger>
				<SelectContent container={container} collisionBoundary={container}>
					{KINDS.map(({ group, items }) => (
						<SelectGroup key={group}>
							<SelectLabel>{group}</SelectLabel>
							{items.map(({ icon: Icon, ...item }) => (
								<SelectItem key={item.value} icon={<Icon />} {...item}>
									{item.label}
								</SelectItem>
							))}
						</SelectGroup>
					))}
				</SelectContent>
			</Select>
		</Stage>
	);
}

function MultipleStage() {
	const { ref, container } = useStageContainer();
	const { stageProps, ...openProps } = useAutoOpen(container);
	const [value, setValue] = useState(["Go", "Rust", "React"]);
	return (
		<Stage stageRef={ref} {...stageProps}>
			<Caption>文章标签</Caption>
			<Select multiple value={value} onValueChange={setValue} {...openProps}>
				<SelectTrigger aria-label="文章标签" className="w-80">
					<SelectValue placeholder="添加标签" />
				</SelectTrigger>
				<SelectContent container={container} collisionBoundary={container}>
					{TAGS.map((tag) => (
						<SelectItem key={tag} value={tag}>
							{tag}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</Stage>
	);
}

/** 状态格：触发器的真实属性，选项只有两项，读值用。 */
type CellState = "rest" | "invalid" | "valid" | "loading" | "readonly" | "disabled";

const CELL_STATES: { id: CellState; label: string }[] = [
	{ id: "rest", label: "默认" },
	{ id: "invalid", label: "出错" },
	{ id: "valid", label: "通过" },
	{ id: "loading", label: "加载" },
	{ id: "readonly", label: "只读" },
	{ id: "disabled", label: "禁用" },
];

interface StageMount {
	container: HTMLElement | null;
}

function StateSelect({
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
} & StageMount) {
	return (
		<Select
			defaultValue={state === "rest" || state === "loading" ? undefined : "published"}
			readOnly={state === "readonly"}
			disabled={state === "disabled"}
		>
			<SelectTrigger
				aria-label={label}
				variant={variant}
				controlSize={size}
				invalid={state === "invalid"}
				valid={state === "valid"}
				loading={state === "loading"}
			>
				<SelectValue placeholder={state === "loading" ? "加载选项…" : "选择"} />
			</SelectTrigger>
			<SelectContent container={container} collisionBoundary={container}>
				{STATUS.slice(0, 3).map((item) => (
					<SelectItem key={item.value} value={item.value}>
						{item.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
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
					<RowOf key={id} state={id} label={label} size={size} container={container} />
				))}
			</div>
		</div>
	);
}

function RowOf({
	state,
	label,
	size,
	container,
}: {
	state: CellState;
	label: string;
	size: ControlSize;
} & StageMount) {
	return (
		<>
			<Caption>{label}</Caption>
			{VARIANTS.map(({ variant, label: variantLabel }) => (
				<StateSelect
					key={variant}
					state={state}
					variant={variant}
					size={size}
					container={container}
					label={`${variantLabel}${label}选择器`}
				/>
			))}
		</>
	);
}

function EmptyStage() {
	const { ref, container } = useStageContainer();
	const { stageProps, ...openProps } = useAutoOpen(container);
	return (
		<Stage stageRef={ref} {...stageProps}>
			<div className="grid grid-cols-2 gap-x-4">
				<div className="flex min-w-0 flex-col gap-2">
					<Caption>还没有系列</Caption>
					<Select {...openProps}>
						<SelectTrigger aria-label="选择系列">
							<SelectValue placeholder="选择系列" />
						</SelectTrigger>
						<SelectContent
							container={container}
							collisionBoundary={container}
							empty="还没有系列，去新建"
						/>
					</Select>
				</div>
				<div className="flex min-w-0 flex-col gap-2">
					<Caption>加载中</Caption>
					<Select loading {...openProps}>
						<SelectTrigger aria-label="加载系列">
							<SelectValue placeholder="加载选项…" />
						</SelectTrigger>
						<SelectContent container={container} collisionBoundary={container} />
					</Select>
				</div>
			</div>
		</Stage>
	);
}

function SelectStage({ state }: ExhibitRenderProps) {
	if (state === "rich") return <RichStage />;
	if (state === "multiple") return <MultipleStage />;
	if (state === "states-sm") return <StateGrid size="sm" />;
	if (state === "states-md") return <StateGrid size="md" />;
	if (state === "states-lg") return <StateGrid size="lg" />;
	if (state === "empty") return <EmptyStage />;
	return <SingleStage />;
}

export const selectExhibit: Exhibit = {
	id: "select",
	name: "选择器",
	units: ["select"],
	zone: "field",
	category: "form",
	footprint: { width: 560, height: 400 },
	states: [
		{ id: "single", label: "单选" },
		{ id: "rich", label: "分组与说明" },
		{ id: "multiple", label: "多选" },
		{ id: "states-sm", label: "状态 · 小" },
		{ id: "states-md", label: "状态 · 中" },
		{ id: "states-lg", label: "状态 · 大" },
		{ id: "empty", label: "无选项与加载" },
	],
	Render: SelectStage,
};
