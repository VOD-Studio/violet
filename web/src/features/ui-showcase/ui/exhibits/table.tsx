import {
	Button,
	DataTable,
	type DataTableColumn,
	type DataTableSort,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	exportToCsv,
	SearchInput,
	Segmented,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Tag,
} from "@violet/ui";
import { Archive, Download, Ellipsis, Pencil, PenLine, Send, Star, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useStageContainer } from "../../hooks/use-stage-container";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";
import { StayLink } from "./stay-link";

type PostStatus = "pub" | "sched" | "draft" | "archived";

interface Post {
	id: string;
	title: string;
	status: PostStatus;
	featured: boolean;
	tags: string[];
	views: number;
	comments: number;
	/** 发布时间，未发布为空串 */
	published: string;
	words: number;
	series: string;
	excerpt: string;
	slug: string;
}

const STATUS_LABEL: Record<PostStatus, string> = {
	pub: "已发布",
	sched: "定时",
	draft: "草稿",
	archived: "已归档",
};

const STATUS_DOT: Record<PostStatus, string> = {
	pub: "bg-success",
	sched: "bg-decoration",
	draft: "ring-1.5 ring-muted-foreground/60 ring-inset",
	archived: "bg-muted-foreground/50",
};

const EXCERPTS = [
	"从独山子出发，第一天就爬升两千米，哈希勒根达坂的风把手套吹透。",
	"评论写进数据库之后，往这篇文章的频道里发一条事件，订阅的连接各自把它转成 SSE 消息。",
	"把编辑器能做的事情列成一张表：块、快捷键、批注、代码运行与导出。",
	"黑洞附近的光线怎么弯：从测地线方程一路写到逐像素的光线步进。",
];

const SLUGS = ["saber-go-chatbot", "duku-highway", "rust-fullstack-4"];

/** id、标题、状态、精选、标签、浏览、评论、发布时间、字数、系列 */
type Seed = [string, string, PostStatus, boolean, string[], number, number, string, number, string];

