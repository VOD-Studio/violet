import {
	Button,
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuRadioGroup,
	ContextMenuRadioItem,
	ContextMenuSeparator,
	ContextMenuShortcut,
	ContextMenuSub,
	ContextMenuSubContent,
	ContextMenuSubTrigger,
	ContextMenuTrigger,
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
	ListHighlight,
	ListHighlightItem,
} from "@violet/ui";
import {
	ArrowDownUp,
	Ellipsis,
	FolderInput,
	Link2,
	Pencil,
	Pin,
	PinOff,
	Plus,
	SlidersHorizontal,
	Trash2,
} from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useStageContainer } from "../../hooks/use-stage-container";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";

interface Article {
	id: string;
	title: string;
	excerpt: string;
	status: "published" | "draft";
	date: string;
	views: number;
	series: string;
	pinned: boolean;
}

const ARTICLES: Article[] = [
	{
		id: "season",
		title: "给博客加了季节",
		excerpt: "春夏秋冬各一套配色，跟着日历自己换。",
		status: "published",
		date: "10-28",
		views: 1280,
		series: "前端",
		pinned: false,
	},
	{
		id: "locks",
		title: "Postgres 锁等待排查",
		excerpt: "一次线上慢查询，最后发现是谁在等谁。",
		status: "draft",
		date: "10-26",
		views: 0,
		series: "后端",
		pinned: false,
	},
	{
		id: "road",
		title: "独库公路，六天",
		excerpt: "从独山子到库车，路上下了三场雪。",
		status: "published",
		date: "09-30",
		views: 3416,
		series: "骑行",
		pinned: true,
	},
];

const SERIES = ["前端", "后端", "骑行"];

const SORTS = [
	{ id: "latest", label: "最新" },
	{ id: "views", label: "浏览最多" },
	{ id: "title", label: "标题" },
] as const;
type SortId = (typeof SORTS)[number]["id"];

const COLUMNS = [
	{ id: "excerpt", label: "显示摘要", key: "⌘1" },
	{ id: "date", label: "显示日期", key: "⌘2" },
	{ id: "views", label: "显示浏览量", key: "⌘3" },
] as const;
type ColumnId = (typeof COLUMNS)[number]["id"];

/** 同一套项在两个命名空间下的部件：操作菜单与右键菜单的项结构完全相同。 */
interface MenuKit {
	Item: typeof DropdownMenuItem;
	Shortcut: typeof DropdownMenuShortcut;
	Separator: typeof DropdownMenuSeparator;
	Sub: typeof DropdownMenuSub;
	SubTrigger: typeof DropdownMenuSubTrigger;
	SubContent: typeof DropdownMenuSubContent;
	RadioGroup: typeof DropdownMenuRadioGroup;
	RadioItem: typeof DropdownMenuRadioItem;
}

const dropdownKit: MenuKit = {
	Item: DropdownMenuItem,
	Shortcut: DropdownMenuShortcut,
	Separator: DropdownMenuSeparator,
	Sub: DropdownMenuSub,
	SubTrigger: DropdownMenuSubTrigger,
	SubContent: DropdownMenuSubContent,
	RadioGroup: DropdownMenuRadioGroup,
	RadioItem: DropdownMenuRadioItem,
};

const contextKit: MenuKit = {
	Item: ContextMenuItem,
	Shortcut: ContextMenuShortcut,
	Separator: ContextMenuSeparator,
	Sub: ContextMenuSub,
	SubTrigger: ContextMenuSubTrigger,
	SubContent: ContextMenuSubContent,
	RadioGroup: ContextMenuRadioGroup,
	RadioItem: ContextMenuRadioItem,
};

interface ArticleActions {
	onAct: (label: string) => void;
	onMoveSeries: (id: string, series: string) => void;
	onTogglePin: (id: string) => void;
	onTrash: (id: string) => void;
}

