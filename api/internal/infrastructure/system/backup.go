package system

import (
	"archive/tar"
	"bufio"
	"compress/gzip"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"blog-api/config"
	appsystem "blog-api/internal/application/system"
	domainshared "blog-api/internal/domain/shared"
	"github.com/google/uuid"
)

const (
	backupSignaturePrefix = "-- VIOLET BACKUP v1 hmac="
	backupSignatureLength = 64
	backupManifestVersion = 1
)

type backupManifest struct {
	Version         int       `json:"version"`
	Filename        string    `json:"filename"`
	Origin          string    `json:"origin"`
	CreatedAt       time.Time `json:"created_at"`
	Size            int64     `json:"size"`
	UploadsFilename string    `json:"uploads_filename,omitempty"`
	UploadsSize     int64     `json:"uploads_size,omitempty"`
	DatabaseTool    string    `json:"database_tool"`
}

// BackupManager 管理本地备份目录与 PostgreSQL 客户端工具。
type BackupManager struct {
	database   config.DatabaseConfig
	dir        string
	uploadDir  string
	signingKey []byte
}

// NewBackupManager 构造备份管理器并验证备份目录不位于公开上传目录中。
func NewBackupManager(database config.DatabaseConfig, dir, uploadDir string, signingKey []byte) (*BackupManager, error) {
	backupAbs, err := filepath.Abs(filepath.Clean(dir))
	if err != nil {
		return nil, err
	}
	uploadAbs, err := filepath.Abs(filepath.Clean(uploadDir))
	if err != nil {
		return nil, err
	}
	if pathInside(uploadAbs, backupAbs) {
		return nil, fmt.Errorf("备份目录不能位于公开上传目录内")
	}
	if err := os.MkdirAll(backupAbs, 0o700); err != nil {
		return nil, err
	}
	return &BackupManager{
		database: database, dir: backupAbs, uploadDir: uploadAbs, signingKey: signingKey,
	}, nil
}

// List 返回所有已完成（存在 manifest）的备份。
func (m *BackupManager) List(ctx context.Context) ([]appsystem.BackupInfo, error) {
	entries, err := os.ReadDir(m.dir)
	if err != nil {
		return nil, err
	}
	items := make([]appsystem.BackupInfo, 0)
	for _, entry := range entries {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".sql.json") {
			continue
		}
		manifest, readErr := m.readManifestByPath(filepath.Join(m.dir, entry.Name()))
		if readErr != nil {
			continue
		}
		if _, statErr := os.Stat(m.path(manifest.Filename)); statErr != nil {
			continue
		}
		items = append(items, manifest.info())
	}
	sort.Slice(items, func(i, j int) bool { return items[i].CreatedAt.After(items[j].CreatedAt) })
	return items, nil
}

