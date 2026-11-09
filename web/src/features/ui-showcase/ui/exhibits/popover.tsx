import {
	Avatar,
	Button,
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
	Popover,
	PopoverContent,
	type PopoverContentProps,
	PopoverTrigger,
	SearchInput,
	Segmented,
	Switch,
	TagToggle,
} from "@violet/ui";
import { Check, Copy, Mail, MessageCircle, QrCode, Share2, Tag, Type } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { useStageContainer } from "../../hooks/use-stage-container";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";
import { StayLink } from "./stay-link";

type Side = NonNullable<PopoverContentProps["side"]>;
type Align = NonNullable<PopoverContentProps["align"]>;

const PLACEMENTS: { id: string; label: string; side: Side; align: Align }[] = [
	{ id: "bottom-start", label: "下 · 起点", side: "bottom", align: "start" },
	{ id: "bottom-center", label: "下 · 居中", side: "bottom", align: "center" },
	{ id: "bottom-end", label: "下 · 终点", side: "bottom", align: "end" },
	{ id: "top-start", label: "上（放不下翻到下）", side: "top", align: "start" },
	{ id: "right-start", label: "右", side: "right", align: "start" },
	{ id: "left-start", label: "左（放不下翻到右）", side: "left", align: "start" },
];

const TAGS = [
	{ name: "Go", count: 21 },
	{ name: "Rust", count: 14 },
	{ name: "前端", count: 18 },
	{ name: "骑行", count: 5 },
	{ name: "摄影", count: 9 },
	{ name: "生活", count: 12 },
];

const SHARE_URL = "violet.blog/p/duku-6d";

const SHARE_TARGETS = [
	{ label: "微信", icon: MessageCircle },
	{ label: "邮件", icon: Mail },
	{ label: "聊天", icon: Share2 },
	{ label: "二维码", icon: QrCode },
];

const ARTICLE_FACTS = [
	["字数", "6,820"],
	["阅读", "约 18 分钟"],
	["更新", "2026-10-14"],
];

const SIZES = [
	{ value: "sm", label: "小" },
	{ value: "md", label: "中" },
	{ value: "lg", label: "大" },
];

const LEADINGS = [
	{ value: "tight", label: "紧" },
	{ value: "normal", label: "标准" },
	{ value: "loose", label: "松" },
];

const TEXT_SIZE = { sm: "text-13", md: "text-14", lg: "text-base" } as const;
const TEXT_LEADING = {
	tight: "leading-normal",
	normal: "leading-relaxed",
	loose: "leading-loose",
} as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<div className="flex flex-col gap-2">
			<span className="text-12 text-muted-foreground">{title}</span>
			{children}
		</div>
	);
}

function TagFilter() {
	const [query, setQuery] = useState("");
	const [picked, setPicked] = useState<string[]>(["Go", "骑行"]);
	const visible = TAGS.filter((tag) =>
		tag.name.toLowerCase().includes(query.trim().toLowerCase()),
	);
	return (
		<div className="flex flex-col gap-3">
			<SearchInput
				aria-label="找标签"
				placeholder="找标签"
				value={query}
				onValueChange={setQuery}
			/>
			{visible.length > 0 ? (
				<div role="group" aria-label="标签" className="flex flex-wrap gap-1.5">
					{visible.map(({ name, count }) => (
						<TagToggle
							key={name}
							size="sm"
							pressed={picked.includes(name)}
							onPressedChange={(next) =>
								setPicked((current) =>
									next
										? [...current, name]
										: current.filter((item) => item !== name),
								)
							}
						>
							{name}
							<span className="opacity-70">{count}</span>
						</TagToggle>
					))}
				</div>
			) : (
				<p className="m-0 text-13 text-muted-foreground">没有「{query}」这个标签</p>
			)}
			<div className="flex items-center justify-between border-t border-border pt-2.5 text-13 text-muted-foreground">
				<span>
					已选 <b className="font-medium text-foreground">{picked.length}</b> 个
				</span>
				<Button
					variant="ghost"
					size="sm"
					disabled={picked.length === 0}
					onClick={() => setPicked([])}
				>
					清除
				</Button>
			</div>
		</div>
	);
}

