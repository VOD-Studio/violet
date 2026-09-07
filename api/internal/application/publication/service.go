package publication

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"strings"
	"time"

	domainpublication "blog-api/internal/domain/publication"
	"blog-api/internal/domain/shared"
)

const (
	defaultLimit = 20
	maxLimit     = 100
	cursorV1     = 1
)

// ListQuery 是公开发布物流查询参数。
type ListQuery struct {
	Cursor string
	Limit  int
	// From 是包含下界的 RFC3339 时间；空串表示无下界。
	From string
	// To 是不包含上界的 RFC3339 时间；空串表示无上界。
	To string
	// Featured 为空或 false 时不过滤，true 时只返回精选文章。
	Featured string
}

// ItemDTO 是首页发布物流的轻量项。
type ItemDTO struct {
	ID          string `json:"id"`
	Kind        string `json:"kind"`
	RouteKey    string `json:"route_key"`
	Title       string `json:"title"`
	PublishedAt string `json:"published_at"`
	Featured    bool   `json:"featured"`
}

// Page 是公开发布物流的一页结果。
type Page struct {
	Items      []ItemDTO
	HasMore    bool
	NextCursor string
	Limit      int
}

// Service 编排发布物投影查询与签名游标。
type Service struct {
	repo      domainpublication.Repository
	cursorKey []byte
}

// NewService 创建发布物读取服务。
func NewService(repo domainpublication.Repository, cursorKey []byte) *Service {
	return &Service{repo: repo, cursorKey: append([]byte(nil), cursorKey...)}
}

// List 按稳定复合游标读取公开发布物。
func (s *Service) List(ctx context.Context, input ListQuery) (Page, error) {
	query, limit, err := s.parseQuery(input)
	if err != nil {
		return Page{}, err
	}
	query.Limit = limit + 1
	rows, err := s.repo.FindPage(ctx, query)
	if err != nil {
		return Page{}, err
	}

	hasMore := len(rows) > limit
	if hasMore {
		rows = rows[:limit]
	}
	items := make([]ItemDTO, len(rows))
	for i, row := range rows {
		items[i] = ItemDTO{
			ID:          string(row.Kind) + ":" + row.SourceID.String(),
			Kind:        string(row.Kind),
			RouteKey:    row.RouteKey,
			Title:       row.Title,
			PublishedAt: row.PublishedAt.UTC().Format(time.RFC3339Nano),
			Featured:    row.Featured,
		}
	}
	page := Page{Items: items, HasMore: hasMore, Limit: limit}
	if hasMore && len(rows) > 0 {
		last := rows[len(rows)-1]
		page.NextCursor = s.encodeCursor(domainpublication.Cursor{
			PublishedAt: last.PublishedAt,
			Kind:        last.Kind,
			SourceID:    last.SourceID,
		})
	}
	return page, nil
}

func (s *Service) parseQuery(input ListQuery) (domainpublication.Query, int, error) {
	cursor, err := s.decodeCursor(strings.TrimSpace(input.Cursor))
	if err != nil {
		return domainpublication.Query{}, 0, err
	}
	from, err := parseOptionalTime(input.From, "from 参数不是有效的 RFC3339 时间")
	if err != nil {
		return domainpublication.Query{}, 0, err
	}
	to, err := parseOptionalTime(input.To, "to 参数不是有效的 RFC3339 时间")
	if err != nil {
		return domainpublication.Query{}, 0, err
	}
	if from != nil && to != nil && !from.Before(*to) {
		return domainpublication.Query{}, 0, shared.BadRequest("from 必须早于 to")
	}
	featuredOnly, err := parseFeatured(input.Featured)
	if err != nil {
		return domainpublication.Query{}, 0, err
	}
	return domainpublication.Query{Cursor: cursor, From: from, To: to, FeaturedOnly: featuredOnly}, normalizeLimit(input.Limit), nil
}

type cursorPayload struct {
	Version     int    `json:"v"`
	PublishedAt string `json:"published_at"`
	Kind        string `json:"kind"`
	SourceID    string `json:"source_id"`
}

func (s *Service) encodeCursor(cursor domainpublication.Cursor) string {
	payload, _ := json.Marshal(cursorPayload{
		Version: cursorV1, PublishedAt: cursor.PublishedAt.UTC().Format(time.RFC3339Nano),
		Kind: string(cursor.Kind), SourceID: cursor.SourceID.String(),
	})
	signature := signCursor(s.cursorKey, payload)
	return base64.RawURLEncoding.EncodeToString(payload) + "." + base64.RawURLEncoding.EncodeToString(signature)
}

func (s *Service) decodeCursor(encoded string) (*domainpublication.Cursor, error) {
	if encoded == "" {
		return nil, nil
	}
	payloadPart, signaturePart, ok := strings.Cut(encoded, ".")
	if !ok {
		return nil, invalidCursor()
	}
	payload, err := base64.RawURLEncoding.DecodeString(payloadPart)
	if err != nil {
		return nil, invalidCursor()
	}
	signature, err := base64.RawURLEncoding.DecodeString(signaturePart)
	if err != nil || !hmac.Equal(signature, signCursor(s.cursorKey, payload)) {
		return nil, invalidCursor()
	}
	var value cursorPayload
	if err := json.Unmarshal(payload, &value); err != nil || value.Version != cursorV1 || !validKind(domainpublication.Kind(value.Kind)) {
		return nil, invalidCursor()
	}
	publishedAt, err := time.Parse(time.RFC3339Nano, value.PublishedAt)
	if err != nil || publishedAt.IsZero() {
		return nil, invalidCursor()
	}
	sourceID, err := shared.ParseID(value.SourceID)
	if err != nil {
		return nil, invalidCursor()
	}
	return &domainpublication.Cursor{PublishedAt: publishedAt, Kind: domainpublication.Kind(value.Kind), SourceID: sourceID}, nil
}

func signCursor(key, payload []byte) []byte {
	mac := hmac.New(sha256.New, key)
	_, _ = mac.Write(payload)
	return mac.Sum(nil)
}

func validKind(kind domainpublication.Kind) bool {
	return kind == domainpublication.KindArticle || kind == domainpublication.KindGallery || kind == domainpublication.KindNote
}

func invalidCursor() error { return shared.BadRequest("发布物分页游标无效") }

func parseOptionalTime(value, message string) (*time.Time, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil, nil
	}
	parsed, err := time.Parse(time.RFC3339, value)
	if err != nil {
		return nil, shared.BadRequest(message)
	}
	parsed = parsed.UTC()
	return &parsed, nil
}

func parseFeatured(value string) (bool, error) {
	switch strings.TrimSpace(value) {
	case "", "false":
		return false, nil
	case "true":
		return true, nil
	default:
		return false, shared.BadRequest("featured 参数必须为 true 或 false")
	}
}

func normalizeLimit(limit int) int {
	switch {
	case limit < 1:
		return defaultLimit
	case limit > maxLimit:
		return maxLimit
	default:
		return limit
	}
}
