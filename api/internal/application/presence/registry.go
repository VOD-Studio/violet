package presence

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/google/uuid"

	domainpresence "blog-api/internal/domain/presence"
	domainshared "blog-api/internal/domain/shared"
)

var (
	// ErrUnauthorized 上报凭证无效或已撤销（握手前返回 401）
	ErrUnauthorized = errors.New("unauthorized")
	// ErrUnavailable 接收端正在关闭（握手前返回 503）
	ErrUnavailable = errors.New("unavailable")
)

// 终止原因：前六个按协议先发 error 消息再关闭，其余只写进 close reason。
const (
	CodeInvalidMessage    = "invalid_message"
	CodeOutOfOrder        = "out_of_order"
	CodeSequenceConflict  = "sequence_conflict"
	CodeCredentialRevoked = "credential_revoked"
	CodeSessionReplaced   = "session_replaced"
	CodeInternalError     = "internal_error"
	CodeNormalClosure     = "normal_closure"
	CodeSessionExpired    = "session_expired"
	CodeGoingAway         = "going_away"
)

// sweepInterval 租约调度粒度；读取路径另行同步过滤过期，不依赖调度及时。
const sweepInterval = 500 * time.Millisecond

// Termination 连接终止结果；CloseCode 遵循 nowbeam.v1 关闭码表。
type Termination struct {
	CloseCode int
	Code      string
	// Sequence 触发终止的快照序号；与具体快照无关时为 nil
	Sequence *int64
}

// Ack 已原子接受的快照确认。
type Ack struct {
	ConnectionID string
	Sequence     int64
	ReceivedAt   time.Time
	ExpiresAt    time.Time
}

// Snapshot 已通过协议解码与来源校验的快照。
type Snapshot struct {
	ConnectionID string
	Sequence     int64
	Sources      domainpresence.Sources
	// Fingerprint 规范化消息的 SHA-256；同序号重复快照按它判定语义相等
	Fingerprint [32]byte
}

// Session 一条上报连接的写入身份。字段只在 Registry 锁内读写。
type Session struct {
	// ID 连接 ID（每条连接新建的 UUID v4，即协议的 connectionId）
	ID string
	// DeviceID 凭证绑定的设备 ID
	DeviceID string

	done        chan struct{}
	termination Termination
	// started welcome 已写出，首次快照期限开始计时
	started bool
	ended   bool
	// accepted 已凭序号 1 接管设备写入权
	accepted    bool
	deadline    time.Time
	sequence    int64
	fingerprint [32]byte
	ack         Ack
	sources     domainpresence.Sources
}

// Done 连接被终止时关闭。
func (s *Session) Done() <-chan struct{} { return s.done }

// Termination 阻塞到 Done 关闭后返回终止结果；channel 关闭为这些值提供同步。
func (s *Session) Termination() Termination { <-s.done; return s.termination }

// liveState 设备当前有效的快照投影。
type liveState struct {
	ReceivedAt time.Time
	ExpiresAt  time.Time
	Sources    domainpresence.Sources
}

// Registry 维护每台设备唯一的当前写入连接、序号与租约。
//
// 凭证校验、撤销与连接注册共用同一把锁：撤销提交后不可能再用旧凭证注册。
// 活动只在内存，服务重启即全部失效；多实例部署需改为共享状态，当前按单实例设计。
type Registry struct {
	mu       sync.Mutex
	repo     domainpresence.Repository
	now      func() time.Time
	closed   bool
	sessions map[string]*Session
	current  map[string]*Session
	// onChange 当前投影可能变化时调用（不得阻塞，锁内执行）
	onChange func()
}

// NewRegistry 构造连接注册表；now 为 nil 时使用 time.Now。
func NewRegistry(repo domainpresence.Repository, now func() time.Time) *Registry {
	if now == nil {
		now = time.Now
	}
	return &Registry{
		repo:     repo,
		now:      now,
		sessions: make(map[string]*Session),
		current:  make(map[string]*Session),
		onChange: func() {},
	}
}

// Register 校验设备凭证并登记候选连接；候选连接在首份快照被接受前不接管写入。
func (r *Registry) Register(ctx context.Context, token string) (*Session, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.closed {
		return nil, ErrUnavailable
	}
	if token == "" {
		return nil, ErrUnauthorized
	}
	device, err := r.repo.FindDeviceByTokenHash(ctx, domainpresence.HashToken(token))
	if errors.Is(err, domainpresence.ErrDeviceNotFound) {
		return nil, ErrUnauthorized
	}
	if err != nil {
		return nil, err
	}
	s := &Session{ID: uuid.NewString(), DeviceID: device.ID().String(), done: make(chan struct{})}
	r.sessions[s.ID] = s
	return s, nil
}

// Activate 在 welcome 成功写出后启动首份快照期限，不授予写入权。
func (r *Registry) Activate(s *Session) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.sessions[s.ID] != s || s.ended {
		return false
	}
	if !s.started {
		s.started = true
		s.deadline = r.now().Add(domainpresence.InitialSnapshotTimeout)
	}
	return true
}

