package openmeteo

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	domainwindow "blog-api/internal/domain/window"
)

func TestCurrent(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "30.2900", r.URL.Query().Get("latitude"))
		assert.Equal(t, "weather_code,is_day,temperature_2m", r.URL.Query().Get("current"))
		_, _ = w.Write([]byte(`{"utc_offset_seconds":28800,"current":{"time":"2026-11-04T21:30","weather_code":61,"is_day":0,"temperature_2m":12.5}}`))
	}))
	defer srv.Close()

	got, err := NewClientWithBase(srv.URL, srv.URL).Current(context.Background(), 30.29, 120.16)
	require.NoError(t, err)
	assert.Equal(t, domainwindow.ConditionRain, got.Condition)
	assert.False(t, got.IsDay)
	assert.InDelta(t, 12.5, got.TemperatureC, 1e-9)
	assert.Equal(t, time.Date(2026, 11, 4, 13, 30, 0, 0, time.UTC), got.ObservedAt.UTC())
}

func TestCurrent_MissingFields(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"current":{"time":"2026-11-04T21:30"}}`))
	}))
	defer srv.Close()
	_, err := NewClientWithBase(srv.URL, srv.URL).Current(context.Background(), 1, 1)
	assert.Error(t, err)
}

func TestCurrent_BadStatus(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusBadGateway) }))
	defer srv.Close()
	_, err := NewClientWithBase(srv.URL, srv.URL).Current(context.Background(), 1, 1)
	assert.Error(t, err)
}

func TestSearchCities(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "杭州", r.URL.Query().Get("name"))
		assert.Equal(t, "zh", r.URL.Query().Get("language"))
		_, _ = w.Write([]byte(`{"results":[{"name":"杭州","latitude":30.29,"longitude":120.16,"country":"中国","admin1":"浙江","timezone":"Asia/Shanghai"},{"name":"坏数据","latitude":30,"longitude":120,"timezone":""}]}`))
	}))
	defer srv.Close()

	got, err := NewClientWithBase(srv.URL, srv.URL).SearchCities(context.Background(), "杭州")
	require.NoError(t, err)
	require.Len(t, got, 1)
	assert.Equal(t, domainwindow.City{Name: "杭州", Region: "浙江", Country: "中国", Latitude: 30.29, Longitude: 120.16, Timezone: "Asia/Shanghai"}, got[0])
}

func TestSearchCities_NoResults(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { _, _ = w.Write([]byte(`{"generationtime_ms":0.3}`)) }))
	defer srv.Close()
	got, err := NewClientWithBase(srv.URL, srv.URL).SearchCities(context.Background(), "无此地")
	require.NoError(t, err)
	assert.Empty(t, got)
}
