import type { ArticleEmbedModule } from "@shared/ui/article-embeds";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertCircle, ArrowUpRight, Lock } from "lucide-react";
import { type ReactNode, Suspense, useRef, useState } from "react";
import { roadmapEmbedQueryOptions } from "../api/queries";
import { ROADMAP_STAGE_LABELS } from "../lib/roadmap-board";
import { checklistProgress } from "../lib/roadmap-checklist";
import type { RoadmapDetail, RoadmapItem } from "../model/roadmap";
import { ChecklistMeter } from "../ui/ChecklistMeter";
import { RoadmapItemDialog } from "../ui/RoadmapItemDialog";
import { RoadmapProgress } from "../ui/RoadmapProgress";
import { StageDot } from "../ui/StageDot";
import { parseRoadmapEmbed, type RoadmapEmbedConfig } from "./roadmap-embed-config";

const FOCUS =
	"rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/**
 * 嵌入卡片的外框：加载、不存在、出错与正常内容共用同一个框，
 * 文章里换了状态也不会跳动成别的形状。
 */
function EmbedFrame({
	variant,
	busy,
	children,
}: {
	variant: "item" | "project" | "notice";
	busy?: boolean;
	children: ReactNode;
}) {
	return (
		<figure
			data-roadmap-embed={variant}
			aria-busy={busy || undefined}
			className="not-prose my-6 rounded-2xl border border-border/70 bg-card p-5 text-foreground"
		>
			{children}
		</figure>
	);
}

function Notice({ children }: { children: ReactNode }) {
	return (
		<EmbedFrame variant="notice">
			<p className="flex items-center gap-2 text-sm text-muted-foreground">
				<AlertCircle className="size-4 shrink-0" aria-hidden="true" />
				{children}
			</p>
		</EmbedFrame>
	);
}

function Loading() {
	return (
		<EmbedFrame variant="notice" busy>
			<span className="sr-only">正在读取路线图</span>
			<span aria-hidden="true" className="block h-4 w-1/3 animate-pulse rounded bg-muted" />
			<span
				aria-hidden="true"
				className="mt-3 block h-3 w-2/3 animate-pulse rounded bg-muted"
			/>
		</EmbedFrame>
	);
}

/** 打开条目详情的状态；关闭后焦点还给点击的那个按钮。 */
function useItemDialog(detail: RoadmapDetail) {
	const [openId, setOpenId] = useState<string | null>(null);
	const last = useRef<RoadmapItem | null>(null);
	const opener = useRef<HTMLElement | null>(null);
	const open = openId ? (detail.items.find((item) => item.id === openId) ?? null) : null;
	if (open) last.current = open;
	return {
		show: (item: RoadmapItem, trigger: HTMLElement) => {
			opener.current = trigger;
			setOpenId(item.id);
		},
		dialog: (
			<RoadmapItemDialog
				item={open ?? last.current}
				items={detail.items}
				relations={detail.relations}
				open={open !== null}
				returnFocusTo={() => opener.current}
				onOpenChange={(next) => {
					if (!next) setOpenId(null);
				}}
			/>
		),
	};
}

function ProjectLink({ detail, children }: { detail: RoadmapDetail; children: ReactNode }) {
	return (
		<Link
			to="/projects/$slug"
			params={{ slug: detail.project.slug }}
			className={`inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-primary ${FOCUS}`}
		>
			{children}
			<ArrowUpRight className="size-3.5" aria-hidden="true" />
		</Link>
	);
}

/** 单个条目的卡片：阶段、标题、阻塞与标签、子项进度或交付信息；点开看只读详情。 */
function ItemCard({ detail, item }: { detail: RoadmapDetail; item: RoadmapItem }) {
	const { show, dialog } = useItemDialog(detail);
	const delivered = [item.delivered_version, item.completion_date].filter(Boolean).join(" · ");
	return (
		<EmbedFrame variant="item">
			<div className="flex items-center justify-between gap-4 text-xs text-muted-foreground">
				<span className="inline-flex items-center gap-2">
					<StageDot stage={item.stage} />
					{ROADMAP_STAGE_LABELS[item.stage]}
					<span className="font-mono">#{item.number}</span>
				</span>
				<ProjectLink detail={detail}>{detail.project.title}</ProjectLink>
			</div>
			<button
				type="button"
				aria-haspopup="dialog"
				onClick={(event) => show(item, event.currentTarget)}
				className={`mt-3 block w-full cursor-pointer text-left ${FOCUS}`}
			>
				<span className="block font-reading text-base leading-snug font-medium">
					{item.title}
				</span>
				{item.blocked || item.tags.length > 0 ? (
					<span className="mt-2.5 flex flex-wrap gap-1">
						{item.blocked ? (
							<span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 text-[11px] leading-5 text-destructive">
								<Lock className="size-3" aria-hidden="true" />
								被阻塞
							</span>
						) : null}
						{item.tags.map((tag) => (
							<span
								key={tag}
								className="rounded-full bg-muted px-2 text-[11px] leading-5 text-muted-foreground"
							>
								{tag}
							</span>
						))}
					</span>
				) : null}
				{delivered || item.checklist.length > 0 ? (
					<span className="mt-3 flex justify-end text-xs text-muted-foreground">
						{delivered ? (
							<span className="font-mono">{delivered}</span>
						) : (
							<ChecklistMeter progress={checklistProgress(item.checklist)} />
						)}
					</span>
				) : null}
			</button>
			{dialog}
		</EmbedFrame>
	);
}

