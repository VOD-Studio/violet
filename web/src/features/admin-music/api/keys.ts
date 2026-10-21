import type { PageQuery } from "@/shared/api/types";
import type { SearchMusicLibraryQuery } from "../model/types";

/**
 * 后台音乐管理 Query Key 工厂。
 */
export const adminMusicKeys = {
	/** 模块根键 */
	all: ["admin-music"] as const,

	/** 服务端 Kite 连接状态与配置 */
	status: () => [...adminMusicKeys.all, "status"] as const,

	/** 站点音乐账号连接状态与资料 */
	account: () => [...adminMusicKeys.all, "account"] as const,

	/** 站点公开展示歌单列表 */
	featured: () => [...adminMusicKeys.all, "featured"] as const,

	/** 音乐库查询根键 */
	library: () => [...adminMusicKeys.all, "library"] as const,

	/** 站点网易云账号歌单库 */
	libraryPlaylists: (query?: PageQuery) =>
		[...adminMusicKeys.library(), "playlists", query] as const,

	/** 音乐库匿名搜索 */
	librarySearch: (query?: SearchMusicLibraryQuery) =>
		[...adminMusicKeys.library(), "search", query] as const,

	/** 歌单曲目分页列表 */
	libraryTracks: (playlistId: string, query?: PageQuery) =>
		[...adminMusicKeys.library(), "tracks", playlistId, query] as const,

	/** 扫码登录挑战状态 */
	qrChallenge: (id: string) => [...adminMusicKeys.all, "qr", id] as const,
};
