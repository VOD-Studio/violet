# 落盘路径改为日期分目录 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把上传文件落盘路径从 `uploads/{purpose}/{uuid}.{ext}` 改为 `uploads/YYYY/MM/DD/HHMMSS.{uuid}.{ext}`,URL 对应改为 `/uploads/YYYY/MM/DD/HHMMSS.{uuid}.{ext}`,去掉 purpose 前缀,纯按日期分目录(对齐 Rust 参考方案)。

**Architecture:** 改动集中在 `ChunkStorage.BuildPath` 一个方法:端口签名简化(去掉 purpose/mimeType 参数,加 timestamp),实现改为日期分目录。调用点仅 `CompleteUpload` 一处 + 测试 fake。老文件不受影响(path/url 已入库,无需迁移)。

**Tech Stack:** Go(filepath/time)

---

## 背景

当前 `BuildPath(purpose, mimeType, fileUUID, ext)` 生成 `uploads/{purpose}/[{category}/]{uuid}.{ext}`,用 purpose 区分用途。用户希望改成 Rust 方案的纯日期分目录:`uploads/YYYY/MM/DD/HHMMSS.{uuid}.{ext}`。

**关键事实(已核查):**
- `BuildPath` 调用点仅 `service.go:907`(CompleteUpload)一处 + 测试。
- `File` 聚合把完整 `path`/`url` 字符串存库(`entity.go:55-56`),老文件不受影响,**无需数据迁移**。
- `purpose` 字段仍保留在 File 聚合里(作元数据,用于查询/分类),只是不再进路径。

---

## 文件结构

| 文件 | 改动 |
|------|------|
| `api/internal/domain/upload/repository.go:69` | `BuildPath` 端口签名简化 |
| `api/internal/infrastructure/storage/local_storage.go:229-246` | `BuildPath` 实现改日期分目录;`fileTypeFromMime` 删除(不再用) |
| `api/internal/application/media/service.go:907` | 调用点适配新签名(传 timestamp) |
| `api/internal/application/media/upload_security_test.go:48` | fake `BuildPath` 签名同步 |
| `api/internal/infrastructure/storage/local_storage_test.go:50-64` | 测试改新路径断言 |

---

## Task 1: 改 BuildPath 端口签名

**Files:**
- Modify: `api/internal/domain/upload/repository.go:69`

**目标:** 端口签名从 `(purpose, mimeType, fileUUID, ext)` 改为 `(timestamp, fileUUID, ext)`,去掉 purpose/mimeType(路径不再按用途/类型分目录)。

- [ ] **Step 1: 改端口签名**

`api/internal/domain/upload/repository.go` 第 69 行,把:

```go
	BuildPath(purpose, mimeType string, fileUUID, ext string) (path, url string, err error)
```

改为:

```go
	// BuildPath 按时间戳生成日期分目录路径:uploads/YYYY/MM/DD/HHMMSS.<uuid>.<ext>
	BuildPath(timestamp time.Time, fileUUID, ext string) (path, url string, err error)
```

- [ ] **Step 2: 确认 import time**

检查 `repository.go` 顶部 import 块是否已 import `time`。若无,追加:

```go
import (
	"time"
	// ... 现有
)
```

- [ ] **Step 3: 编译(预期失败,因实现/调用点/fake 尚未同步)**

Run: `cd api && go build ./... 2>&1 | head -5`
Expected: 报错——`LocalStorage.BuildPath`、`noopStorage.BuildPath`、`service.go:907` 调用点签名不符。

---

## Task 2: 改 BuildPath 实现为日期分目录

**Files:**
- Modify: `api/internal/infrastructure/storage/local_storage.go:229-246`
- Modify: `api/internal/infrastructure/storage/local_storage.go:248-259`(删除 fileTypeFromMime)

**目标:** 实现改为 `uploads/YYYY/MM/DD/HHMMSS.<uuid>.<ext>`,保留 safePath 安全校验。

