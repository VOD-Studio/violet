import type {
	AppearanceAsset,
	AvatarFrameAsset,
	BubbleThemeAsset,
	ChatAppearance,
} from "./appearance";

/** 不可变兜底:新用户、未知或已下架主题一律回到原始样式。 */
export const EMPTY_APPEARANCE: Readonly<ChatAppearance> = Object.freeze({
	avatar_frame_id: "",
	avatar_charm_id: "",
	bubble_theme_id: "",
});

/** 已核对 RUA 头像框;ID 须与服务端目录保持同步。 */
export const AVATAR_FRAMES: readonly AvatarFrameAsset[] = [
	{
		id: "cat-ears-paws",
		name: "猫耳猫爪",
		image: "/chat-appearance/frames/cat-ears-paws.png",
		scale: 1.35,
	},
	{
		id: "football-castle",
		name: "蓝色足球城堡",
		image: "/chat-appearance/frames/football-castle.png",
		scale: 1.35,
	},
	{
		id: "ivory-flower-moon",
		name: "白花月亮",
		image: "/chat-appearance/frames/ivory-flower-moon.png",
		scale: 1.35,
	},
	{
		id: "moon-cloud",
		name: "星月云朵",
		image: "/chat-appearance/frames/moon-cloud.png",
		scale: 1.48,
	},
	{
		id: "moonstone-orbit",
		name: "月光石星月环绕",
		image: "/chat-appearance/frames/moonstone-orbit.png",
		scale: 1.35,
	},
	{
		id: "pink-hearts",
		name: "粉色爱心蝴蝶结",
		image: "/chat-appearance/frames/pink-hearts.png",
		scale: 1.35,
	},
	{
		id: "rua-laurel-crown",
		name: "RUA 桂冠",
		image: "/chat-appearance/frames/rua-laurel-crown.png",
		scale: 1.35,
	},
	{
		id: "violet-garland",
		name: "紫花月光石",
		image: "/chat-appearance/frames/violet-garland.png",
		scale: 1.35,
	},
];

/** 已核对 RUA 挂件;ID 须与服务端目录保持同步。 */
export const AVATAR_CHARMS: readonly AppearanceAsset[] = [
	{
		id: "a-star-bow",
		name: "星星深蓝蝴蝶结",
		image: "/chat-appearance/charms/a-star-bow.png",
	},
	{
		id: "a-crescent",
		name: "金色弯月",
		image: "/chat-appearance/charms/a-crescent.png",
	},
	{
		id: "a-violet-sprig",
		name: "紫花星饰",
		image: "/chat-appearance/charms/a-violet-sprig.png",
	},
	{
		id: "a-cat-sleeping",
		name: "蜷睡白猫",
		image: "/chat-appearance/charms/a-cat-sleeping.png",
	},
	{
		id: "a-gold-teacup",
		name: "金边茶杯",
		image: "/chat-appearance/charms/a-gold-teacup.png",
	},
	{
		id: "a-feather-quill",
		name: "金边羽毛笔",
		image: "/chat-appearance/charms/a-feather-quill.png",
	},
	{
		id: "a-flower-envelope",
		name: "花封信",
		image: "/chat-appearance/charms/a-flower-envelope.png",
	},
	{
		id: "a-moon-book",
		name: "月亮书本",
		image: "/chat-appearance/charms/a-moon-book.png",
	},
	{
		id: "a-headphones",
		name: "复古耳机",
		image: "/chat-appearance/charms/a-headphones.png",
	},
	{
		id: "a-football",
		name: "足球",
		image: "/chat-appearance/charms/a-football.png",
	},
	{
		id: "a-butterfly",
		name: "紫金蝴蝶",
		image: "/chat-appearance/charms/a-butterfly.png",
	},
	{
		id: "a-pearl-flower",
		name: "珍珠小花",
		image: "/chat-appearance/charms/a-pearl-flower.png",
	},
	{
		id: "a-purple-crown",
		name: "紫宝石皇冠",
		image: "/chat-appearance/charms/a-purple-crown.png",
	},
	{
		id: "a-north-star",
		name: "金色芒星",
		image: "/chat-appearance/charms/a-north-star.png",
	},
	{
		id: "b-moon-lantern",
		name: "月亮提灯",
		image: "/chat-appearance/charms/b-moon-lantern.png",
	},
	{
		id: "b-hourglass",
		name: "月色沙漏",
		image: "/chat-appearance/charms/b-hourglass.png",
	},
	{
		id: "b-book-quill",
		name: "书与羽毛笔",
		image: "/chat-appearance/charms/b-book-quill.png",
	},
	{
		id: "b-cat-on-books",
		name: "黑猫与书",
		image: "/chat-appearance/charms/b-cat-on-books.png",
	},
	{
		id: "c-game-controller",
		name: "游戏手柄",
		image: "/chat-appearance/charms/c-game-controller.png",
	},
	{
		id: "c-ribbon-kitten",
		name: "缎带白猫",
		image: "/chat-appearance/charms/c-ribbon-kitten.png",
	},
	{
		id: "c-bouquet",
		name: "白紫花束",
		image: "/chat-appearance/charms/c-bouquet.png",
	},
	{
		id: "c-crescent-stars",
		name: "弯月与星星",
		image: "/chat-appearance/charms/c-crescent-stars.png",
	},
	{
		id: "c-floral-envelope",
		name: "鲜花信封",
		image: "/chat-appearance/charms/c-floral-envelope.png",
	},
	{
		id: "c-football-bow",
		name: "足球蝴蝶结",
		image: "/chat-appearance/charms/c-football-bow.png",
	},
];

