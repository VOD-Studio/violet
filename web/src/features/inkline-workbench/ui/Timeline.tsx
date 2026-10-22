import type { Schedule } from "@violetjs/inkline";
import { cn } from "cn";
import {
	type KeyboardEvent,
	type PointerEvent,
	type Ref,
	useCallback,
	useEffect,
	useImperativeHandle,
	useRef,
} from "react";

/** 由舞台每帧调用，直接重画播放头，不经过 React 渲染。 */
export interface TimelineHandle {
	setTime(time: number): void;
}

export interface TimelineProps {
	schedule: Schedule;
	/** 播放分段，每段一种颜色：底纸、线稿、上色 */
	phases: readonly (readonly number[])[];
	onSeek(time: number): void;
	ref?: Ref<TimelineHandle>;
	className?: string;
}

// 依次给底纸、线稿、上色三段；工具方言的 --primary 是中性色，进度用主色源 --primary-base
const LANE_COLORS = ["--muted-foreground", "--foreground", "--primary-base"];
// 键盘每次跳转的秒数；Shift 加大到 5 倍
const KEY_STEP = 0.5;

/** 变量值可能是 light-dark() 等写法，Canvas 不认，借元素的 color 解析成具体颜色。 */
function resolveColor(element: HTMLElement, variable: string): string {
	element.style.color = `var(${variable})`;
	const color = getComputedStyle(element).color;
	element.style.color = "";
	return color;
}

interface Lanes {
	image: HTMLCanvasElement;
	playhead: string;
}

/** 把各段的落笔窗口画进一张与时间条同尺寸的位图；窗口重叠越多颜色越深，疏密一眼可见。 */
function renderLanes(
	element: HTMLCanvasElement,
	schedule: Schedule,
	phases: TimelineProps["phases"],
): Lanes {
	const dpr = window.devicePixelRatio || 1;
	const width = Math.max(1, Math.round(element.clientWidth * dpr));
	const height = Math.max(1, Math.round(element.clientHeight * dpr));
	element.width = width;
	element.height = height;
	const image = document.createElement("canvas");
	image.width = width;
	image.height = height;
	const ctx = image.getContext("2d");
	const duration = schedule.duration || 1;
	const lanes = phases.filter((lane) => lane.length > 0);
	const laneHeight = height / Math.max(1, lanes.length);
	lanes.forEach((lane, row) => {
		if (!ctx) return;
		ctx.fillStyle = resolveColor(
			element,
			LANE_COLORS[(row + LANE_COLORS.length - lanes.length) % LANE_COLORS.length],
		);
		ctx.globalAlpha = Math.min(0.5, Math.max(0.04, 8 / lane.length));
		for (const index of lane) {
			const x0 = (schedule.start[index] / duration) * width;
			const x1 = Math.max(x0 + dpr, (schedule.end[index] / duration) * width);
			ctx.fillRect(x0, row * laneHeight + dpr, x1 - x0, laneHeight - 2 * dpr);
		}
	});
	return { image, playhead: resolveColor(element, "--primary-base") };
}

/**
 * 落笔时间条：按分段着色，画出每个图元的落笔窗口，叠加当前时刻；点击或拖动即跳转。
 *
 * @remarks 颜色在建图时读取一次；主题切换后由使用方换 key 重建。
 */
export function Timeline({ schedule, phases, onSeek, ref, className }: TimelineProps) {
	const canvas = useRef<HTMLCanvasElement>(null);
	const time = useRef(0);
	const lanes = useRef<Lanes | null>(null);

	const frame = useCallback(() => {
		const element = canvas.current;
		const ctx = element?.getContext("2d");
		if (!element || !ctx || !lanes.current) return;
		const dpr = window.devicePixelRatio || 1;
		ctx.clearRect(0, 0, element.width, element.height);
		ctx.drawImage(lanes.current.image, 0, 0);
		ctx.fillStyle = lanes.current.playhead;
		const x = (time.current / (schedule.duration || 1)) * element.width;
		ctx.fillRect(Math.min(element.width - 2 * dpr, x), 0, 2 * dpr, element.height);
	}, [schedule.duration]);

	useImperativeHandle(
		ref,
		() => ({
			setTime(next) {
				time.current = next;
				frame();
				canvas.current?.setAttribute("aria-valuenow", next.toFixed(1));
			},
		}),
		[frame],
	);

	useEffect(() => {
		const element = canvas.current;
		if (!element) return;
		const rebuild = () => {
			lanes.current = renderLanes(element, schedule, phases);
			frame();
		};
		rebuild();
		const observer = new ResizeObserver(rebuild);
		observer.observe(element);
		return () => observer.disconnect();
	}, [schedule, phases, frame]);

	const seekAt = (event: PointerEvent<HTMLCanvasElement>) => {
		const bounds = event.currentTarget.getBoundingClientRect();
		const ratio = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
		onSeek(ratio * schedule.duration);
	};

	const onKeyDown = (event: KeyboardEvent<HTMLCanvasElement>) => {
		const step = event.shiftKey ? KEY_STEP * 5 : KEY_STEP;
		const target = {
			ArrowLeft: time.current - step,
			ArrowRight: time.current + step,
			Home: 0,
			End: schedule.duration,
		}[event.key];
		if (target === undefined) return;
		event.preventDefault();
		onSeek(Math.min(schedule.duration, Math.max(0, target)));
	};

	return (
		<canvas
			ref={canvas}
			role="slider"
			tabIndex={0}
			aria-label="落笔时间条"
			aria-valuemin={0}
			aria-valuemax={Number(schedule.duration.toFixed(1))}
			aria-valuenow={0}
			className={cn(
				"block h-12 w-full cursor-pointer touch-none rounded-lg border border-border bg-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
				className,
			)}
			onPointerDown={(event) => {
				event.currentTarget.setPointerCapture(event.pointerId);
				seekAt(event);
			}}
			onPointerMove={(event) => {
				if (event.currentTarget.hasPointerCapture(event.pointerId)) seekAt(event);
			}}
			onKeyDown={onKeyDown}
		/>
	);
}
