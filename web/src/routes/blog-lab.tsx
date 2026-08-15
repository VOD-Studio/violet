import { BlogSkeleton, type LabDirection } from "@features/blog-lab/ui/BlogSkeleton";
import { Broadsheet } from "@features/blog-lab/ui/Broadsheet";
import { CascadeFlow } from "@features/blog-lab/ui/CascadeFlow";
import { ChronoStream } from "@features/blog-lab/ui/ChronoStream";
import { Filmstrip } from "@features/blog-lab/ui/Filmstrip";
import { JournalToc } from "@features/blog-lab/ui/JournalToc";
import { TerminalFeed } from "@features/blog-lab/ui/TerminalFeed";
import { WovenBento } from "@features/blog-lab/ui/WovenBento";
import { usePosts } from "@features/posts/api/queries";
import type { Post } from "@features/posts/model/types";
import Empty from "@shared/ui/empty";
import { Segmented } from "@shared/ui/segmented";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

type PreviewState = "data" | "skeleton" | "empty";

const DIRECTIONS: { value: LabDirection; label: string; intent: string }[] = [
	{
		value: "cascade",
		label: "主轴瀑布",
		intent: "最新一篇全宽主轴（blur-in 入场）+ 其余 CSS columns 自然高度瀑布流；无封面退化为 № 排版卡，SpotlightCard 冷光 + 上浮 hover。「大小不一」是节奏不是缺陷。",
	},
	{
		value: "terminal",
		label: "终端索引",
		intent: "$ ls ~/posts --sort=time：光标闪烁、行序交错入场，hover 行平滑展开封面与摘要。封面退居交互层，碎图不构成视觉问题。",
	},
	{
		value: "rail",
		label: "编年轨道",
		intent: "发光垂直轨道 + 日期节点滚动点亮，条目自左滑入。无卡片框，滚动即「沿时间下行」。",
	},
	{
		value: "bento",
		label: "织纹 Bento",
		intent: "确定性跨格节奏（每 6 篇铺满一循环），文字浮于图上，格子交错缩放入场。图主导、律动最强。",
	},
	{
		value: "paper",
		label: "头版报纸",
		intent: "报头先落、头条 blur-in、三栏 briefs 按栏序入场——像报纸摊开。信息密度与编辑气派拉满。",
	},
	{
		value: "film",
		label: "胶片条",
		intent: "横向 scroll-snap 胶片带：齿孔装饰 + hover 帧上浮推进。垂直占用最小，适合页首「最新」带。",
	},
	{
		value: "toc",
		label: "杂志目录",
		intent: "纯排版零图片：头条大字 + 双列目录自上而下交错入场。最安静，碎图问题从根上不存在。",
	},
];

function renderDirection(direction: LabDirection, posts: Post[]) {
	switch (direction) {
		case "cascade":
			return <CascadeFlow posts={posts} />;
		case "terminal":
			return <TerminalFeed posts={posts} />;
		case "rail":
			return <ChronoStream posts={posts} />;
		case "bento":
			return <WovenBento posts={posts} />;
		case "paper":
			return <Broadsheet posts={posts} />;
		case "film":
			return <Filmstrip posts={posts} />;
		case "toc":
			return <JournalToc posts={posts} />;
	}
}

/**
 * /blog-lab - 博客排版原型实验室
 *
 * 真实文章数据渲染七个候选排版方向，可切换数据 / 骨架屏 / 空态三态
 * 对比（结构对齐 /friends-lab）。选定方向后 /blog 生产实现按此落地。
 */
function BlogLab() {
	const [direction, setDirection] = useState<LabDirection>("cascade");
	const [preview, setPreview] = useState<PreviewState>("data");
	const { data, isLoading } = usePosts({ limit: 12 });
	const posts = data?.data ?? [];
	const active = DIRECTIONS.find((d) => d.value === direction) ?? DIRECTIONS[0];

	return (
		<div className="container mx-auto max-w-6xl px-6 py-24">
			<div className="mb-16 text-center">
				<h1 className="mb-4 text-4xl font-bold tracking-tight">博客排版实验室</h1>
				<p className="mx-auto max-w-xl text-muted-foreground">
					/blog 列表页的候选排版方向对比（真实数据渲染，含动效）。
					选定方向后生产实现按此落地。
				</p>
			</div>

			<section>
				<div className="mb-6 flex flex-wrap items-center justify-between gap-4">
					<Segmented
						value={direction}
						onValueChange={setDirection}
						segments={DIRECTIONS.map((d) => ({ value: d.value, label: d.label }))}
					/>
					<Segmented
						value={preview}
						onValueChange={setPreview}
						segments={[
							{ value: "data", label: "数据" },
							{ value: "skeleton", label: "骨架屏" },
							{ value: "empty", label: "空态" },
						]}
					/>
				</div>

				<p className="mb-6 font-mono text-xs text-muted-foreground">
					<span className="mr-2 tracking-[0.3em] text-muted-foreground/60 uppercase">
						Intent
					</span>
					{active.intent}
				</p>

				{/* 近生产预览框 */}
				<div className="rounded-2xl border border-edge-hairline bg-background/40 p-6 md:p-10">
					<p className="mb-8 font-mono text-[10px] tracking-[0.3em] text-muted-foreground/50 uppercase">
						Preview · violet.blog/blog · {active.label}
					</p>

					<header className="mb-10 flex flex-wrap items-end justify-between gap-4">
						<div>
							<p className="mb-2 font-mono text-xs tracking-[0.3em] text-muted-foreground uppercase">
								Blog
							</p>
							<h3 className="font-mono text-4xl font-bold">博客</h3>
						</div>
					</header>

					{preview === "skeleton" ? (
						<BlogSkeleton key={`sk-${direction}`} direction={direction} />
					) : null}

					{preview === "empty" ? (
						<Empty
							key={`empty-${direction}`}
							size="lg"
							title="NO POSTS YET"
							description="还没有发布任何文章。写下第一篇，时间轴从此开始流动。"
							className="py-16"
						/>
					) : null}

					{preview === "data" ? (
						isLoading ? (
							<BlogSkeleton direction={direction} />
						) : posts.length === 0 ? (
							<Empty
								size="lg"
								title="NO POSTS YET"
								description="还没有发布任何文章。"
								className="py-16"
							/>
						) : (
							// key 变化在切换方向时重挂载，重放入场动画
							<div key={direction}>{renderDirection(direction, posts)}</div>
						)
					) : null}
				</div>
			</section>
		</div>
	);
}

export const Route = createFileRoute("/blog-lab")({
	component: BlogLab,
});
