import type {
	Presence,
	PresenceApplication,
	PresenceDevice,
	PresenceMedia,
	PresenceWindow,
} from "../model/types";

/** 收到的一份公开状态，附本机接收时刻用于换算服务端时间。 */
export interface PresenceReceipt {
	presence: Presence;
	/** 本机 Date.now()，与 presence.generated_at 对应同一时刻 */
	receivedAt: number;
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

/** 过滤掉租约已到期的设备；推送中断时也要按期停止展示。 */
export function liveDevices(receipt: PresenceReceipt | undefined, now: number): PresenceDevice[] {
	if (!receipt) return [];
	const current = serverNow(receipt, now);
	return receipt.presence.devices.filter((device) => Date.parse(device.expires_at) > current);
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
