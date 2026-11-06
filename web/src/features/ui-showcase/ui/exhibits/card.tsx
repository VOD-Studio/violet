import {
	Button,
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardFrame,
	CardFrameBody,
	CardFrameExcerpt,
	CardFrameImage,
	CardFrameMeta,
	CardFrameTitle,
	CardHeader,
	CardTitle,
	Skeleton,
} from "@violet/ui";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";

/** 离线封面：渐变天空与远山，颜色由色相生成，避免展品依赖网络。 */
function cover(hue: number) {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="oklch(0.88 0.06 ${hue})"/><stop offset="1" stop-color="oklch(0.96 0.02 ${hue})"/></linearGradient></defs><rect width="320" height="200" fill="url(#g)"/><circle cx="230" cy="62" r="24" fill="oklch(0.98 0.01 ${hue})"/><path d="M0 200V140q60-48 120-12t110-20 90 20v72z" fill="oklch(0.72 0.08 ${hue})" opacity=".7"/><path d="M0 200v-36q80-34 160-4t160-12v52z" fill="oklch(0.55 0.09 ${hue})"/></svg>`;
	return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const COVER = cover(350);

function BasicCard() {
	return (
		<Card className="w-90">
			<CardHeader>
				<CardTitle>同步到 Mastodon</CardTitle>
				<CardDescription>新推文会同时发到你的 Mastodon 账号</CardDescription>
			</CardHeader>
			<CardContent className="text-sm leading-7">
				已连接 @rua@mastodon.social。断开后，已同步的推文不会被删除。
			</CardContent>
			<CardFooter>
				<Button size="sm" variant="ghost">
					稍后
				</Button>
				<Button size="sm">断开</Button>
			</CardFooter>
		</Card>
	);
}

function FrameCard() {
	return (
		<CardFrame className="w-75">
			<CardFrameImage>
				<img src={COVER} alt="" />
			</CardFrameImage>
			<CardFrameBody>
				<CardFrameTitle asChild>
					<a href="#seasons">给博客加了季节</a>
				</CardFrameTitle>
				<CardFrameMeta>2026-11-02 · 技术</CardFrameMeta>
				<CardFrameExcerpt>
					背景跟着季节换：春天落樱、夏天萤火、秋天桂花、冬天落雪，深浅色各一套。
				</CardFrameExcerpt>
			</CardFrameBody>
		</CardFrame>
	);
}

function Skeletons() {
	return (
		<div className="grid w-140 grid-cols-3 items-start gap-3" aria-busy="true">
			<div className="bg-card border-sheet-border shadow-soft rounded-4 flex flex-col border px-2.5 pt-2.5 pb-4.5">
				<Skeleton className="aspect-4/3 rounded-xs" />
				<Skeleton className="mt-3.5 h-3 w-[46%]" />
				<Skeleton className="mt-3.5 h-4" />
				<Skeleton className="mt-2 h-4 w-[72%]" />
				<Skeleton className="mt-3.5 h-3" />
			</div>
			<div className="bg-card border-sheet-border shadow-soft rounded-4 flex flex-col border px-5 pt-5.5 pb-5">
				<Skeleton className="h-3 w-[46%]" />
				<Skeleton className="mt-3.5 h-4.5" />
				<Skeleton className="mt-2 h-4.5 w-[64%]" />
				<Skeleton className="mt-4 h-3" />
				<Skeleton className="mt-2 h-3" />
				<Skeleton className="mt-2 h-3 w-[58%]" />
			</div>
			<div className="flex flex-col gap-5">
				{[
					["38%", "100%", "70%"],
					["30%", "86%"],
					["42%", "100%", "54%"],
				].map(([head, ...lines]) => (
					<div key={head + lines.join()} className="flex gap-3">
						<Skeleton className="size-8 flex-none rounded-full" />
						<div className="flex flex-1 flex-col">
							<Skeleton className="h-3" style={{ width: head }} />
							{lines.map((width, index) => (
								<Skeleton
									key={width}
									className={index === 0 ? "mt-2.5 h-3" : "mt-1.5 h-3"}
									style={{ width }}
								/>
							))}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

function CardFamily({ state }: ExhibitRenderProps) {
	if (state === "frame") return <FrameCard />;
	if (state === "skeleton") return <Skeletons />;
	return <BasicCard />;
}

export const cardExhibit: Exhibit = {
	id: "card",
	name: "卡片",
	units: ["card", "skeleton"],
	zone: "content",
	category: "layout",
	footprint: { width: 560, height: 320 },
	states: [
		{ id: "basic", label: "基础卡" },
		{ id: "frame", label: "相框卡" },
		{ id: "skeleton", label: "骨架" },
	],
	Render: CardFamily,
};
