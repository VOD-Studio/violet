// Package engine 的 Execute 端到端缓存测试。
//
// 用 httptest mock 网易云 + 真实 proto 类型（song detail endpoint）验证 ADR §4.5 接缝 3：
// 缓存命中跳过 RawDo、未命中回填、CachePolicy=nil 不缓存。
package engine_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/VOD-Studio/mimo-music/internal/netease/engine"
	"github.com/stretchr/testify/require"
)

// mockNeteaseServer 启动 httptest 模拟网易云，记录被调用次数。
func mockNeteaseServer(t *testing.T, response string) (*httptest.Server, *atomic.Int32) {
	t.Helper()
	var calls atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(response))
	}))
	t.Cleanup(srv.Close)
	return srv, &calls
}

// makeSongDetailEndpoint 构造一个最小 endpoint 供测试 Execute 缓存逻辑。
func makeSongDetailEndpoint() *engine.Endpoint[*mmpb.GetSongDetailRequest, *mmpb.GetSongDetailResponse] {
	return &engine.Endpoint[*mmpb.GetSongDetailRequest, *mmpb.GetSongDetailResponse]{
		Meta: engine.Meta{
			Path:   "/weapi/v3/song/detail",
			Method: "POST",
			Crypto: engine.CryptoWeAPI,
		},
		Cache: &engine.CachePolicy[*mmpb.GetSongDetailRequest]{
			Key: func(req *mmpb.GetSongDetailRequest) string {
				return "song:detail:" + jsonNumber(req.GetSongId())
			},
			TTL: time.Hour,
		},
		NewResp: func() *mmpb.GetSongDetailResponse { return &mmpb.GetSongDetailResponse{} },
		MapRequest: func(req *mmpb.GetSongDetailRequest) (map[string]any, error) {
			return map[string]any{"c": `[{"id":` + jsonNumber(req.GetSongId()) + `}]`}, nil
		},
		MapResponse: func(_ *mmpb.GetSongDetailRequest, raw json.RawMessage) (*mmpb.GetSongDetailResponse, error) {
			var resp struct {
				Code  int `json:"code"`
				Songs []struct {
					ID   int64  `json:"id"`
					Name string `json:"name"`
				} `json:"songs"`
			}
			if err := json.Unmarshal(raw, &resp); err != nil {
				return nil, err
			}
			if len(resp.Songs) == 0 {
				return nil, nil
			}
			return &mmpb.GetSongDetailResponse{
				Song: &mmpb.Song{Id: resp.Songs[0].ID, Name: resp.Songs[0].Name},
			}, nil
		},
	}
}

func jsonNumber(n int64) string {
	return jsonIntToString(n)
}

// jsonIntToString 简单 int→string。
func jsonIntToString(n int64) string {
	if n == 0 {
		return "0"
	}
	var buf []byte
	for n > 0 {
		buf = append([]byte{byte('0' + n%10)}, buf...)
		n /= 10
	}
	return string(buf)
}

// TestExecute_CacheMissThenFill 未命中时调用上游、回填缓存；第二次命中缓存跳过上游。
func TestExecute_CacheMissThenFill(t *testing.T) {
	t.Parallel()

	// mock 网易云返回固定歌曲详情（注意 code 必须 200，否则被 errors.go 判失败）。
	srv, upstreamCalls := mockNeteaseServer(t, `{"code":200,"songs":[{"id":123,"name":"海阔天空"}]}`)
	c := &countingCache{}
	eng := engine.New(engine.WithCache(c), engine.WithBaseURL(srv.URL))
	ep := makeSongDetailEndpoint()
	req := &mmpb.GetSongDetailRequest{SongId: 123}

	// 第一次：未命中 → 调上游 → 回填。
	resp, err := engine.Execute(eng, context.Background(), ep, req)
	require.NoError(t, err)
	require.NotNil(t, resp.Song, "首次请求应返回歌曲")
	require.Equal(t, "海阔天空", resp.Song.Name)
	require.Equal(t, int32(1), c.gets, "首次应查一次缓存")
	require.Equal(t, int32(1), c.sets, "首次应回填一次缓存")
	require.Equal(t, int32(1), upstreamCalls.Load(), "首次应调一次上游")

	// 第二次：命中缓存 → 跳过上游（calls 不增加）。
	resp2, err := engine.Execute(eng, context.Background(), ep, req)
	require.NoError(t, err)
	require.NotNil(t, resp2.Song, "缓存命中应返回歌曲")
	require.Equal(t, "海阔天空", resp2.Song.Name, "缓存命中应返回相同结果")
	require.Equal(t, int32(1), upstreamCalls.Load(), "缓存命中应跳过上游，calls 不增加")
}