- [ ] **Step 1: 改 BuildPath 实现**

`api/internal/infrastructure/storage/local_storage.go` 第 229-246 行,把整个 `BuildPath` 方法替换为:

```go
// BuildPath 按时间戳生成日期分目录路径:uploads/YYYY/MM/DD/HHMMSS.<uuid>.<ext>
// 返回 (物理路径, 相对URL)。timestamp 决定日期目录与文件名时间戳前缀。
func (s *LocalStorage) BuildPath(timestamp time.Time, fileUUID, ext string) (string, string, error) {
	dateDir := timestamp.Format("2006/01/02")           // YYYY/MM/DD
	timePrefix := timestamp.Format("150405")            // HHMMSS
	fileName := timePrefix + "." + fileUUID + ext       // HHMMSS.<uuid>.<ext>
	finalDir := filepath.Join(s.uploadDir, dateDir)     // uploads/YYYY/MM/DD
	finalPath := filepath.Join(finalDir, fileName)      // uploads/YYYY/MM/DD/HHMMSS.<uuid>.<ext>
	// 安全校验:最终目录与路径仍在 uploadDir 内
	if _, err := s.safePath(finalDir); err != nil {
		return "", "", err
	}
	if _, err := s.safePath(finalPath); err != nil {
		return "", "", err
	}
	url := s.urlPrefix + dateDir + "/" + fileName       // /uploads/YYYY/MM/DD/HHMMSS.<uuid>.<ext>
	return finalPath, url, nil
}
```

- [ ] **Step 2: 删除 fileTypeFromMime(不再使用)**

删除 `local_storage.go` 第 248-259 行的 `fileTypeFromMime` 函数整体:

```go
// fileTypeFromMime 根据 MIME 推断分类目录
func fileTypeFromMime(mimeType string) string {
	switch {
	case strings.HasPrefix(mimeType, "image/"):
		return "image"
	...
}
```

> 该函数仅被旧 `BuildPath` 的 `material` 分支调用,新实现不再需要。删除后确认无其他引用(本计划已核查:只有 BuildPath 调用它)。

- [ ] **Step 3: 确认 import time**

`local_storage.go` 顶部 import 块应已含 `time`(GenerateThumbnail 等用到)。若无,追加 `"time"`。

- [ ] **Step 4: 编译(预期失败,仅剩调用点 + fake 未同步)**

Run: `cd api && go build ./... 2>&1 | head -5`
Expected: 报错点缩减为 `service.go:907` 调用 + `upload_security_test.go:48` fake。

---

## Task 3: 同步调用点与 fake

**Files:**
- Modify: `api/internal/application/media/service.go:907`
- Modify: `api/internal/application/media/upload_security_test.go:48`

**目标:** 让 CompleteUpload 用新签名调用 BuildPath(传当前时间);fake 同步签名。

- [ ] **Step 1: 改 CompleteUpload 调用点**

`api/internal/application/media/service.go` 第 907 行,把:

```go
	finalPath, fileURL, err := s.storage.BuildPath(session.Purpose(), finalMime, fileUUID.String(), finalExt)
```

改为(用当前上传时间):

```go
	finalPath, fileURL, err := s.storage.BuildPath(time.Now(), fileUUID.String(), finalExt)
```

- [ ] **Step 2: 确认 service.go import time**

`service.go` 顶部 import 块应已含 `time`(CompleteUpload 用到 time)。若无,追加 `"time"`。

- [ ] **Step 3: 同步 fake BuildPath 签名**

`api/internal/application/media/upload_security_test.go` 第 48 行,把:

```go
func (noopStorage) BuildPath(string, string, string, string) (string, string, error)            { return "", "", nil }
```

改为:

```go
func (noopStorage) BuildPath(time.Time, string, string) (string, string, error)                  { return "", "", nil }
```

