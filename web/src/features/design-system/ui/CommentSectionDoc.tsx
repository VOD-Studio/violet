import { copyText } from "@shared/lib/clipboard";
import { CodeCard } from "@shared/ui/code-preview";
import { CommentList, CommentSection, type CommentSectionConfig } from "@shared/ui/comment-section";
import {
	Check,
	ChevronDown,
	ChevronUp,
	Component,
	Copy,
	FileCode2,
	GitBranch,
	Heart,
	Send,
} from "lucide-react";
import { type ReactNode, useState } from "react";

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

const BASIC_COMMENTS: DemoComment[] = [
	{
		id: "c-1",
		user: "DefectingCat",
		role: "author",
		text: "展示层与数据层解耦后，文章评论和推文评论共用同一套交互逻辑；正文、操作与回复表单均通过插槽注入。",
		time: hoursAgo(3),
		likes: 12,
		repliesCount: 1,
		previewList: [
			{
				id: "c-1-1",
				parentId: "c-1",
				user: "Lin",
				text: "双层扁平回复结构配合 @ 昵称标注，在移动端不会发生多层级挤压。",
				time: hoursAgo(2),
				likes: 3,
			},
		],
	},
	{
		id: "c-2",
		user: "Kite",
		text: "业务方只需提供一个 CommentSectionConfig 适配器即可完成接入。",
		time: hoursAgo(1),
		likes: 5,
		repliesCount: 0,
		previewList: [],
	},
];

const IMPORT_CODE = `import { CommentSection, CommentList } from "@shared/ui/comment-section";`;

const BASIC_USAGE_CODE = `import { CommentSection, CommentList, type CommentSectionConfig } from "@shared/ui/comment-section";

const config: CommentSectionConfig<PostComment> = {
  repliesMode: "preview",
  map: (item) => ({
    id: item.id,
    depth: item.parentId ? 1 : 0,
    authorName: item.author.name,
    authorAvatarUrl: item.author.avatar,
    body: item.content,
    createdAt: item.createdAt,
    tone: item.isAuthor ? "author" : "default",
    raw: item,
  }),
  renderReplyForm: (item, { onSuccess }) => (
    <ReplyComposer target={item} onSubmitted={onSuccess} />
  ),
  renderActions: (item) => <ReactionBar targetId={item.id} />,
};

export function ArticleComments({ comments, isLoggedIn }: Props) {
  return (
    <CommentSection
      title="全部评论"
      form={<CommentComposer />}
      isLoggedIn={isLoggedIn}
    >
      <CommentList comments={comments} config={config} isLoggedIn={isLoggedIn} />
    </CommentSection>
  );
}`;

const EMPTY_STATE_CODE = `<CommentSection title="全部评论 (0)" form={null} isLoggedIn={true}>
  <CommentList comments={[]} config={config} isLoggedIn={true} />
</CommentSection>`;

const LOADING_STATE_CODE = `<CommentSection title="全部评论" form={null} isLoggedIn={true}>
  <CommentList comments={[]} config={config} isLoggedIn={true} isLoading={true} />
</CommentSection>`;

interface PropRow {
	prop: string;
	type: string;
	defaultValue?: string;
	description: string;
	required?: boolean;
}

const SECTION_PROPS: PropRow[] = [
	{
		prop: "title",
		type: "ReactNode",
		required: true,
		description: "评论区头部标题内容（如「全部评论 (12)」）",
	},
	{
		prop: "form",
		type: "ReactNode",
		required: true,
		description: "顶部发表表单插槽，由接入方提供输入界面",
	},
	{
		prop: "isLoggedIn",
		type: "boolean",
		required: true,
		description: "当前访客的登录状态，控制子项中回复按钮与操作权限",
	},
	{
		prop: "blackhole",
		type: "boolean",
		defaultValue: "false",
		description: "匿名黑洞模式：未登录时完全隐藏评论列表区",
	},
	{
		prop: "banner",
		type: "ReactNode",
		description: "黑洞模式下的登录引导提示条",
	},
	{
		prop: "children",
		type: "ReactNode",
		required: true,
		description: "列表容器子节点，通常装配 CommentList",
	},
];

