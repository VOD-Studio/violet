package gallery

import (
	"encoding/base64"
	"encoding/json"
	"time"

	domaingallery "blog-api/internal/domain/gallery"
	"blog-api/internal/domain/shared"
)

type publishedCursorPayload struct {
	PublishedAt string `json:"published_at"`
	ID          string `json:"id"`
}

func encodePublishedCursor(cursor domaingallery.PublishedCursor) string {
	payload, _ := json.Marshal(publishedCursorPayload{
		PublishedAt: cursor.PublishedAt.UTC().Format(time.RFC3339Nano), ID: cursor.ID.String(),
	})
	return base64.RawURLEncoding.EncodeToString(payload)
}

func decodePublishedCursor(encoded string) (*domaingallery.PublishedCursor, error) {
	if encoded == "" {
		return nil, nil
	}
	data, err := base64.RawURLEncoding.DecodeString(encoded)
	if err != nil {
		return nil, shared.BadRequest("图集分页游标无效")
	}
	var payload publishedCursorPayload
	if err := json.Unmarshal(data, &payload); err != nil {
		return nil, shared.BadRequest("图集分页游标无效")
	}
	publishedAt, err := time.Parse(time.RFC3339Nano, payload.PublishedAt)
	if err != nil {
		return nil, shared.BadRequest("图集分页游标无效")
	}
	id, err := shared.ParseID(payload.ID)
	if err != nil || publishedAt.IsZero() {
		return nil, shared.BadRequest("图集分页游标无效")
	}
	return &domaingallery.PublishedCursor{PublishedAt: publishedAt, ID: id}, nil
}
