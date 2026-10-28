package presence

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/coder/websocket"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	apppresence "blog-api/internal/application/presence"
	domainpresence "blog-api/internal/domain/presence"
	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/middleware"
)

type memoryRepo struct {
	mu      sync.Mutex
	devices []*domainpresence.Device
}

func (m *memoryRepo) ListDevices(context.Context) ([]*domainpresence.Device, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return append([]*domainpresence.Device(nil), m.devices...), nil
}

func (m *memoryRepo) CreateDevice(_ context.Context, d *domainpresence.Device) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.devices = append(m.devices, d)
	return nil
}

func (m *memoryRepo) DeleteDevice(_ context.Context, id domainshared.ID) (*domainpresence.Device, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for i, d := range m.devices {
		if d.ID() == id {
			m.devices = append(m.devices[:i], m.devices[i+1:]...)
			return d, nil
		}
	}
	return nil, domainpresence.ErrDeviceNotFound
}

func (m *memoryRepo) FindDeviceByTokenHash(_ context.Context, hash string) (*domainpresence.Device, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, d := range m.devices {
		if d.TokenHash() == hash {
			return d, nil
		}
	}
	return nil, domainpresence.ErrDeviceNotFound
}

func (m *memoryRepo) Settings(context.Context) (domainpresence.Settings, error) {
	return domainpresence.Settings{PublicRead: true}, nil
}

func (m *memoryRepo) SaveSettings(context.Context, domainpresence.Settings) error { return nil }

type ingestFixture struct {
	service *apppresence.Service
	server  *httptest.Server
	url     string
	token   string
	device  apppresence.AdminDeviceDTO
}

func newIngestFixture(t *testing.T) *ingestFixture {
	t.Helper()
	repo := &memoryRepo{}
	registry := apppresence.NewRegistry(repo, nil)
	service := apppresence.NewService(repo, registry, nil, nil)
	issued, err := service.IssueDevice(context.Background(), "MacBook Pro")
	require.NoError(t, err)
	// 经 Logger 中间件包装，覆盖真实路由链上的 Hijack 路径
	server := httptest.NewServer(middleware.Logger(http.HandlerFunc(NewIngestHandler(registry).Ingest)))
	t.Cleanup(func() {
		registry.Shutdown()
		server.Close()
	})
	return &ingestFixture{
		service: service, server: server, url: "ws" + strings.TrimPrefix(server.URL, "http"),
		token: issued.Token, device: issued.Device,
	}
}

func (f *ingestFixture) dial(t *testing.T, header http.Header) (*websocket.Conn, *http.Response, error) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if header == nil {
		header = http.Header{"Authorization": {"Bearer " + f.token}}
	}
	return websocket.Dial(ctx, f.url, &websocket.DialOptions{HTTPHeader: header, Subprotocols: []string{subprotocol}})
}

func readJSON(t *testing.T, conn *websocket.Conn) map[string]any {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	kind, data, err := conn.Read(ctx)
	require.NoError(t, err)
	require.Equal(t, websocket.MessageText, kind)
	var message map[string]any
	require.NoError(t, json.Unmarshal(data, &message))
	return message
}

func writeText(t *testing.T, conn *websocket.Conn, text string) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	require.NoError(t, conn.Write(ctx, websocket.MessageText, []byte(text)))
}

func closeStatus(t *testing.T, conn *websocket.Conn) websocket.StatusCode {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, _, err := conn.Read(ctx)
	return websocket.CloseStatus(err)
}

func snapshotText(connectionID string, sequence int, app string) string {
	return `{"protocolVersion":1,"type":"snapshot","connectionId":"` + connectionID + `","sequence":` +
		strconv.Itoa(sequence) + `,"observedAt":"2026-10-25T12:30:00Z","sources":{"application":{"displayName":"` +
		app + `"},"window":null,"media":null}}`
}

