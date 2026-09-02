import { statusOf } from "@features/lab/announcement/model/event";
import { useAnnouncement } from "@features/settings/api/queries";
import { useArticleImagePreview } from "@shared/hooks/use-article-image-preview";
import { cn } from "@shared/lib/utils";
import { getAnnouncementSev } from "@shared/ui/announcement-severity";
import { BackLink } from "@shared/ui/back-link";
import { Button } from "@shared/ui/base/button";
import { FloatingBack } from "@shared/ui/floating-back";
import ArticleContent from "@shared/ui/markdown-preview/ArticleContent";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, Check, Copy } from "lucide-react";
import { useState } from "react";

/** 生命周期 → 状态行文案 */
const STATUS_LABEL: Record<string, string> = {
	active: "生效中",
	scheduled: "未生效",
	ended: "已收档",
};

/**
 * /announcements/$id - 公告详情页（article 形态）
 *
 * 2026-08-16 重做：对齐文章详情页的排版语言（容器 / BackLink /
 * 居中头部 / mono 大标题 / meta 行 / prose 正文），去掉圆角卡片壳
 * 与 react-bits 微交互——简报是阅读页，不是浮在页面上的组件。
 * 头部：标题 + meta 行（生效状态脉冲点 / 发布时间 / 生效窗口 /
 * 影响范围——标题已说明公告是什么，不再标 severity 分类）；footer 保留确认已读 /
 * 复制 ID 两个轻量动作。
 */

function AnnouncementDetailPage() {
	const { id } = Route.useParams();
	const { data: a, isLoading, error } = useAnnouncement(id);
	const [copied, setCopied] = useState(false);
	const [acked, setAcked] = useState(false);
	// 正文图片点击预览(与文章详情同一套:缩略占位 → 原图替换)
	const articleImages = useArticleImagePreview();

	const handleAck = () => {
		if (!a) return;
		try {
			const raw = localStorage.getItem("announcement:read-ids");
			const ids: number[] = raw ? JSON.parse(raw) : [];
			if (!ids.includes(a.id)) {
				ids.push(a.id);
				localStorage.setItem("announcement:read-ids", JSON.stringify(ids));
			}
		} catch {
			/* localStorage 不可用时静默 */
		}
		setAcked(true);
	};

	if (isLoading) {
		return (
			<div className="container mx-auto px-6 py-32">
				<div className="mx-auto h-64 max-w-2xl animate-pulse rounded-lg bg-muted" />
			</div>
		);
	}

	if (error || !a) {
		return (
			<div className="container mx-auto flex flex-col items-center px-6 py-32 text-center">
				<h1 className="mb-3 font-mono text-2xl font-bold">公告不存在</h1>
				<p className="mb-6 text-muted-foreground">该公告可能不存在或已失效。</p>
				<Button variant="outline" asChild>
					<a href="/">
						<ArrowLeft className="size-4" />
						返回首页
					</a>
				</Button>
			</div>
		);
	}

	const cfg = getAnnouncementSev(a.severity);
	const status = statusOf(a);
	const stamp = a.created_at.slice(0, 16).replace("T", " ");
	const body = a.content_html?.trim() ? a.content_html : a.content_md || a.content;

	const handleCopyId = async () => {
		try {
			await navigator.clipboard.writeText(String(a.id));
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		} catch {
			/* clipboard 不可用时静默 */
		}
	};

	return (
		<article className="container mx-auto px-6 py-16">
			<BackLink to="/" label="首页" className="mb-8" />
			<FloatingBack to="/" label="返回首页" />

			<header className="mx-auto mb-12 max-w-3xl">
				<h1 className="mb-3 font-mono text-4xl font-bold leading-tight tracking-tight md:text-5xl">
					{a.title}
				</h1>

				{/* 元信息：生效状态 + 发布时间 + 生效窗口 + 影响范围 */}
				<div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-sm text-muted-foreground">
					<span
						className={
							status === "scheduled"
								? "inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400"
								: "inline-flex items-center gap-1.5"
						}
					>
						{status === "active" ? (
							<span className={cn("size-1.5 animate-pulse rounded-full", cfg.dot)} />
						) : null}
						{STATUS_LABEL[status]}
					</span>
					<span>{stamp}</span>
					{a.start_time && a.end_time ? (
						<span>
							生效 {a.start_time.slice(0, 10)} → {a.end_time.slice(0, 10)}
						</span>
					) : null}
					{a.affects?.length ? <span>影响 {a.affects.join(" / ")}</span> : null}
				</div>
			</header>

			{body ? (
				<div
					className="prose prose-sm prose-neutral mx-auto max-w-3xl dark:prose-invert"
					data-article-content
					onClick={articleImages.bind.onClick}
					onKeyDown={articleImages.bind.onKeyDown}
				>
					<ArticleContent content={body} />
				</div>
			) : null}

			<footer className="mx-auto mt-12 flex max-w-3xl flex-wrap items-center gap-3 border-t border-edge-hairline pt-6">
				<Button
					variant="outline"
					size="sm"
					onClick={handleAck}
					disabled={acked}
					className="font-mono"
				>
					<Check className="size-3.5" />
					{acked ? "已读" : "确认已读"}
				</Button>
				<Button variant="outline" size="sm" onClick={handleCopyId} className="font-mono">
					{copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
					{copied ? "已复制" : `复制 ID · ${String(a.id).padStart(3, "0")}`}
				</Button>
			</footer>
			{articleImages.preview}
		</article>
	);
}

export const Route = createFileRoute("/announcements/$id")({
	component: AnnouncementDetailPage,
});
