// Package provider 定义 mimo-music 的平台抽象核心层。
//
// decorator.go 实现容错装饰器（重试 / 熔断），用装饰器模式包装 Provider，
// 不侵入各平台的具体实现。
package provider

import (
	"context"
	"errors"
	"sync"
	"time"

	merrors "github.com/VOD-Studio/mimo-music/errors"
)

// IsRetryable 判断错误是否可重试（网络错误 / 限流），确定性错误不重试。
func IsRetryable(err error) bool {
	return errors.Is(err, merrors.ErrUpstreamUnavailable) || errors.Is(err, merrors.ErrRateLimited)
}

// RetryProvider 是带指数退避重试的 Provider 装饰器。
//
// 对可重试错误（上游不可用 / 限流）按指数退避重试，最多 maxRetries 次。
// 确定性错误（404 / 未授权）直接返回，不重试。
type RetryProvider struct {
	inner      Provider
	maxRetries int
	baseDelay  time.Duration
}

// RetryOption 是 RetryProvider 的配置项。
type RetryOption func(*RetryProvider)

// WithRetryMaxRetries 设置最大重试次数。
func WithRetryMaxRetries(n int) RetryOption {
	return func(r *RetryProvider) { r.maxRetries = n }
}

// WithRetryBaseDelay 设置退避初始间隔。
func WithRetryBaseDelay(d time.Duration) RetryOption {
	return func(r *RetryProvider) { r.baseDelay = d }
}

// NewRetryProvider 包装 inner Provider，叠加指数退避重试。
func NewRetryProvider(inner Provider, opts ...RetryOption) *RetryProvider {
	r := &RetryProvider{
		inner:      inner,
		maxRetries: 3,
		baseDelay:  200 * time.Millisecond,
	}
	for _, opt := range opts {
		opt(r)
	}
	return r
}

// Platform 返回被包装的平台标识。
func (r *RetryProvider) Platform() string { return r.inner.Platform() }

// Auth 返回带重试的登录能力。
func (r *RetryProvider) Auth() Auth {
	return &retryAuth{inner: r.inner.Auth(), maxRetries: r.maxRetries, baseDelay: r.baseDelay}
}

// Playlist 返回带重试的歌单能力。
func (r *RetryProvider) Playlist() Playlist {
	return &retryPlaylist{inner: r.inner.Playlist(), maxRetries: r.maxRetries, baseDelay: r.baseDelay}
}

// Song 返回带重试的歌曲能力。
func (r *RetryProvider) Song() Song {
	return &retrySong{inner: r.inner.Song(), maxRetries: r.maxRetries, baseDelay: r.baseDelay}
}

// Search 返回带重试的搜索能力。
func (r *RetryProvider) Search() Search {
	return &retrySearch{inner: r.inner.Search(), maxRetries: r.maxRetries, baseDelay: r.baseDelay}
}

// Album 返回带重试的专辑能力。
func (r *RetryProvider) Album() Album {
	return &retryAlbum{inner: r.inner.Album(), maxRetries: r.maxRetries, baseDelay: r.baseDelay}
}

// Artist 返回带重试的歌手能力。
func (r *RetryProvider) Artist() Artist {
	return &retryArtist{inner: r.inner.Artist(), maxRetries: r.maxRetries, baseDelay: r.baseDelay}
}

// Recommend 返回带重试的推荐能力。
func (r *RetryProvider) Recommend() Recommend {
	return &retryRecommend{inner: r.inner.Recommend(), maxRetries: r.maxRetries, baseDelay: r.baseDelay}
}

// FM 返回带重试的私人电台能力。
func (r *RetryProvider) FM() FM {
	return &retryFM{inner: r.inner.FM(), maxRetries: r.maxRetries, baseDelay: r.baseDelay}
}

// withRetry 执行 fn，失败时按指数退避重试。
func withRetry(ctx context.Context, maxRetries int, baseDelay time.Duration, fn func() error) error {
	var err error
	for attempt := 0; attempt <= maxRetries; attempt++ {
		err = fn()
		if err == nil || !IsRetryable(err) {
			return err
		}
		if attempt < maxRetries {
			delay := baseDelay * (1 << attempt)
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(delay):
			}
		}
	}
	return err
}

