import {
	Bell,
	Check,
	ChevronDown,
	Copy,
	Feather,
	FileText,
	Flower2,
	Home,
	LayoutGrid,
	Link2,
	MessageCircle,
	Music,
	Pencil,
	Play,
	Rss,
	Search,
	Trash2,
	User,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";

/**
 * PROTOTYPE — 可丢弃。展品模拟：按设计稿的真实尺寸画，目的是判断「展柜给多大」，
 * 不是复刻组件。w、h 是占地（含展开态），不含展柜内边距。
 */
export type Zone = "banner" | "stage" | "shelf" | "field" | "content";
export type Category = "操作" | "表单" | "导航" | "浮层" | "反馈" | "展示" | "内容" | "布局";
export type Status = "foundation" | "legacy" | "new" | "site";

export interface ExhibitProps {
	state: string;
	play: boolean;
}

export interface Exhibit {
	id: string;
	name: string;
	slug: string;
	zone: Zone;
	category: Category;
	status: Status;
	w: number;
	h: number;
	states: string[];
	Render: ComponentType<ExhibitProps>;
}

export const ZONES: { id: Zone; name: string; rule: string }[] = [
	{ id: "banner", name: "整幅橱窗", rule: "真实宽度 1120，独占一行" },
	{ id: "stage", name: "浮层舞台", rule: "带背景和触发器，展开态算在占地里" },
	{ id: "shelf", name: "微件架", rule: "一个展柜放一整族" },
	{ id: "field", name: "字段", rule: "带标签、提示与展开态" },
	{ id: "content", name: "内容", rule: "放在真实的正文语境里" },
];

export const STATUS_LABEL: Record<Status, string> = {
	foundation: "新架构",
	legacy: "旧单元",
	new: "待建",
	site: "站点组件",
};

export const CATEGORIES: Category[] = ["操作", "表单", "导航", "浮层", "反馈", "展示", "内容", "布局"];

const SHADOW = "shadow-[0_4px_24px_rgb(0_0_0/0.05)]";
const SHEET = `bg-(--sheet) border border-(--ol) ${SHADOW}`;

function Pill({ children, className = "" }: { children: ReactNode; className?: string }) {
	return (
		<div className={`flex h-11 items-center gap-1 rounded-full px-2 ${SHEET} ${className}`}>{children}</div>
	);
}

function Btn({
	kind = "primary",
	children,
	size = "md",
	loading = false,
	disabled = false,
}: {
	kind?: "primary" | "secondary" | "ghost" | "danger";
	children: ReactNode;
	size?: "sm" | "md" | "lg";
	loading?: boolean;
	disabled?: boolean;
}) {
	const base = "inline-flex items-center justify-center gap-1.5 rounded-full font-medium whitespace-nowrap";
	const sz = { sm: "h-8 px-3.5 text-[13px]", md: "h-9 px-4 text-sm", lg: "h-10 px-5 text-sm" }[size];
	const tone = {
		primary: "bg-(--fg) text-(--sheet)",
		secondary: "bg-(--sunk) text-(--fg)",
		ghost: "text-(--fg)",
		danger: "bg-(--sunk) text-(--danger)",
	}[kind];
	return (
		<span className={`${base} ${sz} ${tone} ${disabled ? "opacity-45" : ""}`}>
			{loading && <span className="proto-arc size-3.5 rounded-full border-2 border-current border-t-transparent" />}
			{children}
		</span>
	);
}

function Tag({ tone, children }: { tone?: "ok" | "danger" | "deco"; children: ReactNode }) {
	const c =
		tone === "ok"
			? "text-(--ok) bg-[color-mix(in_oklab,var(--ok)_12%,transparent)]"
			: tone === "danger"
				? "text-(--danger) bg-[color-mix(in_oklab,var(--danger)_12%,transparent)]"
				: tone === "deco"
					? "text-(--accent) bg-[color-mix(in_oklab,var(--deco)_16%,transparent)]"
					: "text-(--muted) bg-(--sunk)";
	return <span className={`inline-flex h-5 items-center rounded-full px-2 text-xs ${c}`}>{children}</span>;
}

function Avatar({ size = 28, letter = "x" }: { size?: number; letter?: string }) {
	return (
		<span
			className="inline-flex shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--deco)_30%,var(--sunk))] font-mono text-[11px] text-(--fg)"
			style={{ width: size, height: size }}
		>
			{letter}
		</span>
	);
}

/* ─ 整幅橱窗 ─ */

function HeaderMock() {
	const items: [string, ComponentType<{ className?: string }>, boolean?][] = [
		["首页", Home],
		["博客", Rss, true],
		["手记", FileText],
		["推文", Feather],
		["聊天", MessageCircle],
		["更多", LayoutGrid],
	];
	return (
		<div className="flex items-center justify-between" style={{ width: 1120, height: 64 }}>
			<Pill className="pr-3 pl-1.5">
				<Avatar size={32} />
				<span className="font-mono text-xs tracking-widest">VIOLET</span>
				<ChevronDown className="size-3.5 text-(--muted)" />
			</Pill>
			<Pill className="gap-0.5">
				{items.map(([label, Icon, on]) => (
					<span
						key={label}
						className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-sm ${on ? "bg-(--sunk) font-semibold" : "text-(--muted)"}`}
					>
						<Icon className="size-4" />
						{label}
					</span>
				))}
				<span className="mx-1 h-4 w-px bg-(--rule2)" />
				<span className="flex h-8 items-center gap-1.5 px-2 text-sm text-(--muted)">
					<Search className="size-4" />
					搜索
					<kbd className="rounded bg-(--sunk) px-1.5 font-mono text-[11px]">⌘K</kbd>
				</span>
			</Pill>
			<Pill className="px-3">
				<Flower2 className="size-[18px] text-(--deco)" />
				<span className="mx-1 h-4 w-px bg-(--rule2)" />
				<Bell className="size-[18px]" />
				<User className="size-[18px]" />
			</Pill>
		</div>
	);
}

function TableMock() {
	const cols = "grid-cols-[1fr_96px_160px_72px_96px]";
	const rows: [string, ReactNode, string, string, string][] = [
		["拆解 Saber —— 会思考的聊天机器人", <Tag key="a" tone="ok">已发布</Tag>, "Go · LLM", "3,412", "10-28"],
		["实时推送：让新评论自己出现", <Tag key="b">草稿</Tag>, "Rust", "—", "10-30"],
		["Rust 全栈笔记 · 第 4 章", <Tag key="c" tone="deco">定时</Tag>, "Rust · 后端", "702", "10-29"],
		["Yggdrasil 与 Rust 同时编译", <Tag key="d" tone="ok">已发布</Tag>, "Rust", "1,198", "10-05"],
	];
	return (
		<div className={`overflow-hidden rounded-2xl ${SHEET}`} style={{ width: 1120, height: 236 }}>
			<div className={`grid ${cols} h-10 items-center gap-3 border-b border-(--rule) px-4 text-xs text-(--muted)`}>
				<span>标题</span>
				<span>状态</span>
				<span>标签</span>
				<span>阅读</span>
				<span>更新</span>
			</div>
			{rows.map((r) => (
				<div key={r[0]} className={`grid ${cols} h-[42px] items-center gap-3 border-b border-(--rule) px-4 text-sm`}>
					<span className="truncate">{r[0]}</span>
					{r[1]}
					<span className="text-(--muted)">{r[2]}</span>
					<span className="font-mono text-xs">{r[3]}</span>
					<span className="font-mono text-xs text-(--muted)">{r[4]}</span>
				</div>
			))}
			<div className="flex h-[26px] items-center justify-between px-4 text-xs text-(--muted)">
				<span>共 270 篇</span>
				<span className="font-mono">‹ 1 2 3 … 13 ›</span>
			</div>
		</div>
	);
}

/* ─ 浮层舞台 ─ */

function DialogMock() {
	return (
		<div className="relative overflow-hidden rounded-2xl bg-(--sunk)" style={{ width: 520, height: 300 }}>
			<div className="space-y-3 p-6">
				{[80, 60, 70].map((w) => (
					<div key={w} className="h-3 rounded bg-(--rule2) opacity-40" style={{ width: `${w}%` }} />
				))}
			</div>
			<div className="absolute inset-0 bg-[rgb(20_16_14/.32)]" />
			<div className={`absolute top-[44px] left-[50px] w-[420px] rounded-2xl p-6 ${SHEET}`}>
				<h4 className="text-lg font-semibold">更新日志</h4>
				<p className="mt-2 text-sm leading-relaxed text-(--muted)">
					后台导入的自动发布修好了；版本意图检查不再吞掉尾注。
				</p>
				<div className="mt-5 flex justify-end">
					<Btn kind="secondary">关闭</Btn>
				</div>
			</div>
		</div>
	);
}

function MenuMock() {
	const items: [ReactNode, string, string?, boolean?][] = [
		[<Pencil key="e" className="size-4" />, "编辑", "E"],
		[<Link2 key="l" className="size-4" />, "复制链接", "⌘C"],
		[<Trash2 key="d" className="size-4" />, "删除", undefined, true],
	];
	return (
		<div className="relative" style={{ width: 300, height: 260 }}>
			<span className="absolute top-0 right-0 flex size-9 items-center justify-center rounded-full bg-(--sunk) text-lg leading-none">
				···
			</span>
			<div className={`absolute top-11 right-0 w-[230px] rounded-xl p-1.5 ${SHEET}`}>
				{items.map(([icon, label, key, danger], i) => (
					<div
						key={label}
						className={`flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm ${i === 0 ? "bg-(--sunk)" : ""} ${danger ? "text-(--danger)" : ""}`}
					>
						{icon}
						<span className="flex-1">{label}</span>
						{key && <span className="font-mono text-xs text-(--muted)">{key}</span>}
					</div>
				))}
			</div>
		</div>
	);
}

function MorphMock({ play }: ExhibitProps) {
	return (
		<div className="relative" style={{ width: 480, height: 380 }}>
			<div
				className={`proto-morph absolute top-0 left-0 overflow-hidden ${SHEET}`}
				data-play={play ? "1" : "0"}
				style={{ width: 360, height: 300, borderRadius: 16 }}
			>
				<div className="flex h-11 w-[360px] shrink-0 items-center gap-2 px-2">
					<Avatar size={32} />
					<span className="flex flex-col leading-tight">
						<span className="text-[13px] font-medium">歌曲名称</span>
						<span className="text-[11px] text-(--muted)">也在用 Zed</span>
					</span>
					<Music className="ml-auto size-4 text-(--deco)" />
				</div>
				<div className="proto-morph-body w-[360px] space-y-3 px-4 pt-2 text-sm">
					<div className="flex items-center gap-3">
						<Avatar size={44} letter="♪" />
						<div className="leading-snug">
							<div className="font-semibold">歌曲名称</div>
							<div className="text-xs text-(--muted)">艺人 · 专辑名</div>
						</div>
					</div>
					<div className="h-1 rounded-full bg-(--sunk)">
						<div className="h-1 w-2/5 rounded-full bg-(--deco)" />
					</div>
					<div className="grid grid-cols-2 gap-2">
						<div className="rounded-xl bg-(--sunk) p-3 text-xs">
							<div className="text-(--muted)">新文章</div>
							<div className="mt-1 text-sm">测试发送</div>
						</div>
						<div className="rounded-xl bg-(--sunk) p-3 text-xs">
							<div className="text-(--muted)">新手记</div>
							<div className="mt-1 text-sm">实时状态接入</div>
						</div>
					</div>
					<div className="flex justify-around border-t border-(--rule) pt-3 text-xs text-(--muted)">
						<span>关于我</span>
						<span>人设</span>
						<span>友链</span>
					</div>
				</div>
			</div>
		</div>
	);
}

function CommandMock() {
	return (
		<div className={`overflow-hidden rounded-2xl ${SHEET}`} style={{ width: 520, height: 320 }}>
			<div className="flex h-12 items-center gap-2 border-b border-(--rule) px-4">
				<Search className="size-4 text-(--muted)" />
				<span className="flex-1 text-sm text-(--muted)">跳转到…</span>
				<kbd className="rounded bg-(--sunk) px-1.5 font-mono text-[11px]">Esc</kbd>
			</div>
			<div className="space-y-0.5 p-2 text-sm">
				<div className="px-2.5 pt-1.5 text-xs text-(--muted)">文章</div>
				{["Rust 全栈笔记 · 第 4 章", "拆解 Saber", "Yggdrasil 与 Rust"].map((t, i) => (
					<div key={t} className={`flex h-9 items-center gap-2.5 rounded-lg px-2.5 ${i === 0 ? "bg-(--sunk)" : ""}`}>
						<FileText className="size-4 text-(--muted)" />
						{t}
						{i === 0 && <span className="ml-auto font-mono text-xs text-(--muted)">↵</span>}
					</div>
				))}
				<div className="px-2.5 pt-2 text-xs text-(--muted)">页面</div>
				{["写文章", "打开设置"].map((t) => (
					<div key={t} className="flex h-9 items-center gap-2.5 rounded-lg px-2.5">
						<Pencil className="size-4 text-(--muted)" />
						{t}
					</div>
				))}
			</div>
		</div>
	);
}

/* ─ 微件架 ─ */

function ButtonsMock({ state }: ExhibitProps) {
	const loading = state === "加载";
	const disabled = state === "禁用";
	return (
		<div className="flex flex-col gap-3" style={{ width: 360, height: 132 }}>
			<div className="flex flex-wrap gap-2">
				<Btn loading={loading} disabled={disabled}>
					{loading ? "发布中" : "发布"}
				</Btn>
				<Btn kind="secondary" disabled={disabled}>
					取消
				</Btn>
				<Btn kind="ghost" disabled={disabled}>
					更多
				</Btn>
				<Btn kind="danger" disabled={disabled}>
					删除
				</Btn>
			</div>
			<div className="flex items-center gap-2">
				<Btn size="sm">小</Btn>
				<Btn size="md">中</Btn>
				<Btn size="lg">大</Btn>
				<Btn kind="secondary" loading>
					保存中
				</Btn>
			</div>
			<p className="text-xs text-(--muted)">主要按钮是墨色，季节色不做按钮底。</p>
		</div>
	);
}

function BadgesMock() {
	return (
		<div className="flex flex-col gap-3" style={{ width: 300, height: 96 }}>
			<div className="flex flex-wrap gap-2">
				<Tag tone="ok">已发布</Tag>
				<Tag>草稿</Tag>
				<Tag tone="deco">置顶</Tag>
				<Tag tone="danger">踩坑</Tag>
			</div>
			<div className="flex items-center gap-3">
				<Avatar />
				<Avatar letter="m" />
				<Avatar letter="n" />
				<kbd className="rounded-md bg-(--sunk) px-2 py-0.5 font-mono text-xs">⌘K</kbd>
				<span className="relative inline-flex">
					<Bell className="size-5" />
					<span className="absolute -top-1.5 -right-2 flex size-4 items-center justify-center rounded-full bg-(--fg) text-[10px] text-(--sheet)">
						5
					</span>
				</span>
			</div>
		</div>
	);
}

function TogglesMock() {
	return (
		<div className="flex flex-col gap-3 text-sm" style={{ width: 300, height: 110 }}>
			<div className="flex items-center gap-6">
				<span className="flex items-center gap-2">
					<span className="relative inline-block h-5 w-9 rounded-full bg-(--fg)">
						<span className="absolute top-0.5 right-0.5 size-4 rounded-full bg-(--sheet)" />
					</span>
					评论通知
				</span>
				<span className="flex items-center gap-2">
					<span className="relative inline-block h-5 w-9 rounded-full bg-(--sunk)">
						<span className="absolute top-0.5 left-0.5 size-4 rounded-full bg-(--sheet) shadow-sm" />
					</span>
					邮件
				</span>
			</div>
			<div className="flex items-center gap-5">
				{["未选", "已选", "部分"].map((t, i) => (
					<span key={t} className="flex items-center gap-2">
						<span
							className={`flex size-4 items-center justify-center rounded-[5px] ${i ? "bg-(--fg) text-(--sheet)" : "border border-(--rule2)"}`}
						>
							{i === 1 && <Check className="size-3" />}
							{i === 2 && <span className="h-0.5 w-2 bg-current" />}
						</span>
						{t}
					</span>
				))}
			</div>
			<div className="flex items-center gap-5">
				{["全部", "仅关注"].map((t, i) => (
					<span key={t} className="flex items-center gap-2">
						<span className="flex size-4 items-center justify-center rounded-full border border-(--rule2)">
							{i === 0 && <span className="size-2 rounded-full bg-(--fg)" />}
						</span>
						{t}
					</span>
				))}
			</div>
		</div>
	);
}

function SegmentedMock() {
	return (
		<div className="flex flex-col gap-4" style={{ width: 360, height: 96 }}>
			<div className="inline-flex w-fit rounded-full bg-(--sunk) p-1 text-sm">
				{["全部", "系列", "归档"].map((t, i) => (
					<span
						key={t}
						className={`rounded-full px-4 py-1 ${i === 0 ? "bg-(--sheet) font-medium shadow-sm" : "text-(--muted)"}`}
					>
						{t}
					</span>
				))}
			</div>
			<div className="flex gap-6 border-b border-(--rule) text-sm">
				{["文章", "评论", "回应"].map((t, i) => (
					<span key={t} className={`pb-2 ${i === 0 ? "border-b-2 border-(--fg) font-medium" : "text-(--muted)"}`}>
						{t}
					</span>
				))}
			</div>
		</div>
	);
}

/* ─ 字段 ─ */

function InputMock({ state }: ExhibitProps) {
	const err = state === "错误";
	const focus = state === "聚焦";
	const dis = state === "禁用";
	return (
		<div style={{ width: 320, height: 150 }}>
			<label className="mb-1.5 block text-[13px] text-(--muted)">邮箱</label>
			<div
				className={`flex h-10 items-center rounded-xl bg-(--sunk) px-3 text-sm ${dis ? "opacity-50" : ""} ${focus ? "ring-2 ring-(--accent)" : ""} ${err ? "ring-2 ring-(--danger)" : ""}`}
			>
				xunrua@
			</div>
			{err ? (
				<p className="mt-1.5 text-xs text-(--danger)">邮箱格式不正确</p>
			) : (
				<p className="mt-1.5 text-xs text-(--muted)">用于接收评论通知</p>
			)}
		</div>
	);
}

function SelectMock() {
	return (
		<div style={{ width: 320, height: 230 }}>
			<div className="mb-1.5 text-[13px] text-(--muted)">状态</div>
			<div className="flex h-10 items-center justify-between rounded-xl bg-(--sunk) px-3 text-sm">
				已发布
				<ChevronDown className="size-4 text-(--muted)" />
			</div>
			<div className={`mt-1.5 rounded-xl p-1.5 text-sm ${SHEET}`}>
				{["草稿", "已发布", "定时", "归档"].map((t, i) => (
					<div key={t} className={`flex h-9 items-center justify-between rounded-lg px-2.5 ${i === 1 ? "bg-(--sunk)" : ""}`}>
						{t}
						{i === 1 && <Check className="size-4" />}
					</div>
				))}
			</div>
		</div>
	);
}

function TextareaMock() {
	return (
		<div style={{ width: 320, height: 150 }}>
			<div className="mb-1.5 text-[13px] text-(--muted)">说点什么</div>
			<div className="relative h-[110px] rounded-xl bg-(--sunk) p-3 text-sm text-(--muted)">
				写点什么…
				<span className="absolute right-3 bottom-2 font-mono text-xs">0 / 2000</span>
			</div>
		</div>
	);
}

/* ─ 内容 ─ */

function AnnotationMock() {
	return (
		<div className="relative" style={{ width: 560, height: 190 }}>
			<div className="absolute top-0 left-[92px] flex h-9 items-center gap-1 rounded-xl bg-(--sheet) px-1.5 text-[13px] shadow-[0_4px_24px_rgb(0_0_0/0.05)] after:absolute after:-bottom-1 after:left-6 after:size-2 after:rotate-45 after:bg-(--sheet) after:content-['']">
				<span className="rounded-lg px-2.5 py-1">批注</span>
				<span className="h-4 w-px bg-(--rule)" />
				<span className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-(--muted)">
					<Copy className="size-3.5" />
					复制
				</span>
			</div>
			<p className="absolute top-[56px] left-0 w-[500px] text-[17px] leading-[1.95]">
				把 LLM 塞进聊天室只需二十行胶水代码；但要让它在真实世界里
				<mark className="rounded-[2px] bg-[color-mix(in_oklab,var(--deco)_22%,transparent)] px-px text-inherit">
					稳定、安全、有个性地活下去
				</mark>
				，需要的是一整个工程。
			</p>
			<span className="absolute top-[64px] right-0 font-mono text-xs text-(--muted)">1</span>
		</div>
	);
}

const CODE = [
	"package memory",
	"",
	"// Roll 把最早的一段对话压缩成一条摘要。",
	"func (s *Summary) Roll(ctx context.Context) error {",
	"\tdigest, err := s.llm.Summarize(ctx, msgs)",
	"\tif err != nil {",
	'\t\treturn fmt.Errorf("summarize: %w", err)',
	"\t}",
	"\treturn s.store.Append(ctx, digest)",
];

function CodeMock({ play }: ExhibitProps) {
	return (
		<figure className="overflow-hidden rounded-xl bg-(--sunk)" style={{ width: 560, height: 300 }}>
			<figcaption className="flex h-10 items-center justify-between px-4 font-mono text-xs">
				<span>
					<span className="text-(--muted)">Go</span> memory/summary.go
				</span>
				<span className="flex items-center gap-4 text-(--muted)">
					<span className="flex items-center gap-1">
						<Copy className="size-3.5" />
						复制
					</span>
					<span className="flex items-center gap-1">
						<Play className="size-3.5" />
						{play ? "运行中" : "运行"}
					</span>
				</span>
			</figcaption>
			<pre className="m-0 px-0 font-mono text-[13px] leading-[1.75]">
				{CODE.map((l, i) => (
					<div
						key={`${i}-${l}`}
						className={`flex ${i >= 4 && i <= 6 ? "bg-[color-mix(in_oklab,var(--deco)_12%,transparent)]" : ""}`}
					>
						<span className={`w-10 shrink-0 pr-3 text-right select-none ${i >= 4 && i <= 6 ? "" : "opacity-50"}`}>
							{i + 1}
						</span>
						<code className="whitespace-pre">{l}</code>
					</div>
				))}
			</pre>
			<div className="mt-1 flex h-9 items-center justify-center bg-linear-to-t from-(--sunk) to-transparent text-xs text-(--accent)">
				展开全部 23 行
			</div>
		</figure>
	);
}

function ImageGridMock() {
	const tones = ["--deco", "--ok", "--accent", "--fg"];
	return (
		<div className="grid grid-cols-2 gap-0.5 overflow-hidden rounded-xl" style={{ width: 420, height: 300 }}>
			{tones.map((t, i) => (
				<div
					key={t}
					className="relative"
					style={{ background: `color-mix(in oklab, var(${t}) ${24 + i * 6}%, var(--sunk))` }}
				>
					{i === 3 && (
						<span className="absolute inset-0 flex items-center justify-center bg-black/40 text-xl font-semibold text-white">
							+6
						</span>
					)}
				</div>
			))}
		</div>
	);
}

function QuoteMock() {
	return (
		<div className="flex flex-col gap-3" style={{ width: 520, height: 170 }}>
			<div className={`flex gap-3 rounded-xl p-3 ${SHEET}`}>
				<div className="min-w-0 flex-1 text-sm">
					<div className="mb-1 flex items-center gap-2 text-[13px]">
						<Avatar size={20} />
						<b>xunrua</b>
						<span className="text-xs text-(--muted)">2 小时前</span>
					</div>
					<p className="line-clamp-2">给博客加了季节。春天落桃花，秋天落桂花，冬天的雪会积在导航上。</p>
				</div>
				<div className="size-16 shrink-0 rounded-lg bg-[color-mix(in_oklab,var(--deco)_25%,var(--sunk))]" />
			</div>
			<div className="flex h-10 items-center gap-2 rounded-xl bg-(--sunk) px-3 text-sm text-(--muted)">
				原推文已删除
			</div>
		</div>
	);
}

export const EXHIBITS: Exhibit[] = [
	{ id: "header", name: "导航栏", slug: "header", zone: "banner", category: "导航", status: "site", w: 1120, h: 64, states: [], Render: HeaderMock },
	{ id: "table", name: "表格", slug: "table", zone: "banner", category: "展示", status: "legacy", w: 1120, h: 236, states: [], Render: TableMock },
	{ id: "dialog", name: "对话框", slug: "dialog", zone: "stage", category: "浮层", status: "legacy", w: 520, h: 300, states: [], Render: DialogMock },
	{ id: "menu", name: "操作菜单", slug: "dropdown-menu", zone: "stage", category: "浮层", status: "legacy", w: 300, h: 260, states: [], Render: MenuMock },
	{ id: "morph", name: "变形弹出层", slug: "morphing-popover", zone: "stage", category: "浮层", status: "new", w: 480, h: 380, states: [], Render: MorphMock },
	{ id: "command", name: "命令面板", slug: "command", zone: "stage", category: "浮层", status: "legacy", w: 520, h: 320, states: [], Render: CommandMock },
	{ id: "buttons", name: "按钮族", slug: "button", zone: "shelf", category: "操作", status: "foundation", w: 360, h: 132, states: ["默认", "加载", "禁用"], Render: ButtonsMock },
	{ id: "badges", name: "徽章 · 头像 · 键帽", slug: "badge / avatar / kbd", zone: "shelf", category: "展示", status: "new", w: 300, h: 96, states: [], Render: BadgesMock },
	{ id: "toggles", name: "开关 · 复选 · 单选", slug: "switch / checkbox / radio", zone: "shelf", category: "表单", status: "foundation", w: 300, h: 110, states: [], Render: TogglesMock },
	{ id: "segmented", name: "分段控制 · 标签页", slug: "segmented / tabs", zone: "shelf", category: "操作", status: "foundation", w: 360, h: 96, states: [], Render: SegmentedMock },
	{ id: "input", name: "输入框", slug: "input", zone: "field", category: "表单", status: "foundation", w: 320, h: 150, states: ["默认", "聚焦", "错误", "禁用"], Render: InputMock },
	{ id: "select", name: "选择器", slug: "select", zone: "field", category: "表单", status: "legacy", w: 320, h: 230, states: [], Render: SelectMock },
	{ id: "textarea", name: "多行输入", slug: "textarea", zone: "field", category: "表单", status: "foundation", w: 320, h: 150, states: [], Render: TextareaMock },
	{ id: "annotation", name: "批注", slug: "annotation", zone: "content", category: "内容", status: "site", w: 560, h: 190, states: [], Render: AnnotationMock },
	{ id: "code", name: "代码块", slug: "code", zone: "content", category: "内容", status: "site", w: 560, h: 300, states: [], Render: CodeMock },
	{ id: "imagegrid", name: "图片网格", slug: "image-grid", zone: "content", category: "内容", status: "site", w: 420, h: 300, states: [], Render: ImageGridMock },
	{ id: "quote", name: "引用卡", slug: "quote", zone: "content", category: "内容", status: "new", w: 520, h: 170, states: [], Render: QuoteMock },
];