const SEEDS: Seed[] = [
	[
		"1",
		"拆解 Saber —— 一个用 Go 写就的、会思考的聊天机器人",
		"pub",
		true,
		["Go", "AI"],
		3412,
		28,
		"2026-10-28 20:00",
		1200,
		"",
	],
	[
		"2",
		"独库公路，六天",
		"pub",
		true,
		["骑行", "新疆"],
		2086,
		17,
		"2026-10-22 21:07",
		1337,
		"独库公路骑行记",
	],
	[
		"3",
		"Rust 全栈笔记 · 第 4 章 · 实时推送",
		"sched",
		false,
		["Rust", "后端"],
		0,
		0,
		"2026-11-02 09:30",
		1474,
		"Rust 全栈笔记",
	],
	[
		"4",
		"Rust 全栈笔记 · 第 3 章 · 评论与批注",
		"pub",
		false,
		["Rust", "后端", "数据库", "实时"],
		702,
		5,
		"2026-10-10 20:21",
		1611,
		"Rust 全栈笔记",
	],
	[
		"5",
		"文章编辑器全功能特性手册",
		"pub",
		true,
		["写作", "前端"],
		1190,
		9,
		"2026-09-28 21:28",
		1748,
		"从零写一个博客",
	],
	[
		"6",
		"逐像素弯曲时空：singularity-rs 黑洞渲染器深度解析",
		"pub",
		false,
		["Rust", "图形"],
		864,
		7,
		"2026-09-22 22:35",
		1885,
		"",
	],
	["7", "秋天的桂花酿", "draft", false, ["生活"], 0, 0, "", 2022, "独库公路骑行记"],
	["8", "给博客加一个命令面板", "draft", false, ["前端"], 0, 0, "", 2159, "Rust 全栈笔记"],
	[
		"9",
		"派早报：微软公布 Project Zenith 计划、F-Droid 拟效仿 Debian 制定生态规范",
		"pub",
		false,
		["少数派"],
		412,
		3,
		"2026-08-28 22:56",
		2296,
		"Rust 全栈笔记",
	],
	[
		"10",
		"浏览器扩展合集：我们为你找到了这 6 款实用的「新玩意」",
		"pub",
		false,
		["少数派"],
		388,
		3,
		"2026-08-22 20:03",
		2433,
		"从零写一个博客",
	],
	[
		"11",
		"从零写一个博客 · 第 1 章 · 脚手架",
		"pub",
		false,
		["Go"],
		1032,
		8,
		"2026-08-16 21:10",
		2570,
		"",
	],
	[
		"12",
		"从零写一个博客 · 第 2 章 · 认证",
		"pub",
		false,
		["Go", "安全"],
		940,
		7,
		"2026-08-10 22:17",
		2707,
		"独库公路骑行记",
	],
	[
		"13",
		"一个人的书单 · 2025",
		"pub",
		false,
		["读书"],
		610,
		5,
		"2026-07-28 20:24",
		2844,
		"Rust 全栈笔记",
	],
	[
		"14",
		"SQLite 也能做全文搜索",
		"pub",
		false,
		["数据库"],
		488,
		4,
		"2026-07-22 21:31",
		2981,
		"Rust 全栈笔记",
	],
	[
		"15",
		"在 Go 里优雅地关掉一个 goroutine",
		"pub",
		false,
		["Go"],
		1320,
		11,
		"2026-07-16 22:38",
		3118,
		"从零写一个博客",
	],
	["16", "把落花写进 CSS", "pub", false, ["前端", "CSS"], 720, 6, "2026-07-10 20:45", 3255, ""],
	["17", "旧相机修好了", "draft", false, ["摄影"], 0, 0, "", 3392, "独库公路骑行记"],
	[
		"18",
		"周末去了趟莫干山",
		"pub",
		false,
		["生活", "骑行"],
		356,
		2,
		"2026-06-22 22:59",
		3529,
		"Rust 全栈笔记",
	],
	[
		"19",
		"Postgres 的 JSONB 索引怎么选",
		"pub",
		false,
		["数据库"],
		805,
		6,
		"2026-06-16 20:06",
		3666,
		"Rust 全栈笔记",
	],
	[
		"20",
		"Vite 8 升级记录",
		"pub",
		false,
		["前端"],
		640,
		5,
		"2026-06-10 21:13",
		3803,
		"从零写一个博客",
	],
	["21", "为什么我不用 ORM", "pub", false, ["后端"], 1580, 13, "2026-05-28 22:20", 3940, ""],
	[
		"22",
		"雨天适合重构",
		"pub",
		false,
		["随笔"],
		290,
		2,
		"2026-05-22 20:27",
		4077,
		"独库公路骑行记",
	],
	[
		"23",
		"写给三年前的自己",
		"pub",
		false,
		["随笔"],
		912,
		7,
		"2026-05-16 21:34",
		4214,
		"Rust 全栈笔记",
	],
	["24", "测试发送", "draft", false, [], 0, 0, "", 4351, "Rust 全栈笔记"],
];

const POSTS: Post[] = SEEDS.map(
	([id, title, status, featured, tags, views, comments, published, words, series], index) => ({
		id,
		title,
		status,
		featured,
		tags,
		views,
		comments,
		published,
		words,
		series,
		excerpt: EXCERPTS[index % EXCERPTS.length],
		slug: SLUGS[index % SLUGS.length] + (index > 2 ? `-${index}` : ""),
	}),
);

const STATUS_FILTERS = [
	{ value: "all", label: "全部状态" },
	{ value: "pub", label: "已发布" },
	{ value: "sched", label: "定时" },
	{ value: "draft", label: "草稿" },
	{ value: "archived", label: "已归档" },
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number]["value"];

const DENSITIES = [
	{ value: "comfortable", label: "舒适" },
	{ value: "compact", label: "紧凑" },
] as const;

