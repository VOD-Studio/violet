package player

// State 播放状态机。
type State int

const (
	// StateStopped 未播放/已播完/已关闭。
	StateStopped State = iota
	// StatePlaying 正在出声。
	StatePlaying
	// StatePaused 用户暂停(保持位置)。
	StatePaused
	// StateBuffering 起播前或播放中水位不足,正在续缓冲。
	StateBuffering
)

func (s State) String() string {
	switch s {
	case StatePlaying:
		return "playing"
	case StatePaused:
		return "paused"
	case StateBuffering:
		return "buffering"
	default:
		return "stopped"
	}
}

// Player 是播放 seam:命令层只做「拿 URL → 交给 Player」,
// 未来 TUI(roadmap Phase D)复用同一接口。
//
// 行为约定:
//   - Load 后开始后台预缓冲,状态进入 StateBuffering;Play 下达起播意图,
//     水位达标才真正出声(缓冲可视化由 Progress 暴露)。
//   - Progress 在 StateBuffering 时返回 (已缓冲 ms, 起播水位 ms);
//     其余状态返回 (当前位置 ms, 总时长 ms)。总时长对 mp3 是估算值
//     (流式无索引,按码率换算),flac 精确。
//   - Seek 是相对当前位置的 ±秒;纯流无法原地 seek,实现为
//     「暂停 → HTTP Range 重建 → 重新解码 → 恢复」。
//   - Volume 是 ±百分比步进,内部收敛到 0-100。
//   - Close 幂等;Close 后可重新 Load。
type Player interface {
	Load(url string) error
	Play() error
	Pause() error
	Seek(offsetSec int64) error
	Volume(delta int) error
	Progress() (currentMs, totalMs int64, state State)
	State() State
	Close() error
}
