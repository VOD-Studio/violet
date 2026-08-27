/**
 * PhotoStack - 照片堆叠
 *
 * 「一沓照片」交互单元：竖图居中、底图左右各露窄边并带微倾斜，像随意摞起的一沓；
 * 横向拖拽顶图时以底缘为轴倾斜，拖够远或松手过阈值就把顶图甩出画面外、即时让位给下一张，
 * 飞出的卡从画面外被弹簧拉回栈底（视觉上从背面回到栈后）；点行尾展开键切紧凑网格一览全部。
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
import { animate, type MotionValue, motion, motionValue } from "motion/react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useId, useRef, useState } from "react";

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

/** 松手翻页阈值：顶图位移超过栈面宽度的比例即拨到底。 */
const FLIP_RATIO = 0.22;
/** 活提交阈值：拖拽中超过该比例立即翻页并把顶图甩到画面外，避免拖到一半卡住。 */
const LIVE_FLIP_RATIO = 0.45;
/** 底图露出宽度占栈面宽度比例（左右窄边的视觉参照）。 */
const PEEK_RATIO = 0.035;
/** 拖拽倾角系数：rotate = dragX × 系数；配合底缘转轴模拟从桌面捻起照片的手感。 */
const TILT_PER_PX = 0.1;
/** 拖拽倾角上限（度），大幅横扫时卡片不翻倒。 */
const TILT_MAX = 28;
/** 顶图甩出距离（栈宽倍数）：先甩到画面外，再被槽位弹簧拉回栈底。 */
const FLY_OFF_MULT = 1.6;
const SLOT_SPRING = { type: "spring", stiffness: 320, damping: 30 } as const;
const FLY_TWEEN = { duration: 0.2, ease: [0.2, 0.8, 0.4, 1] as [number, number, number, number] };

/**
 * 静止槽位（depth 0 = 顶图）：x 单位是栈宽 × PEEK_RATIO，rotate 单位度。
 * 交替左右露边 + 微倾斜营造「随意一沓」；更深层压在最深槽位后被遮住。
 */
const SLOTS = [
	{ x: 0, rotate: 0 },
	{ x: -1, rotate: -2.5 },
	{ x: 1, rotate: 2 },
	{ x: -1.6, rotate: -3.5 },
] as const;

interface CardMotion {
	x: MotionValue<number>;
	rotate: MotionValue<number>;
}

