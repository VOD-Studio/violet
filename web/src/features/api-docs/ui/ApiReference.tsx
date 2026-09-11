import { Link } from "@tanstack/react-router";
import { ChevronRight, Search } from "lucide-react";
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
			<div className="space-y-6 py-16 text-center">
				<p className="font-serif text-sm text-paper-muted">正在铺开文档……</p>
				<div className="mx-auto h-px w-24 animate-pulse bg-paper-border" />
			</div>
		);
	}
	if (isError || !model) {
		return (
			<div className="py-16 text-center">
				<p className="font-serif text-sm text-paper-muted">文档暂不可用，稍后再试。</p>
			</div>
		);
	}

	const filtering = query.trim().length > 0;

	return (
		<div className={cn("text-paper-foreground", variant === "page" && "pb-20")}>
			<header
				className={cn("space-y-4", variant === "page" ? "pb-8" : "pb-5 pr-10 sm:pr-12")}
			>
				<div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
					<h2 className="font-serif text-2xl font-semibold tracking-tight">
						{model.title}
					</h2>
					<span className="font-mono text-xs text-paper-muted">
						{model.version ? `v${model.version.replace(/^v/, "")}` : ""}
					</span>
					{variant === "dialog" && (
						<Link
							to="/docs"
							className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 font-mono text-[11px] text-paper-muted/80 transition-colors hover:text-paper-foreground"
						>
							<span>独立页 ↗</span>
						</Link>
					)}
					<span className="ml-auto font-mono text-[11px] text-paper-muted/80">
						{model.chapters.reduce((n, c) => n + c.operations.length, 0)} 公开 ·{" "}
						{model.appendix.reduce((n, c) => n + c.operations.length, 0)} 管理 ·{" "}
						{Object.keys(model.schemas).length} 模型
					</span>
				</div>
				{model.description ? (
					<p className="max-w-prose font-serif text-xs leading-relaxed text-paper-muted">
						{model.description}
					</p>
				) : null}
				<label className="flex items-center gap-2.5 border-b border-paper-border pb-2.5">
					<Search className="size-4 shrink-0 text-paper-muted/70" />
					<input
						type="search"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="过滤端点、摘要或标签……"
						className="w-full bg-transparent font-mono text-sm text-paper-foreground outline-none placeholder:text-paper-muted/60"
					/>
					{filtering ? (
						<span className="shrink-0 font-mono text-[11px] text-paper-muted">
							{countMatches(model, query)}
						</span>
					) : null}
				</label>
			</header>

			<main className="space-y-10">
				{model.chapters.map((chapter) => (
					<ChapterSection
						key={chapter.tag}
						chapter={chapter}
						query={query}
						forceOpen={filtering}
						model={model}
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
	forceOpen,
	model,
}: {
	chapter: DocChapter;
	query: string;
	forceOpen: boolean;
	model: DocsModel;
}) {
	const operations = chapter.operations.filter((op) => operationMatches(op, chapter.tag, query));
	if (operations.length === 0) return null;
	return (
		<section aria-label={chapter.tag}>
			<header className="flex items-baseline gap-3 border-b border-paper-border pb-2">
				<h3 className="font-serif text-base font-semibold tracking-wide">{chapter.tag}</h3>
				<span className="font-mono text-[11px] text-paper-muted/80">
					{operations.length} 端点
				</span>
			</header>
			<div className={cn(forceOpen && "mt-1")}>
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
			<header className="border-b border-paper-border pb-2">
				<button
					type="button"
					onClick={() => setOpen((v) => !v)}
					aria-expanded={visible}
					className="group flex w-full items-baseline gap-3 text-left"
				>
					<ChevronRight
						className={cn(
							"size-4 self-center text-paper-muted/70 transition-transform duration-200",
							visible && "rotate-90",
						)}
					/>
					<h3 className="font-serif text-base font-semibold tracking-wide">
						附录 · 管理端点
					</h3>
					<span className="font-mono text-[11px] text-paper-muted/80">{total} 端点</span>
					<span className="ml-auto hidden font-serif text-xs text-paper-muted/70 sm:inline">
						{visible ? "面向站长" : "默认折叠"}
					</span>
				</button>
			</header>
			{visible ? (
				<div className="mt-4 space-y-8">
					{model.appendix.map((chapter) => (
						<ChapterSection
							key={chapter.tag}
							chapter={chapter}
							query={query}
							forceOpen={filtering}
							model={model}
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