// --- retryAuth ---

type retryAuth struct {
	inner      Auth
	maxRetries int
	baseDelay  time.Duration
}

func (a *retryAuth) SendCaptcha(ctx context.Context, phone string) error {
	return withRetry(ctx, a.maxRetries, a.baseDelay, func() error {
		return a.inner.SendCaptcha(ctx, phone)
	})
}

func (a *retryAuth) LoginByCellphone(ctx context.Context, phone, captcha string) (SessionResult, error) {
	var result SessionResult
	err := withRetry(ctx, a.maxRetries, a.baseDelay, func() error {
		var e error
		result, e = a.inner.LoginByCellphone(ctx, phone, captcha)
		return e
	})
	return result, err
}

func (a *retryAuth) LoginByQrcode(ctx context.Context) (QrcodeResult, error) {
	var result QrcodeResult
	err := withRetry(ctx, a.maxRetries, a.baseDelay, func() error {
		var e error
		result, e = a.inner.LoginByQrcode(ctx)
		return e
	})
	return result, err
}

func (a *retryAuth) CheckQrcode(ctx context.Context, key string) (QrcodeStatus, error) {
	var result QrcodeStatus
	err := withRetry(ctx, a.maxRetries, a.baseDelay, func() error {
		var e error
		result, e = a.inner.CheckQrcode(ctx, key)
		return e
	})
	return result, err
}

func (a *retryAuth) LoginStatus(ctx context.Context, cookie string) (SessionResult, error) {
	var result SessionResult
	err := withRetry(ctx, a.maxRetries, a.baseDelay, func() error {
		var e error
		result, e = a.inner.LoginStatus(ctx, cookie)
		return e
	})
	return result, err
}

func (a *retryAuth) Logout(ctx context.Context, cookie string) error {
	return withRetry(ctx, a.maxRetries, a.baseDelay, func() error {
		return a.inner.Logout(ctx, cookie)
	})
}

// --- retryPlaylist ---

type retryPlaylist struct {
	inner      Playlist
	maxRetries int
	baseDelay  time.Duration
}

func (p *retryPlaylist) Detail(ctx context.Context, playlistID string) (PlaylistResult, error) {
	var result PlaylistResult
	err := withRetry(ctx, p.maxRetries, p.baseDelay, func() error {
		var e error
		result, e = p.inner.Detail(ctx, playlistID)
		return e
	})
	return result, err
}

// --- retrySong ---

type retrySong struct {
	inner      Song
	maxRetries int
	baseDelay  time.Duration
}

func (s *retrySong) Detail(ctx context.Context, songID string) (SongResult, error) {
	var result SongResult
	err := withRetry(ctx, s.maxRetries, s.baseDelay, func() error {
		var e error
		result, e = s.inner.Detail(ctx, songID)
		return e
	})
	return result, err
}

func (s *retrySong) URL(ctx context.Context, songID, level string) (string, error) {
	var result string
	err := withRetry(ctx, s.maxRetries, s.baseDelay, func() error {
		var e error
		result, e = s.inner.URL(ctx, songID, level)
		return e
	})
	return result, err
}

func (s *retrySong) Lyric(ctx context.Context, songID string) (LyricResult, error) {
	var result LyricResult
	err := withRetry(ctx, s.maxRetries, s.baseDelay, func() error {
		var e error
		result, e = s.inner.Lyric(ctx, songID)
		return e
	})
	return result, err
}

// --- retrySearch ---

type retrySearch struct {
	inner      Search
	maxRetries int
	baseDelay  time.Duration
}

func (s *retrySearch) Search(ctx context.Context, keyword string, limit int) (SearchResult, error) {
	var result SearchResult
	err := withRetry(ctx, s.maxRetries, s.baseDelay, func() error {
		var e error
		result, e = s.inner.Search(ctx, keyword, limit)
		return e
	})
	return result, err
}

