package emoji

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
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

func TestReseedBilibiliEmojis_UpsertNotSave(t *testing.T) {
	repo := new(mocks.MockEmojiGroupRepository)
	// 关键：验证走 UpsertByName 而非 Save
	repo.On("UpsertByName", mock.Anything, mock.Anything).Return(1, nil)
	repo.On("UpsertEmojiByName", mock.Anything, mock.Anything).Return(1, nil)

	// imgServer 既作为 B站 API 端点（返回一个分组），也作为图片下载端点。
	// 它对任意路径都返回 200 + image/png，对 API JSON 解析不合法会报错，
	// 因此单独起一个 API server 返回合法 JSON。
	apiSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"code": 0,
			"data": {
				"packages": [
					{"id": 1, "text": "pkg", "url": "cover.png", "type": 1,
					 "emote": [{"text": "[e]", "url": "e.png"}]}
				]
			}
		}`))
	}))
	defer apiSrv.Close()
	// 通过注入 round-tripper 把 B站硬编码的 API URL 重定向到 httptest server。
	apiClient := &http.Client{Transport: &singleHostTransport{target: apiSrv.URL}}

	imgSrv := imgServer(t)
	defer imgSrv.Close()
	// 把 JSON 里的相对路径补全为 imgServer 的 URL，走真实下载。
	// 由于 Package.URL/Emote.URL 来自 API 响应字符串，直接在 transport 里改不便；
	// 改为让 API 直接返回 imgServer 的绝对 URL。
	apiSrv.Config.Handler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"code": 0,
			"data": {
				"packages": [
					{"id": 1, "text": "pkg", "url": "` + imgSrv.URL + `/c.png", "type": 1,
					 "emote": [{"text": "[e]", "url": "` + imgSrv.URL + `/e.png"}]}
				]
			}
		}`))
	})

	svc := &EmojiSeedService{
		repo:       repo,
		client:     bilibili.NewClient("test-cookie", bilibili.WithHTTPClient(apiClient)),
		downloader: bilibili.NewDownloader(t.TempDir(), "/uploads/"),
	}

	var lastProgress domainemoji.RefetchProgress
	err := svc.ReseedBilibiliEmojis(context.Background(), svc.client, func(p domainemoji.RefetchProgress) {
		lastProgress = p
	})
	require.NoError(t, err)
	repo.AssertNumberOfCalls(t, "UpsertByName", 1)
	repo.AssertNumberOfCalls(t, "UpsertEmojiByName", 1)
	repo.AssertNotCalled(t, "Save")
	assert.Equal(t, 1, lastProgress.GroupsDone)
	assert.Equal(t, 1, lastProgress.GroupsTotal)
}

// singleHostTransport 把所有请求重定向到 target（含其 host），用于把 B站硬编码 URL 指向 httptest。
type singleHostTransport struct {
	target string
}

func (t *singleHostTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	// 只替换 scheme + host，保留原 path/query
	target := t.target
	newReq := req.Clone(req.Context())
	newReq.URL.Scheme = "http"
	if u, err := http.NewRequest(req.Method, target+req.URL.Path, nil); err == nil {
		_ = u
	}
	// 直接取 target 的 host 部分
	if i := strings.Index(target, "://"); i >= 0 {
		newReq.URL.Host = target[i+3:]
	}
	newReq.RequestURI = ""
	return http.DefaultTransport.RoundTrip(newReq)
}

// TestInferGroupType 覆盖按 B站 Package.Type 推断分组类型。
// type==4（颜文字）→ 文字组(1)，其余 → 图片组(2)。
func TestInferGroupType(t *testing.T) {
	cases := []struct {
		name string
		pkg  bilibili.Package
		want domainemoji.GroupType
	}{
		{"颜文字组", bilibili.Package{Type: 4}, domainemoji.GroupTypeText},
		{"普通图片组", bilibili.Package{Type: 1}, domainemoji.GroupTypeImage},
		{"未知type兜底为图片", bilibili.Package{Type: 99}, domainemoji.GroupTypeImage},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := inferGroupType(tc.pkg)
			assert.Equal(t, tc.want, got)
		})
	}
}
