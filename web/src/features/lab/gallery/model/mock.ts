/**
 * /lab/gallery 的静态 mock。
 *
 * 覆盖选型必答的样本形态：横/竖/方图混排（考验网格布局）、视频项（列表态
 * 缩略图 + 灯箱播放）、超长标题与空 caption（考验信息层级）。图片走
 * picsum 固定 seed 保证刷新稳定。
 */
export interface MockItem {
	id: string;
	/** 图片 URL（picsum seed 稳定）；视频项为封面帧 */
	url: string;
	/** 宽高比（width/height），等高行布局的核心输入 */
	ratio: number;
	caption?: string;
	/** 视频项：列表态缩略图由 upload 域 ffmpeg 首帧生成，此处同 url */
	isVideo?: boolean;
	/** 视频源（mock 用公共示例 mp4/webm） */
	videoUrl?: string;
}

export interface MockGallery {
	id: string;
	title: string;
	description: string;
	cover: string;
	author: string;
	createdAt: string;
	itemCount: number;
	items: MockItem[];
}

const img = (seed: string, w: number, h: number) => `https://picsum.photos/seed/${seed}/${w}/${h}`;

/** 详情/灯箱选型的主样本：摄影集——12 项横竖方混排 + 2 个视频 */
export const MOCK_GALLERY: MockGallery = {
	id: "g1",
	title: "深秋的濑户内海",
	description:
		"小豆岛直岛丰岛五日，跳岛拍摄的港口、渡轮与晚霞。视频记录了两段渡轮甲板与一段美术馆光影。",
	cover: img("vg-cover", 800, 1000),
	author: "super",
	createdAt: "2026-10-12",
	itemCount: 14,
	items: [
		{
			id: "i1",
			url: img("vg-1", 1600, 1000),
			ratio: 1.6,
			caption: "高松港的清晨，第一班渡轮离岸",
		},
		{ id: "i2", url: img("vg-2", 900, 1350), ratio: 0.67, caption: "直岛钱汤外的巷口" },
		{ id: "i3", url: img("vg-3", 1200, 1200), ratio: 1 },
		{ id: "i4", url: img("vg-4", 1600, 900), ratio: 1.78, caption: "丰岛美术馆外唯一的直线" },
		{ id: "i5", url: img("vg-5", 1000, 1500), ratio: 0.67 },
		{
			id: "i6",
			url: img("vg-6", 1600, 900),
			ratio: 1.78,
			caption: "渡轮甲板，四十分钟航程的前半",
			isVideo: true,
			videoUrl: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
		},
		{ id: "i7", url: img("vg-7", 1400, 1000), ratio: 1.4, caption: "橄榄公园的风车与濑户大桥" },
		{ id: "i8", url: img("vg-8", 1200, 1200), ratio: 1 },
		{ id: "i9", url: img("vg-9", 900, 1350), ratio: 0.67, caption: "酱油仓库的木梁" },
		{ id: "i10", url: img("vg-10", 1600, 1000), ratio: 1.6 },
		{ id: "i11", url: img("vg-11", 1000, 1500), ratio: 0.67, caption: "暮色里的渔船锚地" },
		{
			id: "i12",
			url: img("vg-12", 1200, 1200),
			ratio: 1,
			caption: "美术馆光井，每分钟都不一样",
			isVideo: true,
			videoUrl: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4",
		},
		{ id: "i13", url: img("vg-13", 1600, 900), ratio: 1.78 },
		{ id: "i14", url: img("vg-14", 1400, 1000), ratio: 1.4, caption: "最后一班回程，甲板无人" },
	],
};

/** 浏览流样本：6 本不同规模/标题长度的图集 */
export const MOCK_GALLERIES: MockGallery[] = [
	MOCK_GALLERY,
	{
		id: "g2",
		title: "2026 前端工具链速览",
		description: "三十张截图梳理构建、测试、部署的三件事。",
		cover: img("vg2-cover", 800, 1000),
		author: "super",
		createdAt: "2026-09-30",
		itemCount: 30,
		items: [],
	},
	{
		id: "g3",
		title: "这一个非常非常非常非常非常长的标题用来考验浏览流卡片在标题超长时的截断与行高表现是否稳健",
		description: "长标题样本。",
		cover: img("vg3-cover", 800, 1000),
		author: "xunrua",
		createdAt: "2026-08-21",
		itemCount: 8,
		items: [],
	},
	{
		id: "g4",
		title: "胶片扫街 · 城南",
		description: "Portra 400 的一卷。",
		cover: img("vg4-cover", 800, 1000),
		author: "DefectingCat",
		createdAt: "2026-07-02",
		itemCount: 24,
		items: [],
	},
	{
		id: "g5",
		title: "服务器机房巡检记录",
		description: "带视频的运维图集样本。",
		cover: img("vg5-cover", 800, 1000),
		author: "super",
		createdAt: "2026-06-18",
		itemCount: 6,
		items: [],
	},
	{
		id: "g6",
		title: "三个月的桌搭迭代",
		description: "",
		cover: img("vg6-cover", 800, 1000),
		author: "JingpengZhang",
		createdAt: "2026-05-09",
		itemCount: 12,
		items: [],
	},
];
