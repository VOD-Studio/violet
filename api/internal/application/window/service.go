// Package window 提供「窗」的应用用例：公开天气视图、后台配置、城市搜索与敲窗。
//
// 配置存在站点设置的 key-value 表（window_city 为城市 JSON，window_photo_<槽位> 为照片 URL）；
// 天气按城市坐标缓存在 Redis，新鲜期内直接返回，过期后重新拉取，拉取失败时退回旧数据。
package window

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/redis/go-redis/v9"

	appshared "blog-api/internal/application/shared"
	domainsettings "blog-api/internal/domain/settings"
	domainshared "blog-api/internal/domain/shared"
	domainwindow "blog-api/internal/domain/window"
)

const (
	keyCity        = "window_city"
	keyPhotoPrefix = "window_photo_"
	// freshFor 天气新鲜期：Open-Meteo 的 current 数据每 15 分钟更新一次
	freshFor = 15 * time.Minute
	// keepFor 缓存保留期：数据源故障时最多退回这么久以前的天气
	keepFor = 6 * time.Hour
	// maxPhotoURL 照片 URL 长度上限
	maxPhotoURL = 1024
	// maxPage 敲窗页面路径长度上限（按字符计）
	maxPage = 200
)

// ErrInvalidPhoto 照片地址不合法
var ErrInvalidPhoto = domainshared.BadRequest("窗外照片地址不合法")

// ErrInvalidQuery 城市搜索词不合法
var ErrInvalidQuery = domainshared.BadRequest("请输入 1 到 40 个字的城市名")

// Service 窗用例服务
type Service struct {
	settings domainsettings.SettingsStore
	provider domainwindow.WeatherProvider
	rdb      *redis.Client
	bus      appshared.EventBus
	now      func() time.Time
}

// NewService 构造窗服务
func NewService(settings domainsettings.SettingsStore, provider domainwindow.WeatherProvider, rdb *redis.Client, bus appshared.EventBus) *Service {
	return &Service{settings: settings, provider: provider, rdb: rdb, bus: bus, now: time.Now}
}

// PublicView 公开读取的窗状态
type PublicView struct {
	// Enabled 站长是否已配置城市；false 时前端只画默认的窗，不显示天气与时间
	Enabled bool `json:"enabled"`
	// City 城市名，未配置时为空
	City string `json:"city"`
	// Timezone IANA 时区名，前端据此显示站长那边此刻的时间
	Timezone string `json:"timezone"`
	// Condition 天气状况；空串表示天气暂不可用（前端按多云画）
	Condition domainwindow.Condition `json:"condition"`
	// IsDay 当地此刻是否白天；天气不可用时按时区本地时间 6–18 点粗算
	IsDay bool `json:"is_day"`
	// TemperatureC 气温（摄氏度）；nil 表示天气暂不可用
	TemperatureC *float64 `json:"temperature_c"`
	// ObservedAt 天气观测时间（RFC3339）；空串表示天气暂不可用
	ObservedAt string `json:"observed_at"`
	// PhotoSlot 此刻应显示的照片槽位
	PhotoSlot domainwindow.PhotoSlot `json:"photo_slot"`
	// Photo 该槽位的自定义照片 URL；空串表示用内置默认图
	Photo string `json:"photo"`
}

// AdminView 后台读取的窗配置
type AdminView struct {
	// City 站长所在城市；nil 表示未配置
	City *domainwindow.City `json:"city"`
	// Photos 各槽位的自定义照片 URL，五个槽位齐全，空串表示用默认图
	Photos map[domainwindow.PhotoSlot]string `json:"photos"`
}

// UpdateInput 后台整体更新窗配置
type UpdateInput struct {
	// City 站长所在城市；nil 表示清除城市（窗不再显示天气）
	City *domainwindow.City
	// Photos 各槽位的照片 URL；未出现的槽位清空为默认图
	Photos map[domainwindow.PhotoSlot]string
}

// cachedWeather Redis 中缓存的天气
type cachedWeather struct {
	Condition    domainwindow.Condition `json:"condition"`
	IsDay        bool                   `json:"is_day"`
	TemperatureC float64                `json:"temperature_c"`
	ObservedAt   time.Time              `json:"observed_at"`
	FetchedAt    time.Time              `json:"fetched_at"`
}

// Public 读取公开的窗状态
func (s *Service) Public(ctx context.Context) (PublicView, error) {
	cfg, err := s.load(ctx)
	if err != nil {
		return PublicView{}, err
	}
	if cfg.City == nil {
		return PublicView{PhotoSlot: domainwindow.SlotCloudy, Photo: cfg.Photos[domainwindow.SlotCloudy], IsDay: true}, nil
	}
	view := PublicView{Enabled: true, City: cfg.City.Name, Timezone: cfg.City.Timezone, IsDay: s.roughDay(cfg.City.Timezone)}
	if w, ok := s.weather(ctx, *cfg.City); ok {
		t := w.TemperatureC
		view.Condition, view.IsDay, view.TemperatureC = w.Condition, w.IsDay, &t
		if !w.ObservedAt.IsZero() {
			view.ObservedAt = w.ObservedAt.Format(time.RFC3339)
		}
	}
	view.PhotoSlot = domainwindow.SlotFor(view.Condition, view.IsDay)
	view.Photo = cfg.Photos[view.PhotoSlot]
	return view, nil
}

// Get 读取后台配置
func (s *Service) Get(ctx context.Context) (AdminView, error) {
	cfg, err := s.load(ctx)
	if err != nil {
		return AdminView{}, err
	}
	return AdminView{City: cfg.City, Photos: cfg.Photos}, nil
}

