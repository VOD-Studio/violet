package music

import (
	"context"
	"strings"
	"time"
	"unicode/utf8"

	"blog-api/internal/domain/music"
	"blog-api/internal/domain/shared"
)

func (s *Service) Featured(ctx context.Context) ([]music.FeaturedPlaylist, error) {
	return s.repo.ListFeatured(ctx)
}
func (s *Service) PublicPlaylists(ctx context.Context) ([]music.Playlist, error) {
	all, err := s.repo.ListFeatured(ctx)
	if err != nil {
		return nil, err
	}
	result := make([]music.Playlist, 0, len(all))
	for _, p := range all {
		if p.Enabled {
			result = append(result, p.Playlist)
		}
	}
	return result, nil
}
func (s *Service) AddFeatured(ctx context.Context, id string) (music.FeaturedPlaylist, error) {
	if err := music.ValidateID(id); err != nil {
		return music.FeaturedPlaylist{}, err
	}
	p, err := s.provider.Playlist(ctx, id)
	if err != nil {
		return music.FeaturedPlaylist{}, safeProviderError(err)
	}
	return s.repo.AddFeatured(ctx, p)
}
func (s *Service) SetEnabled(ctx context.Context, id string, enabled bool) (music.FeaturedPlaylist, error) {
	if err := music.ValidateID(id); err != nil {
		return music.FeaturedPlaylist{}, err
	}
	return s.repo.SetEnabled(ctx, id, enabled)
}
func (s *Service) OrderFeatured(ctx context.Context, ids []string) ([]music.FeaturedPlaylist, error) {
	return s.repo.OrderFeatured(ctx, ids)
}
func (s *Service) RemoveFeatured(ctx context.Context, id string) error {
	if err := music.ValidateID(id); err != nil {
		return err
	}
	return s.repo.RemoveFeatured(ctx, id)
}
func (s *Service) UserPlaylists(ctx context.Context, q shared.PageQuery) (shared.PageResult[music.Playlist], error) {
	c, err := s.repo.Credential(ctx)
	if err != nil {
		return shared.PageResult[music.Playlist]{}, err
	}
	if c.SealedCookie == "" {
		return shared.PageResult[music.Playlist]{}, shared.BadRequest("尚未连接网易云账号")
	}
	cookie, err := s.open(c)
	if err != nil {
		return shared.PageResult[music.Playlist]{}, err
	}
	result, err := s.provider.UserPlaylists(ctx, c.Profile.ID, cookie, q.Normalize())
	return result, safeProviderError(err)
}
func validateQuery(q string) error {
	if strings.TrimSpace(q) == "" || utf8.RuneCountInString(q) > 100 {
		return shared.BadRequest("搜索关键词须为 1 至 100 字")
	}
	return nil
}
func (s *Service) SearchSongs(ctx context.Context, keyword string, q shared.PageQuery) (shared.PageResult[music.Song], error) {
	if err := validateQuery(keyword); err != nil {
		return shared.PageResult[music.Song]{}, err
	}
	result, err := s.provider.SearchSongs(ctx, strings.TrimSpace(keyword), q.Normalize())
	return result, safeProviderError(err)
}
func (s *Service) SearchPlaylists(ctx context.Context, keyword string, q shared.PageQuery) (shared.PageResult[music.Playlist], error) {
	if err := validateQuery(keyword); err != nil {
		return shared.PageResult[music.Playlist]{}, err
	}
	result, err := s.provider.SearchPlaylists(ctx, strings.TrimSpace(keyword), q.Normalize())
	return result, safeProviderError(err)
}
func (s *Service) Tracks(ctx context.Context, id string, q shared.PageQuery, public bool) (shared.PageResult[music.Song], error) {
	if err := music.ValidateID(id); err != nil {
		return shared.PageResult[music.Song]{}, err
	}
	cookie := ""
	if public {
		all, err := s.repo.ListFeatured(ctx)
		if err != nil {
			return shared.PageResult[music.Song]{}, err
		}
		enabled := false
		for _, p := range all {
			if p.ID == id && p.Enabled {
				enabled = true
				break
			}
		}
		if !enabled {
			return shared.PageResult[music.Song]{}, shared.NotFound("展示歌单")
		}
	} else {
		c, err := s.repo.Credential(ctx)
		if err != nil {
			return shared.PageResult[music.Song]{}, err
		}
		if c.SealedCookie != "" {
			cookie, err = s.open(c)
			if err != nil {
				return shared.PageResult[music.Song]{}, err
			}
		}
	}
	result, err := s.provider.Tracks(ctx, id, cookie, q.Normalize())
	return result, safeProviderError(err)
}
func (s *Service) Song(ctx context.Context, id string) (music.Song, error) {
	if err := music.ValidateID(id); err != nil {
		return music.Song{}, err
	}
	result, err := s.provider.Song(ctx, id)
	return result, safeProviderError(err)
}
func (s *Service) SongURL(ctx context.Context, id, level string) (music.SongURL, error) {
	if err := music.ValidateID(id); err != nil {
		return music.SongURL{}, err
	}
	if level == "" {
		level = "standard"
	}
	switch level {
	case "standard", "exhigh", "lossless", "hires":
	default:
		return music.SongURL{}, shared.BadRequest("不支持的音质")
	}
	cookie := ""
	generation := int64(0)
	if s.repo != nil {
		c, err := s.repo.Credential(ctx)
		if err != nil {
			return music.SongURL{}, err
		}
		generation = c.Generation
		if cached, ok := s.cachedPlayback(id+":"+level, generation); ok {
			return cached, nil
		}
		if c.SealedCookie != "" {
			// 站点账号只为启用展示歌单内的曲目解析，避免开放成任意歌曲的账号解析代理。
			if err := s.ensureFeaturedTrack(ctx, id); err != nil {
				return music.SongURL{}, err
			}
			cookie, err = s.open(c)
			if err != nil {
				return music.SongURL{}, err
			}
		}
	} else if cached, ok := s.cachedPlayback(id+":"+level, generation); ok {
		return cached, nil
	}
	result, err := s.resolvePlayback(id+":"+level, generation, func() (music.SongURL, error) {
		result, err := s.provider.SongURL(ctx, id, cookie, level)
		if err != nil {
			return music.SongURL{}, safeProviderError(err)
		}
		if result.Playable && s.isTrialSnippet(ctx, id, result) {
			// 试听片段照常交付并标记，由前端提示「仅试听」；精确判定待 Kite 补上游试听信息。
			result.Trial = true
		}
		return result, nil
	})
	if err != nil {
		return music.SongURL{}, err
	}
	return result, nil
}

