/**
 * PhotoStack - 照片堆叠
 *
 * 「一沓照片」交互单元：竖图居中、底图左右各露一条窄边暗示多张；
 * 横向拖拽把顶图拨到栈底翻下一张；点行尾展开键切平铺网格一览全部。
 * 图集浏览流与任何「一组图」场景共用此件。
 *
 * @example
 * <PhotoStack
 *   images={[{ src: "/uploads/a.jpg", alt: "港口" }]}
 *   footer={<span>2026 濑户内海 · 14 项</span>}
 * />
 */
import { cn } from "@shared/lib/utils";
import { GripHorizontal, Maximize2 } from "lucide-react";
import { motion } from "motion/react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useRef, useState } from "react";

export interface PhotoStackImage {
	src: string;
	alt?: string;
}

export interface PhotoStackProps {
	/** 图片列表（栈中展示顺序，首图在顶） */
	images: PhotoStackImage[];
	/** 卡片下方元信息区（标题/作者等），由调用方自由排布 */
	footer?: React.ReactNode;
	/** 栈面比例，默认竖向 3:4 */
	aspectClass?: string;
	className?: string;
}

/** 翻页阈值：顶图位移超过栈面宽度的比例即拨到底。 */
const FLIP_RATIO = 0.22;
/** 底图露出宽度占栈面宽度比例（左右窄边的视觉参照）。 */
const PEEK_RATIO = 0.035;
const EXPAND_SPRING = { type: "spring", stiffness: 320, damping: 34 } as const;

export function PhotoStack({
	images,
	footer,
	aspectClass = "aspect-3/4",
	className,
}: PhotoStackProps) {
	const [order, setOrder] = useState(images);
	const [expanded, setExpanded] = useState(false);
	const [dragX, setDragX] = useState(0);
	// 拖拽路径全部走 ref（同步读写，避免 state 异步导致翻页判断读到旧值）
	const dragXRef = useRef(0);
	const dragging = useRef<number | null>(null);
	const stackRef = useRef<HTMLDivElement>(null);
	// 栈面宽度：挂载后量一次（ref 在 render 后才有值），底图露边靠它
	const [stackWidth, setStackWidth] = useState(0);

	useEffect(() => {
		const stack = stackRef.current;
		if (!stack) return;
		setStackWidth(stack.offsetWidth);
		const cancel = () => {
			if (dragging.current === null) return;
			dragging.current = null;
			dragXRef.current = 0;
			setDragX(0);
		};
		stack.addEventListener("lostpointercapture", cancel);
		return () => stack.removeEventListener("lostpointercapture", cancel);
	}, []);

	const onPointerDown = (e: ReactPointerEvent) => {
		dragging.current = e.clientX;
		stackRef.current?.setPointerCapture(e.pointerId);
	};
	const onPointerMove = (e: ReactPointerEvent) => {
		if (dragging.current === null) return;
		dragXRef.current = e.clientX - dragging.current;
		setDragX(dragXRef.current);
	};
	const onPointerUp = () => {
		if (dragging.current === null) return;
		const width = stackRef.current?.offsetWidth ?? 0;
		if (Math.abs(dragXRef.current) > width * FLIP_RATIO) {
			setOrder((prev) => [...prev.slice(1), prev[0]]);
		}
		dragXRef.current = 0;
		setDragX(0);
		dragging.current = null;
	};

	if (expanded) {
		return (
			<article className={cn("group", className)}>
				<motion.div layout className="grid grid-cols-2 gap-1.5 overflow-hidden rounded-xl">
					{order.map((img, i) => (
						<motion.div
							key={img.src}
							layout
							transition={EXPAND_SPRING}
							className="relative overflow-hidden rounded-md"
						>
							<img
								src={img.src}
								alt={img.alt ?? `照片 ${i + 1}`}
								loading="lazy"
								className="aspect-3/4 w-full object-cover"
							/>
						</motion.div>
					))}
				</motion.div>
				<div className="mt-3 flex items-start justify-between gap-3">
					<div className="min-w-0 flex-1">{footer}</div>
					<ExpandToggle expanded={expanded} onToggle={() => setExpanded(false)} />
				</div>
			</article>
		);
	}

	const isDragging = dragging.current !== null;
	const peek = stackWidth * PEEK_RATIO;

	return (
		<article className={cn("group", className)}>
			{/* isolate + overflow-hidden：拖出栈面时不被相邻卡片盖住 */}
			<motion.div
				layout
				ref={stackRef}
				className={cn(
					"relative isolate touch-pan-y select-none",
					"mx-auto w-[92%]", // 四周留白，栈更收束
					isDragging && "cursor-grabbing",
					aspectClass,
				)}
				onPointerDown={onPointerDown}
				onPointerMove={onPointerMove}
				onPointerUp={onPointerUp}
				onPointerCancel={onPointerUp}
			>
				{order.map((img, i) => {
					const depth = Math.min(i, 2);
					const isTop = i === 0;
					// 底图只露窄边：横向偏移 + 微缩（窄边有厚度感），不旋转不摆拍
					const peekX = depth === 0 ? 0 : depth === 1 ? -peek : peek;
					return (
						<motion.div
							key={img.src}
							layout={false}
							transition={isTop && isDragging ? { duration: 0 } : EXPAND_SPRING}
							className="absolute inset-0 overflow-hidden rounded-lg border border-edge-hairline bg-background shadow-md"
							style={{
								// 顶图收窄 6% 居中；底图全宽并向左/右探出窄条
								width: isTop ? "92%" : "100%",
								insetInlineStart: isTop ? "4%" : 0,
								transform: isTop
									? `translateX(${dragX}px) rotate(${dragX / 14}deg)`
									: `translateX(${peekX}px)`,
								zIndex: 10 - depth,
								boxShadow:
									isTop && isDragging
										? "0 12px 32px rgb(0 0 0 / 0.28)"
										: undefined,
							}}
						>
							<img
								src={img.src}
								alt={img.alt ?? ""}
								loading="lazy"
								draggable={false}
								className="size-full object-cover"
							/>
						</motion.div>
					);
				})}
				{/* 拖拽提示：底缘抓手条 */}
				<div className="absolute inset-x-0 bottom-3 z-10 flex justify-center">
					<span className="rounded-full bg-black/45 p-1.5 backdrop-blur-sm">
						<GripHorizontal className="size-4 text-white/90" />
					</span>
				</div>
				{/* 计数器：底部左缘（与抓手同行） */}
				{/* 当前顶图在原始 images 里的序号（翻页后递增） */}
				<div className="absolute bottom-3 start-3 z-10 rounded-full bg-black/45 px-2 py-0.5 font-mono text-[10px] text-white/90 backdrop-blur-sm">
					{images.findIndex((x) => x.src === order[0]?.src) + 1} / {order.length}
				</div>
			</motion.div>
			<div className="mt-3 flex items-start justify-between gap-3">
				<div className="min-w-0 flex-1">{footer}</div>
				<ExpandToggle expanded={expanded} onToggle={() => setExpanded(true)} />
			</div>
		</article>
	);
}

function ExpandToggle({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
	return (
		<button
			type="button"
			onClick={onToggle}
			aria-label={expanded ? "收起为堆叠" : "展开为网格"}
			className="mt-0.5 shrink-0 rounded-md border border-edge-hairline p-1.5 text-muted-foreground transition-colors hover:text-foreground"
		>
			<Maximize2 className={cn("size-3.5 transition-transform", expanded && "rotate-45")} />
		</button>
	);
}
