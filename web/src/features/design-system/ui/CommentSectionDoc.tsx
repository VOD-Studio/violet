import { copyText } from "@shared/lib/clipboard";
import { CodeCard } from "@shared/ui/code-preview/components/CodeCard";
import { Check, Component, Copy, FileCode2, GitBranch } from "lucide-react";
import { useState } from "react";
import { ApiTable, type ApiTableColumn } from "./ApiTable";
import { CommentSectionBasicDemo } from "./examples/comment-section/basic";
import basicSource from "./examples/comment-section/basic.tsx?raw";
import { CommentSectionEmptyDemo } from "./examples/comment-section/empty-state";
import emptySource from "./examples/comment-section/empty-state.tsx?raw";
import { CommentSectionLoadingDemo } from "./examples/comment-section/loading-state";
import loadingSource from "./examples/comment-section/loading-state.tsx?raw";

const IMPORT_CODE = `import { CommentSection, CommentList } from "@shared/ui/comment-section";`;

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
		description: "左侧视觉色阶：author 呈主色高光，discussion 呈中性色",
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

/** 参数表标准四列：Prop 胶囊（必填星标）/ Type 徽标 / Default / 说明 */
const PROP_COLUMNS: ApiTableColumn<PropRow>[] = [
	{
		label: "Prop",
		headerClassName: "w-44",
		cellClassName: "font-mono font-medium text-foreground",
		render: (row) => (
			<div className="flex items-center gap-1.5">
				<code className="rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-foreground">
					{row.prop}
				</code>
				{row.required && (
					<span className="text-destructive font-mono text-xs" title="Required">
						*
					</span>
				)}
			</div>
		),
	},
	{
		label: "Type",
		headerClassName: "w-60",
		cellClassName: "font-mono text-muted-foreground",
		render: (row) => (
			<code className="inline-block rounded-md bg-muted/60 px-2 py-0.5 text-[11px] break-all">
				{row.type}
			</code>
		),
	},
	{
		label: "Default",
		headerClassName: "w-28",
		cellClassName: "font-mono text-muted-foreground",
		render: (row) =>
			row.defaultValue ? (
				<code className="rounded-md bg-muted/60 px-2 py-0.5 text-[11px]">
					{row.defaultValue}
				</code>
			) : (
				<span className="text-muted-foreground/40 text-xs">-</span>
			),
	},
	{
		label: "Description",
		headerClassName: "min-w-56",
		cellClassName: "text-muted-foreground leading-relaxed",
		render: (row) => row.description,
	},
];

/**
 * 评论区组件文档页（折叠面板式代码展开）。
 */
export function CommentSectionDocPage() {
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		const ok = await copyText(IMPORT_CODE);
		if (ok) {
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		}
	};

	return (
		<div className="mx-auto w-full max-w-4xl space-y-16 pb-24 font-sans">
			{/* 1. Header 标题区 */}
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

			{/* 2. 用法引入 */}
			<section aria-label="用法" className="space-y-3">
				<h2 className="text-xl font-bold tracking-tight text-foreground">用法</h2>
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

			{/* 3. 示例（折叠面板展开代码） */}
			<section aria-label="示例" className="space-y-14">
				<h2 className="text-2xl font-bold tracking-tight text-foreground">示例</h2>

				{/* 案例 1: 基础用法 */}
				<div className="space-y-3">
					<h3 className="text-lg font-bold tracking-tight text-foreground">基础用法</h3>
					<p className="text-sm text-muted-foreground">
						双层扁平回复结构。子回复以 @ 昵称指示对象，不向内无限嵌套。
					</p>

					<CodeCard code={basicSource} language="tsx" lineNumbers collapseLines={6}>
						<CommentSectionBasicDemo />
					</CodeCard>
				</div>

				{/* 案例 2: 空状态 */}
				<div className="space-y-3">
					<h3 className="text-lg font-bold tracking-tight text-foreground">空状态</h3>
					<p className="text-sm text-muted-foreground">
						当评论数据为空时，自动呈现轻量空状态占位。
					</p>

					<CodeCard code={emptySource} language="tsx" lineNumbers collapseLines={6}>
						<CommentSectionEmptyDemo />
					</CodeCard>
				</div>

				{/* 案例 3: 加载中 */}
				<div className="space-y-3">
					<h3 className="text-lg font-bold tracking-tight text-foreground">加载中</h3>
					<p className="text-sm text-muted-foreground">
						首屏加载期间传入 <code className="font-mono text-xs">isLoading</code>
						，自动渲染 Shimmer 骨架条目。
					</p>

					<CodeCard code={loadingSource} language="tsx" lineNumbers collapseLines={6}>
						<CommentSectionLoadingDemo />
					</CodeCard>
				</div>
			</section>

			{/* 4. API 参考 */}
			<section aria-label="API 参考" className="space-y-10">
				<h2 className="text-2xl font-bold tracking-tight text-foreground">API 参考</h2>
				<ApiTable
					title="CommentSection Props"
					columns={PROP_COLUMNS}
					rows={SECTION_PROPS}
					rowKey={(row) => row.prop}
				/>
				<ApiTable
					title="CommentDisplayItem (Data Model)"
					columns={PROP_COLUMNS}
					rows={ITEM_FIELDS}
					rowKey={(row) => row.prop}
				/>
				<ApiTable
					title="CommentSectionConfig (Adapter)"
					columns={PROP_COLUMNS}
					rows={CONFIG_FIELDS}
					rowKey={(row) => row.prop}
				/>
			</section>
		</div>
	);
}
