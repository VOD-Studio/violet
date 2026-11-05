import { Avatar, AvatarGroup, type AvatarSize, Segmented } from "@violet/ui";
import { Hash } from "lucide-react";
import { type ReactNode, useState } from "react";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";

/** 内联 SVG 肖像：纯色底加简化人形，不依赖网络，也不使用真人照片。 */
function portrait(hue: number, shape: "person" | "bot" = "person") {
	const body =
		shape === "bot"
			? `<rect x="22" y="26" width="52" height="44" rx="12" fill="oklch(0.97 0.02 ${hue})"/><circle cx="38" cy="46" r="5" fill="oklch(0.45 0.1 ${hue})"/><circle cx="58" cy="46" r="5" fill="oklch(0.45 0.1 ${hue})"/><rect x="40" y="58" width="16" height="4" rx="2" fill="oklch(0.45 0.1 ${hue})"/>`
			: `<circle cx="48" cy="38" r="17" fill="oklch(0.97 0.02 ${hue})"/><path d="M14 96c2-20 16-30 34-30s32 10 34 30z" fill="oklch(0.97 0.02 ${hue})"/>`;
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" fill="oklch(0.62 0.1 ${hue})"/>${body}</svg>`;
	return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const RUA = portrait(200);
const AWAY = portrait(70);
const BUSY = portrait(20);
const BOT = portrait(280, "bot");
const BROKEN = "data:image/png;base64,AAAA";
const PENDING = "/ui/avatar-pending.png";

const SIZES: [AvatarSize, number][] = [
	[24, 6],
	[32, 8],
	[40, 10],
	[48, 12],
	[64, 12],
	[96, 16],
];

const GROUP = [
	{ name: "Rua", src: portrait(200) },
	{ name: "Mei", src: portrait(340) },
	{ name: "Kai", src: portrait(140) },
	{ name: "Zed", src: portrait(60) },
	{ name: "林", src: portrait(260) },
	{ name: "Ada", src: portrait(20) },
	{ name: "Bo", src: portrait(100) },
	{ name: "Cy", src: portrait(300) },
	{ name: "Di", src: portrait(180) },
	{ name: "Eli", src: portrait(40) },
	{ name: "Fay", src: portrait(220) },
	{ name: "Gus", src: portrait(320) },
];
const COUNTS = [1, 2, 3, 5, 12] as const;

function Caption({ children }: { children: ReactNode }) {
	return <span className="text-muted-foreground text-xs whitespace-nowrap">{children}</span>;
}

function Item({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="flex flex-col items-center gap-2">
			<div className="flex h-12 items-center">{children}</div>
			<Caption>{label}</Caption>
		</div>
	);
}

function Forms() {
	return (
		<div className="flex flex-wrap items-start gap-x-6 gap-y-4">
			<Item label="图片">
				<Avatar name="Rua" src={RUA} size={48} />
			</Item>
			<Item label="首字">
				<Avatar name="林" size={48} />
			</Item>
			<Item label="季节色">
				<Avatar name="径" size={48} tone="season" />
			</Item>
			<Item label="频道">
				<Avatar name="随笔" size={48} shape="square" icon={<Hash />} />
			</Item>
			<Item label="机器人">
				<Avatar name="Bot" size={48} shape="square" src={BOT} />
			</Item>
		</div>
	);
}

function Sizes() {
	return (
		<div className="flex items-end gap-4">
			{SIZES.map(([size, radius]) => (
				<div key={size} className="flex flex-col items-center gap-2">
					<Avatar name="Rua" src={RUA} size={size} />
					<Avatar name="随笔" size={size} shape="square" icon={<Hash />} />
					<Caption>
						{size} · {radius}
					</Caption>
				</div>
			))}
		</div>
	);
}

function Decorations() {
	return (
		<div className="flex flex-wrap items-start gap-x-6 gap-y-4">
			<Item label="在线">
				<Avatar name="Rua" src={RUA} size={48} status="online" />
			</Item>
			<Item label="离开">
				<Avatar name="Mei" src={AWAY} size={48} status="away" />
			</Item>
			<Item label="勿扰">
				<Avatar name="Kai" src={BUSY} size={48} status="busy" />
			</Item>
			<Item label="季节挂饰">
				<Avatar name="Rua" src={RUA} size={48} ring />
			</Item>
			<Item label="作者">
				<Avatar name="Rua" src={RUA} size={48} crown />
			</Item>
		</div>
	);
}

function Group() {
	const [count, setCount] = useState<(typeof COUNTS)[number]>(5);
	return (
		<div className="flex flex-col items-start gap-4">
			<div className="flex h-12 items-center gap-4">
				<AvatarGroup items={GROUP.slice(0, count)} label={`${count} 人点了赞`} />
				<Caption>{count} 人点了赞</Caption>
			</div>
			<Segmented
				aria-label="人数"
				value={String(count)}
				onValueChange={(value) => setCount(Number(value) as (typeof COUNTS)[number])}
				segments={COUNTS.map((n) => ({ value: String(n), label: String(n) }))}
			/>
		</div>
	);
}

function LoadingFailure() {
	const [failed, setFailed] = useState(false);
	return (
		<div className="flex flex-wrap items-start gap-x-6 gap-y-4">
			<Item label="加载中">
				{/* 同源且位于视口外的懒加载图片永远不触发请求，保持在加载态 */}
				<Avatar
					name="Rua"
					src={PENDING}
					size={48}
					imgProps={{
						loading: "lazy",
						style: { inset: "auto", insetBlockStart: -99999 },
					}}
				/>
			</Item>
			<Item label="失败退回首字">
				<Avatar key={String(failed)} name="Rua" src={failed ? BROKEN : RUA} size={48} />
			</Item>
			<div className="flex h-12 items-center">
				<Segmented
					aria-label="图片来源"
					value={failed ? "bad" : "ok"}
					onValueChange={(value) => setFailed(value === "bad")}
					segments={[
						{ value: "ok", label: "正常" },
						{ value: "bad", label: "失败" },
					]}
				/>
			</div>
		</div>
	);
}

function AvatarFamily({ state }: ExhibitRenderProps) {
	switch (state) {
		case "sizes":
			return <Sizes />;
		case "decorations":
			return <Decorations />;
		case "group":
			return <Group />;
		case "loading":
			return <LoadingFailure />;
		default:
			return <Forms />;
	}
}

export const avatarExhibit: Exhibit = {
	id: "avatar",
	name: "头像",
	units: ["avatar"],
	zone: "shelf",
	category: "display",
	footprint: { width: 420, height: 232 },
	states: [
		{ id: "forms", label: "形态" },
		{ id: "sizes", label: "尺寸" },
		{ id: "decorations", label: "状态与挂饰" },
		{ id: "group", label: "一组头像" },
		{ id: "loading", label: "加载与失败" },
	],
	Render: AvatarFamily,
};
