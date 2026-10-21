/** 匿名音乐缓存与后台账号、音乐库查询隔离。 */
export const musicKeys = {
	all: ["music"] as const,
	playlists: () => [...musicKeys.all, "playlists"] as const,
};
