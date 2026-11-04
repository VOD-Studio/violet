package window

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	appshared "blog-api/internal/application/shared"
	domainshared "blog-api/internal/domain/shared"
	domainwindow "blog-api/internal/domain/window"
)

type memStore struct{ m map[string]string }

func (s *memStore) GetAll(context.Context) (map[string]string, error) { return s.m, nil }
func (s *memStore) Upsert(_ context.Context, k, v string) error       { s.m[k] = v; return nil }
func (s *memStore) UpsertMany(_ context.Context, kvs map[string]string) error {
	for k, v := range kvs {
		s.m[k] = v
	}
	return nil
}

type stubProvider struct {
	weather domainwindow.Weather
	err     error
	calls   int
	cities  []domainwindow.City
}

func (p *stubProvider) Current(context.Context, float64, float64) (domainwindow.Weather, error) {
	p.calls++
	return p.weather, p.err
}
func (p *stubProvider) SearchCities(context.Context, string) ([]domainwindow.City, error) {
	return p.cities, p.err
}

type recBus struct {
	appshared.NoopEventBus
	events []domainshared.DomainEvent
}

func (b *recBus) Publish(_ context.Context, evs []domainshared.DomainEvent) error {
	b.events = append(b.events, evs...)
	return nil
}

const hangzhou = `{"name":"杭州","region":"浙江","country":"中国","latitude":30.29,"longitude":120.16,"timezone":"Asia/Shanghai"}`

func setup(t *testing.T, m map[string]string) (*Service, *stubProvider, *recBus, *memStore) {
	t.Helper()
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	p := &stubProvider{weather: domainwindow.Weather{Condition: domainwindow.ConditionRain, IsDay: false, TemperatureC: 12.5, ObservedAt: time.Date(2026, 11, 4, 13, 30, 0, 0, time.UTC)}}
	bus := &recBus{}
	store := &memStore{m: m}
	return NewService(store, p, rdb, bus), p, bus, store
}

func TestPublic_NotConfigured(t *testing.T) {
	s, p, _, _ := setup(t, map[string]string{keyPhotoPrefix + "cloudy": "/uploads/c.jpg"})
	v, err := s.Public(context.Background())
	require.NoError(t, err)
	assert.False(t, v.Enabled)
	assert.Equal(t, domainwindow.SlotCloudy, v.PhotoSlot)
	assert.Equal(t, "/uploads/c.jpg", v.Photo)
	assert.Zero(t, p.calls)
}

func TestPublic_WeatherAndPhoto(t *testing.T) {
	s, p, _, _ := setup(t, map[string]string{keyCity: hangzhou, keyPhotoPrefix + "night": "/uploads/n.jpg"})
	v, err := s.Public(context.Background())
	require.NoError(t, err)
	assert.True(t, v.Enabled)
	assert.Equal(t, "杭州", v.City)
	assert.Equal(t, "Asia/Shanghai", v.Timezone)
	assert.Equal(t, domainwindow.ConditionRain, v.Condition)
	assert.False(t, v.IsDay)
	require.NotNil(t, v.TemperatureC)
	assert.InDelta(t, 12.5, *v.TemperatureC, 1e-9)
	assert.Equal(t, "2026-11-04T13:30:00Z", v.ObservedAt)
	assert.Equal(t, domainwindow.SlotNight, v.PhotoSlot)
	assert.Equal(t, "/uploads/n.jpg", v.Photo)
	assert.Equal(t, 1, p.calls)
}

func TestPublic_CachesWhileFresh(t *testing.T) {
	s, p, _, _ := setup(t, map[string]string{keyCity: hangzhou})
	base := time.Date(2026, 11, 4, 12, 0, 0, 0, time.UTC)
	s.now = func() time.Time { return base }
	_, _ = s.Public(context.Background())
	s.now = func() time.Time { return base.Add(10 * time.Minute) }
	_, _ = s.Public(context.Background())
	assert.Equal(t, 1, p.calls)
	s.now = func() time.Time { return base.Add(16 * time.Minute) }
	_, _ = s.Public(context.Background())
	assert.Equal(t, 2, p.calls)
}

func TestPublic_FallsBackToStaleOnError(t *testing.T) {
	s, p, _, _ := setup(t, map[string]string{keyCity: hangzhou})
	base := time.Date(2026, 11, 4, 12, 0, 0, 0, time.UTC)
	s.now = func() time.Time { return base }
	_, _ = s.Public(context.Background())
	p.err = errors.New("down")
	s.now = func() time.Time { return base.Add(time.Hour) }
	v, err := s.Public(context.Background())
	require.NoError(t, err)
	assert.Equal(t, domainwindow.ConditionRain, v.Condition)
}

