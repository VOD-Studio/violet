import { GifReader } from "omggif";
import { describe, expect, it } from "vitest";
import { createSchedule } from "./animate/schedule.ts";
import { rect } from "./core/path.ts";
import { draw } from "./draw.ts";
import { buildColorTable, createColorMapper, type Rgb } from "./export/color-table.ts";
import { planGifFrames, sampleFrameTimes } from "./export/frames.ts";
import { createGifEncoder } from "./export/gif.ts";
import { exportGif, exportWebm } from "./export/index.ts";
import { createWebmMuxer } from "./export/webm.ts";
import { styles } from "./presets.ts";

describe("sampleFrameTimes", () => {
	it("keeps a uniform 60 fps cadence and the terminal frame for video", () => {
		const times = sampleFrameTimes(1, 60);
		expect(times).toHaveLength(61);
		expect(times[0]).toBe(0);
		expect(times.at(-1)).toBe(1);
		for (let i = 1; i < times.length; i++)
			expect(times[i] - times[i - 1]).toBeCloseTo(1 / 60, 9);
	});

	it("keeps the short terminal interval without GIF frame merging", () => {
		expect(sampleFrameTimes(0.05, 25)).toEqual([0, 0.04, 0.05]);
	});

	it("samples a still drawing only once", () => {
		expect(sampleFrameTimes(0, 60)).toEqual([0]);
	});
});

describe("planGifFrames", () => {
	it("samples every 1/fps second and holds the last frame", () => {
		const plan = planGifFrames(1, 25, 1);
		expect(plan.times).toHaveLength(26);
		expect(plan.times[1]).toBeCloseTo(0.04);
		expect(plan.times.at(-1)).toBe(1);
		expect(plan.delays.slice(0, -1).every((d) => d === 4)).toBe(true);
		expect(plan.delays.at(-1)).toBe(100);
	});

	it("keeps the total length when the last interval is shorter than a frame", () => {
		const plan = planGifFrames(1.67, 25, 1);
		expect(plan.delays.reduce((a, b) => a + b, 0)).toBe(167 + 100);
		expect(plan.delays.at(-2)).toBe(3);
	});

	it("merges frames shorter than 2/100 s into the previous frame", () => {
		// 0 → 0.04 → 0.05：0.04 处的帧只显示 1/100 秒，并入首帧
		expect(planGifFrames(0.05, 25, 0)).toEqual({ times: [0, 0.05], delays: [5, 4] });
	});

	it("exports a still drawing as one held frame", () => {
		expect(planGifFrames(0, 25, 1)).toEqual({ times: [0], delays: [100] });
	});
});

describe("color table", () => {
	const paper: Rgb = [255, 255, 255];
	const ink: Rgb = [40, 36, 50];
	const pixels = (...colors: Rgb[]) => new Uint8ClampedArray(colors.flatMap((c) => [...c, 255]));

	it("keeps every palette color exactly, background first", () => {
		const table = buildColorTable([paper, ink, paper], [pixels(paper, ink)]);
		expect(table).toEqual([paper, ink]);
	});

	it("adds colors for anti-aliased edges the palette cannot express", () => {
		const edge: Rgb = [148, 146, 152];
		const table = buildColorTable([paper, ink], [pixels(paper, ink, edge, edge)]);
		expect(table.slice(0, 2)).toEqual([paper, ink]);
		expect(table).toContainEqual(edge);
	});

	it("never exceeds 255 colors", () => {
		const gradient = Array.from(
			{ length: 1000 },
			(_, i): Rgb => [i % 256, (i * 7) % 256, (i * 13) % 256],
		);
		expect(buildColorTable([paper, ink], [pixels(...gradient)]).length).toBeLessThanOrEqual(
			255,
		);
	});

	it("maps pixels to the nearest color and skips pixels unchanged since the previous frame", () => {
		const map = createColorMapper([paper, ink]);
		const out = new Uint8Array(3);
		map(pixels(paper, ink, [60, 60, 60]), out);
		expect([...out]).toEqual([0, 1, 1]);
		out[0] = 7;
		map(pixels(paper, paper, ink), out, pixels(paper, ink, [60, 60, 60]));
		// 首像素与上一帧相同，保留原索引不重查
		expect([...out]).toEqual([7, 0, 1]);
	});
});

