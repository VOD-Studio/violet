// Package window 提供「窗」的领域模型。
//
// 窗是全站背景：访客隔着一扇起雾的玻璃，看站长所在城市此刻的天气。
// 本包定义天气状况的受控枚举、WMO 天气码映射、窗外照片槽位、配置读模型、
// 敲窗事件与天气数据源端口。
package window

import (
	"context"
	"math"
	"strings"
	"time"

	domainshared "blog-api/internal/domain/shared"
)

// Condition 窗外的天气状况（受控枚举，前端按它选择雨、雪、晴等画法）
type Condition string

const (
	// ConditionClear 晴或少云
	ConditionClear Condition = "clear"
	// ConditionCloudy 多云或阴
	ConditionCloudy Condition = "cloudy"
	// ConditionFog 雾
	ConditionFog Condition = "fog"
	// ConditionRain 毛毛雨、雨或阵雨
	ConditionRain Condition = "rain"
	// ConditionSnow 雪或阵雪
	ConditionSnow Condition = "snow"
	// ConditionStorm 雷暴
	ConditionStorm Condition = "storm"
)

// ConditionFromWMO 把 WMO 天气码（Open-Meteo 的 weather_code）映射为窗的天气状况。
//
// 冻雨、冻毛毛雨归入雨：玻璃上看到的同样是水珠。未知码归入多云，窗仍然起雾但不下东西。
func ConditionFromWMO(code int) Condition {
	switch {
	case code == 0 || code == 1:
		return ConditionClear
	case code == 2 || code == 3:
		return ConditionCloudy
	case code == 45 || code == 48:
		return ConditionFog
	case code >= 51 && code <= 67, code >= 80 && code <= 82:
		return ConditionRain
	case code >= 71 && code <= 77, code == 85 || code == 86:
		return ConditionSnow
	case code >= 95 && code <= 99:
		return ConditionStorm
	default:
		return ConditionCloudy
	}
}

// PhotoSlot 窗外照片槽位：四种天气各一张，夜里另用一张
type PhotoSlot string

const (
	// SlotClear 晴天的窗外
	SlotClear PhotoSlot = "clear"
	// SlotCloudy 阴天与雾天的窗外
	SlotCloudy PhotoSlot = "cloudy"
	// SlotRain 雨天与雷雨的窗外
	SlotRain PhotoSlot = "rain"
	// SlotSnow 雪天的窗外
	SlotSnow PhotoSlot = "snow"
	// SlotNight 夜里的窗外（不分天气）
	SlotNight PhotoSlot = "night"
)

// PhotoSlots 全部照片槽位，顺序即后台展示顺序
var PhotoSlots = []PhotoSlot{SlotClear, SlotCloudy, SlotRain, SlotSnow, SlotNight}

// IsValidPhotoSlot 判断照片槽位是否合法
func IsValidPhotoSlot(s PhotoSlot) bool {
	for _, v := range PhotoSlots {
		if v == s {
			return true
		}
	}
	return false
}

// SlotFor 选出此刻应显示的照片槽位：夜里一律用夜晚照片，雾归入阴天，雷暴归入雨天。
func SlotFor(c Condition, isDay bool) PhotoSlot {
	if !isDay {
		return SlotNight
	}
	switch c {
	case ConditionClear:
		return SlotClear
	case ConditionRain, ConditionStorm:
		return SlotRain
	case ConditionSnow:
		return SlotSnow
	default:
		return SlotCloudy
	}
}

// City 城市（地理编码结果，也是站长在后台选定的城市）
type City struct {
	// Name 城市名（按中文返回，如「杭州」）
	Name string `json:"name"`
	// Region 一级行政区（如「浙江」），可为空
	Region string `json:"region"`
	// Country 国家（如「中国」），可为空
	Country string `json:"country"`
	// Latitude 纬度，范围 -90 到 90
	Latitude float64 `json:"latitude"`
	// Longitude 经度，范围 -180 到 180
	Longitude float64 `json:"longitude"`
	// Timezone IANA 时区名（如 Asia/Shanghai），前端据此显示站长那边的时间
	Timezone string `json:"timezone"`
}

// ErrInvalidCity 城市数据不完整或坐标越界
var ErrInvalidCity = domainshared.BadRequest("城市信息不完整")

// Validate 校验城市：名称、时区非空，坐标在合法范围内
func (c City) Validate() error {
	if strings.TrimSpace(c.Name) == "" || strings.TrimSpace(c.Timezone) == "" {
		return ErrInvalidCity
	}
	if math.IsNaN(c.Latitude) || math.IsNaN(c.Longitude) || c.Latitude < -90 || c.Latitude > 90 || c.Longitude < -180 || c.Longitude > 180 {
		return ErrInvalidCity
	}
	if _, err := time.LoadLocation(c.Timezone); err != nil {
		return ErrInvalidCity
	}
	return nil
}

// Config 窗的配置读模型
type Config struct {
	// City 站长所在城市；nil 表示未配置，前端只画默认的窗、不显示天气
	City *City
	// Photos 各槽位的自定义窗外照片 URL；缺省或空串表示用内置默认图
	Photos map[PhotoSlot]string
}

// Weather 某一时刻的天气
type Weather struct {
	// Condition 天气状况
	Condition Condition
	// IsDay 当地此刻是否白天（日出到日落之间）
	IsDay bool
	// TemperatureC 气温（摄氏度）
	TemperatureC float64
	// ObservedAt 数据源给出的观测时间
	ObservedAt time.Time
}

// Knocked 访客敲窗事件；通知订阅者据此给站长发一条轻提示
type Knocked struct {
	domainshared.BaseEvent
	// Page 访客敲窗时所在页面的路径（如 /posts/abc），只保留路径部分
	Page string
}

// NewKnocked 构造敲窗事件；每次敲窗是一个独立来源，聚合 ID 随机生成
func NewKnocked(page string) Knocked {
	return Knocked{
		BaseEvent: domainshared.NewBaseEvent("window.knocked", domainshared.NewID()),
		Page:      page,
	}
}

// WeatherProvider 天气与城市数据源端口（infrastructure 层实现）
type WeatherProvider interface {
	// Current 读取某坐标此刻的天气
	Current(ctx context.Context, latitude, longitude float64) (Weather, error)
	// SearchCities 按名称搜索城市，最多返回少量候选
	SearchCities(ctx context.Context, query string) ([]City, error)
}

// ErrWeatherUnavailable 天气数据源暂不可用
var ErrWeatherUnavailable = domainshared.Internal("天气数据暂不可用", nil)
