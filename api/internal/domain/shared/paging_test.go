package shared

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

// TestPageQueryNormalizeClamps 验证 PageQuery 钳制规则的边界。
func TestPageQueryNormalizeClamps(t *testing.T) {
	cases := []struct {
		name string
		in   PageQuery
		want PageQuery
	}{
		{"零值回默认", PageQuery{}, PageQuery{Page: DefaultPage, Limit: DefaultPageLimit}},
		{"负值回默认", PageQuery{Page: -3, Limit: -1}, PageQuery{Page: DefaultPage, Limit: DefaultPageLimit}},
		{"超上限钳到100", PageQuery{Page: 2, Limit: 99999}, PageQuery{Page: 2, Limit: MaxPageLimit}},
		{"页码超上限钳到MaxPage", PageQuery{Page: 1 << 40, Limit: 20}, PageQuery{Page: MaxPage, Limit: 20}},
		{"合法值不动", PageQuery{Page: 5, Limit: 50}, PageQuery{Page: 5, Limit: 50}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, tc.in.Normalize())
		})
	}
}

// TestPageQueryOffset 验证 OFFSET 换算与防御。
func TestPageQueryOffset(t *testing.T) {
	assert.Equal(t, 0, PageQuery{Page: 1, Limit: 50}.Offset())
	assert.Equal(t, 100, PageQuery{Page: 3, Limit: 50}.Offset())
	assert.Equal(t, 0, PageQuery{Page: 0, Limit: 50}.Offset())
}

// TestNewPageResult 验证分页结果携带钳制后的查询值。
func TestNewPageResult(t *testing.T) {
	q := PageQuery{Page: 2, Limit: 50}
	r := NewPageResult(q, []int{1, 2}, 120)

	assert.Equal(t, []int{1, 2}, r.Items)
	assert.Equal(t, int64(120), r.Total)
	assert.Equal(t, 2, r.Page)
	assert.Equal(t, 50, r.Limit)
}