describe("GIF encoder", () => {
	const table: Rgb[] = [
		[255, 255, 255],
		[40, 36, 50],
		[200, 80, 60],
	];
	const decode = (bytes: Uint8Array) => {
		const reader = new GifReader(bytes);
		// 差分帧只覆盖变化区域，像播放器一样逐帧叠在同一块画面上
		const canvas = new Uint8Array(reader.width * reader.height * 4);
		const frames = Array.from({ length: reader.numFrames() }, (_, i) => {
			reader.decodeAndBlitFrameRGBA(i, canvas);
			return { delay: reader.frameInfo(i).delay, rgba: canvas.slice() };
		});
		return { reader, frames };
	};
	const expectPixels = (rgba: Uint8Array, indices: number[]) =>
		expect(
			Array.from({ length: indices.length }, (_, p) => [
				rgba[p * 4],
				rgba[p * 4 + 1],
				rgba[p * 4 + 2],
			]),
		).toEqual(indices.map((i) => table[i]));

	it("round-trips frames through a GIF decoder, writing only changed regions", () => {
		const encoder = createGifEncoder({ width: 4, height: 3, table, loop: true });
		const first = [0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0];
		const second = [0, 0, 0, 0, 0, 1, 1, 2, 0, 0, 0, 0];
		encoder.add(Uint8Array.from(first), 4);
		encoder.add(Uint8Array.from(second), 4);
		const { reader, frames } = decode(encoder.finish());
		expect(reader.loopCount()).toBe(0);
		expect(frames.map((f) => f.delay)).toEqual([4, 4]);
		expect(reader.frameInfo(1)).toMatchObject({ x: 3, y: 1, width: 1, height: 1 });
		expectPixels(frames[0].rgba, first);
		expectPixels(frames[1].rgba, second);
	});

	it("merges identical consecutive frames into one longer frame", () => {
		const encoder = createGifEncoder({ width: 2, height: 1, table, loop: true });
		encoder.add(Uint8Array.from([0, 1]), 4);
		encoder.add(Uint8Array.from([0, 1]), 4);
		encoder.add(Uint8Array.from([1, 1]), 100);
		const { frames } = decode(encoder.finish());
		expect(frames.map((f) => f.delay)).toEqual([8, 100]);
	});

	it("compresses images large enough to reset the LZW code table", () => {
		const size = 200;
		let seed = 1;
		const indices = Uint8Array.from({ length: size * size }, () => {
			seed = (seed * 1103515245 + 12345) & 0x7fffffff;
			return seed % 3;
		});
		const encoder = createGifEncoder({ width: size, height: size, table, loop: true });
		encoder.add(indices, 10);
		const { frames } = decode(encoder.finish());
		expectPixels(frames[0].rgba, [...indices]);
	});

	it("writes the loop count as replays, and no loop block for a single play", () => {
		const once = createGifEncoder({ width: 1, height: 1, table, loop: 1 });
		once.add(Uint8Array.from([0]), 10);
		expect(new GifReader(once.finish()).loopCount()).toBeNull();
		const thrice = createGifEncoder({ width: 1, height: 1, table, loop: 3 });
		thrice.add(Uint8Array.from([0]), 10);
		expect(new GifReader(thrice.finish()).loopCount()).toBe(2);
	});
});

/** 按 Matroska 规范读 EBML：ID 与长度都是变长整数，长度位去掉标记位。 */
function readEbml(bytes: Uint8Array, start = 0, end = bytes.length) {
	const masters = new Set([
		0x1a45dfa3, 0x18538067, 0x114d9b74, 0x4dbb, 0x1549a966, 0x1654ae6b, 0xae, 0xe0, 0x1f43b675,
		0x1c53bb6b, 0xbb, 0xb7,
	]);
	const vint = (at: number, keepMarker: boolean) => {
		const length = Math.clz32(bytes[at]) - 23;
		let value = keepMarker ? bytes[at] : bytes[at] & (0xff >> length);
		for (let i = 1; i < length; i++) value = value * 256 + bytes[at + i];
		return { value, length };
	};
	type Node = { id: number; at: number; data: Uint8Array; children: Node[] };
	const nodes: Node[] = [];
	for (let at = start; at < end; ) {
		const id = vint(at, true);
		const size = vint(at + id.length, false);
		const dataAt = at + id.length + size.length;
		const data = bytes.subarray(dataAt, dataAt + size.value);
		nodes.push({
			id: id.value,
			at,
			data,
			children: masters.has(id.value) ? readEbml(bytes, dataAt, dataAt + size.value) : [],
		});
		at = dataAt + size.value;
	}
	return nodes;
}