// --- retryAlbum ---

type retryAlbum struct {
	inner      Album
	maxRetries int
	baseDelay  time.Duration
}

func (a *retryAlbum) Detail(ctx context.Context, albumID string) (AlbumResult, error) {
	var result AlbumResult
	err := withRetry(ctx, a.maxRetries, a.baseDelay, func() error {
		var e error
		result, e = a.inner.Detail(ctx, albumID)
		return e
	})
	return result, err
}

// --- retryArtist ---

type retryArtist struct {
	inner      Artist
	maxRetries int
	baseDelay  time.Duration
}

func (a *retryArtist) Info(ctx context.Context, artistID string) (ArtistResult, error) {
	var result ArtistResult
	err := withRetry(ctx, a.maxRetries, a.baseDelay, func() error {
		var e error
		result, e = a.inner.Info(ctx, artistID)
		return e
	})
	return result, err
}

// --- retryRecommend ---

type retryRecommend struct {
	inner      Recommend
	maxRetries int
	baseDelay  time.Duration
}

func (r *retryRecommend) Daily(ctx context.Context, cookie string) ([]SongResult, error) {
	var result []SongResult
	err := withRetry(ctx, r.maxRetries, r.baseDelay, func() error {
		var e error
		result, e = r.inner.Daily(ctx, cookie)
		return e
	})
	return result, err
}

// --- retryFM ---

type retryFM struct {
	inner      FM
	maxRetries int
	baseDelay  time.Duration
}

func (f *retryFM) Personal(ctx context.Context, cookie string) ([]SongResult, error) {
	var result []SongResult
	err := withRetry(ctx, f.maxRetries, f.baseDelay, func() error {
		var e error
		result, e = f.inner.Personal(ctx, cookie)
		return e
	})
	return result, err
}

// --- 熔断器 ---

// CircuitState 是熔断器状态。
type CircuitState int

const (
	// StateClosed 是关闭状态（正常放行）。
	StateClosed CircuitState = iota
	// StateOpen 是打开状态（短路，直接返回错误）。
	StateOpen
	// StateHalfOpen 是半开状态（放行一次探测）。
	StateHalfOpen
)

// CircuitBreaker 是熔断器。
//
// 连续 failures 次失败后进入 Open，经过 openTimeout 后进入 HalfOpen 放行一次探测。
// 探测成功则 Closed，探测失败则重新 Open。线程安全。
type CircuitBreaker struct {
	mu          sync.Mutex
	state       CircuitState
	failures    int
	threshold   int
	openTimeout time.Duration
	lastFailure time.Time
}

// NewCircuitBreaker 创建熔断器。
//
// threshold 是连续失败多少次后打开熔断，openTimeout 是熔断持续时间。
func NewCircuitBreaker(threshold int, openTimeout time.Duration) *CircuitBreaker {
	return &CircuitBreaker{
		state:       StateClosed,
		threshold:   threshold,
		openTimeout: openTimeout,
	}
}

// allow 判断是否放行（调用前检查）。
//
// 返回 true 表示放行（Closed 或 HalfOpen），false 表示短路（Open）。
// HalfOpen 时只放行一次。
func (cb *CircuitBreaker) allow() bool {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	switch cb.state {
	case StateClosed:
		return true
	case StateOpen:
		if time.Since(cb.lastFailure) >= cb.openTimeout {
			cb.state = StateHalfOpen
			return true
		}
		return false
	case StateHalfOpen:
		return true
	default:
		return true
	}
}

// recordSuccess 记录一次成功调用。
func (cb *CircuitBreaker) recordSuccess() {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	cb.failures = 0
	cb.state = StateClosed
}

// recordFailure 记录一次失败调用。
func (cb *CircuitBreaker) recordFailure() {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	cb.failures++
	cb.lastFailure = time.Now()
	if cb.state == StateHalfOpen || cb.failures >= cb.threshold {
		cb.state = StateOpen
	}
}

