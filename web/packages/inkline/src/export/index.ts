import type { Schedule } from "../animate/schedule.ts";
import type { Drawing } from "../core/types.ts";
import { paintFrame } from "../render/paint.ts";
import { type Palette, paint, type RenderOptions } from "../render/palette.ts";
import { buildColorTable, createColorMapper, type Rgb } from "./color-table.ts";
import { planGifFrames, sampleFrameTimes } from "./frames.ts";
import { createGifEncoder } from "./gif.ts";
import { createWebmMuxer, type WebmTrack } from "./webm.ts";

/** 动画导出的共用选项。 */
export interface AnimationExportOptions extends RenderOptions {
	/** 要导出的手绘时间轴。 */
	schedule: Schedule;
	/** 输出宽度，像素；高度按画面比例取整。 @default drawing.width */
	width?: number;
	/** 帧率。 @default 25 */
	fps?: number;
	/** 导出时长，秒；整条时间轴按比例压缩或拉伸到这个长度。 @default schedule.duration */
	duration?: number;
	/** 末帧停留，秒；至少显示一帧间隔。 @default 1 */
	hold?: number;
	/** 取消导出，Promise 以 signal 的 reason 拒绝。 */
	signal?: AbortSignal;
	/** 每画完一帧调用一次。 */
	onProgress?(done: number, total: number): void;
}

/** GIF 导出选项。 */
export interface GifExportOptions extends AnimationExportOptions {
	/** true 为无限循环，数字为总播放次数。 @default true */
	loop?: true | number;
}

/** WebM 导出选项。 */
export interface WebmExportOptions extends AnimationExportOptions {
	/** 目标码率，bit/s。 @default 按像素数与帧率估算 */
	bitrate?: number;
}

const DEFAULT_FPS = 25;
// GIF 延迟以 1/100 秒计，浏览器把 0–1 的延迟按 10 播放，2/100 秒（50 fps）是可靠上限
const MAX_GIF_FPS = 50;
const MAX_WEBM_FPS = 60;
// 每 2 秒一个关键帧，拖动进度时不必从头解码
const KEYFRAME_SECONDS = 2;

/**
 * 把手绘时间轴离线渲染成 GIF：按帧率逐帧绘制，与播放器的倍率、暂停和跳转无关。
 *
 * @throws 背景为透明（GIF 只有全透明与不透明两档，抗锯齿边会出现杂边）、参数越界或环境没有 OffscreenCanvas。
 * @remarks 色表保留配色原色，剩余槽位覆盖抗锯齿边与叠色；首帧之后每帧只写变化区域。
 * @example
 * ```ts
 * const schedule = createSchedule(drawing, { mode: "stagger" });
 * const blob = await exportGif(drawing, palette, { schedule, width: 480, duration: 6 });
 * ```
 */
export async function exportGif(
	drawing: Drawing,
	palette: Palette,
	options: GifExportOptions,
): Promise<Blob> {
	const loop = options.loop ?? true;
	if (loop !== true && !(Number.isInteger(loop) && loop >= 1))
		throw new RangeError("loop must be true or a whole number of plays (1 or more).");
	const job = prepare(drawing, palette, options, MAX_GIF_FPS, false);
	const { width, height, signal } = job;
	const plan = planGifFrames(job.length, job.fps, job.hold);
	const ctx = job.canvas.getContext("2d", { willReadFrequently: true });
	if (!ctx) throw new Error("OffscreenCanvas has no 2D context.");
	const frame = (time: number) => {
		job.paint(ctx, time);
		return ctx.getImageData(0, 0, width, height).data;
	};
	const table = buildColorTable(resolveColors(job.colors), [
		frame(job.length),
		frame(job.length / 2),
	]);
	const map = createColorMapper(table);
	const encoder = createGifEncoder({ width, height, table, loop });
	const indices = new Uint8Array(width * height);
	let previous: Uint8ClampedArray | undefined;
	for (let i = 0; i < plan.times.length; i++) {
		signal?.throwIfAborted();
		const rgba = frame(plan.times[i]);
		map(rgba, indices, previous);
		encoder.add(indices, plan.delays[i]);
		previous = rgba;
		options.onProgress?.(i + 1, plan.times.length);
		await nextTask();
	}
	signal?.throwIfAborted();
	return new Blob([encoder.finish()], { type: "image/gif" });
}