// Create 运行 pg_dump，并可选打包上传目录。
func (m *BackupManager) Create(
	ctx context.Context,
	origin string,
	includeUploads bool,
	progress appsystem.ProgressReporter,
) (_ *appsystem.BackupInfo, resultErr error) {
	if origin != appsystem.BackupOriginManual && origin != appsystem.BackupOriginAuto {
		return nil, domainshared.BadRequest("无效的备份来源")
	}
	if progress != nil {
		progress("正在检查 PostgreSQL 备份工具", 5)
	}
	tool, err := commandVersion(ctx, "pg_dump")
	if err != nil {
		return nil, domainshared.Internal("pg_dump 不可用", err)
	}

	filename := fmt.Sprintf("%s_%s_%s.sql", origin, time.Now().UTC().Format("20060102_150405"), uuid.NewString()[:8])
	finalPath := m.path(filename)
	temp, err := os.CreateTemp(m.dir, ".backup-*.tmp")
	if err != nil {
		return nil, err
	}
	tempPath := temp.Name()
	defer func() {
		_ = temp.Close()
		if resultErr != nil {
			_ = os.Remove(tempPath)
			_ = os.Remove(finalPath)
		}
	}()

	placeholder := backupSignaturePrefix + strings.Repeat("0", backupSignatureLength) + "\n"
	if _, err := io.WriteString(temp, placeholder); err != nil {
		return nil, err
	}
	mac := hmac.New(sha256.New, m.signingKey)
	if progress != nil {
		progress("正在导出 PostgreSQL 数据库", 20)
	}
	stderr := &limitedBuffer{limit: 64 << 10}
	cmd := exec.CommandContext(ctx, "pg_dump", m.pgArgs("pg_dump")...)
	cmd.Env = m.pgEnv()
	cmd.Stdout = io.MultiWriter(temp, mac)
	cmd.Stderr = stderr
	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("pg_dump 执行失败: %w: %s", err, stderr.String())
	}
	if _, err := temp.Seek(int64(len(backupSignaturePrefix)), io.SeekStart); err != nil {
		return nil, err
	}
	if _, err := io.WriteString(temp, hex.EncodeToString(mac.Sum(nil))); err != nil {
		return nil, err
	}
	if err := temp.Sync(); err != nil {
		return nil, err
	}
	if err := temp.Close(); err != nil {
		return nil, err
	}
	if err := os.Rename(tempPath, finalPath); err != nil {
		return nil, err
	}
	stat, err := os.Stat(finalPath)
	if err != nil {
		return nil, err
	}

	manifest := backupManifest{
		Version: backupManifestVersion, Filename: filename, Origin: origin,
		CreatedAt: time.Now().UTC(), Size: stat.Size(), DatabaseTool: tool,
	}
	if includeUploads {
		if progress != nil {
			progress("正在打包上传文件", 80)
		}
		uploadsName := strings.TrimSuffix(filename, ".sql") + "_uploads.tar.gz"
		uploadsPath := m.path(uploadsName)
		if err := createUploadsArchive(ctx, m.uploadDir, uploadsPath); err != nil {
			return nil, fmt.Errorf("打包上传文件失败: %w", err)
		}
		uploadsStat, err := os.Stat(uploadsPath)
		if err != nil {
			return nil, err
		}
		manifest.UploadsFilename = uploadsName
		manifest.UploadsSize = uploadsStat.Size()
		defer func() {
			if resultErr != nil {
				_ = os.Remove(uploadsPath)
			}
		}()
	}
	if progress != nil {
		progress("正在保存备份清单", 95)
	}
	if err := m.writeManifest(manifest); err != nil {
		return nil, err
	}
	info := manifest.info()
	return &info, nil
}

// Import 流式导入并校验当前实例签名的 SQL 备份。
func (m *BackupManager) Import(ctx context.Context, filename string, src io.Reader, maxBytes int64) (_ *appsystem.BackupInfo, resultErr error) {
	if !safeBackupFilename(filename) {
		return nil, domainshared.BadRequest("备份文件名无效")
	}
	generated := fmt.Sprintf("import_%s_%s.sql", time.Now().UTC().Format("20060102_150405"), uuid.NewString()[:8])
	temp, err := os.CreateTemp(m.dir, ".import-*.tmp")
	if err != nil {
		return nil, err
	}
	tempPath := temp.Name()
	defer func() {
		_ = temp.Close()
		if resultErr != nil {
			_ = os.Remove(tempPath)
		}
	}()

	written, err := io.Copy(temp, io.LimitReader(src, maxBytes+1))
	if err != nil {
		return nil, err
	}
	if written > maxBytes {
		return nil, domainshared.BadRequest("备份文件超过 512MB 上限")
	}
	if err := temp.Sync(); err != nil {
		return nil, err
	}
	if err := temp.Close(); err != nil {
		return nil, err
	}
	if err := m.verifyPath(tempPath); err != nil {
		return nil, err
	}
	finalPath := m.path(generated)
	if err := os.Rename(tempPath, finalPath); err != nil {
		return nil, err
	}
	defer func() {
		if resultErr != nil {
			_ = os.Remove(finalPath)
		}
	}()
	stat, err := os.Stat(finalPath)
	if err != nil {
		return nil, err
	}
	tool, _ := commandVersion(ctx, "psql")
	manifest := backupManifest{
		Version: backupManifestVersion, Filename: generated, Origin: appsystem.BackupOriginImport,
		CreatedAt: time.Now().UTC(), Size: stat.Size(), DatabaseTool: tool,
	}
	if err := m.writeManifest(manifest); err != nil {
		return nil, err
	}
	info := manifest.info()
	return &info, nil
}

