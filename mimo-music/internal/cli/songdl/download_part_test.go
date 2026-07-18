package songdl

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/VOD-Studio/mimo-music/internal/cli/kit"
)

// newDownloadTestKit 构造 Kit 用于 DownloadToFile 测试:Out/Err 到 buffer。
func newDownloadTestKit() *kit.Kit {
	var out, errb bytes.Buffer
	return &kit.Kit{Out: &out, Err: &errb}
}

// partTestServer 构造一个可控的 HTTP server:
//   - fullBody: 完整响应体
//   - supportRange: true 时尊重 Range 头返 206 + 对应切片;false 时总是 200 全量
func partTestServer(t *testing.T, fullBody []byte, supportRange bool) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Length", fmt.Sprintf("%d", len(fullBody)))
		if supportRange && r.Header.Get("Range") != "" {
			from := parseRangeFrom(t, r.Header.Get("Range"))
			if from >= int64(len(fullBody)) {
				w.WriteHeader(http.StatusRequestedRangeNotSatisfiable)
				return
			}
			w.Header().Set("Content-Range", fmt.Sprintf("bytes %d-%d/%d", from, len(fullBody)-1, len(fullBody)))
			w.Header().Set("Content-Length", fmt.Sprintf("%d", len(fullBody[from:])))
			w.WriteHeader(http.StatusPartialContent)
			_, _ = w.Write(fullBody[from:])
			return
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(fullBody)
	}))
}

// parseRangeFrom 从 "bytes=N-" 提取 N。测试辅助,简化解析。
func parseRangeFrom(t *testing.T, rangeHeader string) int64 {
	t.Helper()
	// "bytes=123-" → 123
	idx := strings.Index(rangeHeader, "=")
	dash := strings.Index(rangeHeader, "-")
	if idx < 0 || dash < 0 {
		t.Fatalf("bad Range header %q", rangeHeader)
	}
	var n int64
	for _, c := range rangeHeader[idx+1 : dash] {
		if c < '0' || c > '9' {
			t.Fatalf("bad Range header %q", rangeHeader)
		}
		n = n*10 + int64(c-'0')
	}
	return n
}

// TestDownloadToFile_FreshDownload 全新下载:无 .part,产出最终文件,.part 被清理。
func TestDownloadToFile_FreshDownload(t *testing.T) {
	t.Parallel()
	body := bytes.Repeat([]byte("abc"), 100) // 300 字节
	srv := partTestServer(t, body, true)
	defer srv.Close()

	dir := t.TempDir()
	finalPath := filepath.Join(dir, "song.mp3")
	k := newDownloadTestKit()

	n, err := DownloadToFile(context.Background(), k, srv.URL, int64(len(body)), finalPath, "song.mp3")
	if err != nil {
		t.Fatalf("DownloadToFile: %v", err)
	}
	if n != int64(len(body)) {
		t.Errorf("written = %d, want %d", n, len(body))
	}
	// 最终文件存在且内容正确。
	got, err := os.ReadFile(finalPath)
	if err != nil {
		t.Fatalf("最终文件应存在: %v", err)
	}
	if !bytes.Equal(got, body) {
		t.Errorf("内容不符: got %d bytes, want %d", len(got), len(body))
	}
	// .part 应被 rename 清理掉。
	if _, err := os.Stat(finalPath+".part"); !os.IsNotExist(err) {
		t.Errorf(".part 应被 rename 清理, 仍存在")
	}
}

// TestDownloadToFile_ResumeFromPart .part 存在 + 服务端支持 Range → 206 续传追加。
func TestDownloadToFile_ResumeFromPart(t *testing.T) {
	t.Parallel()
	full := bytes.Repeat([]byte("XYZ"), 100) // 300 字节
	srv := partTestServer(t, full, true)
	defer srv.Close()

	dir := t.TempDir()
	finalPath := filepath.Join(dir, "song.mp3")
	partPath := finalPath + ".part"
	// 预置 .part 前 100 字节(模拟上次中断)。
	head := full[:100]
	if err := os.WriteFile(partPath, head, 0o644); err != nil {
		t.Fatal(err)
	}

	k := newDownloadTestKit()
	n, err := DownloadToFile(context.Background(), k, srv.URL, int64(len(full)), finalPath, "song.mp3")
	if err != nil {
		t.Fatalf("续传: %v", err)
	}
	// 本次写入 = 全量 - 已有 = 200。
	if n != 200 {
		t.Errorf("本次 written = %d, want 200(续传)", n)
	}
	got, err := os.ReadFile(finalPath)
	if err != nil {
		t.Fatalf("最终文件: %v", err)
	}
	if !bytes.Equal(got, full) {
		t.Errorf("续传后内容应完整: got %d bytes, want %d", len(got), len(full))
	}
}