// State 返回当前熔断器状态（测试 / 指标用）。
func (cb *CircuitBreaker) State() CircuitState {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	return cb.state
}

// ErrCircuitOpen 是熔断器打开时的错误。
var ErrCircuitOpen = errors.New("熔断器打开")

// BreakerProvider 是带熔断器的 Provider 装饰器。
//
// 连续失败达阈值后短路，避免雪崩。熔断打开时直接返回 ErrCircuitOpen。
type BreakerProvider struct {
	inner   Provider
	breaker *CircuitBreaker
}

// NewBreakerProvider 包装 inner Provider，叠加熔断器。
func NewBreakerProvider(inner Provider, breaker *CircuitBreaker) *BreakerProvider {
	return &BreakerProvider{inner: inner, breaker: breaker}
}

// Platform 返回被包装的平台标识。
func (b *BreakerProvider) Platform() string { return b.inner.Platform() }

// Auth 返回带熔断的登录能力。
func (b *BreakerProvider) Auth() Auth {
	return &breakerAuth{inner: b.inner.Auth(), breaker: b.breaker}
}

// Playlist 返回带熔断的歌单能力。
func (b *BreakerProvider) Playlist() Playlist {
	return &breakerPlaylist{inner: b.inner.Playlist(), breaker: b.breaker}
}

// Song 返回带熔断的歌曲能力。
func (b *BreakerProvider) Song() Song {
	return &breakerSong{inner: b.inner.Song(), breaker: b.breaker}
}

// Search 返回带熔断的搜索能力。
func (b *BreakerProvider) Search() Search {
	return &breakerSearch{inner: b.inner.Search(), breaker: b.breaker}
}

// Album 返回带熔断的专辑能力。
func (b *BreakerProvider) Album() Album {
	return &breakerAlbum{inner: b.inner.Album(), breaker: b.breaker}
}

// Artist 返回带熔断的歌手能力。
func (b *BreakerProvider) Artist() Artist {
	return &breakerArtist{inner: b.inner.Artist(), breaker: b.breaker}
}

// Recommend 返回带熔断的推荐能力。
func (b *BreakerProvider) Recommend() Recommend {
	return &breakerRecommend{inner: b.inner.Recommend(), breaker: b.breaker}
}

// FM 返回带熔断的私人电台能力。
func (b *BreakerProvider) FM() FM {
	return &breakerFM{inner: b.inner.FM(), breaker: b.breaker}
}

// withBreaker 执行 fn，受熔断器保护。
//
// 熔断打开时直接返回 ErrCircuitOpen，不调 fn。
func withBreaker(breaker *CircuitBreaker, fn func() error) error {
	if !breaker.allow() {
		return ErrCircuitOpen
	}
	err := fn()
	if err != nil {
		breaker.recordFailure()
	} else {
		breaker.recordSuccess()
	}
	return err
}

// --- breakerAuth ---

type breakerAuth struct {
	inner   Auth
	breaker *CircuitBreaker
}

func (a *breakerAuth) SendCaptcha(ctx context.Context, phone string) error {
	return withBreaker(a.breaker, func() error { return a.inner.SendCaptcha(ctx, phone) })
}

func (a *breakerAuth) LoginByCellphone(ctx context.Context, phone, captcha string) (SessionResult, error) {
	var result SessionResult
	err := withBreaker(a.breaker, func() error {
		var e error
		result, e = a.inner.LoginByCellphone(ctx, phone, captcha)
		return e
	})
	return result, err
}

func (a *breakerAuth) LoginByQrcode(ctx context.Context) (QrcodeResult, error) {
	var result QrcodeResult
	err := withBreaker(a.breaker, func() error {
		var e error
		result, e = a.inner.LoginByQrcode(ctx)
		return e
	})
	return result, err
}

func (a *breakerAuth) CheckQrcode(ctx context.Context, key string) (QrcodeStatus, error) {
	var result QrcodeStatus
	err := withBreaker(a.breaker, func() error {
		var e error
		result, e = a.inner.CheckQrcode(ctx, key)
		return e
	})
	return result, err
}

