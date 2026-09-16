/** 徽章目录项;图片是带字的静态快照,站点以中文版渲染。 */
export interface BadgeAsset {
	/** 服务端白名单接受的稳定 ID。 */
	id: string;
	/** 选择器里展示的中文名称。 */
	name: string;
	/** 同源静态资源,绝不是用户提供的 URL。 */
	image: string;
}

/** 已核对 RUA 徽章;ID 须与服务端目录保持同步,渲染统一用中文版快照。 */
export const CHAT_BADGES: readonly BadgeAsset[] = [
	{ id: "anniversary", name: "相遇纪念", image: "/chat-badges/zh-CN/anniversary.png" },
	{ id: "autumn-story", name: "秋日絮语", image: "/chat-badges/zh-CN/autumn-story.png" },
	{ id: "cat-companion", name: "猫咪伙伴", image: "/chat-badges/zh-CN/cat-companion.png" },
	{ id: "creative", name: "创作中", image: "/chat-badges/zh-CN/creative.png" },
	{ id: "favorite", name: "特别喜欢", image: "/chat-badges/zh-CN/favorite.png" },
	{ id: "first-meeting", name: "初次相遇", image: "/chat-badges/zh-CN/first-meeting.png" },
	{ id: "flower-friend", name: "花间友人", image: "/chat-badges/zh-CN/flower-friend.png" },
	{ id: "football", name: "足球同好", image: "/chat-badges/zh-CN/football.png" },
	{ id: "gaming", name: "游戏中", image: "/chat-badges/zh-CN/gaming.png" },
	{ id: "gentle-support", name: "温柔陪伴", image: "/chat-badges/zh-CN/gentle-support.png" },
	{ id: "moon-postman", name: "月夜邮差", image: "/chat-badges/zh-CN/moon-postman.png" },
	{ id: "moonlight", name: "月光同伴", image: "/chat-badges/zh-CN/moonlight.png" },
	{ id: "music-listening", name: "听歌中", image: "/chat-badges/zh-CN/music-listening.png" },
	{ id: "night-owl", name: "夜猫子", image: "/chat-badges/zh-CN/night-owl.png" },
	{ id: "opal-heart", name: "月光之露", image: "/chat-badges/zh-CN/opal-heart.png" },
	{ id: "reading", name: "阅读中", image: "/chat-badges/zh-CN/reading.png" },
	{ id: "resting", name: "休息中", image: "/chat-badges/zh-CN/resting.png" },
	{ id: "ribbon-friend", name: "蝴蝶结同盟", image: "/chat-badges/zh-CN/ribbon-friend.png" },
	{ id: "rua", name: "站长", image: "/chat-badges/zh-CN/rua.png" },
	{ id: "star-keeper", name: "星光守护", image: "/chat-badges/zh-CN/star-keeper.png" },
	{ id: "starlight-wish", name: "星愿", image: "/chat-badges/zh-CN/starlight-wish.png" },
	{ id: "tea-party", name: "茶会成员", image: "/chat-badges/zh-CN/tea-party.png" },
	{ id: "violet-letter", name: "紫罗兰来信", image: "/chat-badges/zh-CN/violet-letter.png" },
	{ id: "winter-letter", name: "冬日来信", image: "/chat-badges/zh-CN/winter-letter.png" },
];

/** 共享只读徽章查表。 */
export const BADGE_BY_ID = new Map(CHAT_BADGES.map((item) => [item.id, item]));
