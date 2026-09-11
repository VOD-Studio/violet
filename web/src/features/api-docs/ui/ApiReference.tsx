import { Link } from "@tanstack/react-router";
import { ArrowUpRight, ChevronRight, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { cn } from "@/shared/lib/utils";

import { useOpenApiSpec } from "../api/useOpenApiSpec";
import { buildDocsModel, operationMatches } from "../lib/build-docs-model";
import type { DocChapter, DocsModel } from "../model/types";
import { OperationRow } from "./OperationRow";

interface ApiReferenceProps {
	/** dialog：弹窗内嵌（压缩留白、内边距交给纸壳）；page：独立页全幅 */
	variant: "page" | "dialog";
}

/**
 * API 文档渲染器：公开端点为正文、/admin 端点为折叠附录，
 * 关键字过滤命中 path/摘要/tag，附数据模型（schema）词汇表。
 */
export function ApiReference({ variant }: ApiReferenceProps) {
	const { data, isLoading, isError } = useOpenApiSpec();
	const [query, setQuery] = useState("");
	const model = useMemo(() => (data ? buildDocsModel(data) : null), [data]);

	if (isLoading) {
		return (
			<div className="py-16 text-center">
				<p className="font-mono text-xs tracking-[0.2em] text-muted-foreground/60 uppercase">
					正在载入运行时规范
				</p>
				<div className="mx-auto mt-4 h-px w-16 animate-pulse bg-primary/40" />
			</div>
		);
	}
	if (isError || !model) {
		return (
			<div className="border-l-2 border-destructive/60 py-2 pl-4">
				<p className="text-sm font-medium text-foreground">规范暂时不可用</p>
				<p className="mt-1 text-xs text-muted-foreground">
					未能读取运行时 OpenAPI，请稍后重试。
				</p>
			</div>
		);
	}

	const filtering = query.trim().length > 0;
	const isPage = variant === "page";
	const publicCount = model.chapters.reduce((sum, c) => sum + c.operations.length, 0);
	const adminCount = model.appendix.reduce((sum, c) => sum + c.operations.length, 0);

	return (
		<div className="text-foreground">
			<header className={cn(isPage ? "pb-8" : "pr-10 pb-4 sm:pr-14")}>
				{/* 标题单行：衬线正体 + 版本 + 编目统计；弹窗追加独立页入口 */}
				<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
					{isPage ? (
						<h1 className="font-serif text-4xl leading-[1.12] font-normal tracking-[-0.03em] sm:text-5xl">
							{model.title}
						</h1>
					) : (
						<h2 className="font-serif text-xl leading-tight font-normal tracking-[-0.01em] sm:text-2xl">
							{model.title}
						</h2>
					)}
					{model.version ? (
						<span className="font-mono text-xs text-muted-foreground/60">
							v{model.version.replace(/^v/, "")}
						</span>
					) : null}
					<span className="ml-auto font-mono text-[11px] text-muted-foreground/70 tabular-nums">
						{publicCount} 公开 · {adminCount} 管理 · {Object.keys(model.schemas).length}{" "}
						模型
					</span>
					{variant === "dialog" && (
						<Link
							to="/docs"
							className="inline-flex items-center gap-0.5 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
						>
							独立页
							<ArrowUpRight className="size-3.5" />
						</Link>
					)}
				</div>

				{/* 描述仅独立页保留：弹窗空间留给正文 */}
				{isPage && model.description ? (
					<p className="mt-4 max-w-2xl font-serif text-sm leading-relaxed text-muted-foreground sm:text-base">
						{model.description}
					</p>
				) : null}
			</header>

			{/* 弹窗内检索条 sticky 常驻：长列表滚动中随时可过滤 */}
			<div
				className={cn(
					variant === "dialog" &&
						"sticky top-0 z-10 -mx-6 border-b border-border/40 bg-card px-6 py-2.5 sm:-mx-10 sm:px-10 lg:-mx-12 lg:px-12",
				)}
			>
				<label
					className={cn(
						"flex items-center gap-3 border-b border-border/70 pb-2.5 transition-colors focus-within:border-primary/60",
						variant === "dialog" && "pr-10 sm:pr-12",
					)}
				>
					<Search className="size-4 shrink-0 text-muted-foreground/50" />
					<input
						type="search"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="过滤端点、摘要或标签……"
						className="w-full bg-transparent font-mono text-sm outline-none placeholder:text-muted-foreground/45"
					/>
					{filtering ? (
						<span className="shrink-0 font-mono text-[11px] text-muted-foreground/70 tabular-nums">
							{countMatches(model, query)}
						</span>
					) : null}
				</label>
			</div>

			<main className={cn("mt-7 space-y-9", isPage && "sm:space-y-10")}>
				{model.chapters.map((chapter, index) => (
					<ChapterSection
						key={chapter.tag}
						chapter={chapter}
						query={query}
						model={model}
						marker={String(index + 1).padStart(2, "0")}
					/>
				))}

				<AppendixSection model={model} query={query} filtering={filtering} />
			</main>
		</div>
	);
}

function ChapterSection({
	chapter,
	query,
	marker,
	model,
}: {
	chapter: DocChapter;
	query: string;
	marker: string;
	model: DocsModel;
}) {
	const operations = chapter.operations.filter((op) => operationMatches(op, chapter.tag, query));
	if (operations.length === 0) return null;
	return (
		<section aria-label={chapter.tag}>
			<header className="flex items-baseline gap-3 border-b border-border/60 pb-2">
				<span className="font-mono text-xs font-semibold tracking-wider text-primary tabular-nums">
					{marker}
				</span>
				<h3 className="font-serif text-lg font-medium tracking-tight">{chapter.tag}</h3>
				<span className="ml-auto font-mono text-[11px] text-muted-foreground/60 tabular-nums">
					{operations.length} 端点
				</span>
			</header>
			<div className="divide-y divide-border/30">
				{operations.map((op) => (
					<OperationRow key={op.id} op={op} schemas={model.schemas} />
				))}
			</div>
		</section>
	);
}

function AppendixSection({
	model,
	query,
	filtering,
}: {
	model: DocsModel;
	query: string;
	filtering: boolean;
}) {
	const [open, setOpen] = useState(false);
	const visible = filtering || open;
	const total = model.appendix.reduce((n, c) => n + c.operations.length, 0);
	if (total === 0) return null;
	return (
		<section aria-label="附录">
			<header className="border-b border-border/60 pb-2">
				<button
					type="button"
					onClick={() => setOpen((v) => !v)}
					aria-expanded={visible}
					className="group flex w-full items-baseline gap-3 text-left"
				>
					<ChevronRight
						className={cn(
							"size-4 self-center text-muted-foreground/50 transition-transform duration-200",
							visible && "rotate-90",
						)}
					/>
					<span className="font-mono text-xs font-semibold tracking-wider text-primary">
						A
					</span>
					<h3 className="font-serif text-lg font-medium tracking-tight">
						附录 · 管理端点
					</h3>
					<span className="ml-auto font-mono text-[11px] text-muted-foreground/60 tabular-nums">
						{total} 端点 · {visible ? "点击收起" : "默认折叠"}
					</span>
				</button>
			</header>
			{visible ? (
				<div className="mt-6 space-y-9 sm:space-y-10">
					{model.appendix.map((chapter, index) => (
						<ChapterSection
							key={chapter.tag}
							chapter={chapter}
							query={query}
							model={model}
							marker={`A${index + 1}`}
						/>
					))}
				</div>
			) : null}
		</section>
	);
}

function countMatches(model: DocsModel, query: string): number {
	let n = 0;
	for (const chapter of [...model.chapters, ...model.appendix]) {
		n += chapter.operations.filter((op) => operationMatches(op, chapter.tag, query)).length;
	}
	return n;
}
