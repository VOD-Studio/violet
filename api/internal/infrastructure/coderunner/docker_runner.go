package coderunner

import (
	"bytes"
	"context"
	"encoding/binary"
	"fmt"
	"io"
	"strings"
	"sync"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/client"
	"github.com/rs/zerolog/log"

	appcoderunner "blog-api/internal/application/coderunner"
	domaincoderunner "blog-api/internal/domain/coderunner"
)

// 共享 Docker 客户端。socket 缺失时为 nil（功能降级，对应 yggdrasil DOCKER_CLIENT 的 None 兜底）。
//
// 连接失败不 panic：博客本身不依赖 Docker，代码运行器把 nil 转成普通错误
// 向上冒泡，最终在 service 层映射为「系统暂时不可用」。
var (
	sharedDockerClient *client.Client
	onceDockerClient   sync.Once
	// dockerInitAttempted 标记是否曾调用过 InitDockerClient。
	// 区分两种 nil 场景，给准确的错误信息：
	//   - false（从未初始化）→ 功能未启用（CODE_RUNNER_ENABLED=false）
	//   - true（初始化过但失败）→ daemon 连接失败
	dockerInitAttempted bool
)

// InitDockerClient 初始化共享 Docker 客户端。在应用启动时调用一次（T5 container）。
// socketPath 为 unix socket 路径（兼容 docker 与 podman）。
func InitDockerClient(socketPath string) {
	onceDockerClient.Do(func() {
		dockerInitAttempted = true
		host := "unix://" + strings.TrimPrefix(socketPath, "unix://")
		cli, err := client.NewClientWithOpts(client.WithHost(host), client.WithAPIVersionNegotiation())
		if err != nil {
			log.Error().Err(err).Str("socket", socketPath).Msg("无法创建 Docker 客户端，代码运行功能不可用")
			return
		}
		// 探活：确认 daemon 可连
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if _, err := cli.Ping(ctx); err != nil {
			log.Error().Err(err).Str("socket", socketPath).Msg("Docker daemon 不可连接，代码运行功能不可用")
			_ = cli.Close()
			return
		}
		sharedDockerClient = cli
	})
}

// getDocker 取共享客户端；不可用时返回明确错误（对应 yggdrasil get_docker）。
//
// 区分两种失败，给出可操作的错误信息：
//   - 从未初始化（InitDockerClient 未调）→ 功能未启用
//   - 初始化过但 daemon 连不上 → 连接失败（含 socket 路径供排查）
func getDocker() (*client.Client, error) {
	if sharedDockerClient != nil {
		return sharedDockerClient, nil
	}
	if !dockerInitAttempted {
		return nil, fmt.Errorf("代码运行器未启用（设置 CODE_RUNNER_ENABLED=true 开启）")
	}
	return nil, fmt.Errorf("docker daemon 不可连接（确认 docker/podman 已运行且 socket 路径正确）")
}

// SharedDockerClient 暴露初始化后的共享客户端（供 container 注入 runner）。
// 未初始化（InitDockerClient 未调或 socket 缺失）时返回 nil，runner 会降级。
func SharedDockerClient() *client.Client {
	return sharedDockerClient
}