// Restore 校验签名后通过 psql 单事务恢复数据库。
func (m *BackupManager) Restore(ctx context.Context, filename string, progress appsystem.ProgressReporter) error {
	manifest, err := m.readManifest(filename)
	if err != nil {
		return err
	}
	path := m.path(manifest.Filename)
	if progress != nil {
		progress("正在验证备份签名", 10)
	}
	if err := m.verifyPath(path); err != nil {
		return err
	}
	if _, err := commandVersion(ctx, "psql"); err != nil {
		return domainshared.Internal("psql 不可用", err)
	}
	if progress != nil {
		progress("正在单事务恢复数据库", 30)
	}
	stderr := &limitedBuffer{limit: 128 << 10}
	args := append(m.pgArgs("psql"), "--single-transaction", "--set", "ON_ERROR_STOP=1", "--file", path)
	cmd := exec.CommandContext(ctx, "psql", args...)
	cmd.Env = m.pgEnv()
	cmd.Stdout = io.Discard
	cmd.Stderr = stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("psql 恢复失败: %w: %s", err, stderr.String())
	}
	if progress != nil {
		progress("数据库恢复完成", 95)
	}
	return nil
}

// Delete 删除备份、配对上传归档和 manifest。
func (m *BackupManager) Delete(ctx context.Context, filename string) error {
	manifest, err := m.readManifest(filename)
	if err != nil {
		return err
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	for _, name := range []string{manifest.Filename, manifest.UploadsFilename, manifestFilename(manifest.Filename)} {
		if name == "" {
			continue
		}
		if err := os.Remove(m.path(name)); err != nil && !errors.Is(err, os.ErrNotExist) {
			return err
		}
	}
	return nil
}

// Open 打开数据库 SQL 或配对上传归档。
func (m *BackupManager) Open(ctx context.Context, filename, part string) (io.ReadCloser, appsystem.BackupDownload, error) {
	manifest, err := m.readManifest(filename)
	if err != nil {
		return nil, appsystem.BackupDownload{}, err
	}
	if err := ctx.Err(); err != nil {
		return nil, appsystem.BackupDownload{}, err
	}
	name := manifest.Filename
	contentType := "application/sql; charset=utf-8"
	if part == "uploads" {
		if manifest.UploadsFilename == "" {
			return nil, appsystem.BackupDownload{}, domainshared.NotFound("上传归档")
		}
		name = manifest.UploadsFilename
		contentType = "application/gzip"
	} else if part != "" && part != "database" {
		return nil, appsystem.BackupDownload{}, domainshared.BadRequest("下载部分必须是 database 或 uploads")
	}
	file, err := os.Open(m.path(name))
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, appsystem.BackupDownload{}, domainshared.NotFound("备份文件")
		}
		return nil, appsystem.BackupDownload{}, err
	}
	stat, err := file.Stat()
	if err != nil {
		_ = file.Close()
		return nil, appsystem.BackupDownload{}, err
	}
	return file, appsystem.BackupDownload{Filename: name, ContentType: contentType, Size: stat.Size()}, nil
}