// resolvePlayback 统一缓存查找与并发收敛：同 key 并发解析只执行一次上游请求，
// 后到者等待先到者结果（失败不缓存，后到者自行重试）。
func (s *Service) resolvePlayback(
	key string,
	generation int64,
	resolve func() (music.SongURL, error),
) (music.SongURL, error) {
	s.playbackMu.Lock()
	if entry, ok := s.playbackCache[key]; ok && s.playbackCacheGen == generation && time.Now().Before(entry.expiry) {
		s.playbackMu.Unlock()
		return entry.value, nil
	}
	if wait, ok := s.playbackInflight[key]; ok {
		s.playbackMu.Unlock()
		<-wait
		if entry, ok := s.cachedPlayback(key, generation); ok {
			return entry, nil
		}
		return music.SongURL{}, shared.Internal("播放地址解析未完成，请重试", nil)
	}
	if s.playbackInflight == nil {
		s.playbackInflight = make(map[string]chan struct{})
	}
	wait := make(chan struct{})
	s.playbackInflight[key] = wait
	s.playbackMu.Unlock()
	defer func() {
		s.playbackMu.Lock()
		delete(s.playbackInflight, key)
		s.playbackMu.Unlock()
		close(wait)
	}()
	result, err := resolve()
	if err != nil {
		return music.SongURL{}, err
	}
	if result.Playable {
		s.storePlayback(key, generation, result)
	}
	return result, nil
}

// playbackCacheTTL 比 Kite 的 30 分钟 URL 缓存略短，到期前重解析仍可拿到上游新地址；
// 同曲目全站重复解析在窗口内收敛为一次上游请求。
const playbackCacheTTL = 25 * time.Minute

func (s *Service) cachedPlayback(key string, generation int64) (music.SongURL, bool) {
	s.playbackMu.Lock()
	defer s.playbackMu.Unlock()
	if s.playbackCache == nil || s.playbackCacheGen != generation {
		return music.SongURL{}, false
	}
	entry, ok := s.playbackCache[key]
	if !ok || !time.Now().Before(entry.expiry) {
		return music.SongURL{}, false
	}
	return entry.value, true
}

