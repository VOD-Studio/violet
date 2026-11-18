package tweet

import (
	"context"
	"strconv"
	"strings"
	"time"

	"github.com/rs/zerolog/log"

	"blog-api/internal/domain/shared"
	domaintweet "blog-api/internal/domain/tweet"
)

const (
	feedWindow         = 30 * 24 * time.Hour
	sidebarAuthorLimit = 4
	sidebarTopicLimit  = 4
	sidebarImageLimit  = 6
	imageCursorPrefix  = "images:"
	hotCursorPrefix    = "hot:"
)

var ErrHotCursorExpired = shared.NewError("TWEET_HOT_CURSOR_EXPIRED", "热门排序游标已过期，请从第一页重新加载")

// FeedStore stores rankings only: viewer-dependent DTOs and visibility are never cached here.
type FeedStore interface {
	CurrentRanking(context.Context, time.Time, func() ([]shared.ID, error)) (shared.ID, error)
	ReadRanking(ctx context.Context, key shared.ID, offset, limit int) ([]shared.ID, bool, error)
	// ReserveView returns nil for a duplicate, or a release function to call if the write fails.
	ReserveView(ctx context.Context, id shared.ID, visitor string) (release func(context.Context) error, err error)
}

func (s *Service) WithFeed(repo domaintweet.FeedRepository, store FeedStore) *Service {
	s.feedRepo = repo
	s.feedStore = store
	return s
}

// ListTimeline returns limit+1 keyset results for latest/images, or walks the immutable hot ranking.
func (s *Service) ListTimeline(ctx context.Context, sort, token string, limit int) ([]TweetDTO, string, error) {
	switch sort {
	case "hot":
		return s.listHotTimeline(ctx, token, limit)
	case "images", "latest", "":
	default:
		return nil, "", shared.BadRequest("非法的推文排序")
	}

	images := sort == "images"
	if images && token != "" {
		var ok bool
		token, ok = strings.CutPrefix(token, imageCursorPrefix)
		if !ok || token == "" {
			return nil, "", shared.BadRequest("非法的分页游标")
		}
	}
	cursor, err := s.decodeCursorOrNil(token)
	if err != nil {
		return nil, "", err
	}
	find := s.repo.FindTimeline
	if images {
		find = s.feedRepo.FindImageTimeline
	}
	tweets, err := find(ctx, cursor, limit+1)
	if err != nil {
		return nil, "", err
	}
	dtos, next := s.buildPage(ctx, tweets, limit)
	if images && next != "" {
		next = imageCursorPrefix + next
	}
	return dtos, next, nil
}

func (s *Service) listHotTimeline(ctx context.Context, token string, limit int) ([]TweetDTO, string, error) {
	var key shared.ID
	var offset int
	if token == "" {
		cutoff := time.Now().UTC()
		var err error
		key, err = s.feedStore.CurrentRanking(ctx, cutoff.Truncate(time.Minute), func() ([]shared.ID, error) {
			return s.feedRepo.RankHotTimeline(ctx, cutoff.Add(-feedWindow), cutoff)
		})
		if err != nil {
			return nil, "", err
		}
	} else {
		raw, matches := strings.CutPrefix(token, hotCursorPrefix)
		rawKey, rawOffset, ok := strings.Cut(raw, ":")
		var err error
		key, err = shared.ParseID(rawKey)
		n, offsetErr := strconv.ParseInt(rawOffset, 10, 32)
		if !matches || !ok || err != nil || key.IsZero() || offsetErr != nil || n <= 0 {
			return nil, "", shared.BadRequest("非法的分页游标")
		}
		offset = int(n)
	}

	tweets := make([]*domaintweet.Tweet, 0, limit)
	for {
		ids, found, err := s.feedStore.ReadRanking(ctx, key, offset, limit+1)
		if err != nil {
			return nil, "", err
		}
		if !found {
			return nil, "", ErrHotCursorExpired
		}
		if len(ids) == 0 {
			break
		}
		rows, err := s.repo.FindByIDs(ctx, ids)
		if err != nil {
			return nil, "", err
		}
		byID := make(map[shared.ID]*domaintweet.Tweet, len(rows))
		for _, row := range rows {
			byID[row.ID()] = row
		}
		for i, id := range ids {
			if row := byID[id]; row != nil {
				if len(tweets) == limit {
					// Start the next page at the next still-visible rank, not at the end of the Redis read.
					return s.toDTOs(ctx, tweets), hotCursorPrefix + key.String() + ":" + strconv.Itoa(offset+i), nil
				}
				tweets = append(tweets, row)
			}
		}
		if len(ids) < limit+1 {
			break
		}
		offset += len(ids)
	}
	return s.toDTOs(ctx, tweets), "", nil
}

