# Go 测试规范

> 面向 Go 1.25 项目（2026 年最佳实践）。配套文档：[前端代码规范](./frontend-style-guide.md)。

## 1. 文件放置：与源码同包同目录（铁律）

测试文件用 `_test.go` 后缀，与源文件**同目录同名**：

```
internal/application/comment/
├── service.go          # 被测代码
└── service_test.go     # 测试，紧挨着放
```

**两条包名选择**：

| 包名 | 何时用 |
|---|---|
| `package comment`（内部包） | 默认。可访问未导出符号，覆盖私有逻辑 |
| `package comment_test`（外部包） | 黑盒测试。只测公开 API，防止走后门，可打破循环依赖 |

**禁止**：
- ❌ `tests/` 或 `test/` 顶层目录（这是 Java/Python 习惯，破坏封装、无法访问私有字段、导致循环导入）
- ❌ 把测试移到别的包「方便管理」

## 2. table-driven 测试（事实标准）

[官方 Wiki](https://go.dev/wiki/TableDrivenTests) 背书，Go 的事实标准模式：

```go
func TestMapSong(t *testing.T) {
    t.Parallel()

    tests := []struct {
        name    string
        raw     json.RawMessage
        want    pb.Song
        wantErr error
    }{
        {name: "完整字段", raw: rawFull, want: wantFull},
        {name: "缺字段时零值", raw: rawPartial, want: wantPartial},
        {name: "空 JSON 报错", raw: []byte("null"), wantErr: ErrEmptyResponse},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            t.Parallel()
            got, err := MapSong(tt.raw)
            require.ErrorIs(t, err, tt.wantErr)
            require.Equal(t, tt.want, got)
        })
    }
}
```

**要点**：
- 每个 case 用 `name` 字段而非拼接字符串——失败信息清晰（`TestMapSong/完整字段`），且 `go test -run TestMapSong/完整字段` 可单独跑
- 一张表一个函数，不把无关 case 塞进同一张表
- Go 1.22+ 循环变量每次迭代独立，**1.22 之后无需 `tt := tt` 影子化**（本项目 Go 1.25，可省）

## 3. 子测试 `t.Run`（必备）

每个 case 跑 `t.Run(name, ...)`：

- 失败时输出**精确到 case**：`--- FAIL: TestMapSong/空_JSON_报错`
- 可单独 `go test -run` 某个 case
- 子测试可嵌套（`t.Run("登录", ...)` → 内部再 `t.Run("二维码", ...)`），适合按场景分组

## 4. 文件级 fixture 与共享测试助手

```
internal/application/comment/
├── service.go
├── service_test.go
├── test_helpers_test.go    # 本包测试共享的 setup/factory
└── testdata/
    └── song_detail_response.json   # 测试输入资源
```

**规则**：
- 文件名以 `_test.go` 结尾 → 只在 `go test` 时编译，**不进生产二进制**
- 同包内所有测试共享其中的 `newTestService()` / `seedSong()` 工厂
- **跨包复用**才放到 `internal/testutil`，普通包内 fixture 留在本目录
- `testdata/` 目录被 `go` 工具链**自动忽略**，不参与构建，放 JSON fixture / golden file

## 5. `t.Parallel()`（2026 默认开）

Go 1.25 项目**默认开启并行**：

```go
func TestXxx(t *testing.T) {
    t.Parallel()           // 测试函数体第一行
    // ...
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            t.Parallel()   // 子测试也开
            // ...
        })
    }
}
```

- `go test` 默认按 CPU 核数并行执行
- **前提**：测试互相独立（不依赖共享全局状态、执行顺序）——好测试本该如此
- **别并行**：依赖共享文件、共享 DB 表、固定端口的集成测试

## 6. 接口 mock 与依赖注入

两种互补方式，按场景选，不混：

### testify + 手写 fake（单元测试主力）

接口不大、行为简单，用 [testify](https://github.com/stretchr/testify) 的 `require`/`assert` + 手写 fake struct：

```go
type fakeSessionStore struct{ sess *Session }

func (f *fakeSessionStore) GetAvailable(ctx context.Context, req AuthRequirement) (*Session, error) {
    return f.sess, nil
}
```

### Testcontainers（集成测试事实标准）

[Testcontainers for Go](https://golang.testcontainers.org/) 启真实 Docker 容器跑依赖（Postgres/Redis），比 SQLite 模拟 Postgres 忠实得多。用 build tag 隔离，CI 才跑，本地默认跳过：

```go
//go:build integration

package persistence_test

import "testing"

func TestPostRepo_Create(t *testing.T) {
    // Testcontainers 起 PG 容器
}
```

跑：`go test -tags=integration ./...`

## 7. 标准库小工具

| 工具 | 用途 |
|---|---|
| `t.Setenv("KEY", "val")` | 设环境变量，测试结束自动复原，并行安全。替代手动 `os.Setenv` + defer |
| `t.TempDir()` | 返回测试结束自动清理的临时目录。替代手写 `os.MkdirTemp` + 清理 |
| `go test -cover -coverprofile=cover.out` | 覆盖率，再 `go tool cover -html=cover.out` 看详情 |

## 8. 包内放、包外放哪：一张表

| 情况 | 位置 | 包名 |
|---|---|---|
| 普通单元测试 | 同包同目录 `xxx_test.go` | `package x`（内部） |
| 黑盒测试（防走后门） | 同包同目录 `xxx_test.go` | `package x_test`（外部） |
| 跨包测试助手 | `internal/testutil/` | `package testutil` |
| 测试数据文件 | 同包 `testdata/` | — |
| 集成测试 | 被测包内 + `//go:build integration` | `_test` 后缀 |
| 端到端测试 | 顶层 `e2e/` 目录 | — |

## 9. 命名约定

| 类型 | 前缀 | 示例 |
|---|---|---|
| 单元测试 | `Test` | `TestMapSong` |
| 基准测试 | `Benchmark` | `BenchmarkMapSong` |
| 模糊测试 | `Fuzz` | `FuzzParseLyric` |
| 示例（活文档） | `Example` | `ExampleMapSong` |

- 测试函数命名：`Test<被测对象>_<场景>`，如 `TestMapSong_缺字段时零值`
- `Example` 函数被 `go test` 编译并可选执行，输出匹配 `// Output:` 注释才算通过——当活文档用

## 10. 并发测试：`testing/synctest`（Go 1.25 稳定）

[`testing/synctest`](https://pkg.go.dev/testing/synctest) 在 Go 1.24 实验性引入，**Go 1.25 GA 转正**。测并发代码的利器——cookie 池选取、重试、熔断这类以前要真实等待或造复杂 mock 的场景，现在能写出**确定性测试**：

```go
import "testing/synctest"

func TestRetry_Backoff(t *testing.T) {
    synctest.Test(t, func(t *testing.T) {
        // 「气泡」内：所有 goroutine 隔离、时间可控
        go func() {
            time.Sleep(5 * time.Second) // synctest 瞬时推进
            // ...
        }()
        synctest.Wait() // 等所有 goroutine 进入 idle
        // 断言重试发生了 N 次，无需真实等待
    })
}
```

**核心 API**：
- `synctest.Test(t, fn)`：把 `fn` 包进「气泡」，内部起的 goroutine 全在气泡里
- `synctest.Wait()`：等所有 goroutine 到 idle 点
- `time.Sleep` / `time.After` 被 fake clock **瞬时推进**——5 秒退避瞬间完成

**消灭 flaky 测试**：不再需要 `time.Sleep(100ms)` 等真实时间、不再有 race condition。mimo-music 的 `engine/retry.go`、`engine/breaker.go`、`session/` 并发选取都该用它。

---

## 一句话总结

**文件同目录 `_test.go` + table-driven + `t.Run` 子测试 + 默认 `t.Parallel` + testify 手写 fake（单元）/ Testcontainers（集成）+ Go 1.25 项目用 `testing/synctest` 测并发。**

## 更新日志

- 2026-07-15: 初始版本
