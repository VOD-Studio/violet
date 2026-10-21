import { toPlayerLyrics } from "@features/music-player/lib/lyrics";
import { describe, expect, it } from "vitest";

describe("toPlayerLyrics", () => {
	it("归一化不同精度和重复时间标签，并按时间对齐翻译与音译", () => {
		const result = toPlayerLyrics(
			{
				lrc: "[ar:示例歌手]\r\n[00:01.2][00:03.045]你好\r\n[00:05.00]再见",
				translated: "[00:01.200]Hello\n[00:03.045]Hello again\n[00:05]Bye",
				romanized: "[00:01.20]ni hao",
			},
			6000,
		);

		expect(result).toEqual({
			lines: [
				{
					time: 1200,
					duration: 1845,
					text: "你好",
					translation: "Hello",
					romanized: "ni hao",
				},
				{ time: 3045, duration: 1955, text: "你好", translation: "Hello again" },
				{ time: 5000, duration: 1000, text: "再见", translation: "Bye" },
			],
			chorus: [],
			instrumental: false,
		});
	});

	it("原文没有有效时间轴时，不将译文或缺失歌词冒充纯音乐", () => {
		expect(
			toPlayerLyrics(
				{
					lrc: "[ar:歌手]\n没有时间标签",
					translated: "[00:01]Only translation",
					romanized: "",
				},
				6000,
			),
		).toEqual({ lines: [], chorus: [], instrumental: false });
	});
});