type Density = (typeof DENSITIES)[number]["value"];

const SORTABLE: Record<string, true> = { views: true, comments: true, published: true };

function sortPosts(posts: Post[], sort: DataTableSort | null): Post[] {
	if (!sort || !SORTABLE[sort.key]) return posts;
	const key = sort.key as "views" | "comments" | "published";
	const factor = sort.order === "asc" ? 1 : -1;
	return [...posts].sort((a, b) => (a[key] < b[key] ? -factor : a[key] > b[key] ? factor : 0));
}

function StatusCell({ status }: { status: PostStatus }) {
	return (
		<span className="inline-flex items-center gap-2 text-13">
			<span
				aria-hidden="true"
				className={`size-1.5 shrink-0 rounded-full ${STATUS_DOT[status]}`}
			/>
			{STATUS_LABEL[status]}
		</span>
	);
}

function TagsCell({ tags }: { tags: string[] }) {
	if (tags.length === 0) return <span className="text-muted-foreground">—</span>;
	return (
		<span className="flex min-w-0 items-center gap-1 overflow-hidden">
			{tags.slice(0, 2).map((tag) => (
				<Tag key={tag} size="sm">
					{tag}
				</Tag>
			))}
			{tags.length > 2 && (
				<span className="shrink-0 text-12 text-muted-foreground">+{tags.length - 2}</span>
			)}
		</span>
	);
}

function Details({ post }: { post: Post }) {
	const fields = [
		["链接", `/blog/${post.slug}`],
		["字数", post.words.toLocaleString("en-US")],
		["系列", post.series || "—"],
		["最后编辑", post.published ? post.published.slice(5) : "10-31 21:46"],
	];
	return (
		<>
			<p className="text-14 leading-[1.8]">{post.excerpt}</p>
			<dl className="mt-2 flex flex-wrap gap-x-8 gap-y-1 text-13">
				{fields.map(([label, value]) => (
					<div key={label} className="flex gap-2">
						<dt className="text-muted-foreground">{label}</dt>
						<dd className="m-0">{value}</dd>
					</div>
				))}
			</dl>
		</>
	);
}

interface RowActionsProps {
	post: Post;
	container: HTMLElement | null;
	onPatch: (id: string, patch: Partial<Post>) => void;
	onRemove: (id: string) => void;
}

function RowActions({ post, container, onPatch, onRemove }: RowActionsProps) {
	return (
		<span className="v-table__row-actions">
			<Button variant="ghost" size="icon-sm" aria-label={`编辑 ${post.title}`} asChild>
				<StayLink href={`/admin/posts/${post.id}`}>
					<Pencil aria-hidden="true" />
				</StayLink>
			</Button>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="ghost" size="icon-sm" aria-label={`更多操作 ${post.title}`}>
						<Ellipsis aria-hidden="true" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent
					align="end"
					container={container}
					collisionBoundary={container}
				>
					{post.status === "pub" ? (
						<DropdownMenuItem onSelect={() => onPatch(post.id, { status: "draft" })}>
							转为草稿
						</DropdownMenuItem>
					) : (
						<DropdownMenuItem onSelect={() => onPatch(post.id, { status: "pub" })}>
							发布
						</DropdownMenuItem>
					)}
					<DropdownMenuItem
						onSelect={() => onPatch(post.id, { featured: !post.featured })}
					>
						{post.featured ? "取消加精" : "加精"}
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem variant="destructive" onSelect={() => onRemove(post.id)}>
						删除
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</span>
	);
}

type Phase = "data" | "loading" | "error";

const REQUEST_ERROR = new Error("502 · 上游超时，已经重试 2 次");