export function PhotoStack({
	images,
	footer,
	aspectClass = "aspect-3/4",
	className,
}: PhotoStackProps) {
	const [order, setOrder] = useState(images);
	const [expanded, setExpanded] = useState(false);
	// 仅驱动 cursor/阴影；拖拽位移走 MotionValue，pointermove 不触发重渲染
	const [dragging, setDragging] = useState(false);
	const dragStartX = useRef<number | null>(null);
	const stackRef = useRef<HTMLDivElement>(null);
	// 栈面宽度：挂载后量一次（ref 在 render 后才有值），底图露边靠它
	const [stackWidth, setStackWidth] = useState(0);
	// 展开/收起共享形变的 layoutId 需全页唯一（一页可能挂多个栈）
	const layoutPrefix = useId();

	// 每卡一组 MotionValue（按 src 持久）：拖拽 .set() 即时跟随，槽位变化 animate 弹簧补位
	const cardMotions = useRef(new Map<string, CardMotion>());
	const motionOf = (src: string, initX = 0, initRotation = 0): CardMotion => {
		let mv = cardMotions.current.get(src);
		if (!mv) {
			mv = { x: motionValue(initX), rotate: motionValue(initRotation) };
			cardMotions.current.set(src, mv);
		}
		return mv;
	};
	const slotOf = (depth: number) => {
		const s = SLOTS[Math.min(depth, SLOTS.length - 1)];
		return { x: s.x * stackWidth * PEEK_RATIO, rotate: s.rotate };
	};

	// 供挂载期 effect 闭包读到最新栈顶（挂载 effect 只跑一次，凭 ref 取现值）
	const orderRef = useRef(order);
	orderRef.current = order;

	// 槽位重排（翻页/挂载/栈宽变化）：各卡从当前位姿弹簧到各自槽位。
	// 被甩出的卡 zIndex 已即时降，从画面外被弹簧拉回栈底槽位——视觉上"绕到栈后"。
	useEffect(() => {
		order.forEach((img, i) => {
			const mv = cardMotions.current.get(img.src);
			if (!mv) return;
			const s = SLOTS[Math.min(i, SLOTS.length - 1)];
			mv.x.stop();
			mv.rotate.stop();
			animate(mv.x, s.x * stackWidth * PEEK_RATIO, SLOT_SPRING);
			animate(mv.rotate, s.rotate, SLOT_SPRING);
		});
	}, [order, stackWidth]);

	useEffect(() => {
		const stack = stackRef.current;
		if (!stack) return;
		setStackWidth(stack.offsetWidth);
		const cancel = () => {
			if (dragStartX.current === null) return;
			dragStartX.current = null;
			setDragging(false);
			const src = orderRef.current[0]?.src;
			const mv = src ? cardMotions.current.get(src) : undefined;
			if (!mv) return;
			animate(mv.x, 0, SLOT_SPRING);
			animate(mv.rotate, 0, SLOT_SPRING);
		};
		stack.addEventListener("lostpointercapture", cancel);
		return () => stack.removeEventListener("lostpointercapture", cancel);
	}, []);

	/**
	 * 立即把顶图甩到画面外并换栈顶：新顶图接管手指移动，甩出的卡由槽位 effect 弹簧拉回栈底。
	 * clientX 是触发甩出那一刻的指针位置，换栈后作为新顶图 dx 的原点，避免被旧卡累计距离影响。
	 */
	const flingTopAndFlip = (mv: CardMotion, dx: number, width: number, clientX: number) => {
		const sign = Math.sign(dx) || 1;
		animate(mv.x, sign * width * FLY_OFF_MULT, FLY_TWEEN);
		animate(mv.rotate, sign * TILT_MAX, FLY_TWEEN);
		setOrder((prev) => [...prev.slice(1), prev[0]]);
		dragStartX.current = clientX;
	};

	const onPointerDown = (e: ReactPointerEvent) => {
		if (e.button !== 0) return;
		dragStartX.current = e.clientX;
		setDragging(true);
		// 指针已释放等边缘场景 setPointerCapture 会抛 NotFoundError；无捕获时 pointermove 只在栈面内触发，拖拽降级可用
		try {
			stackRef.current?.setPointerCapture(e.pointerId);
		} catch {
			// 捕获失败属可接受降级
		}
		// 打断进行中的补位弹簧，避免与拖拽 .set() 互相拉扯
		const src = orderRef.current[0]?.src;
		const mv = src ? cardMotions.current.get(src) : undefined;
		mv?.x.stop();
		mv?.rotate.stop();
	};
	const onPointerMove = (e: ReactPointerEvent) => {
		if (dragStartX.current === null) return;
		const src = orderRef.current[0]?.src;
		if (!src) return;
		const mv = cardMotions.current.get(src);
		if (!mv) return;
		const dx = e.clientX - dragStartX.current;
		mv.x.set(dx);
		mv.rotate.set(Math.max(-TILT_MAX, Math.min(TILT_MAX, dx * TILT_PER_PX)));
		const width = stackRef.current?.offsetWidth ?? 0;
		if (Math.abs(dx) >= width * LIVE_FLIP_RATIO) {
			// 拖得够远：直接换栈顶，让下一张接管手指移动（无限循环翻页手感）
			flingTopAndFlip(mv, dx, width, e.clientX);
		}
	};
	const onPointerUp = () => {
		if (dragStartX.current === null) return;
		dragStartX.current = null;
		setDragging(false);
		const src = orderRef.current[0]?.src;
		if (!src) return;
		const mv = cardMotions.current.get(src);
		if (!mv) return;
		const width = stackRef.current?.offsetWidth ?? 0;
		const dx = mv.x.get() ?? 0;
		if (Math.abs(dx) > width * FLIP_RATIO) {
			// 小幅拖到阈值松手：同活提交路径，飞出去再换栈顶
			flingTopAndFlip(mv, dx, width, (mv.x.get() ?? 0) + (mv.x.get() ? 0 : 0));
			// 用当前指针位置（无 clientX 可得）做拖拽原点；交给 onPointerDown 之后的 cancel 兜底为 0
			dragStartX.current = null;
			return;
		}
		animate(mv.x, 0, SLOT_SPRING);
		animate(mv.rotate, 0, SLOT_SPRING);
	};

	if (expanded) {
		return (
			<article className={cn("group", className)}>
				{/* 紧凑网格一览全部：layoutId 让卡从堆叠位形变到网格位，不走视频的竖向分页 */}
				<motion.div
					layout
					className="grid grid-cols-2 gap-1.5 overflow-hidden rounded-xl sm:grid-cols-3"
				>
					{order.map((img, i) => (
						<motion.div
							key={img.src}
							layoutId={`${layoutPrefix}-${img.src}`}
							transition={SLOT_SPRING}
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

	return (
		<article className={cn("group", className)}>
			{/* isolate + overflow-hidden：拖出栈面时不被相邻卡片盖住 */}
			<motion.div
				layout
				ref={stackRef}
				className={cn(
					"relative isolate touch-pan-y select-none",
					"mx-auto w-[92%]", // 四周留白，栈更收束
					dragging ? "cursor-grabbing" : "cursor-grab",
					aspectClass,
				)}
				onPointerDown={onPointerDown}
				onPointerMove={onPointerMove}
				onPointerUp={onPointerUp}
				onPointerCancel={onPointerUp}
			>
				{order.map((img, i) => {
					const isTop = i === 0;
					const slot = slotOf(i);
					const mv = motionOf(img.src, slot.x, slot.rotate);
					return (
						<motion.div
							key={img.src}
							layoutId={`${layoutPrefix}-${img.src}`}
							transition={SLOT_SPRING}
							className="absolute inset-0 overflow-hidden rounded-lg border border-edge-hairline bg-background shadow-md"
							style={{
								// 顶图收窄 6% 居中；底图全宽并向左/右探出窄条
								width: isTop ? "92%" : "100%",
								insetInlineStart: isTop ? "4%" : 0,
								// 转轴压在底缘下方：拖拽倾斜像从桌面捻起一张照片
								transformOrigin: "50% 120%",
								x: mv.x,
								rotate: mv.rotate,
								zIndex: order.length - i,
								boxShadow:
									isTop && dragging ? "0 12px 32px rgb(0 0 0 / 0.28)" : undefined,
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
			onClick={(onClick) => {
				onClick.preventDefault?.();
				onToggle();
			}}
			aria-label={expanded ? "收起为堆叠" : "展开全部照片"}
			className="mt-0.5 shrink-0 rounded-md border border-edge-hairline p-1.5 text-muted-foreground transition-colors hover:text-foreground"
		>
			<Maximize2 className={cn("size-3.5 transition-transform", expanded && "rotate-45")} />
		</button>
	);
}
