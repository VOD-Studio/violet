import type { MusicLyricDTO } from "@features/music-player/model/types";
import type { LyricLine, Lyrics } from "@violetjs/kite-player";

function parseLrc(source: string): Map<number, string> {
	const lines = new Map<number, string>();
	for (const raw of source.split(/\r?\n/)) {
		const row = raw.trim();
		const prefix = row.match(/^(?:\[\d+:[0-5]\d(?:[.:]\d{1,3})?\])+/)?.[0];
		if (!prefix) continue;
		const text = row.slice(prefix.length).trim();
		for (const match of prefix.matchAll(/\[(\d+):([0-5]\d)(?:[.:](\d{1,3}))?\]/g)) {
			const time =
				(Number(match[1]) * 60 + Number(match[2])) * 1000 +
				Number((match[3] ?? "").padEnd(3, "0"));
			const previous = lines.get(time);
			lines.set(time, previous ? `${previous}\n${text}` : text);
		}
	}
	return lines;
}

/**
 * 将原文、翻译与音译按毫秒时间戳对齐；保留普通 LRC 的行级时间信息。
 *
 * @param lyric - 空歌词不推断为纯音乐；未提供逐字与副歌信息时不生成对应数据
 * @param durationMs - 歌曲时长，用于计算最后一行的持续时间
 * @returns 播放器的歌词时间轴，译文仅匹配相同时间戳的原文行
 */
export function toPlayerLyrics(lyric: MusicLyricDTO, durationMs: number): Lyrics {
	const translated = parseLrc(lyric.translated);
	const romanized = parseLrc(lyric.romanized);
	const entries = Array.from(parseLrc(lyric.lrc)).sort(([left], [right]) => left - right);
	const lines: LyricLine[] = [];
	for (let index = 0; index < entries.length; index += 1) {
		const [time, text] = entries[index];
		const line: LyricLine = { time, text };
		const end = entries[index + 1]?.[0] ?? durationMs;
		if (end > time) line.duration = end - time;
		const translation = translated.get(time);
		if (translation !== undefined) line.translation = translation;
		const romanization = romanized.get(time);
		if (romanization !== undefined) line.romanized = romanization;
		lines.push(line);
	}
	return { lines, chorus: [], instrumental: false };
}
