import { createMusicSource } from "@features/music-player/lib/source";
import { httpClient } from "@shared/api/http";
import { afterEach, describe, expect, it } from "vitest";

const originalAdapter = httpClient.defaults.adapter;
afterEach(() => {
	httpClient.defaults.adapter = originalAdapter;
});

function pagedAdapter(handler: (page: number) => { songs: unknown[]; total?: number }) {
	const pages: number[] = [];
	httpClient.defaults.adapter = async (config) => {
		const page = Number(config.params.page);
		pages.push(page);
		const { songs, total } = handler(page);
		return {
			data: {
				data: songs,
				meta: { pagination: { page, limit: 100, total: total ?? songs.length } },
			},
			status: 200,
			statusText: "OK",
			headers: {},
			config,
		};
	};
	return pages;
}

const PLAYLIST = [{ id: "7", name: "公开歌单", creator: "站长", cover_url: "", track_count: 2 }];

describe("createMusicSource", () => {
	it.each([
		"repeated",
		"missing",
	])("拒绝将 %s 后续页伪装成完整歌单，并停止继续请求", async (kind) => {
		const pages = pagedAdapter((page) => ({
			songs:
				page === 1 || kind === "repeated"
					? [
							{ id: "11", name: "第一首", artists: [] },
							{ id: "12", name: "第二首", artists: [] },
						]
					: [],
			total: 4,
		}));
		const source = createMusicSource(PLAYLIST, "anonymous");

		await expect(source.playlist("7")).rejects.toBeInstanceOf(Error);
		expect(pages).toEqual([1, 2]);
	});

	it("anonymous 模式下仅免费曲目可播，vip 与付费曲目置灰", async () => {
		pagedAdapter(() => ({
			songs: [
				{ id: "11", name: "免费", artists: [] },
				{ id: "12", name: "VIP", artists: [], fee: 1 },
				{ id: "13", name: "付费专辑", artists: [], fee: 4 },
			],
		}));
		const source = createMusicSource(PLAYLIST, "anonymous");

		const playlist = await source.playlist("7");
		expect(playlist.tracks.map((track) => [track.access, track.playable])).toEqual([
			["free", true],
			["vip", false],
			["paid", false],
		]);
	});

	it("account 模式下受限曲目也可发起播放，由解析端点决定实际权益", async () => {
		pagedAdapter(() => ({
			songs: [
				{ id: "11", name: "免费", artists: [] },
				{ id: "12", name: "VIP", artists: [], fee: 1 },
				{ id: "13", name: "付费专辑", artists: [], fee: 4 },
			],
		}));
		const source = createMusicSource(PLAYLIST, "account");

		const playlist = await source.playlist("7");
		expect(playlist.tracks.every((track) => track.playable)).toBe(true);
	});

	it("track 刷新路径在 account 模式下按解析结果修正可播性", async () => {
		httpClient.defaults.adapter = async (config) => {
			if (config.url?.includes("/url")) {
				return {
					data: {
						data: {
							id: "12",
							url: null,
							playable: false,
							trial: false,
							format: "",
							bitrate: 0,
							size: 0,
						},
					},
					status: 200,
					statusText: "OK",
					headers: {},
					config,
				};
			}
			return {
				data: { data: { id: "12", name: "VIP", artists: [], fee: 1 } },
				status: 200,
				statusText: "OK",
				headers: {},
				config,
			};
		};
		const source = createMusicSource(PLAYLIST, "account");

		const track = await source.track("12");
		expect(track.playable).toBe(false);
	});
});