// BuildHostConfig 构造容器的隔离 HostConfig。
//
// 照搬 yggdrasil docker.rs::build_host_config，关键约束：
//   - cap_drop ALL + no-new-privileges
//   - readonly_rootfs
//   - tmpfs：/code（mode=1777 sticky，容器内 1000:1000 可写）、/tmp（mode=1777,exec 编译型语言需执行产物）、/run
//     注意：tmpfs 用 mode=1777 而非 docker 专有的 uid=1000 扩展选项（podman 报 unknown mount option）
//   - memory=memorySwap（禁 swap）
//   - pids_limit=64
//   - ulimits 仅 nofile=64（不设 nproc，non-root 下按 UID 计数会导致初始 exec EAGAIN）
//   - network_mode：none（默认）或 bridge（allow_network）
//   - AutoRemove=false（需在结束后读日志/退出码）
func BuildHostConfig(limits domaincoderunner.ResourceLimits) container.HostConfig {
	memory := int64(limits.MemoryMB * 1024 * 1024)
	networkMode := "none"
	if limits.AllowNetwork {
		networkMode = "bridge"
	}

	return container.HostConfig{
		Resources: container.Resources{
			// CPU：quota = cores * 100000，period = 100000（标准 cfs 调度）
			CPUPeriod: 100000,
			CPUQuota:  int64(limits.CPUCores * 100000),
			// 内存：等于 swap 即禁 swap
			Memory:     memory,
			MemorySwap: memory,
			// 进程数上限：128。
			// 64 对编译型语言（go/rust）不够——go run 会 fork 大量 compile/asm 子进程，
			// 瞬时进程数超过 64 即被 cgroup 拒绝（fork/exec EAGAIN）。
			// 128 经实测足够 go 完整编译，仍能防 fork 炸弹。
			PidsLimit: ptrInt64(128),
			// ulimits：仅 nofile（fd 数上限）。不设 nproc——RLIMIT_NPROC 在 setrlimit 时按 UID
			// 计数，配合 non-root 用户会让容器初始 exec /bin/sh 直接 EAGAIN。pids_limit 已在
			// cgroup 层兜底，nproc 是冗余且有害的双重约束。
			Ulimits: []*container.Ulimit{
				{Name: "nofile", Hard: 64, Soft: 64},
			},
		},
		// 网络
		NetworkMode: container.NetworkMode(networkMode),
		// 只读根文件系统
		ReadonlyRootfs: true,
		// tmpfs：mode=1777 让容器内 1000:1000 用户可写；/tmp 必须 exec（编译型语言执行产物）
		Tmpfs: map[string]string{
			"/code": "size=16m,mode=1777",
			"/tmp":  "size=64m,mode=1777,exec",
			"/run":  "size=16m,mode=1777",
		},
		// 权限收敛：丢弃全部 Linux capabilities
		CapDrop:     []string{"ALL"},
		SecurityOpt: []string{"no-new-privileges"},
		// 不自动移除：需在容器结束后读日志/退出码
		AutoRemove: false,
	}
}

// DockerRunner SandboxRunner 的 Docker 实现。
type DockerRunner struct {
	cli *client.Client
}

// NewDockerRunner 构造执行器。cli 为 nil 时方法调用返回 daemon 不可用错误。
func NewDockerRunner(cli *client.Client) *DockerRunner {
	return &DockerRunner{cli: cli}
}

// Available 探测 Docker daemon 是否可连。
//
// cli 非 nil 时直接可用；为 nil 时查共享 client（区分「未启用」与「连接失败」）。
func (r *DockerRunner) Available() error {
	if r.cli != nil {
		return nil
	}
	_, err := getDocker()
	return err
}

// Run 起隔离容器执行，阻塞至完成，返回一次性结果（轮询路径）。
func (r *DockerRunner) Run(ctx context.Context, image, runCmd, source, ext string, limits domaincoderunner.ResourceLimits) (appcoderunner.RunOutcome, error) {
	cli := r.cli
	if cli == nil {
		c, err := getDocker()
		if err != nil {
			return appcoderunner.RunOutcome{}, err
		}
		cli = c
	}
	return r.runContainer(ctx, cli, image, runCmd, source, ext, limits, nil)
}

// RunStream 起隔离容器执行，边输出边调 emit 推 chunk（流式路径）。
//
// emit 在 stdout/stderr chunk 到达时调用；方法返回后由 service 层推 done chunk。
func (r *DockerRunner) RunStream(ctx context.Context, image, runCmd, source, ext string, limits domaincoderunner.ResourceLimits, emit func(appcoderunner.OutputChunk)) (appcoderunner.RunOutcome, error) {
	cli := r.cli
	if cli == nil {
		c, err := getDocker()
		if err != nil {
			return appcoderunner.RunOutcome{}, err
		}
		cli = c
	}
	return r.runContainer(ctx, cli, image, runCmd, source, ext, limits, emit)
}

