import { Button } from "@shared/ui/base/button";
import { CodeCard } from "@shared/ui/code-preview";
import { CommentList, CommentSection, type CommentSectionConfig } from "@shared/ui/comment-section";
import { Segmented } from "@shared/ui/segmented";
import { Heart } from "lucide-react";
import { useState } from "react";
import { DesignSystemDocHeader } from "./DesignSystemDocHeader";

type ViewMode = "preview" | "empty" | "loading";

/** 演示用原始评论：字段由接入方自行定义，config.map 负责映射 */
interface DemoComment {
	id: string;
	user: string;
	text: string;
	time: string;
	role?: "author";
	likes: number;
	parentId?: string;
	repliesCount?: number;
	previewList?: DemoComment[];
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

const DEMO_COMMENTS: DemoComment[] = [
	{
		id: "c-1",
		user: "DefectingCat",
		role: "author",
		text: "展示层与数据层分离后，文章评论和推文评论共用同一套交互；正文、操作与回复表单都由接入方注入。",
		time: hoursAgo(3),
		likes: 12,
		repliesCount: 1,
		previewList: [
			{
				id: "c-1-1",
				parentId: "c-1",
				user: "Lin",
				text: "两层扁平加 @ 昵称，长回复串在窄屏上也不会挤压排版。",
				time: hoursAgo(2),
				likes: 3,
			},
		],
	},
	{
		id: "c-2",
		user: "Kite",
		text: "接入时只需要提供一个 config：映射函数加几个插槽。",
		time: hoursAgo(1),
		likes: 5,
		repliesCount: 0,
		previewList: [],
	},
];

const INITIAL_LIKES: Record<string, number> = { "c-1": 12, "c-1-1": 3, "c-2": 5 };

const USAGE_CODE = `const config: CommentSectionConfig<PostComment> = {
	repliesMode: "preview",
	map: (item) => ({
		id: item.id,
		depth: item.parentId ? 1 : 0,
		authorName: item.author.name,
		body: item.content,
		createdAt: item.createdAt,
		raw: item,
	}),
	renderReplyForm: (item, { onSuccess }) => (
		<ReplyComposer target={item} onSubmitted={onSuccess} />
	),
};

<CommentSection title="全部评论" form={<Composer />} isLoggedIn>
	<CommentList comments={data} config={config} isLoggedIn />
</CommentSection>`;

interface PropSpec {
	name: string;
	type: string;
	note: string;
}

const SECTION_PROPS: PropSpec[] = [
	{ name: "title", type: "ReactNode", note: "标题行内容，如「评论 (12)」。" },
	{ name: "form", type: "ReactNode", note: "顶部表单插槽，由接入方提供。" },
	{ name: "isLoggedIn", type: "boolean", note: "登录态；控制回复按钮与列表区可见性。" },
	{ name: "blackhole", type: "boolean", note: "匿名黑洞：未登录时不渲染列表区。" },
	{ name: "banner", type: "ReactNode", note: "黑洞模式的登录引导条，随 blackhole 使用。" },
	{ name: "children", type: "ReactNode", note: "列表区，通常为 CommentList。" },
];

const ITEM_FIELDS: PropSpec[] = [
	{ name: "id", type: "string", note: "评论 ID。" },
	{ name: "depth", type: "0 | 1", note: "层级：0 顶层，1 回复；两层扁平，不深嵌套。" },
	{ name: "authorName", type: "string", note: "作者昵称；无头像时渲染首字母。" },
	{ name: "authorAvatarUrl", type: "string", note: "头像 URL，空值走首字母兜底。" },
	{ name: "authorHref", type: "string", note: "作者主页；缺省时昵称不渲染为链接。" },
	{ name: "body", type: "string", note: "正文纯文本；未经 renderBody 时直接渲染。" },
	{ name: "createdAt", type: "string", note: "RFC3339 时间。" },
	{ name: "tone", type: '"default" | "discussion" | "author"', note: "卡片左侧色阶。" },
	{ name: "isAuthor", type: "boolean", note: "渲染「作者」徽章。" },
	{ name: "isPending", type: "boolean", note: "渲染「审批中」徽章。" },
	{ name: "repliesTotal", type: "number", note: "回复总数；缺省时回复区走 toggle 模式。" },
	{ name: "repliesPreview", type: "T[]", note: "回复预览；缺省时展开才拉取。" },
	{ name: "raw", type: "T", note: "原始对象，回传给插槽与回调。" },
];

const CONFIG_FIELDS: PropSpec[] = [
	{ name: "map", type: "(raw: T) => CommentDisplayItem", note: "业务数据 → 展示模型的映射。" },
	{
		name: "repliesMode",
		type: '"preview" | "toggle"',
		note: "preview 依赖后端预览与总数；toggle 展开才拉取。",
	},
	{ name: "renderBody", type: "(item) => ReactNode", note: "正文插槽；缺省渲染纯文本。" },
	{ name: "renderActions", type: "(item) => ReactNode", note: "操作插槽，如反应栏、删除按钮。" },
	{
		name: "renderReplyForm",
		type: "(item, { onSuccess }) => ReactNode",
		note: "内联回复表单；提交成功后调用 onSuccess。",
	},
	{
		name: "renderExpandedReplies",
		type: "(props) => ReactNode",
		note: "展开回复的懒加载区，由接入方包装查询。",
	},
];

function PropGroup({ title, note, rows }: { title: string; note: string; rows: PropSpec[] }) {
	return (
		<div>
			<h4 className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
				<code className="font-mono text-sm font-bold">{title}</code>
				<span className="text-xs text-muted-foreground">{note}</span>
			</h4>
			<ul className="mt-2">
				{rows.map((row) => (
					<li
						className="grid grid-cols-1 gap-x-6 gap-y-1 border-b border-border/40 py-2.5 last:border-b-0 sm:grid-cols-[16rem_minmax(0,1fr)] sm:items-baseline"
						key={row.name}
					>
						<div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
							<code className="font-mono text-xs font-medium">{row.name}</code>
							<code className="font-mono text-xs text-muted-foreground">
								{row.type}
							</code>
						</div>
						<span className="text-sm leading-relaxed text-muted-foreground">
							{row.note}
						</span>
					</li>
				))}
			</ul>
		</div>
	);
}

/**
 * 评论区组件文档页：真实组件演示、接入代码与公开契约。
 */
export function CommentSectionDocPage() {
	const [viewMode, setViewMode] = useState<ViewMode>("preview");
	const [comments, setComments] = useState(DEMO_COMMENTS);
	const [likes, setLikes] = useState(INITIAL_LIKES);
	const [liked, setLiked] = useState<Record<string, boolean>>({ "c-1": true });
	const [replyDraft, setReplyDraft] = useState("");

	const reset = () => {
		setComments(DEMO_COMMENTS);
		setLikes(INITIAL_LIKES);
		setLiked({ "c-1": true });
		setReplyDraft("");
	};

	const toggleLike = (id: string) => {
		setLiked((prev) => {
			const next = !prev[id];
			setLikes((counts) => ({ ...counts, [id]: (counts[id] ?? 0) + (next ? 1 : -1) }));
			return { ...prev, [id]: next };
		});
	};

	const config: CommentSectionConfig<DemoComment> = {
		repliesMode: "preview",
		map: (raw) => ({
			id: raw.id,
			depth: raw.parentId ? 1 : 0,
			parentId: raw.parentId,
			replyToName: raw.parentId ? "DefectingCat" : undefined,
			authorName: raw.user,
			isAuthor: raw.role === "author",
			body: raw.text,
			createdAt: raw.time,
			tone: raw.role === "author" ? "author" : "default",
			repliesTotal: raw.repliesCount ?? raw.previewList?.length ?? 0,
			repliesPreview: raw.previewList,
			raw,
		}),
		renderActions: (item) => {
			const isLiked = Boolean(liked[item.id]);
			return (
				<button
					type="button"
					onClick={() => toggleLike(item.id)}
					className={`inline-flex h-6 items-center gap-1.5 rounded-full px-2 text-xs transition-colors ${
						isLiked
							? "bg-destructive/10 text-destructive"
							: "text-muted-foreground hover:bg-muted hover:text-foreground"
					}`}
				>
					<Heart className={`size-3 ${isLiked ? "fill-current" : ""}`} />
					<span className="tabular-nums">{likes[item.id] ?? 0}</span>
				</button>
			);
		},
		renderReplyForm: (_item, { onSuccess }) => (
			<div className="space-y-2">
				<textarea
					rows={2}
					value={replyDraft}
					onChange={(e) => setReplyDraft(e.target.value)}
					placeholder="回复…"
					className="w-full resize-none rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
				/>
				<div className="flex justify-end">
					<Button
						size="sm"
						type="button"
						disabled={!replyDraft.trim()}
						onClick={() => {
							onSuccess({
								id: `reply-${Date.now()}`,
								parentId: "manual",
								user: "访客",
								text: replyDraft.trim(),
								time: new Date().toISOString(),
								likes: 0,
							});
							setReplyDraft("");
						}}
					>
						发送
					</Button>
				</div>
			</div>
		),
		renderExpandedReplies: ({ knownReplies }) => (
			<ul className="space-y-2">
				{knownReplies.map((reply) => (
					<li
						className="rounded-lg border border-border/50 bg-muted/30 p-3 text-xs"
						key={reply.id}
					>
						<span className="font-medium">{reply.authorName}</span>
						<p className="mt-1 text-foreground">{reply.body}</p>
					</li>
				))}
			</ul>
		),
	};

	return (
		<div className="mt-8">
			<DesignSystemDocHeader
				num="柒 · 壹"
				title="评论区"
				scope="文章与推文共用的纯展示评论层：适配、两层扁平回复、插槽与门控。"
			/>

			{/* 总纲 */}
			<div className="grid grid-cols-1 gap-x-6 gap-y-3 border-b border-border/40 py-6 sm:grid-cols-[10rem_minmax(0,1fr)]">
				<h4 className="text-base font-bold">总纲</h4>
				<div>
					<p className="text-sm leading-relaxed text-muted-foreground">
						<code className="font-mono text-xs">CommentSection</code> 是容器，{" "}
						<code className="font-mono text-xs">CommentList</code>{" "}
						渲染列表；组件不发请求，数据经{" "}
						<code className="font-mono text-xs">CommentSectionConfig</code> 由 feature
						层注入。接入只需四事——
					</p>
					<ol className="mt-3 space-y-1.5">
						<li className="text-sm text-muted-foreground">
							<span className="font-bold text-foreground">适配</span>
							<span className="ml-2">config.map 把业务数据映射为展示模型。</span>
						</li>
						<li className="text-sm text-muted-foreground">
							<span className="font-bold text-foreground">两层</span>
							<span className="ml-2">
								回复一律 depth 1，以 @ 昵称标注回复对象，不深嵌套。
							</span>
						</li>
						<li className="text-sm text-muted-foreground">
							<span className="font-bold text-foreground">插槽</span>
							<span className="ml-2">
								正文、操作、回复表单均为插槽，缺省有合理形态。
							</span>
						</li>
						<li className="text-sm text-muted-foreground">
							<span className="font-bold text-foreground">门控</span>
							<span className="ml-2">
								isLoggedIn 控制回复按钮；blackhole 匿名时整区隐藏。
							</span>
						</li>
					</ol>
				</div>
			</div>

			{/* 预览 */}
			<div className="grid grid-cols-1 gap-x-6 gap-y-3 border-b border-border/40 py-6 sm:grid-cols-[10rem_minmax(0,1fr)]">
				<h4 className="text-base font-bold">预览</h4>
				<div>
					<div className="flex items-center justify-between gap-4 font-sans">
						<Segmented
							value={viewMode}
							onValueChange={(v) => setViewMode(v as ViewMode)}
							segments={[
								{ value: "preview", label: "常规" },
								{ value: "empty", label: "空状态" },
								{ value: "loading", label: "加载中" },
							]}
						/>
						{viewMode === "preview" && (
							<button
								type="button"
								onClick={reset}
								className="rounded-md border border-border/40 px-2 py-0.5 font-mono text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
							>
								重置
							</button>
						)}
					</div>

					<div className="mx-auto mt-8 max-w-2xl font-sans">
						{viewMode === "preview" && (
							<CommentSection
								title={`评论 (${comments.length})`}
								form={
									<div className="flex items-start gap-3">
										<div
											aria-hidden="true"
											className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground"
										>
											V
										</div>
										<div className="min-w-0 flex-1 rounded-lg border border-input bg-card px-3 py-2.5 text-sm text-muted-foreground">
											说点什么…
										</div>
										<Button size="sm" type="button">
											发表
										</Button>
									</div>
								}
								isLoggedIn
							>
								<CommentList comments={comments} config={config} isLoggedIn />
							</CommentSection>
						)}

						{viewMode === "empty" && (
							<CommentSection title="评论 (0)" form={null} isLoggedIn>
								<CommentList comments={[]} config={config} isLoggedIn />
							</CommentSection>
						)}

						{viewMode === "loading" && (
							<CommentSection title="评论" form={null} isLoggedIn>
								<CommentList comments={[]} config={config} isLoggedIn isLoading />
							</CommentSection>
						)}
					</div>
				</div>
			</div>

			{/* 用法 */}
			<div className="grid grid-cols-1 gap-x-6 gap-y-3 border-b border-border/40 py-6 sm:grid-cols-[10rem_minmax(0,1fr)]">
				<h4 className="text-base font-bold">用法</h4>
				<div>
					<p className="text-sm leading-relaxed text-muted-foreground">
						从 <code className="font-mono text-xs">@shared/ui/comment-section</code>{" "}
						导入，实现一个 config 即接入：
					</p>
					<CodeCard className="mt-4" code={USAGE_CODE} language="tsx" title="接入示例" />
				</div>
			</div>

			{/* 契约 */}
			<div className="grid grid-cols-1 gap-x-6 gap-y-3 py-6 sm:grid-cols-[10rem_minmax(0,1fr)]">
				<h4 className="text-base font-bold">契约</h4>
				<div className="space-y-8">
					<PropGroup title="CommentSection" note="容器" rows={SECTION_PROPS} />
					<PropGroup
						title="CommentDisplayItem<T>"
						note="数据模型（config.map 输出）"
						rows={ITEM_FIELDS}
					/>
					<PropGroup
						title="CommentSectionConfig<T>"
						note="适配配置"
						rows={CONFIG_FIELDS}
					/>
				</div>
			</div>
		</div>
	);
}
