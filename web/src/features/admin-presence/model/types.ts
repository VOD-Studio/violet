import type { PresenceSources } from "@features/presence/model/types";

/** 后台设备列表项，含连接诊断。 */
export interface AdminPresenceDevice {
	id: string;
	display_name: string;
	created_at: string;
	/** 是否持有有效租约；在线时三个来源仍可都为空 */
	online: boolean;
	/** 离线时为 null */
	updated_at: string | null;
	/** 离线时为 null */
	expires_at: string | null;
	/** 离线时为 null */
	sources: PresenceSources | null;
}

/** 签发结果；token 只在此返回一次。 */
export interface IssuedPresenceDevice {
	device: AdminPresenceDevice;
	token: string;
	/** 上报路由，需拼成完整 wss:// 地址 */
	ingest_path: string;
}

export interface PresenceSettings {
	/** 是否允许匿名访客查看实时状态 */
	public_read: boolean;
}
