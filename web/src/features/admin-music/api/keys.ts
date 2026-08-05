/**
 * adminMusicKeys - 后台歌单管理 query key 工厂
 *
 * 集中管理后台歌单 key。公开音乐 key 见 music。
 */
export const adminMusicKeys = {
	/** 模块根 */
	all: ["admin-music"] as const,
	/** 后台歌单管理维度 */
	adminPlaylists: () => [...adminMusicKeys.all, "playlists"] as const,
	/** 后台全部歌单列表，无参数 */
	adminList: () => [...adminMusicKeys.adminPlaylists(), "list"] as const,
	/** 后台歌单详情 */
	adminDetail: (id: string) => [...adminMusicKeys.adminPlaylists(), "detail", id] as const,
};