type SidebarAuthorDTO struct {
	ID          string `json:"id"`
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
	AvatarURL   string `json:"avatar_url"`
	Count       int64  `json:"count"`
}

type SidebarTopicDTO struct {
	Tag   string `json:"tag"`
	Count int64  `json:"count"`
}

type SidebarImageDTO struct {
	TweetID string `json:"tweet_id"`
	URL     string `json:"url"`
	// Width/Height 可为 nil（未保存尺寸）；Index 为图片在所属推文中的零基下标。
	Width  *int `json:"width"`
	Height *int `json:"height"`
	Index  int  `json:"index"`
}

type SidebarDTO struct {
	Authors []SidebarAuthorDTO `json:"authors"`
	Topics  []SidebarTopicDTO  `json:"topics"`
	Images  []SidebarImageDTO  `json:"images"`
}

func (s *Service) Sidebar(ctx context.Context) (SidebarDTO, error) {
	until := time.Now().UTC()
	since := until.Add(-feedWindow)
	authors, err := s.feedRepo.FindSidebarAuthors(ctx, since, until, sidebarAuthorLimit)
	if err != nil {
		return SidebarDTO{}, err
	}
	topics, err := s.feedRepo.FindSidebarTopics(ctx, since, until, sidebarTopicLimit)
	if err != nil {
		return SidebarDTO{}, err
	}
	photos, err := s.feedRepo.FindImageTimeline(ctx, nil, sidebarImageLimit)
	if err != nil {
		return SidebarDTO{}, err
	}
	dto := SidebarDTO{
		Authors: make([]SidebarAuthorDTO, 0, len(authors)),
		Topics:  make([]SidebarTopicDTO, 0, len(topics)),
		Images:  make([]SidebarImageDTO, 0, sidebarImageLimit),
	}
	for _, row := range authors {
		dto.Authors = append(dto.Authors, SidebarAuthorDTO{ID: row.ID.String(), Username: row.Username, DisplayName: row.DisplayName, AvatarURL: row.AvatarURL, Count: row.Count})
	}
	for _, row := range topics {
		dto.Topics = append(dto.Topics, SidebarTopicDTO{Tag: row.Tag, Count: row.Count})
	}
	for _, tw := range photos {
		id := tw.ID().String()
		for index, image := range tw.Images() {
			dto.Images = append(dto.Images, SidebarImageDTO{TweetID: id, URL: image.URL(), Width: image.Width(), Height: image.Height(), Index: index})
			if len(dto.Images) == sidebarImageLimit {
				return dto, nil
			}
		}
	}
	return dto, nil
}

type ViewCountDTO struct {
	ViewCount int64 `json:"view_count"`
}

func (s *Service) RecordView(ctx context.Context, rawID, visitor string) (ViewCountDTO, error) {
	id, err := shared.ParseID(rawID)
	if err != nil || id.IsZero() {
		return ViewCountDTO{}, shared.BadRequest("非法的推文 ID")
	}
	release, err := s.feedStore.ReserveView(ctx, id, visitor)
	if err != nil {
		return ViewCountDTO{}, err
	}
	if release == nil {
		n, err := s.feedRepo.ReadViewCount(ctx, id)
		return ViewCountDTO{ViewCount: n}, err
	}
	n, err := s.feedRepo.IncrementViewCount(ctx, id)
	if err != nil {
		cleanupCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), time.Second)
		defer cancel()
		if cleanupErr := release(cleanupCtx); cleanupErr != nil {
			log.Warn().Err(cleanupErr).Msg("释放推文浏览去重预留失败")
		}
	}
	return ViewCountDTO{ViewCount: n}, err
}
