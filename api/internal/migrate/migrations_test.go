package migrate

import (
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"testing"

	"github.com/golang-migrate/migrate/v4/source/iofs"
)

// migrationFileName 迁移文件名格式：版本号_名称.up|.down.sql
var migrationFileName = regexp.MustCompile(`^(\d+)_(.+)\.(up|down)\.sql$`)

// repoMigrationsDir 返回仓库 api/migrations 目录的绝对路径。
// 测试工作目录是本包目录，故需向上两级。
func repoMigrationsDir(t *testing.T) string {
	t.Helper()

	abs, err := filepath.Abs(filepath.Join("..", "..", "migrations"))
	if err != nil {
		t.Fatalf("解析 migrations 目录失败: %v", err)
	}
	return abs
}

func TestMigrationVersionsAreUnique(t *testing.T) {
	dir := repoMigrationsDir(t)
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("读取 %s 失败: %v", dir, err)
	}

	// versions[版本号] 收集该版本号的 up/down 文件名，用于检出重复版本号与缺失配对
	type dirState struct {
		up, down []string
	}
	versions := map[string]*dirState{}
	names := make([]string, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		matches := migrationFileName.FindStringSubmatch(entry.Name())
		if matches == nil {
			t.Errorf("迁移文件 %s 不符合 <版本号>_<名称>.(up|down).sql 命名", entry.Name())
			continue
		}
		version, direction := matches[1], matches[3]
		if versions[version] == nil {
			versions[version] = &dirState{}
			names = append(names, version)
		}
		state := versions[version]
		switch direction {
		case "up":
			state.up = append(state.up, entry.Name())
		case "down":
			state.down = append(state.down, entry.Name())
		}
	}
	if len(names) == 0 {
		t.Fatalf("%s 下未找到任何迁移文件", dir)
	}
	sort.Strings(names)

	for _, version := range names {
		state := versions[version]
		if len(state.up) > 1 || len(state.down) > 1 {
			t.Errorf("迁移版本号 %s 重复：up=%v down=%v，golang-migrate 会拒绝加载整个目录",
				version, state.up, state.down)
		}
		if len(state.up) == 0 {
			t.Errorf("迁移版本号 %s 缺少 .up.sql：%v", version, state.down)
		}
		if len(state.down) == 0 {
			t.Errorf("迁移版本号 %s 缺少 .down.sql：%v", version, state.up)
		}
	}
}

// TestMigrationsLoadByGolangMigrate 复现部署门禁的加载路径：file:// 源内部走 iofs，
// 重复版本号会在这里报 ErrDuplicateMigration，而不是等到迁移执行时才暴露。
func TestMigrationsLoadByGolangMigrate(t *testing.T) {
	dir := repoMigrationsDir(t)

	driver, err := iofs.New(os.DirFS(dir), ".")
	if err != nil {
		t.Fatalf("golang-migrate 加载 %s 失败: %v", dir, err)
	}
	if err := driver.Close(); err != nil {
		t.Fatalf("关闭迁移源失败: %v", err)
	}
}
