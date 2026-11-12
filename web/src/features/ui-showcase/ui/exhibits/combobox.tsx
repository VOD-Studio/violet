import { Combobox, type ComboboxOption, type ComboboxSearchContext } from "@violet/ui";
import { BookOpen, FileText, History, Link2, Pencil, Search, Tag } from "lucide-react";
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

const TAGS: ComboboxOption[] = [
	"Go",
	"Rust",
	"React",
	"Vue",
	"Vite",
	"Postgres",
	"Redis",
	"Tailwind",
	"踩坑",
	"随笔",
	"骑行",
	"摄影",
].map((tag) => ({ value: tag, label: tag }));

const POSTS: ComboboxOption[] = [
	["给博客加了季节", "技术 · 11-02"],
	["Postgres 锁等待的一次排查", "技术 · 10-28"],
	["独库公路，六天", "骑行 · 10-12"],
	["pnpm catalog 在 monorepo 里", "技术 · 10-21"],
	["胶片冲洗笔记", "摄影 · 09-30"],
	["拆解 Saber：会思考的聊天机器人", "技术 · 09-18"],
	["雨天的巴音布鲁克", "骑行 · 10-14"],
].map(([title, meta]) => ({ value: title, label: title, meta }));

const KINDS: ComboboxOption[] = [
	{
		value: "blog",
		label: "博客",
		description: "长文章，带目录与系列",
		icon: <BookOpen />,
		group: "站内",
	},
	{ value: "note", label: "手记", description: "按天的时间线", icon: <Pencil />, group: "站内" },
	{
		value: "tweet",
		label: "推文",
		description: "短内容，可带图",
		icon: <FileText />,
		group: "站内",
	},
	{
		value: "feed",
		label: "转载订阅",
		description: "来自外部站点的更新",
		icon: <Link2 />,
		group: "站外",
	},
];

const SEARCH_LATENCY_MS = 700;

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

