# 落盘路径改为日期分目录 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把上传文件落盘路径从 `uploads/{purpose}/{uuid}.{ext}` 改为 `uploads/{purpose}/YYYY/MM/DD/HHMMSS.{uuid}.{ext}`,URL 对应改为 `/uploads/{purpose}/YYYY/MM/DD/HHMMSS.{uuid}.{ext}`——保留 purpose 一级目录 + 日期分目录(对齐 Rust 参考方案,同时保留用途分类)。

**Architecture:** 改动集中在 `ChunkStorage.BuildPath` 一个方法:端口签名调整(去 mimeType、加 timestamp,保留 purpose),实现改为 purpose + 日期分目录。调用点仅 `CompleteUpload` 一处 + 测试。老文件不受影响(path/url 已入库,无需迁移)。

**Tech Stack:** Go(filepath/time)

---

## 背景

当前 `BuildPath(purpose, mimeType, fileUUID, ext)` 生成 `uploads/{purpose}/[{category}/]{uuid}.{ext}`,material 时按 MIME 再分 image/video 子目录。用户希望改成 `uploads/{purpose}/YYYY/MM/DD/HHMMSS.{uuid}.{ext}`:保留 purpose 一级目录 + 按日期分目录,去掉 material 的 category 子目录(对齐 Rust 方案,日期目录已够细分)。

**关键事实(已核查):**
- `BuildPath` 调用点仅 `service.go:907`(CompleteUpload)一处 + 测试。
- `File` 聚合把完整 `path`/`url` 字符串存库(`entity.go:55-56`),老文件不受影响,**无需数据迁移**。
- `purpose` 仍在 File 聚合里(作元数据 + 路径前缀),`fileTypeFromMime` 将删除(不再按类型分子目录)。

---

## 文件结构

| 文件 | 改动 |
|------|------|
| `api/internal/domain/upload/repository.go:69` | `BuildPath` 端口签名调整 |
| `api/internal/infrastructure/storage/local_storage.go:229-246` | `BuildPath` 实现改 purpose+日期分目录 |
| `api/internal/infrastructure/storage/local_storage.go:248-259` | 删除 `fileTypeFromMime` |
| `api/internal/application/media/service.go:907` | 调用点适配新签名 |
| `api/internal/application/media/upload_security_test.go:48` | fake `BuildPath` 签名同步 |
| `api/internal/infrastructure/storage/local_storage_test.go:50-64` | 测试改新路径断言 |

---

## Task 1: 改 BuildPath 端口签名

**Files:**
- Modify: `api/internal/domain/upload/repository.go:69`

**目标:** 端口签名从 `(purpose, mimeType, fileUUID, ext)` 改为 `(purpose, timestamp, fileUUID, ext)`——去掉 mimeType(不再按类型分目录),加 timestamp(生成日期目录)。

- [ ] **Step 1: 改端口签名**

`api/internal/domain/upload/repository.go` 第 69 行,把:

```go
	BuildPath(purpose, mimeType string, fileUUID, ext string) (path, url string, err error)
```

改为:

```go
	// BuildPath 按 purpose + 时间戳生成日期分目录路径:
	// uploads/{purpose}/YYYY/MM/DD/HHMMSS.<uuid>.<ext>
	BuildPath(purpose string, timestamp time.Time, fileUUID, ext string) (path, url string, err error)
```

- [ ] **Step 2: 追加 import time**

`api/internal/domain/upload/repository.go` 顶部 import 块当前是(已核查):

```go
import (
	"context"

	"blog-api/internal/domain/shared"
)
```

改为:

```go
import (
	"context"
	"time"

	"blog-api/internal/domain/shared"
)
```

- [ ] **Step 3: 编译(预期失败,因实现/调用点/fake 尚未同步)**

Run: `cd api && go build ./... 2>&1 | head -5`
Expected: 报错——`LocalStorage.BuildPath`、`noopStorage.BuildPath`、`service.go:907` 调用点签名不符。

---

## Task 2: 改 BuildPath 实现为 purpose + 日期分目录

**Files:**
- Modify: `api/internal/infrastructure/storage/local_storage.go:229-246`
- Modify: `api/internal/infrastructure/storage/local_storage.go:248-259`(删除 fileTypeFromMime)

**目标:** 实现改为 `uploads/{purpose}/YYYY/MM/DD/HHMMSS.<uuid>.<ext>`,保留 safePath 安全校验。

- [ ] **Step 1: 改 BuildPath 实现**

`api/internal/infrastructure/storage/local_storage.go` 第 229-246 行,把整个 `BuildPath` 方法替换为:

```go
// BuildPath 按 purpose + 时间戳生成日期分目录路径:
// uploads/{purpose}/YYYY/MM/DD/HHMMSS.<uuid>.<ext>
// 返回 (物理路径, 相对URL)。purpose 决定一级目录,timestamp 决定日期目录与文件名时间戳前缀。
func (s *LocalStorage) BuildPath(purpose string, timestamp time.Time, fileUUID, ext string) (string, string, error) {
	dateDir := timestamp.Format("2006/01/02")        // YYYY/MM/DD
	timePrefix := timestamp.Format("150405")         // HHMMSS
	fileName := timePrefix + "." + fileUUID + ext    // HHMMSS.<uuid>.<ext>
	finalDir := filepath.Join(s.uploadDir, purpose, dateDir) // uploads/{purpose}/YYYY/MM/DD
	finalPath := filepath.Join(finalDir, fileName)   // uploads/{purpose}/YYYY/MM/DD/HHMMSS.<uuid>.<ext>
	// 安全校验:最终目录与路径仍在 uploadDir 内(覆盖 purpose 穿越)
	if _, err := s.safePath(finalDir); err != nil {
		return "", "", err
	}
	if _, err := s.safePath(finalPath); err != nil {
		return "", "", err
	}
	url := s.urlPrefix + purpose + "/" + dateDir + "/" + fileName // /uploads/{purpose}/YYYY/MM/DD/HHMMSS.<uuid>.<ext>
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
	case strings.HasPrefix(mimeType, "video/"):
		return "video"
	case strings.HasPrefix(mimeType, "audio/"):
		return "audio"
	default:
		return "file"
	}
}
```

