// Package openmeteo 提供 Open-Meteo 天气与地理编码的基础设施适配器。
//
// 实现 domain/window.WeatherProvider 端口。Open-Meteo 免费、无需 API key；
// 返回的 weather_code 是 WMO 天气码，由领域层映射为窗的天气状况。
package openmeteo

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"time"

	domainwindow "blog-api/internal/domain/window"
)

const (
	defaultForecastURL = "https://api.open-meteo.com/v1/forecast"
	defaultGeocodeURL  = "https://geocoding-api.open-meteo.com/v1/search"
	// maxBody 响应体上限：正常响应只有几 KB，超出即视为异常
	maxBody = 1 << 20
)

// Client Open-Meteo 适配器
type Client struct {
	http        *http.Client
	forecastURL string
	geocodeURL  string
}

// NewClient 创建 Open-Meteo 适配器
func NewClient() *Client {
	return &Client{http: &http.Client{Timeout: 8 * time.Second}, forecastURL: defaultForecastURL, geocodeURL: defaultGeocodeURL}
}

// NewClientWithBase 创建指向自定义地址的适配器（测试用）
func NewClientWithBase(forecastURL, geocodeURL string) *Client {
	c := NewClient()
	c.forecastURL, c.geocodeURL = forecastURL, geocodeURL
	return c
}

// Current 读取坐标此刻的天气
func (c *Client) Current(ctx context.Context, latitude, longitude float64) (domainwindow.Weather, error) {
	q := url.Values{}
	q.Set("latitude", strconv.FormatFloat(latitude, 'f', 4, 64))
	q.Set("longitude", strconv.FormatFloat(longitude, 'f', 4, 64))
	q.Set("current", "weather_code,is_day,temperature_2m")
	q.Set("timezone", "auto")
	var body struct {
		UTCOffsetSeconds int `json:"utc_offset_seconds"`
		Current          *struct {
			Time        string   `json:"time"`
			WeatherCode *int     `json:"weather_code"`
			IsDay       *int     `json:"is_day"`
			Temperature *float64 `json:"temperature_2m"`
		} `json:"current"`
	}
	if err := c.get(ctx, c.forecastURL, q, &body); err != nil {
		return domainwindow.Weather{}, err
	}
	cur := body.Current
	if cur == nil || cur.WeatherCode == nil || cur.IsDay == nil {
		return domainwindow.Weather{}, fmt.Errorf("open-meteo: 缺少 current 字段")
	}
	w := domainwindow.Weather{Condition: domainwindow.ConditionFromWMO(*cur.WeatherCode), IsDay: *cur.IsDay == 1}
	if cur.Temperature != nil {
		w.TemperatureC = *cur.Temperature
	}
	// time 是当地时间且不带偏移（如 2026-11-04T21:30），按 utc_offset_seconds 还原成绝对时间。
	if t, err := time.ParseInLocation("2006-01-02T15:04", cur.Time, time.FixedZone("", body.UTCOffsetSeconds)); err == nil {
		w.ObservedAt = t
	}
	return w, nil
}

// SearchCities 按名称搜索城市（中文结果，最多 8 个）
func (c *Client) SearchCities(ctx context.Context, query string) ([]domainwindow.City, error) {
	q := url.Values{}
	q.Set("name", query)
	q.Set("count", "8")
	q.Set("language", "zh")
	q.Set("format", "json")
	var body struct {
		Results []struct {
			Name      string  `json:"name"`
			Latitude  float64 `json:"latitude"`
			Longitude float64 `json:"longitude"`
			Country   string  `json:"country"`
			Admin1    string  `json:"admin1"`
			Timezone  string  `json:"timezone"`
		} `json:"results"`
	}
	if err := c.get(ctx, c.geocodeURL, q, &body); err != nil {
		return nil, err
	}
	out := make([]domainwindow.City, 0, len(body.Results))
	for _, r := range body.Results {
		city := domainwindow.City{Name: r.Name, Region: r.Admin1, Country: r.Country, Latitude: r.Latitude, Longitude: r.Longitude, Timezone: r.Timezone}
		if city.Validate() == nil {
			out = append(out, city)
		}
	}
	return out, nil
}

func (c *Client) get(ctx context.Context, base string, q url.Values, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, base+"?"+q.Encode(), nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/json")
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("open-meteo: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("open-meteo: 状态码 %d", resp.StatusCode)
	}
	raw, err := io.ReadAll(io.LimitReader(resp.Body, maxBody))
	if err != nil {
		return fmt.Errorf("open-meteo: %w", err)
	}
	if err := json.Unmarshal(raw, out); err != nil {
		return fmt.Errorf("open-meteo: 解析响应失败: %w", err)
	}
	return nil
}
