import { MOCK_GALLERIES, MOCK_GALLERY } from "@features/lab/gallery/model/mock";
import { FeedPhotoStack } from "@features/lab/gallery/ui/FeedPhotoStack";
import {
	FeedCoverCards,
	FeedGridPeek,
	FeedMagazineRows,
} from "@features/lab/gallery/ui/FeedVariants";
import { GridJustified, GridMasonry, GridUniform } from "@features/lab/gallery/ui/GridVariants";
import {
	LightboxImmersive,
	LightboxSidebar,
	LightboxThumbstrip,
} from "@features/lab/gallery/ui/LightboxVariants";
import { LabHeader } from "@features/lab/ui/LabHeader";
import Empty from "@shared/ui/empty";
import { Segmented } from "@shared/ui/segmented";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

type PreviewState = "data" | "empty";
type FeedDir = "cards" | "peek" | "rows" | "stack";
type GridDir = "justified" | "masonry" | "uniform";
type LightboxDir = "immersive" | "sidebar" | "thumbstrip";

const FEED_DIRECTIONS: { value: FeedDir; label: string; intent: string }[] = [
	{
		value: "cards",
		label: "封面大卡片",
		intent: "封面即门面——大封面 + 标题作者项数，扫读靠图，最接近现有博客卡片语言。",
	},
	{
		value: "peek",
		label: "九宫格预览",
		intent: "封面 + 首 5 张九宫格——不点开就能感知图集内容密度，信息量最大的浏览态。",
	},
	{
		value: "rows",
		label: "杂志横排",
		intent: "hairline 行式条目 + 小封面开道——与 EditorialIndex 目录语言同源，图集多时扫读效率最高。",
	},
	{
		value: "stack",
		label: "照片堆叠",
		intent: "一沓照片——错位叠放成栈暗示多张，横向拖拽翻页，展开键切平铺一览全部。",
	},
];

const GRID_DIRECTIONS: { value: GridDir; label: string; intent: string }[] = [
	{
		value: "justified",
		label: "等高行",
		intent: "Google Photos 形态——每行等高、按宽高比分列宽，横竖混排最自然、无裁切。",
	},
	{
		value: "masonry",
		label: "瀑布流",
		intent: "Pinterest 形态——等宽多列纵向堆叠，无裁切实现最简；行参差、节奏碎。",
	},
	{
		value: "uniform",
		label: "等宽网格",
		intent: "统一方格统一裁切——秩序感最强、密度最高；竖图被裁，适合封面质量统一的图集。",
	},
];

const LIGHTBOX_DIRECTIONS: { value: LightboxDir; label: string; intent: string }[] = [
	{
		value: "immersive",
		label: "全屏黑底",
		intent: "经典沉浸——黑底居中大图、←/→ 键盘导航、caption 压底；视频内嵌播放。",
	},
	{
		value: "sidebar",
		label: "信息侧栏",
		intent: "图 + 右侧信息栏——caption 全文有排版空间，适合教程步骤图（caption 即内容）。",
	},
	{
		value: "thumbstrip",
		label: "缩略图条",
		intent: "大图 + 底部缩略条（对标生产 ImagePreview）——长图集跳转效率最高，差异在视频项与 caption。",
	},
];

/**
 * /lab/gallery - 图集原型实验室（issue #270）
 *
 * 静态 mock、不接 API：浏览流 ×3、详情网格 ×3、灯箱 ×3 独立选型，
 * 点击网格任意项打开当前灯箱方向。三态含数据/空。选定组合回填
 * PRD-0022 后 T3（#266）按选型落地生产页。
 */