/** 一篇文章的全部操作项：⋯ 菜单与右键菜单都渲染它。 */
function ArticleItems({
	kit,
	article,
	actions,
	boundary,
}: {
	kit: MenuKit;
	article: Article;
	actions: ArticleActions;
	boundary: HTMLElement | undefined;
}) {
	const { Item, Shortcut, Separator, Sub, SubTrigger, SubContent, RadioGroup, RadioItem } = kit;
	const draft = article.status === "draft";
	return (
		<>
			<Item onSelect={() => actions.onAct(`编辑「${article.title}」`)}>
				<Pencil />
				编辑
				<Shortcut>E</Shortcut>
			</Item>
			<Item onSelect={() => actions.onAct("复制链接")}>
				<Link2 />
				复制链接
				<Shortcut>⌘C</Shortcut>
			</Item>
			<Sub>
				<SubTrigger>
					<FolderInput />
					移动到系列
				</SubTrigger>
				<SubContent collisionBoundary={boundary}>
					<RadioGroup
						value={article.series}
						onValueChange={(series) => actions.onMoveSeries(article.id, series)}
					>
						{SERIES.map((series) => (
							<RadioItem key={series} value={series}>
								{series}
							</RadioItem>
						))}
					</RadioGroup>
					<Separator />
					<Item onSelect={() => actions.onAct("新建系列")}>
						<Plus />
						新建系列…
					</Item>
				</SubContent>
			</Sub>
			<Item
				disabled={draft}
				reason={draft ? "草稿不能置顶" : undefined}
				onSelect={() => actions.onTogglePin(article.id)}
			>
				{article.pinned ? <PinOff /> : <Pin />}
				{article.pinned ? "取消置顶" : "置顶"}
			</Item>
			<Separator />
			<Item variant="destructive" onSelect={() => actions.onTrash(article.id)}>
				<Trash2 />
				移到回收站
				<Shortcut>⌫</Shortcut>
			</Item>
		</>
	);
}

type AutoOpen = "menu" | "submenu" | "context" | null;

function ArticleRow({
	article,
	visible,
	actions,
	autoOpen,
	container,
}: {
	article: Article;
	visible: Set<ColumnId>;
	actions: ArticleActions;
	autoOpen: AutoOpen;
	container: HTMLElement | null;
}) {
	const rowRef = useRef<HTMLLIElement>(null);
	// 展柜里直接展开的菜单不抢焦点；用户之后自己打开时按原样聚焦
	const skipFocus = useRef(autoOpen !== null);
	const boundary = container ?? undefined;

	// 右键菜单没有受控的 open：在行上补发一次 contextmenu，位置落在行中偏左
	useEffect(() => {
		if (autoOpen !== "context") return;
		const frame = requestAnimationFrame(() => {
			const row = rowRef.current;
			if (!row) return;
			const rect = row.getBoundingClientRect();
			row.dispatchEvent(
				new MouseEvent("contextmenu", {
					bubbles: true,
					cancelable: true,
					button: 2,
					clientX: rect.left + 120,
					clientY: rect.top + 28,
				}),
			);
		});
		return () => cancelAnimationFrame(frame);
	}, [autoOpen]);

	// 子菜单展开态：Radix 的 Sub 在开发期 StrictMode 重复挂载时会把默认值收回去，
	// 所以等菜单就绪后在子菜单触发项上补一次指针移动，走真实的悬停 100ms 路径
	useEffect(() => {
		if (autoOpen !== "submenu" || !container) return;
		const timer = setTimeout(() => {
			container
				.querySelector('[data-slot="dropdown-menu-sub-trigger"]')
				?.dispatchEvent(
					new PointerEvent("pointermove", { bubbles: true, pointerType: "mouse" }),
				);
		}, 400);
		return () => clearTimeout(timer);
	}, [autoOpen, container]);

	const keepFocus = (event: Event) => {
		if (!skipFocus.current) return;
		skipFocus.current = false;
		event.preventDefault();
	};

	return (
		<ContextMenu modal={false}>
			<ContextMenuTrigger asChild>
				<ListHighlightItem>
					<li ref={rowRef} className="flex items-center gap-3 rounded-xl px-3 py-2">
						<div className="min-w-0 flex-1">
							<div className="flex items-center gap-1.5">
								{article.pinned && (
									<Pin
										aria-label="已置顶"
										className="size-3.5 text-selected-foreground"
									/>
								)}
								<b className="truncate text-14 font-semibold">{article.title}</b>
							</div>
							{visible.has("excerpt") && (
								<p className="mt-0.5 truncate text-13 text-muted-foreground">
									{article.excerpt}
								</p>
							)}
							<p className="mt-1 flex gap-3 text-12 text-muted-foreground">
								<span>{article.status === "draft" ? "草稿" : "已发布"}</span>
								<span>{article.series}</span>
								{visible.has("date") && <span>{article.date}</span>}
								{visible.has("views") && <span>{article.views} 次浏览</span>}
							</p>
						</div>
						<DropdownMenu
							modal={false}
							defaultOpen={autoOpen === "menu" || autoOpen === "submenu"}
						>
							<DropdownMenuTrigger asChild>
								<Button
									iconOnly
									type="button"
									variant="ghost"
									size="sm"
									aria-label={`${article.title}的更多操作`}
								>
									<Ellipsis />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								align="end"
								aria-label="文章操作"
								container={container}
								collisionBoundary={boundary}
								onOpenAutoFocus={keepFocus}
							>
								<ArticleItems
									kit={dropdownKit}
									article={article}
									actions={actions}
									boundary={boundary}
								/>
							</DropdownMenuContent>
						</DropdownMenu>
					</li>
				</ListHighlightItem>
			</ContextMenuTrigger>
			<ContextMenuContent
				aria-label="文章操作"
				container={container}
				collisionBoundary={boundary}
				onOpenAutoFocus={keepFocus}
			>
				<ArticleItems
					kit={contextKit}
					article={article}
					actions={actions}
					boundary={boundary}
				/>
			</ContextMenuContent>
		</ContextMenu>
	);
}

