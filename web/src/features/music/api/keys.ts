/**
 * musicKeys - 公开音乐解析 query key 工厂
 *
 * 集中管理前台音乐 key。
 */
export const musicKeys = {
	/** 音乐模块根 key */
	all: ["music"] as const,
	/** 公开解析维度 */
	publicMusic: () => [...musicKeys.all, "public"] as const,
	/** 解析音乐嵌入信息 */
	embed: (url: string) => [...musicKeys.publicMusic(), "embed", url] as const,
	/** 解析歌单链接 */
	playlistParse: (url: string) => [...musicKeys.publicMusic(), "playlist-parse", url] as const,
	/** 获取歌曲详情 */
	songDetail: (query: { platform?: string; id: string }) =>
		[...musicKeys.publicMusic(), "song-detail", query] as const,
	/** 搜索歌曲 */
	search: (query: { keyword: string; limit?: number }) =>
		[...musicKeys.publicMusic(), "search", query] as const,
	/** 获取歌词 */
	lyrics: (query: { platform?: string; id: string }) =>
		[...musicKeys.publicMusic(), "lyrics", query] as const,
	/** 获取歌曲元数据 */
	songMeta: (query: { platform?: string; id: string }) =>
		[...musicKeys.publicMusic(), "song-meta", query] as const,
	/** 启用歌单列表，无参数 */
	activePlaylists: () => [...musicKeys.publicMusic(), "active-playlists"] as const,
	/** 播放器设置，无参数 */
	settings: () => [...musicKeys.publicMusic(), "settings"] as const,
};
