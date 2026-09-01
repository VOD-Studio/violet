/**
 * FilePreview - 文件预览主分发器
 *
 * 按文件类型（MIME + 扩展名）路由到对应的预览套件：
 * - 图片 → FilePreviewImage（file-preview 套件内，静态加载）
 * - 视频 → VideoPreview（video-preview 套件，懒加载）
 * - 音频 → AudioPreview（audio-preview 套件，懒加载）
 * - PDF → PdfPreview（pdf-preview 套件，懒加载）
 * - Word .docx → DocxPreview（docx-preview 套件，懒加载）
 * - Excel .xlsx → SpreadsheetPreview（spreadsheet-preview 套件，懒加载）
 * - 压缩包 → ArchivePreview（archive-preview 套件，懒加载）
 * - 代码 → CodePreview（code-preview 套件，懒加载）
 * - Markdown → MarkdownPreview（markdown-preview 套件，懒加载）
 *
 * 体积优化：除图片/占位外的预览套件均用 React.lazy 懒加载，
 * 避免素材页首屏打包 wavesurfer/react-pdf/xlsx 等大体积库。
 *
 * 不可靠预览类型（PPTX 演示文稿、老式 .doc 二进制、RAR/7z、加密 Office）
 * → FilePlaceholder 下载占位。
 */

import { Loader2 } from "lucide-react";
import { lazy, Suspense } from "react";
import { cn } from "@/shared/lib/utils";
import { FilePreviewVariantContext } from "../file-preview-context";
import type { FilePreviewComponentProps } from "../types/file-preview-types";
import { type FileKind, getFileKind } from "../utils/mime-utils";
import { ContentImage } from "./ContentImage";
import { FilePlaceholder } from "./FilePlaceholder";

// 懒加载各预览套件（按需加载，避免首屏打包大体积库）
const VideoPreview = lazy(() =>
	import("@/shared/ui/video-preview").then((m) => ({ default: m.VideoPreview })),
);
const AudioPreview = lazy(() =>
	import("@/shared/ui/audio-preview").then((m) => ({ default: m.AudioPreview })),
);
const PdfPreview = lazy(() =>
	import("@/shared/ui/pdf-preview").then((m) => ({ default: m.PdfPreview })),
);
const DocxPreview = lazy(() =>
	import("@/shared/ui/docx-preview").then((m) => ({ default: m.DocxPreview })),
);
const SpreadsheetPreview = lazy(() =>
	import("@/shared/ui/spreadsheet-preview").then((m) => ({ default: m.SpreadsheetPreview })),
);
const ArchivePreview = lazy(() =>
	import("@/shared/ui/archive-preview").then((m) => ({ default: m.ArchivePreview })),
);
const CodePreview = lazy(() =>
	import("@/shared/ui/code-preview").then((m) => ({ default: m.CodePreview })),
);
const MarkdownPreview = lazy(() =>
	import("@/shared/ui/markdown-preview").then((m) => ({ default: m.MarkdownPreview })),
);

/** 懒加载预览的加载占位 */
function PreviewFallback() {
	return (
		<div className="flex h-40 items-center justify-center">
			<Loader2 className="size-6 animate-spin text-muted-foreground" />
		</div>
	);
}

function getViewerRendererClass(kind: FileKind): string {
	switch (kind) {
		case "image":
			return "h-full min-h-0 bg-transparent [&_button]:flex [&_button]:items-center [&_button]:justify-center [&_img]:h-auto [&_img]:max-h-[calc(100dvh-9rem)] [&_img]:w-auto [&_img]:max-w-full";
		case "video":
			return "aspect-video h-auto max-h-full w-full rounded-none border-0";
		case "audio":
			return "h-full justify-center rounded-none border-0 bg-transparent";
		case "pdf":
			return "h-full max-h-full rounded-none border-0";
		case "docx":
		case "spreadsheet":
		case "archive":
		case "markdown":
			return "h-full max-h-full rounded-none border-0";
		case "code":
			return "h-full max-h-full rounded-none border-0";
		default:
			return "h-full";
	}
}

export function FilePreview({
	url,
	thumbnailUrl,
	mimeType,
	name,
	size,
	showInfo = true,
	variant = "inline",
	className,
	delay = 0,
	unframed = false,
	onImageClick,
	ref,
}: FilePreviewComponentProps) {
	const kind = getFileKind(mimeType, name);
	const viewer = variant === "viewer";
	const rendererClassName = viewer ? getViewerRendererClass(kind) : undefined;

	function renderPreview() {
		switch (kind) {
			case "image":
				return (
					<ContentImage
						url={url}
						thumbnailUrl={thumbnailUrl}
						name={name}
						delay={delay}
						className={rendererClassName}
						onImageClick={onImageClick}
					/>
				);
			case "video":
				return (
					<VideoPreview
						url={url}
						mimeType={mimeType}
						name={name}
						metadata={!viewer && size !== undefined ? { size } : undefined}
						className={rendererClassName}
					/>
				);
			case "audio":
				return (
					<AudioPreview
						url={url}
						mimeType={mimeType}
						name={name}
						className={rendererClassName}
					/>
				);
			case "pdf":
				return <PdfPreview url={url} name={name} className={rendererClassName} />;
			case "docx":
				return <DocxPreview url={url} name={name} className={rendererClassName} />;
			case "spreadsheet":
				return <SpreadsheetPreview url={url} name={name} className={rendererClassName} />;
			case "archive":
				return (
					<ArchivePreview
						url={url}
						name={name}
						mimeType={mimeType}
						className={rendererClassName}
					/>
				);
			case "markdown":
				return <MarkdownPreview url={url} name={name} className={rendererClassName} />;
			case "code":
				return <CodePreview url={url} name={name} className={rendererClassName} />;
			// presentation(PPTX 演示文稿)：纯前端无法高保真预览，走占位
			case "presentation":
				return (
					<FilePlaceholder
						url={url}
						name={name}
						mimeType={mimeType}
						hint="演示文稿暂不支持在线预览，请下载查看"
						className={rendererClassName}
					/>
				);
			// 老式 .doc/text/other → 占位下载
			default:
				return (
					<FilePlaceholder
						url={url}
						name={name}
						mimeType={mimeType}
						hint="此格式暂不支持在线预览"
						className={rendererClassName}
					/>
				);
		}
	}

	return (
		<FilePreviewVariantContext.Provider value={variant}>
			<div
				data-file-preview-variant={variant}
				className={cn(viewer ? "h-full min-h-0 w-full" : "space-y-3", className)}
				ref={ref}
			>
				<div
					className={cn(
						"overflow-hidden",
						viewer && "h-full min-h-0",
						!viewer && !unframed && "rounded-lg border bg-background",
					)}
				>
					<Suspense fallback={<PreviewFallback />}>{renderPreview()}</Suspense>
				</div>

				{!viewer && showInfo && name ? (
					<div className="flex items-center justify-between px-1 text-sm text-muted-foreground">
						<span className="truncate">{name}</span>
						{size !== undefined ? (
							<span className="ml-2 shrink-0">{formatSizeInline(size)}</span>
						) : null}
					</div>
				) : null}
			</div>
		</FilePreviewVariantContext.Provider>
	);
}

/** 内联文件大小格式化（信息条用） */
function formatSizeInline(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type { FilePreviewProps } from "../types/file-preview-types";
export default FilePreview;