function ToolbarMenu({
	label,
	icon,
	defaultOpen,
	container,
	children,
}: {
	label: string;
	icon: ReactNode;
	defaultOpen: boolean;
	container: HTMLElement | null;
	children: ReactNode;
}) {
	const skipFocus = useRef(defaultOpen);
	return (
		<DropdownMenu modal={false} defaultOpen={defaultOpen}>
			<DropdownMenuTrigger asChild>
				<Button type="button" variant="ghost" size="sm">
					{icon}
					{label}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="end"
				container={container}
				collisionBoundary={container ?? undefined}
				onOpenAutoFocus={(event) => {
					if (!skipFocus.current) return;
					skipFocus.current = false;
					event.preventDefault();
				}}
			>
				{children}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/** 「我的文章」：每行右侧 ⋯ 与行上右键打开同一套项，排序是单选、显示是多选。 */
function ArticleScene({ state }: ExhibitRenderProps) {
	const { ref, container } = useStageContainer();
	const [articles, setArticles] = useState(ARTICLES);
	const [trashed, setTrashed] = useState<Article[]>([]);
	const [sort, setSort] = useState<SortId>("latest");
	const [visible, setVisible] = useState<Set<ColumnId>>(new Set(["excerpt", "date", "views"]));
	const [lastAct, setLastAct] = useState("还没有操作");

	const actions: ArticleActions = {
		onAct: setLastAct,
		onMoveSeries: (id, series) => {
			setArticles((list) =>
				list.map((item) => (item.id === id ? { ...item, series } : item)),
			);
			setLastAct(`移动到系列「${series}」`);
		},
		onTogglePin: (id) => {
			setArticles((list) =>
				list.map((item) => (item.id === id ? { ...item, pinned: !item.pinned } : item)),
			);
			setLastAct("置顶状态已改变");
		},
		onTrash: (id) => {
			const target = articles.find((item) => item.id === id);
			if (!target) return;
			setArticles((list) => list.filter((item) => item.id !== id));
			setTrashed((list) => [...list, target]);
			setLastAct(`「${target.title}」已移到回收站`);
		},
	};

	const sorted = [...articles].sort((a, b) => {
		if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
		if (sort === "views") return b.views - a.views;
		if (sort === "title") return a.title.localeCompare(b.title, "zh-Hans");
		return b.date.localeCompare(a.date);
	});
	// 展示用的行：最上面一行的菜单向下展开，最下面的草稿行向上展开，都落在舞台里
	const rowAutoOpen = (article: Article): AutoOpen => {
		if (article.id === sorted[0]?.id) {
			if (state === "row") return "menu";
			if (state === "submenu" || state === "context") return state;
		}
		return article.id === "locks" && state === "draft" ? "menu" : null;
	};
	const sortLabel = SORTS.find((item) => item.id === sort)?.label ?? "";

	return (
		<div ref={ref} className="flex size-full flex-col gap-2">
			<header className="flex items-center justify-between px-3">
				<h3 className="text-14 font-semibold">我的文章</h3>
				<div className="flex items-center gap-1">
					<ToolbarMenu
						label={`排序 · ${sortLabel}`}
						icon={<ArrowDownUp />}
						defaultOpen={state === "sort"}
						container={container}
					>
						<DropdownMenuLabel>排序</DropdownMenuLabel>
						<DropdownMenuRadioGroup
							value={sort}
							onValueChange={(value) => setSort(value as SortId)}
						>
							{SORTS.map((item) => (
								<DropdownMenuRadioItem key={item.id} value={item.id}>
									{item.label}
								</DropdownMenuRadioItem>
							))}
						</DropdownMenuRadioGroup>
					</ToolbarMenu>
					<ToolbarMenu
						label="显示"
						icon={<SlidersHorizontal />}
						defaultOpen={state === "view"}
						container={container}
					>
						<DropdownMenuLabel>显示</DropdownMenuLabel>
						{COLUMNS.map((column) => (
							<DropdownMenuCheckboxItem
								key={column.id}
								checked={visible.has(column.id)}
								onCheckedChange={(checked) =>
									setVisible((current) => {
										const next = new Set(current);
										if (checked) next.add(column.id);
										else next.delete(column.id);
										return next;
									})
								}
							>
								{column.label}
								<DropdownMenuShortcut>{column.key}</DropdownMenuShortcut>
							</DropdownMenuCheckboxItem>
						))}
						<DropdownMenuSeparator />
						<DropdownMenuLabel>多选项点了不收起，可以连着改</DropdownMenuLabel>
					</ToolbarMenu>
				</div>
			</header>
			{sorted.length > 0 ? (
				<ListHighlight>
					<ul className="m-0 flex list-none flex-col gap-1 p-0">
						{sorted.map((article) => (
							<ArticleRow
								key={article.id}
								article={article}
								visible={visible}
								actions={actions}
								autoOpen={rowAutoOpen(article)}
								container={container}
							/>
						))}
					</ul>
				</ListHighlight>
			) : (
				<div className="flex items-center gap-3 px-3 py-6 text-14 text-muted-foreground">
					都移到回收站了。
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => {
							setArticles(trashed);
							setTrashed([]);
							setLastAct("全部恢复");
						}}
					>
						全部恢复
					</Button>
				</div>
			)}
			<p className="mt-auto px-3 text-12 text-muted-foreground">最近一次 · {lastAct}</p>
		</div>
	);
}

/** 状态切换时整个场景重建，让默认展开的菜单按新状态重新挂载。 */
function ArticleScenes({ state }: ExhibitRenderProps) {
	return <ArticleScene key={state} state={state} />;
}

export const dropdownMenuExhibit: Exhibit = {
	id: "dropdown-menu",
	name: "操作菜单",
	units: ["dropdown-menu", "context-menu"],
	zone: "stage",
	category: "overlay",
	footprint: { width: 480, height: 380 },
	states: [
		{ id: "row", label: "行菜单" },
		{ id: "submenu", label: "子菜单" },
		{ id: "draft", label: "不可用项" },
		{ id: "context", label: "右键菜单" },
		{ id: "sort", label: "单选" },
		{ id: "view", label: "多选" },
		{ id: "idle", label: "静止" },
	],
	Render: ArticleScenes,
};