/**
 * 把手绘时间轴离线渲染成 WebM 视频，用浏览器的 WebCodecs 编码（VP9 优先，不支持时用 VP8）。
 *
 * @throws 背景为透明、参数越界、环境没有 OffscreenCanvas，或浏览器不能编码 VP9 与 VP8。
 * @remarks 宽高向下取偶数，这是 VP8/VP9 的 4:2:0 采样要求。
 */
export async function exportWebm(
	drawing: Drawing,
	palette: Palette,
	options: WebmExportOptions,
): Promise<Blob> {
	if (options.bitrate !== undefined && !(options.bitrate > 0))
		throw new RangeError("bitrate must be a positive number of bits per second.");
	const job = prepare(drawing, palette, options, MAX_WEBM_FPS, true);
	const { width, height, fps, signal } = job;
	const times = sampleFrameTimes(job.length, fps);
	if (typeof VideoEncoder === "undefined" || typeof VideoFrame === "undefined")
		throw new Error(
			"WebM export needs WebCodecs (VideoEncoder), which this environment lacks.",
		);
	const bitrate =
		options.bitrate ??
		Math.min(8_000_000, Math.max(250_000, Math.round(width * height * fps * 0.1)));
	const choice = await pickCodec({ width, height, bitrate, framerate: fps });
	if (!choice) throw new Error("This browser cannot encode WebM video (VP9 or VP8).");
	const ctx = job.canvas.getContext("2d");
	if (!ctx) throw new Error("OffscreenCanvas has no 2D context.");
	const muxer = createWebmMuxer({ codec: choice.track, width, height });
	let failure: unknown;
	const encoder = new VideoEncoder({
		output: (chunk) => {
			const data = new Uint8Array(chunk.byteLength);
			chunk.copyTo(data);
			muxer.addFrame(data, chunk.timestamp / 1000, chunk.type === "key");
		},
		error: (error) => {
			failure = error;
		},
	});
	const keyEvery = Math.max(1, Math.round(fps * KEYFRAME_SECONDS));
	const frameMicros = 1e6 / fps;
	const encode = (time: number, keyFrame: boolean) => {
		const frame = new VideoFrame(job.canvas, {
			timestamp: Math.round(time * 1e6),
			duration: Math.round(frameMicros),
		});
		encoder.encode(frame, { keyFrame });
		frame.close();
	};
	try {
		encoder.configure(choice.config);
		for (let i = 0; i < times.length; i++) {
			signal?.throwIfAborted();
			if (failure) throw failure;
			job.paint(ctx, times[i]);
			encode(times[i], i % keyEvery === 0);
			options.onProgress?.(i + 1, times.length);
			while (encoder.encodeQueueSize > 2) await wait(4);
			await nextTask();
		}
		// 末帧在停留结束时再出现一次，播放器据此把末帧保持到结尾
		const end = job.length + job.hold;
		if (job.hold > 0) encode(end, false);
		await encoder.flush();
		if (failure) throw failure;
		signal?.throwIfAborted();
		return new Blob([muxer.finish(end * 1000 + frameMicros / 1000)], { type: "video/webm" });
	} finally {
		if (encoder.state !== "closed") encoder.close();
	}
}

/**
 * 当前环境能否导出 WebM：需要 OffscreenCanvas 与能编码 VP9 或 VP8 的 WebCodecs。
 *
 * @remarks 按 640 × 480 检查；个别尺寸仍可能被编码器拒绝，此时 exportWebm 会报错。
 */
export async function canExportWebm(): Promise<boolean> {
	if (
		typeof OffscreenCanvas === "undefined" ||
		typeof VideoEncoder === "undefined" ||
		typeof VideoFrame === "undefined"
	)
		return false;
	return (
		(await pickCodec({
			width: 640,
			height: 480,
			bitrate: 1_000_000,
			framerate: DEFAULT_FPS,
		})) !== null
	);
}

interface Job {
	canvas: OffscreenCanvas;
	width: number;
	height: number;
	fps: number;
	/** 导出时长，秒。 */
	length: number;
	hold: number;
	signal?: AbortSignal;
	/** 背景色在前的配色原色，CSS 写法。 */
	colors: string[];
	paint(ctx: OffscreenCanvasRenderingContext2D, time: number): void;
}

