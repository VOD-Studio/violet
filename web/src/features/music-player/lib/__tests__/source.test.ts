import { createMusicSource } from "@features/music-player/lib/source";
import { httpClient } from "@shared/api/http";
import { afterEach, describe, expect, it } from "vitest";

const originalAdapter = httpClient.defaults.adapter;
afterEach(() => {
	httpClient.defaults.adapter = originalAdapter;
});

describe("createMusicSource", () => {
	it.each([
		"repeated",
		"missing",
	])("拒绝将 %s 后续页伪装成完整歌单，并停止继续请求", async (kind) => {
		const pages: number[] = [];
		httpClient.defaults.adapter = async (config) => {
			const page = Number(config.params.page);
			pages.push(page);
			const songs =
				page === 1 || kind === "repeated"
					? [
							{ id: "11", name: "第一首", artists: [] },
							{ id: "12", name: "第二首", artists: [] },
						]
					: [];
			return {
				data: { data: songs, meta: { pagination: { page, limit: 100, total: 4 } } },
				status: 200,
				statusText: "OK",
				headers: {},
				config,
			};
		};
		const source = createMusicSource([
			{ id: "7", name: "公开歌单", creator: "站长", cover_url: "", track_count: 4 },
		]);

		await expect(source.playlist("7")).rejects.toBeInstanceOf(Error);
		expect(pages).toEqual([1, 2]);
	});
});
