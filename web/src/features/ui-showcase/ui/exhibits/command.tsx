import {
	Button,
	type CommandGroup,
	type CommandItem,
	CommandList,
	type CommandListProps,
	Kbd,
} from "@violet/ui";
import { Compass, Copy, FileText, Palette, PenLine, Search, Settings } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStageContainer } from "../../hooks/use-stage-container";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";

const GROUPS: CommandGroup[] = [
	{ id: "posts", label: "文章" },
	{ id: "pages", label: "页面" },
	{ id: "commands", label: "命令" },
	{ id: "fulltext", label: "全文" },
];

const POSTS = [
	"Rust 全栈笔记 · 第 4 章 · 实时推送",
	"Rust 全栈笔记 · 第 3 章 · 评论与批注",
	"独库公路，六天",
	"拆解 Saber —— 一个用 Go 写就的聊天机器人",
	"把落花写进 CSS",
	"秋天的桂花酿",
];

const PAGES = [
	["博客", "/blog"],
	["手记", "/notes"],
	["推文", "/tweets"],
	["项目", "/projects"],
	["关于", "/about"],
] as const;

const SEASONS = ["花朝", "荷风", "桂月", "初雪"];

/** 正文里命中「推送」这类词的结果，模拟服务端全文搜索。 */
const FULL_TEXT = [
	{ title: "SSE 与 WebSocket 的取舍", snippet: "…服务端推送只需要单向时，SSE 少一层握手…" },
	{ title: "后台列表记住每页条数", snippet: "…翻页后再推送一次偏好，刷新也不会丢…" },
];

/** 全文搜索要等一会儿，骨架与圆弧才看得到。 */
const FULL_TEXT_MS = 1200;

/** 陈列态用非模态常开，点「打开命令面板」或按 ⌘K 打开真正的命令面板。 */
const STATES: { id: string; label: string; query: string }[] = [
	{ id: "browse", label: "不输入", query: "" },
	{ id: "match", label: "匹配", query: "rust" },
	{ id: "fulltext", label: "全文搜索", query: "推送" },
	{ id: "empty", label: "没有结果", query: "桂花酿" },
];

/** 本地候选与模拟的全文搜索；执行结果写进舞台上的「最近一次」。 */
function useCommandData(query: string, onRun: (label: string) => void) {
	const [fullText, setFullText] = useState<{ query: string; hits: typeof FULL_TEXT } | null>(
		null,
	);
	const needle = query.trim();
	const searching = needle.length >= 2 && fullText?.query !== needle;

	useEffect(() => {
		if (needle.length < 2) return;
		const timer = window.setTimeout(
			() => setFullText({ query: needle, hits: needle.includes("推送") ? FULL_TEXT : [] }),
			FULL_TEXT_MS,
		);
		return () => window.clearTimeout(timer);
	}, [needle]);

	const items = useMemo<CommandItem[]>(() => {
		const run = (label: string) => () => onRun(label);
		const local: CommandItem[] = [
			// 不输入时文章只给最近打开的 3 篇
			...(needle ? POSTS : POSTS.slice(0, 3)).map((title) => ({
				id: `post-${title}`,
				label: title,
				group: "posts",
				icon: <FileText />,
				onSelect: run(title),
			})),
			...PAGES.map(([label, path]) => ({
				id: `page-${path}`,
				label,
				group: "pages",
				hint: path,
				icon: <Compass />,
				onSelect: run(label),
			})),
			{
				id: "cmd-theme",
				label: "切换主题",
				group: "commands",
				icon: <Palette />,
				children: SEASONS.map((season) => ({
					id: `theme-${season}`,
					label: season,
					group: "",
					onSelect: run(`切换主题 · ${season}`),
				})),
			},
			{
				id: "cmd-new",
				label: "写文章",
				group: "commands",
				icon: <PenLine />,
				shortcut: ["mod", "N"],
				onSelect: run("写文章"),
			},
			{
				id: "cmd-settings",
				label: "打开设置",
				group: "commands",
				icon: <Settings />,
				shortcut: ["mod", ","],
				onSelect: run("打开设置"),
			},
			{
				id: "cmd-copy",
				label: "复制当前链接",
				group: "commands",
				icon: <Copy />,
				onSelect: run("复制当前链接"),
			},
		];
		const hits = fullText?.query === needle ? fullText.hits : [];
		return [
			...local,
			...hits.map((hit) => ({
				id: `ft-${hit.title}`,
				label: hit.title,
				group: "fulltext",
				filter: false,
				description: hit.snippet,
				icon: <Search />,
				onSelect: run(hit.title),
			})),
		];
	}, [needle, fullText, onRun]);

	return { items, searching };
}

