package migrate

import (
	"fmt"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/pgx/v5"
	_ "github.com/golang-migrate/migrate/v4/source/file"
)

// RunMigrations 执行数据库迁移
// migrationsPath: migrations 文件目录路径，如 "migrations"
// databaseURL: 数据库连接字符串，如 "pgx5://user:pass@localhost:5432/db?sslmode=disable"
func RunMigrations(migrationsPath, databaseURL string) error {
	m, err := migrate.New(
		fmt.Sprintf("file://%s", migrationsPath),
		databaseURL,
	)
	if err != nil {
		return fmt.Errorf("创建迁移实例失败: %w", err)
	}
	defer m.Close()

	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		return fmt.Errorf("执行迁移失败: %w", err)
	}

	version, dirty, err := m.Version()
	if err != nil {
		return fmt.Errorf("获取迁移版本失败: %w", err)
	}

	if dirty {
		return fmt.Errorf("数据库迁移状态异常，需要手动修复")
	}

	fmt.Printf("数据库迁移完成，当前版本: %d\n", version)
	return nil
}