function SharePanel() {
	const [copied, setCopied] = useState(false);
	const timer = useRef<number | undefined>(undefined);
	useEffect(() => () => window.clearTimeout(timer.current), []);
	const copy = () => {
		void navigator.clipboard?.writeText(`https://${SHARE_URL}`).catch(() => {});
		setCopied(true);
		window.clearTimeout(timer.current);
		timer.current = window.setTimeout(() => setCopied(false), 1600);
	};
	return (
		<div className="flex flex-col gap-3">
			<Section title="链接">
				<div className="flex h-10 items-center gap-2 rounded-xl bg-muted pr-1 pl-3">
					<span className="min-w-0 flex-1 truncate font-mono text-13">{SHARE_URL}</span>
					<Button variant="outline" size="sm" onClick={copy} aria-live="polite">
						{copied ? <Check className="text-success" /> : <Copy />}
						{copied ? "已复制" : "复制"}
					</Button>
				</div>
			</Section>
			<Section title="发到">
				<div className="grid grid-cols-4 gap-1">
					{SHARE_TARGETS.map(({ label, icon: Icon }) => (
						<button
							key={label}
							type="button"
							className="flex flex-col items-center gap-1.5 rounded-lg bg-transparent py-2 text-12 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
						>
							<span className="inline-flex size-10 items-center justify-center rounded-full bg-muted text-foreground">
								<Icon className="size-4" />
							</span>
							{label}
						</button>
					))}
				</div>
			</Section>
		</div>
	);
}

interface DisplaySettings {
	size: keyof typeof TEXT_SIZE;
	leading: keyof typeof TEXT_LEADING;
	indent: boolean;
}

function DisplayPanel({
	value,
	onChange,
}: {
	value: DisplaySettings;
	onChange: (next: DisplaySettings) => void;
}) {
	const indentId = useId();
	return (
		<div className="flex flex-col gap-3">
			<div className="flex items-center justify-between gap-3 text-14">
				<span>字号</span>
				<Segmented
					aria-label="字号"
					size="sm"
					value={value.size}
					onValueChange={(size) =>
						onChange({ ...value, size: size as DisplaySettings["size"] })
					}
					segments={SIZES}
				/>
			</div>
			<div className="flex items-center justify-between gap-3 text-14">
				<span>行距</span>
				<Segmented
					aria-label="行距"
					size="sm"
					value={value.leading}
					onValueChange={(leading) =>
						onChange({ ...value, leading: leading as DisplaySettings["leading"] })
					}
					segments={LEADINGS}
				/>
			</div>
			<div className="flex items-center justify-between gap-3 text-14">
				<span id={indentId}>首行缩进</span>
				<Switch
					aria-labelledby={indentId}
					checked={value.indent}
					onCheckedChange={(indent) => onChange({ ...value, indent })}
				/>
			</div>
		</div>
	);
}

function ArticleFacts() {
	return (
		<div className="flex flex-col gap-1">
			<span className="text-12 text-muted-foreground">这篇文章</span>
			<dl className="m-0">
				{ARTICLE_FACTS.map(([term, detail]) => (
					<div
						key={term}
						className="flex justify-between border-b border-border py-1.5 text-13 last:border-b-0"
					>
						<dt className="text-muted-foreground">{term}</dt>
						<dd className="m-0">{detail}</dd>
					</div>
				))}
			</dl>
		</div>
	);
}

function LinjianCard() {
	return (
		<div className="flex flex-col gap-3">
			<div className="flex items-center gap-3">
				<Avatar name="林间" size={40} alt="" />
				<div className="min-w-0">
					<p className="m-0 text-14 font-semibold">林间</p>
					<p className="m-0 text-12 text-muted-foreground">@linjian</p>
				</div>
			</div>
			<p className="m-0 text-13 leading-relaxed">
				在杭州写后端，喜欢读别人的博客。独库公路走过两次。
			</p>
			<p className="m-0 text-12 text-muted-foreground">48 评论 · 23 批注 · 2024 年加入</p>
		</div>
	);
}

