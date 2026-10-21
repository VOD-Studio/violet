/** 网易云公开歌手资料；ID 保持十进制字符串。 */
export interface MusicArtist {
	id: string;
	name: string;
}

/** 网易云公开专辑资料。 */
export interface MusicAlbum {
	id: string;
	name: string;
	/** 经过协议检查的公开封面 URL。 */
	cover_url: string;
}

/** 网易云歌曲资料，不包含站点账号凭据或播放授权。 */
export interface MusicSong {
	id: string;
	name: string;
	/** 无数据时为空数组。 */
	artists: MusicArtist[];
	album?: MusicAlbum | null;
	/** 毫秒。 */
	duration_ms?: number;
	/** 网易云付费类型，不代表匿名播放授权。 */
	fee?: number;
}

/** 网易云公开歌单资料；曲目数是读取歌单时的快照。 */
export interface MusicPlaylist {
	id: string;
	name: string;
	cover_url: string;
	track_count: number;
	/** 创建者昵称，而非用户 ID。 */
	creator: string;
}
