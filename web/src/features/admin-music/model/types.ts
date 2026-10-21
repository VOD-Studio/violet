import type { MusicPlaylist } from "@entities/music/model/types";
import type { PageQuery } from "@shared/api/types";

/**
 * 站点展示歌单条目，包含公开启用状态与站点展示顺序。
 */
export interface MusicFeaturedPlaylist extends MusicPlaylist {
	/** 是否公开展示 */
	enabled: boolean;
	/** 站点展示顺序，从 0 起始 */
	position: number;
}

/**
 * 网易云公开账号资料。
 */
export interface MusicProfile {
	/** 网易云账号 ID */
	id: string;
	/** 账号公开昵称 */
	nickname: string;
	/** 账号公开头像 URL */
	avatar_url: string;
}

/**
 * 站点音乐账号连接状态。
 *
 * - disconnected: 未连接网易云账号
 * - connected: 已连接且有效
 * - expired: 凭据已失效，需重新扫码授权或刷新
 */
export type MusicAccountState = "disconnected" | "connected" | "expired";

/**
 * 站点音乐账号状态信息。
 */
export interface MusicAccount {
	/** 连接状态 */
	state: MusicAccountState;
	/** 已连接或过期时的资料快照；未连接时为 null */
	profile: MusicProfile | null;
}

/**
 * Kite 服务端连接与配置状态。
 */
export interface MusicStatus {
	/** Kite 地址及令牌是否已配置 */
	configured: boolean;
	/** 独立加密密钥是否可用 */
	credential_storage_ready: boolean;
	/** 不含凭据的 Kite 访问基地址 */
	base_url: string;
}

/**
 * Kite 连通性测试验证结果。
 */
export interface MusicVerification {
	/** 健康与令牌验证是否均通过 */
	valid: boolean;
	/** 检查结果说明文案 */
	message: string;
}

/**
 * 扫码登录挑战信息。
 */
export interface MusicChallenge {
	/** 一次性挑战标识，非网易云二维码 key */
	id: string;
	/** 网易云客户端扫码 URL */
	url: string;
	/** 过期时间（RFC3339 时间戳） */
	expires_at: string;
}

/**
 * 扫码状态枚举。
 */
export type MusicQrState = "waiting" | "scanned" | "confirmed" | "expired";

/**
 * 扫码登录轮询响应。
 */
export interface MusicChallengeCheck {
	/** 当前扫码状态 */
	state: MusicQrState;
	/** 确认成功时返回新账号信息；其余状态为 null */
	account: MusicAccount | null;
}

/**
 * 添加展示歌单请求体。
 */
export interface AddFeaturedPlaylistRequest {
	/** 网易云歌单十进制 ID */
	playlist_id: string;
}

/**
 * 设置歌单启用状态请求体。
 */
export interface SetFeaturedPlaylistEnabledRequest {
	/** 是否公开展示 */
	enabled: boolean;
}

/**
 * 全量重新排序请求体。
 */
export interface OrderFeaturedPlaylistsRequest {
	/** 完整展示歌单 ID 列表，不可遗漏或重复 */
	ids: string[];
}

/**
 * 音乐库搜索请求参数。
 */
export interface SearchMusicLibraryQuery extends PageQuery {
	/** 搜索关键词 */
	q: string;
	/** 搜索类型 */
	type: "song" | "playlist";
}
