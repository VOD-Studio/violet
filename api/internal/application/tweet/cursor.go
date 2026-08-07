package tweet

import (
	"encoding/base64"
	"strings"
	"time"

	"blog-api/internal/domain/shared"
	domaintweet "blog-api/internal/domain/tweet"
)

// cursor.go 时间线游标的传输编解码（base64url("RFC3339Nano|uuid")）。
//
// 游标值对象（domain/tweet.Cursor）不感知传输格式；编解码失败返回 400 领域错误，
// 不静默忽略（坏游标静默回第一页会让客户端死循环翻页）。

const cursorSep = "|"

// encodeCursor 把游标编码为 URL 安全 base64 串。
func encodeCursor(c domaintweet.Cursor) string {
	raw := c.CreatedAt.UTC().Format(time.RFC3339Nano) + cursorSep + c.ID.String()
	return base64.RawURLEncoding.EncodeToString([]byte(raw))
}

// decodeCursor 解码游标。格式非法（非 base64 / 分段错 / 时间或 UUID 解析失败）返回参数错误。
func decodeCursor(s string) (domaintweet.Cursor, error) {
	raw, err := base64.RawURLEncoding.DecodeString(s)
	if err != nil {
		return domaintweet.Cursor{}, shared.BadRequest("非法的分页游标")
	}
	ts, idStr, ok := strings.Cut(string(raw), cursorSep)
	if !ok {
		return domaintweet.Cursor{}, shared.BadRequest("非法的分页游标")
	}
	createdAt, err := time.Parse(time.RFC3339Nano, ts)
	if err != nil {
		return domaintweet.Cursor{}, shared.BadRequest("非法的分页游标")
	}
	id, err := shared.ParseID(idStr)
	if err != nil {
		return domaintweet.Cursor{}, shared.BadRequest("非法的分页游标")
	}
	return domaintweet.Cursor{CreatedAt: createdAt, ID: id}, nil
}
