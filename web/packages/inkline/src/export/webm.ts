/** WebM 视频轨。 */
export interface WebmTrack {
	/** Matroska 编码标识。 */
	codec: "V_VP9" | "V_VP8";
	width: number;
	height: number;
}

const ID = {
	ebml: 0x1a45dfa3,
	segment: 0x18538067,
	seekHead: 0x114d9b74,
	seek: 0x4dbb,
	seekId: 0x53ab,
	seekPosition: 0x53ac,
	info: 0x1549a966,
	tracks: 0x1654ae6b,
	cluster: 0x1f43b675,
	cues: 0x1c53bb6b,
} as const;

// SimpleBlock 的相对时间戳是 16 位有符号毫秒，簇跨度留足余量
const MAX_CLUSTER_SPAN = 30_000;

/**
 * 单视频轨 WebM 封装：每个关键帧开新簇，末尾写索引，文件头的 SeekHead 指向信息、轨道与索引。
 *
 * @remarks 时间刻度为 1 毫秒；首帧须为关键帧。
 */
export function createWebmMuxer(track: WebmTrack) {
	const clusters: { time: number; blocks: Uint8Array[] }[] = [];
	return {
		/** 追加一帧编码数据，timestamp 为毫秒。 */
		addFrame(data: Uint8Array, timestamp: number, keyframe: boolean): void {
			const time = Math.round(timestamp);
			let cluster = clusters.at(-1);
			if (!cluster && !keyframe) throw new Error("The first WebM frame must be a keyframe.");
			if (!cluster || keyframe || time - cluster.time > MAX_CLUSTER_SPAN) {
				cluster = { time, blocks: [] };
				clusters.push(cluster);
			}
			const header = new Uint8Array(4);
			header[0] = 0x81;
			new DataView(header.buffer).setInt16(1, time - cluster.time);
			header[3] = keyframe ? 0x80 : 0;
			cluster.blocks.push(element(0xa3, header, data));
		},
		/** 生成文件，duration 为毫秒。 */
		finish(duration: number): Uint8Array<ArrayBuffer> {
			const info = element(
				ID.info,
				element(0x2ad7b1, uint(1_000_000)),
				element(0x4d80, text("@violetjs/inkline")),
				element(0x5741, text("@violetjs/inkline")),
				element(0x4489, float64(duration)),
			);
			const tracks = element(
				ID.tracks,
				element(
					0xae,
					element(0xd7, uint(1)),
					element(0x73c5, uint(1)),
					element(0x83, uint(1)),
					element(0x9c, uint(0)),
					element(0x86, text(track.codec)),
					element(
						0xe0,
						element(0xb0, uint(track.width)),
						element(0xba, uint(track.height)),
					),
				),
			);
			const clusterBytes = clusters.map((c) =>
				element(ID.cluster, element(0xe7, uint(c.time)), ...c.blocks),
			);
			// SeekHead 位置用定长 8 字节，长度与取值无关，先按占位算出布局
			const seekHead = (positions: number[]) =>
				element(
					ID.seekHead,
					...[ID.info, ID.tracks, ID.cues].map((id, i) =>
						element(
							ID.seek,
							element(ID.seekId, idBytes(id)),
							element(ID.seekPosition, uint(positions[i], 8)),
						),
					),
				);
			const headLength = seekHead([0, 0, 0]).length;
			const infoAt = headLength;
			const tracksAt = infoAt + info.length;
			let offset = tracksAt + tracks.length;
			const cuePoints = clusterBytes.map((bytes, i) => {
				const point = element(
					0xbb,
					element(0xb3, uint(clusters[i].time)),
					element(0xb7, element(0xf7, uint(1)), element(0xf1, uint(offset))),
				);
				offset += bytes.length;
				return point;
			});
			const cues = element(ID.cues, ...cuePoints);
			const segment = element(
				ID.segment,
				seekHead([infoAt, tracksAt, offset]),
				info,
				tracks,
				...clusterBytes,
				cues,
			);
			const header = element(
				ID.ebml,
				element(0x4286, uint(1)),
				element(0x42f7, uint(1)),
				element(0x42f2, uint(4)),
				element(0x42f3, uint(8)),
				element(0x4282, text("webm")),
				element(0x4287, uint(4)),
				element(0x4285, uint(2)),
			);
			return concat([header, segment]);
		},
	};
}

function element(id: number, ...children: Uint8Array[]): Uint8Array<ArrayBuffer> {
	const body = concat(children);
	return concat([idBytes(id), size(body.length), body]);
}

/** 元素 ID 自带长度标记位，按数值的有效字节写出。 */
function idBytes(id: number): Uint8Array<ArrayBuffer> {
	const bytes: number[] = [];
	for (let v = id; v > 0; v = Math.floor(v / 256)) bytes.unshift(v % 256);
	return new Uint8Array(bytes);
}

/** EBML 变长整数：首字节的前导零个数决定总长度。 */
function size(value: number): Uint8Array<ArrayBuffer> {
	let length = 1;
	while (length < 8 && value >= 2 ** (7 * length) - 1) length++;
	const bytes = new Uint8Array(length);
	let v = value;
	for (let i = length - 1; i >= 0; i--) {
		bytes[i] = v % 256;
		v = Math.floor(v / 256);
	}
	bytes[0] |= 1 << (8 - length);
	return bytes;
}

function uint(value: number, length?: number): Uint8Array<ArrayBuffer> {
	const bytes: number[] = [];
	for (let v = value; v > 0; v = Math.floor(v / 256)) bytes.unshift(v % 256);
	while (bytes.length < (length ?? 1)) bytes.unshift(0);
	return new Uint8Array(bytes);
}

function float64(value: number): Uint8Array<ArrayBuffer> {
	const bytes = new Uint8Array(8);
	new DataView(bytes.buffer).setFloat64(0, value);
	return bytes;
}

function text(value: string): Uint8Array<ArrayBuffer> {
	return new TextEncoder().encode(value) as Uint8Array<ArrayBuffer>;
}

function concat(parts: readonly Uint8Array[]): Uint8Array<ArrayBuffer> {
	const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
	let offset = 0;
	for (const part of parts) {
		out.set(part, offset);
		offset += part.length;
	}
	return out;
}