function PostsTable({ state }: ExhibitRenderProps) {
	const { ref, container } = useStageContainer();
	const [posts, setPosts] = useState<Post[]>(state === "empty" ? [] : POSTS);
	const [phase, setPhase] = useState<Phase>(
		state === "loading" ? "loading" : state === "error" ? "error" : "data",
	);
	const [query, setQuery] = useState(state === "filtered" ? "独库 2" : "");
	const [status, setStatus] = useState<StatusFilter>("all");
	const [density, setDensity] = useState<Density>(
		state === "compact" ? "compact" : "comfortable",
	);
	const [sort, setSort] = useState<DataTableSort | null>(null);
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(10);
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const nextId = useRef(0);

	const keyword = query.trim();
	const matched = sortPosts(
		posts.filter(
			(post) =>
				(status === "all" || post.status === status) &&
				(keyword === "" || post.title.includes(keyword)),
		),
		sort,
	);
	const filtered = keyword !== "" || status !== "all";
	const pages = Math.max(1, Math.ceil(matched.length / pageSize));
	const current = Math.min(page, pages);
	const rows = matched.slice((current - 1) * pageSize, current * pageSize);

	const patch = (ids: Iterable<string>, change: Partial<Post>) => {
		const targets = new Set(ids);
		setPosts((list) =>
			list.map((post) => (targets.has(post.id) ? { ...post, ...change } : post)),
		);
	};
	const remove = (ids: Iterable<string>) => {
		const targets = new Set(ids);
		setPosts((list) => list.filter((post) => !targets.has(post.id)));
		setSelected((ids) => new Set([...ids].filter((id) => !targets.has(id))));
	};
	const bulk = (change: Partial<Post>) => () => {
		patch(selected, change);
		setSelected(new Set());
	};
	const clearFilters = () => {
		setQuery("");
		setStatus("all");
		setPage(1);
	};
	const writePost = () => {
		nextId.current += 1;
		const id = `new-${nextId.current}`;
		setPosts((list) => [
			{
				id,
				title: "未命名文章",
				status: "draft",
				featured: false,
				tags: [],
				views: 0,
				comments: 0,
				published: "",
				words: 0,
				series: "",
				excerpt: "还没有内容。",
				slug: id,
			},
			...list,
		]);
	};

	const columns: DataTableColumn<Post>[] = [
		{
			key: "title",
			header: "标题",
			accessorKey: "title",
			width: "280px",
			hideable: false,
			ellipsis: true,
			cell: (post) => (
				<span>
					{post.title}
					{post.featured && (
						<Star
							role="img"
							aria-label="精选"
							className="ml-1.5 inline size-3.5 fill-current align-text-bottom text-decoration"
						/>
					)}
				</span>
			),
		},
		{
			key: "status",
			header: "状态",
			width: "88px",
			cell: (post) => <StatusCell status={post.status} />,
			exportValue: (post) => STATUS_LABEL[post.status],
		},
		{
			key: "tags",
			header: "标签",
			width: "168px",
			cell: (post) => <TagsCell tags={post.tags} />,
			exportValue: (post) => post.tags.join(" "),
		},
		{
			key: "views",
			header: "浏览",
			accessorKey: "views",
			width: "76px",
			align: "right",
			sortable: true,
			cell: (post) => (post.views ? post.views.toLocaleString("en-US") : "—"),
		},
		{
			key: "comments",
			header: "评论",
			accessorKey: "comments",
			width: "72px",
			align: "right",
			sortable: true,
			cell: (post) => (post.comments ? post.comments.toLocaleString("en-US") : "—"),
		},
		{
			key: "published",
			header: "发布时间",
			accessorKey: "published",
			width: "150px",
			sortable: true,
			cell: (post) => <span className="v-table__num">{post.published || "未发布"}</span>,
		},
		{
			key: "actions",
			header: "",
			width: "72px",
			sticky: "right",
			hideable: false,
			resizable: false,
			stopClickPropagation: true,
			cell: (post) => (
				<RowActions
					post={post}
					container={container}
					onPatch={(id, change) => patch([id], change)}
					onRemove={(id) => remove([id])}
				/>
			),
		},
	];

	return (
		<div ref={ref} className="relative h-full">
			<DataTable
				container={container}
				caption="文章列表"
				columns={columns}
				data={rows}
				keyExtractor={(post) => post.id}
				density={density}
				storageKey="ui-showcase-table"
				resizable
				selectable
				selectedIds={selected}
				onSelectionChange={setSelected}
				onSelectAll={() => setSelected(new Set(matched.map((post) => post.id)))}
				bulkActions={
					<>
						<Button variant="ghost" size="sm" onClick={bulk({ status: "pub" })}>
							<Send aria-hidden="true" />
							发布
						</Button>
						<Button variant="ghost" size="sm" onClick={bulk({ status: "archived" })}>
							<Archive aria-hidden="true" />
							归档
						</Button>
						<Button variant="ghost" size="sm" onClick={bulk({ featured: true })}>
							<Star aria-hidden="true" />
							加精
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => {
								remove(selected);
							}}
						>
							<Trash2 aria-hidden="true" />
							删除
						</Button>
					</>
				}
				expandable
				renderExpandedRow={(post) => <Details post={post} />}
				sort={sort}
				onSortChange={(next) => {
					setSort(next);
					setPage(1);
				}}
				pagination={{
					page: current,
					pageSize,
					total: phase === "data" ? matched.length : 0,
					onChange: (nextPage, nextSize) => {
						setPage(nextPage);
						setPageSize(nextSize);
					},
				}}
				loading={phase === "loading"}
				error={phase === "error" ? REQUEST_ERROR : null}
				errorTitle="没能读取文章列表"
				onRetry={() => setPhase("data")}
				emptyTitle="还没有文章"
				emptyDescription="写下第一篇，它会出现在这里"
				emptyAction={
					<Button variant="primary" size="sm" onClick={writePost}>
						<PenLine aria-hidden="true" />
						写文章
					</Button>
				}
				filtered={filtered}
				filteredTitle={
					keyword
						? `没有匹配「${keyword}」的文章`
						: `没有「${STATUS_FILTERS.find((item) => item.value === status)?.label}」的文章`
				}
				filteredAction={
					<Button variant="outline" size="sm" onClick={clearFilters}>
						清除筛选
					</Button>
				}
				toolbar={
					<div className="flex items-center gap-2">
						<SearchInput
							aria-label="搜索文章标题"
							placeholder="搜索标题"
							classNames={{ control: "w-64 shrink-0" }}
							value={query}
							onValueChange={(next) => {
								setQuery(next);
								setPage(1);
							}}
						/>
						<Select
							value={status}
							onValueChange={(next) => {
								setStatus(next as StatusFilter);
								setPage(1);
							}}
						>
							<SelectTrigger aria-label="按状态筛选" className="w-36 shrink-0">
								<SelectValue />
							</SelectTrigger>
							<SelectContent container={container} collisionBoundary={container}>
								{STATUS_FILTERS.map((item) => (
									<SelectItem key={item.value} value={item.value}>
										{item.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<span className="flex-1" />
						<Segmented
							aria-label="行密度"
							value={density}
							onValueChange={setDensity}
							segments={DENSITIES.map(({ value, label }) => ({ value, label }))}
						/>
						<Button
							variant="outline"
							size="sm"
							onClick={() => exportToCsv("文章列表.csv", columns, matched)}
						>
							<Download aria-hidden="true" />
							导出 CSV
						</Button>
					</div>
				}
			/>
		</div>
	);
}

export const tableExhibit: Exhibit = {
	id: "table",
	name: "表格",
	units: ["table"],
	zone: "banner",
	category: "display",
	footprint: { width: 1120, height: 616 },
	states: [
		{ id: "full", label: "完整" },
		{ id: "loading", label: "加载中" },
		{ id: "error", label: "出错" },
		{ id: "empty", label: "空" },
		{ id: "filtered", label: "筛选后为空" },
		{ id: "compact", label: "紧凑" },
	],
	Render: ({ state }) => <PostsTable key={state} state={state} />,
};
