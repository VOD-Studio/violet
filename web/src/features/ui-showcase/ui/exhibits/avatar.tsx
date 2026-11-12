import { Avatar, AvatarGroup, type AvatarSize, Segmented } from "@violet/ui";
import { Hash } from "lucide-react";
import { type ReactNode, useState } from "react";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";
import { portrait } from "./art";

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
