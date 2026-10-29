/** 前台应用来源。 */
export interface PresenceApplication {
	display_name: string;
}

/** 已在客户端本地过滤的窗口标题。 */
export interface PresenceWindow {
	title: string;
}

/** 播放器暴露的当前媒体会话。 */
export interface PresenceMedia {
	/** 换曲时变化 */
	session_id: string;
	player_name: string;
	title: string;
	artist: string | null;
	album: string | null;
	state: "playing" | "paused";
	/** 毫秒；null 表示不可靠 */
	duration_ms: number | null;
	/** 以 updated_at 为锚点的毫秒位置；null 表示不可靠，不画进度 */
	position_ms: number | null;
	/** 暂停为 0；null 表示不可靠，不推进位置 */
	rate: number | null;
}

/** 三个来源，null 即该来源为空。 */
export interface PresenceSources {
	application: PresenceApplication | null;
	window: PresenceWindow | null;
	media: PresenceMedia | null;
}

/** 租约内在线的一台设备。 */
export interface PresenceDevice {
	id: string;
	display_name: string;
	/** 服务端接收最后一份快照的时间，也是播放位置锚点 */
	updated_at: string;
	/** 租约到期时间，过期后停止展示 */
	expires_at: string;
	sources: PresenceSources;
}

export interface Presence {
	/** 服务端生成时间；与 updated_at 之差用于推进播放位置 */
	generated_at: string;
	devices: PresenceDevice[];
}