const ITEM_FIELDS: PropRow[] = [
	{ prop: "id", type: "string", required: true, description: "评论唯一标识" },
	{
		prop: "depth",
		type: "0 | 1",
		required: true,
		description: "缩进深度：0 为顶层评论，1 为回复（严格双层扁平）",
	},
	{
		prop: "authorName",
		type: "string",
		required: true,
		description: "作者昵称；头像缺省时自动渲染首字母",
	},
	{ prop: "authorAvatarUrl", type: "string", description: "作者头像 URL 地址" },
	{ prop: "authorHref", type: "string", description: "作者个人主页链接；缺省时昵称不可点击" },
	{
		prop: "body",
		type: "string",
		required: true,
		description: "纯文本正文；未传 renderBody 时默认直接渲染",
	},
	{
		prop: "createdAt",
		type: "string",
		required: true,
		description: "创建时间（RFC3339 字符串）",
	},
	{
		prop: "tone",
		type: '"default" | "discussion" | "author"',
		defaultValue: '"default"',
		description: "左侧视觉色阶：author 呈品牌高光，discussion 呈中性色",
	},
	{
		prop: "isAuthor",
		type: "boolean",
		defaultValue: "false",
		description: "是否为作者本人，开启后渲染「作者」徽标",
	},
	{
		prop: "isPending",
		type: "boolean",
		defaultValue: "false",
		description: "是否待审核，开启后渲染「审批中」徽标",
	},
	{
		prop: "repliesTotal",
		type: "number",
		description: "回复总数；缺省时回复区退化为查看折叠模式",
	},
	{ prop: "repliesPreview", type: "T[]", description: "预先随顶层评论返回的回复预览列表" },
	{
		prop: "raw",
		type: "T",
		required: true,
		description: "原始业务数据对象，原样回传给插槽与回调",
	},
];

const CONFIG_FIELDS: PropRow[] = [
	{
		prop: "map",
		type: "(raw: T) => CommentDisplayItem<T>",
		required: true,
		description: "将原始业务数据转换为展示模型的映射函数",
	},
	{
		prop: "repliesMode",
		type: '"preview" | "toggle"',
		required: true,
		description: "回复区加载机制：preview 依赖初始预览；toggle 点开后懒加载",
	},
	{
		prop: "renderBody",
		type: "(item: CommentDisplayItem<T>) => ReactNode",
		description: "自定义正文渲染插槽（支持注入 Markdown / Emoji / 媒体）",
	},
	{
		prop: "renderActions",
		type: "(item: CommentDisplayItem<T>) => ReactNode",
		description: "单条评论底部操作区插槽（如点赞 ReactionBar、删除等）",
	},
	{
		prop: "renderReplyForm",
		type: "(item: CommentDisplayItem<T>, opts: { onSuccess }) => ReactNode",
		required: true,
		description: "内联回复输入表单插槽；提交成功后触发 onSuccess(newRaw)",
	},
	{
		prop: "renderExpandedReplies",
		type: "(props: ExpandedProps) => ReactNode",
		required: true,
		description: "展开回复的懒加载查询区，由接入方封装分页 hooks 渲染",
	},
];

/**
 * HeroUI 风格一体化演示卡片（上方纯净舞台 + 下方高质感深色代码区）。
 */