// RotateAuto 只保留最新的指定份数自动备份。
func (m *BackupManager) RotateAuto(ctx context.Context, keep int) error {
	items, err := m.List(ctx)
	if err != nil {
		return err
	}
	automatic := make([]appsystem.BackupInfo, 0)
	for _, item := range items {
		if item.Origin == appsystem.BackupOriginAuto {
			automatic = append(automatic, item)
		}
	}
	for _, item := range automatic[min(keep, len(automatic)):] {
		if err := m.Delete(ctx, item.Filename); err != nil {
			return err
		}
	}
	return nil
}

func (m *BackupManager) verifyPath(path string) error {
	file, err := os.Open(path)
	if err != nil {
		return err
	}
	defer file.Close()
	reader := bufio.NewReader(file)
	header, err := reader.ReadString('\n')
	if err != nil {
		return domainshared.BadRequest("备份签名头无效")
	}
	header = strings.TrimSpace(header)
	if !strings.HasPrefix(header, backupSignaturePrefix) {
		return domainshared.BadRequest("备份不是由 Violet 生成")
	}
	expected, err := hex.DecodeString(strings.TrimPrefix(header, backupSignaturePrefix))
	if err != nil || len(expected) != sha256.Size {
		return domainshared.BadRequest("备份签名格式无效")
	}
	mac := hmac.New(sha256.New, m.signingKey)
	if _, err := io.Copy(mac, reader); err != nil {
		return err
	}
	if !hmac.Equal(expected, mac.Sum(nil)) {
		return domainshared.BadRequest("备份签名校验失败")
	}
	return nil
}

func (m *BackupManager) writeManifest(manifest backupManifest) error {
	data, err := json.Marshal(manifest)
	if err != nil {
		return err
	}
	temp, err := os.CreateTemp(m.dir, ".manifest-*.tmp")
	if err != nil {
		return err
	}
	tempPath := temp.Name()
	defer os.Remove(tempPath)
	if err := temp.Chmod(0o600); err != nil {
		_ = temp.Close()
		return err
	}
	if _, err := temp.Write(data); err != nil {
		_ = temp.Close()
		return err
	}
	if err := temp.Sync(); err != nil {
		_ = temp.Close()
		return err
	}
	if err := temp.Close(); err != nil {
		return err
	}
	return os.Rename(tempPath, m.path(manifestFilename(manifest.Filename)))
}

func (m *BackupManager) readManifest(filename string) (backupManifest, error) {
	if !safeBackupFilename(filename) {
		return backupManifest{}, domainshared.BadRequest("备份文件名无效")
	}
	return m.readManifestByPath(m.path(manifestFilename(filename)))
}

func (m *BackupManager) readManifestByPath(path string) (backupManifest, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return backupManifest{}, domainshared.NotFound("备份")
		}
		return backupManifest{}, err
	}
	var manifest backupManifest
	if err := json.Unmarshal(data, &manifest); err != nil {
		return backupManifest{}, err
	}
	if manifest.Version != backupManifestVersion || !safeBackupFilename(manifest.Filename) {
		return backupManifest{}, domainshared.BadRequest("备份清单无效")
	}
	if manifest.UploadsFilename != "" &&
		(filepath.Base(manifest.UploadsFilename) != manifest.UploadsFilename ||
			!strings.HasSuffix(strings.ToLower(manifest.UploadsFilename), ".tar.gz")) {
		return backupManifest{}, domainshared.BadRequest("上传归档清单无效")
	}
	return manifest, nil
}

func (m *BackupManager) path(name string) string {
	return filepath.Join(m.dir, name)
}

func (m *BackupManager) pgArgs(tool string) []string {
	base := []string{
		"--host", m.database.Host,
		"--port", fmt.Sprint(m.database.Port),
		"--username", m.database.User,
		"--dbname", m.database.Name,
	}
	if tool == "pg_dump" {
		return append(base, "--format=p", "--clean", "--if-exists", "--no-owner", "--no-privileges")
	}
	return base
}

func (m *BackupManager) pgEnv() []string {
	return append(
		os.Environ(),
		"PGPASSWORD="+m.database.Password,
		"PGSSLMODE="+m.database.SSLMode,
	)
}

