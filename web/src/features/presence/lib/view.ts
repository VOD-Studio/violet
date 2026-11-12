import type { NavbarLive } from "@shared/ui/site-navbar";
import type { ProfileNow } from "@shared/ui/site-profile";
import type { PresenceDevice } from "../model/types";
import { describeActivity, deviceActivities } from "./presence";

/**
 * logo 药丸里的此刻：头像后叠封面或应用图标，文字只说一件事，播放中的歌优先。
 *
 * @param device - 顶栏展示的主设备；无人在线为 null
 * @returns 没有可展示的来源时为 undefined，药丸回到字标
 */
export function navbarLive(device: PresenceDevice | null): NavbarLive | undefined {
	if (!device) return undefined;
	const { media, application, window } = device.sources;
	if (!media && !application && !window) return undefined;

	const playing = media?.state === "playing";
	const live: NavbarLive = { playing };
	if (media) live.cover = { paused: !playing };
	if (application || window) live.app = {};

	if (playing && media) {
		live.lines = application
			? { primary: media.title, secondary: `也在用 ${application.display_name}` }
			: { primary: media.title, ...(media.artist ? { secondary: media.artist } : {}) };
	} else if (application) {
		const secondary = media ? "音乐已暂停" : window?.title;
		live.lines = { primary: application.display_name, ...(secondary ? { secondary } : {}) };
	} else if (window) {
		live.lines = { primary: window.title };
	}
	return live;
}

/**
 * logo 药丸（点开站长卡片的按钮）的可访问名称。
 *
 * 药丸上有两行文字时名称把它们按所见顺序包含进去，语音控制说出所见文字就能点中；
 * 只有字标时补一句描述，让读屏用户也知道有暂停的歌。
 */
export function profileLabel(siteName: string, device: PresenceDevice | null): string {
	const base = `${siteName} 站长档案`;
	if (!device) return base;
	const lines = navbarLive(device)?.lines;
	if (lines) return `${base}，此刻 ${[lines.primary, lines.secondary].filter(Boolean).join(" ")}`;
	const [activity] = deviceActivities(device);
	return activity ? `${base}，此刻${describeActivity(activity)}` : base;
}

/**
 * 站长卡片里的「此刻」：来源、歌曲与应用。进度由调用方按需放进 `media.progress`，
 * 封面、应用图标与使用时长后端没有下发，一律缺省。
 *
 * @returns 没有媒体也没有应用或窗口时为 undefined，卡片不出现这一块
 */
export function profileNow(device: PresenceDevice | null): ProfileNow | undefined {
	if (!device) return undefined;
	const { media, application, window } = device.sources;
	const now: ProfileNow = { deviceName: device.display_name };

	if (media) {
		const subtitle = [media.artist, media.album].filter(Boolean).join(" · ");
		now.media = {
			sourceLabel: `${media.state === "playing" ? "正在播放" : "已暂停"} · ${media.player_name}`,
			title: media.title,
			...(subtitle ? { subtitle } : {}),
			paused: media.state === "paused",
		};
	}
	if (application) {
		now.app = {
			name: application.display_name,
			...(window ? { detail: window.title } : {}),
		};
	} else if (window) {
		now.app = { name: window.title };
	}
	return now.media || now.app ? now : undefined;
}