function HeroDemoBox({ children, code }: { children: ReactNode; code: string }) {
	const lineCount = code.split("\n").length;
	const isCollapsible = lineCount > 7;
	const [expanded, setExpanded] = useState(!isCollapsible);

	return (
		<div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xs">
			{/* 上半部分：预览舞台（居中大方铺开） */}
			<div className="flex min-h-64 items-center justify-center p-6 sm:p-10 bg-background/50">
				<div className="w-full max-w-2xl">{children}</div>
			</div>

			{/* 下半部分：高对比度连体深色代码区 */}
			<div className="relative border-t border-border/70 bg-[#24292e]">
				<div
					className={`overflow-hidden transition-[max-height] duration-300 ease-in-out ${
						!isCollapsible || expanded ? "max-h-[800px]" : "max-h-40"
					}`}
				>
					<CodeCard
						code={code}
						language="tsx"
						className="rounded-none! border-0! bg-transparent!"
					/>
				</div>

				{/* 仅在代码较长且处于折叠态时，渲染深色渐变遮罩与 Expand 胶囊 */}
				{isCollapsible && !expanded && (
					<div className="absolute inset-x-0 bottom-0 flex h-24 items-end justify-center bg-gradient-to-t from-[#24292e] via-[#24292e]/85 to-transparent pb-3 pointer-events-none">
						<button
							type="button"
							onClick={() => setExpanded(true)}
							className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-white/20 bg-[#2d333b] px-4 py-1.5 text-xs font-medium text-white shadow-sm transition-all hover:bg-[#373e47] hover:border-white/30"
						>
							<span>Expand code</span>
							<ChevronDown className="size-3.5 text-white/70" />
						</button>
					</div>
				)}

				{/* 展开后的底部收起控制条 */}
				{isCollapsible && expanded && (
					<div className="flex justify-center border-t border-white/10 bg-[#24292e] py-2">
						<button
							type="button"
							onClick={() => setExpanded(false)}
							className="flex items-center gap-1.5 rounded-full border border-white/20 bg-[#2d333b] px-4 py-1 text-xs font-medium text-white/90 shadow-sm transition-all hover:bg-[#373e47] hover:text-white"
						>
							<span>Collapse code</span>
							<ChevronUp className="size-3.5 text-white/70" />
						</button>
					</div>
				)}
			</div>
		</div>
	);
}

/**
 * HeroUI 标志性 API 表格（圆角底座表头 + 纯净行距代码标签，支持自适应水平滚动）。
 */
function HeroApiTable({ title, rows }: { title: string; rows: PropRow[] }) {
	return (
		<div className="space-y-4 font-sans">
			<h3 className="text-lg font-bold tracking-tight text-foreground">{title}</h3>

			<div className="overflow-x-auto rounded-xl">
				<table className="w-full min-w-160 border-collapse text-left text-xs">
					<thead>
						<tr className="border-b border-border/40 bg-muted/50 font-mono text-muted-foreground">
							<th className="rounded-l-xl py-3 px-4 font-semibold w-44">Prop</th>
							<th className="py-3 px-4 font-semibold w-60">Type</th>
							<th className="py-3 px-4 font-semibold w-28">Default</th>
							<th className="rounded-r-xl py-3 px-4 font-semibold min-w-56">
								Description
							</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-border/30">
						{rows.map((row) => (
							<tr key={row.prop} className="transition-colors hover:bg-muted/15">
								<td className="py-3.5 px-4 font-mono font-medium text-foreground align-top">
									<div className="flex items-center gap-1.5">
										<code className="rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-foreground">
											{row.prop}
										</code>
										{row.required && (
											<span
												className="text-destructive font-mono text-xs"
												title="Required"
											>
												*
											</span>
										)}
									</div>
								</td>
								<td className="py-3.5 px-4 font-mono text-muted-foreground align-top">
									<code className="inline-block rounded-md bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground break-all">
										{row.type}
									</code>
								</td>
								<td className="py-3.5 px-4 font-mono text-muted-foreground align-top">
									{row.defaultValue ? (
										<code className="rounded-md bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground">
											{row.defaultValue}
										</code>
									) : (
										<span className="text-muted-foreground/40 text-xs">-</span>
									)}
								</td>
								<td className="py-3.5 px-4 text-xs text-muted-foreground leading-relaxed align-top">
									{row.description}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}

/**
 * 评论区组件文档页（对齐 HeroUI 规范）。
 */
export function CommentSectionDocPage() {
	const [comments] = useState<DemoComment[]>(BASIC_COMMENTS);
	const [likes, setLikes] = useState<Record<string, number>>({ "c-1": 12, "c-1-1": 3, "c-2": 5 });
	const [hasLiked, setHasLiked] = useState<Record<string, boolean>>({ "c-1": true });
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		const ok = await copyText(IMPORT_CODE);
		if (ok) {
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		}
	};

	const handleToggleLike = (id: string) => {
		setHasLiked((prev) => {
			const active = !prev[id];
			setLikes((curr) => ({
				...curr,
				[id]: (curr[id] ?? 0) + (active ? 1 : -1),
			}));
			return { ...prev, [id]: active };
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
			const isLiked = Boolean(hasLiked[item.id]);
			const count = likes[item.id] ?? 0;
			return (
				<button
					type="button"
					onClick={() => handleToggleLike(item.id)}
					className={`inline-flex h-6 items-center gap-1.5 rounded-full px-2 text-xs transition-colors ${
						isLiked
							? "bg-destructive/10 text-destructive"
							: "text-muted-foreground hover:bg-muted hover:text-foreground"
					}`}
				>
					<Heart className={`size-3 ${isLiked ? "fill-current" : ""}`} />
					<span className="tabular-nums font-mono">{count}</span>
				</button>
			);
		},
		renderReplyForm: (item) => (
			<div className="mt-3 space-y-2 rounded-xl border border-border/70 bg-background/60 p-3 font-sans">
				<div className="text-xs text-muted-foreground">回复给 @{item.authorName}</div>
				<textarea
					rows={2}
					placeholder="写下善意的回复..."
					className="w-full resize-none rounded-lg border border-input bg-card px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus-visible:border-ring"
				/>
				<div className="flex justify-end">
					<button
						type="button"
						className="inline-flex h-7 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground"
					>
						<Send className="size-3" />
						<span>发送</span>
					</button>
				</div>
			</div>
		),
		renderExpandedReplies: ({ knownReplies }) => (
			<ul className="space-y-2 pt-1 font-sans">
				{knownReplies.map((reply) => (
					<li
						key={reply.id}
						className="rounded-lg border border-border/50 bg-muted/30 p-3 text-xs"
					>
						<span className="font-medium text-foreground">{reply.authorName}</span>
						<p className="mt-1 text-muted-foreground">{reply.body}</p>
					</li>
				))}
			</ul>
		),
	};

	return (
		<div className="space-y-16 pb-24 font-sans">
			{/* 1. Header (对标 HeroUI) */}
			<div className="space-y-3">
				<div className="flex flex-wrap items-center justify-between gap-4">
					<h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
						CommentSection
					</h1>
					<button
						type="button"
						className="flex items-center gap-1.5 rounded-full border border-border/70 bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
					>
						<Copy className="size-3.5" />
						<span>Copy Markdown</span>
					</button>
				</div>

				<p className="text-base text-muted-foreground leading-relaxed">
					纯展示评论套件。抹平后端异构字段，支持双层扁平回复、身份视觉色阶与插槽机制。
				</p>

				{/* 快捷 Pill 链接 */}
				<div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-xs">
					<span className="flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-foreground">
						<GitBranch className="size-3 text-muted-foreground" />
						<span>Source</span>
					</span>
					<span className="flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-foreground">
						<FileCode2 className="size-3 text-muted-foreground" />
						<span>types.ts</span>
					</span>
					<span className="flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-foreground">
						<Component className="size-3 text-muted-foreground" />
						<span>Composite</span>
					</span>
				</div>
			</div>

			{/* 2. Usage */}
			<section aria-label="Usage" className="space-y-3">
				<h2 className="text-2xl font-bold tracking-tight text-foreground">Usage</h2>
				<div className="relative flex items-center justify-between rounded-xl border border-border/70 bg-muted/30 px-4 py-3 font-mono text-xs">
					<code className="text-foreground">{IMPORT_CODE}</code>
					<button
						type="button"
						onClick={handleCopy}
						className="text-muted-foreground transition-colors hover:text-foreground"
						title="复制代码"
					>
						{copied ? (
							<Check className="size-4 text-green-500" />
						) : (
							<Copy className="size-4" />
						)}
					</button>
				</div>
			</section>

			{/* 3. Examples */}
			<section aria-label="Examples" className="space-y-12">
				<h2 className="text-2xl font-bold tracking-tight text-foreground">Examples</h2>

				{/* 案例 1: Default */}
				<div className="space-y-3">
					<h3 className="text-lg font-bold tracking-tight text-foreground">Default</h3>
					<p className="text-sm text-muted-foreground">
						包含顶层表单插槽与双层扁平回复结构。子回复以 @
						昵称指示对象，不向内无限嵌套。
					</p>

					<HeroDemoBox code={BASIC_USAGE_CODE}>
						<CommentSection
							title={`全部评论 (${comments.length})`}
							form={
								<div className="flex items-start gap-3">
									<div
										aria-hidden="true"
										className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-wash font-mono text-xs font-bold text-brand-wash-foreground"
									>
										V
									</div>
									<div className="min-w-0 flex-1 rounded-lg border border-input bg-card px-3 py-2 text-xs text-muted-foreground">
										写下你的评论观点...
									</div>
									<button
										type="button"
										className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground"
									>
										<Send className="size-3" />
										<span>发表</span>
									</button>
								</div>
							}
							isLoggedIn={true}
						>
							<CommentList comments={comments} config={config} isLoggedIn={true} />
						</CommentSection>
					</HeroDemoBox>
				</div>

				{/* 案例 2: Empty State */}
				<div className="space-y-3">
					<h3 className="text-lg font-bold tracking-tight text-foreground">
						Empty State
					</h3>
					<p className="text-sm text-muted-foreground">
						当评论数据为空时，自动呈现自带的轻量空状态占位。
					</p>

					<HeroDemoBox code={EMPTY_STATE_CODE}>
						<CommentSection title="全部评论 (0)" form={null} isLoggedIn={true}>
							<CommentList comments={[]} config={config} isLoggedIn={true} />
						</CommentSection>
					</HeroDemoBox>
				</div>

				{/* 案例 3: Loading State */}
				<div className="space-y-3">
					<h3 className="text-lg font-bold tracking-tight text-foreground">
						Loading State
					</h3>
					<p className="text-sm text-muted-foreground">
						首屏加载期间传入 <code className="font-mono text-xs">isLoading</code>
						，自动渲染 Shimmer 骨架条目。
					</p>

					<HeroDemoBox code={LOADING_STATE_CODE}>
						<CommentSection title="全部评论" form={null} isLoggedIn={true}>
							<CommentList
								comments={[]}
								config={config}
								isLoggedIn={true}
								isLoading={true}
							/>
						</CommentSection>
					</HeroDemoBox>
				</div>
			</section>

			{/* 4. API Reference */}
			<section aria-label="API Reference" className="space-y-10">
				<h2 className="text-2xl font-bold tracking-tight text-foreground">API Reference</h2>
				<HeroApiTable title="CommentSection Props" rows={SECTION_PROPS} />
				<HeroApiTable title="CommentDisplayItem (Data Model)" rows={ITEM_FIELDS} />
				<HeroApiTable title="CommentSectionConfig (Adapter)" rows={CONFIG_FIELDS} />
			</section>
		</div>
	);
}
