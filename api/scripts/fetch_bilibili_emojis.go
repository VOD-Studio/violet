package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
)

// Bilibili API 响应结构
type BilibiliResponse struct {
	Code int    `json:"code"`
	Data Data   `json:"data"`
	Msg  string `json:"message"`
}

type Data struct {
	Packages []Package `json:"packages"`
}

type Package struct {
	ID     int     `json:"id"`
	Text   string  `json:"text"`
	Emote  []Emote `json:"emote"`
}

type Emote struct {
	Text   string `json:"text"`
	URL    string `json:"url"`
	GifURL string `json:"gif_url"`
}

// 数据库写入结果
type ImportResult struct {
	GroupsCreated int
	GroupsUpdated int
	EmojisCreated int
	EmojisUpdated int
}

const bilibiliAPIURL = "https://api.bilibili.com/x/emote/setting/panel?business=reply"

func main() {
	dryRun := flag.Bool("dry-run", false, "只输出数据不写入数据库")
	dbURL := flag.String("db", "", "数据库连接URL")
	cookie := flag.String("cookie", "", "B站登录Cookie")
	flag.Parse()

	// 获取数据库连接URL
	databaseURL := *dbURL
	if databaseURL == "" {
		databaseURL = os.Getenv("DATABASE_URL")
	}
	if databaseURL == "" {
		databaseURL = "postgres://blog:blog123@localhost:5432/blog?sslmode=disable"
	}

	// 获取 Cookie
	bilibiliCookie := *cookie
	if bilibiliCookie == "" {
		bilibiliCookie = os.Getenv("BILIBILI_COOKIE")
	}

	// 获取 B站表情数据
	log.Println("正在获取 B站表情数据...")
	packages, err := fetchBilibiliEmojis(bilibiliCookie)
	if err != nil {
		log.Fatalf("获取失败: %v", err)
	}
	log.Printf("获取到 %d 个表情包组", len(packages))

	// dry-run 模式
	if *dryRun {
		printPackages(packages)
		return
	}

	// 连接数据库
	log.Println("正在连接数据库...")
	db, err := sql.Open("pgx", databaseURL)
	if err != nil {
		log.Fatalf("连接失败: %v", err)
	}
	defer db.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		log.Fatalf("Ping 失败: %v", err)
	}

	// 写入数据库
	result, err := importEmojis(ctx, db, packages)
	if err != nil {
		log.Fatalf("写入失败: %v", err)
	}

	log.Println("导入完成!")
	log.Printf("  分组: 创建 %d, 更新 %d", result.GroupsCreated, result.GroupsUpdated)
	log.Printf("  表情: 创建 %d, 更新 %d", result.EmojisCreated, result.EmojisUpdated)
}

func fetchBilibiliEmojis(cookie string) ([]Package, error) {
	client := &http.Client{Timeout: 30 * time.Second}

	req, err := http.NewRequest("GET", bilibiliAPIURL, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("User-Agent", "Mozilla/5.0")
	req.Header.Set("Referer", "https://www.bilibili.com")
	if cookie != "" {
		req.Header.Set("Cookie", cookie)
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var bilibiliResp BilibiliResponse
	if err := json.Unmarshal(body, &bilibiliResp); err != nil {
		return nil, err
	}

	if bilibiliResp.Code != 0 {
		return nil, fmt.Errorf("API错误: code=%d", bilibiliResp.Code)
	}

	return bilibiliResp.Data.Packages, nil
}

func printPackages(packages []Package) {
	for _, pkg := range packages {
		fmt.Printf("\n分组: %s (%d 个表情)\n", pkg.Text, len(pkg.Emote))
		for i, e := range pkg.Emote {
			if i < 3 {
				fmt.Printf("  %s: %s\n", e.Text, e.URL)
			}
		}
	}
}

func importEmojis(ctx context.Context, db *sql.DB, packages []Package) (*ImportResult, error) {
	result := &ImportResult{}

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	// 先清除 bilibili 来源的数据
	_, err = tx.ExecContext(ctx, "DELETE FROM emojis WHERE group_id IN (SELECT id FROM emoji_groups WHERE source = 'bilibili')")
	if err != nil {
		return nil, err
	}
	_, err = tx.ExecContext(ctx, "DELETE FROM emoji_groups WHERE source = 'bilibili'")
	if err != nil {
		return nil, err
	}

	for i, pkg := range packages {
		if pkg.Text == "" || len(pkg.Emote) == 0 {
			continue
		}

		// 创建分组
		var groupID int
		err := tx.QueryRowContext(ctx,
			`INSERT INTO emoji_groups (name, source, sort_order, is_enabled)
			VALUES ($1, 'bilibili', $2, true)
			RETURNING id`,
			pkg.Text, i+1).Scan(&groupID)
		if err != nil {
			return nil, fmt.Errorf("创建分组 %s 失败: %w", pkg.Text, err)
		}
		result.GroupsCreated++

		// 创建表情
		for j, emote := range pkg.Emote {
			if emote.Text == "" {
				continue
			}
			url := emote.URL
			if emote.GifURL != "" {
				url = emote.GifURL
			}

			_, err := tx.ExecContext(ctx,
				`INSERT INTO emojis (group_id, name, url, sort_order)
				VALUES ($1, $2, $3, $4)`,
				groupID, emote.Text, url, j+1)
			if err != nil {
				log.Printf("警告: 创建表情 %s 失败: %v", emote.Text, err)
				continue
			}
			result.EmojisCreated++
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return result, nil
}