// runContainer Run/RunStream 共享的容器执行核心。
//
// emit 非 nil 时为流式模式（stdout/stderr 实时分块回调），否则攒到结束。
// 流程（照搬 yggdrasil run_in_container）：
//  1. sh -c "cat > /code/main.<ext> && exec {runCmd}" 接收 stdin 写文件再执行
//  2. attach stdin/stdout/stderr → start → 写源码到 stdin → 后台读输出（带 emit）
//  3. wait（带 timeout）→ 读尽剩余输出 → inspect 查 OOM/exitCode → 清理容器
func (r *DockerRunner) runContainer(
	ctx context.Context,
	cli *client.Client,
	image, runCmd, source, ext string,
	limits domaincoderunner.ResourceLimits,
	emit func(appcoderunner.OutputChunk),
) (appcoderunner.RunOutcome, error) {
	hc := BuildHostConfig(limits)
	// 源码注入：cat 接收 stdin 写文件，再 exec 真正的运行命令
	setupCmd := fmt.Sprintf("cat > /code/main.%s && exec %s", ext, runCmd)

	cc := &container.Config{
		Image:        image,
		Cmd:          []string{"sh", "-c", setupCmd},
		AttachStdin:  true,
		AttachStdout: true,
		AttachStderr: true,
		OpenStdin:    true,
		StdinOnce:    true,
		User:         "1000:1000", // non-root
		WorkingDir:   "/code",
		Tty:          false, // 非 TTY：输出是 multiplexed 格式（8 字节头 + payload）
	}

	createResp, err := cli.ContainerCreate(ctx, cc, &hc, nil, nil, "")
	if err != nil {
		return appcoderunner.RunOutcome{}, fmt.Errorf("创建容器失败: %w", err)
	}
	containerID := createResp.ID

	// 清理保证（对应 ygggrasil ContainerGuard::drop）：重试 + 退避 + 兜底日志
	defer cleanupContainer(context.Background(), cli, containerID)

	// attach stdin/stdout/stderr
	hijacked, err := cli.ContainerAttach(ctx, containerID, container.AttachOptions{
		Stream: true,
		Stdin:  true,
		Stdout: true,
		Stderr: true,
	})
	if err != nil {
		return appcoderunner.RunOutcome{}, fmt.Errorf("attach 容器失败: %w", err)
	}
	defer hijacked.Close()

	// 启动容器
	if err := cli.ContainerStart(ctx, containerID, container.StartOptions{}); err != nil {
		return appcoderunner.RunOutcome{}, fmt.Errorf("启动容器失败: %w", err)
	}

	// 写源码到 stdin（goroutine，带 5s 超时，对应 yggdrasil write_fut）
	go func() {
		_, _ = hijacked.Conn.Write([]byte(source))
		_ = hijacked.CloseWrite()
	}()

	// 后台读输出：边读边累积 + emit（流式模式实时推）
	var stdoutBuf, stderrBuf bytes.Buffer
	readDone := make(chan struct{})
	go func() {
		defer close(readDone)
		demuxRead(hijacked.Reader, &stdoutBuf, &stderrBuf, limits.OutputBytes, emit)
	}()

	// 带超时的 wait
	waitCtx, waitCancel := context.WithTimeout(ctx, time.Duration(limits.TimeoutSecs)*time.Second)
	defer waitCancel()

	timedOut := false
	waitCh, errCh := cli.ContainerWait(waitCtx, containerID, container.WaitConditionNotRunning)
	select {
	case <-waitCh:
	case <-waitCtx.Done():
		timedOut = true
		_ = cli.ContainerKill(context.Background(), containerID, "KILL")
	case <-errCh:
		// wait 错误，继续读已缓冲的输出
	}

	// 读尽剩余输出（容器结束后 reader 仍有缓冲数据，demuxRead 会自然 EOF 退出）
	select {
	case <-readDone:
	case <-time.After(3 * time.Second):
		// 兜底：避免 reader 卡住拖死整个请求
	}

	// 查 OOM 和退出码
	var oomKilled bool
	var exitCode *int
	inspect, inspectErr := cli.ContainerInspect(context.Background(), containerID)
	if inspectErr == nil && inspect.State != nil {
		oomKilled = inspect.State.OOMKilled
		code := inspect.State.ExitCode
		exitCode = &code
	}

	return appcoderunner.RunOutcome{
		ExitCode:  exitCode,
		Stdout:    stdoutBuf.String(),
		Stderr:    stderrBuf.String(),
		OOMKilled: oomKilled,
		TimedOut:  timedOut,
	}, nil
}

