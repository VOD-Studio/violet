import {
	Button,
	Sheet,
	SheetBody,
	SheetClose,
	SheetContent,
	type SheetContentProps,
	SheetFooter,
	SheetHeader,
	type SheetProps,
	SheetTitle,
	Tag,
	TagToggle,
} from "@violet/ui";
import { cn } from "cn";
import { SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { useStageContainer } from "../../hooks/use-stage-container";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";

const POSTS = [
	{
		title: "独库公路，六天",
		status: "已发布",
		date: "2026-10-12",
		words: "6,820",
		series: "独库公路骑行记",
		tags: ["骑行", "新疆"],
		excerpt: "从独山子出发，第一天就爬升两千米。哈希勒根达坂的风把手套吹透。",
	},
	{
		title: "拆解 Saber —— 一个用 Go 写就的聊天机器人",
		status: "已发布",
		date: "2026-10-03",
		words: "9,140",
		series: "—",
		tags: ["Go", "AI"],
		excerpt: "插件、权限与会话都在一个进程里，读一遍源码比读文档快。",
	},
	{
		title: "秋天的桂花酿",
		status: "草稿",
		date: "—",
		words: "1,280",
		series: "—",
		tags: ["生活"],
		excerpt: "桂花要在清早采，糖与花一层一层压实，三周后开封。",
	},
	{
		title: "Rust 全栈笔记 · 第 4 章 · 实时推送",
		status: "定时",
		date: "2026-11-02",
		words: "7,560",
		series: "Rust 全栈笔记",
		tags: ["Rust"],
		excerpt: "SSE 比 WebSocket 少一层握手，代价是只能单向推送。",
	},
	{
		title: "把落花写进 CSS",
		status: "已发布",
		date: "2026-09-21",
		words: "4,300",
		series: "—",
		tags: ["CSS", "前端"],
		excerpt: "每片花瓣是一条路径，飘落用 offset-path，减弱动态时停住。",
	},
];

const FILTERS = [
	{ name: "标签", options: ["Go", "Rust", "前端", "骑行", "摄影", "生活", "AI", "CSS"] },
	{ name: "状态", options: ["已发布", "草稿", "定时"] },
	{ name: "年份", options: ["2026", "2025", "2024"] },
];

type Side = NonNullable<SheetContentProps["side"]>;
type Size = NonNullable<SheetContentProps["size"]>;

/** 详情面板无遮罩、常开：点别的行只换内容；「筛选」有遮罩，陈列态用非模态常开一个。 */
const STATES: {
	id: string;
	label: string;
	side: Side;
	size: Size;
	resting: "detail" | "filter";
}[] = [
	{ id: "detail", label: "无遮罩详情", side: "right", size: "md", resting: "detail" },
	{ id: "filter", label: "有遮罩筛选", side: "right", size: "sm", resting: "filter" },
	{ id: "left", label: "左侧", side: "left", size: "md", resting: "detail" },
	{ id: "wide", label: "大 520", side: "right", size: "lg", resting: "detail" },
];

function FilterSheet({
	container,
	root,
	content,
}: {
	container: HTMLElement | null;
	root: SheetProps;
	content?: Partial<SheetContentProps>;
}) {
	const [picked, setPicked] = useState<string[]>(["骑行"]);
	return (
		<Sheet {...root}>
			<SheetContent container={container} size="sm" aria-describedby={undefined} {...content}>
				<SheetHeader>
					<SheetTitle>筛选</SheetTitle>
				</SheetHeader>
				<SheetBody className="flex flex-col gap-5.5">
					{FILTERS.map((group) => (
						<section key={group.name} aria-label={group.name}>
							<p className="m-0 text-13 text-muted-foreground">{group.name}</p>
							<div className="mt-2.5 flex flex-wrap gap-1.5">
								{group.options.map((option) => (
									<TagToggle
										key={option}
										size="sm"
										pressed={picked.includes(option)}
										onPressedChange={(next) =>
											setPicked((current) =>
												next
													? [...current, option]
													: current.filter((item) => item !== option),
											)
										}
									>
										{option}
									</TagToggle>
								))}
							</div>
						</section>
					))}
				</SheetBody>
				<SheetFooter>
					<Button variant="secondary" className="flex-1" onClick={() => setPicked([])}>
						重置
					</Button>
					<SheetClose asChild>
						<Button className="flex-1">
							看 {Math.max(1, 12 - picked.length * 2)} 篇
						</Button>
					</SheetClose>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}

/** 文章后台的列表：点行打开详情，点「筛选」打开铺满视口的有遮罩筛选。 */
function SheetStage({ state }: ExhibitRenderProps) {
	const current = STATES.find((item) => item.id === state) ?? STATES[0];
	const { ref, container, host } = useStageContainer();
	const [row, setRow] = useState<number | null>(current.resting === "detail" ? 0 : null);
	const [restingFilter, setRestingFilter] = useState(current.resting === "filter");
	const [filter, setFilter] = useState(false);
	const insideStage = (target: EventTarget | null) =>
		target instanceof Node && container?.contains(target);
	const post = row === null ? null : POSTS[row];

	// 陈列中的面板不抢焦点，舞台外的 Esc 交还给展厅
	const resting: Partial<SheetContentProps> = {
		onOpenAutoFocus: (event) => event.preventDefault(),
		onEscapeKeyDown: (event) => {
			if (!insideStage(document.activeElement)) event.preventDefault();
		},
	};

	return (
		<div
			ref={ref}
			className="relative size-full overflow-hidden rounded-xl bg-background text-foreground outline-1 -outline-offset-1 outline-rule2 contain-layout"
		>
			<div className="flex items-center justify-between px-6 pt-5 pb-3">
				<h3 className="m-0 text-17 font-semibold">
					文章{" "}
					<span className="font-mono text-13 text-muted-foreground">{POSTS.length}</span>
				</h3>
				<Button
					variant="secondary"
					size="sm"
					onClick={() => {
						setRestingFilter(false);
						setFilter(true);
					}}
				>
					<SlidersHorizontal aria-hidden="true" />
					筛选
				</Button>
			</div>
			<ul className="m-0 list-none px-3">
				{POSTS.map((item, index) => (
					<li key={item.title}>
						<button
							type="button"
							aria-current={row === index || undefined}
							onClick={() => setRow(index)}
							className={cn(
								"grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg bg-transparent px-3 py-2.5 text-left text-14 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
								row === index && "bg-muted",
							)}
						>
							<span className="truncate">{item.title}</span>
							<span className="font-mono text-12 text-muted-foreground">
								{item.date}
							</span>
						</button>
					</li>
				))}
			</ul>
			<Sheet
				modal={false}
				open={post !== null}
				onOpenChange={(next) => {
					if (!next) setRow(null);
				}}
			>
				<SheetContent
					container={container}
					side={current.side}
					size={current.size}
					contentKey={row ?? undefined}
					aria-describedby={undefined}
					{...resting}
				>
					{post && (
						<>
							<SheetHeader>
								<SheetTitle>{post.title}</SheetTitle>
							</SheetHeader>
							<SheetBody>
								<p className="m-0 text-14 leading-relaxed">{post.excerpt}</p>
								<dl className="m-0 mt-4">
									{(
										[
											["状态", post.status],
											["发布时间", post.date],
											["字数", post.words],
											["系列", post.series],
										] as const
									).map(([term, detail]) => (
										<div
											key={term}
											className="grid grid-cols-[72px_minmax(0,1fr)] gap-3 border-border border-b py-2.5 text-14"
										>
											<dt className="text-muted-foreground">{term}</dt>
											<dd className="m-0">{detail}</dd>
										</div>
									))}
									<div className="grid grid-cols-[72px_minmax(0,1fr)] gap-3 py-2.5 text-14">
										<dt className="text-muted-foreground">标签</dt>
										<dd className="m-0 flex flex-wrap gap-1.5">
											{post.tags.map((tag) => (
												<Tag key={tag} size="sm">
													{tag}
												</Tag>
											))}
										</dd>
									</div>
								</dl>
							</SheetBody>
							<SheetFooter>
								<Button variant="ghost" className="mr-auto text-destructive">
									移到回收站
								</Button>
								<Button>编辑</Button>
							</SheetFooter>
						</>
					)}
				</SheetContent>
			</Sheet>
			<FilterSheet container={host} root={{ open: filter, onOpenChange: setFilter }} />
			{restingFilter && (
				<div aria-hidden="true" data-state="open" className="v-scrim v-scrim--soft" />
			)}
			<FilterSheet
				container={container}
				root={{ open: restingFilter, onOpenChange: setRestingFilter, modal: false }}
				content={resting}
			/>
		</div>
	);
}

export const sheetExhibit: Exhibit = {
	id: "sheet",
	name: "侧边面板",
	units: ["sheet"],
	zone: "stage",
	category: "overlay",
	footprint: { width: 560, height: 420 },
	states: STATES.map(({ id, label }) => ({ id, label })),
	Render: (props) => <SheetStage key={props.state} {...props} />,
};
