import { COVER_ASPECT, COVER_FRAME_CLASS } from "@shared/lib/profile-cover";
import { CroppedImage } from "@shared/ui/image-cropper/CroppedImage";
import { cn } from "cn";
import { useEffect, useRef, useState } from "react";

export interface UserProfileCoverProps {
	/** 未设置自定义封面时，用头像生成模糊背景。 */
	avatarSrc?: string;
	/** 保留 GIF 裁剪坐标的自定义封面地址。 */
	coverSrc?: string;
	className?: string;
}

/** 图层比展示框宽出的比例；水平方向的可移动余量来自这里。 */
const OVERSCAN = 1.08;
/** 缓动速率（1/秒）：越大跟得越紧，约 6 时有明显的「拖尾」。 */
const FOLLOW_RATE = 6;
/** 实际移动量占余量的比例，留出边缘不穿帮的余地。 */
const TRAVEL = 0.92;

/**
 * 带阻尼的指针跟随：鼠标在封面内移动，图层向相反方向缓动，露出更多画面；
 * 指针离开后缓缓回中。触屏与「减少动态」下不启用。
 */
function useDampedParallax(
	frame: React.RefObject<HTMLElement | null>,
	layer: React.RefObject<HTMLElement | null>,
	enabled: boolean,
) {
	useEffect(() => {
		const frameEl = frame.current;
		const layerEl = layer.current;
		if (!enabled || !frameEl || !layerEl) return;
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

		const target = { x: 0, y: 0 };
		const current = { x: 0, y: 0 };
		let raf = 0;
		let last = 0;

		const apply = () => {
			const spareX = (layerEl.offsetWidth - frameEl.clientWidth) / 2;
			const spareY = (layerEl.offsetHeight - frameEl.clientHeight) / 2;
			// 向相反方向移动：鼠标往右，画面往左，露出右侧内容
			const tx = -current.x * Math.max(0, spareX) * TRAVEL;
			const ty = -current.y * Math.max(0, spareY) * TRAVEL;
			layerEl.style.transform = `translate3d(calc(-50% + ${tx.toFixed(2)}px), calc(-50% + ${ty.toFixed(2)}px), 0)`;
		};

		const tick = (time: number) => {
			const dt = last ? Math.min(0.05, (time - last) / 1000) : 1 / 60;
			last = time;
			const k = 1 - Math.exp(-FOLLOW_RATE * dt);
			current.x += (target.x - current.x) * k;
			current.y += (target.y - current.y) * k;
			apply();
			if (Math.abs(target.x - current.x) < 0.001 && Math.abs(target.y - current.y) < 0.001) {
				raf = 0;
				last = 0;
				return;
			}
			raf = requestAnimationFrame(tick);
		};
		const kick = () => {
			if (!raf) raf = requestAnimationFrame(tick);
		};

		const onMove = (event: PointerEvent) => {
			if (event.pointerType !== "mouse") return;
			const box = frameEl.getBoundingClientRect();
			target.x = Math.max(-1, Math.min(1, ((event.clientX - box.left) / box.width) * 2 - 1));
			target.y = Math.max(-1, Math.min(1, ((event.clientY - box.top) / box.height) * 2 - 1));
			kick();
		};
		const onLeave = () => {
			target.x = 0;
			target.y = 0;
			kick();
		};

		frameEl.addEventListener("pointermove", onMove);
		frameEl.addEventListener("pointerleave", onLeave);
		return () => {
			frameEl.removeEventListener("pointermove", onMove);
			frameEl.removeEventListener("pointerleave", onLeave);
			cancelAnimationFrame(raf);
		};
	}, [enabled, frame, layer]);
}

/**
 * 主页封面：展示框比例与裁剪弹窗一致。
 *
 * 自定义封面是比展示框更大的图层（按裁剪比例铺放），鼠标移动时带阻尼地平移，
 * 露出上下与两侧更多画面；静止时居中，所见即裁剪时的取景中心。
 * 加载前是骨架底色，加载后淡入；上下渐变保证头像卡片与文字的对比，暗色主题压暗一档。
 * 未设置封面时用头像取色做柔和的氛围背景。
 */
export function UserProfileCover({ avatarSrc, coverSrc, className }: UserProfileCoverProps) {
	const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
	const loaded = !!coverSrc && loadedSrc === coverSrc;
	const frameRef = useRef<HTMLDivElement>(null);
	const layerRef = useRef<HTMLDivElement>(null);
	useDampedParallax(frameRef, layerRef, !!coverSrc);

	return (
		<div
			ref={frameRef}
			aria-hidden="true"
			className={cn(
				"relative overflow-hidden rounded-2xl bg-muted ring-1 ring-border/60 ring-inset",
				COVER_FRAME_CLASS,
				coverSrc && !loaded && "animate-pulse",
				className,
			)}
		>
			{coverSrc ? (
				<div
					ref={layerRef}
					className="absolute top-1/2 left-1/2 will-change-transform"
					style={{
						width: `${OVERSCAN * 100}%`,
						aspectRatio: COVER_ASPECT,
						transform: "translate3d(-50%, -50%, 0)",
					}}
				>
					<CroppedImage
						src={coverSrc}
						fillContainer
						className="absolute inset-0"
						imgClassName={cn(
							"transition-opacity duration-500 motion-reduce:transition-none dark:brightness-90",
							loaded ? "opacity-100" : "opacity-0",
						)}
						onLoad={() => setLoadedSrc(coverSrc)}
						onError={() => setLoadedSrc(coverSrc)}
					/>
				</div>
			) : avatarSrc ? (
				<>
					<img
						src={avatarSrc}
						alt=""
						// 向外扩出一圈，避免模糊后边缘透出底色。
						className="absolute -inset-10 h-[calc(100%+5rem)] w-[calc(100%+5rem)] max-w-none object-cover opacity-80 blur-3xl saturate-150 dark:opacity-60"
						referrerPolicy="no-referrer"
					/>
					<div className="absolute inset-0 bg-linear-to-br from-primary/15 via-transparent to-primary/10" />
				</>
			) : (
				<div className="absolute inset-0 bg-linear-to-br from-primary/15 via-muted to-primary/10" />
			)}
			<div className="pointer-events-none absolute inset-0 bg-linear-to-b from-background/15 via-transparent to-background/55" />
		</div>
	);
}