func TestPublic_NoWeatherAtAll(t *testing.T) {
	s, p, _, _ := setup(t, map[string]string{keyCity: hangzhou})
	p.err = errors.New("down")
	s.now = func() time.Time { return time.Date(2026, 11, 4, 2, 0, 0, 0, time.UTC) } // 上海 10:00
	v, err := s.Public(context.Background())
	require.NoError(t, err)
	assert.True(t, v.Enabled)
	assert.Empty(t, v.Condition)
	assert.Nil(t, v.TemperatureC)
	assert.True(t, v.IsDay)
	assert.Equal(t, domainwindow.SlotCloudy, v.PhotoSlot)
}

func TestPublic_CorruptCityTreatedAsUnset(t *testing.T) {
	s, _, _, _ := setup(t, map[string]string{keyCity: "{bad"})
	v, err := s.Public(context.Background())
	require.NoError(t, err)
	assert.False(t, v.Enabled)
}

func TestUpdate(t *testing.T) {
	s, _, _, store := setup(t, map[string]string{})
	city := domainwindow.City{Name: " 杭州 ", Latitude: 30.29, Longitude: 120.16, Timezone: "Asia/Shanghai"}
	v, err := s.Update(context.Background(), UpdateInput{City: &city, Photos: map[domainwindow.PhotoSlot]string{domainwindow.SlotRain: "/uploads/r.jpg"}})
	require.NoError(t, err)
	require.NotNil(t, v.City)
	assert.Equal(t, "杭州", v.City.Name)
	assert.Equal(t, "/uploads/r.jpg", v.Photos[domainwindow.SlotRain])
	assert.Equal(t, "", v.Photos[domainwindow.SlotSnow])
	assert.Len(t, v.Photos, len(domainwindow.PhotoSlots))

	v, err = s.Update(context.Background(), UpdateInput{})
	require.NoError(t, err)
	assert.Nil(t, v.City)
	assert.Equal(t, "", store.m[keyCity])
	assert.Equal(t, "", store.m[keyPhotoPrefix+"rain"])
}

func TestUpdate_Rejects(t *testing.T) {
	s, _, _, _ := setup(t, map[string]string{})
	bad := domainwindow.City{Name: "杭州", Latitude: 99, Longitude: 120, Timezone: "Asia/Shanghai"}
	_, err := s.Update(context.Background(), UpdateInput{City: &bad})
	assert.ErrorIs(t, err, domainwindow.ErrInvalidCity)
	for _, u := range []string{"javascript:alert(1)", "//evil.com/a.jpg", "ftp://x/y.jpg", "/uploads/a b.jpg"} {
		_, err = s.Update(context.Background(), UpdateInput{Photos: map[domainwindow.PhotoSlot]string{domainwindow.SlotClear: u}})
		assert.ErrorIs(t, err, ErrInvalidPhoto, u)
	}
	_, err = s.Update(context.Background(), UpdateInput{Photos: map[domainwindow.PhotoSlot]string{"sunset": "/uploads/a.jpg"}})
	assert.ErrorIs(t, err, ErrInvalidPhoto)
}

func TestSearchCities(t *testing.T) {
	s, p, _, _ := setup(t, map[string]string{})
	p.cities = []domainwindow.City{{Name: "杭州"}}
	got, err := s.SearchCities(context.Background(), " 杭州 ")
	require.NoError(t, err)
	assert.Len(t, got, 1)
	_, err = s.SearchCities(context.Background(), "  ")
	assert.ErrorIs(t, err, ErrInvalidQuery)
	p.err = errors.New("down")
	_, err = s.SearchCities(context.Background(), "杭州")
	assert.ErrorIs(t, err, domainwindow.ErrWeatherUnavailable)
}

func TestKnock(t *testing.T) {
	s, _, bus, _ := setup(t, map[string]string{})
	require.NoError(t, s.Knock(context.Background(), "/posts/abc?x=1#top"))
	require.NoError(t, s.Knock(context.Background(), "https://evil.com/"))
	require.Len(t, bus.events, 2)
	assert.Equal(t, "/posts/abc", bus.events[0].(domainwindow.Knocked).Page)
	assert.Equal(t, "/", bus.events[1].(domainwindow.Knocked).Page)
	assert.Equal(t, "window.knocked", bus.events[0].EventName())
}