func (m backupManifest) info() appsystem.BackupInfo {
	return appsystem.BackupInfo{
		Filename: m.Filename, Origin: m.Origin, CreatedAt: m.CreatedAt, Size: m.Size,
		UploadsFilename: m.UploadsFilename, UploadsSize: m.UploadsSize, DatabaseTool: m.DatabaseTool,
	}
}

func manifestFilename(filename string) string {
	return filename + ".json"
}

func safeBackupFilename(name string) bool {
	if filepath.Base(name) != name || !strings.HasSuffix(strings.ToLower(name), ".sql") {
		return false
	}
	for _, ch := range name {
		if ch == '.' || ch == '-' || ch == '_' || ch >= 'a' && ch <= 'z' || ch >= 'A' && ch <= 'Z' || ch >= '0' && ch <= '9' {
			continue
		}
		return false
	}
	return true
}

func pathInside(parent, candidate string) bool {
	rel, err := filepath.Rel(parent, candidate)
	if err != nil {
		return false
	}
	return rel == "." || rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator))
}

func commandVersion(ctx context.Context, command string) (string, error) {
	output, err := exec.CommandContext(ctx, command, "--version").Output()
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(output)), nil
}

func createUploadsArchive(ctx context.Context, root, destination string) (resultErr error) {
	temp := destination + ".tmp-" + uuid.NewString()
	file, err := os.OpenFile(temp, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o600)
	if err != nil {
		return err
	}
	defer func() {
		_ = file.Close()
		if resultErr != nil {
			_ = os.Remove(temp)
		}
	}()
	gzipWriter := gzip.NewWriter(file)
	tarWriter := tar.NewWriter(gzipWriter)

	if _, err := os.Stat(root); errors.Is(err, os.ErrNotExist) {
		if err := tarWriter.Close(); err != nil {
			return err
		}
		if err := gzipWriter.Close(); err != nil {
			return err
		}
		if err := file.Close(); err != nil {
			return err
		}
		return os.Rename(temp, destination)
	} else if err != nil {
		return err
	}

	err = filepath.WalkDir(root, func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if err := ctx.Err(); err != nil {
			return err
		}
		rel, err := filepath.Rel(root, path)
		if err != nil || rel == "." {
			return err
		}
		first := strings.Split(rel, string(filepath.Separator))[0]
		if first == ".cache" || first == "tmp" {
			if entry.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}
		info, err := entry.Info()
		if err != nil {
			return err
		}
		if info.Mode()&os.ModeSymlink != 0 || !info.Mode().IsRegular() && !info.IsDir() {
			return nil
		}
		header, err := tar.FileInfoHeader(info, "")
		if err != nil {
			return err
		}
		header.Name = filepath.ToSlash(rel)
		if err := tarWriter.WriteHeader(header); err != nil {
			return err
		}
		if info.IsDir() {
			return nil
		}
		source, err := os.Open(path)
		if err != nil {
			return err
		}
		_, copyErr := io.Copy(tarWriter, source)
		closeErr := source.Close()
		if copyErr != nil {
			return copyErr
		}
		return closeErr
	})
	if err != nil {
		return err
	}
	if err := tarWriter.Close(); err != nil {
		return err
	}
	if err := gzipWriter.Close(); err != nil {
		return err
	}
	if err := file.Sync(); err != nil {
		return err
	}
	if err := file.Close(); err != nil {
		return err
	}
	return os.Rename(temp, destination)
}

type limitedBuffer struct {
	builder strings.Builder
	limit   int
}

func (b *limitedBuffer) Write(data []byte) (int, error) {
	remaining := b.limit - b.builder.Len()
	if remaining > 0 {
		_, _ = b.builder.Write(data[:min(remaining, len(data))])
	}
	return len(data), nil
}

func (b *limitedBuffer) String() string {
	return strings.TrimSpace(b.builder.String())
}
