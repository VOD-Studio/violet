package kit

import (
	"time"

	"github.com/VOD-Studio/mimo-music/internal/cli/recall"
)

// Record 把一个成功消费的歌曲事件记入召回池(隐式埋点)。
//
// 机制选型(PRD-0014 G 片段,方案 c):kit 层提供统一的 Record helper,命令层在
// --id 成功消费后显式调用一行。kit.Exec 是 generic,拿不到具体 id/name 字段
// (SongId 在各 proto req struct 里),无法在 generic 层自动埋点;故选择显式 helper
// 而非 (a) interface+wrapper(要为每个 song req 写 wrapper)或 (b) endpoint 层埋点
// (改 engine 抽象,被 service 包共用,高风险)。决策记录在 CONTEXT.md。
//
// **只记成功**:调用方负责仅在命令成功(且写操作经 --yes 确认)后调用。
// 失败/取消不调本函数。Record 自身失败不阻塞主命令——仅 Warnf 告警(召回池是
// 辅助设施,损坏不应影响播放/下载主流程)。
//
// 歌曲类 id 进池(SongId);album/artist/playlist 的 id 不进召回池(召回池语义是
// 「歌曲」候选,补全 --id 用)。
func (k *Kit) Record(id int64, name, artist string, src recall.Src) {
	if k.pool == nil || id == 0 {
		return // 无池(测试或未初始化)或无效 id,静默跳过
	}
	if err := k.pool.Append(recall.Event{
		ID:     id,
		Name:   name,
		Artist: artist,
		Src:    src,
		TS:     time.Now(),
	}); err != nil {
		k.Warnf("⚠ 记录召回池失败(不影响当前命令): %v", err)
	}
}

// RecallPool 返回召回池(供 recent/补全消费)。无池返回 nil。
func (k *Kit) RecallPool() *recall.Pool {
	return k.pool
}

// SetRecallPool 注入召回池(测试用:替换为指向临时目录的 Pool)。
// 生产代码用 New() 默认初始化的池,不调本方法。
func (k *Kit) SetRecallPool(p *recall.Pool) {
	k.pool = p
}
