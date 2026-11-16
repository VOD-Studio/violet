package chat

// MusicShare 是发送时冻结的歌曲资料，不含播放地址或账号凭据。
type MusicShare struct {
	// TrackID 音乐服务的歌曲 ID，不是本站 UUID。
	TrackID string `json:"track_id"`
	// Title 发送时的歌名。
	Title string `json:"title"`
	// Artists 发送时的歌手名；无资料时为空数组。
	Artists []string `json:"artists"`
	// DurationMS 歌曲时长，单位毫秒。
	DurationMS int64 `json:"duration_ms"`
	// CoverURL 公开专辑封面地址。
	CoverURL string `json:"cover_url"`
}
