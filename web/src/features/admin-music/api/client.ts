import { apiDelete, apiGet, apiGetPaged, apiPatch, apiPost, apiPut } from "@/shared/api/request";
import type { PageQuery, PagedResponse } from "@/shared/api/types";
import type {
	AddFeaturedPlaylistRequest,
	MusicAccount,
	MusicChallenge,
	MusicChallengeCheck,
	MusicFeaturedPlaylist,
	MusicPlaylist,
	MusicSong,
	MusicStatus,
	MusicVerification,
	OrderFeaturedPlaylistsRequest,
	SearchMusicLibraryQuery,
	SetFeaturedPlaylistEnabledRequest,
} from "../model/types";

const BASE = "/admin/music";

/** 获取 Kite 连接配置与服务端密钥状态 */
export const getMusicStatus = async (): Promise<MusicStatus> =>
	apiGet<MusicStatus>(`${BASE}/status`);

/** 执行 Kite 服务连通性与共享令牌测试 */
export const verifyMusic = async (): Promise<MusicVerification> =>
	apiPost<MusicVerification>(`${BASE}/verify`);

/** 获取当前站点的网易云账号连接状态与公开资料 */
export const getMusicAccount = async (): Promise<MusicAccount> =>
	apiGet<MusicAccount>(`${BASE}/account`);

/** 发起网易云扫码登录挑战 */
export const createMusicLoginQR = async (): Promise<MusicChallenge> =>
	apiPost<MusicChallenge>(`${BASE}/login/qr`);

/** 轮询网易云扫码挑战状态 */
export const checkMusicLoginQR = async (challengeId: string): Promise<MusicChallengeCheck> =>
	apiPost<MusicChallengeCheck>(`${BASE}/login/qr/${challengeId}/check`);

/** 取消未完成的扫码挑战 */
export const cancelMusicLoginQR = async (challengeId: string): Promise<void> =>
	apiDelete<void>(`${BASE}/login/qr/${challengeId}`);

/** 手动刷新当前站点网易云账号登录凭据 */
export const refreshMusicAccount = async (): Promise<MusicAccount> =>
	apiPost<MusicAccount>(`${BASE}/account/refresh`);

/** 断开并清空当前站点网易云账号连接 */
export const disconnectMusicAccount = async (): Promise<void> => apiDelete<void>(`${BASE}/account`);

/** 获取站点展示歌单全量列表 */
export const getFeaturedPlaylists = async (): Promise<MusicFeaturedPlaylist[]> =>
	apiGet<MusicFeaturedPlaylist[]>(`${BASE}/playlists`);

/** 添加网易云歌单至站点展示列表 */
export const addFeaturedPlaylist = async (
	body: AddFeaturedPlaylistRequest,
): Promise<MusicFeaturedPlaylist> => apiPost<MusicFeaturedPlaylist>(`${BASE}/playlists`, body);

/** 切换展示歌单的公开可见状态 */
export const setFeaturedPlaylistEnabled = async (
	id: string,
	body: SetFeaturedPlaylistEnabledRequest,
): Promise<MusicFeaturedPlaylist> =>
	apiPatch<MusicFeaturedPlaylist>(`${BASE}/playlists/${id}`, body);

/** 批量全量保存展示歌单顺序 */
export const orderFeaturedPlaylists = async (
	body: OrderFeaturedPlaylistsRequest,
): Promise<MusicFeaturedPlaylist[]> =>
	apiPut<MusicFeaturedPlaylist[]>(`${BASE}/playlists/order`, body);

/** 从站点展示列表中移除歌单引用 */
export const removeFeaturedPlaylist = async (id: string): Promise<void> =>
	apiDelete<void>(`${BASE}/playlists/${id}`);

/** 分页获取站点网易云账号自身拥有的歌单库 */
export const getUserPlaylists = async (
	query: PageQuery = {},
): Promise<PagedResponse<MusicPlaylist>> =>
	apiGetPaged<MusicPlaylist>(`${BASE}/library/playlists`, { params: query });

/** 分页搜索网易云公开歌曲 */
export const searchMusicSongs = async (
	query: Omit<SearchMusicLibraryQuery, "type">,
): Promise<PagedResponse<MusicSong>> =>
	apiGetPaged<MusicSong>(`${BASE}/library/search`, {
		params: { ...query, type: "song" },
	});

/** 分页搜索网易云公开歌单 */
export const searchMusicPlaylists = async (
	query: Omit<SearchMusicLibraryQuery, "type">,
): Promise<PagedResponse<MusicPlaylist>> =>
	apiGetPaged<MusicPlaylist>(`${BASE}/library/search`, {
		params: { ...query, type: "playlist" },
	});

/** 分页获取指定歌单包含的曲目列表 */
export const getPlaylistTracks = async (
	playlistId: string,
	query: PageQuery = {},
): Promise<PagedResponse<MusicSong>> =>
	apiGetPaged<MusicSong>(`${BASE}/library/playlists/${playlistId}/tracks`, {
		params: query,
	});
