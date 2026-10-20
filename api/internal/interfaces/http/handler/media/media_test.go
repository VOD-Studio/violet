// Package media 提供 emoji/upload HTTP handler 测试。
//
// 测试构造真实 appmedia.EmojiService，仅替换依赖的 domain 仓储接口。
package media

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	appmedia "blog-api/internal/application/media"
	domainemoji "blog-api/internal/domain/emoji"
)

// =====================================================================
// stub repos
// =====================================================================

// stubEmojiRepo 实现 domainemoji.EmojiGroupRepository，仅覆盖 GetAll 用到的 FindAll。
type stubEmojiRepo struct {
	domainemoji.EmojiGroupRepository
	groups         []*domainemoji.EmojiGroup
	findAllCalled  bool
	findAllEnabled bool
}

func (s *stubEmojiRepo) FindAll(_ context.Context, enabledOnly bool) ([]*domainemoji.EmojiGroup, error) {
	s.findAllCalled = true
	s.findAllEnabled = enabledOnly
	return s.groups, nil
}

var _ domainemoji.EmojiGroupRepository = (*stubEmojiRepo)(nil)

// =====================================================================
// GetAllEmojis（前台公开）—— 只返回启用分组
// =====================================================================

func TestGetAllEmojis_OK_ReturnsEnabledGroups(t *testing.T) {
	group := domainemoji.ReconstructEmojiGroup(
		1, "B站表情", domainemoji.SourceBilibili, "/cover.png", 1, true,
		domainemoji.GroupTypeImage,
		[]domainemoji.Emoji{domainemoji.NewEmoji(10, 1, "[保佑]", "/e.png")},
		domainemoji.ReconstructEmojiMeta("保佑", domainemoji.SizeSmall, domainemoji.TypeNormal),
	)
	repo := &stubEmojiRepo{groups: []*domainemoji.EmojiGroup{group}}
	h := &Handler{emojiSvc: appmedia.NewEmojiService(repo, "", "", nil, nil)}

	rr := httptest.NewRecorder()
	h.GetAllEmojis(rr, httptest.NewRequest(http.MethodGet, "/emojis", nil))

	require.Equal(t, http.StatusOK, rr.Code)
	assert.True(t, repo.findAllCalled)
	assert.True(t, repo.findAllEnabled, "前台 GetAllEmojis 应只取启用分组（enabledOnly=true）")

	var got struct {
		Data []appmedia.EmojiGroupDTO `json:"data"`
	}
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &got))
	require.Len(t, got.Data, 1)
	assert.Equal(t, int32(1), got.Data[0].ID)
	assert.Equal(t, "B站表情", got.Data[0].Name)
	assert.True(t, got.Data[0].IsEnabled)
	require.Len(t, got.Data[0].Emojis, 1)
	assert.Equal(t, "[保佑]", got.Data[0].Emojis[0].Name)
	assert.Equal(t, "/e.png", got.Data[0].Emojis[0].URL)
}

func TestGetAllEmojis_Empty_ReturnsEmptyArray(t *testing.T) {
	h := &Handler{emojiSvc: appmedia.NewEmojiService(&stubEmojiRepo{}, "", "", nil, nil)}

	rr := httptest.NewRecorder()
	h.GetAllEmojis(rr, httptest.NewRequest(http.MethodGet, "/emojis", nil))

	require.Equal(t, http.StatusOK, rr.Code)

	var got struct {
		Data []appmedia.EmojiGroupDTO `json:"data"`
	}
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &got))
	assert.Empty(t, got.Data, "无分组应返回空数组而非 null")
}
