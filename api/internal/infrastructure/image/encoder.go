package image

import (
	"bytes"
	"context"
	"fmt"
	"image"
	"image/png"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	domainimage "blog-api/internal/domain/image"
	domainsettings "blog-api/internal/domain/settings"
)

const encoderVersion = "1.6.0"

// Encoder 在上传与动态处理之间共享并发预算。
type Encoder struct {
	mu      sync.Mutex
	active  int
	changed chan struct{}
}

// NewEncoder 创建进程级编码准入器。
func NewEncoder() *Encoder { return &Encoder{changed: make(chan struct{})} }

func imagePolicy(provider domainimage.PolicyProvider) domainsettings.ImagePolicy {
	if provider == nil {
		return domainsettings.DefaultImagePolicy()
	}
	policy, _ := provider.Image()
	return policy
}

// ValidatePolicy 在发布策略前验证真实编码器能力，不修改生效状态。
func ValidatePolicy(policy domainsettings.ImagePolicy) error {
	if policy.WebPMode != "lossless" && policy.WebPMode != "lossy" {
		return fmt.Errorf("未知 WebP 编码模式")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	output, err := exec.CommandContext(ctx, "cwebp", "-version").Output()
	if err != nil {
		return fmt.Errorf("cwebp 编码器不可用: %w", err)
	}
	if err := validateEncoderVersion(output); err != nil {
		return err
	}
	// 准备阶段用固定的小图验证 PNG 输入和真实 WebP 输出，不因配置的小字节预算误报工具缺失。
	probePolicy := policy
	probePolicy.MaxInputBytes = 4096
	probePolicy.MaxOutputBytes = 4096
	encoded, err := encodeWebP(ctx, image.NewNRGBA(image.Rect(0, 0, 1, 1)), probePolicy)
	if err != nil {
		return fmt.Errorf("cwebp 编码能力不可用: %w", err)
	}
	config, format, err := image.DecodeConfig(bytes.NewReader(encoded))
	if err != nil || format != "webp" || config.Width != 1 || config.Height != 1 {
		return fmt.Errorf("cwebp 编码器未生成有效的 WebP 图片")
	}
	if _, _, err := image.Decode(bytes.NewReader(encoded)); err != nil {
		return fmt.Errorf("cwebp 编码结果损坏: %w", err)
	}
	return nil
}

func validateEncoderVersion(output []byte) error {
	// cwebp 在版本行之后还会输出 libsharpyuv 版本；只校验首个非空版本行。
	var version string
	for line := range strings.SplitSeq(string(output), "\n") {
		if value := strings.TrimSpace(line); value != "" {
			version = value
			break
		}
	}
	if version != encoderVersion {
		return fmt.Errorf("cwebp 版本必须为 %s", encoderVersion)
	}
	return nil
}

func (e *Encoder) acquire(ctx context.Context, max int) (func(), error) {
	for {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		e.mu.Lock()
		if e.active < max {
			e.active++
			e.mu.Unlock()
			return func() {
				e.mu.Lock()
				e.active--
				close(e.changed)
				e.changed = make(chan struct{})
				e.mu.Unlock()
			}, nil
		}
		changed := e.changed
		e.mu.Unlock()
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-changed:
		}
	}
}

type boundedBuffer struct {
	bytes.Buffer
	limit int64
}

func (b *boundedBuffer) Write(data []byte) (int, error) {
	if int64(len(data)) > b.limit-int64(b.Len()) {
		return 0, fmt.Errorf("图片输出超过字节限制")
	}
	return b.Buffer.Write(data)
}

// encodeWebP 调用固定版本的独立进程；输出超限立即取消，而不是写满磁盘后才检查。
func encodeWebP(ctx context.Context, img image.Image, policy domainsettings.ImagePolicy) ([]byte, error) {
	dir, err := os.MkdirTemp("", "violet-webp-")
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(dir)
	input := filepath.Join(dir, "input.png")
	file, err := os.OpenFile(input, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o600)
	if err != nil {
		return nil, err
	}
	writer := &limitedFileWriter{file: file, remaining: policy.MaxInputBytes}
	err = png.Encode(writer, img)
	closeErr := file.Close()
	if err != nil {
		return nil, fmt.Errorf("编码器输入生成失败: %w", err)
	}
	if closeErr != nil {
		return nil, closeErr
	}
	args := []string{"-quiet", "-q", strconv.Itoa(policy.WebPQuality), "-m", strconv.Itoa(policy.WebPMethod), "-alpha_q", "100", "-exact"}
	if policy.WebPMode == "lossless" {
		args = append(args, "-lossless")
	}
	args = append(args, input, "-o", "-")
	processCtx, cancel := context.WithCancel(ctx)
	defer cancel()
	cmd := exec.CommandContext(processCtx, "cwebp", args...)
	cmd.WaitDelay = time.Second
	output := &cancelWriter{buffer: boundedBuffer{limit: policy.MaxOutputBytes}, cancel: cancel}
	var stderr boundedBuffer
	stderr.limit = 4096
	cmd.Stdout, cmd.Stderr = output, &stderr
	if err := cmd.Run(); err != nil {
		if output.err != nil {
			return nil, output.err
		}
		if ctx.Err() != nil {
			return nil, fmt.Errorf("图片编码超时或取消: %w", ctx.Err())
		}
		return nil, fmt.Errorf("WebP 编码失败: %w: %s", err, stderr.String())
	}
	if output.buffer.Len() == 0 {
		return nil, fmt.Errorf("WebP 编码器返回空输出")
	}
	return output.buffer.Bytes(), nil
}

type cancelWriter struct {
	buffer boundedBuffer
	cancel context.CancelFunc
	err    error
}

func (w *cancelWriter) Write(data []byte) (int, error) {
	n, err := w.buffer.Write(data)
	if err != nil {
		w.err = err
		w.cancel()
	}
	return n, err
}

type limitedFileWriter struct {
	file      *os.File
	remaining int64
}

func (w *limitedFileWriter) Write(data []byte) (int, error) {
	if int64(len(data)) > w.remaining {
		return 0, fmt.Errorf("编码器输入超过字节限制")
	}
	n, err := w.file.Write(data)
	w.remaining -= int64(n)
	return n, err
}