describe("WebM muxer", () => {
	const frames: [number, boolean][] = [
		[0, true],
		[40, false],
		[80, false],
		[2000, true],
		[2040, false],
	];
	const muxer = createWebmMuxer({ codec: "V_VP9", width: 480, height: 638 });
	for (const [time, key] of frames) muxer.addFrame(Uint8Array.of(time & 255), time, key);
	const bytes = muxer.finish(3000);
	const [header, segment] = readEbml(bytes);
	const child = (node: { children: ReturnType<typeof readEbml> }, id: number) =>
		node.children.find((c) => c.id === id);
	const uint = (data: Uint8Array) => data.reduce((n, b) => n * 256 + b, 0);
	const text = (data: Uint8Array) => new TextDecoder().decode(data);

	it("declares a WebM document with one VP9 video track", () => {
		expect(text(child(header, 0x4282)?.data ?? new Uint8Array())).toBe("webm");
		const track = child(child(segment, 0x1654ae6b) ?? { children: [] }, 0xae);
		expect(text(child(track ?? { children: [] }, 0x86)?.data ?? new Uint8Array())).toBe(
			"V_VP9",
		);
		const video = child(track ?? { children: [] }, 0xe0) ?? { children: [] };
		expect(uint(child(video, 0xb0)?.data ?? new Uint8Array())).toBe(480);
		expect(uint(child(video, 0xba)?.data ?? new Uint8Array())).toBe(638);
		const info = child(segment, 0x1549a966) ?? { children: [] };
		const duration = child(info, 0x4489)?.data ?? new Uint8Array(8);
		expect(new DataView(duration.buffer, duration.byteOffset, 8).getFloat64(0)).toBe(3000);
	});

	it("starts a cluster at every keyframe with block times relative to it", () => {
		const clusters = segment.children.filter((c) => c.id === 0x1f43b675);
		expect(clusters.map((c) => uint(child(c, 0xe7)?.data ?? new Uint8Array()))).toEqual([
			0, 2000,
		]);
		const blocks = clusters.map((c) =>
			c.children
				.filter((b) => b.id === 0xa3)
				.map((b) => ({
					track: b.data[0],
					time: new DataView(b.data.buffer, b.data.byteOffset + 1, 2).getInt16(0),
					key: (b.data[3] & 0x80) !== 0,
				})),
		);
		expect(blocks).toEqual([
			[
				{ track: 0x81, time: 0, key: true },
				{ track: 0x81, time: 40, key: false },
				{ track: 0x81, time: 80, key: false },
			],
			[
				{ track: 0x81, time: 0, key: true },
				{ track: 0x81, time: 40, key: false },
			],
		]);
	});

	it("points cues and the seek head at the elements they index", () => {
		const segmentData = segment.data.byteOffset;
		const offsetOf = (node: { at: number }) => node.at - segmentData;
		const clusters = segment.children.filter((c) => c.id === 0x1f43b675);
		const cues = child(segment, 0x1c53bb6b) ?? { children: [] };
		const positions = cues.children.map((point) =>
			uint(child(child(point, 0xb7) ?? { children: [] }, 0xf1)?.data ?? new Uint8Array()),
		);
		expect(positions).toEqual(clusters.map(offsetOf));
		const seeks = (child(segment, 0x114d9b74) ?? { children: [] }).children.map((seek) => ({
			id: uint(child(seek, 0x53ab)?.data ?? new Uint8Array()),
			at: uint(child(seek, 0x53ac)?.data ?? new Uint8Array()),
		}));
		for (const { id, at } of seeks)
			expect(offsetOf(segment.children.find((c) => c.id === id) ?? { at: -1 })).toBe(at);
		expect(seeks.map((s) => s.id)).toEqual([0x1549a966, 0x1654ae6b, 0x1c53bb6b]);
	});

	it("refuses a stream that does not start with a keyframe", () => {
		expect(() =>
			createWebmMuxer({ codec: "V_VP8", width: 2, height: 2 }).addFrame(
				Uint8Array.of(0),
				0,
				false,
			),
		).toThrow(/keyframe/);
	});
});

describe("export options", () => {
	const drawing = draw(
		{ width: 40, height: 30, items: [{ id: "r", path: rect(2, 2, 30, 20) }] },
		{ style: styles.natural, seed: 1 },
	);
	const schedule = createSchedule(drawing);
	const palette = { paper: "#fff", ink: "#222" };

	it("rejects a transparent background", async () => {
		await expect(exportGif(drawing, palette, { schedule, background: false })).rejects.toThrow(
			/opaque background/,
		);
	});

	it("rejects frame rates GIF cannot play reliably", async () => {
		await expect(exportGif(drawing, palette, { schedule, fps: 60 })).rejects.toThrow(
			RangeError,
		);
		await expect(exportWebm(drawing, palette, { schedule, fps: 0 })).rejects.toThrow(
			RangeError,
		);
	});

	it("rejects a loop count below one play and a non-positive duration", async () => {
		await expect(exportGif(drawing, palette, { schedule, loop: 0 })).rejects.toThrow(
			RangeError,
		);
		await expect(exportGif(drawing, palette, { schedule, duration: 0 })).rejects.toThrow(
			RangeError,
		);
	});

	it("explains that export needs a browser canvas", async () => {
		await expect(exportGif(drawing, palette, { schedule })).rejects.toThrow(/OffscreenCanvas/);
	});

	it("rejects with the abort reason when cancelled before starting", async () => {
		const controller = new AbortController();
		controller.abort();
		await expect(
			exportGif(drawing, palette, { schedule, signal: controller.signal }),
		).rejects.toMatchObject({
			name: "AbortError",
		});
	});
});