> 该函数仅被旧 `BuildPath` 的 `material` 分支调用,新实现不再按类型分目录。删除后确认无其他引用(已核查:仅 BuildPath 调用它)。

- [ ] **Step 3: 编译(预期失败,仅剩调用点 + fake 未同步)**

Run: `cd api && go build ./... 2>&1 | head -5`
Expected: 报错点缩减为 `service.go:907` 调用 + `upload_security_test.go:48` fake。

---

## Task 3: 同步调用点与 fake

**Files:**
- Modify: `api/internal/application/media/service.go:907`
- Modify: `api/internal/application/media/upload_security_test.go:48`

**目标:** 让 CompleteUpload 用新签名调用 BuildPath;fake 同步签名。

- [ ] **Step 1: 改 CompleteUpload 调用点**

`api/internal/application/media/service.go` 第 907 行,把:

```go
	finalPath, fileURL, err := s.storage.BuildPath(session.Purpose(), finalMime, fileUUID.String(), finalExt)
```

改为:

```go
	finalPath, fileURL, err := s.storage.BuildPath(session.Purpose(), time.Now(), fileUUID.String(), finalExt)
```

- [ ] **Step 2: 同步 fake BuildPath 签名**

`api/internal/application/media/upload_security_test.go` 第 48 行,把:

```go
func (noopStorage) BuildPath(string, string, string, string) (string, string, error)            { return "", "", nil }
```

改为:

```go
func (noopStorage) BuildPath(string, time.Time, string, string) (string, string, error)        { return "", "", nil }
```

> 该文件顶部已 import `"time"`(Task 阶段已有),无需改动 import。

- [ ] **Step 3: 编译 + vet**

Run: `cd api && go build ./... && go vet ./...`
Expected: 无错误。

---

## Task 4: 改 BuildPath 测试断言

**Files:**
- Modify: `api/internal/infrastructure/storage/local_storage_test.go:50-64`

**目标:** 旧测试断言 `material` 子目录,新路径带 purpose + 日期目录,改为断言新格式。

- [ ] **Step 1: 替换两个测试用例**

`api/internal/infrastructure/storage/local_storage_test.go` 第 50-64 行,把 `TestBuildPath_RejectsTraversalPurpose` 和 `TestBuildPath_AllowsValidPurpose` 整体替换为:

```go
func TestBuildPath_PurposeDateDirectoryFormat(t *testing.T) {
	tmp := t.TempDir()
	ls := &LocalStorage{uploadDir: tmp, urlPrefix: "/uploads/"}
	ts := time.Date(2026, 6, 24, 14, 30, 52, 0, time.UTC)
	path, url, err := ls.BuildPath("avatar", ts, "550e8400", ".webp")
	require.NoError(t, err)

	// 物理路径:uploads/avatar/2026/06/24/143052.550e8400.webp
	assert.Contains(t, path, "avatar/2026/06/24")
	assert.Contains(t, path, "143052.550e8400.webp")

	// URL:/uploads/avatar/2026/06/24/143052.550e8400.webp
	assert.Equal(t, "/uploads/avatar/2026/06/24/143052.550e8400.webp", url)
}

func TestBuildPath_RejectsTraversalPurpose(t *testing.T) {
	tmp := t.TempDir()
	ls := &LocalStorage{uploadDir: tmp, urlPrefix: "/uploads/"}
	ts := time.Now()
	_, _, err := ls.BuildPath("..", ts, "uuid", ".png")
	require.Error(t, err)
}

func TestBuildPath_KeepsInUploadDir(t *testing.T) {
	tmp := t.TempDir()
	ls := &LocalStorage{uploadDir: tmp, urlPrefix: "/uploads/"}
	ts := time.Now()
	path, _, err := ls.BuildPath("material", ts, "uuid", ".png")
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
Expected: PASS(三个用例)。

- [ ] **Step 4: 全量测试 + vet**

Run: `cd api && go test ./... && go vet ./...`
Expected: 全部 PASS,无错误。

- [ ] **Step 5: 提交**

```bash
git add api/internal/domain/upload/repository.go api/internal/infrastructure/storage/local_storage.go api/internal/infrastructure/storage/local_storage_test.go api/internal/application/media/service.go api/internal/application/media/upload_security_test.go
git commit -m "refactor(upload): 落盘路径改为 purpose + 日期分目录

uploads/{purpose}/YYYY/MM/DD/HHMMSS.<uuid>.<ext>,保留 purpose 一级目录,
对齐 Rust 方案。去掉 material 的 category 子目录(fileTypeFromMime 删除)。
老文件不受影响(path/url 已入库)。"
```

---

## 验收检查

- [ ] `go build ./... && go vet ./... && go test ./...` 全绿
- [ ] 上传一张图,落盘路径为 `uploads/{purpose}/YYYY/MM/DD/HHMMSS.<uuid>.<ext>`
- [ ] 返回 URL 为 `/uploads/{purpose}/YYYY/MM/DD/HHMMSS.<uuid>.<ext>`
- [ ] purpose 穿越(如 `..`)被 safePath 拦截
- [ ] 老文件(已入库的 path/url)访问不受影响
```
