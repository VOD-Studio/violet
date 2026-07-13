package main

import (
	"context"
	"database/sql"
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/spf13/viper"

	"blog-api/internal/infrastructure/bilibili"
)

// 复用公共包的类型定义，避免本地副本
type (
	Package = bilibili.Package
	Emote   = bilibili.Emote
)

func main() {
	dryRun := flag.Bool("dry-run", false, "只输出不匹配的数据，不写入数据库")
	dbURL := flag.String("db", "", "数据库连接URL")
	cookie := flag.String("cookie", "", "B站登录Cookie")
	apiType := flag.String("api", "", "API类型: user(用户收藏) 或 official(官方)，默认从 config.yaml 读取")
	flag.Parse()

	v := viper.New()
	v.SetConfigName("config")
	v.SetConfigType("yaml")
	v.AddConfigPath(".")
	v.AddConfigPath("./api")
	_ = v.ReadInConfig()

	databaseURL := *dbURL
	if databaseURL == "" {
		databaseURL = os.Getenv("DATABASE_URL")
	}
	if databaseURL == "" {
		databaseURL = fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=%s",
			v.GetString("database.user"),
			v.GetString("database.password"),
			v.GetString("database.host"),
			v.GetInt("database.port"),
			v.GetString("database.name"),
			v.GetString("database.sslmode"))
	}
	if databaseURL == "" {
		databaseURL = "postgres://blog:blog123@localhost:5432/blog?sslmode=disable"
	}

	// 获取 Cookie（优先命令行参数，其次环境变量 BILIBILI_COOKIE，最后配置文件 bilibili_cookies）
	bilibiliCookie := *cookie
	if bilibiliCookie == "" {
		bilibiliCookie = os.Getenv("BILIBILI_COOKIE")
	}
	if bilibiliCookie == "" {
		bilibiliCookie = v.GetString("bilibili_cookies")
	}

	apiTypeValue := *apiType
	if apiTypeValue == "" {
		apiTypeValue = v.GetString("bilibili_api_type")
	}
	if apiTypeValue == "" {
		apiTypeValue = "user"
	}

	// 上传目录配置（用于本地下载封面图）
	uploadDir := v.GetString("upload_dir")
	if uploadDir == "" {
		uploadDir = "uploads"
	}
	emojiDir := filepath.Join(uploadDir, "emojis")
	urlPrefix := v.GetString("upload_path_prefix")
	if urlPrefix == "" {
		urlPrefix = "/uploads/"
	}

	log.Println("正在获取 B站表情数据...")
	ctx := context.Background()
	client := bilibili.NewClient(bilibiliCookie)
	packages, err := client.FetchEmojis(ctx, apiTypeValue)
	if err != nil {
		log.Fatalf("获取失败: %v", err)
	}
	log.Printf("获取到 %d 个表情包组", len(packages))

	coverByName := make(map[string]string)
	for _, pkg := range packages {
		if pkg.Text == "" {
			continue
		}
		coverURL := bilibili.PackageCoverURL(pkg)
		if coverURL == "" {
			log.Printf("警告: 分组 %s 未找到可用封面", pkg.Text)
			continue
		}
		coverByName[pkg.Text] = coverURL
	}

	if *dryRun {
		log.Println("dry-run 模式，仅输出可匹配的分组")
		for name, url := range coverByName {
			log.Printf("可匹配: %s -> %s", name, url)
		}
		return
	}

	db, err := sql.Open("pgx", databaseURL)
	if err != nil {
		log.Fatalf("连接失败: %v", err)
	}
	defer db.Close()

	dbCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := db.PingContext(dbCtx); err != nil {
		log.Fatalf("Ping 失败: %v", err)
	}

	rows, err := db.QueryContext(dbCtx,
		"SELECT id, name FROM emoji_groups WHERE source = 'bilibili' AND (cover_url IS NULL OR cover_url = '' OR cover_url LIKE 'http%')")
	if err != nil {
		log.Fatalf("查询分组失败: %v", err)
	}
	defer rows.Close()

	type group struct {
		id   int
		name string
	}
	var groups []group
	for rows.Next() {
		var g group
		if err := rows.Scan(&g.id, &g.name); err != nil {
			log.Fatalf("扫描分组失败: %v", err)
		}
		groups = append(groups, g)
	}
	if err := rows.Err(); err != nil {
		log.Fatalf("遍历分组失败: %v", err)
	}

	log.Printf("发现 %d 个需要补全或替换远程 URL 的 bilibili 分组", len(groups))

	// 复用下载器实例
	downloader := bilibili.NewDownloader(emojiDir, urlPrefix)

	updated := 0
	missing := 0
	for _, g := range groups {
		coverURL, ok := coverByName[g.name]
		if !ok {
			log.Printf("未匹配到封面: %s", g.name)
			missing++
			continue
		}

		log.Printf("开始下载分组 %s 封面: %s", g.name, coverURL)
		localCoverURL, err := downloader.Download(coverURL)
		if err != nil {
			log.Printf("警告: 下载分组 %s 封面失败，使用远程 URL: %v", g.name, err)
			localCoverURL = coverURL
		} else {
			log.Printf("分组 %s 封面已下载到: %s", g.name, localCoverURL)
		}

		_, err = db.ExecContext(dbCtx,
			"UPDATE emoji_groups SET cover_url = $1, updated_at = NOW() WHERE id = $2",
			localCoverURL, g.id)
		if err != nil {
			log.Printf("更新分组 %s 封面失败: %v", g.name, err)
			continue
		}
		log.Printf("已更新封面: %s", g.name)
		updated++
	}

	log.Printf("迁移完成: 更新 %d, 未匹配 %d", updated, missing)
}