function GalleryLab() {
	const [feed, setFeed] = useState<FeedDir>("cards");
	const [grid, setGrid] = useState<GridDir>("justified");
	const [lightbox, setLightbox] = useState<LightboxDir>("immersive");
	const [feedPreview, setFeedPreview] = useState<PreviewState>("data");
	const [gridPreview, setGridPreview] = useState<PreviewState>("data");
	const [openIndex, setOpenIndex] = useState<number | null>(null);

	const activeFeed = FEED_DIRECTIONS.find((d) => d.value === feed) ?? FEED_DIRECTIONS[0];
	const activeGrid = GRID_DIRECTIONS.find((d) => d.value === grid) ?? GRID_DIRECTIONS[0];
	const activeLightbox =
		LIGHTBOX_DIRECTIONS.find((d) => d.value === lightbox) ?? LIGHTBOX_DIRECTIONS[0];

	return (
		<div className="container mx-auto px-6 py-4">
			<LabHeader to="/lab/gallery" />

			{/* ============ 浏览流：三方向 ============ */}
			<section className="mb-24">
				<h2 className="mb-2 text-2xl font-semibold">浏览流 · 三方向</h2>
				<p className="mb-8 text-sm text-muted-foreground">
					同一组 mock 图集（6 本，含长标题/空简介/竖封面样本）在三个方向下的渲染。
				</p>
				<div className="mb-6 flex flex-wrap items-center justify-between gap-4">
					<Segmented
						value={feed}
						onValueChange={setFeed}
						segments={FEED_DIRECTIONS.map((d) => ({ value: d.value, label: d.label }))}
						size="default"
					/>
					<Segmented
						value={feedPreview}
						onValueChange={setFeedPreview}
						segments={[
							{ value: "data", label: "数据" },
							{ value: "empty", label: "空态" },
						]}
					/>
				</div>
				<p className="mb-6 font-mono text-xs text-muted-foreground">
					<span className="mr-2 tracking-[0.3em] text-muted-foreground/60 uppercase">
						Intent
					</span>
					{activeFeed.intent}
				</p>
				<div className="rounded-2xl border border-edge-hairline bg-background/40 p-6 md:p-10">
					<p className="mb-8 font-mono text-[10px] tracking-[0.3em] text-muted-foreground/50 uppercase">
						Preview · violet.blog/galleries · {activeFeed.label}
					</p>
					{feedPreview === "data" ? (
						<div key={feed}>
							{feed === "cards" ? (
								<FeedCoverCards galleries={MOCK_GALLERIES} />
							) : null}
							{feed === "peek" ? <FeedGridPeek galleries={MOCK_GALLERIES} /> : null}
							{feed === "rows" ? (
								<FeedMagazineRows galleries={MOCK_GALLERIES} />
							) : null}
							{feed === "stack" ? (
								<FeedPhotoStack galleries={MOCK_GALLERIES} />
							) : null}
						</div>
					) : (
						<Empty
							size="lg"
							title="NO GALLERIES YET"
							description="还没有公开图集。从素材库选几张图，第一本图集就从这里开始。"
							className="py-16"
						/>
					)}
				</div>
			</section>

			{/* ============ 详情网格 × 灯箱组合 ============ */}
			<section>
				<h2 className="mb-2 text-2xl font-semibold">详情网格 × 灯箱 · 组合选型</h2>
				<p className="mb-8 text-sm text-muted-foreground">
					网格与灯箱独立选型：点击网格任意项以当前灯箱方向打开（←/→ 导航、Esc
					关闭、视频项可直接播放）。 mock 是 14 项摄影集：横竖方混排 + 2 个视频 + 空与长
					caption 样本。
				</p>
				<div className="mb-6 flex flex-wrap items-center justify-between gap-4">
					<Segmented
						value={grid}
						onValueChange={setGrid}
						segments={GRID_DIRECTIONS.map((d) => ({ value: d.value, label: d.label }))}
						size="default"
					/>
					<Segmented
						value={lightbox}
						onValueChange={setLightbox}
						segments={LIGHTBOX_DIRECTIONS.map((d) => ({
							value: d.value,
							label: d.label,
						}))}
						size="default"
					/>
					<Segmented
						value={gridPreview}
						onValueChange={setGridPreview}
						segments={[
							{ value: "data", label: "数据" },
							{ value: "empty", label: "空态" },
						]}
					/>
				</div>
				<p className="mb-3 font-mono text-xs text-muted-foreground">
					<span className="mr-2 tracking-[0.3em] text-muted-foreground/60 uppercase">
						Intent · 网格
					</span>
					{activeGrid.intent}
				</p>
				<p className="mb-6 font-mono text-xs text-muted-foreground">
					<span className="mr-2 tracking-[0.3em] text-muted-foreground/60 uppercase">
						Intent · 灯箱
					</span>
					{activeLightbox.intent}
				</p>
				<div className="rounded-2xl border border-edge-hairline bg-background/40 p-6 md:p-10">
					<p className="mb-8 font-mono text-[10px] tracking-[0.3em] text-muted-foreground/50 uppercase">
						Preview · violet.blog/galleries/{MOCK_GALLERY.id} · {activeGrid.label} ×{" "}
						{activeLightbox.label}
					</p>
					{gridPreview === "data" ? (
						<div key={grid}>
							{grid === "justified" ? (
								<GridJustified items={MOCK_GALLERY.items} onOpen={setOpenIndex} />
							) : null}
							{grid === "masonry" ? (
								<GridMasonry items={MOCK_GALLERY.items} onOpen={setOpenIndex} />
							) : null}
							{grid === "uniform" ? (
								<GridUniform items={MOCK_GALLERY.items} onOpen={setOpenIndex} />
							) : null}
						</div>
					) : (
						<Empty
							size="lg"
							title="EMPTY GALLERY"
							description="图集没有内容项。添加图片或视频后，网格从这里长出来。"
							className="py-16"
						/>
					)}
				</div>
			</section>

			{openIndex !== null ? (
				<div className="fixed inset-0 z-50">
					{lightbox === "immersive" ? (
						<LightboxImmersive
							items={MOCK_GALLERY.items}
							index={openIndex}
							onIndexChange={setOpenIndex}
							onClose={() => setOpenIndex(null)}
						/>
					) : null}
					{lightbox === "sidebar" ? (
						<LightboxSidebar
							items={MOCK_GALLERY.items}
							index={openIndex}
							onIndexChange={setOpenIndex}
							onClose={() => setOpenIndex(null)}
						/>
					) : null}
					{lightbox === "thumbstrip" ? (
						<LightboxThumbstrip
							items={MOCK_GALLERY.items}
							index={openIndex}
							onIndexChange={setOpenIndex}
							onClose={() => setOpenIndex(null)}
						/>
					) : null}
				</div>
			) : null}
		</div>
	);
}

export const Route = createFileRoute("/lab/gallery")({
	component: GalleryLab,
});
