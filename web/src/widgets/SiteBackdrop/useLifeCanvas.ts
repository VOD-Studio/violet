import { useReducedMotion } from "@shared/lib/motion";
import { useEffect, useRef } from "react";

import {
	countAlive,
	createBoard,
	GLIDER,
	type LifeBoard,
	resizeBoard,
	seedCorners,
	stampPattern,
	stepBoard,
} from "./life";

const CELL = 24; // 与 .grid 的 background-size 一致，活细胞落在网点上
const DOT_RADIUS = 2.2;
const TICK_MS = 760;
const FADE_MS = 520;
const LAUNCH_EVERY = 12; // 每隔若干代检查一次，细胞稀疏时从角落放出滑翔机
const SPARSE_RATIO = 0.03;
const PENDING_LIMIT = 48;
const STILL_GENERATIONS = 40; // 减弱动态时先演化若干代，静态画面才像自然长成的图案

/** 寿命封顶为 2：0 = 本代新生，1 = 上一代新生，2 = 已稳定。 */
const SETTLED = 2;
/** 按死亡后经过的代数取残影不透明度，下标 0 为活细胞。 */
const TRAIL = [1, 0.34, 0.2, 0.1, 0.04];
const GONE = TRAIL.length;

function trail(since: number): number {
	return TRAIL[since] ?? 0;
}

function easeOut(progress: number): number {
	return 1 - (1 - progress) ** 3;
}

function launchGlider({ cols, rows, cells }: LifeBoard): void {
	const topRight = Math.random() < 0.5;
	const spanX = Math.floor(Math.random() * cols * 0.22);
	const spanY = Math.floor(Math.random() * rows * 0.3);
	stampPattern(
		cells,
		cols,
		rows,
		GLIDER,
		topRight ? cols - 3 - spanX : 2 + spanX,
		topRight ? 2 + spanY : rows - 3 - spanY,
		Math.random() < 0.5,
		Math.random() < 0.5,
	);
}

/**
 * 在背景点阵上运行生命游戏：新生细胞以强调色出现、次代沉为常色，消亡后留几代渐淡的残影；
 * 指针划过处播下新细胞。两种颜色由 canvas 的 color / outline-color 提供。
 *
 * @returns 绑定到铺满背景层的 canvas
 */
