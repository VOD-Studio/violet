//go:build integration

package migrate

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	gmigrate "github.com/golang-migrate/migrate/v4"
	_ "github.com/jackc/pgx/v5/stdlib"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"blog-api/internal/infrastructure/persistence/gorm/model"
)

// MIGRATE_TEST_DSN 必须指向专用测试库。每例创建独立 schema，并仅清理该 schema。
func testDatabase(t *testing.T) (*sql.DB, string) {
	t.Helper()
	dsn := os.Getenv("MIGRATE_TEST_DSN")
	if dsn == "" {
		t.Skip("需设置 MIGRATE_TEST_DSN 指向专用 PostgreSQL 测试库")
	}
	u, err := url.Parse(dsn)
	if err != nil {
		t.Fatal(err)
	}
	admin, err := sql.Open("pgx", dsn)
	if err != nil {
		t.Fatal(err)
	}
	schema := fmt.Sprintf("migrate_test_%d", time.Now().UnixNano())
	if _, err := admin.Exec(`CREATE SCHEMA "` + schema + `"`); err != nil {
		admin.Close()
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if _, err := admin.Exec(`DROP SCHEMA "` + schema + `" CASCADE`); err != nil {
			t.Error(err)
		}
		admin.Close()
	})
	query := u.Query()
	query.Set("search_path", schema)
	u.RawQuery = query.Encode()
	db, err := sql.Open("pgx", u.String())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	return db, u.String()
}

func writeMigration(t *testing.T, dir, name, body string) {
	t.Helper()
	if err := os.WriteFile(filepath.Join(dir, name), []byte(body), 0600); err != nil {
		t.Fatal(err)
	}
}

func TestCheckSchemaReadOnly(t *testing.T) {
	for _, tc := range []struct {
		name    string
		setup   string
		wantErr bool
	}{
		{"missing metadata", "", true},
		{"empty metadata", "CREATE TABLE schema_migrations (version bigint PRIMARY KEY, dirty boolean NOT NULL)", true},
		{"older database", "INSERT INTO schema_migrations VALUES (1, false)", true},
		{"current database", "INSERT INTO schema_migrations VALUES (2, false)", false},
		{"newer database with old image", "INSERT INTO schema_migrations VALUES (3, false)", false},
		{"dirty database", "INSERT INTO schema_migrations VALUES (3, true)", true},
		{"multiple records", "INSERT INTO schema_migrations VALUES (2, false), (3, false)", true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			db, dsn := testDatabase(t)
			if strings.HasPrefix(tc.setup, "INSERT") {
				if _, err := db.Exec("CREATE TABLE schema_migrations (version bigint PRIMARY KEY, dirty boolean NOT NULL)"); err != nil {
					t.Fatal(err)
				}
			}
			if tc.setup != "" {
				if _, err := db.Exec(tc.setup); err != nil {
					t.Fatal(err)
				}
			}
			dir := t.TempDir()
			writeMigration(t, dir, "002_old_image.up.sql", "SELECT 1;")
			u, _ := url.Parse(dsn)
			query := u.Query()
			query.Set("default_transaction_read_only", "on")
			u.RawQuery = query.Encode()
			readonly, err := sql.Open("pgx", u.String())
			if err != nil {
				t.Fatal(err)
			}
			defer readonly.Close()
			err = CheckSchema(context.Background(), dir, readonly)
			if (err != nil) != tc.wantErr {
				t.Fatalf("CheckSchema() = %v, wantErr %v", err, tc.wantErr)
			}
			if tc.name == "dirty database" {
				var dirtyErr gmigrate.ErrDirty
				if !errors.As(err, &dirtyErr) || dirtyErr.Version != 3 {
					t.Fatalf("dirty 状态错误未保留: %v", err)
				}
				var version int
				var dirty bool
				if err := db.QueryRow("SELECT version, dirty FROM schema_migrations").Scan(&version, &dirty); err != nil || version != 3 || !dirty {
					t.Fatalf("dirty 元数据被改变: %d, %v, %v", version, dirty, err)
				}
			}
		})
	}
}

