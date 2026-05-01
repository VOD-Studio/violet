package migrate

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strconv"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/pgx/v5"
	_ "github.com/golang-migrate/migrate/v4/source/file"
)

// RunMigrations 执行数据库迁移
// migrationsPath: migrations 文件目录路径，如 "migrations"
// databaseURL: 数据库连接字符串，如 "pgx5://user:pass@localhost:5432/db?sslmode=disable"
// db: 数据库连接，用于执行额外的修复 SQL
func RunMigrations(migrationsPath, databaseURL string, db *sql.DB) error {
	m, err := migrate.New(
		fmt.Sprintf("file://%s", migrationsPath),
		databaseURL,
	)
	if err != nil {
		return fmt.Errorf("创建迁移实例失败: %w", err)
	}
	defer m.Close()

	// 获取迁移文件的最新版本号
	latestVersion, err := getLatestVersionFromFiles(migrationsPath)
	if err != nil {
		return fmt.Errorf("获取最新版本失败: %w", err)
	}

	// 检查当前版本和 dirty 状态
	version, dirty, err := m.Version()
	if err != nil && err != migrate.ErrNilVersion {
		return fmt.Errorf("获取迁移版本失败: %w", err)
	}

	// 如果 dirty 状态异常，先确保缺失字段存在，再强制跳到最新版本
	if dirty {
		fmt.Printf("检测到 dirty 状态，当前版本 %d，先检查缺失字段...\n", version)
		// 执行必要的修复 SQL（确保缺失字段被添加）
		if err := ensureLatestSchema(db); err != nil {
			fmt.Printf("警告: 执行修复 SQL 失败: %v\n", err)
		}
		fmt.Printf("强制跳到最新版本 %d...\n", latestVersion)
		if err := m.Force(latestVersion); err != nil {
			return fmt.Errorf("强制设置版本失败: %w", err)
		}
		fmt.Printf("已将版本强制设置为 %d\n", latestVersion)
		return nil
	}

	// 正常执行迁移
	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		return fmt.Errorf("执行迁移失败: %w", err)
	}

	// 获取最终版本
	version, dirty, err = m.Version()
	if err != nil {
		return fmt.Errorf("获取迁移版本失败: %w", err)
	}

	if dirty {
		return fmt.Errorf("数据库迁移状态异常，需要手动修复")
	}

	fmt.Printf("数据库迁移完成，当前版本: %d\n", version)
	return nil
}

// ensureLatestSchema 确保数据库表结构完整，添加缺失的字段
func ensureLatestSchema(db *sql.DB) error {
	// 检查并添加 seo_keywords 字段（版本 9）
	var hasColumn bool
	row := db.QueryRow(`
		SELECT EXISTS (
			SELECT 1 FROM information_schema.columns
			WHERE table_name = 'posts' AND column_name = 'seo_keywords'
		)
	`)
	if err := row.Scan(&hasColumn); err != nil {
		return fmt.Errorf("检查 seo_keywords 字段失败: %w", err)
	}

	if !hasColumn {
		fmt.Printf("添加缺失的 seo_keywords 字段...\n")
		_, err := db.Exec(`ALTER TABLE posts ADD COLUMN seo_keywords VARCHAR(255)`)
		if err != nil {
			return fmt.Errorf("添加 seo_keywords 字段失败: %w", err)
		}
		fmt.Printf("已添加 seo_keywords 字段\n")
	}

	return nil
}

// getLatestVersionFromFiles 从迁移文件目录获取最新版本号
func getLatestVersionFromFiles(migrationsPath string) (int, error) {
	// 匹配迁移文件名格式：001_xxx.up.sql, 002_xxx.up.sql 等
	re := regexp.MustCompile(`^(\d+)_.*\.up\.sql$`)
	maxVersion := 0

	files, err := os.ReadDir(migrationsPath)
	if err != nil {
		return 0, fmt.Errorf("读取迁移目录失败: %w", err)
	}

	for _, file := range files {
		if file.IsDir() {
			continue
		}
		name := file.Name()
		matches := re.FindStringSubmatch(name)
		if len(matches) > 1 {
			v, err := strconv.Atoi(matches[1])
			if err != nil {
				continue
			}
			if v > maxVersion {
				maxVersion = v
			}
		}
	}

	// 同时检查子目录（如 api/migrations）
	subDirs, _ := os.ReadDir(migrationsPath)
	for _, subDir := range subDirs {
		if !subDir.IsDir() {
			continue
		}
		subFiles, err := os.ReadDir(filepath.Join(migrationsPath, subDir.Name()))
		if err != nil {
			continue
		}
		for _, file := range subFiles {
			name := file.Name()
			matches := re.FindStringSubmatch(name)
			if len(matches) > 1 {
				v, err := strconv.Atoi(matches[1])
				if err != nil {
					continue
				}
				if v > maxVersion {
					maxVersion = v
				}
			}
		}
	}

	if maxVersion == 0 {
		return 0, fmt.Errorf("未找到迁移文件")
	}

	return maxVersion, nil
}