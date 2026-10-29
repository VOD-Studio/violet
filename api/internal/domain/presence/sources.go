package presence

import (
	"errors"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"
)

// nowbeam.v1 的一致性参数，welcome 原样下发给客户端。
const (
	// HeartbeatInterval 无变化时客户端重发完整快照的间隔
	HeartbeatInterval = 15 * time.Second
	// Lease 每份新接受快照的有效期，从接收端收到时起算
	Lease = 45 * time.Second
	// InitialSnapshotTimeout welcome 后必须收到第一份快照的期限
	InitialSnapshotTimeout = 10 * time.Second
	// MaxMessageBytes 完整 WebSocket 消息上限（含分片重组）
	MaxMessageBytes = 65536
	// MaxSequence 序号上限（JavaScript 安全整数）
	MaxSequence int64 = 9007199254740991
)

// PlaybackState 媒体会话播放状态；已结束的会话用 media=null 表示，没有 stopped。
type PlaybackState string

const (
	PlaybackPlaying PlaybackState = "playing"
	PlaybackPaused  PlaybackState = "paused"
)

// ErrInvalidSources 快照来源违反协议约束；整份快照拒收，不做部分更新。
var ErrInvalidSources = errors.New("invalid_message")

var sessionIDPattern = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)

// Sources 单台设备当前获准分享的完整来源集合；新快照整体替换旧值，nil 即该来源为空。
type Sources struct {
	// Application 前台应用；nil=没有允许公开的应用
	Application *Application
	// Window 窗口标题；nil=未开启、未授权、未命中白名单或读取失败
	Window *Window
	// Media 媒体会话；nil=不存在仍有效且允许分享的会话
	Media *Media
}

// Application 前台应用来源。
type Application struct {
	// DisplayName 应用展示名（≤128 码点）
	DisplayName string
}

// Window 窗口标题来源。
type Window struct {
	// Title 已在客户端本地过滤的窗口标题（≤1024 码点）
	Title string
}

// Media 播放器暴露的当前媒体会话。
type Media struct {
	// SessionID 客户端为本次会话生成的随机 UUID v4；换曲或会话重建时更换
	SessionID string
	// PlayerName 播放器展示名（≤128 码点）
	PlayerName string
	// Title 曲名（≤512 码点）
	Title string
	// Artist 艺人；nil=播放器未提供，不从历史补齐
	Artist *string
	// Album 专辑；nil=播放器未提供
	Album *string
	// Playback 播放进度与状态
	Playback Playback
}

// Playback 媒体播放信息。
//
// 位置以接收端收到快照的时刻为锚点；暂停或速率未知时消费者不得推算进度。
type Playback struct {
	// State 播放或暂停
	State PlaybackState
	// DurationMS 时长（毫秒）；nil=不可靠，否则为正整数
	DurationMS *int64
	// PositionMS 位置（毫秒）；nil=不可靠，否则非负且不超过时长
	PositionMS *int64
	// Rate 播放速率；暂停时必须为 0，播放时为 (0, 4] 或 nil（不可靠）
	Rate *float64
}

// IsEmpty 三个来源均为空：在线但没有可公开的活动。
func (s Sources) IsEmpty() bool {
	return s.Application == nil && s.Window == nil && s.Media == nil
}

// Validate 校验协议规定的文本与媒体跨字段约束。
func (s Sources) Validate() error {
	if s.Application != nil && !validText(s.Application.DisplayName, 128) {
		return ErrInvalidSources
	}
	if s.Window != nil && !validText(s.Window.Title, 1024) {
		return ErrInvalidSources
	}
	if s.Media != nil {
		return s.Media.validate()
	}
	return nil
}

func (m *Media) validate() error {
	if !sessionIDPattern.MatchString(m.SessionID) || !validText(m.PlayerName, 128) || !validText(m.Title, 512) {
		return ErrInvalidSources
	}
	if (m.Artist != nil && !validText(*m.Artist, 512)) || (m.Album != nil && !validText(*m.Album, 512)) {
		return ErrInvalidSources
	}
	p := m.Playback
	if p.DurationMS != nil && (*p.DurationMS < 1 || *p.DurationMS > MaxSequence) {
		return ErrInvalidSources
	}
	if p.PositionMS != nil && (*p.PositionMS < 0 || *p.PositionMS > MaxSequence) {
		return ErrInvalidSources
	}
	if p.DurationMS != nil && p.PositionMS != nil && *p.PositionMS > *p.DurationMS {
		return ErrInvalidSources
	}
	if p.Rate != nil && (*p.Rate < 0 || *p.Rate > 4) {
		return ErrInvalidSources
	}
	switch p.State {
	case PlaybackPaused:
		if p.Rate == nil || *p.Rate != 0 {
			return ErrInvalidSources
		}
	case PlaybackPlaying:
		if p.Rate != nil && *p.Rate == 0 {
			return ErrInvalidSources
		}
	default:
		return ErrInvalidSources
	}
	return nil
}

// validText 非空白、不超过 max 个码点、不含 C0 控制符与 DEL。
func validText(s string, max int) bool {
	if strings.TrimSpace(s) == "" || utf8.RuneCountInString(s) > max {
		return false
	}
	for _, r := range s {
		if r < 0x20 || r == 0x7f {
			return false
		}
	}
	return true
}
