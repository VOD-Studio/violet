// Package presence 编排 Nowbeam 接收端的设备授权、连接注册与公开读取。
package presence

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/rs/zerolog/log"

	appshared "blog-api/internal/application/shared"
	domainpresence "blog-api/internal/domain/presence"
	domainshared "blog-api/internal/domain/shared"
)

// IngestPath 设备上报的 WebSocket 路由；签发凭证时随结果返回，客户端拼成完整 wss:// 地址。
const IngestPath = "/api/v1/presence/ingest"

// maxSubscribers 公开推送流的连接上限，超出返回 503，避免匿名长连接耗尽资源。
const maxSubscribers = 2000

// ErrTooManySubscribers 公开推送流已满。
var ErrTooManySubscribers = errors.New("too many presence subscribers")

// --- 输出 DTO ---

// PresenceDTO 公开当前状态：只含租约内在线的设备，按签发顺序排列（快照刷新不改变顺序）。
type PresenceDTO struct {
	// GeneratedAt 服务端生成时间；消费者用它与 updated_at 之差推进播放位置，不依赖本机时钟
	GeneratedAt time.Time           `json:"generated_at"`
	Devices     []DevicePresenceDTO `json:"devices"`
}

// DevicePresenceDTO 单台在线设备的当前快照。
type DevicePresenceDTO struct {
	ID          string `json:"id"`
	DisplayName string `json:"display_name"`
	// UpdatedAt 最后一份新快照的接收时间，也是 position_ms 的位置锚点
	UpdatedAt time.Time `json:"updated_at"`
	// ExpiresAt 租约到期时间；过期后消费者必须停止展示
	ExpiresAt time.Time  `json:"expires_at"`
	Sources   SourcesDTO `json:"sources"`
}

// SourcesDTO 三个来源；null=该来源为空。
type SourcesDTO struct {
	Application *ApplicationDTO `json:"application"`
	Window      *WindowDTO      `json:"window"`
	Media       *MediaDTO       `json:"media"`
}

type ApplicationDTO struct {
	DisplayName string `json:"display_name"`
}

type WindowDTO struct {
	Title string `json:"title"`
}

type MediaDTO struct {
	// SessionID 媒体会话 ID；换曲时变化
	SessionID  string  `json:"session_id"`
	PlayerName string  `json:"player_name"`
	Title      string  `json:"title"`
	Artist     *string `json:"artist"`
	Album      *string `json:"album"`
	// State 'playing' | 'paused'
	State string `json:"state"`
	// DurationMS 毫秒；null=不可靠
	DurationMS *int64 `json:"duration_ms"`
	// PositionMS 毫秒，以 updated_at 为锚点；null=不可靠，不得绘制进度
	PositionMS *int64 `json:"position_ms"`
	// Rate 播放速率；暂停为 0，null=不可靠，不得推进位置
	Rate *float64 `json:"rate"`
}

// AdminDeviceDTO 后台设备列表项，含连接诊断。
type AdminDeviceDTO struct {
	ID          string    `json:"id"`
	DisplayName string    `json:"display_name"`
	CreatedAt   time.Time `json:"created_at"`
	// Online 是否持有有效租约；在线但三个来源都可为空
	Online bool `json:"online"`
	// UpdatedAt 离线时为 null
	UpdatedAt *time.Time `json:"updated_at"`
	// ExpiresAt 离线时为 null
	ExpiresAt *time.Time `json:"expires_at"`
	// Sources 离线时为 null
	Sources *SourcesDTO `json:"sources"`
}

// IssuedDeviceDTO 签发结果；Token 只在此返回一次。
type IssuedDeviceDTO struct {
	Device AdminDeviceDTO `json:"device"`
	Token  string         `json:"token"`
	// IngestPath 上报路由，客户端需拼成完整 wss:// 地址
	IngestPath string `json:"ingest_path"`
}

type SettingsDTO struct {
	// PublicRead 是否允许匿名访客读取当前状态
	PublicRead bool `json:"public_read"`
}

