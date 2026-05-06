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

	"github.com/spf13/viper"
	_ "github.com/jackc/pgx/v5/stdlib"
)

// Bilibili API 响应结构
type BilibiliResponse struct {
	Code int    `json:"code"`
	Data Data   `json:"data"`
	Msg  string `json:"message"`
}

type Data struct {
	Packages          []Package `json:"packages"`           // 用户 API
	UserPanelPackages []Package `json:"user_panel_packages"` // 官方 API
}

type Package struct {
	ID    int     `json:"id"`
	Text  string  `json:"text"`
	URL   string  `json:"url"`  // 表情包封面图（可选）
	Emote []Emote `json:"emote"`
	Type  int     `json:"type"` // 13=收藏特殊包，1=普通表情包
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

// Bilibili API URL 配置
const (
	bilibiliUserAPIURL   = "https://api.bilibili.com/x/emote/user/panel/web?business=reply&web_location=333.1369"
	bilibiliOfficialAPIURL = "https://api.bilibili.com/x/emote/setting/panel?business=reply"
)

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

	// 获取 Cookie（优先命令行参数，其次配置文件）
	bilibiliCookie := *cookie
	if bilibiliCookie == "" {
		bilibiliCookie = os.Getenv("BILIBILI_COOKIE")
	}
	if bilibiliCookie == "" {
		// 从配置文件拼接 Cookie
		sessdata := v.GetString("bilibili_sessdata")
		biliJct := v.GetString("bilibili_bili_jct")
		dedeUserID := v.GetString("bilibili_dedeuserid")
		if sessdata != "" {
			bilibiliCookie = "SESSDATA=" + sessdata
			if biliJct != "" {
				bilibiliCookie += "; bili_jct=" + biliJct
			}
			if dedeUserID != "" {
				bilibiliCookie += "; DedeUserID=" + dedeUserID
			}
		}
	}

	// 获取 API 类型（优先命令行参数，其次配置文件）
	apiTypeValue := *apiType
	if apiTypeValue == "" {
		apiTypeValue = v.GetString("bilibili_api_type")
	}
	if apiTypeValue == "" {
		apiTypeValue = "user"
	}

	// 选择 API URL
	var apiURL string
	switch apiTypeValue {
	case "user":
		apiURL = bilibiliUserAPIURL
		log.Println("使用用户收藏表情 API")
	case "official":
		apiURL = bilibiliOfficialAPIURL
		log.Println("使用官方表情 API")
	default:
		apiURL = bilibiliUserAPIURL
		log.Printf("未知 API 类型 '%s', 使用用户收藏表情 API", apiTypeValue)
	}

	// 获取 B站表情数据
	log.Println("正在获取 B站表情数据...")
	packages, err := fetchBilibiliEmojis(apiURL, bilibiliCookie)
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

func fetchBilibiliEmojis(apiURL, cookie string) ([]Package, error) {
	client := &http.Client{Timeout: 30 * time.Second}

	req, err := http.NewRequest("GET", apiURL, nil)
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

	// 兼容两种 API 的数据结构
	// 用户 API: data.packages
	// 官方 API: data.user_panel_packages
	packages := bilibiliResp.Data.Packages
	if len(packages) == 0 && len(bilibiliResp.Data.UserPanelPackages) > 0 {
		packages = bilibiliResp.Data.UserPanelPackages
	}

	// 过滤掉特殊包（type=13 是收藏包，没有实际表情）
	var validPackages []Package
	for _, pkg := range packages {
		if pkg.Type == 13 || len(pkg.Emote) == 0 {
			continue
		}
		validPackages = append(validPackages, pkg)
	}

	return validPackages, nil
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