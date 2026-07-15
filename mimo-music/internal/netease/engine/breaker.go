// Package engine 的熔断器。
//
// 连续失败达阈值后短路，避免雪崩。熔断打开时直接返回 ErrCircuitOpen。
// 新架构下熔断器保护 engine.RawDo 这一个方法，不需要装饰每个能力子接口。
package engine

import (
	"errors"
	"sync"
	"time"
)

// ErrCircuitOpen 是熔断器打开时的错误。
var ErrCircuitOpen = errors.New("熔断器打开")

// circuitState 是熔断器状态。
type circuitState int

const (
	stateClosed   circuitState = iota // 关闭（正常放行）
	stateOpen                         // 打开（短路，直接返回错误）
	stateHalfOpen                     // 半开（放行一次探测）
)

// circuitBreaker 是熔断器。
//
// 连续 failures 次失败后进入 Open，经过 openTimeout 后进入 HalfOpen 放行一次探测。
// 探测成功则 Closed，探测失败则重新 Open。线程安全。
type circuitBreaker struct {
	mu          sync.Mutex
	state       circuitState
	failures    int
	threshold   int
	openTimeout time.Duration
	lastFailure time.Time
}

// newCircuitBreaker 创建熔断器。
//
// threshold 是连续失败多少次后打开熔断，openTimeout 是熔断持续时间。
func newCircuitBreaker(threshold int, openTimeout time.Duration) *circuitBreaker {
	return &circuitBreaker{
		state:       stateClosed,
		threshold:   threshold,
		openTimeout: openTimeout,
	}
}

// allow 判断是否放行（调用前检查）。
//
// 返回 true 表示放行（Closed 或 HalfOpen），false 表示短路（Open）。
// HalfOpen 时只放行一次。
func (cb *circuitBreaker) allow() bool {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	switch cb.state {
	case stateClosed:
		return true
	case stateOpen:
		if time.Since(cb.lastFailure) >= cb.openTimeout {
			cb.state = stateHalfOpen
			return true
		}
		return false
	case stateHalfOpen:
		return true
	default:
		return true
	}
}

// recordSuccess 记录一次成功调用。
func (cb *circuitBreaker) recordSuccess() {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	cb.failures = 0
	cb.state = stateClosed
}

// recordFailure 记录一次失败调用。
func (cb *circuitBreaker) recordFailure() {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	cb.failures++
	cb.lastFailure = time.Now()
	if cb.state == stateHalfOpen || cb.failures >= cb.threshold {
		cb.state = stateOpen
	}
}

// state 返回当前熔断器状态（测试 / 指标用）。
func (cb *circuitBreaker) State() circuitState {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	return cb.state
}
