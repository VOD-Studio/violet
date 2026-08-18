package response

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"blog-api/internal/domain/shared"
)

// reqWithQuery 构造带 query string 的测试请求。
func reqWithQuery(t *testing.T, rawQuery string) *http.Request {
	t.Helper()
	r := httptest.NewRequest(http.MethodGet, "/test", nil)
	r.URL.RawQuery = rawQuery
	return r
}

// TestParseLimit 验证纯条数上限语义的钳制规则（缺省/非法回 def，越界钳到 max）。
func TestParseLimit(t *testing.T) {
	cases := []struct {
		name     string
		rawQuery string
		def, max int
		want     int
	}{
		{"缺省回默认", "", 10, 50, 10},
		{"非数字回默认", "limit=abc", 10, 50, 10},
		{"零回默认", "limit=0", 10, 50, 10},
		{"负值回默认", "limit=-5", 10, 50, 10},
		{"合法值直传", "limit=25", 10, 50, 25},
		{"越上限钳到 max", "limit=9999", 10, 50, 50},
		{"边界值恰好等于 max", "limit=50", 10, 50, 50},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, ParseLimit(reqWithQuery(t, tc.rawQuery), tc.def, tc.max))
		})
	}
}

// TestParsePaging 验证 offset 分页参数的双维钳制。
func TestParsePaging(t *testing.T) {
	page, limit := ParsePaging(reqWithQuery(t, ""))
	assert.Equal(t, 1, page, "缺省 page 回 1")
	assert.Equal(t, 20, limit, "缺省 limit 回 20")

	page, limit = ParsePaging(reqWithQuery(t, "page=3&limit=40"))
	assert.Equal(t, 3, page)
	assert.Equal(t, 40, limit)

	page, limit = ParsePaging(reqWithQuery(t, "page=99999999&limit=9999"))
	assert.Equal(t, shared.MaxPage, page, "page 越界钳到 MaxPage")
	assert.Equal(t, shared.MaxPageLimit, limit, "limit 越界钳到 MaxPageLimit")

	page, limit = ParsePaging(reqWithQuery(t, "page=-1&limit=-1"))
	assert.Equal(t, 1, page)
	assert.Equal(t, 20, limit)
}

// TestParsePagingWithMax 验证自定义 limit 上限：越界钳到调用方 max，非法入参回退全局上限。
func TestParsePagingWithMax(t *testing.T) {
	_, limit := ParsePagingWithMax(reqWithQuery(t, "limit=80"), 50)
	assert.Equal(t, 50, limit, "越自定义上限钳到 50")

	_, limit = ParsePagingWithMax(reqWithQuery(t, "limit=30"), 50)
	assert.Equal(t, 30, limit)

	_, limit = ParsePagingWithMax(reqWithQuery(t, "limit=30"), 0)
	assert.Equal(t, 30, limit, "max 非法（≤0）回退全局上限 100，30 不受影响")

	_, limit = ParsePagingWithMax(reqWithQuery(t, "limit=120"), 0)
	assert.Equal(t, 100, limit, "max 非法（≤0）回退全局上限后仍应钳 120")
}

// TestParseCursor 验证 cursor 分页：cursor 原样透传，limit 走统一钳制。
func TestParseCursor(t *testing.T) {
	cursor, limit := ParseCursor(reqWithQuery(t, "cursor=abc123&limit=40"))
	assert.Equal(t, "abc123", cursor)
	assert.Equal(t, 40, limit)

	cursor, limit = ParseCursor(reqWithQuery(t, ""))
	assert.Empty(t, cursor)
	assert.Equal(t, 20, limit, "缺省 limit 回 20")
}