// TestDownloadToFile_RangeIgnored 服务端忽略 Range(200) → truncate .part 重下。
func TestDownloadToFile_RangeIgnored(t *testing.T) {
	t.Parallel()
	full := bytes.Repeat([]byte("Q"), 300)
	srv := partTestServer(t, full, false) // 不支持 Range,总是 200 全量
	defer srv.Close()

	dir := t.TempDir()
	finalPath := filepath.Join(dir, "song.mp3")
	partPath := finalPath + ".part"
	// 预置 .part 有 50 字节旧数据(应被 truncate)。
	if err := os.WriteFile(partPath, bytes.Repeat([]byte("OLD"), 50), 0o644); err != nil {
		t.Fatal(err)
	}

	k := newDownloadTestKit()
	n, err := DownloadToFile(context.Background(), k, srv.URL, int64(len(full)), finalPath, "song.mp3")
	if err != nil {
		t.Fatalf("Range 忽略重下: %v", err)
	}
	if n != int64(len(full)) {
		t.Errorf("Range 忽略应全量重下, written = %d, want %d", n, len(full))
	}
	got, _ := os.ReadFile(finalPath)
	if !bytes.Equal(got, full) {
		t.Errorf("应从头重下完整内容: got %d bytes", len(got))
	}
}

// TestDownloadToFile_NetworkInterrupt 传输中途断开 → 保留 .part + 返回续传提示。
// 模拟:server 声明 Content-Length=1000 但只写 50 字节就关闭连接 → io.Copy 读到 EOF
// 时发现字节数不足(实际是 unexpected EOF),触发中断路径。
func TestDownloadToFile_NetworkInterrupt(t *testing.T) {
	t.Parallel()
	// server 写头部声明 1000 字节,实际只发 50 字节就关闭 → 客户端 io.Copy 得到
	// io.ErrUnexpectedEOF(读 body 时连接断开)。
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Length", "1000")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(bytes.Repeat([]byte("X"), 50))
		// 强制刷新 + 立即关闭连接(hijack),让客户端读到 unexpected EOF。
		if hj, ok := w.(http.Hijacker); ok {
			conn, buf, _ := hj.Hijack()
			_ = buf.Flush()
			_ = conn.Close()
		}
	}))
	defer srv.Close()

	dir := t.TempDir()
	finalPath := filepath.Join(dir, "song.mp3")
	k := newDownloadTestKit()
	_, err := DownloadToFile(context.Background(), k, srv.URL, 1000, finalPath, "song.mp3")
	if err == nil {
		t.Fatal("中断应返回错误")
	}
	if !strings.Contains(err.Error(), "重跑可续传") {
		t.Errorf("错误应含续传提示, got %q", err.Error())
	}
	// .part 应保留(供重跑续传)。
	if _, err := os.Stat(finalPath + ".part"); err != nil {
		t.Errorf("中断后 .part 应保留, got %v", err)
	}
	// 最终文件不应存在(没 rename)。
	if _, err := os.Stat(finalPath); !os.IsNotExist(err) {
		t.Errorf("中断后最终文件不应存在")
	}
}

// TestFileSize 文件大小辅助函数。
func TestFileSize(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	// 不存在 → 0, nil。
	n, err := fileSize(filepath.Join(dir, "nope"))
	if err != nil || n != 0 {
		t.Errorf("不存在应 (0, nil), got (%d, %v)", n, err)
	}
	// 存在 → 实际大小。
	p := filepath.Join(dir, "f")
	if err := os.WriteFile(p, []byte("hello"), 0o644); err != nil {
		t.Fatal(err)
	}
	n, err = fileSize(p)
	if err != nil || n != 5 {
		t.Errorf("存在应 (5, nil), got (%d, %v)", n, err)
	}
}

// (无兜底;所有 import 均被实际使用。)