export function useLifeCanvas() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const reduceMotion = useReducedMotion();

	useEffect(() => {
		const canvas = canvasRef.current;
		const context = canvas?.getContext("2d");
		if (!canvas || !context) return undefined;

		let board = createBoard(0, 0);
		// since：死亡后经过的代数，0 = 存活，GONE = 残影已散；previous* 为上一代快照，供过渡插值
		let since = new Uint8Array(0);
		let previousSince = since;
		let age = new Uint8Array(0);
		let previousAge = age;
		let pending: number[] = [];
		let generation = 0;
		let tickStartedAt = 0;
		let frame = 0;
		let timer = 0;
		let lastPointerCell = -1;
		let width = 0;
		let height = 0;
		let dpr = 1;
		let alive = "";
		let newborn = "";

		// canvas 不解析 light-dark() 与 CSS 变量，借 color / outline-color 的计算值取主题色
		const readColors = () => {
			const style = getComputedStyle(canvas);
			alive = style.color;
			newborn = style.outlineColor;
		};

		// PROTOTYPE（#645）：data-glyph 指定季节纹样时，活细胞画成桃花、水纹、桂花或雪花
		const petals = (
			x: number,
			y: number,
			count: number,
			offset: number,
			distance: number,
			radius: number,
		) => {
			context.beginPath();
			for (let k = 0; k < count; k++) {
				const angle = offset + (k * Math.PI * 2) / count;
				const px = x + Math.cos(angle) * distance;
				const py = y + Math.sin(angle) * distance;
				context.moveTo(px + radius, py);
				context.arc(px, py, radius, 0, Math.PI * 2);
			}
			context.fill();
		};
		const dot = (index: number, color: string, opacity: number) => {
			if (opacity <= 0) return;
			const x = (index % board.cols) * CELL + CELL / 2;
			const y = Math.floor(index / board.cols) * CELL + CELL / 2;
			context.globalAlpha = opacity;
			context.fillStyle = color;
			context.strokeStyle = color;
			context.lineCap = "round";
			switch (canvas.dataset.glyph) {
				case "spring":
					petals(x, y, 5, -Math.PI / 2, 2.4, 1.8);
					return;
				case "summer":
					context.lineWidth = 1.1;
					context.beginPath();
					context.arc(x, y, 3.6, 0, Math.PI * 2);
					context.stroke();
					context.beginPath();
					context.arc(x, y, 1.1, 0, Math.PI * 2);
					context.fill();
					return;
				case "autumn":
					petals(x, y, 4, Math.PI / 4, 2.3, 1.75);
					return;
				case "winter":
					context.lineWidth = 1.1;
					context.beginPath();
					for (let k = 0; k < 6; k++) {
						const angle = (k * Math.PI) / 3 + Math.PI / 2;
						context.moveTo(x, y);
						context.lineTo(x + Math.cos(angle) * 4, y + Math.sin(angle) * 4);
					}
					context.stroke();
					return;
				default:
					context.beginPath();
					context.arc(x, y, DOT_RADIUS, 0, Math.PI * 2);
					context.fill();
			}
		};

		const paint = (progress: number) => {
			const eased = easeOut(progress);
			context.setTransform(dpr, 0, 0, dpr, 0, 0);
			context.clearRect(0, 0, width, height);
			for (let index = 0; index < since.length; index++) {
				const now = since[index];
				const before = previousSince[index];
				if (now === GONE && before === GONE) continue;
				if (now === 0 && before === 0) {
					dot(index, alive, 1);
					// 上一代新生的细胞褪为常色
					if (age[index] === 1) dot(index, newborn, 1 - eased);
				} else if (now === 0) {
					dot(index, alive, trail(before) * (1 - eased));
					dot(index, newborn, eased);
				} else if (before === 0 && previousAge[index] === 0) {
					dot(index, newborn, 1 - eased);
					dot(index, alive, trail(now) * eased);
				} else {
					dot(index, alive, trail(before) + (trail(now) - trail(before)) * eased);
				}
			}
			context.globalAlpha = 1;
		};

		const render = (now: number) => {
			frame = 0;
			const progress = Math.min(1, (now - tickStartedAt) / FADE_MS);
			paint(progress);
			if (progress < 1) frame = requestAnimationFrame(render);
		};

		const animate = () => {
			tickStartedAt = performance.now();
			if (!frame) frame = requestAnimationFrame(render);
		};

		const advance = () => {
			const next = stepBoard(board);
			generation++;
			if (
				generation % LAUNCH_EVERY === 0 &&
				countAlive(next.cells) < next.cells.length * SPARSE_RATIO
			) {
				launchGlider(next);
			}
			for (const index of pending) if (index < next.cells.length) next.cells[index] = 1;
			pending = [];

			const nextSince = new Uint8Array(next.cells.length);
			const nextAge = new Uint8Array(next.cells.length);
			for (let index = 0; index < next.cells.length; index++) {
				if (next.cells[index]) {
					if (board.cells[index]) nextAge[index] = Math.min(age[index] + 1, SETTLED);
				} else {
					nextSince[index] = Math.min(since[index] + 1, GONE);
				}
			}
			board = next;
			previousSince = since;
			previousAge = age;
			since = nextSince;
			age = nextAge;
		};

		/** 丢弃过渡与残影，直接以当前棋盘为稳定画面（缩放窗口、减弱动态时）。 */
		const settle = () => {
			since = board.cells.map((cell) => (cell ? 0 : GONE));
			previousSince = since;
			age = new Uint8Array(board.cells.length).fill(SETTLED);
			previousAge = age;
		};

		const fitCanvas = () => {
			width = canvas.clientWidth;
			height = canvas.clientHeight;
			dpr = Math.min(window.devicePixelRatio || 1, 2);
			canvas.width = Math.round(width * dpr);
			canvas.height = Math.round(height * dpr);
			board = resizeBoard(board, Math.ceil(width / CELL), Math.ceil(height / CELL));
		};

		readColors();
		fitCanvas();
		seedCorners(board, Math.random);
		// 首帧整片细胞汤以新生色淡入
		since = board.cells.map((cell) => (cell ? 0 : GONE));
		previousSince = new Uint8Array(since.length).fill(GONE);
		age = new Uint8Array(since.length);
		previousAge = age;

		const tick = () => {
			advance();
			animate();
		};
		const start = () => {
			if (!timer && !document.hidden) timer = window.setInterval(tick, TICK_MS);
		};
		const stop = () => {
			window.clearInterval(timer);
			timer = 0;
		};

		const handleResize = () => {
			fitCanvas();
			settle();
			paint(1);
		};
		const handleVisibility = () => {
			if (document.hidden) stop();
			else start();
		};
		const handleMove = (event: PointerEvent) => {
			if (event.pointerType !== "mouse") return;
			const x = Math.floor(event.clientX / CELL);
			const y = Math.floor(event.clientY / CELL);
			const index = y * board.cols + x;
			if (index === lastPointerCell || pending.length >= PENDING_LIMIT) return;
			lastPointerCell = index;
			// 单个细胞下一代即死，顺带点亮一个随机邻格才可能繁衍
			const neighbourX = (x + Math.floor(Math.random() * 3) - 1 + board.cols) % board.cols;
			const neighbourY = (y + Math.floor(Math.random() * 3) - 1 + board.rows) % board.rows;
			pending.push(index, neighbourY * board.cols + neighbourX);
		};

		// 主题或调色板切换只改写根元素属性，届时重新取色
		const themeObserver = new MutationObserver(() => {
			readColors();
			if (!frame) paint(1);
		});
		themeObserver.observe(document.documentElement, { attributes: true });
		window.addEventListener("resize", handleResize);

		if (reduceMotion) {
			for (let step = 0; step < STILL_GENERATIONS; step++) advance();
			settle();
			paint(1);
		} else {
			animate();
			start();
			document.addEventListener("visibilitychange", handleVisibility);
			if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
				window.addEventListener("pointermove", handleMove, { passive: true });
			}
		}

		return () => {
			stop();
			cancelAnimationFrame(frame);
			themeObserver.disconnect();
			window.removeEventListener("resize", handleResize);
			window.removeEventListener("pointermove", handleMove);
			document.removeEventListener("visibilitychange", handleVisibility);
		};
	}, [reduceMotion]);

	return canvasRef;
}
