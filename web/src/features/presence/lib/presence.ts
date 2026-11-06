import type {
	Presence,
	PresenceApplication,
	PresenceDevice,
	PresenceMedia,
	PresenceWindow,
} from "../model/types";

/** 暂停超过这么久，封面从药丸里收起，媒体不再展示。 */
export const PAUSED_MEDIA_TTL_MS = 5 * 60_000;

/** 收到的一份公开状态，附本机接收时刻用于换算服务端时间。 */
export interface PresenceReceipt {
	presence: Presence;
	/** 本机 Date.now()，与 presence.generated_at 对应同一时刻 */
	receivedAt: number;
	/**
	 * 暂停中的媒体会话 → 本机首次收到它处于暂停的时刻。
	 * 心跳会刷新快照时间，服务端没有暂停起点，所以由前端从首次观察起算；省略表示没有在追踪。
	 */
	pausedSince?: Record<string, number>;
}

/** 媒体会话在 {@link PresenceReceipt.pausedSince} 里的键。 */
const pausedKey = (device: PresenceDevice, media: PresenceMedia) =>
	`${device.id}/${media.session_id}`;

/**
 * 根据上一份收据与新快照，算出新快照的 pausedSince：
 * 继续暂停的保留最早时刻，恢复播放、换曲或消失的丢弃，新进入暂停的从 `receivedAt` 起算。
 */
export function trackPausedSince(
	previous: PresenceReceipt | undefined,
	presence: Presence,
	receivedAt: number,
): Record<string, number> {
	const since: Record<string, number> = {};
	for (const device of presence.devices) {
		const media = device.sources.media;
		if (media?.state !== "paused") continue;
		const key = pausedKey(device, media);
		since[key] = previous?.pausedSince?.[key] ?? receivedAt;
	}
	return since;
}

/** 各暂停媒体的超时时刻（本机时钟），供排程到点重算。 */
export function pausedExpiryTimes(receipt: PresenceReceipt | undefined): number[] {
	if (!receipt?.pausedSince) return [];
	return Object.values(receipt.pausedSince).map((since) => since + PAUSED_MEDIA_TTL_MS);
}

/** 一条可单独展示的活动，按展示优先级排列。 */
export type PresenceActivity =
	| { kind: "media"; media: PresenceMedia }
	| { kind: "application"; application: PresenceApplication }
	| { kind: "window"; window: PresenceWindow };

/**
 * 以服务端时钟估计「现在」，不依赖本机时钟是否准确。
 *
 * @param now - 本机 Date.now()
 */
export function serverNow(receipt: PresenceReceipt, now: number): number {
	return Date.parse(receipt.presence.generated_at) + (now - receipt.receivedAt);
}

/** 去掉已暂停超时的媒体，其余来源原样保留。没有追踪记录的暂停媒体视为未超时。 */
function withoutExpiredPause(
	device: PresenceDevice,
	receipt: PresenceReceipt,
	now: number,
): PresenceDevice {
	const media = device.sources.media;
	if (media?.state !== "paused") return device;
	const since = receipt.pausedSince?.[pausedKey(device, media)];
	if (since === undefined || now - since < PAUSED_MEDIA_TTL_MS) return device;
	return { ...device, sources: { ...device.sources, media: null } };
}

/** 过滤掉租约已到期的设备，并去掉暂停超时的媒体；推送中断时也要按期停止展示。 */
export function liveDevices(receipt: PresenceReceipt | undefined, now: number): PresenceDevice[] {
	if (!receipt) return [];
	const current = serverNow(receipt, now);
	return receipt.presence.devices
		.filter((device) => Date.parse(device.expires_at) > current)
		.map((device) => withoutExpiredPause(device, receipt, now));
}

/**
 * 设备当前可展示的活动：正在播放 → 前台应用 → 已暂停 → 窗口标题。
 *
 * 窗口标题只在没有应用来源时单列；有应用时它作为应用的补充出现在详情里。
 */
export function deviceActivities(device: PresenceDevice): PresenceActivity[] {
	const { application, window, media } = device.sources;
	const activities: PresenceActivity[] = [];
	if (media?.state === "playing") activities.push({ kind: "media", media });
	if (application) activities.push({ kind: "application", application });
	if (media?.state === "paused") activities.push({ kind: "media", media });
	if (!application && window) activities.push({ kind: "window", window });
	return activities;
}

const RANK = { playing: 0, application: 1, paused: 2, window: 3 } as const;

function rank(device: PresenceDevice): number {
	const [first] = deviceActivities(device);
	if (!first) return 4;
	if (first.kind === "media") return RANK[first.media.state];
	return RANK[first.kind];
}

/**
 * 选出顶栏展示的主设备：活动优先级最高者，同级取服务端顺序靠前的，避免刷新时来回跳。
 */
export function leadDevice(devices: PresenceDevice[]): PresenceDevice | null {
	let lead: PresenceDevice | null = null;
	for (const device of devices) {
		if (!lead || rank(device) < rank(lead)) lead = device;
	}
	return lead;
}

/**
 * 推算媒体当前位置（毫秒）。
 *
 * 只有播放中且位置、速率都可靠时才按锚点推进，并截在时长内；暂停时原样返回；
 * 位置未知返回 null，调用方不应绘制进度。
 */
export function mediaPosition(
	media: PresenceMedia,
	device: PresenceDevice,
	nowOnServer: number,
): number | null {
	if (media.position_ms === null) return null;
	if (media.state !== "playing" || media.rate === null) return media.position_ms;
	const elapsed = Math.max(0, nowOnServer - Date.parse(device.updated_at));
	const position = media.position_ms + elapsed * media.rate;
	return media.duration_ms === null ? position : Math.min(position, media.duration_ms);
}

/** 毫秒格式化为 m:ss，超过一小时为 h:mm:ss。 */
export function formatClock(ms: number): string {
	const total = Math.max(0, Math.floor(ms / 1000));
	const hours = Math.floor(total / 3600);
	const minutes = Math.floor((total % 3600) / 60);
	const seconds = String(total % 60).padStart(2, "0");
	return hours > 0
		? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}`
		: `${minutes}:${seconds}`;
}

/** 活动的一行无障碍描述，供折叠态的 aria-label 与 title。 */
export function describeActivity(activity: PresenceActivity): string {
	switch (activity.kind) {
		case "media": {
			const { media } = activity;
			const verb = media.state === "playing" ? "正在播放" : "已暂停";
			return media.artist
				? `${verb}：${media.title} — ${media.artist}`
				: `${verb}：${media.title}`;
		}
		case "application":
			return `正在使用 ${activity.application.display_name}`;
		case "window":
			return `正在查看 ${activity.window.title}`;
	}
}
