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
		&model.EmojiGroup{}, &model.Emoji{}, &model.Playlist{}, &model.MusicSetting{},
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