// countingCache 是带计数的内存 Cache，验证 Execute 的缓存命中/回填行为。
// 用 map 存数据（不是 Noop——Noop 永远 miss，无法验证命中路径）。
type countingCache struct {
	mu    sync.Mutex
	store map[string][]byte
	gets  int32
	sets  int32
}

func (c *countingCache) Get(_ context.Context, key string) ([]byte, bool, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.gets++
	v, ok := c.store[key]
	return v, ok, nil
}

func (c *countingCache) Set(_ context.Context, key string, value []byte, _ time.Duration) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.sets++
	if c.store == nil {
		c.store = make(map[string][]byte)
	}
	c.store[key] = value
	return nil
}

func (c *countingCache) Delete(_ context.Context, key string) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.store, key)
	return nil
}

// TestExecute_NilCachePolicy CachePolicy=nil 时不查不写缓存。
func TestExecute_NilCachePolicy(t *testing.T) {
	t.Parallel()

	srv, upstreamCalls := mockNeteaseServer(t, `{"code":200,"songs":[{"id":1,"name":"歌"}]}`)
	c := &countingCache{}
	eng := engine.New(engine.WithCache(c), engine.WithBaseURL(srv.URL))
	ep := makeSongDetailEndpoint()
	ep.Cache = nil // 不缓存

	_, err := engine.Execute(eng, context.Background(), ep, &mmpb.GetSongDetailRequest{SongId: 1})
	require.NoError(t, err)
	require.Equal(t, int32(0), c.gets, "CachePolicy=nil 不应查缓存")
	require.Equal(t, int32(0), c.sets, "CachePolicy=nil 不应写缓存")
	require.Equal(t, int32(1), upstreamCalls.Load(), "CachePolicy=nil 仍应调上游")
}

// TestRawDoWithCookieAndInput_ContextCookieToUpstream 验证 cookie 从 context 流到上游 HTTP 请求。
//
// interceptor 把 metadata cookie 注入 context（engine.WithCookie），
// engine 从 context 取 cookie 经 transport 注入 HTTP Cookie header。
// table-driven 覆盖「有 cookie」「无 cookie」两例。
func TestRawDoWithCookieAndInput_ContextCookieToUpstream(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		injectCtx   context.Context // 模拟 interceptor 注入（或裸 context）
		wantContain string          // 上游 Cookie header 应包含的子串
	}{
		{
			name:        "context 有 cookie 到达上游请求",
			injectCtx:   engine.WithCookie(context.Background(), "MUSIC_API_UUT=abc;__csrf=def"),
			wantContain: "MUSIC_API_UUT=abc;__csrf=def",
		},
		{
			name:        "context 无 cookie 上游仍带 __remember_me（网易云要求）",
			injectCtx:   context.Background(),
			wantContain: "__remember_me=true",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			var gotCookie atomic.Value
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				gotCookie.Store(r.Header.Get("Cookie"))
				w.Header().Set("Content-Type", "application/json")
				_, _ = w.Write([]byte(`{"code":200,"songs":[]}`))
			}))
			t.Cleanup(srv.Close)

			eng := engine.New(engine.WithBaseURL(srv.URL))

			_, _, err := eng.RawDoWithCookieAndInput(tt.injectCtx, engine.Meta{
				Path: "/weapi/v3/song/detail", Method: "POST", Crypto: engine.CryptoWeAPI,
			}, map[string]any{"c": "[]"})
			require.NoError(t, err)
			// transport 默认补 __remember_me=true（无 cookie 时单独带，有 cookie 时追加）。
			got, _ := gotCookie.Load().(string)
			require.Contains(t, got, tt.wantContain)
			require.Contains(t, got, "__remember_me=true")
		})
	}
}

// TestRawDo_UserAgentOverride 验证 Meta.UserAgent 透传到上游请求头:
// 空值回落桌面默认 UA,非空(如 MobileUserAgent)原样发出。
// 该接线是 song url CDN 节点分配的关键(桌面 UA 拿到的链接 403,移动端正常)。
func TestRawDo_UserAgentOverride(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		ua          string
		wantContain string
	}{
		{"空 UA 回落桌面默认", "", "NeteaseMusicDesktop"},
		{"移动端 UA 原样发出", engine.MobileUserAgent, "iPhone"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			var gotUA atomic.Value
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				gotUA.Store(r.Header.Get("User-Agent"))
				w.Header().Set("Content-Type", "application/json")
				_, _ = w.Write([]byte(`{"code":200}`))
			}))
			t.Cleanup(srv.Close)

			eng := engine.New(engine.WithBaseURL(srv.URL))
			_, err := eng.RawDo(context.Background(), engine.Meta{
				Path: "/weapi/x", Method: "POST", Crypto: engine.CryptoWeAPI, UserAgent: tt.ua,
			}, map[string]any{})
			require.NoError(t, err)
			got, _ := gotUA.Load().(string)
			require.Contains(t, got, tt.wantContain)
		})
	}
}