function DemoCommandList({
	query,
	onQueryChange,
	onRun,
	...props
}: Omit<CommandListProps, "items" | "groups" | "searching"> & { onRun: (label: string) => void }) {
	const { items, searching } = useCommandData(query, onRun);
	return (
		<CommandList
			{...props}
			items={items}
			groups={GROUPS}
			fullTextGroup="fulltext"
			query={query}
			onQueryChange={onQueryChange}
			searching={searching}
			onSearchAll={(value) => onRun(`在全文里搜索「${value}」`)}
		/>
	);
}

/** 文章页舞台：右上角的按钮或 ⌘K 打开铺满视口的命令面板，执行结果显示在「最近一次」。 */
function CommandStage({ state }: ExhibitRenderProps) {
	const current = STATES.find((item) => item.id === state) ?? STATES[0];
	const { ref, container, host } = useStageContainer();
	const [resting, setResting] = useState(true);
	const [restingQuery, setRestingQuery] = useState(current.query);
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [last, setLast] = useState("—");
	const stageRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		const stage = stageRef.current;
		if (!stage) return;
		// 只在舞台里按 ⌘K 才打开，展厅其余地方不受影响
		const onKey = (event: KeyboardEvent) => {
			if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return;
			event.preventDefault();
			setResting(false);
			setOpen((value) => !value);
		};
		stage.addEventListener("keydown", onKey);
		return () => stage.removeEventListener("keydown", onKey);
	}, []);

	useEffect(() => {
		if (!open) setQuery("");
	}, [open]);

	return (
		<div
			ref={(node) => {
				stageRef.current = node;
				ref(node);
			}}
			tabIndex={-1}
			className="relative size-full overflow-hidden rounded-xl bg-background text-foreground outline-1 -outline-offset-1 outline-rule2 contain-layout focus:outline-rule2"
		>
			<div className="flex items-center justify-between px-6 pt-5">
				<span className="font-mono text-12 text-muted-foreground">2026-10-12 · 骑行</span>
				<Button
					variant="secondary"
					size="sm"
					onClick={() => {
						setResting(false);
						setOpen(true);
					}}
				>
					<Search aria-hidden="true" />
					打开命令面板
					<Kbd size="sm" keys={["mod", "K"]} />
				</Button>
			</div>
			<h3 className="m-0 mt-3 px-6 text-22 font-semibold">独库公路，六天</h3>
			<p className="m-0 mt-3 px-6 text-14 leading-relaxed text-foreground/90">
				从独山子出发，第一天就爬升两千米。哈希勒根达坂的风把手套吹透，下坡时手指已经握不住刹车。
			</p>
			<p className="m-0 mt-3 px-6 text-13 text-muted-foreground" aria-live="polite">
				最近一次：{last}
			</p>
			<DemoCommandList
				open={open}
				onOpenChange={setOpen}
				query={query}
				onQueryChange={setQuery}
				onRun={setLast}
				container={host}
			/>
			{resting && (
				<div
					aria-hidden="true"
					data-state="open"
					className="v-scrim v-scrim--soft v-command-overlay"
				/>
			)}
			<DemoCommandList
				open={resting}
				onOpenChange={setResting}
				query={restingQuery}
				onQueryChange={setRestingQuery}
				onRun={setLast}
				modal={false}
				container={container}
			/>
		</div>
	);
}

export const commandExhibit: Exhibit = {
	id: "command",
	name: "命令面板",
	units: ["command", "list-highlight"],
	zone: "stage",
	category: "overlay",
	footprint: { width: 560, height: 420 },
	states: STATES.map(({ id, label }) => ({ id, label })),
	Render: (props) => <CommandStage key={props.state} {...props} />,
};
