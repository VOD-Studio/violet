//go:build integration

package chatappearance

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	domain "blog-api/internal/domain/chatappearance"
)

// 仅显式开启:必须使用专用测试库,严禁指向生产 DSN。
// 全部表都建在随机生成的 schema 内,清理时只删该 schema。
func TestPostgresAppearanceStore(t *testing.T) {
	dsn := os.Getenv("CHAT_APPEARANCE_TEST_DSN")
	if dsn == "" {
		t.Skip("需设置 CHAT_APPEARANCE_TEST_DSN 指向专用测试 PostgreSQL 库")
	}
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	raw, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	defer raw.Close()
	schema := fmt.Sprintf("appearance_test_%d", time.Now().UnixNano())
	if err = db.Exec(`CREATE SCHEMA "` + schema + `"`).Error; err != nil {
		t.Fatal(err)
	}
	defer db.Exec(`DROP SCHEMA "` + schema + `" CASCADE`)
	tx := db.Begin()
	if tx.Error != nil {
		t.Fatal(tx.Error)
	}
	defer tx.Rollback()
	if err = tx.Exec(`SET LOCAL search_path TO "` + schema + `"`).Error; err != nil {
		t.Fatal(err)
	}
	// 直接执行真实安装的 migration 文件,不测第二份手工维护的建表语句。
	if err = tx.Exec(`CREATE TABLE users (id uuid PRIMARY KEY)`).Error; err != nil {
		t.Fatal(err)
	}
	migrations, err := filepath.Glob("../../../../../migrations/1[178]_chat_user_*.up.sql")
	if err != nil || len(migrations) != 2 {
		t.Fatalf("期望外观与徽章两份迁移,实际 %v (%v)", migrations, err)
	}
	for _, path := range migrations {
		migrationSQL, err := os.ReadFile(path)
		if err != nil {
			t.Fatal(err)
		}
		if err = tx.Exec(migrationSQL).Error; err != nil {
			t.Fatal(err)
		}
	}
	if err = tx.Exec(`INSERT INTO users(id) VALUES ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222')`).Error; err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	store := NewChatAppearanceStore(tx)
	id := "11111111-1111-4111-8111-111111111111"
	empty, err := store.Get(ctx, id)
	if err != nil || empty.Revision != 0 {
		t.Fatal(empty, err)
	}
	value := domain.Selection{AvatarFrameID: "moon-cloud", BubbleThemeID: "tea-time"}
	state, err := store.CompareAndSwap(ctx, id, value, 0)
	if err != nil || state.Revision != 1 {
		t.Fatal(state, err)
	}
	if _, err = store.CompareAndSwap(ctx, id, value, 0); !errors.Is(err, domain.ErrConflict) {
		t.Fatal("CAS 失败", err)
	}
	loaded, err := store.Get(ctx, id)
	if err != nil || loaded.Revision != state.Revision || !loaded.Selection.Equal(state.Selection) {
		t.Fatal(loaded, err)
	}
	batch, err := store.GetMany(ctx, []string{id, "22222222-2222-4222-8222-222222222222"})
	if err != nil || len(batch) != 2 || !batch[id].Equal(value) {
		t.Fatal(batch, err)
	}
	// 徽章持有:授予幂等,列表按目录 ID 稳定排序,撤销真正删行。
	if err = store.Grant(ctx, "33333333-3333-4333-8333-333333333333", id, []string{"rua", "tea-party", "rua"}); err != nil {
		t.Fatal(err)
	}
	grants, err := store.Grants(ctx, id)
	if err != nil || len(grants) != 2 || grants[0].BadgeID != "rua" || grants[0].AwardedBy == "" {
		t.Fatal(grants, err)
	}
	empty, err := store.Grants(ctx, "22222222-2222-4222-8222-222222222222")
	if err != nil || len(empty) != 0 {
		t.Fatal(empty, err)
	}
	byUsers, err := store.GrantsForUsers(ctx, []string{id, "22222222-2222-4222-8222-222222222222"})
	if err != nil || len(byUsers[id]) != 2 || len(byUsers["22222222-2222-4222-8222-222222222222"]) != 0 {
		t.Fatal(byUsers, err)
	}
	if err = store.Revoke(ctx, id, "rua"); err != nil {
		t.Fatal(err)
	}
	if err = store.Revoke(ctx, id, "rua"); !errors.Is(err, domain.ErrInvalid) {
		t.Fatal("重复撤销未报错", err)
	}
	reset, err := store.CompareAndSwap(ctx, id, domain.Selection{}, 1)
	if err != nil || reset.Revision != 2 {
		t.Fatal(reset, err)
	}
	if err = tx.Exec(`DELETE FROM users WHERE id = ?`, id).Error; err != nil {
		t.Fatal(err)
	}
	absent, err := store.Get(ctx, id)
	if err != nil || absent.Revision != 0 {
		t.Fatal("级联删除失效", absent, err)
	}
}