func TestIngestRejectsBeforeUpgrade(t *testing.T) {
	f := newIngestFixture(t)
	for _, tc := range []struct {
		name   string
		header http.Header
		status int
	}{
		{"missing credential", http.Header{}, http.StatusUnauthorized},
		{"wrong credential", http.Header{"Authorization": {"Bearer violet_nb_unknown"}}, http.StatusUnauthorized},
		{"browser origin", http.Header{"Authorization": {"Bearer " + f.token}, "Origin": {"https://example.com"}}, http.StatusForbidden},
	} {
		t.Run(tc.name, func(t *testing.T) {
			conn, resp, err := f.dial(t, tc.header)
			if conn != nil {
				_ = conn.CloseNow()
			}
			require.Error(t, err)
			require.NotNil(t, resp)
			assert.Equal(t, tc.status, resp.StatusCode)
		})
	}

	t.Run("missing subprotocol", func(t *testing.T) {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		conn, resp, err := websocket.Dial(ctx, f.url, &websocket.DialOptions{HTTPHeader: http.Header{"Authorization": {"Bearer " + f.token}}})
		if conn != nil {
			_ = conn.CloseNow()
		}
		require.Error(t, err)
		require.NotNil(t, resp)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})
}

func TestIngestWelcomeSnapshotAckAndDuplicate(t *testing.T) {
	f := newIngestFixture(t)
	conn, resp, err := f.dial(t, nil)
	require.NoError(t, err)
	defer conn.CloseNow()
	assert.Equal(t, subprotocol, resp.Header.Get("Sec-WebSocket-Protocol"))

	welcome := readJSON(t, conn)
	assert.Equal(t, "welcome", welcome["type"])
	assert.Equal(t, f.device.ID, welcome["deviceId"])
	assert.EqualValues(t, 45000, welcome["leaseDurationMs"])
	assert.EqualValues(t, 15000, welcome["heartbeatIntervalMs"])
	connectionID := welcome["connectionId"].(string)

	writeText(t, conn, snapshotText(connectionID, 1, "Code"))
	ack := readJSON(t, conn)
	assert.Equal(t, "ack", ack["type"])
	assert.Equal(t, connectionID, ack["connectionId"])
	assert.EqualValues(t, 1, ack["sequence"])

	presence, err := f.service.Public(context.Background())
	require.NoError(t, err)
	require.Len(t, presence.Devices, 1)
	assert.Equal(t, "Code", presence.Devices[0].Sources.Application.DisplayName)

	writeText(t, conn, snapshotText(connectionID, 1, "Code"))
	assert.Equal(t, ack, readJSON(t, conn), "重复快照只回原 ACK")

	writeText(t, conn, `{"protocolVersion":1,"type":"snapshot"}`)
	failure := readJSON(t, conn)
	assert.Equal(t, "error", failure["type"])
	assert.Equal(t, "invalid_message", failure["code"])
	assert.Equal(t, websocket.StatusCode(1008), closeStatus(t, conn))

	presence, err = f.service.Public(context.Background())
	require.NoError(t, err)
	assert.Empty(t, presence.Devices, "当前写入连接被关闭后立即清除活动")
}

func TestIngestRevocationClosesConnection(t *testing.T) {
	f := newIngestFixture(t)
	conn, _, err := f.dial(t, nil)
	require.NoError(t, err)
	defer conn.CloseNow()
	connectionID := readJSON(t, conn)["connectionId"].(string)
	writeText(t, conn, snapshotText(connectionID, 1, "Code"))
	readJSON(t, conn)

	require.NoError(t, f.service.RevokeDevice(context.Background(), f.device.ID))
	failure := readJSON(t, conn)
	assert.Equal(t, "credential_revoked", failure["code"])
	assert.Equal(t, websocket.StatusCode(4001), closeStatus(t, conn))

	_, resp, err := f.dial(t, nil)
	require.Error(t, err)
	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode, "撤销后旧凭证不能再握手")
}
