import { describe, expect, it } from "vitest";
import type { PresenceDevice, PresenceMedia } from "../../model/types";
import { navbarLive, profileLabel, profileNow } from "../view";

const media = (overrides: Partial<PresenceMedia> = {}): PresenceMedia => ({
	session_id: "s",
	player_name: "网易云音乐",
	title: "晴天",
	artist: "周杰伦",
	album: "叶惠美",
	state: "playing",
	duration_ms: 269_000,
	position_ms: 102_000,
	rate: 1,
	...overrides,
});
const paused = (overrides: Partial<PresenceMedia> = {}) =>
	media({ state: "paused", rate: 0, ...overrides });

const device = (sources: Partial<PresenceDevice["sources"]> = {}): PresenceDevice => ({
	id: "mbp",
	display_name: "MacBook Pro",
	updated_at: "2026-10-28T12:00:00.000Z",
	expires_at: "2026-10-28T12:00:45.000Z",
	sources: { application: null, window: null, media: null, ...sources },
});
const zed = { display_name: "Zed" };

describe("navbarLive 药丸里的此刻", () => {
	it("什么都没有：没有此刻状态，药丸显示字标", () => {
		expect(navbarLive(null)).toBeUndefined();
		expect(navbarLive(device())).toBeUndefined();
	});

	it("正在播放：封面、均衡器，歌名与艺人", () => {
		expect(navbarLive(device({ media: media() }))).toEqual({
			cover: { paused: false },
			playing: true,
			lines: { primary: "晴天", secondary: "周杰伦" },
		});
	});

	it("听歌也在用应用：封面与应用图标，第二行说也在用 Zed", () => {
		expect(navbarLive(device({ media: media(), application: zed }))).toEqual({
			cover: { paused: false },
			app: {},
			playing: true,
			lines: { primary: "晴天", secondary: "也在用 Zed" },
		});
	});

	it("只有应用：应用图标，应用名与窗口标题，没有均衡器", () => {
		expect(
			navbarLive(device({ application: zed, window: { title: "presence-card.tsx" } })),
		).toEqual({
			app: {},
			playing: false,
			lines: { primary: "Zed", secondary: "presence-card.tsx" },
		});
	});

	it("歌已暂停且在用应用：封面变灰留在原位，文字让给应用", () => {
		expect(navbarLive(device({ media: paused(), application: zed }))).toEqual({
			cover: { paused: true },
			app: {},
			playing: false,
			lines: { primary: "Zed", secondary: "音乐已暂停" },
		});
	});

	it("歌已暂停且没有应用：封面变灰，文字回到字标", () => {
		expect(navbarLive(device({ media: paused() }))).toEqual({
			cover: { paused: true },
			playing: false,
		});
	});

	it("艺人缺失时第二行省略", () => {
		expect(navbarLive(device({ media: media({ artist: null }) }))?.lines).toEqual({
			primary: "晴天",
		});
	});

	it("只有窗口标题：按应用处理，标题是唯一文字", () => {
		expect(navbarLive(device({ window: { title: "设计稿" } }))).toEqual({
			app: {},
			playing: false,
			lines: { primary: "设计稿" },
		});
	});
});

describe("profileNow 卡片里的此刻", () => {
	it("没有媒体也没有应用：不出现此刻区", () => {
		expect(profileNow(device())).toBeUndefined();
		expect(profileNow(device({ window: null }))).toBeUndefined();
	});

	it("正在播放：来源、歌名、艺人与专辑", () => {
		expect(profileNow(device({ media: media() }))).toEqual({
			deviceName: "MacBook Pro",
			media: {
				sourceLabel: "正在播放 · 网易云音乐",
				title: "晴天",
				subtitle: "周杰伦 · 叶惠美",
				paused: false,
			},
		});
	});

	it("暂停：来源写已暂停并标记 paused；艺人专辑缺失时副标题省略", () => {
		expect(profileNow(device({ media: paused({ artist: null, album: null }) }))?.media).toEqual(
			{
				sourceLabel: "已暂停 · 网易云音乐",
				title: "晴天",
				paused: true,
			},
		);
	});

	it("应用：名称与窗口标题，没有使用时长字段", () => {
		expect(
			profileNow(
				device({ application: zed, window: { title: "presence-card.tsx — violet" } }),
			)?.app,
		).toEqual({ name: "Zed", detail: "presence-card.tsx — violet" });
	});

	it("只有窗口标题：当作应用名", () => {
		expect(profileNow(device({ window: { title: "设计稿" } }))?.app).toEqual({
			name: "设计稿",
		});
	});
});

describe("profileLabel 药丸的可访问名称", () => {
	it("没有此刻状态：只有站名与站长档案", () => {
		expect(profileLabel("Violet", null)).toBe("Violet 站长档案");
		expect(profileLabel("Violet", device())).toBe("Violet 站长档案");
	});

	it("名称包含药丸上看得见的两行文字，语音控制说出所见即可点中", () => {
		expect(profileLabel("Violet", device({ media: media() }))).toBe(
			"Violet 站长档案，此刻 晴天 周杰伦",
		);
		expect(profileLabel("Violet", device({ media: media(), application: zed }))).toBe(
			"Violet 站长档案，此刻 晴天 也在用 Zed",
		);
		expect(profileLabel("Violet", device({ media: paused(), application: zed }))).toBe(
			"Violet 站长档案，此刻 Zed 音乐已暂停",
		);
	});

	it("只有一行文字时不留多余空格", () => {
		expect(profileLabel("Violet", device({ window: { title: "设计稿" } }))).toBe(
			"Violet 站长档案，此刻 设计稿",
		);
	});

	it("歌已暂停且没有应用：药丸上只有字标，名称补一句暂停说明", () => {
		expect(profileLabel("Violet", device({ media: paused() }))).toBe(
			"Violet 站长档案，此刻已暂停：晴天 — 周杰伦",
		);
	});
});
