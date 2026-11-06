import {
	Avatar,
	Badge,
	Input,
	MorphingPopover,
	MorphingPopoverContent,
	MorphingPopoverTrigger,
} from "@violet/ui";
import { BookOpen, Code, Ellipsis, Search, SmilePlus } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useState } from "react";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";
import { cover, portrait } from "./art";

const SONG = cover(20);
const RUA = portrait(200);
const LIN = portrait(120);

/** 药丸上的内容：封面、名字与此刻在听的歌。药丸与它长成的卡片的副本共用这一份。 */
function PresenceLabel() {
	return (
		<span className="flex items-center gap-2 pr-3.5 pl-1.5 whitespace-nowrap">
			<img src={SONG} alt="" className="size-6.5 rounded-full object-cover" />
			<span className="font-mono text-sm font-bold">Violet</span>
			<span className="max-w-45 truncate border-l border-border pl-2 text-[13px] text-muted-foreground">
				晴天 — 周杰伦
			</span>
		</span>
	);
}

function Device({ name, children }: { name: string; children: ReactNode }) {
	return (
		<div className="mt-3.5 border-t border-border pt-3">
			<div className="text-xs text-muted-foreground">{name}</div>
			{children}
		</div>
	);
}

function AppRow({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
	return (
		<div className="mt-2.5 flex items-center gap-2.5">
			<span className="inline-flex size-7 flex-none items-center justify-center rounded-lg bg-muted text-foreground">
				{icon}
			</span>
			<div className="min-w-0">
				<b className="block truncate text-sm leading-snug font-semibold">{title}</b>
				<span className="block truncate text-xs leading-relaxed text-muted-foreground">
					{detail}
				</span>
			</div>
		</div>
	);
}

function PresenceCard() {
	return (
		<div className="px-4.5 pt-4 pb-3.5">
			<div className="flex items-center gap-2.5">
				<Avatar src={RUA} name="xunrua" alt="" size={32} />
				<div className="min-w-0 flex-1">
					<b className="block text-[15px] leading-snug font-semibold">xunrua 现在</b>
					<span className="text-xs text-muted-foreground">2 台设备在线</span>
				</div>
				<Badge tone="ok">实时</Badge>
			</div>
			<Device name="MacBook Pro">
				<div className="mt-2 flex gap-3">
					<img src={SONG} alt="" className="size-13 flex-none rounded-lg object-cover" />
					<div className="min-w-0 flex-1">
						<b className="block truncate text-sm leading-snug font-semibold">晴天</b>
						<span className="block truncate text-xs leading-relaxed text-muted-foreground">
							周杰伦 · 叶惠美 · Apple Music
						</span>
						<div className="mt-2 h-0.75 overflow-hidden rounded-xs bg-muted">
							<div className="h-full w-[36%] bg-foreground" />
						</div>
						<div className="mt-1 flex justify-between font-mono text-[11px] text-muted-foreground">
							<span>1:36</span>
							<span>4:29</span>
						</div>
					</div>
				</div>
				<AppRow
					icon={<Code size={14} aria-hidden="true" />}
					title="Visual Studio Code"
					detail="Rust 全栈笔记 · 第 5 章.md"
				/>
			</Device>
			<Device name="iPhone">
				<AppRow
					icon={<BookOpen size={14} aria-hidden="true" />}
					title="微信读书"
					detail="《置身事内》· 第 3 章"
				/>
			</Device>
			<p className="mt-3.5 text-[11px] leading-relaxed text-muted-foreground">
				只公开应用名、窗口标题和正在播放；更新于 2 秒前
			</p>
		</div>
	);
}

function PresencePill({ className }: { className?: string }) {
	return (
		<MorphingPopover className={className}>
			<MorphingPopoverTrigger
				aria-label="xunrua 的实时状态"
				className="inline-flex h-9 items-center rounded-full border border-sheet-border bg-card text-sm text-foreground shadow-soft"
			>
				<PresenceLabel />
			</MorphingPopoverTrigger>
			<MorphingPopoverContent
				aria-label="实时状态"
				className="w-95"
				ghost={<PresenceLabel />}
			>
				<PresenceCard />
			</MorphingPopoverContent>
		</MorphingPopover>
	);
}

/** 页面正文：卡片长出来时盖住它，能看出面板压在页面上、没有遮罩。 */
function Article() {
	return (
		<div className="absolute inset-x-6 top-24 text-sm leading-7 text-muted-foreground">
			<div className="font-mono text-xs">2026-10-12 · 骑行</div>
			<div className="mt-1 text-2xl font-semibold text-foreground">独库公路，六天</div>
			<p className="mt-3">
				从独山子出发，第一天就爬升两千米。哈希勒根达坂的风把手套吹透，下坡时手指已经握不住刹车。
			</p>
		</div>
	);
}

function PresenceStage() {
	return (
		<div className="relative size-full">
			<Article />
			<PresencePill className="absolute top-6 left-6" />
		</div>
	);
}

const QUICK = ["👍", "❤️", "😂", "🎉", "😮", "😢", "🙏", "👀"];
const GROUPS = [
	{ name: "最近", items: ["👍", "❤️", "🎉", "👀", "🙏", "😂", "🔥", "✨"] },
	{
		name: "常用",
		items: [
			"😀",
			"😄",
			"😊",
			"🥰",
			"😎",
			"🤔",
			"😮",
			"😢",
			"😭",
			"😡",
			"🥲",
			"😴",
			"🤯",
			"🫡",
			"👏",
			"🙌",
			"💪",
			"🤝",
			"👌",
			"✌️",
			"🫶",
			"💯",
			"✅",
			"❓",
		],
	},
	{ name: "自然", items: ["🌸", "🌿", "🍂", "❄️", "🌙", "☀️", "🌧️", "🌈"] },
];

const EMOJI_CELL = "inline-flex size-8 flex-none items-center justify-center rounded-full text-lg";

interface Chip {
	emoji: string;
	count: number;
	self: boolean;
}

/** 点一个表情：没人回应过就新增，别人回应过就加一，自己回应过再点就取消。 */
function toggle(chips: Chip[], emoji: string): Chip[] {
	const found = chips.find((chip) => chip.emoji === emoji);
	if (!found) return [...chips, { emoji, count: 1, self: true }];
	if (!found.self)
		return chips.map((chip) =>
			chip === found ? { ...chip, count: chip.count + 1, self: true } : chip,
		);
	return found.count <= 1
		? chips.filter((chip) => chip !== found)
		: chips.map((chip) =>
				chip === found ? { ...chip, count: chip.count - 1, self: false } : chip,
			);
}

/** 表情条是 listbox：整条只占一个 Tab 位，← → 与 Home / End 在选项之间移动，「更多」是最后一项。 */
function Tray({ onPick, onMore }: { onPick: (emoji: string) => void; onMore: () => void }) {
	const [active, setActive] = useState(0);
	const last = QUICK.length;
	const move = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
		const targets: Record<string, number> = {
			ArrowRight: Math.min(index + 1, last),
			ArrowLeft: Math.max(index - 1, 0),
			Home: 0,
			End: last,
		};
		const target = targets[event.key];
		if (target === undefined) return;
		event.preventDefault();
		setActive(target);
		(event.currentTarget.parentElement?.children[target] as HTMLElement | undefined)?.focus();
	};
	const cell = (index: number) => ({
		role: "option" as const,
		"aria-selected": false,
		tabIndex: active === index ? 0 : -1,
		onFocus: () => setActive(index),
		onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => move(event, index),
	});

	return (
		<div className="flex h-10 items-center gap-0.5 px-1">
			{QUICK.map((emoji, index) => (
				<button
					key={emoji}
					type="button"
					{...cell(index)}
					className={`${EMOJI_CELL} hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring`}
					onClick={() => onPick(emoji)}
				>
					{emoji}
				</button>
			))}
			<button
				type="button"
				{...cell(last)}
				aria-label="更多表情"
				className={`${EMOJI_CELL} text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring`}
				onClick={onMore}
			>
				<Ellipsis size={16} aria-hidden="true" />
			</button>
		</div>
	);
}

