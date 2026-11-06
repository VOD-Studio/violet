import { describe, expect, it } from "vitest";
import type { Presence, PresenceDevice, PresenceMedia } from "../../model/types";
import {
	liveDevices,
	PAUSED_MEDIA_TTL_MS,
	type PresenceReceipt,
	pausedExpiryTimes,
	trackPausedSince,
} from "../presence";

const media = (overrides: Partial<PresenceMedia> = {}): PresenceMedia => ({
	session_id: "session-1",
	player_name: "QQ 音乐",
	title: "晴天",
	artist: "周杰伦",
	album: "叶惠美",
	state: "paused",
	duration_ms: 269_000,
	position_ms: 102_000,
	rate: 0,
	...overrides,
});

const device = (sources: Partial<PresenceDevice["sources"]> = {}): PresenceDevice => ({
	id: "mbp",
	display_name: "MacBook Pro",
	updated_at: "2026-10-28T12:00:00.000Z",
	// 租约足够长，只观察暂停超时
	expires_at: "2026-10-28T15:00:00.000Z",
	sources: { application: null, window: null, media: null, ...sources },
});

const snapshot = (...devices: PresenceDevice[]): Presence => ({
	generated_at: "2026-10-28T12:00:10.000Z",
	devices,
});

const T0 = Date.parse("2026-10-28T12:00:10.000Z");

describe("trackPausedSince", () => {
	it("首次收到暂停的媒体就记下接收时刻，继续暂停时保持最早时刻", () => {
		const first = trackPausedSince(undefined, snapshot(device({ media: media() })), T0);
		expect(Object.values(first)).toEqual([T0]);

		const later = trackPausedSince(
			{ presence: snapshot(), receivedAt: T0, pausedSince: first },
			snapshot(device({ media: media() })),
			T0 + 30_000,
		);
		expect(Object.values(later)).toEqual([T0]);
	});

	it("正在播放的媒体不记录；恢复播放后再暂停重新计时", () => {
		const playing = trackPausedSince(
			undefined,
			snapshot(device({ media: media({ state: "playing", rate: 1 }) })),
			T0,
		);
		expect(playing).toEqual({});

		const paused = trackPausedSince(
			{ presence: snapshot(), receivedAt: T0, pausedSince: { "mbp/session-1": T0 } },
			snapshot(device({ media: media() })),
			T0 + 60_000,
		);
		expect(paused["mbp/session-1"]).toBe(T0);

		const afterResume = trackPausedSince(
			{ presence: snapshot(), receivedAt: T0 + 60_000, pausedSince: paused },
			snapshot(device({ media: media({ state: "playing", rate: 1 }) })),
			T0 + 120_000,
		);
		expect(afterResume).toEqual({});
		const pausedAgain = trackPausedSince(
			{ presence: snapshot(), receivedAt: T0 + 120_000, pausedSince: afterResume },
			snapshot(device({ media: media() })),
			T0 + 180_000,
		);
		expect(pausedAgain["mbp/session-1"]).toBe(T0 + 180_000);
	});

	it("换曲（会话变化）重新计时，媒体消失后不再保留", () => {
		const previous: PresenceReceipt = {
			presence: snapshot(),
			receivedAt: T0,
			pausedSince: { "mbp/session-1": T0 },
		};
		const next = trackPausedSince(
			previous,
			snapshot(device({ media: media({ session_id: "session-2" }) })),
			T0 + 60_000,
		);
		expect(next).toEqual({ "mbp/session-2": T0 + 60_000 });
		expect(trackPausedSince(previous, snapshot(device()), T0 + 60_000)).toEqual({});
	});
});

describe("liveDevices 暂停超时", () => {
	const receipt = (pausedSince: Record<string, number>): PresenceReceipt => ({
		presence: snapshot(device({ media: media(), application: { display_name: "Zed" } })),
		receivedAt: T0,
		pausedSince,
	});

	it("暂停未满 5 分钟保留媒体，满 5 分钟去掉媒体、其余来源不动", () => {
		const r = receipt({ "mbp/session-1": T0 });
		const before = liveDevices(r, T0 + PAUSED_MEDIA_TTL_MS - 1)[0];
		expect(before.sources.media?.title).toBe("晴天");

		const after = liveDevices(r, T0 + PAUSED_MEDIA_TTL_MS)[0];
		expect(after.sources.media).toBeNull();
		expect(after.sources.application?.display_name).toBe("Zed");
	});

	it("正在播放的媒体不受超时影响", () => {
		const playing = {
			presence: snapshot(device({ media: media({ state: "playing", rate: 1 }) })),
			receivedAt: T0,
			pausedSince: {},
		};
		expect(liveDevices(playing, T0 + 60 * 60_000)[0].sources.media?.state).toBe("playing");
	});

	it("没有 pausedSince 记录的暂停媒体（旧缓存）不会被误删", () => {
		const legacy = { presence: receipt({}).presence, receivedAt: T0 };
		expect(liveDevices(legacy, T0 + 60 * 60_000)[0].sources.media).not.toBeNull();
	});
});

describe("pausedExpiryTimes", () => {
	it("给出各暂停媒体的超时时刻，供 hook 排程到点重算", () => {
		const r: PresenceReceipt = {
			presence: snapshot(device({ media: media() })),
			receivedAt: T0,
			pausedSince: { "mbp/session-1": T0 + 1_000 },
		};
		expect(pausedExpiryTimes(r)).toEqual([T0 + 1_000 + PAUSED_MEDIA_TTL_MS]);
		expect(pausedExpiryTimes(undefined)).toEqual([]);
	});
});