/** 项目卡片：简介、进度概览、正在做的与最近完成的条目；条目可点开看只读详情。 */
function ProjectCard({ detail }: { detail: RoadmapDetail }) {
	const { show, dialog } = useItemDialog(detail);
	const now = detail.items.filter((item) => item.stage === "in_progress").slice(0, 3);
	const latest = detail.items.find((item) => item.stage === "completed");
	const entry = (item: RoadmapItem) => (
		<li key={item.id}>
			<button
				type="button"
				aria-haspopup="dialog"
				onClick={(event) => show(item, event.currentTarget)}
				className={`flex w-full cursor-pointer items-baseline gap-2 text-left text-sm hover:text-primary ${FOCUS}`}
			>
				<span className="font-mono text-xs text-muted-foreground">#{item.number}</span>
				<span className="min-w-0 flex-1 font-reading">{item.title}</span>
			</button>
		</li>
	);
	return (
		<EmbedFrame variant="project">
			<div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-5">
				<div className="min-w-0 flex-1 basis-60">
					<p className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground/60 uppercase">
						Roadmap
					</p>
					<p className="mt-1 text-xl font-normal tracking-[-0.01em]">
						{detail.project.title}
					</p>
					{detail.project.description ? (
						<p className="mt-2 line-clamp-2 font-reading text-sm text-muted-foreground">
							{detail.project.description}
						</p>
					) : null}
				</div>
				{detail.progress.total > 0 ? <RoadmapProgress progress={detail.progress} /> : null}
			</div>
			{now.length > 0 || latest ? (
				<div className="mt-5 grid gap-5 border-t border-border/60 pt-4 sm:grid-cols-2">
					{now.length > 0 ? (
						<section aria-label="现在在做" className="space-y-1.5">
							<h3 className="flex items-center gap-2 text-xs text-muted-foreground">
								<StageDot stage="in_progress" />
								现在在做
							</h3>
							<ul className="space-y-1">{now.map(entry)}</ul>
						</section>
					) : null}
					{latest ? (
						<section aria-label="最近完成" className="space-y-1.5">
							<h3 className="flex items-center gap-2 text-xs text-muted-foreground">
								<StageDot stage="completed" />
								最近完成
							</h3>
							<ul className="space-y-1">{entry(latest)}</ul>
						</section>
					) : null}
				</div>
			) : null}
			<div className="mt-4 flex justify-end">
				<ProjectLink detail={detail}>查看完整路线图</ProjectLink>
			</div>
			{dialog}
		</EmbedFrame>
	);
}

function RoadmapEmbedBody({ config }: { config: RoadmapEmbedConfig }) {
	const { data } = useSuspenseQuery(roadmapEmbedQueryOptions(config.project));
	if (data.status === "missing") return <Notice>项目「{config.project}」不存在或已删除</Notice>;
	if (data.status === "error") return <Notice>路线图暂时无法读取，请稍后刷新</Notice>;
	if (config.item === undefined) return <ProjectCard detail={data.detail} />;
	const item = data.detail.items.find((entry) => entry.number === config.item);
	if (!item)
		return (
			<Notice>
				{data.detail.project.title} 的条目 #{config.item} 不存在或已删除
			</Notice>
		);
	return <ItemCard detail={data.detail} item={item} />;
}

/** 文章里的 `roadmap` 卡片：读阅读时的当前公开数据，服务端渲染时直接输出内容。 */
function RoadmapEmbed({ config }: { config: RoadmapEmbedConfig }) {
	return (
		<Suspense fallback={<Loading />}>
			<RoadmapEmbedBody config={config} />
		</Suspense>
	);
}

export const roadmapEmbed: ArticleEmbedModule<RoadmapEmbedConfig> = {
	parse: parseRoadmapEmbed,
	Component: RoadmapEmbed,
};
