package migrate

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"regexp"
	"strconv"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/pgx/v5"
	_ "github.com/golang-migrate/migrate/v4/source/file"
)

// RunMigrations 应用尚未执行的 SQL 迁移；dirty 状态必须经人工修复后才能继续。
func RunMigrations(migrationsPath, databaseURL string) error {
	m, err := migrate.New(fmt.Sprintf("file://%s", migrationsPath), databaseURL)
	if err != nil {
		return fmt.Errorf("创建迁移实例失败: %w", err)
	}
	defer m.Close()

	if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return fmt.Errorf("执行迁移失败: %w", err)
	}
	return nil
}

// CheckSchema 只读校验数据库已完成本镜像所需迁移。允许更高版本，以支持兼容性镜像回滚。
// 不创建迁移元数据，也不修复 dirty 状态；缺失或未完成的迁移必须由独立迁移命令处理。
func CheckSchema(ctx context.Context, migrationsPath string, db *sql.DB) error {
	latest, err := getLatestVersionFromFiles(migrationsPath)
	if err != nil {
		return fmt.Errorf("读取镜像迁移版本失败: %w", err)
	}
	var count, version int
	var dirty bool
	if err := db.QueryRowContext(ctx, `SELECT COUNT(*), COALESCE(MAX(version), 0), COALESCE(BOOL_OR(dirty), false) FROM schema_migrations`).Scan(&count, &version, &dirty); err != nil {
		return fmt.Errorf("读取数据库迁移状态失败，请先执行独立迁移: %w", err)
	}
	if count != 1 {
		return fmt.Errorf("数据库迁移记录数量异常: %d，需要一条已完成的迁移记录", count)
	}
	if dirty {
		return fmt.Errorf("数据库迁移未完成: %w", migrate.ErrDirty{Version: version})
	}
	if version < latest {
		return fmt.Errorf("数据库迁移版本 %d 低于镜像要求 %d，请先执行独立迁移", version, latest)
	}
	return nil
}

func getLatestVersionFromFiles(migrationsPath string) (int, error) {
	re := regexp.MustCompile(`^(\d+)_.+\.up\.sql$`)
	files, err := os.ReadDir(migrationsPath)
	if err != nil {
		return 0, fmt.Errorf("读取迁移目录失败: %w", err)
	}
	latest := 0
	for _, file := range files {
		if file.IsDir() {
			continue
		}
		matches := re.FindStringSubmatch(file.Name())
		if matches == nil {
			continue
		}
		version, err := strconv.Atoi(matches[1])
		if err != nil {
			return 0, fmt.Errorf("解析迁移版本 %s 失败: %w", file.Name(), err)
		}
		latest = max(latest, version)
	}
	if latest == 0 {
		return 0, fmt.Errorf("未找到迁移文件")
	}
	return latest, nil
}