function TagStage() {
	const { ref, container } = useStageContainer();
	const { stageProps, ...openProps } = useAutoOpen(container);
	const [value, setValue] = useState("");
	return (
		<Stage stageRef={ref} {...stageProps}>
			<Caption>文章标签：打字筛选，匹配的字加底色</Caption>
			<Combobox
				aria-label="标签"
				placeholder="输入或选择标签"
				leading={<Tag />}
				className="w-80"
				options={TAGS}
				value={value}
				onValueChange={setValue}
				defaultInputValue="re"
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
	const [options, setOptions] = useState(() =>
		POSTS.filter((post) => post.label.toLowerCase().includes("p")),
	);
	const [loading, setLoading] = useState(false);
	const search = (query: string, { signal }: ComboboxSearchContext) => {
		const needle = query.trim().toLowerCase();
		if (!needle) {
			setLoading(false);
			setOptions([]);
			return;
		}
		setLoading(true);
		const timer = window.setTimeout(() => {
			setOptions(
				POSTS.filter(
					(post) =>
						post.label.toLowerCase().includes(needle) ||
						String(post.meta).includes(needle),
				),
			);
			setLoading(false);
		}, SEARCH_LATENCY_MS);
		signal.addEventListener("abort", () => {
			window.clearTimeout(timer);
			setLoading(false);
		});
	};
	return (
		<Stage stageRef={ref} {...stageProps}>
			<Caption>搜索文章：停手 300ms 去查，查的时候保留旧结果</Caption>
			<Combobox
				aria-label="搜索文章"
				placeholder="搜索文章"
				leading={<Search />}
				className="w-96"
				options={options}
				defaultInputValue="p"
				onSearch={search}
				loading={loading}
				container={container}
				collisionBoundary={container}
				{...openProps}
			/>
		</Stage>
	);
}

function CreatableStage() {
	const { ref, container } = useStageContainer();
	const { stageProps, ...openProps } = useAutoOpen(container);
	const [tags, setTags] = useState(TAGS);
	const [value, setValue] = useState("");
	return (
		<Stage stageRef={ref} {...stageProps}>
			<Caption>没有完全一样的建议时，末行可以创建；Enter 直接用打的字</Caption>
			<Combobox
				aria-label="新标签"
				placeholder="输入或选择标签"
				leading={<Tag />}
				className="w-80"
				options={tags}
				value={value}
				onValueChange={setValue}
				creatable
				onCreate={(text) =>
					setTags((current) => [...current, { value: text, label: text }])
				}
				defaultInputValue="Svelte"
				container={container}
				collisionBoundary={container}
				{...openProps}
			/>
		</Stage>
	);
}

function GroupedStage() {
	const { ref, container } = useStageContainer();
	const { stageProps, ...openProps } = useAutoOpen(container);
	const [value, setValue] = useState("");
	return (
		<Stage stageRef={ref} {...stageProps}>
			<Caption>跳转到：分组、说明与图标块</Caption>
			<Combobox
				aria-label="跳转到"
				placeholder="跳转到页面"
				leading={<History />}
				className="w-96"
				options={KINDS}
				value={value}
				onValueChange={setValue}
				container={container}
				collisionBoundary={container}
				{...openProps}
			/>
		</Stage>
	);
}

/** 状态格：外壳的真实属性，建议只有两条，读值用。 */
type CellState = "rest" | "invalid" | "valid" | "loading" | "readonly" | "disabled";

const CELL_STATES: { id: CellState; label: string }[] = [
	{ id: "rest", label: "默认" },
	{ id: "invalid", label: "出错" },
	{ id: "valid", label: "通过" },
	{ id: "loading", label: "加载" },
	{ id: "readonly", label: "只读" },
	{ id: "disabled", label: "禁用" },
];

function StateCombobox({
	state,
	variant,
	size,
	label,
}: {
	state: CellState;
	variant: Variant;
	size: ControlSize;
	label: string;
}) {
	return (
		<Combobox
			aria-label={label}
			placeholder="输入或选择标签"
			variant={variant}
			controlSize={size}
			options={TAGS.slice(0, 3)}
			defaultValue={state === "rest" || state === "loading" ? undefined : "Rust"}
			invalid={state === "invalid"}
			valid={state === "valid"}
			loading={state === "loading"}
			readOnly={state === "readonly"}
			disabled={state === "disabled"}
		/>
	);
}

function RowOf({ state, label }: { state: CellState; label: string }) {
	return (
		<>
			<Caption>{label}</Caption>
			{VARIANTS.map(({ variant, label: variantLabel }) => (
				<StateCombobox
					key={variant}
					state={state}
					variant={variant}
					size="md"
					label={`${variantLabel}${label}组合框`}
				/>
			))}
		</>
	);
}

function StateGrid() {
	return (
		<div className="flex flex-col gap-5 p-1">
			<div className="grid grid-cols-[3rem_repeat(4,minmax(0,1fr))] items-center gap-x-3 gap-y-2.5">
				<span />
				{VARIANTS.map(({ variant, label }) => (
					<Caption key={variant}>{label}</Caption>
				))}
				{CELL_STATES.map(({ id, label }) => (
					<RowOf key={id} state={id} label={label} />
				))}
			</div>
			<div className="grid grid-cols-3 gap-x-3">
				{SIZES.map(({ size, label }) => (
					<div key={size} className="flex min-w-0 flex-col gap-1.5">
						<Caption>{label}</Caption>
						<StateCombobox
							state="rest"
							variant="filled"
							size={size}
							label={`${label}组合框`}
						/>
					</div>
				))}
			</div>
		</div>
	);
}

function ComboboxStage({ state }: ExhibitRenderProps) {
	if (state === "async") return <SearchStage />;
	if (state === "creatable") return <CreatableStage />;
	if (state === "grouped") return <GroupedStage />;
	if (state === "states") return <StateGrid />;
	return <TagStage />;
}

export const comboboxExhibit: Exhibit = {
	id: "combobox",
	name: "组合框",
	units: ["combobox"],
	zone: "field",
	category: "form",
	footprint: { width: 560, height: 400 },
	states: [
		{ id: "default", label: "默认" },
		{ id: "async", label: "异步搜索" },
		{ id: "creatable", label: "可创建" },
		{ id: "grouped", label: "分组与说明" },
		{ id: "states", label: "状态" },
	],
	Render: ComboboxStage,
};
