package music

import (
	"context"
	"strconv"
	"time"

	"blog-api/internal/domain/shared"
)

type Artist struct {
	ID   string `json:"id"`   // 网易云十进制 ID，不是本站 UUID。
	Name string `json:"name"` // 网易云提供的歌手名。
}
type Album struct {
	ID       string `json:"id"`        // 网易云专辑 ID。
	Name     string `json:"name"`      // 网易云提供的专辑名。
	CoverURL string `json:"cover_url"` // 经过协议检查的公开封面 URL。
}
type Song struct {
	ID         string   `json:"id"`          // 网易云歌曲 ID。
	Name       string   `json:"name"`        // 网易云提供的歌曲名。
	Artists    []Artist `json:"artists"`     // 无歌手资料时为空数组。
	Album      Album    `json:"album"`       // 所属专辑的公开资料。
	DurationMS int64    `json:"duration_ms"` // 毫秒。
	Fee        int      `json:"fee"`         // 网易云付费类型，不代表匿名播放授权。
}
type Playlist struct {
	ID         string `json:"id"`          // 网易云歌单 ID。
	Name       string `json:"name"`        // 加入展示时保存公开名称快照。
	CoverURL   string `json:"cover_url"`   // 公开封面，不存储音频。
	TrackCount int    `json:"track_count"` // 上游报告的曲目总数。
	Creator    string `json:"creator"`     // 创建者昵称，不是本站用户 ID。
}
type FeaturedPlaylist struct {
	Playlist
	Enabled  bool `json:"enabled"`  // 仅启用项允许公开列举及曲目查询。
	Position int  `json:"position"` // 站点展示顺序，从零开始。
}
type Profile struct {
	ID        string `json:"id"`         // 网易云账号 ID，与发起管理员身份独立。
	Nickname  string `json:"nickname"`   // 账号公开昵称。
	AvatarURL string `json:"avatar_url"` // 账号公开头像。
}
type Account struct {
	State   string   `json:"state"`   // disconnected、connected 或 expired。
	Profile *Profile `json:"profile"` // 未连接时为 nil；过期保留上次资料。
}
type SongURL struct {
	ID       string  `json:"id"`       // 请求的网易云歌曲 ID。
	URL      *string `json:"url"`      // 无可用播放权时为 nil。
	Playable bool    `json:"playable"` // 表示本次取得可播放的地址；试听片段同样为 true。
	// Trial 为 true 表示该地址是账号权益不足时的试听片段；照常交付，
	// 由前端提示「仅试听」。Kite 当前契约丢弃上游 freeTrialInfo，按地址时长估算判定。
	Trial   bool   `json:"trial"`
	Format  string `json:"format"`  // 上游音频格式，如 mp3/flac。
	Bitrate int64  `json:"bitrate"` // 比特每秒。
	Size    int64  `json:"size"`    // 音频字节数。
}
type Playback struct {
	Mode string `json:"mode"` // account=已连接站点音乐账号，按其权益解析；anonymous=仅网易云匿名可用范围。
}
type Lyric struct {
	LRC        string `json:"lrc"`        // 带时间轴的原文歌词。
	Translated string `json:"translated"` // 无翻译时为空串。
	Romanized  string `json:"romanized"`  // 无音译时为空串。
}

// Credential 永不直接序列化；Cookie 在仓储边界只允许密文。
type Credential struct {
	Generation   int64   // 每次连接替换或退出推进，防止在途结果复活旧账号。
	SealedCookie string  // 独立 MUSIC_CREDENTIAL_KEY 加密后的完整 Cookie。
	Profile      Profile // 最近确认的网易云公开账号资料。
}

// Challenge 绑定发起管理员及创建时的站点账号版本。
type Challenge struct {
	ID         string    // 本站随机不透明 ID。
	OwnerID    string    // 发起管理员的本站用户 ID。
	Key        string    // 仅服务端持有的 Kite 轮询 key。
	Generation int64     // 创建时的站点账号版本。
	ExpiresAt  time.Time // 绝对过期时间，消费时再次校验。
}

func ValidateID(id string) error {
	n, err := strconv.ParseInt(id, 10, 64)
	if err != nil || n <= 0 || strconv.FormatInt(n, 10) != id {
		return shared.BadRequest("音乐 ID 必须为正整数十进制字符串")
	}
	return nil
}

// ValidateOrder 要求完整无重复排列，在事务内读取当前集合后调用。
func ValidateOrder(current []FeaturedPlaylist, ids []string) error {
	if len(current) != len(ids) {
		return shared.BadRequest("排序必须包含全部展示歌单")
	}
	set := make(map[string]bool, len(current))
	for _, p := range current {
		set[p.ID] = true
	}
	for _, id := range ids {
		if !set[id] {
			return shared.BadRequest("排序包含未知或重复歌单")
		}
		delete(set, id)
	}
	return nil
}

type Repository interface {
	Credential(context.Context) (Credential, error)
	ReplaceCredential(context.Context, int64, Credential) (bool, error)
	ClearCredential(context.Context) (Credential, error)
	CreateChallenge(context.Context, Challenge) error
	FindChallenge(context.Context, string, string) (*Challenge, error)
	CancelChallenge(context.Context, string, string) error
	ConfirmChallenge(context.Context, Challenge, Credential) (bool, error)
	ListFeatured(context.Context) ([]FeaturedPlaylist, error)
	AddFeatured(context.Context, Playlist) (FeaturedPlaylist, error)
	SetEnabled(context.Context, string, bool) (FeaturedPlaylist, error)
	OrderFeatured(context.Context, []string) ([]FeaturedPlaylist, error)
	RemoveFeatured(context.Context, string) error
}
