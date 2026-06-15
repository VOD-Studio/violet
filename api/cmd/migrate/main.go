// Package main 数据库迁移命令行工具
//
// 基于 golang-migrate 封装，复用 config.DSN() 自动解析连接信息，
// 避免开发者在宿主机额外安装 migrate CLI。
//
// 用法:
//
//	go run ./cmd/migrate up          # 执行所有待迁移
//	go run ./cmd/migrate down        # 回滚最近一次迁移
//	go run ./cmd/migrate down -n 3   # 回滚最近 3 次迁移
//	go run ./cmd/migrate force <v>   # 强制设置版本号（修复 dirty 状态）
//	go run ./cmd/migrate version     # 查看当前版本
//	go run ./cmd/migrate goto <v>    # 迁移到指定版本
//
// 注: 服务启动时会通过 internal/migrate 自动执行迁移，
// 本工具用于手动控制（回滚、修复 dirty、CI 校验等场景）。
package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/pgx/v5"
	_ "github.com/golang-migrate/migrate/v4/source/file"

	"blog-api/config"
)

const migrationsPath = "file://migrations"

func main() {
	// 子命令解析，保留 flag.Args() 作为命令参数
	flag.Usage = printUsage

	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	cmd := os.Args[1]
	args := os.Args[2:]

	cfg := config.Load()
	databaseURL := buildMigrateDSN(cfg.Database.DSN())

	switch cmd {
	case "up":
		runUp(databaseURL)
	case "down":
		runDown(databaseURL, args)
	case "force":
		runForce(databaseURL, args)
	case "version":
		runVersion(databaseURL)
	case "goto":
		runGoto(databaseURL, args)
	case "-h", "--help", "help":
		printUsage()
	default:
		fmt.Fprintf(os.Stderr, "未知命令: %s\n\n", cmd)
		printUsage()
		os.Exit(1)
	}
}

// runUp 执行所有待迁移
func runUp(databaseURL string) {
	m := newMigrate(databaseURL)
	defer m.Close()

	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		log.Fatalf("迁移失败: %v", err)
	}
	v, _, _ := m.Version()
	fmt.Printf("✓ 迁移完成，当前版本: %d\n", v)
}

// runDown 回滚迁移，支持 -n 指定回滚次数
func runDown(databaseURL string, args []string) {
	fs := flag.NewFlagSet("down", flag.ExitOnError)
	steps := fs.Int("n", 1, "回滚次数（默认 1）")
	_ = fs.Parse(args)

	m := newMigrate(databaseURL)
	defer m.Close()

	if err := m.Steps(-*steps); err != nil && err != migrate.ErrNoChange {
		log.Fatalf("回滚失败: %v", err)
	}
	v, _, _ := m.Version()
	fmt.Printf("✓ 回滚完成，当前版本: %d\n", v)
}

// runForce 强制设置迁移版本号
func runForce(databaseURL string, args []string) {
	if len(args) < 1 {
		log.Fatal("用法: go run ./cmd/migrate force <版本号>")
	}
	var version int
	if _, err := fmt.Sscanf(args[0], "%d", &version); err != nil {
		log.Fatalf("无效的版本号: %s", args[0])
	}

	m := newMigrate(databaseURL)
	defer m.Close()

	if err := m.Force(version); err != nil {
		log.Fatalf("强制设置版本失败: %v", err)
	}
	fmt.Printf("✓ 已强制设置版本: %d\n", version)
}

// runVersion 查看当前迁移版本与 dirty 状态
func runVersion(databaseURL string) {
	m := newMigrate(databaseURL)
	defer m.Close()

	version, dirty, err := m.Version()
	if err != nil {
		if err == migrate.ErrNilVersion {
			fmt.Println("数据库无迁移记录（版本: 0）")
			return
		}
		log.Fatalf("查询版本失败: %v", err)
	}

	status := "正常"
	if dirty {
		status = "⚠️  dirty（上次迁移未完成，需用 force 修复）"
	}
	fmt.Printf("当前版本: %d  状态: %s\n", version, status)
}

// runGoto 迁移到指定版本
func runGoto(databaseURL string, args []string) {
	if len(args) < 1 {
		log.Fatal("用法: go run ./cmd/migrate goto <版本号>")
	}
	var version int
	if _, err := fmt.Sscanf(args[0], "%d", &version); err != nil {
		log.Fatalf("无效的版本号: %s", args[0])
	}

	m := newMigrate(databaseURL)
	defer m.Close()

	if err := m.Migrate(uint(version)); err != nil && err != migrate.ErrNoChange {
		log.Fatalf("迁移到版本 %d 失败: %v", version, err)
	}
	fmt.Printf("✓ 已迁移到版本: %d\n", version)
}

// newMigrate 创建迁移实例
func newMigrate(databaseURL string) *migrate.Migrate {
	m, err := migrate.New(migrationsPath, databaseURL)
	if err != nil {
		log.Fatalf("创建迁移实例失败: %v", err)
	}
	return m
}

// buildMigrateDSN 将 postgres:// DSN 转换为 pgx5:// 以匹配 golang-migrate 的 pgx/v5 驱动
func buildMigrateDSN(dsn string) string {
	if strings.HasPrefix(dsn, "postgres://") {
		return "pgx5://" + dsn[len("postgres://"):]
	}
	return dsn
}

// printUsage 打印帮助信息
func printUsage() {
	fmt.Println(`数据库迁移工具

用法:
  go run ./cmd/migrate <命令> [参数]

命令:
  up              执行所有待迁移
  down [-n N]     回滚最近 N 次迁移（默认 1）
  force <版本号>  强制设置版本号（修复 dirty 状态）
  goto <版本号>   迁移到指定版本
  version         查看当前版本与状态
  help            显示此帮助

示例:
  go run ./cmd/migrate up
  go run ./cmd/migrate down -n 2
  go run ./cmd/migrate force 33`)
}