/** 贴近真实文章页的舞台：三个工具栏弹出层、正文里的悬停卡片、贴底边的「文章信息」。 */
function PopoverStage({ state }: ExhibitRenderProps) {
	const placement = PLACEMENTS.find((item) => item.id === state) ?? PLACEMENTS[0];
	const { ref, container } = useStageContainer();
	const [openId, setOpenId] = useState<string | null>(null);
	const [display, setDisplay] = useState<DisplaySettings>({
		size: "md",
		leading: "normal",
		indent: false,
	});
	const touched = useRef(false);

	// 展柜里的陈列态：舞台进入视野时展开标签面板；触发器滚出视野被弹出层自己收起后，再回来会重新展开。
	useEffect(() => {
		if (!container || typeof IntersectionObserver === "undefined") return;
		const observer = new IntersectionObserver((entries) => {
			if (entries.at(-1)?.isIntersecting && !touched.current) setOpenId("tags");
		});
		observer.observe(container);
		return () => observer.disconnect();
	}, [container]);

	const bind = (id: string) => ({
		open: openId === id,
		onOpenChange: (next: boolean) =>
			setOpenId((current) => (next ? id : current === id ? null : current)),
	});
	const contentProps = {
		container,
		collisionBoundary: container,
		onOpenAutoFocus: (event: Event) => {
			if (!touched.current) event.preventDefault();
		},
	};

	return (
		<div
			ref={ref}
			className="relative size-full rounded-xl bg-background text-foreground outline-1 -outline-offset-1 outline-rule2"
			onPointerDownCapture={() => {
				touched.current = true;
			}}
			onKeyDownCapture={() => {
				touched.current = true;
			}}
		>
			<div className="flex flex-col gap-1 px-6 pt-5">
				<span className="text-12 text-muted-foreground">2026-10-12 · 骑行</span>
				<h3 className="m-0 text-19 font-semibold">独库公路，六天</h3>
			</div>
			<div className="mt-3 flex gap-2 px-6">
				<Popover {...bind("tags")}>
					<PopoverTrigger asChild>
						<Button variant="outline" size="sm">
							<Tag />
							标签
						</Button>
					</PopoverTrigger>
					<PopoverContent side={placement.side} align={placement.align} {...contentProps}>
						<TagFilter />
					</PopoverContent>
				</Popover>
				<Popover {...bind("share")}>
					<PopoverTrigger asChild>
						<Button variant="outline" size="sm">
							<Share2 />
							分享
						</Button>
					</PopoverTrigger>
					<PopoverContent side={placement.side} align={placement.align} {...contentProps}>
						<SharePanel />
					</PopoverContent>
				</Popover>
				<Popover {...bind("display")}>
					<PopoverTrigger asChild>
						<Button variant="outline" size="sm">
							<Type />
							显示
						</Button>
					</PopoverTrigger>
					<PopoverContent side={placement.side} align={placement.align} {...contentProps}>
						<DisplayPanel value={display} onChange={setDisplay} />
					</PopoverContent>
				</Popover>
			</div>
			<article
				className={`mt-5 px-6 text-foreground/90 transition-[font-size,line-height] duration-200 ${TEXT_SIZE[display.size]} ${TEXT_LEADING[display.leading]}`}
			>
				<p className={`m-0 ${display.indent ? "indent-[2em]" : ""}`}>
					从独山子出发，第一天就爬升两千米。和{" "}
					<HoverCard>
						<HoverCardTrigger asChild>
							<StayLink
								href="#linjian"
								className="font-semibold text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring"
							>
								@林间
							</StayLink>
						</HoverCardTrigger>
						<HoverCardContent container={container} collisionBoundary={container}>
							<LinjianCard />
						</HoverCardContent>
					</HoverCard>{" "}
					约在乔尔玛汇合，他比我早到一天。哈希勒根达坂的风把手套吹透，下坡时手指已经握不住刹车。
				</p>
			</article>
			<div className="absolute right-6 bottom-5">
				<Popover {...bind("info")}>
					<PopoverTrigger asChild>
						<Button variant="ghost" size="sm">
							文章信息
						</Button>
					</PopoverTrigger>
					<PopoverContent side="top" align="end" {...contentProps}>
						<ArticleFacts />
					</PopoverContent>
				</Popover>
			</div>
		</div>
	);
}

export const popoverExhibit: Exhibit = {
	id: "popover",
	name: "弹出层",
	units: ["popover", "hover-card"],
	zone: "stage",
	category: "overlay",
	footprint: { width: 520, height: 360 },
	states: PLACEMENTS.map(({ id, label }) => ({ id, label })),
	Render: (props) => <PopoverStage key={props.state} {...props} />,
};
