package player

import (
	"io"
	"sync"
)

// fillChunk 是 fill goroutine 每次从上游读取的块大小。
const fillChunk = 32 * 1024

// prefetchBuffer 把上游(通常是 HTTP 响应体)尽快搬进内存,
// 读方(解码器)按需阻塞消费。已下载未消费的字节数即缓冲水位,
// 供弱网起播/续播策略查询。全量下载完成后可通过 Bytes 取快照
// (seek 走内存精确重解码,不再发 HTTP)。
type prefetchBuffer struct {
	mu     sync.Mutex
	cond   *sync.Cond
	buf    []byte
	off    int   // 读指针(已消费位置)
	eof    bool  // 上游已全部搬进 buf
	err    error // 上游读错误(一旦出现即终止)
	closed bool
}

// newSealedBuffer 构造一个「已完成」的 buffer:全量数据已在内存,
// 无 fill goroutine。用于 seek 内存路径——解码器改从 bytes.Reader 读,
// 此 buffer 仅供给水位查询(永远满水位、Done 恒真)。
func newSealedBuffer(data []byte) *prefetchBuffer {
	b := &prefetchBuffer{buf: data, eof: true}
	b.cond = sync.NewCond(&b.mu)
	return b
}

// newPrefetchBuffer 立即启动 fill goroutine 后台搬运 src。
// 调用方负责 Close(通常在解码器 Close 时级联)。
func newPrefetchBuffer(src io.Reader) *prefetchBuffer {
	b := &prefetchBuffer{}
	b.cond = sync.NewCond(&b.mu)
	go b.fill(src)
	return b
}

// fill 持续搬运直到 EOF/错误/Close。搬运速度只受网络限制,与消费速度解耦。
func (b *prefetchBuffer) fill(src io.Reader) {
	chunk := make([]byte, fillChunk)
	for {
		n, err := src.Read(chunk)
		if n > 0 {
			b.mu.Lock()
			if b.closed {
				b.mu.Unlock()
				return
			}
			// 不压缩已消费前缀:全量驻留是 seek 内存路径(Bytes 快照)的前提,
			// 单曲 MB 级体积,无需为省内存引入快照缺头风险。
			b.buf = append(b.buf, chunk[:n]...)
			b.mu.Unlock()
			b.cond.Broadcast()
		}
		if err != nil {
			b.mu.Lock()
			if err == io.EOF {
				b.eof = true
			} else {
				b.err = err
			}
			b.mu.Unlock()
			b.cond.Broadcast()
			return
		}
	}
}

// Read 实现 io.Reader:无数据时阻塞,直到有数据/EOF/错误/Close。
func (b *prefetchBuffer) Read(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	for b.off >= len(b.buf) && !b.eof && b.err == nil && !b.closed {
		b.cond.Wait()
	}
	if b.off < len(b.buf) {
		n := copy(p, b.buf[b.off:])
		b.off += n
		return n, nil
	}
	if b.err != nil {
		return 0, b.err
	}
	if b.closed {
		return 0, io.ErrClosedPipe
	}
	return 0, io.EOF
}

// PeekAtLeast 阻塞直到未消费部分 ≥atLeast 字节(或 EOF/错误/Close),
// 返回从当前读位置起最多 upTo 字节的快照,不推进读指针。
func (b *prefetchBuffer) PeekAtLeast(atLeast, upTo int) ([]byte, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	for len(b.buf)-b.off < atLeast && !b.eof && b.err == nil && !b.closed {
		b.cond.Wait()
	}
	n := min(len(b.buf)-b.off, upTo)
	out := make([]byte, n)
	copy(out, b.buf[b.off:b.off+n])
	if n > 0 {
		return out, nil
	}
	if b.err != nil {
		return nil, b.err
	}
	if b.closed {
		return nil, io.ErrClosedPipe
	}
	return nil, io.EOF
}

// Buffered 返回已下载未消费的字节数(水位)。
func (b *prefetchBuffer) Buffered() int {
	b.mu.Lock()
	defer b.mu.Unlock()
	return len(b.buf) - b.off
}

// Done 报告上游是否已全部搬进内存。
func (b *prefetchBuffer) Done() bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.eof
}

// Bytes 返回全部已下载内容的快照(含已消费部分)。仅在 Done 后有意义。
func (b *prefetchBuffer) Bytes() []byte {
	b.mu.Lock()
	defer b.mu.Unlock()
	out := make([]byte, len(b.buf))
	copy(out, b.buf)
	return out
}

// Close 幂等:唤醒所有阻塞中的 Read/Peek,fill goroutine 随后退出。
func (b *prefetchBuffer) Close() error {
	b.mu.Lock()
	b.closed = true
	b.mu.Unlock()
	b.cond.Broadcast()
	return nil
}