并在该测试文件顶部 import 块确认含 `"time"`(Task 1/2/3 阶段已 import time,本文件 upload_security_test.go 已 import time,无需改动)。

- [ ] **Step 4: 编译 + vet**

Run: `cd api && go build ./... && go vet ./...`
Expected: 无错误。

---

## Task 4: 改 BuildPath 测试断言

**Files:**
- Modify: `api/internal/infrastructure/storage/local_storage_test.go:50-64`

**目标:** 旧测试断言 `material` 子目录,新路径无 purpose,改为断言日期目录格式。

- [ ] **Step 1: 替换两个测试用例**

`api/internal/infrastructure/storage/local_storage_test.go` 第 50-64 行,把 `TestBuildPath_RejectsTraversalPurpose` 和 `TestBuildPath_AllowsValidPurpose` 整体替换为:

```go
func TestBuildPath_DateDirectoryFormat(t *testing.T) {
	tmp := t.TempDir()
	ls := &LocalStorage{uploadDir: tmp, urlPrefix: "/uploads/"}
	ts := time.Date(2026, 6, 24, 14, 30, 52, 0, time.UTC)
	path, url, err := ls.BuildPath(ts, "550e8400", ".webp")
	require.NoError(t, err)

	// 物理路径:uploads/2026/06/24/143052.550e8400.webp
	assert.Contains(t, path, "2026/06/24")
	assert.Contains(t, path, "143052.550e8400.webp")
	assert.True(t, strings.HasSuffix(path, ".webp"))

	// URL:/uploads/2026/06/24/143052.550e8400.webp
	assert.Equal(t, "/uploads/2026/06/24/143052.550e8400.webp", url)
}

func TestBuildPath_KeepsInUploadDir(t *testing.T) {
	tmp := t.TempDir()
	ls := &LocalStorage{uploadDir: tmp, urlPrefix: "/uploads/"}
	ts := time.Now()
	path, _, err := ls.BuildPath(ts, "uuid", ".png")
	require.NoError(t, err)
	// 路径必须在 uploadDir 之下
	rel, err := filepath.Rel(tmp, path)
	require.NoError(t, err)
	assert.False(t, strings.HasPrefix(rel, ".."), "路径逃逸出 uploadDir")
}
```

- [ ] **Step 2: 确认测试文件 import**

`local_storage_test.go` 顶部 import 块需含 `strings`、`time`、`path/filepath`。若缺,追加。典型现有 import:

```go
import (
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)
```

- [ ] **Step 3: 运行测试**

Run: `cd api && go test ./internal/infrastructure/storage/ -run TestBuildPath -v`
Expected: PASS(两个用例)。

- [ ] **Step 4: 全量测试 + vet**

Run: `cd api && go test ./... && go vet ./...`
Expected: 全部 PASS,无错误。

- [ ] **Step 5: 提交**

```bash
git add api/internal/domain/upload/repository.go api/internal/infrastructure/storage/local_storage.go api/internal/infrastructure/storage/local_storage_test.go api/internal/application/media/service.go api/internal/application/media/upload_security_test.go
git commit -m "refactor(upload): 落盘路径改为日期分目录 uploads/YYYY/MM/DD/HHMMSS.<uuid>.<ext>

BuildPath 去掉 purpose/mimeType 参数,改用时间戳生成日期分目录,
对齐 Rust 方案。老文件不受影响(path/url 已入库)。
删除 fileTypeFromMime(不再需要)。"
```

---

## 验收检查

- [ ] `go build ./... && go vet ./... && go test ./...` 全绿
- [ ] 上传一张图,落盘路径为 `uploads/YYYY/MM/DD/HHMMSS.<uuid>.<ext>`
- [ ] 返回 URL 为 `/uploads/YYYY/MM/DD/HHMMSS.<uuid>.<ext>`
- [ ] 老文件(已入库的 path/url)访问不受影响
- [ ] 路径穿越校验仍生效(safePath 保留)
```