// Service 设备授权、公开策略与当前状态读取。
type Service struct {
	repo     domainpresence.Repository
	registry *Registry
	bus      appshared.EventBus
	now      func() time.Time

	subMu       sync.Mutex
	subscribers map[chan struct{}]struct{}
	closed      bool
}

// NewService 构造服务并接管 registry 的变更通知；now 为 nil 时使用 time.Now。
func NewService(repo domainpresence.Repository, registry *Registry, bus appshared.EventBus, now func() time.Time) *Service {
	if now == nil {
		now = time.Now
	}
	s := &Service{repo: repo, registry: registry, bus: bus, now: now, subscribers: make(map[chan struct{}]struct{})}
	registry.setOnChange(s.notify)
	return s
}

// Registry 暴露给上报适配器的连接注册表。
func (s *Service) Registry() *Registry { return s.registry }

// Run 驱动租约调度；ctx 结束时关闭全部上报连接与推送订阅。
func (s *Service) Run(ctx context.Context) {
	s.registry.Run(ctx)
	s.subMu.Lock()
	defer s.subMu.Unlock()
	s.closed = true
	for ch := range s.subscribers {
		close(ch)
		delete(s.subscribers, ch)
	}
}

// --- 后台用例 ---

// ListDevices 列出全部设备及其连接状态。
func (s *Service) ListDevices(ctx context.Context) ([]AdminDeviceDTO, error) {
	devices, err := s.repo.ListDevices(ctx)
	if err != nil {
		return nil, domainshared.Internal("查询设备失败", err)
	}
	live := s.registry.live()
	result := make([]AdminDeviceDTO, 0, len(devices))
	for _, d := range devices {
		result = append(result, adminDevice(d, live))
	}
	return result, nil
}

// IssueDevice 签发设备凭证；新设备在客户端连接前保持离线。
func (s *Service) IssueDevice(ctx context.Context, displayName string) (*IssuedDeviceDTO, error) {
	device, token, err := domainpresence.NewDevice(displayName, s.now())
	if err != nil {
		return nil, err
	}
	if err := s.repo.CreateDevice(ctx, device); err != nil {
		return nil, domainshared.Internal("保存设备失败", err)
	}
	s.publish(ctx, domainpresence.NewDeviceAuthorized(device))
	return &IssuedDeviceDTO{Device: adminDevice(device, nil), Token: token, IngestPath: IngestPath}, nil
}

// RevokeDevice 撤销设备凭证，立即清除其活动并断开连接。
func (s *Service) RevokeDevice(ctx context.Context, rawID string) error {
	id, err := domainshared.ParseID(rawID)
	if err != nil {
		return domainshared.NotFound("设备")
	}
	device, err := s.registry.Revoke(ctx, id)
	if errors.Is(err, domainpresence.ErrDeviceNotFound) {
		return domainshared.NotFound("设备")
	}
	if err != nil {
		return domainshared.Internal("撤销设备失败", err)
	}
	s.publish(ctx, domainpresence.NewDeviceRevoked(device))
	return nil
}

// Settings 读取公开策略。
func (s *Service) Settings(ctx context.Context) (SettingsDTO, error) {
	settings, err := s.repo.Settings(ctx)
	if err != nil {
		return SettingsDTO{}, domainshared.Internal("读取实时状态设置失败", err)
	}
	return SettingsDTO{PublicRead: settings.PublicRead}, nil
}

// UpdateSettings 覆盖公开策略；切换后立即推送给在线访客。
func (s *Service) UpdateSettings(ctx context.Context, actorID domainshared.ID, input SettingsDTO) (SettingsDTO, error) {
	previous, err := s.repo.Settings(ctx)
	if err != nil {
		return SettingsDTO{}, domainshared.Internal("读取实时状态设置失败", err)
	}
	if err := s.repo.SaveSettings(ctx, domainpresence.Settings{PublicRead: input.PublicRead}); err != nil {
		return SettingsDTO{}, domainshared.Internal("保存实时状态设置失败", err)
	}
	if previous.PublicRead != input.PublicRead {
		s.publish(ctx, domainpresence.NewPublicReadChanged(actorID, input.PublicRead))
		s.notify()
	}
	return input, nil
}

