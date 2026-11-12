import { ProfileProgress, SiteProfile, type SiteProfileProps } from "@shared/ui/site-profile";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";
import { cover, portrait } from "./art";
import { StayLink } from "./stay-link";

const AVATAR = portrait(200);
const SONG = cover(20);
const APP_ICON = portrait(260, "bot");

const IDENTITY = {
	name: "xunrua",
	bio: "写代码的人，也写字。",
	avatar: AVATAR,
	githubHref: "https://github.com/xunrua",
	rssHref: "/feed.xml",
};
const LATEST = {
	post: { title: "测试发送", date: "10.10", href: "/blog/test" },
	note: { title: "实时状态接入，发布 2.22.1", date: "10.29", href: "/notes/realtime" },
};
const YEAR = { year: 2026, dayOfYear: 304, daysLeft: 61, month: 9 };
const DEVICE = "MacBook Pro";
const WINDOW_TITLE = "presence-card.tsx — violet";
const BASE = { identity: IDENTITY, latest: LATEST, year: YEAR };

/** 进度固定在 1:23，展品里不走时。 */
const PROGRESS = <ProfileProgress elapsed="1:23" total="3:45" ratio={0.36} />;

/** 在线时的样子：Nowbeam 目前不下发封面、应用图标与使用时长，所以这些全是占位。 */
const PLAYING_MEDIA = {
	sourceLabel: "正在播放 · 网易云音乐",
	title: "晴天",
	subtitle: "周杰伦 · 叶惠美",
	progress: PROGRESS,
};
const PAUSED_MEDIA = { ...PLAYING_MEDIA, sourceLabel: "已暂停 · QQ 音乐", paused: true };
const ZED = { name: "Zed", detail: WINDOW_TITLE };

type Profile = Pick<SiteProfileProps, "brand" | "label" | "card">;

const BOTH: Profile = {
	label: "Violet 站长档案，此刻正在播放 晴天，也在用 Zed",
	brand: {
		name: "Violet",
		avatar: AVATAR,
		live: {
			cover: {},
			app: {},
			playing: true,
			lines: { primary: "晴天", secondary: "也在用 Zed" },
		},
	},
	card: { ...BASE, now: { deviceName: DEVICE, media: PLAYING_MEDIA, app: ZED } },
};

const PROFILES: Record<string, Profile> = {
	none: {
		label: "Violet 站长档案",
		brand: { name: "Violet", avatar: AVATAR },
		card: BASE,
	},
	playing: {
		label: "Violet 站长档案，此刻正在播放 晴天",
		brand: {
			name: "Violet",
			avatar: AVATAR,
			live: { cover: {}, playing: true, lines: { primary: "晴天", secondary: "周杰伦" } },
		},
		card: { ...BASE, now: { deviceName: DEVICE, media: PLAYING_MEDIA } },
	},
	both: BOTH,
	paused: {
		label: "Violet 站长档案，歌已暂停，在用 Zed",
		brand: {
			name: "Violet",
			avatar: AVATAR,
			live: {
				cover: { paused: true },
				app: {},
				lines: { primary: "Zed", secondary: "音乐已暂停" },
			},
		},
		card: { ...BASE, now: { deviceName: DEVICE, media: PAUSED_MEDIA, app: ZED } },
	},
	"paused-expired": {
		label: "Violet 站长档案，在用 Zed",
		brand: {
			name: "Violet",
			avatar: AVATAR,
			live: { app: {}, lines: { primary: "Zed", secondary: WINDOW_TITLE } },
		},
		card: { ...BASE, now: { deviceName: DEVICE, app: ZED } },
	},
	/** 数据到达后的样子：协议以后下发封面、应用图标与使用时长时的呈现。 */
	artwork: {
		...BOTH,
		brand: {
			name: "Violet",
			avatar: AVATAR,
			live: {
				cover: { src: SONG },
				app: { src: APP_ICON },
				playing: true,
				lines: { primary: "晴天", secondary: "也在用 Zed" },
			},
		},
		card: {
			...BASE,
			now: {
				deviceName: DEVICE,
				media: { ...PLAYING_MEDIA, cover: SONG },
				app: { ...ZED, icon: APP_ICON, usage: "1 时 20 分" },
			},
		},
	},
};

/** 页面正文：卡片长出来时盖住它，能看出面板压在页面上、没有遮罩。 */
function Article() {
	return (
		<div className="absolute inset-x-6 top-24 text-sm leading-7 text-muted-foreground">
			<div className="font-mono text-xs">2026-10-12 · 骑行</div>
			<div className="mt-1 text-2xl font-semibold text-foreground">独库公路，六天</div>
			<p className="mt-3">
				从独山子出发，第一天就爬升两千米。哈希勒根达坂的风把手套吹透，下坡时手指已经握不住刹车。
			</p>
		</div>
	);
}

function PresenceStage({ state }: ExhibitRenderProps) {
	const profile = PROFILES[state] ?? PROFILES.none;
	return (
		<div className="relative size-full">
			<Article />
			<div className="absolute top-6 left-6 flex h-10 items-center">
				<SiteProfile key={state} {...profile} LinkComponent={StayLink} />
			</div>
		</div>
	);
}

export const presenceExhibit: Exhibit = {
	id: "presence",
	name: "实时状态与站长卡片",
	units: ["presence", "profile-card"],
	zone: "stage",
	category: "navigation",
	footprint: { width: 440, height: 560 },
	states: [
		{ id: "none", label: "都没有" },
		{ id: "playing", label: "正在播放" },
		{ id: "both", label: "听歌也在用应用" },
		{ id: "paused", label: "歌已暂停" },
		{ id: "paused-expired", label: "暂停超 5 分钟" },
		{ id: "artwork", label: "有封面与图标" },
	],
	Render: PresenceStage,
};
