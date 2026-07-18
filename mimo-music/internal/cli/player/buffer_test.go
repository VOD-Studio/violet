package player

import (
	"bytes"
	"io"
	"testing"
	"time"
)

// slowReader 按小块吐出数据,模拟弱网。
type slowReader struct {
	data   []byte
	off    int
	chunk  int
	delay  time.Duration
	closed chan struct{} // 非 nil 时 Close 后 Read 立即返回错误
}

func (r *slowReader) Read(p []byte) (int, error) {
	if r.closed != nil {
		select {
		case <-r.closed:
			return 0, io.ErrClosedPipe
		default:
		}
	}
	if r.off >= len(r.data) {
		return 0, io.EOF
	}
	if r.delay > 0 {
		time.Sleep(r.delay)
	}
	n := min(r.chunk, len(p), len(r.data)-r.off)
	copy(p, r.data[r.off:r.off+n])
	r.off += n
	return n, nil
}

func TestPrefetchBufferReadPreservesOrder(t *testing.T) {
	want := bytes.Repeat([]byte("abcdefghij"), 1000) // 10KB
	b := newPrefetchBuffer(bytes.NewReader(want))
	defer b.Close()

	got, err := io.ReadAll(b)
	if err != nil {
		t.Fatalf("ReadAll err = %v", err)
	}
	if !bytes.Equal(got, want) {
		t.Fatalf("内容不一致:got %d bytes, want %d", len(got), len(want))
	}
	if !b.Done() {
		t.Fatal("读完后应 Done")
	}
}

func TestPrefetchBufferReadBlocksUntilData(t *testing.T) {
	src := &slowReader{data: []byte("hello world"), chunk: 5, delay: 20 * time.Millisecond}
	b := newPrefetchBuffer(src)
	defer b.Close()

	start := time.Now()
	got, err := io.ReadAll(b)
	if err != nil {
		t.Fatalf("ReadAll err = %v", err)
	}
	if string(got) != "hello world" {
		t.Fatalf("got %q", got)
	}
	if time.Since(start) < 40*time.Millisecond {
		t.Fatal("慢速源应让 Read 阻塞等待")
	}
}

func TestPrefetchBufferBufferedWatermark(t *testing.T) {
	// 源一次吐出全部,消费前水位应为全量。
	src := &slowReader{data: bytes.Repeat([]byte("x"), 8000), chunk: 4000, delay: 5 * time.Millisecond}
	b := newPrefetchBuffer(src)
	defer b.Close()

	// 等 fill 搬完。
	deadline := time.Now().Add(2 * time.Second)
	for !b.Done() && time.Now().Before(deadline) {
		time.Sleep(5 * time.Millisecond)
	}
	if !b.Done() {
		t.Fatal("fill 未完成")
	}
	if got := b.Buffered(); got != 8000 {
		t.Fatalf("消费前水位 = %d, want 8000", got)
	}

	p := make([]byte, 3000)
	if _, err := io.ReadFull(b, p); err != nil {
		t.Fatal(err)
	}
	if got := b.Buffered(); got != 5000 {
		t.Fatalf("消费 3000 后水位 = %d, want 5000", got)
	}

	// Done 后 Bytes 快照应为全量。
	if got := b.Bytes(); len(got) != 8000 {
		t.Fatalf("Bytes 快照 = %d, want 8000", got)
	}
}

func TestPrefetchBufferPeekDoesNotConsume(t *testing.T) {
	b := newPrefetchBuffer(bytes.NewReader([]byte("0123456789")))
	defer b.Close()

	peek, err := b.PeekAtLeast(4, 6)
	if err != nil {
		t.Fatalf("Peek err = %v", err)
	}
	if string(peek) != "012345" {
		t.Fatalf("Peek = %q, want 012345", peek)
	}
	// Peek 不消费:Read 仍从头开始。
	p := make([]byte, 4)
	if _, err := io.ReadFull(b, p); err != nil {
		t.Fatal(err)
	}
	if string(p) != "0123" {
		t.Fatalf("Peek 后 Read = %q, want 0123", p)
	}
}

func TestPrefetchBufferPeekAtLeastWaits(t *testing.T) {
	// 源先吐 2 字节,Peek 要求 4 → 必须等到第三批。
	src := &slowReader{data: []byte("abcdef"), chunk: 2, delay: 15 * time.Millisecond}
	b := newPrefetchBuffer(src)
	defer b.Close()

	peek, err := b.PeekAtLeast(4, 4)
	if err != nil {
		t.Fatalf("Peek err = %v", err)
	}
	if string(peek) != "abcd" {
		t.Fatalf("Peek = %q, want abcd", peek)
	}
}

func TestPrefetchBufferCloseUnblocksRead(t *testing.T) {
	// 永不返回的源:Close 必须让阻塞的 Read 返回。
	src := &blockReader{ch: make(chan struct{})}
	defer close(src.ch) // 测试收尾放 fill goroutine 退出
	b := newPrefetchBuffer(src)

	done := make(chan error, 1)
	go func() {
		p := make([]byte, 4)
		_, err := b.Read(p)
		done <- err
	}()
	time.Sleep(20 * time.Millisecond)
	b.Close()

	select {
	case err := <-done:
		if err != io.ErrClosedPipe {
			t.Fatalf("Close 后 Read err = %v, want ErrClosedPipe", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("Close 未唤醒阻塞的 Read")
	}
}

func TestPrefetchBufferUpstreamError(t *testing.T) {
	b := newPrefetchBuffer(&failReader{err: io.ErrUnexpectedEOF})
	defer b.Close()
	p := make([]byte, 4)
	if _, err := b.Read(p); err != io.ErrUnexpectedEOF {
		t.Fatalf("上游错误应透传,got %v", err)
	}
}

type failReader struct{ err error }

func (r *failReader) Read([]byte) (int, error) { return 0, r.err }

// blockReader 永远阻塞,直到 ch 关闭。
type blockReader struct{ ch chan struct{} }

func (r *blockReader) Read([]byte) (int, error) {
	<-r.ch
	return 0, io.EOF
}