// demuxRead 解复用 Docker attach 的 multiplexed 输出流（Tty=false 格式）。
//
// 格式：每个 frame = [8 字节头][payload]，头部：
//   - byte[0]: stream type（1=stdout, 2=stderr）
//   - byte[4:8]: payload size（big endian uint32）
//
// 边读边累积到 buffer，并在 emit 非 nil 时实时回调推 chunk。
// outputBytes 是 stdout+stderr 合计上限，达到后停止累积（对应 yggdrasil 的裁剪逻辑）。
// 读到 EOF 或 reader 关闭时返回。
func demuxRead(reader io.Reader, stdoutBuf, stderrBuf *bytes.Buffer, outputBytes uint64, emit func(appcoderunner.OutputChunk)) {
	header := make([]byte, 8)
	for {
		// 读 8 字节头
		if _, err := io.ReadFull(reader, header); err != nil {
			return // EOF 或连接关闭
		}
		streamType := header[0]
		payloadSize := binary.BigEndian.Uint32(header[4:8])
		if payloadSize == 0 {
			continue
		}

		// 读 payload
		payload := make([]byte, payloadSize)
		if _, err := io.ReadFull(reader, payload); err != nil {
			return
		}

		// 裁剪到 outputBytes 合计上限
		total := uint64(stdoutBuf.Len() + stderrBuf.Len())
		if total >= outputBytes {
			continue
		}
		remaining := outputBytes - total
		if uint64(len(payload)) > remaining {
			payload = payload[:remaining]
		}

		// 分流累积 + emit
		switch streamType {
		case 1: // stdout
			stdoutBuf.Write(payload)
			if emit != nil {
				emit(appcoderunner.OutputChunk{Type: "stdout", Data: string(payload)})
			}
		case 2: // stderr
			stderrBuf.Write(payload)
			if emit != nil {
				emit(appcoderunner.OutputChunk{Type: "stderr", Data: string(payload)})
			}
		}
	}
}

// cleanupContainer 清理容器（对应 yggdrasil ContainerGuard::drop）。
//
// 重试 3 次 + 指数退避，仍失败记 error 日志（带 containerID 便于手动清理）。
// fire-and-forget：调用方已返回，错误无法回传。
func cleanupContainer(ctx context.Context, cli *client.Client, containerID string) {
	maxAttempts := 3
	backoff := 200 * time.Millisecond
	for attempt := 1; attempt <= maxAttempts; attempt++ {
		err := cli.ContainerRemove(ctx, containerID, container.RemoveOptions{Force: true})
		if err == nil {
			return
		}
		if attempt < maxAttempts {
			time.Sleep(backoff)
			backoff *= 2
			continue
		}
		log.Error().
			Err(err).
			Str("container_id", containerID).
			Int("attempts", maxAttempts).
			Msg("重试后仍无法删除容器，可能泄漏；请手动 docker rm -f")
		return
	}
}

// ptrInt64 辅助：取 int64 指针。
func ptrInt64(v int64) *int64 { return &v }
