package service

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"blog-api/internal/application/mocks"
	domainemoji "blog-api/internal/domain/emoji"
	"blog-api/internal/infrastructure/bilibili"
)

// imgServer 提供一个返回固定字节的图片 HTTP server，供 downloader 下载。
func imgServer(t *testing.T) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "image/png")
		_, _ = w.Write([]byte("x"))
	}))
}

func TestImportBilibiliEmojis(t *testing.T) {
	repo := new(mocks.MockEmojiGroupRepository)
	repo.On("Save", mock.Anything, mock.Anything).Return(1, nil)
	repo.On("SaveEmoji", mock.Anything, mock.Anything).Return(1, nil)

	srv := imgServer(t)
	defer srv.Close()

	svc := &EmojiSeedService{
		repo:       repo,
		downloader: bilibili.NewDownloader(t.TempDir(), "/uploads/"),
	}

	packages := []bilibili.Package{{
		Text: "pkg", URL: srv.URL + "/c.png", Type: 1,
		Emote: []bilibili.Emote{{Text: "[e]", URL: srv.URL + "/e.png"}},
	}}

	result, err := svc.importBilibiliEmojis(context.Background(), packages)
	require.NoError(t, err)
	assert.Equal(t, 1, result.GroupsCreated)
	assert.Equal(t, 1, result.EmojisCreated)
	repo.AssertNumberOfCalls(t, "Save", 1)
	repo.AssertNumberOfCalls(t, "SaveEmoji", 1)
}

func TestBackfillBilibiliCovers(t *testing.T) {
	repo := new(mocks.MockEmojiGroupRepository)
	g, _ := domainemoji.NewEmojiGroup(5, "old", domainemoji.SourceBilibili)
	g.SetCoverURL("")
	repo.On("Count", mock.Anything).Return(int64(1), nil)
	repo.On("FindGroupsNeedingCover", mock.Anything, domainemoji.SourceBilibili).
		Return([]*domainemoji.EmojiGroup{g}, nil)
	repo.On("UpdateCoverURL", mock.Anything, int32(5), mock.Anything).Return(nil)

	srv := imgServer(t)
	defer srv.Close()

	svc := &EmojiSeedService{
		repo:       repo,
		downloader: bilibili.NewDownloader(t.TempDir(), "/uploads/"),
	}
	_, err := svc.backfillBilibiliCovers(context.Background(), []bilibili.Package{{
		Text: "old", URL: srv.URL + "/c.png", Type: 1,
	}})
	require.NoError(t, err)
	repo.AssertNumberOfCalls(t, "UpdateCoverURL", 1)
}