func TestRunMigrationsPreservesDirtyState(t *testing.T) {
	db, dsn := testDatabase(t)
	dir := t.TempDir()
	writeMigration(t, dir, "001_initial.up.sql", "CREATE TABLE existing_data (id int);")
	migrateDSN := strings.Replace(dsn, "postgres://", "pgx5://", 1)
	if err := RunMigrations(dir, migrateDSN); err != nil {
		t.Fatal(err)
	}
	writeMigration(t, dir, "002_failed.up.sql", "CREATE TABLE must_not_be_created (id int);")
	if _, err := db.Exec("UPDATE schema_migrations SET version = 2, dirty = true"); err != nil {
		t.Fatal(err)
	}
	err := RunMigrations(dir, migrateDSN)
	var dirtyErr gmigrate.ErrDirty
	if !errors.As(err, &dirtyErr) || dirtyErr.Version != 2 {
		t.Fatalf("期望 dirty 失败, 实际 %v", err)
	}
	var version int
	var dirty bool
	if err := db.QueryRow("SELECT version, dirty FROM schema_migrations").Scan(&version, &dirty); err != nil || version != 2 || !dirty {
		t.Fatalf("dirty 元数据被改变: %d, %v, %v", version, dirty, err)
	}
	var table *string
	if err := db.QueryRow("SELECT to_regclass('must_not_be_created')::text").Scan(&table); err != nil || table != nil {
		t.Fatalf("dirty 状态不应继续执行迁移: %v, %v", table, err)
	}
}