func (a *breakerAuth) LoginStatus(ctx context.Context, cookie string) (SessionResult, error) {
	var result SessionResult
	err := withBreaker(a.breaker, func() error {
		var e error
		result, e = a.inner.LoginStatus(ctx, cookie)
		return e
	})
	return result, err
}

func (a *breakerAuth) Logout(ctx context.Context, cookie string) error {
	return withBreaker(a.breaker, func() error { return a.inner.Logout(ctx, cookie) })
}

// --- breakerPlaylist ---

type breakerPlaylist struct {
	inner   Playlist
	breaker *CircuitBreaker
}

func (p *breakerPlaylist) Detail(ctx context.Context, playlistID string) (PlaylistResult, error) {
	var result PlaylistResult
	err := withBreaker(p.breaker, func() error {
		var e error
		result, e = p.inner.Detail(ctx, playlistID)
		return e
	})
	return result, err
}

// --- breakerSong ---

type breakerSong struct {
	inner   Song
	breaker *CircuitBreaker
}

func (s *breakerSong) Detail(ctx context.Context, songID string) (SongResult, error) {
	var result SongResult
	err := withBreaker(s.breaker, func() error {
		var e error
		result, e = s.inner.Detail(ctx, songID)
		return e
	})
	return result, err
}

func (s *breakerSong) URL(ctx context.Context, songID, level string) (string, error) {
	var result string
	err := withBreaker(s.breaker, func() error {
		var e error
		result, e = s.inner.URL(ctx, songID, level)
		return e
	})
	return result, err
}

func (s *breakerSong) Lyric(ctx context.Context, songID string) (LyricResult, error) {
	var result LyricResult
	err := withBreaker(s.breaker, func() error {
		var e error
		result, e = s.inner.Lyric(ctx, songID)
		return e
	})
	return result, err
}

// --- breakerSearch ---

type breakerSearch struct {
	inner   Search
	breaker *CircuitBreaker
}

func (s *breakerSearch) Search(ctx context.Context, keyword string, limit int) (SearchResult, error) {
	var result SearchResult
	err := withBreaker(s.breaker, func() error {
		var e error
		result, e = s.inner.Search(ctx, keyword, limit)
		return e
	})
	return result, err
}

// --- breakerAlbum ---

type breakerAlbum struct {
	inner   Album
	breaker *CircuitBreaker
}

func (a *breakerAlbum) Detail(ctx context.Context, albumID string) (AlbumResult, error) {
	var result AlbumResult
	err := withBreaker(a.breaker, func() error {
		var e error
		result, e = a.inner.Detail(ctx, albumID)
		return e
	})
	return result, err
}

// --- breakerArtist ---

type breakerArtist struct {
	inner   Artist
	breaker *CircuitBreaker
}

func (a *breakerArtist) Info(ctx context.Context, artistID string) (ArtistResult, error) {
	var result ArtistResult
	err := withBreaker(a.breaker, func() error {
		var e error
		result, e = a.inner.Info(ctx, artistID)
		return e
	})
	return result, err
}

// --- breakerRecommend ---

type breakerRecommend struct {
	inner   Recommend
	breaker *CircuitBreaker
}

func (r *breakerRecommend) Daily(ctx context.Context, cookie string) ([]SongResult, error) {
	var result []SongResult
	err := withBreaker(r.breaker, func() error {
		var e error
		result, e = r.inner.Daily(ctx, cookie)
		return e
	})
	return result, err
}

// --- breakerFM ---

type breakerFM struct {
	inner   FM
	breaker *CircuitBreaker
}

func (f *breakerFM) Personal(ctx context.Context, cookie string) ([]SongResult, error) {
	var result []SongResult
	err := withBreaker(f.breaker, func() error {
		var e error
		result, e = f.inner.Personal(ctx, cookie)
		return e
	})
	return result, err
}

// 编译期断言。
var (
	_ Provider = (*RetryProvider)(nil)
	_ Provider = (*BreakerProvider)(nil)
)
