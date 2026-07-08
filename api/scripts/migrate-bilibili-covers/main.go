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
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/spf13/viper"
)

// BilibiliResponse B站表情 API 响应结构
type BilibiliResponse struct {
	Code int    `json:"code"`
	Data Data   `json:"data"`
	Msg  string `json:"message"`
}

type Data struct {
	Packages          []Package `json:"packages"`            // 用户 API
	UserPanelPackages []Package `json:"user_panel_packages"` // 官方 API（已添加）
	AllPackages       []Package `json:"all_packages"`        // 官方 API（全部）
}

type Package struct {
	ID    int     `json:"id"`
	Text  string  `json:"text"`
	URL   string  `json:"url"` // 表情包封面图
	Emote []Emote `json:"emote"`
	Type  int     `json:"type"`
}

type Emote struct {
	Text   string `json:"text"`
	URL    string `json:"url"`
	GifURL string `json:"gif_url"`
}

const (
	bilibiliUserAPIURL     = "https://api.bilibili.com/x/emote/user/panel/web?business=reply&web_location=333.1369"
	bilibiliOfficialAPIURL = "https://api.bilibili.com/x/emote/setting/panel?business=reply"
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

	bilibiliCookie := *cookie
	if bilibiliCookie == "" {
		bilibiliCookie = os.Getenv("BILIBILI_COOKIE")
	}
	if bilibiliCookie == "" {
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

	log.Println("正在获取 B站表情数据...")
	packages, err := fetchBilibiliEmojis(apiURL, bilibiliCookie)
	if err != nil {
		log.Fatalf("获取失败: %v", err)
	}
	log.Printf("获取到 %d 个表情包组", len(packages))

	coverByName := make(map[string]string)
	for _, pkg := range packages {
		if pkg.Text == "" {
			continue
		}
		coverURL := packageCoverURL(pkg)
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

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		log.Fatalf("Ping 失败: %v", err)
	}

	rows, err := db.QueryContext(ctx,
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
		localCoverURL, err := downloadEmojiImage(coverURL, emojiDir, urlPrefix)
		if err != nil {
			log.Printf("警告: 下载分组 %s 封面失败，使用远程 URL: %v", g.name, err)
			localCoverURL = coverURL
		} else {
			log.Printf("分组 %s 封面已下载到: %s", g.name, localCoverURL)
		}

		_, err = db.ExecContext(ctx,
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

	packages := bilibiliResp.Data.Packages
	if len(packages) == 0 {
		if len(bilibiliResp.Data.UserPanelPackages) > 0 {
			packages = bilibiliResp.Data.UserPanelPackages
		} else if len(bilibiliResp.Data.AllPackages) > 0 {
			packages = bilibiliResp.Data.AllPackages
		}
	}

	var validPackages []Package
	for _, pkg := range packages {
		if pkg.Type == 13 || len(pkg.Emote) == 0 {
			continue
		}
		validPackages = append(validPackages, pkg)
	}
	return validPackages, nil
}

// packageCoverURL 返回表情包封面 URL；B站返回的 package.url 为空时，
// 退回到分组内第一个表情的图片作为封面，避免 cover_url 为空。
func packageCoverURL(pkg Package) string {
	if pkg.URL != "" {
		return pkg.URL
	}
	for _, e := range pkg.Emote {
		if e.URL != "" {
			return e.URL
		}
	}
	return ""
}

// downloadEmojiImage 下载表情/封面图片到本地存储，返回本地可访问 URL。
// emojiDir 为物理目录，urlPrefix 为 URL 前缀，与种子服务保持一致。
func downloadEmojiImage(url, emojiDir, urlPrefix string) (string, error) {
	if url == "" {
		return "", fmt.Errorf("URL 为空")
	}

	if err := os.MkdirAll(emojiDir, 0755); err != nil {
		return "", fmt.Errorf("创建目录失败: %w", err)
	}

	client := &http.Client{Timeout: 30 * time.Second}
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return "", fmt.Errorf("创建请求失败: %w", err)
	}
	req.Header.Set("User-Agent", "Mozilla/5.0")
	req.Header.Set("Referer", "https://www.bilibili.com")

	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("下载失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("下载失败: status=%d", resp.StatusCode)
	}

	ext := ".png"
	if strings.Contains(url, ".gif") {
		ext = ".gif"
	} else if ct := resp.Header.Get("Content-Type"); ct != "" {
		switch ct {
		case "image/gif":
			ext = ".gif"
		case "image/jpeg", "image/jpg":
			ext = ".jpg"
		case "image/webp":
			ext = ".webp"
		}
	}

	filename := uuid.New().String() + ext
	dstPath := filepath.Join(emojiDir, filename)

	dst, err := os.Create(dstPath)
	if err != nil {
		return "", fmt.Errorf("创建文件失败: %w", err)
	}
	defer dst.Close()

	if _, err = io.Copy(dst, resp.Body); err != nil {
		os.Remove(dstPath)
		return "", fmt.Errorf("保存文件失败: %w", err)
	}

	return urlPrefix + "emojis/" + filename, nil
}
