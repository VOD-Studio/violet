import { cn } from "@shared/lib/utils";
import { ChevronLeft, ChevronRight, Play, X } from "lucide-react";
import { useCallback, useEffect } from "react";
import type { MockItem } from "../model/mock";

interface LightboxProps {
	items: MockItem[];
	index: number;
	onIndexChange: (i: number) => void;
	onClose: () => void;
}

/**
 * 灯箱方向 A · 全屏黑底逐张
 *
 * 经典沉浸形态：黑底、居中大图、键盘 ←/→ 导航、caption 压底部。
 * 视频项直接内嵌 controls 播放。共享键盘导航逻辑抽 useLightboxNav。
 */
export function LightboxImmersive({ items, index, onIndexChange, onClose }: LightboxProps) {
	const { prev, next } = useLightboxNav(items.length, index, onIndexChange, onClose);
	const it = items[index];
	return (
		<div className="relative flex size-full flex-col bg-black/95">
			<button
				type="button"
				onClick={onClose}
				aria-label="关闭"
				className="absolute top-4 end-4 z-10 rounded-full bg-white/10 p-2 text-white/80 hover:bg-white/20"
			>
				<X className="size-5" />
			</button>
			<div className="flex min-h-0 flex-1 items-center justify-center p-6">
				<LightboxMedia item={it} className="max-h-full max-w-full" />
			</div>
			<div className="flex items-center justify-between gap-4 px-6 pb-5">
				<button
					type="button"
					onClick={prev}
					aria-label="上一张"
					className="rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white"
				>
					<ChevronLeft className="size-6" />
				</button>
				<p className="min-w-0 flex-1 truncate text-center text-sm text-white/70">
					{it.caption ?? ""}
					<span className="ml-3 font-mono text-xs text-white/40">
						{index + 1} / {items.length}
					</span>
				</p>
				<button
					type="button"
					onClick={next}
					aria-label="下一张"
					className="rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white"
				>
					<ChevronRight className="size-6" />
				</button>
			</div>
		</div>
	);
}

/**
 * 灯箱方向 B · 信息侧栏
 *
 * 图 + 右侧信息栏：caption 全文、序号、视频说明有足够排版空间，
 * 适合 caption 即内容（教程步骤图）的图集。
 */
export function LightboxSidebar({ items, index, onIndexChange, onClose }: LightboxProps) {
	const { prev, next } = useLightboxNav(items.length, index, onIndexChange, onClose);
	const it = items[index];
	return (
		<div className="flex size-full bg-background">
			<div className="relative flex min-w-0 flex-1 items-center justify-center bg-black/90">
				<LightboxMedia item={it} className="max-h-full max-w-full" />
				<button
					type="button"
					onClick={prev}
					aria-label="上一张"
					className="absolute start-3 rounded-full bg-white/10 p-2 text-white/70 hover:bg-white/20"
				>
					<ChevronLeft className="size-5" />
				</button>
				<button
					type="button"
					onClick={next}
					aria-label="下一张"
					className="absolute end-3 rounded-full bg-white/10 p-2 text-white/70 hover:bg-white/20"
				>
					<ChevronRight className="size-5" />
				</button>
			</div>
			<aside className="flex w-72 shrink-0 flex-col justify-between border-l border-edge-hairline p-5">
				<div>
					<p className="font-mono text-xs text-muted-foreground">
						{String(index + 1).padStart(2, "0")} / {items.length}
						{it.isVideo ? <span className="ml-2 text-primary">视频</span> : null}
					</p>
					<p className="mt-4 text-sm leading-relaxed">{it.caption ?? "（无说明）"}</p>
				</div>
				<button
					type="button"
					onClick={onClose}
					className="self-start rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
				>
					关闭（Esc）
				</button>
			</aside>
		</div>
	);
}

/**
 * 灯箱方向 C · 缩略图条
 *
 * 底部缩略图导航条（对标 shared ImagePreview 的形态）：大图 + 可扫览
 * 的缩略条，长图集跳转效率最高；与生产 ImagePreview 的差异主要在
 * 视频项与 caption 场景。
 */
export function LightboxThumbstrip({ items, index, onIndexChange, onClose }: LightboxProps) {
	const { prev, next } = useLightboxNav(items.length, index, onIndexChange, onClose);
	const it = items[index];
	return (
		<div className="flex size-full flex-col bg-black/95">
			<div className="flex min-h-0 flex-1 items-center justify-center px-16 py-6">
				<LightboxMedia item={it} className="max-h-full max-w-full" />
			</div>
			<p className="truncate px-6 pb-2 text-center text-sm text-white/70">
				{it.caption ?? ""}
				<span className="ml-3 font-mono text-xs text-white/40">
					{index + 1} / {items.length}
				</span>
			</p>
			<div className="flex items-center gap-2 overflow-x-auto px-4 pb-4">
				{items.map((t, i) => (
					<button
						key={t.id}
						type="button"
						onClick={() => onIndexChange(i)}
						className={cn(
							"relative h-14 shrink-0 overflow-hidden rounded-sm transition-opacity",
							i === index ? "ring-2 ring-white" : "opacity-50 hover:opacity-80",
						)}
					>
						<img
							src={t.url}
							alt=""
							loading="lazy"
							className="h-full w-auto object-cover"
						/>
						{t.isVideo ? (
							<span className="absolute inset-0 flex items-center justify-center bg-black/30">
								<Play className="size-3 text-white" />
							</span>
						) : null}
					</button>
				))}
			</div>
			<button
				type="button"
				onClick={prev}
				aria-label="上一张"
				className="absolute start-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white/70 hover:bg-white/20"
			>
				<ChevronLeft className="size-5" />
			</button>
			<button
				type="button"
				onClick={next}
				aria-label="下一张"
				className="absolute end-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white/70 hover:bg-white/20"
			>
				<ChevronRight className="size-5" />
			</button>
			<button
				type="button"
				onClick={onClose}
				aria-label="关闭"
				className="absolute top-4 end-4 rounded-full bg-white/10 p-2 text-white/80 hover:bg-white/20"
			>
				<X className="size-5" />
			</button>
		</div>
	);
}

/** 媒体渲染：视频项内嵌播放，图片按原始比例 contain。 */
function LightboxMedia({ item, className }: { item: MockItem; className?: string }) {
	if (item.isVideo && item.videoUrl) {
		return (
			<div className={cn("relative flex items-center justify-center", className)}>
				<video
					src={item.videoUrl}
					poster={item.url}
					controls
					playsInline
					className="max-h-full max-w-full"
				>
					<track kind="captions" srcLang="zh" label="中文字幕" />
				</video>
			</div>
		);
	}
	return (
		<img src={item.url} alt={item.caption ?? ""} className={cn("object-contain", className)} />
	);
}

/** 键盘导航 + Esc 关闭（三方向共用）。 */
function useLightboxNav(
	count: number,
	index: number,
	onIndex: (i: number) => void,
	onClose: () => void,
) {
	const prev = useCallback(() => onIndex((index - 1 + count) % count), [index, count, onIndex]);
	const next = useCallback(() => onIndex((index + 1) % count), [index, count, onIndex]);
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "ArrowLeft") prev();
			if (e.key === "ArrowRight") next();
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [prev, next, onClose]);
	return { prev, next };
}