func (s *Service) storePlayback(key string, generation int64, value music.SongURL) {
	s.playbackMu.Lock()
	defer s.playbackMu.Unlock()
	if s.playbackCache == nil || s.playbackCacheGen != generation {
		s.playbackCache = make(map[string]playbackEntry)
		s.playbackCacheGen = generation
	}
	s.playbackCache[key] = playbackEntry{value: value, expiry: time.Now().Add(playbackCacheTTL)}
}

// trialEstimateCeilingMS / fullLengthFloorMS 是试听判定的阈值：
// 网易云试听片段约 30 秒；地址估算时长低于 45 秒且曲目本身超过 90 秒才判试听，
// 避免把短小曲目误伤。
const (
	trialEstimateCeilingMS = 45_000
	fullLengthFloorMS      = 90_000
)

// isTrialSnippet 按字节数与码率估算地址时长，显著短于曲目元数据时长时判定为试听。
// Kite 当前契约丢弃上游 freeTrialInfo，无法精确区分；本站策略是不把试听冒充完整播放交付。
func (s *Service) isTrialSnippet(ctx context.Context, id string, result music.SongURL) bool {
	if result.Bitrate <= 0 || result.Size <= 0 {
		return false
	}
	if result.Size*8*1000/result.Bitrate >= trialEstimateCeilingMS {
		return false
	}
	song, err := s.provider.Song(ctx, id)
	if err != nil || song.DurationMS < fullLengthFloorMS {
		return false
	}
	return true
}

// featuredTTL 限制展示曲目集合缓存的重建频率；集合只含曲目 ID，不含凭据或播放地址。
const featuredTTL = 5 * time.Minute

// ensureFeaturedTrack 确认歌曲属于任一启用展示歌单。
// 旧版 Kite 的曲目分页可能不生效（offset 被忽略），检测到整页重复即停止翻页，以已取得部分为准。
func (s *Service) ensureFeaturedTrack(ctx context.Context, id string) error {
	s.featuredMu.Lock()
	_, cached := s.featuredIDs[id]
	valid := cached && time.Now().Before(s.featuredExpiry)
	s.featuredMu.Unlock()
	if valid {
		return nil
	}
	all, err := s.repo.ListFeatured(ctx)
	if err != nil {
		return err
	}
	ids := make(map[string]struct{})
	for _, p := range all {
		if !p.Enabled {
			continue
		}
		collected := 0
		for page := 1; ; page++ {
			q := shared.PageQuery{Page: page, Limit: 100}.Normalize()
			result, err := s.provider.Tracks(ctx, p.ID, "", q)
			if err != nil {
				return safeProviderError(err)
			}
			fresh := 0
			for _, song := range result.Items {
				if _, seen := ids[song.ID]; !seen {
					ids[song.ID] = struct{}{}
					fresh++
				}
			}
			collected += len(result.Items)
			if len(result.Items) == 0 {
				break
			}
			if page > 1 && fresh == 0 {
				break // 分页疑似重复返回首页，停止翻页避免死循环。
			}
			if result.Total > 0 && collected >= int(result.Total) {
				break
			}
			if len(result.Items) < q.Limit {
				break
			}
		}
	}
	s.featuredMu.Lock()
	s.featuredIDs = ids
	s.featuredExpiry = time.Now().Add(featuredTTL)
	s.featuredMu.Unlock()
	if _, ok := ids[id]; !ok {
		return shared.NotFound("站点展示曲目")
	}
	return nil
}

// Playback 返回公开播放使用的凭据模式；只读本地存储，不发起上游请求，
// 不暴露站点账号资料——访客只需知道按哪种权益解析。
func (s *Service) Playback(ctx context.Context) (music.Playback, error) {
	if s.repo != nil {
		c, err := s.repo.Credential(ctx)
		if err != nil {
			return music.Playback{}, err
		}
		if c.SealedCookie != "" {
			return music.Playback{Mode: "account"}, nil
		}
	}
	return music.Playback{Mode: "anonymous"}, nil
}
func (s *Service) Lyric(ctx context.Context, id string) (music.Lyric, error) {
	if err := music.ValidateID(id); err != nil {
		return music.Lyric{}, err
	}
	result, err := s.provider.Lyric(ctx, id)
	return result, safeProviderError(err)
}