function prepare(
	drawing: Drawing,
	palette: Palette,
	options: AnimationExportOptions,
	maxFps: number,
	even: boolean,
): Job {
	options.signal?.throwIfAborted();
	const { schedule } = options;
	const background = options.background === undefined ? "paper" : options.background;
	if (background === false)
		throw new Error(
			"Animation export needs an opaque background; set background to a palette role.",
		);
	const fps = options.fps ?? DEFAULT_FPS;
	if (!(fps > 0 && fps <= maxFps))
		throw new RangeError(`fps must be greater than 0 and at most ${maxFps}.`);
	const hold = options.hold ?? 1;
	if (!(hold >= 0)) throw new RangeError("hold must be 0 or more seconds.");
	const length = options.duration ?? schedule.duration;
	if (!(length >= 0) || (options.duration !== undefined && !(options.duration > 0)))
		throw new RangeError("duration must be a positive number of seconds.");
	const requested = options.width ?? drawing.width;
	if (!(requested >= 1)) throw new RangeError("width must be at least 1 pixel.");
	const round = (n: number) =>
		even ? Math.max(2, Math.floor(n / 2) * 2) : Math.max(1, Math.round(n));
	const width = round(requested);
	const height = round((requested * drawing.height) / drawing.width);
	if (typeof OffscreenCanvas === "undefined")
		throw new Error(
			"Animation export needs OffscreenCanvas, which is only available in browsers.",
		);
	// 背景缺色时在这里就报错，不等到第一帧
	const colors = [paint(palette, background), ...Object.values(palette)];
	const scale = length > 0 ? schedule.duration / length : 0;
	const renderOptions = { schedule, background, fontFamily: options.fontFamily };
	return {
		canvas: new OffscreenCanvas(width, height),
		width,
		height,
		fps,
		length,
		hold,
		signal: options.signal,
		colors,
		paint: (ctx, time) =>
			paintFrame(ctx, drawing, palette, width, height, {
				...renderOptions,
				time: Math.min(schedule.duration, time * scale),
			}),
	};
}

/** 用画布解析任意 CSS 颜色写法；半透明色先叠在背景色上。 */
function resolveColors(colors: readonly string[]): Rgb[] {
	const ctx = new OffscreenCanvas(1, 1).getContext("2d", { willReadFrequently: true });
	if (!ctx) throw new Error("OffscreenCanvas has no 2D context.");
	return colors.map((color) => {
		ctx.fillStyle = colors[0];
		ctx.fillRect(0, 0, 1, 1);
		ctx.fillStyle = color;
		ctx.fillRect(0, 0, 1, 1);
		const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
		return [r, g, b];
	});
}

/** 按画面像素数选 VP9 等级：等级只声明解码能力上限，取能容纳该尺寸的最低一级。 */
function vp9Codec(width: number, height: number): string {
	const levels: [number, string][] = [
		[36_864, "10"],
		[73_728, "11"],
		[122_880, "20"],
		[245_760, "21"],
		[552_960, "30"],
		[983_040, "31"],
		[2_228_224, "40"],
		[8_912_896, "50"],
		[35_651_584, "60"],
	];
	const level = levels.find(([max]) => width * height <= max)?.[1] ?? "62";
	return `vp09.00.${level}.08`;
}

async function pickCodec(
	base: Omit<VideoEncoderConfig, "codec">,
): Promise<{ config: VideoEncoderConfig; track: WebmTrack["codec"] } | null> {
	const candidates: [string, WebmTrack["codec"]][] = [
		[vp9Codec(base.width, base.height), "V_VP9"],
		["vp8", "V_VP8"],
	];
	for (const [codec, track] of candidates) {
		const config = { ...base, codec };
		try {
			if ((await VideoEncoder.isConfigSupported(config)).supported) return { config, track };
		} catch {
			// 不认识的编码字符串会抛 TypeError，按不支持处理
		}
	}
	return null;
}

/**
 * 让出主线程一次，导出期间页面仍能响应输入与定时器。
 *
 * @remarks 不用 scheduler.yield：它的续跑排在定时器之前，长导出会一直压住定时器任务。
 */
function nextTask(): Promise<void> {
	return new Promise((resolve) => {
		const { port1, port2 } = new MessageChannel();
		port1.onmessage = () => {
			port1.close();
			resolve();
		};
		port2.postMessage(null);
	});
}

function wait(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