/** 表情条的副本：完整面板长出来时，它在原处模糊淡出。 */
function TrayGhost() {
	return (
		<span className="flex h-10 items-center gap-0.5 px-1">
			{QUICK.map((emoji) => (
				<span key={emoji} className={EMOJI_CELL}>
					{emoji}
				</span>
			))}
			<span className={`${EMOJI_CELL} text-muted-foreground`}>
				<Ellipsis size={16} />
			</span>
		</span>
	);
}

function Picker({ onPick }: { onPick: (emoji: string) => void }) {
	return (
		<div>
			<div className="px-2.5 pt-2.5">
				<Input
					aria-label="找表情"
					placeholder="找表情"
					controlSize="sm"
					leading={<Search aria-hidden="true" />}
				/>
			</div>
			<div className="max-h-50 overflow-y-auto px-2.5 pt-1.5 pb-1">
				{GROUPS.map((group) => (
					<div key={group.name}>
						<div className="mt-2 mb-1 text-xs text-muted-foreground">{group.name}</div>
						<div className="grid grid-cols-8 gap-x-0.5 gap-y-1">
							{group.items.map((emoji) => (
								<button
									key={emoji}
									type="button"
									className={`${EMOJI_CELL} hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring`}
									onClick={() => onPick(emoji)}
								>
									{emoji}
								</button>
							))}
						</div>
					</div>
				))}
			</div>
			<p className="border-t border-border px-3 pt-2 pb-2.5 text-[11px] text-muted-foreground">
				站点表情与图片表情在「表情」管理里添加
			</p>
		</div>
	);
}

