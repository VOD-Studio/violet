package presence

import (
	"context"
	"crypto/sha256"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	domainpresence "blog-api/internal/domain/presence"
	domainshared "blog-api/internal/domain/shared"
)

type memoryRepo struct {
	mu       sync.Mutex
	devices  []*domainpresence.Device
	settings domainpresence.Settings
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
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.settings, nil
}

func (m *memoryRepo) SaveSettings(_ context.Context, s domainpresence.Settings) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.settings = s
	return nil
}

type fixture struct {
	repo     *memoryRepo
	registry *Registry
	service  *Service
	token    string
	deviceID string
	now      time.Time
}

func setup(t *testing.T) *fixture {
	t.Helper()
	f := &fixture{repo: &memoryRepo{settings: domainpresence.Settings{PublicRead: true}}, now: time.Date(2026, 10, 25, 12, 0, 0, 0, time.UTC)}
	clock := func() time.Time { return f.now }
	f.registry = NewRegistry(f.repo, clock)
	f.service = NewService(f.repo, f.registry, nil, clock)
	issued, err := f.service.IssueDevice(context.Background(), "虚构设备")
	require.NoError(t, err)
	f.token, f.deviceID = issued.Token, issued.Device.ID
	t.Cleanup(f.registry.Shutdown)
	return f
}

func (f *fixture) connect(t *testing.T) *Session {
	t.Helper()
	s, err := f.registry.Register(context.Background(), f.token)
	require.NoError(t, err)
	require.True(t, f.registry.Activate(s))
	return s
}

func (f *fixture) submit(s *Session, sequence int64, title string) (Ack, bool) {
	var sources domainpresence.Sources
	if title != "" {
		sources.Window = &domainpresence.Window{Title: title}
	}
	return f.registry.Submit(s, Snapshot{
		ConnectionID: s.ID, Sequence: sequence, Sources: sources,
		Fingerprint: sha256.Sum256([]byte(title)),
	})
}

// online 返回公开投影里的唯一设备；离线时为 nil。
func (f *fixture) online(t *testing.T) *DevicePresenceDTO {
	t.Helper()
	presence, err := f.service.Public(context.Background())
	require.NoError(t, err)
	if len(presence.Devices) == 0 {
		return nil
	}
	return &presence.Devices[0]
}

func windowTitle(d *DevicePresenceDTO) string {
	if d == nil || d.Sources.Window == nil {
		return ""
	}
	return d.Sources.Window.Title
}

func TestCandidateDoesNotTakeOverAndOldCleanupCannotClearNewState(t *testing.T) {
	f := setup(t)
	first := f.connect(t)
	_, ok := f.submit(first, 1, "旧窗口")
	require.True(t, ok)

	probe := f.connect(t)
	f.registry.Disconnect(probe)
	assert.Equal(t, "旧窗口", windowTitle(f.online(t)), "仅握手的探测连接不得清除当前写入者")

	bad := f.connect(t)
	_, ok = f.submit(bad, 2, "错误候选")
	assert.False(t, ok, "候选连接首份快照必须是序号 1")
	assert.Equal(t, "旧窗口", windowTitle(f.online(t)))

	replacement := f.connect(t)
	_, ok = f.submit(replacement, 1, "新窗口")
	require.True(t, ok)
	assert.Equal(t, 4002, first.Termination().CloseCode)

	f.registry.Disconnect(first)
	_, ok = f.submit(first, 2, "迟到窗口")
	assert.False(t, ok)
	assert.Equal(t, "新窗口", windowTitle(f.online(t)), "旧连接的清理回调不得改动新状态")
}

func TestDuplicateCannotExtendLeaseAndExpiredConnectionCannotRevive(t *testing.T) {
	f := setup(t)
	s := f.connect(t)
	ack, ok := f.submit(s, 1, "原窗口")
	require.True(t, ok)
	assert.Equal(t, f.now, ack.ReceivedAt)
	assert.Equal(t, f.now.Add(45*time.Second), ack.ExpiresAt)

	f.now = f.now.Add(44 * time.Second)
	duplicate, ok := f.submit(s, 1, "原窗口")
	require.True(t, ok)
	assert.Equal(t, ack, duplicate, "同序号同语义只回原 ACK，不续租")

	f.now = f.now.Add(time.Second)
	assert.Nil(t, f.online(t), "读取路径必须同步过滤过期快照")
	_, ok = f.submit(s, 2, "迟到窗口")
	assert.False(t, ok)
	assert.Equal(t, 4003, s.Termination().CloseCode)
}