// --- 公开读取 ---

// Public 返回公开当前状态；公开读取关闭时设备列表为空。
func (s *Service) Public(ctx context.Context) (PresenceDTO, error) {
	result := PresenceDTO{GeneratedAt: s.now(), Devices: []DevicePresenceDTO{}}
	settings, err := s.repo.Settings(ctx)
	if err != nil {
		return result, domainshared.Internal("读取实时状态设置失败", err)
	}
	if !settings.PublicRead {
		return result, nil
	}
	live := s.registry.live()
	if len(live) == 0 {
		return result, nil
	}
	devices, err := s.repo.ListDevices(ctx)
	if err != nil {
		return result, domainshared.Internal("查询设备失败", err)
	}
	for _, d := range devices {
		state, ok := live[d.ID().String()]
		if !ok {
			continue
		}
		result.Devices = append(result.Devices, DevicePresenceDTO{
			ID: d.ID().String(), DisplayName: d.DisplayName(),
			UpdatedAt: state.ReceivedAt, ExpiresAt: state.ExpiresAt, Sources: sourcesDTO(state.Sources),
		})
	}
	return result, nil
}

// Subscribe 订阅当前状态变化信号；信号只表示「可能变化」，订阅方自行重读 Public。
// 服务关闭时 channel 被关闭。
func (s *Service) Subscribe() (<-chan struct{}, func(), error) {
	s.subMu.Lock()
	defer s.subMu.Unlock()
	if s.closed {
		return nil, nil, ErrUnavailable
	}
	if len(s.subscribers) >= maxSubscribers {
		return nil, nil, ErrTooManySubscribers
	}
	ch := make(chan struct{}, 1)
	s.subscribers[ch] = struct{}{}
	return ch, func() {
		s.subMu.Lock()
		defer s.subMu.Unlock()
		if _, ok := s.subscribers[ch]; ok {
			delete(s.subscribers, ch)
			close(ch)
		}
	}, nil
}

// notify 非阻塞广播；缓冲 1 让连续变化合并成一次重读。
func (s *Service) notify() {
	s.subMu.Lock()
	defer s.subMu.Unlock()
	for ch := range s.subscribers {
		select {
		case ch <- struct{}{}:
		default:
		}
	}
}

func (s *Service) publish(ctx context.Context, event domainshared.DomainEvent) {
	if s.bus == nil {
		return
	}
	if err := s.bus.Publish(ctx, []domainshared.DomainEvent{event}); err != nil {
		log.Warn().Err(err).Str("event", event.EventName()).Msg("发布实时状态事件失败")
	}
}

func adminDevice(d *domainpresence.Device, live map[string]liveState) AdminDeviceDTO {
	dto := AdminDeviceDTO{ID: d.ID().String(), DisplayName: d.DisplayName(), CreatedAt: d.CreatedAt()}
	if state, ok := live[dto.ID]; ok {
		sources := sourcesDTO(state.Sources)
		dto.Online, dto.UpdatedAt, dto.ExpiresAt, dto.Sources = true, &state.ReceivedAt, &state.ExpiresAt, &sources
	}
	return dto
}

func sourcesDTO(src domainpresence.Sources) SourcesDTO {
	var dto SourcesDTO
	if src.Application != nil {
		dto.Application = &ApplicationDTO{DisplayName: src.Application.DisplayName}
	}
	if src.Window != nil {
		dto.Window = &WindowDTO{Title: src.Window.Title}
	}
	if m := src.Media; m != nil {
		dto.Media = &MediaDTO{
			SessionID: m.SessionID, PlayerName: m.PlayerName, Title: m.Title, Artist: m.Artist, Album: m.Album,
			State: string(m.Playback.State), DurationMS: m.Playback.DurationMS, PositionMS: m.Playback.PositionMS, Rate: m.Playback.Rate,
		}
	}
	return dto
}
