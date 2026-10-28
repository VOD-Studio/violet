import { describe, expect, it } from "vitest";
import type { PresenceDevice, PresenceMedia } from "../../model/types";
import {
	describeActivity,
	deviceActivities,
	formatClock,
	leadDevice,
	liveDevices,
	mediaPosition,
	serverNow,
} from "../presence";

const media = (overrides: Partial<PresenceMedia> = {}): PresenceMedia => ({
	session_id: "30000000-0000-4000-8000-000000000003",
	player_name: "QQ 音乐",
	title: "晴天",
	artist: "周杰伦",
	album: "叶惠美",
	state: "playing",
	duration_ms: 269_000,
	position_ms: 102_000,
	rate: 1,
	...overrides,
});

const device = (
	id: string,
	sources: Partial<PresenceDevice["sources"]> = {},
	updatedAt = "2026-10-28T12:00:00.000Z",
): PresenceDevice => ({
	id,
	display_name: id,
	updated_at: updatedAt,
	expires_at: "2026-10-28T12:00:45.000Z",
	sources: { application: null, window: null, media: null, ...sources },
});

describe("serverNow / liveDevices", () => {
	const receipt = {
		presence: {
			generated_at: "2026-10-28T12:00:10.000Z",
			devices: [device("MacBook Pro")],
		},
		// 本机时钟比服务端快一小时，换算后不受影响
		receivedAt: Date.parse("2026-10-28T13:00:10.000Z"),
	};

	it("按服务端时钟换算，不依赖本机时钟", () => {
		expect(serverNow(receipt, receipt.receivedAt + 5_000)).toBe(
			Date.parse("2026-10-28T12:00:15.000Z"),
		);
	});

	it("租约到期后不再展示", () => {
		expect(liveDevices(receipt, receipt.receivedAt + 34_000)).toHaveLength(1);
		expect(liveDevices(receipt, receipt.receivedAt + 35_000)).toHaveLength(0);
		expect(liveDevices(undefined, 0)).toEqual([]);
	});
});

describe("deviceActivities / leadDevice", () => {
	it("播放中优先于应用，暂停排在应用之后", () => {
		const app = { display_name: "Code" };
		expect(
			deviceActivities(device("a", { application: app, media: media() })).map((a) => a.kind),
		).toEqual(["media", "application"]);
		expect(
			deviceActivities(
				device("a", { application: app, media: media({ state: "paused", rate: 0 }) }),
			).map((a) => a.kind),
		).toEqual(["application", "media"]);
	});

	it("窗口标题只在没有应用时单列", () => {
		const window = { title: "HeaderIsland.tsx — violet" };
		expect(deviceActivities(device("a", { window })).map((a) => a.kind)).toEqual(["window"]);
		expect(
			deviceActivities(device("a", { window, application: { display_name: "Code" } })).map(
				(a) => a.kind,
			),
		).toEqual(["application"]);
	});

	it("主设备取活动优先级最高者，同级保持服务端顺序", () => {
		const coding = device("mini", { application: { display_name: "Xcode" } });
		const playing = device("mbp", { media: media() });
		const idle = device("idle");
		expect(leadDevice([coding, playing, idle])?.id).toBe("mbp");
		expect(
			leadDevice([coding, device("other", { application: { display_name: "X" } })])?.id,
		).toBe("mini");
		expect(leadDevice([idle])?.id).toBe("idle");
		expect(leadDevice([])).toBeNull();
	});
});

describe("mediaPosition", () => {
	const anchor = Date.parse("2026-10-28T12:00:00.000Z");

	it("播放中按锚点与速率推进，并截在时长内", () => {
		const d = device("a");
		expect(mediaPosition(media(), d, anchor + 3_000)).toBe(105_000);
		expect(mediaPosition(media({ rate: 2 }), d, anchor + 3_000)).toBe(108_000);
		expect(mediaPosition(media(), d, anchor + 10 * 60_000)).toBe(269_000);
	});

	it("暂停或速率未知时不推进，位置未知返回 null", () => {
		const d = device("a");
		expect(mediaPosition(media({ state: "paused", rate: 0 }), d, anchor + 3_000)).toBe(102_000);
		expect(mediaPosition(media({ rate: null }), d, anchor + 3_000)).toBe(102_000);
		expect(mediaPosition(media({ position_ms: null }), d, anchor + 3_000)).toBeNull();
	});
});

describe("formatClock / describeActivity", () => {
	it("格式化时钟", () => {
		expect(formatClock(102_000)).toBe("1:42");
		expect(formatClock(3_725_000)).toBe("1:02:05");
		expect(formatClock(-5)).toBe("0:00");
	});

	it("描述活动", () => {
		expect(describeActivity({ kind: "media", media: media() })).toBe("正在播放：晴天 — 周杰伦");
		expect(
			describeActivity({
				kind: "media",
				media: media({ state: "paused", rate: 0, artist: null }),
			}),
		).toBe("已暂停：晴天");
		expect(
			describeActivity({ kind: "application", application: { display_name: "Code" } }),
		).toBe("正在使用 Code");
	});
});
