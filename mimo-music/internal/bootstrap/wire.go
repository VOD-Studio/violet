// Package bootstrap 提供 mimo-music 的共享依赖注入装配。
//
// server 和 worker 共用同一组 provider set，避免重复定义。
// 用 google/wire 在编译期保证依赖完整，替代手动 new 链。
package bootstrap

import (
	"log/slog"
	"net/http"

	"github.com/google/wire"
	"github.com/redis/go-redis/v9"

	cacheredis "github.com/VOD-Studio/mimo-music/cache/redis"
	"github.com/VOD-Studio/mimo-music/config"
	infraredis "github.com/VOD-Studio/mimo-music/internal/infra/redis"
	"github.com/VOD-Studio/mimo-music/observability"
	"github.com/VOD-Studio/mimo-music/provider"
	"github.com/VOD-Studio/mimo-music/provider/netease"
	"github.com/VOD-Studio/mimo-music/service"
	storeredis "github.com/VOD-Studio/mimo-music/store/redis"
)

// --- 基础设施 providers ---

// ProvideRedisClient 创建共享 Redis 客户端。
func ProvideRedisClient(cfg config.Config) (*redis.Client, error) {
	return infraredis.New(cfg.Redis)
}

// ProvideLogger 创建 provider.Logger 适配器。
func ProvideLogger() provider.Logger {
	return observability.NewSlogLogger(slog.Default())
}

// ProvideCache 创建 Redis Cache。
func ProvideCache(rdb *redis.Client) *cacheredis.Cache {
	return cacheredis.New(rdb)
}

// ProvideSessionStore 创建 Redis SessionStore。
func ProvideSessionStore(rdb *redis.Client) *storeredis.SessionStore {
	return storeredis.NewSessionStore(rdb)
}

// ProvideAvailabilityStore 创建 Redis AvailabilityStore。
func ProvideAvailabilityStore(rdb *redis.Client) *storeredis.AvailabilityStore {
	return storeredis.NewAvailabilityStore(rdb)
}

// ProvideNeteaseClient 创建网易云 Provider。
func ProvideNeteaseClient(cfg config.Config, logger provider.Logger) *netease.Client {
	return netease.New(
		provider.WithLogger(logger),
		provider.WithTimeout(cfg.Provider.UpstreamTimeout),
	)
}

// --- provider 能力桥接 ---

// ProvideAuth 从 netease client 取 Auth 能力。
func ProvideAuth(c *netease.Client) provider.Auth { return c.Auth() }

// ProvidePlaylist 从 netease client 取 Playlist 能力。
func ProvidePlaylist(c *netease.Client) provider.Playlist { return c.Playlist() }

// ProvideSong 从 netease client 取 Song 能力。
func ProvideSong(c *netease.Client) provider.Song { return c.Song() }

// ProvideSearch 从 netease client 取 Search 能力。
func ProvideSearch(c *netease.Client) provider.Search { return c.Search() }

// ProvideAlbum 从 netease client 取 Album 能力。
func ProvideAlbum(c *netease.Client) provider.Album { return c.Album() }

// ProvideArtist 从 netease client 取 Artist 能力。
func ProvideArtist(c *netease.Client) provider.Artist { return c.Artist() }

// ProvideRecommend 从 netease client 取 Recommend 能力。
func ProvideRecommend(c *netease.Client) provider.Recommend { return c.Recommend() }

// ProvideFM 从 netease client 取 FM 能力。
func ProvideFM(c *netease.Client) provider.FM { return c.FM() }

// --- Cache 接口桥接 ---

// ProvideProviderCache 把 *cacheredis.Cache 桥接到 provider.Cache 接口。
func ProvideProviderCache(c *cacheredis.Cache) provider.Cache { return c }

// --- SessionStore 接口桥接 ---

// ProvideProviderSessionStore 把 *storeredis.SessionStore 桥接到 provider.SessionStore 接口。
func ProvideProviderSessionStore(s *storeredis.SessionStore) provider.SessionStore { return s }

// --- SessionRotator ---

// ProvideSessionRotator 创建 Cookie 轮换器。
func ProvideSessionRotator(store *storeredis.SessionStore, avail *storeredis.AvailabilityStore) *service.SessionRotator {
	return service.NewSessionRotator(store, avail)
}

// --- App 装配 ---

// ServerApp 是 wire 注入的 HTTP 服务所需全部组件。
type ServerApp struct {
	// Router 是 chi 路由器。
	Router http.Handler

	// RDB 是 Redis 客户端（main 持有以便 defer Close）。
	RDB *redis.Client
}

// NewServerApp 组装 HTTP 服务所需的 Router 和 Redis 客户端。
func NewServerApp(router http.Handler, rdb *redis.Client) *ServerApp {
	return &ServerApp{Router: router, RDB: rdb}
}

// --- Provider Sets ---

// InfraSet 是基础设施 provider set（redis / cache / store / metrics / logger）。
var InfraSet = wire.NewSet(
	ProvideRedisClient,
	ProvideLogger,
	ProvideCache,
	ProvideSessionStore,
	ProvideAvailabilityStore,
	observability.NewMetrics,
)

// ProviderSet 是网易云 provider 及其能力桥接。
var ProviderSet = wire.NewSet(
	ProvideNeteaseClient,
	ProvideAuth,
	ProvidePlaylist,
	ProvideSong,
	ProvideSearch,
	ProvideAlbum,
	ProvideArtist,
	ProvideRecommend,
	ProvideFM,
	ProvideProviderCache,
	ProvideProviderSessionStore,
	ProvideSessionRotator,
)

// ServiceSet 是全量业务 service。
var ServiceSet = wire.NewSet(
	service.NewAuthService,
	service.NewPlaylistService,
	service.NewSongService,
	service.NewSearchService,
	service.NewAlbumService,
	service.NewArtistService,
	service.NewRecommendService,
	service.NewFMService,
)
