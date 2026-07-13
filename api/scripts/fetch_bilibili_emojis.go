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

// 数据库写入结果
type ImportResult struct {
	GroupsCreated int
	GroupsUpdated int
	EmojisCreated int
	EmojisUpdated int
}

func main() {
	dryRun := flag.Bool("dry-run", false, "只输出数据不写入数据库")
	dbURL := flag.String("db", "", "数据库连接URL")
	cookie := flag.String("cookie", "", "B站登录Cookie (用户收藏表情需要登录)")
	apiType := flag.String("api", "", "API类型: user(用户收藏) 或 official(官方)，默认从 config.yaml 读取")
	flag.Parse()

	// 加载配置文件
	v := viper.New()
	v.SetConfigName("config")
	v.SetConfigType("yaml")
	v.AddConfigPath(".")
	v.AddConfigPath("./api")
	_ = v.ReadInConfig()

	// 获取数据库连接URL
	databaseURL := *dbURL
	if databaseURL == "" {
		databaseURL = os.Getenv("DATABASE_URL")
	}
	if databaseURL == "" {
		// 从配置文件读取
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

	// 获取 API 类型（优先命令行参数，其次配置文件）
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

	// 获取 B站表情数据
	log.Println("正在获取 B站表情数据...")
	ctx := context.Background()
	client := bilibili.NewClient(bilibiliCookie)
	packages, err := client.FetchEmojis(ctx, apiTypeValue)
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

	dbCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := db.PingContext(dbCtx); err != nil {
		log.Fatalf("Ping 失败: %v", err)
	}

	// 写入数据库
	result, err := importEmojis(dbCtx, db, packages, emojiDir, urlPrefix)
	if err != nil {
		log.Fatalf("写入失败: %v", err)
	}

	log.Println("导入完成!")
	log.Printf("  分组: 创建 %d, 更新 %d", result.GroupsCreated, result.GroupsUpdated)
	log.Printf("  表情: 创建 %d, 更新 %d", result.EmojisCreated, result.EmojisUpdated)
}

func printPackages(packages []Package) {
	for _, pkg := range packages {
		fmt.Printf("\n分组: %s (%d 个表情)\n", pkg.Text, len(pkg.Emote))
		for i, e := range pkg.Emote {
			if i < 5 {
				fmt.Printf("  %s:\n", e.Text)
				fmt.Printf("    静态: %s\n", e.URL)
				if e.GifURL != "" {
					fmt.Printf("    动图: %s\n", e.GifURL)
				} else {
					fmt.Printf("    动图: (无)\n")
				}
			}
		}
		// 统计有动图的数量
		gifCount := 0
		for _, e := range pkg.Emote {
			if e.GifURL != "" {
				gifCount++
			}
		}
		fmt.Printf("  该分组有动图的表情数: %d/%d\n", gifCount, len(pkg.Emote))
	}
}

func importEmojis(ctx context.Context, db *sql.DB, packages []Package, emojiDir, urlPrefix string) (*ImportResult, error) {
	result := &ImportResult{}

	// 复用下载器实例，封面下载到本地避免 B站 nginx 反盗链
	downloader := bilibili.NewDownloader(emojiDir, urlPrefix)

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

		// 封面下载到本地，避免 B站 nginx 反盗链
		remoteCoverURL := bilibili.PackageCoverURL(pkg)
		log.Printf("开始下载分组 %s 封面: %s", pkg.Text, remoteCoverURL)
		coverURL, err := downloader.Download(remoteCoverURL)
		if err != nil {
			log.Printf("警告: 下载分组 %s 封面失败，使用远程 URL: %v", pkg.Text, err)
			coverURL = remoteCoverURL
		} else {
			log.Printf("分组 %s 封面已下载到: %s", pkg.Text, coverURL)
		}

		// 创建分组
		var groupID int
		err = tx.QueryRowContext(ctx,
			`INSERT INTO emoji_groups (name, source, cover_url, sort_order, is_enabled)
			VALUES ($1, 'bilibili', $2, $3, true)
			RETURNING id`,
			pkg.Text, coverURL, i+1).Scan(&groupID)
		if err != nil {
			return nil, fmt.Errorf("创建分组 %s 失败: %w", pkg.Text, err)
		}
		result.GroupsCreated++

		// 创建表情
		for j, emote := range pkg.Emote {
			if emote.Text == "" {
				continue
			}

			// url 字段保存静态图（主要显示）
			// gif_url 字段保存动图（可选的动态效果）
			// source_url 字段保存 B站原始 URL
			staticURL := emote.URL
			var gifURL *string
			if emote.GifURL != "" {
				gifURL = &emote.GifURL
			}

			// source_url 保存 B站原始静态图 URL
			var sourceURL *string
			if emote.URL != "" {
				sourceURL = &emote.URL
			}

			_, err := tx.ExecContext(ctx,
				`INSERT INTO emojis (group_id, name, url, gif_url, source_url, sort_order)
				VALUES ($1, $2, $3, $4, $5, $6)`,
				groupID, emote.Text, staticURL, gifURL, sourceURL, j+1)
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
