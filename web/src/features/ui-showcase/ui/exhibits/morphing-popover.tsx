import {
	Avatar,
	Badge,
	iconProps,
	MorphingPopover,
	MorphingPopoverContent,
	MorphingPopoverTrigger,
} from "@violet/ui";
import { BookOpen, Code } from "lucide-react";
import type { ReactNode } from "react";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";
import { cover, portrait } from "./art";
import { ReactionScene } from "./reaction";

const SONG = cover(20);
const RUA = portrait(200);

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
					icon={<Code {...iconProps(14)} aria-hidden="true" />}
					title="Visual Studio Code"
					detail="Rust 全栈笔记 · 第 5 章.md"
				/>
			</Device>
			<Device name="iPhone">
				<AppRow
					icon={<BookOpen {...iconProps(14)} aria-hidden="true" />}
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

function MorphingStage({ state }: ExhibitRenderProps) {
	if (state === "reaction") {
		return <ReactionScene state="default" />;
	}
	return <PresenceStage />;
}

export const morphingPopoverExhibit: Exhibit = {
	id: "morphing-popover",
	name: "变形弹出层",
	units: ["morphing-popover"],
	zone: "stage",
	category: "overlay",
	footprint: { width: 720, height: 420 },
	states: [
		{ id: "presence", label: "灵动岛展开卡" },
		{ id: "reaction", label: "回应选择器" },
	],
	Render: MorphingStage,
};
