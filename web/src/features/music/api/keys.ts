/**
 * musicKeys - 音乐查询的 query key 工厂
 *
 * 用工厂模式集中管理 key，避免散落字符串导致缓存失效不彻底。
 * 公开解析与后台歌单管理分维度组织，便于按维度 invalidate。
 */
export const musicKeys = {
	/** 音乐模块根 key */
	all: ["music"] as const,

	// --- 公开解析维度（前台播放器） ---
	/** 公开解析维度 */
	publicMusic: () => [...musicKeys.all, "public"] as const,
	/**
	 * 解析音乐嵌入信息
	 *
	 * @param url 音乐链接
	 */
	embed: (url: string) => [...musicKeys.publicMusic(), "embed", url] as const,
	/**
	 * 解析歌单链接
	 *
	 * @param url 歌单链接
	 */
	playlistParse: (url: string) =>
		[...musicKeys.publicMusic(), "playlist-parse", url] as const,
	/**
	 * 获取歌曲详情
	 *
	 * @param query 平台与歌曲 ID
	 */
	songDetail: (query: { platform?: string; id: string }) =>
		[...musicKeys.publicMusic(), "song-detail", query] as const,
	/**
	 * 搜索歌曲
	 *
	 * @param query 关键词与条数上限
	 */
	search: (query: { keyword: string; limit?: number }) =>
		[...musicKeys.publicMusic(), "search", query] as const,
	/**
	 * 获取歌词
	 *
	 * @param query 平台与歌曲 ID
	 */
	lyrics: (query: { platform?: string; id: string }) =>
		[...musicKeys.publicMusic(), "lyrics", query] as const,
	/**
	 * 获取歌曲元数据
	 *
	 * @param query 平台与歌曲 ID
	 */
	songMeta: (query: { platform?: string; id: string }) =>
		[...musicKeys.publicMusic(), "song-meta", query] as const,
	/** 启用歌单列表，无参数 */
	activePlaylists: () =>
		[...musicKeys.publicMusic(), "active-playlists"] as const,
	/** 播放器设置，无参数 */
	settings: () => [...musicKeys.publicMusic(), "settings"] as const,

	// --- 后台歌单管理维度 ---
	/** 后台歌单管理维度 */
	adminPlaylists: () => [...musicKeys.all, "admin-playlists"] as const,
	/** 后台全部歌单列表，无参数 */
	adminList: () => [...musicKeys.adminPlaylists(), "list"] as const,
	/**
	 * 后台歌单详情
	 *
	 * @param id 歌单 ID
	 */
	adminDetail: (id: string) =>
		[...musicKeys.adminPlaylists(), "detail", id] as const,
};