func TestSubmitChecksExpiryWithoutSchedulerOrRead(t *testing.T) {
	f := setup(t)
	s := f.connect(t)
	f.submit(s, 1, "原窗口")
	f.now = f.now.Add(domainpresence.Lease)
	_, ok := f.submit(s, 2, "迟到窗口")
	assert.False(t, ok)
	assert.Nil(t, f.online(t))
}

func TestInitialDeadlineDoesNotClearHealthyWriter(t *testing.T) {
	f := setup(t)
	current := f.connect(t)
	f.submit(current, 1, "原窗口")
	candidate := f.connect(t)
	f.now = f.now.Add(domainpresence.InitialSnapshotTimeout)
	f.registry.mu.Lock()
	f.registry.expire(f.now)
	f.registry.mu.Unlock()

	assert.Equal(t, 4003, candidate.Termination().CloseCode)
	_, ok := f.submit(candidate, 1, "迟到候选")
	assert.False(t, ok)
	assert.NotNil(t, f.online(t), "候选超时不得清除健康写入者")
}

func TestSequenceFailuresClearOnlyCurrentWriter(t *testing.T) {
	for _, tc := range []struct {
		name     string
		sequence int64
		title    string
		code     string
	}{
		{"conflict", 1, "改写", CodeSequenceConflict},
		{"gap", 3, "原窗口", CodeOutOfOrder},
	} {
		t.Run(tc.name, func(t *testing.T) {
			f := setup(t)
			s := f.connect(t)
			f.submit(s, 1, "原窗口")
			_, ok := f.submit(s, tc.sequence, tc.title)
			assert.False(t, ok)
			assert.Equal(t, tc.code, s.Termination().Code)
			assert.Nil(t, f.online(t))
		})
	}
}

func TestFullReplacementAllowsOnlineEmptyState(t *testing.T) {
	f := setup(t)
	s := f.connect(t)
	f.submit(s, 1, "原窗口")
	f.submit(s, 2, "")
	got := f.online(t)
	require.NotNil(t, got)
	assert.Equal(t, SourcesDTO{}, got.Sources, "null 快照必须整体替换全部来源")

	f.registry.Disconnect(s)
	assert.Nil(t, f.online(t), "断开立即清除")
}

func TestRevocationIsAtomicWithCandidateRegistration(t *testing.T) {
	f := setup(t)
	current := f.connect(t)
	f.submit(current, 1, "原窗口")
	candidate, err := f.registry.Register(context.Background(), f.token)
	require.NoError(t, err)

	var wg sync.WaitGroup
	for range 24 {
		wg.Go(func() {
			s, err := f.registry.Register(context.Background(), f.token)
			if err == nil {
				f.registry.Activate(s)
			} else if !errors.Is(err, ErrUnauthorized) {
				t.Error(err)
			}
		})
	}
	require.NoError(t, f.service.RevokeDevice(context.Background(), f.deviceID))
	wg.Wait()

	assert.False(t, f.registry.Activate(candidate), "撤销后候选连接不得激活")
	assert.Equal(t, 4001, current.Termination().CloseCode)
	assert.Equal(t, 4001, candidate.Termination().CloseCode)
	_, err = f.registry.Register(context.Background(), f.token)
	assert.ErrorIs(t, err, ErrUnauthorized)
	assert.Nil(t, f.online(t))
}

func TestPublicReadDisabledHidesPresenceButAdminStillSeesIt(t *testing.T) {
	f := setup(t)
	s := f.connect(t)
	f.submit(s, 1, "原窗口")
	_, err := f.service.UpdateSettings(context.Background(), domainshared.NewID(), SettingsDTO{PublicRead: false})
	require.NoError(t, err)

	assert.Nil(t, f.online(t), "公开读取关闭时访客看不到任何设备")
	devices, err := f.service.ListDevices(context.Background())
	require.NoError(t, err)
	require.Len(t, devices, 1)
	assert.True(t, devices[0].Online)
	require.NotNil(t, devices[0].Sources)
	assert.Equal(t, "原窗口", devices[0].Sources.Window.Title)
}

func TestSubscribersAreSignalledOnChangeAndClosedOnShutdown(t *testing.T) {
	f := setup(t)
	changes, unsubscribe, err := f.service.Subscribe()
	require.NoError(t, err)
	defer unsubscribe()

	s := f.connect(t)
	f.submit(s, 1, "原窗口")
	select {
	case <-changes:
	default:
		t.Fatal("接受新快照后应发出变化信号")
	}

	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	f.service.Run(ctx)
	// 关闭前的断开信号可能仍在缓冲里；排空后 channel 必须已关闭，否则 range 不会结束
	for range changes {
	}
	assert.Equal(t, 1001, s.Termination().CloseCode)
}