function ReactionStage() {
	const [open, setOpen] = useState(false);
	const [step, setStep] = useState<"tray" | "picker">("tray");
	const [chips, setChips] = useState<Chip[]>([
		{ emoji: "👍", count: 12, self: false },
		{ emoji: "❤️", count: 5, self: true },
		{ emoji: "🎉", count: 2, self: false },
	]);
	const pick = (emoji: string) => {
		setChips((current) => toggle(current, emoji));
		setOpen(false);
	};

	return (
		<div className="absolute inset-x-6 top-6">
			<div className="text-sm font-semibold">
				评论 <span className="font-normal text-muted-foreground">12</span>
			</div>
			<div className="mt-4 flex gap-3">
				<Avatar src={LIN} name="林间" alt="" size={40} />
				<div className="min-w-0 flex-1">
					<div className="flex items-baseline gap-2.5">
						<b className="text-sm font-semibold">林间</b>
						<span className="font-mono text-xs text-muted-foreground">
							2026-10-13 21:40
						</span>
					</div>
					<p className="mt-1 text-sm leading-7">
						哈希勒根达坂那段我也推过车，下坡的时候风大到要侧着骑。
					</p>
					<div className="mt-2.5 flex flex-wrap items-center gap-1.5">
						<MorphingPopover
							open={open}
							onOpenChange={(next) => {
								// 收起时留着当前这一块播完退场；下一次打开才回到表情条
								if (next) setStep("tray");
								setOpen(next);
							}}
						>
							<MorphingPopoverTrigger
								aria-label="添加回应"
								className="inline-flex size-7 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground"
							>
								<SmilePlus size={15} aria-hidden="true" />
							</MorphingPopoverTrigger>
							{step === "tray" ? (
								<MorphingPopoverContent
									key="tray"
									role="listbox"
									aria-label="回应"
									radius={20}
									outset={6}
									className="w-78"
									ghost={<SmilePlus size={15} />}
									ghostClassName="pointer-events-none"
								>
									<Tray onPick={pick} onMore={() => setStep("picker")} />
								</MorphingPopoverContent>
							) : (
								<MorphingPopoverContent
									key="picker"
									aria-label="选择表情"
									outset={6}
									className="w-82"
									ghost={<TrayGhost />}
								>
									<Picker onPick={pick} />
								</MorphingPopoverContent>
							)}
						</MorphingPopover>
						{chips.map((chip) => (
							<button
								key={chip.emoji}
								type="button"
								aria-pressed={chip.self}
								aria-label={`${chip.emoji} ${chip.count} 人${chip.self ? "，你已回应" : ""}`}
								className={`inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[13px] ${chip.self ? "bg-selected text-selected-foreground" : "bg-muted text-foreground"}`}
								onClick={() => setChips((current) => toggle(current, chip.emoji))}
							>
								<span aria-hidden="true">{chip.emoji}</span>
								<span className="font-mono text-xs">
									{chip.count > 99 ? "99+" : chip.count}
								</span>
							</button>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}

function MorphingStage({ state }: ExhibitRenderProps) {
	if (state === "reaction") return <ReactionStage />;
	return <PresenceStage />;
}

export const morphingPopoverExhibit: Exhibit = {
	id: "morphing-popover",
	name: "变形弹出层",
	units: ["morphing-popover"],
	zone: "stage",
	category: "overlay",
	footprint: { width: 480, height: 400 },
	states: [
		{ id: "presence", label: "灵动岛展开卡" },
		{ id: "reaction", label: "回应选择器" },
	],
	Render: MorphingStage,
};
