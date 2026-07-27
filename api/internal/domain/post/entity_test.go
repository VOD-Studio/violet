package post

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"blog-api/internal/domain/shared"
)

// TestReconstructPost_PreservesCanonicalURL 验证 ReconstructPost 正确回填 canonical_url：
// nil（原创）与非 nil（转载）两种形态。
func TestReconstructPost_PreservesCanonicalURL(t *testing.T) {
	id, authorID := shared.NewID(), shared.NewID()
	now := time.Now()
	tags := []string{"a"}

	t.Run("nil 表示原创", func(t *testing.T) {
		p := ReconstructPost(id, authorID, "原创", "original",
			"", "", "", "", StatusDraft, 0, false, "", "",
			nil, nil, tags, now, now)
		assert.Nil(t, p.CanonicalURL(), "原创文章 canonical_url 应为 nil")
	})

	t.Run("非 nil 表示转载", func(t *testing.T) {
		origin := "https://example.com/origin"
		p := ReconstructPost(id, authorID, "转载", "repost",
			"", "", "", "", StatusDraft, 0, false, "", "",
			nil, &origin, tags, now, now)
		require := p.CanonicalURL()
		assert.NotNil(t, require, "转载文章 canonical_url 应非 nil")
		assert.Equal(t, origin, *require)
	})
}

// TestSetCanonicalURL 验证 setter 行为：从原创改转载、从转载改回原创。
func TestSetCanonicalURL(t *testing.T) {
	p, err := NewPost(shared.NewID(), shared.NewID(), "标题", "slug")
	assert.NoError(t, err)
	assert.Nil(t, p.CanonicalURL(), "NewPost 默认原创")

	// 改成转载
	origin := "https://example.com/o"
	p.SetCanonicalURL(&origin)
	assert.Equal(t, origin, *p.CanonicalURL())

	// 改回原创
	p.SetCanonicalURL(nil)
	assert.Nil(t, p.CanonicalURL())
}
