import { FilePreview } from "@shared/ui/file-preview";
import { ImagePreview } from "@shared/ui/image-preview";
import { Modal } from "@shared/ui/modal";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/shared/lib/utils";
import { formatMediaSize, isImmersiveMedia, reservesArrowKeys } from "./media-viewer-utils";
import type { MediaViewerProps } from "./types";

interface FullscreenImage {
	url: string;
	thumbnail: string | null;
	triggerRect: DOMRect | null;
	naturalSize: { w: number; h: number } | null;
}

const controlClassName =
	"inline-flex size-9 shrink-0 items-center justify-center rounded-md text-white/70 transition-[background-color,color,transform] hover:bg-white/10 hover:text-white active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:pointer-events-none disabled:opacity-25";

/** 通用媒体查看器：统一文件 chrome，并把格式渲染委托给 FilePreview。 */
export function MediaViewer({
	open,
	onOpenChange,
	items,
	index,
	onIndexChange,
	triggerElement,
}: MediaViewerProps) {
	const safeIndex = Math.min(Math.max(index, 0), Math.max(items.length - 1, 0));
	const item = items[safeIndex];
	const [fullscreen, setFullscreen] = useState<FullscreenImage | null>(null);
	const [fullscreenOpen, setFullscreenOpen] = useState(false);
	const fullscreenActiveRef = useRef(false);
	const wasOpenRef = useRef(open);
	const triggerRef = useRef<HTMLElement | null>(triggerElement ?? null);
	if (open) triggerRef.current = triggerElement ?? null;
	fullscreenActiveRef.current = fullscreenOpen || fullscreen !== null;

	useEffect(() => {
		if (wasOpenRef.current && !open) {
			const trigger = triggerRef.current;
			queueMicrotask(() => trigger?.focus());
		}
		wasOpenRef.current = open;
	}, [open]);

	const goPrevious = useCallback(() => {
		if (safeIndex > 0) onIndexChange(safeIndex - 1);
	}, [onIndexChange, safeIndex]);
	const goNext = useCallback(() => {
		if (safeIndex < items.length - 1) onIndexChange(safeIndex + 1);
	}, [items.length, onIndexChange, safeIndex]);

	useEffect(() => {
		if (!open || !item || reservesArrowKeys(item.mimeType)) return;
		const handleKeyDown = (event: KeyboardEvent) => {
			if (fullscreenActiveRef.current) return;
			if (event.key === "ArrowLeft" && safeIndex > 0) {
				event.preventDefault();
				goPrevious();
			}
			if (event.key === "ArrowRight" && safeIndex < items.length - 1) {
				event.preventDefault();
				goNext();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [goNext, goPrevious, item, items.length, open, safeIndex]);

	const openFullscreen = useCallback(
		(url: string, trigger?: HTMLElement | null, thumbnail?: string) => {
			const naturalSize =
				trigger instanceof HTMLImageElement && trigger.naturalWidth > 0
					? { w: trigger.naturalWidth, h: trigger.naturalHeight }
					: null;
			setFullscreen({
				url,
				thumbnail: thumbnail ?? null,
				triggerRect: trigger ? trigger.getBoundingClientRect() : null,
				naturalSize,
			});
			setFullscreenOpen(true);
		},
		[],
	);
	const blockDialogDismiss = useCallback((event: Event) => {
		if (fullscreenActiveRef.current) event.preventDefault();
	}, []);

	if (!item) return null;

	const sizeLabel = formatMediaSize(item.size);
	const immersive = isImmersiveMedia(item.mimeType);
	const isVideo = item.mimeType.startsWith("video/");
	const isAudio = item.mimeType.startsWith("audio/");

	return (
		<>
			<Modal
				open={open}
				onOpenChange={onOpenChange}
				title={item.name}
				titleSrOnly
				showCloseButton={false}
				footer={null}
				unstyled
				onEscapeKeyDown={blockDialogDismiss}
				onInteractOutside={blockDialogDismiss}
				className={cn(
					"h-[min(88dvh,48rem)] max-h-[calc(100dvh-1rem)] max-w-[calc(100vw-1rem)] gap-0 rounded-xl border border-white/10 bg-[#111318] shadow-2xl sm:max-w-[min(94vw,72rem)]",
				)}
			>
				<section className="flex h-full min-h-0 flex-col" aria-label="媒体查看器">
					<header className="flex min-h-14 shrink-0 items-center gap-2 border-white/10 border-b bg-[#111318] px-2.5 py-2 text-white sm:gap-3 sm:px-4">
						<div className="min-w-0 flex-1">
							<h2 className="truncate font-medium text-sm tracking-tight sm:text-base">
								{item.name}
							</h2>
							<p className="mt-0.5 truncate text-[11px] text-white/45 sm:text-xs">
								{item.mimeType}
								{sizeLabel ? ` · ${sizeLabel}` : ""}
							</p>
						</div>

						<nav
							className="flex shrink-0 items-center gap-0.5"
							aria-label="媒体查看控制"
						>
							<span className="mr-1 hidden min-w-12 text-center font-mono text-white/50 text-xs tabular-nums min-[420px]:inline">
								{safeIndex + 1} / {items.length}
							</span>
							<button
								type="button"
								className={controlClassName}
								disabled={safeIndex === 0}
								onClick={goPrevious}
								aria-label="上一个"
							>
								<ChevronLeft className="size-5" />
							</button>
							<button
								type="button"
								className={controlClassName}
								disabled={safeIndex === items.length - 1}
								onClick={goNext}
								aria-label="下一个"
							>
								<ChevronRight className="size-5" />
							</button>
							<a
								href={item.url}
								download={item.name}
								className={controlClassName}
								aria-label={`下载 ${item.name}`}
							>
								<Download className="size-4" />
							</a>
							<button
								type="button"
								className={controlClassName}
								onClick={() => onOpenChange(false)}
								aria-label="关闭查看器"
							>
								<X className="size-5" />
							</button>
						</nav>
					</header>

					<main
						className={cn(
							"min-h-0 flex-1",
							isVideo && "flex items-center justify-center overflow-hidden bg-black",
							isAudio && "overflow-hidden bg-[#0b0d11]",
							immersive && !isVideo && !isAudio && "overflow-hidden bg-[#080a0d]",
							!immersive &&
								"overflow-auto bg-[#e7e8eb] p-2 text-foreground sm:p-4 dark:bg-[#181a1f]",
						)}
					>
						<FilePreview
							key={item.id}
							url={item.url}
							thumbnailUrl={item.thumbnailUrl}
							mimeType={item.mimeType}
							name={item.name}
							size={item.size}
							variant="viewer"
							onImageClick={openFullscreen}
						/>
					</main>
				</section>
			</Modal>

			{fullscreen ? (
				<ImagePreview
					open={fullscreenOpen}
					onClose={() => setFullscreenOpen(false)}
					onExitComplete={() => setFullscreen(null)}
					images={[fullscreen.url]}
					thumbnails={fullscreen.thumbnail ? [fullscreen.thumbnail] : undefined}
					triggerRect={fullscreen.triggerRect}
					initialNaturalSize={fullscreen.naturalSize}
				/>
			) : null}
		</>
	);
}
