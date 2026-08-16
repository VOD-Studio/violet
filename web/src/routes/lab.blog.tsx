import { AlternatingSpread } from "@features/blog-lab/ui/AlternatingSpread";
import { BlogSkeleton, type LabDirection } from "@features/blog-lab/ui/BlogSkeleton";
import { Broadsheet } from "@features/blog-lab/ui/Broadsheet";
import { CascadeFlow } from "@features/blog-lab/ui/CascadeFlow";
import { ChronoStream } from "@features/blog-lab/ui/ChronoStream";
import { FeaturedList } from "@features/blog-lab/ui/FeaturedList";
import { JournalToc } from "@features/blog-lab/ui/JournalToc";
import { TerminalFeed } from "@features/blog-lab/ui/TerminalFeed";
import { WovenBento } from "@features/blog-lab/ui/WovenBento";
import { usePosts } from "@features/posts/api/queries";
import type { Post } from "@features/posts/model/types";
import Empty from "@shared/ui/empty";
import { Segmented } from "@shared/ui/segmented";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";

type PreviewState = "data" | "skeleton" | "empty";

const DIRECTIONS: { value: LabDirection; label: string; intent: string }[] = [
	{
		value: "featured",
		label: "特写列表",
		intent: "顶级博客主流范式：一篇大特写建立视线锚点（封面+标题+摘要+阅读引导），其余收敛为紧凑索引行。特写管情绪，列表管扫读，层级最清晰、最稳。",
	},
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
		intent: "确定性跨格节奏：6 篇恰好铺满 4×3 一循环（零留白），文字浮于图上，格子交错缩放入场。无图格退化为排版织块（织线纹理面 + 按格型分级的字块），死图数据下尺寸节奏靠字级与信息密度保持。图主导、律动最强。",
	},
	{
		value: "paper",
		label: "头版报纸",
		intent: "报纸解剖学：报耳（篇数/最近更新）、居中衬线报头、粗细双线夹日期线、通栏头条、图文分版、简讯版（版块头 + 三栏中缝线 + 标题/两端对齐导语/日期分条解剖）。动效克制，报线先画，整版一次浮现。",
	},
	{
		value: "toc",
		label: "杂志目录",
		intent: "分区目录：按栏目分组的 standing head + 双列「编号·标题·点线引导·日期」条目，纯排版零图片，信息密度最高。",
	},
	{
		value: "spread",
		label: "对开特写",
		intent: "editorial 对开页：每篇一整行、封面与文字左右交替、大序号压角、留白充分。每篇都是主角，节奏来自交替而非卡片网格；无图行退化为整行排版特写。",
	},
];

function renderDirection(direction: LabDirection, posts: Post[]) {
	switch (direction) {
		case "featured":
			return <FeaturedList posts={posts} />;
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
		case "toc":
			return <JournalToc posts={posts} />;
		case "spread":
			return <AlternatingSpread posts={posts} />;
	}
}

/**
 * /lab/blog - 博客排版实验室
 *
 * 真实文章数据渲染八个候选排版方向，可切换数据 / 骨架屏 / 空态三态
 * 对比（结构对齐 /lab/friends）。选定方向后 /blog 生产实现按此落地。
 */
function BlogLab() {
	const [direction, setDirection] = useState<LabDirection>("cascade");
	const [preview, setPreview] = useState<PreviewState>("data");
	const { data, isLoading } = usePosts({ limit: 12 });
	const posts = data?.data ?? [];
	const active = DIRECTIONS.find((d) => d.value === direction) ?? DIRECTIONS[0];

	return (
		<div className="container mx-auto px-6 py-24">
			<div className="mb-16 text-center">
				<Link
					to="/lab"
					className="mb-6 inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.25em] text-muted-foreground uppercase transition-colors hover:text-foreground"
				>
					<ArrowLeft className="size-3.5" />
					Labs
				</Link>
				<h1 className="mb-4 text-4xl font-bold tracking-tight">博客排版实验室</h1>
				<p className="mx-auto max-w-xl text-muted-foreground">
					博客列表页（/blog）的候选排版方向对比，真实文章数据渲染，含动效。选定方向后，正式页面按此实现。
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
							description="还没有发布任何文章。写下第一篇，这个版面等你来填。"
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

export const Route = createFileRoute("/lab/blog")({
	component: BlogLab,
});