func TestSQLMigrationsCoverStartupModels(t *testing.T) {
	db, dsn := testDatabase(t)
	if err := RunMigrations(repoMigrationsDir(t), strings.Replace(dsn, "postgres://", "pgx5://", 1)); err != nil {
		t.Fatal(err)
	}
	gdb, err := gorm.Open(postgres.New(postgres.Config{Conn: db}), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	// 覆盖原启动 AutoMigrate 的全部模型，证明 SQL 迁移独立提供其持久化字段。
	models := []any{
		&model.User{}, &model.Role{}, &model.Permission{}, &model.RolePermission{},
		&model.Post{}, &model.PostVersion{}, &model.PostView{}, &model.Tag{},
		&model.Comment{}, &model.CommentReaction{}, &model.Announcement{}, &model.Project{},
		&model.EmojiGroup{}, &model.Emoji{},
		&model.File{}, &model.UploadSession{}, &model.APIToken{}, &model.Subscription{}, &model.SubscriptionEntry{},
	}
	for _, value := range models {
		stmt := &gorm.Statement{DB: gdb}
		if err := stmt.Parse(value); err != nil {
			t.Fatal(err)
		}
		for _, column := range stmt.Schema.DBNames {
			var present bool
			err := db.QueryRow(`SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1 AND column_name = $2)`, stmt.Schema.Table, column).Scan(&present)
			if err != nil {
				t.Fatal(err)
			}
			if !present {
				t.Errorf("SQL 迁移缺少 %s.%s", stmt.Schema.Table, column)
			}
		}
	}
	if err := CheckSchema(context.Background(), repoMigrationsDir(t), db); err != nil {
		t.Fatal(err)
	}
	t.Run("preexisting column data survives migration and downgrade", func(t *testing.T) {
		if _, err := db.Exec(`INSERT INTO tags (name, slug, created_at) VALUES ('migration-test', 'migration-test', '2020-01-02T03:04:05Z')`); err != nil {
			t.Fatal(err)
		}
		if _, err := db.Exec(`INSERT INTO emoji_groups (name, updated_at) VALUES ('migration-test', '2020-01-02T03:04:05Z')`); err != nil {
			t.Fatal(err)
		}
		for _, direction := range []string{"up", "down"} {
			body, err := os.ReadFile(filepath.Join(repoMigrationsDir(t), "132_complete_sql_managed_schema."+direction+".sql"))
			if err != nil {
				t.Fatal(err)
			}
			if _, err := db.Exec(string(body)); err != nil {
				t.Fatal(err)
			}
		}
		for _, query := range []string{
			`SELECT created_at FROM tags WHERE slug = 'migration-test'`,
			`SELECT updated_at FROM emoji_groups WHERE name = 'migration-test'`,
		} {
			var actual time.Time
			if err := db.QueryRow(query).Scan(&actual); err != nil {
				t.Fatal(err)
			}
			if !actual.Equal(time.Date(2020, 1, 2, 3, 4, 5, 0, time.UTC)) {
				t.Fatalf("existing timestamp changed: %s", actual)
			}
		}
	})
}

func TestRetirePlaylistPermissionsPreservesDataAndUnrelatedGrants(t *testing.T) {
	for _, keepCustomChild := range []bool{false, true} {
		t.Run(fmt.Sprintf("custom_child=%t", keepCustomChild), func(t *testing.T) {
			db, dsn := testDatabase(t)
			m, err := gmigrate.New("file://"+repoMigrationsDir(t), strings.Replace(dsn, "postgres://", "pgx5://", 1))
			if err != nil {
				t.Fatal(err)
			}
			t.Cleanup(func() { m.Close() })
			if err := m.Migrate(138); err != nil {
				t.Fatal(err)
			}

			setup := `
INSERT INTO playlists (id, title, platform, playlist_id, songs, song_count, is_active)
VALUES ('00000000-0000-4000-8000-000000000139', '保留的歌单', 'netease', 'retirement-test',
        '[{"name":"保留的歌曲","url":"/uploads/retained.mp3"}]', 1, TRUE);
UPDATE music_settings SET player_version = 'v2' WHERE id = 1;
INSERT INTO roles (name, description) VALUES ('retirement-test', '迁移测试角色');
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'retirement-test'
  AND p.code IN ('playlist', 'playlist:view', 'playlist:create', 'playlist:update',
                 'playlist:delete', 'playlist:toggle', 'media:view');`
			if _, err := db.Exec(setup); err != nil {
				t.Fatal(err)
			}
			if keepCustomChild {
				if _, err := db.Exec(`
INSERT INTO permissions (code, name, type, parent_id)
SELECT 'archive:view', '自定义归档', 'action', id FROM permissions WHERE code = 'playlist';
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'retirement-test' AND p.code = 'archive:view';`); err != nil {
					t.Fatal(err)
				}
			}

			assertCount := func(query string, want int) {
				t.Helper()
				var got int
				if err := db.QueryRow(query).Scan(&got); err != nil {
					t.Fatal(err)
				}
				if got != want {
					t.Fatalf("%s: got %d, want %d", query, got, want)
				}
			}
			assertData := func() {
				t.Helper()
				assertCount(`SELECT COUNT(*) FROM playlists
WHERE id = '00000000-0000-4000-8000-000000000139' AND title = '保留的歌单'
  AND platform = 'netease' AND playlist_id = 'retirement-test' AND is_active
  AND song_count = 1 AND songs = '[{"name":"保留的歌曲","url":"/uploads/retained.mp3"}]'::jsonb`, 1)
				assertCount(`SELECT COUNT(*) FROM music_settings WHERE id = 1 AND player_version = 'v2'`, 1)
				assertCount(`SELECT COUNT(*) FROM role_permissions rp
JOIN roles r ON r.id = rp.role_id JOIN permissions p ON p.id = rp.permission_id
WHERE r.name = 'retirement-test' AND p.code = 'media:view'`, 1)
			}
			assertCount(`SELECT COUNT(*) FROM role_permissions rp
JOIN roles r ON r.id = rp.role_id JOIN permissions p ON p.id = rp.permission_id
WHERE r.name = 'retirement-test' AND p.code LIKE 'playlist:%'`, 5)

			if err := m.Migrate(139); err != nil {
				t.Fatal(err)
			}
			assertData()
			assertCount(`SELECT COUNT(*) FROM permissions WHERE code LIKE 'playlist:%'`, 0)
			wantMenu, wantGrants := 0, 1
			if keepCustomChild {
				wantMenu, wantGrants = 1, 3
				assertCount(`SELECT COUNT(*) FROM permissions child
JOIN permissions menu ON menu.id = child.parent_id
WHERE child.code = 'archive:view' AND menu.code = 'playlist'`, 1)
			}
			assertCount(`SELECT COUNT(*) FROM permissions WHERE code = 'playlist'`, wantMenu)
			assertCount(`SELECT COUNT(*) FROM role_permissions rp
JOIN roles r ON r.id = rp.role_id WHERE r.name = 'retirement-test'`, wantGrants)

			if err := m.Migrate(138); err != nil {
				t.Fatal(err)
			}
			assertData()
			assertCount(`SELECT COUNT(*) FROM permissions p
JOIN permissions menu ON menu.id = p.parent_id
WHERE p.code LIKE 'playlist:%' AND p.type = 'action' AND p.is_builtin
  AND menu.code = 'playlist' AND menu.type = 'menu'`, 5)
			assertCount(`SELECT COUNT(*) FROM role_permissions rp
JOIN roles r ON r.id = rp.role_id JOIN permissions p ON p.id = rp.permission_id
WHERE r.name = 'admin' AND p.code LIKE 'playlist:%'`, 5)
			assertCount(`SELECT COUNT(*) FROM role_permissions rp
JOIN roles r ON r.id = rp.role_id JOIN permissions p ON p.id = rp.permission_id
WHERE r.name = 'retirement-test' AND p.code LIKE 'playlist:%'`, 0)
			assertCount(`SELECT COUNT(*) FROM role_permissions rp
JOIN roles r ON r.id = rp.role_id WHERE r.name = 'retirement-test'`, wantGrants)
		})
	}
}
