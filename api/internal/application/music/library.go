package music

import (
	"context"
	"strings"
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
	result, err := s.provider.SongURL(ctx, id, level)
	return result, safeProviderError(err)
}
func (s *Service) Lyric(ctx context.Context, id string) (music.Lyric, error) {
	if err := music.ValidateID(id); err != nil {
		return music.Lyric{}, err
	}
	result, err := s.provider.Lyric(ctx, id)
	return result, safeProviderError(err)
}