// Update 整体更新后台配置
func (s *Service) Update(ctx context.Context, in UpdateInput) (AdminView, error) {
	kvs := map[string]string{keyCity: ""}
	if in.City != nil {
		city := *in.City
		city.Name, city.Region, city.Country, city.Timezone = strings.TrimSpace(city.Name), strings.TrimSpace(city.Region), strings.TrimSpace(city.Country), strings.TrimSpace(city.Timezone)
		if err := city.Validate(); err != nil {
			return AdminView{}, err
		}
		raw, err := json.Marshal(city)
		if err != nil {
			return AdminView{}, err
		}
		kvs[keyCity] = string(raw)
	}
	for slot := range in.Photos {
		if !domainwindow.IsValidPhotoSlot(slot) {
			return AdminView{}, ErrInvalidPhoto
		}
	}
	for _, slot := range domainwindow.PhotoSlots {
		u := strings.TrimSpace(in.Photos[slot])
		if !validPhotoURL(u) {
			return AdminView{}, ErrInvalidPhoto
		}
		kvs[keyPhotoPrefix+string(slot)] = u
	}
	if err := s.settings.UpsertMany(ctx, kvs); err != nil {
		return AdminView{}, err
	}
	return s.Get(ctx)
}

// SearchCities 按名称搜索城市
func (s *Service) SearchCities(ctx context.Context, query string) ([]domainwindow.City, error) {
	q := strings.TrimSpace(query)
	if n := utf8.RuneCountInString(q); n == 0 || n > 40 {
		return nil, ErrInvalidQuery
	}
	cities, err := s.provider.SearchCities(ctx, q)
	if err != nil {
		return nil, domainwindow.ErrWeatherUnavailable
	}
	if cities == nil {
		cities = []domainwindow.City{}
	}
	return cities, nil
}

// Knock 访客敲窗：发布敲窗事件，由通知订阅者给站长发轻提示。频率限制在路由层按访客做。
func (s *Service) Knock(ctx context.Context, page string) error {
	return s.bus.Publish(ctx, []domainshared.DomainEvent{domainwindow.NewKnocked(cleanPage(page))})
}

func (s *Service) load(ctx context.Context) (domainwindow.Config, error) {
	m, err := s.settings.GetAll(ctx)
	if err != nil {
		return domainwindow.Config{}, err
	}
	cfg := domainwindow.Config{Photos: make(map[domainwindow.PhotoSlot]string, len(domainwindow.PhotoSlots))}
	if raw := m[keyCity]; raw != "" {
		var city domainwindow.City
		// 存量数据损坏时视为未配置，而不是让全站背景接口报错。
		if json.Unmarshal([]byte(raw), &city) == nil && city.Validate() == nil {
			cfg.City = &city
		}
	}
	for _, slot := range domainwindow.PhotoSlots {
		cfg.Photos[slot] = m[keyPhotoPrefix+string(slot)]
	}
	return cfg, nil
}

// weather 读取城市此刻天气：新鲜缓存直接返回；否则拉取并回写，拉取失败时退回旧缓存。
func (s *Service) weather(ctx context.Context, city domainwindow.City) (cachedWeather, bool) {
	key := fmt.Sprintf("window:weather:%.3f,%.3f", city.Latitude, city.Longitude)
	cached, hasCache := s.readCache(ctx, key)
	if hasCache && s.now().Sub(cached.FetchedAt) < freshFor {
		return cached, true
	}
	w, err := s.provider.Current(ctx, city.Latitude, city.Longitude)
	if err != nil {
		return cached, hasCache
	}
	fresh := cachedWeather{Condition: w.Condition, IsDay: w.IsDay, TemperatureC: w.TemperatureC, ObservedAt: w.ObservedAt, FetchedAt: s.now()}
	if raw, err := json.Marshal(fresh); err == nil && s.rdb != nil {
		_ = s.rdb.Set(ctx, key, raw, keepFor).Err()
	}
	return fresh, true
}

func (s *Service) readCache(ctx context.Context, key string) (cachedWeather, bool) {
	if s.rdb == nil {
		return cachedWeather{}, false
	}
	raw, err := s.rdb.Get(ctx, key).Bytes()
	if err != nil {
		return cachedWeather{}, false
	}
	var w cachedWeather
	if json.Unmarshal(raw, &w) != nil {
		return cachedWeather{}, false
	}
	return w, true
}

// roughDay 天气不可用时按城市时区的本地时间粗算白天（6 点到 18 点）
func (s *Service) roughDay(tz string) bool {
	loc, err := time.LoadLocation(tz)
	if err != nil {
		return true
	}
	h := s.now().In(loc).Hour()
	return h >= 6 && h < 18
}

// validPhotoURL 允许空串、站内绝对路径（/uploads/...）或 http(s) 地址
func validPhotoURL(u string) bool {
	if u == "" {
		return true
	}
	if len(u) > maxPhotoURL || strings.ContainsAny(u, " \t\r\n\"'<>") {
		return false
	}
	if strings.HasPrefix(u, "/") {
		return !strings.HasPrefix(u, "//")
	}
	p, err := url.Parse(u)
	return err == nil && (p.Scheme == "https" || p.Scheme == "http") && p.Host != ""
}

// cleanPage 只保留站内路径部分，去掉查询串与片段，限制长度
func cleanPage(page string) string {
	p := strings.TrimSpace(page)
	if i := strings.IndexAny(p, "?#"); i >= 0 {
		p = p[:i]
	}
	if !strings.HasPrefix(p, "/") || strings.HasPrefix(p, "//") {
		return "/"
	}
	if utf8.RuneCountInString(p) > maxPage {
		p = string([]rune(p)[:maxPage])
	}
	return p
}