/** 已核对 RUA 气泡主题;ID 须与服务端目录保持同步。 */
export const BUBBLE_THEMES: readonly BubbleThemeAsset[] = [
	{
		id: "game-night",
		name: "夜间联机",
		image: "/chat-appearance/bubbles/game-night/frame-9slice.png",
		ornament: "/chat-appearance/bubbles/game-night/ornament.png",
		ink: "#f0f3ff",
		fill: "#343c58",
		slice: 48,
	},
	{
		id: "ivory-lace",
		name: "珍珠蕾丝",
		image: "/chat-appearance/bubbles/ivory-lace/frame-9slice.png",
		ornament: "/chat-appearance/bubbles/ivory-lace/ornament.png",
		ink: "#49424e",
		fill: "#fffefc",
		slice: 48,
	},
	{
		id: "library-page",
		name: "书页留白",
		image: "/chat-appearance/bubbles/library-page/frame-9slice.png",
		ornament: "/chat-appearance/bubbles/library-page/ornament.png",
		ink: "#4d413d",
		fill: "#fffaf0",
		slice: 48,
	},
	{
		id: "moon-letter",
		name: "月光信笺",
		image: "/chat-appearance/bubbles/moon-letter/frame-9slice.png",
		ornament: "/chat-appearance/bubbles/moon-letter/ornament.png",
		ink: "#443949",
		fill: "#fffdf8",
		slice: 48,
	},
	{
		id: "navy-ribbon",
		name: "缎带私语",
		image: "/chat-appearance/bubbles/navy-ribbon/frame-9slice.png",
		ornament: "/chat-appearance/bubbles/navy-ribbon/ornament.png",
		ink: "#353b57",
		fill: "#fdfbff",
		slice: 48,
	},
	{
		id: "opal-window",
		name: "月光石窗",
		image: "/chat-appearance/bubbles/opal-window/frame-9slice.png",
		ornament: "/chat-appearance/bubbles/opal-window/ornament.png",
		ink: "#39485b",
		fill: "#f5fbff",
		slice: 48,
	},
	{
		id: "sakura-letter",
		name: "樱色来信",
		image: "/chat-appearance/bubbles/sakura-letter/frame-9slice.png",
		ornament: "/chat-appearance/bubbles/sakura-letter/ornament.png",
		ink: "#65414e",
		fill: "#fffafb",
		slice: 48,
	},
	{
		id: "sleepy-cat",
		name: "猫咪软枕",
		image: "/chat-appearance/bubbles/sleepy-cat/frame-9slice.png",
		ornament: "/chat-appearance/bubbles/sleepy-cat/ornament.png",
		ink: "#554256",
		fill: "#fffcfd",
		slice: 48,
	},
	{
		id: "star-orbit",
		name: "星轨低语",
		image: "/chat-appearance/bubbles/star-orbit/frame-9slice.png",
		ornament: "/chat-appearance/bubbles/star-orbit/ornament.png",
		ink: "#faf2ff",
		fill: "#393253",
		slice: 48,
	},
	{
		id: "tea-time",
		name: "奶油茶会",
		image: "/chat-appearance/bubbles/tea-time/frame-9slice.png",
		ornament: "/chat-appearance/bubbles/tea-time/ornament.png",
		ink: "#514033",
		fill: "#fffcf2",
		slice: 48,
	},
	{
		id: "velvet-night",
		name: "午夜丝绒",
		image: "/chat-appearance/bubbles/velvet-night/frame-9slice.png",
		ornament: "/chat-appearance/bubbles/velvet-night/ornament.png",
		ink: "#f8f0e3",
		fill: "#303749",
		slice: 48,
	},
	{
		id: "violet-garden",
		name: "紫藤花窗",
		image: "/chat-appearance/bubbles/violet-garden/frame-9slice.png",
		ornament: "/chat-appearance/bubbles/violet-garden/ornament.png",
		ink: "#493a62",
		fill: "#fbf8ff",
		slice: 48,
	},
];

/** 查表让单条消息的渲染开销为常数。 */
export const FRAME_BY_ID = new Map(AVATAR_FRAMES.map((item) => [item.id, item]));
/** 共享只读挂件查表。 */
export const CHARM_BY_ID = new Map(AVATAR_CHARMS.map((item) => [item.id, item]));
/** 共享只读气泡查表。 */
export const BUBBLE_BY_ID = new Map(BUBBLE_THEMES.map((item) => [item.id, item]));
