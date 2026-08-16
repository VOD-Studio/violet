/**
 * friends-lab 静态 mock 数据
 *
 * 形状严格对齐共享 Contract 的公开 FriendLinkDTO
 * （GET /api/v1/friend-links 仅 approved 的输出）：
 * 不含 contact_email / status / ip_hash / linkback_url / user_id。
 * 覆盖 avatar_url / description / owner_name 为 null 的样本。
 */

export interface FriendLinkDTO {
	id: string;
	name: string;
	url: string;
	avatar_url: string | null;
	description: string | null;
	owner_name: string | null;
	sort_order: number;
}

/** 头像 URL 提交表单的初值（申请弹窗预览用） */
export interface FriendLinkForm {
	name: string;
	url: string;
	avatar_url: string;
	description: string;
	owner_name: string;
	linkback_url: string;
	contact_email: string;
}

export const EMPTY_FORM: FriendLinkForm = {
	name: "",
	url: "",
	avatar_url: "",
	description: "",
	owner_name: "",
	linkback_url: "",
	contact_email: "",
};

/** 自包含的 SVG data URI 头像：演示 img 渲染路径，离线可用 */
function svgAvatar(letter: string, hue: number): string {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="8" fill="hsl(${hue} 42% 90%)"/><text x="32" y="43" font-family="monospace" font-size="30" font-weight="bold" text-anchor="middle" fill="hsl(${hue} 45% 32%)">${letter}</text></svg>`;
	return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** 取站点 host（去 www. 前缀），用于 mono 域名行 */
export function hostOf(url: string): string {
	try {
		return new URL(url).host.replace(/^www\./, "");
	} catch {
		return url;
	}
}

/** 由 id 派生的确定性微旋转角（明信片墙的错落感，避免随机闪烁） */
export function tiltOf(id: string): number {
	let hash = 0;
	for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
	return ((Math.abs(hash) % 5) - 2) * 0.9;
}

export const MOCK_FRIEND_LINKS: FriendLinkDTO[] = [
	{
		id: "fl-0001",
		name: "山洪博客",
		url: "https://shanhong.dev",
		avatar_url: svgAvatar("洪", 210),
		description: "写前端，也写手冲咖啡的水温曲线。",
		owner_name: "阿洪",
		sort_order: 1,
	},
	{
		id: "fl-0002",
		name: "折返点",
		url: "https://waypoint.blog",
		avatar_url: svgAvatar("折", 152),
		description: "长跑、代码，以及两者之间的中间地带。",
		owner_name: "老折",
		sort_order: 2,
	},
	{
		id: "fl-0003",
		name: "雾岛听风",
		url: "https://kirishima.one",
		avatar_url: svgAvatar("雾", 262),
		description: null,
		owner_name: "雾岛",
		sort_order: 3,
	},
	{
		id: "fl-0004",
		name: "0xFFFF 日志",
		url: "https://ffff.one",
		avatar_url: svgAvatar("F", 24),
		description: "底层、逆向与调试器里的深夜。",
		owner_name: null,
		sort_order: 4,
	},
	{
		id: "fl-0005",
		name: "白日梦卫星",
		url: "https://daydream-sat.com",
		avatar_url: null,
		description: "设计、摄影，以及一切不务正业。",
		owner_name: "卫星",
		sort_order: 5,
	},
	{
		id: "fl-0006",
		name: "碳基补丁",
		url: "https://carbon-patch.net",
		avatar_url: svgAvatar("碳", 84),
		description: null,
		owner_name: "补丁",
		sort_order: 6,
	},
	{
		id: "fl-0007",
		name: "晚风编译器",
		url: "https://nightwind.cc",
		avatar_url: svgAvatar("晚", 336),
		description: "每周一封技术通讯，周二晚准点发出。",
		owner_name: null,
		sort_order: 7,
	},
	{
		id: "fl-0008",
		name: "半山书局",
		url: "https://halfhill.press",
		avatar_url: null,
		description: "读书、手稿与缓慢出版。",
		owner_name: "半山",
		sort_order: 8,
	},
	{
		id: "fl-0009",
		name: "404 花园",
		url: "https://garden404.club",
		avatar_url: null,
		description: null,
		owner_name: null,
		sort_order: 9,
	},
	{
		id: "fl-0010",
		name: "北极星邮政",
		url: "https://polaris-post.net",
		avatar_url: svgAvatar("北", 196),
		description: "信札、星图与长途徒步的沿线邮戳。",
		owner_name: "北极",
		sort_order: 10,
	},
];