// Submit 按连接归属、序号与指纹原子接受快照；返回 false 时连接已被终止。
func (r *Registry) Submit(s *Session, snapshot Snapshot) (Ack, bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if s.ended || r.sessions[s.ID] != s {
		return Ack{}, false
	}
	now := r.now()
	if !s.started || !now.Before(s.deadline) {
		r.stop(s, 4003, CodeSessionExpired, nil)
		return Ack{}, false
	}
	sequence := snapshot.Sequence
	if snapshot.ConnectionID != s.ID {
		r.stop(s, 1008, CodeInvalidMessage, &sequence)
		return Ack{}, false
	}
	if s.accepted {
		if r.current[s.DeviceID] != s {
			r.stop(s, 4002, CodeSessionReplaced, &sequence)
			return Ack{}, false
		}
		if sequence == s.sequence {
			// 同序号同语义只回原 ACK，不重新计算到期时间
			if snapshot.Fingerprint == s.fingerprint {
				return s.ack, true
			}
			r.stop(s, 1008, CodeSequenceConflict, &sequence)
			return Ack{}, false
		}
		if sequence != s.sequence+1 {
			r.stop(s, 1008, CodeOutOfOrder, &sequence)
			return Ack{}, false
		}
	} else {
		if sequence != 1 {
			r.stop(s, 1008, CodeOutOfOrder, &sequence)
			return Ack{}, false
		}
		if previous := r.current[s.DeviceID]; previous != nil {
			r.stop(previous, 4002, CodeSessionReplaced, nil)
		}
		s.accepted = true
		r.current[s.DeviceID] = s
	}
	s.sequence = sequence
	s.fingerprint = snapshot.Fingerprint
	s.sources = snapshot.Sources
	s.deadline = now.Add(domainpresence.Lease)
	s.ack = Ack{ConnectionID: s.ID, Sequence: sequence, ReceivedAt: now, ExpiresAt: s.deadline}
	r.onChange()
	return s.ack, true
}

// Reject 以指定关闭码终止连接（如二进制消息、超大消息、解码失败）。
func (r *Registry) Reject(s *Session, closeCode int, code string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.stop(s, closeCode, code, nil)
}

// Disconnect 传输层断开；仅当它仍是当前写入连接时清除活动。
func (r *Registry) Disconnect(s *Session) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.stop(s, 1000, CodeNormalClosure, nil)
}

// Revoke 持久删除设备凭证并立即关闭该设备的全部候选与当前连接。
func (r *Registry) Revoke(ctx context.Context, id domainshared.ID) (*domainpresence.Device, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	device, err := r.repo.DeleteDevice(ctx, id)
	if err != nil {
		return nil, err
	}
	for _, s := range r.sessions {
		if s.DeviceID == device.ID().String() {
			r.stop(s, 4001, CodeCredentialRevoked, nil)
		}
	}
	return device, nil
}

// Run 周期性清除过期租约，ctx 结束时关闭全部连接。
func (r *Registry) Run(ctx context.Context) {
	ticker := time.NewTicker(sweepInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			r.Shutdown()
			return
		case <-ticker.C:
			r.mu.Lock()
			r.expire(r.now())
			r.mu.Unlock()
		}
	}
}

// Shutdown 拒绝新连接并以 1001 关闭现有连接；活动不持久化，重启后不恢复。
func (r *Registry) Shutdown() {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.closed = true
	for _, s := range r.sessions {
		r.stop(s, 1001, CodeGoingAway, nil)
	}
}

// live 同步过滤过期租约后返回各设备当前快照。
func (r *Registry) live() map[string]liveState {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.expire(r.now())
	states := make(map[string]liveState, len(r.current))
	for deviceID, s := range r.current {
		states[deviceID] = liveState{ReceivedAt: s.ack.ReceivedAt, ExpiresAt: s.ack.ExpiresAt, Sources: s.sources}
	}
	return states
}

func (r *Registry) setOnChange(fn func()) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.onChange = fn
}

func (r *Registry) expire(now time.Time) {
	for _, s := range r.sessions {
		if s.started && !now.Before(s.deadline) {
			r.stop(s, 4003, CodeSessionExpired, nil)
		}
	}
}

// stop 终止连接；旧连接失去写入权后，它的任何回调都不能改动新连接的状态。
func (r *Registry) stop(s *Session, closeCode int, code string, sequence *int64) {
	if s.ended {
		return
	}
	s.ended = true
	s.termination = Termination{CloseCode: closeCode, Code: code, Sequence: sequence}
	if r.current[s.DeviceID] == s {
		delete(r.current, s.DeviceID)
		r.onChange()
	}
	delete(r.sessions, s.ID)
	s.sources = domainpresence.Sources{}
	close(s.done)
}
