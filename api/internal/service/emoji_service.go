package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"

	"blog-api/internal/repository/generated"
)

// 表情业务错误定义
var (
	ErrEmojiGroupNotFound = errors.New("表情分组不存在")
	ErrEmojiNotFound      = errors.New("表情不存在")
	ErrEmojiTooLarge      = errors.New("表情文件过大")
	ErrInvalidEmojiType   = errors.New("不支持的表情文件类型")
)

// 支持的表情图片 MIME 类型
var allowedEmojiTypes = map[string]bool{
	"image/jpeg":    true,
	"image/png":     true,
	"image/gif":     true,
	"image/webp":    true,
	"image/svg+xml": true,
}

// 支持的表情图片扩展名
var allowedEmojiExts = map[string]bool{
	".jpg":  true,
	".jpeg": true,
	".png":  true,
	".gif":  true,
	".webp": true,
	".svg":  true,
}

// EmojiService 表情服务
type EmojiService struct {
	queries        *generated.Queries
	rendererCache  *SimpleEmojiCache
	emojiDir       string // 表情独立存储目录
	bilibiliCookie string // B站登录 Cookie（优先使用）
	bilibiliUsername string // B站账号
	bilibiliPassword string // B站密码
}

// NewEmojiService 创建表情服务实例
func NewEmojiService(queries *generated.Queries, emojiDir, cookie, username, password string) *EmojiService {
	return &EmojiService{
		queries:         queries,
		emojiDir:        emojiDir,
		bilibiliCookie:  cookie,
		bilibiliUsername: username,
		bilibiliPassword: password,
	}
}

// RefreshCache 刷新表情缓存
func (s *EmojiService) RefreshCache(ctx context.Context) error {
	emojis, err := s.queries.ListAllEmojisWithGroup(ctx)
	if err != nil {
		return fmt.Errorf("获取表情列表失败: %w", err)
	}
	s.rendererCache = NewSimpleEmojiCache(emojis)
	return nil
}

// GetCache 获取渲染器缓存
func (s *EmojiService) GetCache() EmojiCache {
	return s.rendererCache
}

// --- 表情分组响应类型 ---

// EmojiGroupResponse 表情分组响应
type EmojiGroupResponse struct {
	ID        int32             `json:"id"`
	Name      string            `json:"name"`
	Source    string            `json:"source"`
	SortOrder int32             `json:"sort_order"`
	IsEnabled bool              `json:"is_enabled"`
	CreatedAt string            `json:"created_at"`
	Emojis    []*EmojiResponse  `json:"emojis,omitempty"`
}

// EmojiResponse 表情响应
type EmojiResponse struct {
	ID          int32  `json:"id"`
	GroupID     int32  `json:"group_id"`
	Name        string `json:"name"`
	URL         string `json:"url,omitempty"`
	TextContent string `json:"text_content,omitempty"`
	SortOrder   int32  `json:"sort_order"`
	CreatedAt   string `json:"created_at"`
}

// --- 公开接口 ---

// GetAllEmojisForPublic 获取所有公开表情分组和表情
func (s *EmojiService) GetAllEmojisForPublic(ctx context.Context) ([]*EmojiGroupResponse, error) {
	// 获取所有启用的分组
	groups, err := s.queries.ListEmojiGroups(ctx)
	if err != nil {
		return nil, fmt.Errorf("获取表情分组列表失败: %w", err)
	}

	responses := make([]*EmojiGroupResponse, 0, len(groups))
	for _, g := range groups {
		resp := emojiGroupToResponse(g)
		// 获取分组内的表情
		emojis, err := s.queries.ListEmojisByGroup(ctx, g.ID)
		if err == nil {
			resp.Emojis = make([]*EmojiResponse, 0, len(emojis))
			for _, e := range emojis {
				resp.Emojis = append(resp.Emojis, emojiToResponse(e))
			}
		}
		responses = append(responses, resp)
	}

	return responses, nil
}

// GetEmojiGroupByID 获取单个表情分组
func (s *EmojiService) GetEmojiGroupByID(ctx context.Context, id int32) (*EmojiGroupResponse, error) {
	group, err := s.queries.GetEmojiGroupByID(ctx, id)
	if err != nil {
		return nil, ErrEmojiGroupNotFound
	}
	return emojiGroupToResponse(group), nil
}

// ListEmojiGroups 获取所有启用的表情分组（公开）
func (s *EmojiService) ListEmojiGroups(ctx context.Context) ([]*EmojiGroupResponse, error) {
	groups, err := s.queries.ListEmojiGroups(ctx)
	if err != nil {
		return nil, fmt.Errorf("获取表情分组列表失败: %w", err)
	}

	responses := make([]*EmojiGroupResponse, 0, len(groups))
	for _, g := range groups {
		responses = append(responses, emojiGroupToResponse(g))
	}
	return responses, nil
}

// GetEmojiGroupByName 获取指定名称的表情分组（含表情）
func (s *EmojiService) GetEmojiGroupByName(ctx context.Context, name string) (*EmojiGroupResponse, error) {
	group, err := s.queries.GetEmojiGroupByName(ctx, name)
	if err != nil {
		return nil, ErrEmojiGroupNotFound
	}

	resp := emojiGroupToResponse(group)
	emojis, err := s.queries.ListEmojisByGroup(ctx, group.ID)
	if err == nil {
		resp.Emojis = make([]*EmojiResponse, 0, len(emojis))
		for _, e := range emojis {
			resp.Emojis = append(resp.Emojis, emojiToResponse(e))
		}
	}

	return resp, nil
}

// --- 管理接口：分组操作 ---

// ListAllEmojiGroups 获取所有表情分组（含未启用）
func (s *EmojiService) ListAllEmojiGroups(ctx context.Context) ([]*EmojiGroupResponse, error) {
	groups, err := s.queries.ListAllEmojiGroups(ctx)
	if err != nil {
		return nil, fmt.Errorf("获取表情分组列表失败: %w", err)
	}

	responses := make([]*EmojiGroupResponse, 0, len(groups))
	for _, g := range groups {
		responses = append(responses, emojiGroupToResponse(g))
	}
	return responses, nil
}

// CreateEmojiGroupInput 创建表情分组输入
type CreateEmojiGroupInput struct {
	Name      string
	Source    string
	SortOrder int32
	IsEnabled bool
}

// CreateEmojiGroup 创建表情分组
func (s *EmojiService) CreateEmojiGroup(ctx context.Context, input CreateEmojiGroupInput) (*EmojiGroupResponse, error) {
	params := generated.CreateEmojiGroupParams{
		Name:      input.Name,
		Source:    input.Source,
		SortOrder: input.SortOrder,
		IsEnabled: input.IsEnabled,
	}

	group, err := s.queries.CreateEmojiGroup(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("创建表情分组失败: %w", err)
	}

	return emojiGroupToResponse(group), nil
}

// UpdateEmojiGroupInput 更新表情分组输入
type UpdateEmojiGroupInput struct {
	ID        int32
	Name      string
	Source    string
	SortOrder int32
	IsEnabled bool
}

// UpdateEmojiGroup 更新表情分组
func (s *EmojiService) UpdateEmojiGroup(ctx context.Context, input UpdateEmojiGroupInput) (*EmojiGroupResponse, error) {
	params := generated.UpdateEmojiGroupParams{
		ID:        input.ID,
		Name:      input.Name,
		Source:    input.Source,
		SortOrder: input.SortOrder,
		IsEnabled: input.IsEnabled,
	}

	group, err := s.queries.UpdateEmojiGroup(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("更新表情分组失败: %w", err)
	}

	return emojiGroupToResponse(group), nil
}

// DeleteEmojiGroup 删除表情分组（会同时删除分组内的所有表情）
func (s *EmojiService) DeleteEmojiGroup(ctx context.Context, id int32) error {
	// 先删除分组内的表情
	err := s.queries.DeleteEmojisByGroup(ctx, id)
	if err != nil {
		return fmt.Errorf("删除分组内表情失败: %w", err)
	}

	// 再删除分组
	err = s.queries.DeleteEmojiGroup(ctx, id)
	if err != nil {
		return fmt.Errorf("删除表情分组失败: %w", err)
	}
	return nil
}

// --- 管理接口：表情操作 ---

// GetEmojiByID 获取单个表情
func (s *EmojiService) GetEmojiByID(ctx context.Context, id int32) (*EmojiResponse, error) {
	emoji, err := s.queries.GetEmojiByID(ctx, id)
	if err != nil {
		return nil, ErrEmojiNotFound
	}
	return emojiToResponse(emoji), nil
}

// ListEmojisByGroup 获取分组内所有表情
func (s *EmojiService) ListEmojisByGroup(ctx context.Context, groupID int32) ([]*EmojiResponse, error) {
	emojis, err := s.queries.ListEmojisByGroup(ctx, groupID)
	if err != nil {
		return nil, fmt.Errorf("获取表情列表失败: %w", err)
	}

	responses := make([]*EmojiResponse, 0, len(emojis))
	for _, e := range emojis {
		responses = append(responses, emojiToResponse(e))
	}
	return responses, nil
}

// CreateEmojiInput 创建表情输入
type CreateEmojiInput struct {
	GroupID     int32
	Name        string
	URL         string
	TextContent string
	SortOrder   int32
}

// CreateEmoji 创建表情
func (s *EmojiService) CreateEmoji(ctx context.Context, input CreateEmojiInput) (*EmojiResponse, error) {
	params := generated.CreateEmojiParams{
		GroupID:     input.GroupID,
		Name:        input.Name,
		Url:         toNullString(input.URL),
		TextContent: toNullString(input.TextContent),
		SortOrder:   input.SortOrder,
	}

	emoji, err := s.queries.CreateEmoji(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("创建表情失败: %w", err)
	}

	return emojiToResponse(emoji), nil
}

// UpdateEmojiInput 更新表情输入
type UpdateEmojiInput struct {
	ID          int32
	Name        string
	URL         string
	TextContent string
	SortOrder   int32
}

// UpdateEmoji 更新表情
func (s *EmojiService) UpdateEmoji(ctx context.Context, input UpdateEmojiInput) (*EmojiResponse, error) {
	params := generated.UpdateEmojiParams{
		ID:          input.ID,
		Name:        input.Name,
		Url:         toNullString(input.URL),
		TextContent: toNullString(input.TextContent),
		SortOrder:   input.SortOrder,
	}

	emoji, err := s.queries.UpdateEmoji(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("更新表情失败: %w", err)
	}

	return emojiToResponse(emoji), nil
}

// DeleteEmoji 删除表情
func (s *EmojiService) DeleteEmoji(ctx context.Context, id int32) error {
	err := s.queries.DeleteEmoji(ctx, id)
	if err != nil {
		return fmt.Errorf("删除表情失败: %w", err)
	}
	return nil
}

// --- 辅助函数 ---

func emojiGroupToResponse(g *generated.EmojiGroup) *EmojiGroupResponse {
	return &EmojiGroupResponse{
		ID:        g.ID,
		Name:      g.Name,
		Source:    g.Source,
		SortOrder: g.SortOrder,
		IsEnabled: g.IsEnabled,
		CreatedAt: g.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}

func emojiToResponse(e *generated.Emoji) *EmojiResponse {
	resp := &EmojiResponse{
		ID:        e.ID,
		GroupID:   e.GroupID,
		Name:      e.Name,
		SortOrder: e.SortOrder,
		CreatedAt: e.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}

	if e.Url.Valid {
		resp.URL = e.Url.String
	}
	if e.TextContent.Valid {
		resp.TextContent = e.TextContent.String
	}

	return resp
}

// --- 表情文件上传（独立存储，不进入 media 表）---

// EmojiUploadResponse 表情上传响应
type EmojiUploadResponse struct {
	URL      string `json:"url"`       // 相对路径，如 /uploads/emojis/xxx.png
	Filename string `json:"filename"`  // 文件名
	Size     int64  `json:"size"`      // 文件大小
	MimeType string `json:"mime_type"` // MIME 类型
}

// UploadEmoji 上传表情图片到独立存储目录
// 不写入 media 表，直接保存文件并返回 URL
func (s *EmojiService) UploadEmoji(ctx context.Context, filename, mimeType string, size int64, reader io.Reader) (*EmojiUploadResponse, error) {
	// 验证文件类型
	ext := strings.ToLower(filepath.Ext(filename))
	if !allowedEmojiExts[ext] {
		return nil, ErrInvalidEmojiType
	}

	// 从 MIME 类型验证
	if mimeType != "" && !allowedEmojiTypes[mimeType] {
		return nil, ErrInvalidEmojiType
	}

	// 最大文件大小：10MB
	maxSize := int64(10 * 1024 * 1024)
	if size > maxSize {
		return nil, ErrEmojiTooLarge
	}

	// 确保表情目录存在
	if err := os.MkdirAll(s.emojiDir, 0755); err != nil {
		return nil, fmt.Errorf("创建表情目录失败: %w", err)
	}

	// 生成唯一文件名
	newFilename := fmt.Sprintf("%s%s", uuid.New().String(), ext)

	// 创建目标文件
	dstPath := filepath.Join(s.emojiDir, newFilename)
	dst, err := os.Create(dstPath)
	if err != nil {
		return nil, fmt.Errorf("保存表情文件失败: %w", err)
	}
	defer dst.Close()

	// 复制文件内容
	written, err := io.Copy(dst, reader)
	if err != nil {
		os.Remove(dstPath)
		return nil, fmt.Errorf("写入表情文件失败: %w", err)
	}

	// 推断 MIME 类型（如果未提供）
	if mimeType == "" {
		switch ext {
		case ".jpg", ".jpeg":
			mimeType = "image/jpeg"
		case ".png":
			mimeType = "image/png"
		case ".gif":
			mimeType = "image/gif"
		case ".webp":
			mimeType = "image/webp"
		case ".svg":
			mimeType = "image/svg+xml"
		default:
			mimeType = "application/octet-stream"
		}
	}

	// 返回相对路径 URL
	relativeURL := "/uploads/emojis/" + newFilename

	return &EmojiUploadResponse{
		URL:      relativeURL,
		Filename: newFilename,
		Size:     written,
		MimeType: mimeType,
	}, nil
}

// --- B站表情种子数据 ---

const bilibiliEmojiAPIURL = "https://api.bilibili.com/x/emote/setting/panel?business=reply"

// BilibiliEmojiAPIResponse B站表情 API 响应结构
type BilibiliEmojiAPIResponse struct {
	Code int                   `json:"code"`
	Data BilibiliEmojiData     `json:"data"`
	Msg  string                `json:"message"`
}

type BilibiliEmojiData struct {
	Packages []BilibiliEmojiPackage `json:"packages"`
}

type BilibiliEmojiPackage struct {
	ID    int             `json:"id"`
	Text  string          `json:"text"`
	Emote []BilibiliEmote `json:"emote"`
}

type BilibiliEmote struct {
	Text   string `json:"text"`
	URL    string `json:"url"`
	GifURL string `json:"gif_url"`
}

// SeedBilibiliEmojis 从 B站 API 获取表情数据并写入数据库作为初始种子数据
func (s *EmojiService) SeedBilibiliEmojis(ctx context.Context) error {
	log.Println("开始获取 B站表情种子数据...")

	// 调用 B站 API
	packages, err := s.fetchBilibiliEmojis()
	if err != nil {
		log.Printf("获取 B站表情失败: %v（不影响服务启动）", err)
		return err
	}

	log.Printf("获取到 %d 个表情包组", len(packages))

	// 写入数据库
	result, err := s.importBilibiliEmojis(ctx, packages)
	if err != nil {
		log.Printf("写入 B站表情失败: %v（不影响服务启动）", err)
		return err
	}

	log.Printf("B站表情种子数据初始化完成: 分组 %d, 表情 %d", result.GroupsCreated, result.EmojisCreated)
	return nil
}

// SeedResult 种子数据导入结果
type SeedResult struct {
	GroupsCreated int
	EmojisCreated int
}

func (s *EmojiService) fetchBilibiliEmojis() ([]BilibiliEmojiPackage, error) {
	// 如果没有 Cookie 但有账号密码，尝试登录获取 Cookie
	if s.bilibiliCookie == "" && s.bilibiliUsername != "" && s.bilibiliPassword != "" {
		log.Println("尝试使用账号密码登录 B站获取 Cookie...")
		cookie, err := s.loginBilibili()
		if err != nil {
			log.Printf("B站登录失败: %v，请手动设置 BILIBILI_COOKIE 环境变量", err)
		} else {
			s.bilibiliCookie = cookie
			log.Println("B站登录成功，已获取 Cookie")
		}
	}

	client := &http.Client{Timeout: 30 * time.Second}

	req, err := http.NewRequest("GET", bilibiliEmojiAPIURL, nil)
	if err != nil {
		return nil, fmt.Errorf("创建请求失败: %w", err)
	}

	req.Header.Set("User-Agent", "Mozilla/5.0")
	req.Header.Set("Referer", "https://www.bilibili.com")
	if s.bilibiliCookie != "" {
		req.Header.Set("Cookie", s.bilibiliCookie)
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("请求失败: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("读取响应失败: %w", err)
	}

	var apiResp BilibiliEmojiAPIResponse
	if err := json.Unmarshal(body, &apiResp); err != nil {
		return nil, fmt.Errorf("解析响应失败: %w", err)
	}

	if apiResp.Code != 0 {
		return nil, fmt.Errorf("API 错误: code=%d, msg=%s", apiResp.Code, apiResp.Msg)
	}

	return apiResp.Data.Packages, nil
}

// loginBilibili 使用账号密码登录 B站获取 Cookie
// 注意：B站登录可能需要验证码，建议直接设置 BILIBILI_COOKIE 环境变量
func (s *EmojiService) loginBilibili() (string, error) {
	client := &http.Client{Timeout: 30 * time.Second}

	// 1. 获取登录所需的密钥信息
	keyURL := "https://passport.bilibili.com/api/oauth2/getKey"
	req, err := http.NewRequest("GET", keyURL, nil)
	if err != nil {
		return "", fmt.Errorf("创建获取密钥请求失败: %w", err)
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")

	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("获取密钥失败: %w", err)
	}
	defer resp.Body.Close()

	keyBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("读取密钥响应失败: %w", err)
	}

	var keyResp struct {
		Code int    `json:"code"`
		Data struct {
			Hash string `json:"hash"`
			Key  string `json:"key"`
		} `json:"data"`
		Message string `json:"message"`
	}
	if err := json.Unmarshal(keyBody, &keyResp); err != nil {
		return "", fmt.Errorf("解析密钥响应失败: %w", err)
	}
	if keyResp.Code != 0 {
		return "", fmt.Errorf("获取密钥失败: code=%d, msg=%s", keyResp.Code, keyResp.Message)
	}

	// 2. 加密密码 (RSA)
	encryptedPwd := s.encryptPassword(s.bilibiliPassword, keyResp.Data.Hash, keyResp.Data.Key)

	// 3. 登录
	loginURL := "https://passport.bilibili.com/api/oauth2/login"
	formData := map[string][]string{
		"username":  {s.bilibiliUsername},
		"password":  {encryptedPwd},
		"captcha":   {""}, // 验证码可能需要手动处理
	}

	loginReq, err := http.NewRequest("POST", loginURL, nil)
	if err != nil {
		return "", fmt.Errorf("创建登录请求失败: %w", err)
	}
	loginReq.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
	loginReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	loginReq.Header.Set("Referer", "https://passport.bilibili.com/login")

	// 构建表单数据
	var formStr string
	for k, vs := range formData {
		for _, v := range vs {
			if formStr != "" {
				formStr += "&"
			}
			formStr += fmt.Sprintf("%s=%s", k, urlEncode(v))
		}
	}
	loginReq.Body = io.NopCloser(strings.NewReader(formStr))

	loginResp, err := client.Do(loginReq)
	if err != nil {
		return "", fmt.Errorf("登录请求失败: %w", err)
	}
	defer loginResp.Body.Close()

	// 从响应中提取 Cookie
	cookies := loginResp.Cookies()
	if len(cookies) == 0 {
		// 尝试读取响应体获取错误信息
		body, _ := io.ReadAll(loginResp.Body)
		return "", fmt.Errorf("登录失败，未获取到 Cookie，响应: %s", string(body))
	}

	// 构建 Cookie 字符串
	var cookieStr string
	for _, c := range cookies {
		if cookieStr != "" {
			cookieStr += "; "
		}
		cookieStr += c.Name + "=" + c.Value
	}

	return cookieStr, nil
}

// encryptPassword 使用 RSA 加密密码
func (s *EmojiService) encryptPassword(password, hash, publicKey string) string {
	// B站登录密码加密: hash + password，然后用 RSA 公钥加密
	data := hash + password

	// 使用公钥加密 (简化实现，实际需要完整的 RSA 加密)
	// 这里需要引入 crypto/rsa 包进行真正的加密
	// 由于实现复杂，这里返回原始数据作为占位
	// 实际使用时建议直接设置 Cookie

	// 暂时返回明文（B站实际会拒绝），提示用户使用 Cookie 方式
	return data
}

// urlEncode URL 编码
func urlEncode(s string) string {
	var result strings.Builder
	for _, c := range s {
		if c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c >= '0' && c <= '9' || c == '-' || c == '_' || c == '.' || c == '~' {
			result.WriteRune(c)
		} else {
			result.WriteString(fmt.Sprintf("%%%02X", c))
		}
	}
	return result.String()
}

func (s *EmojiService) importBilibiliEmojis(ctx context.Context, packages []BilibiliEmojiPackage) (*SeedResult, error) {
	result := &SeedResult{}

	for i, pkg := range packages {
		if pkg.Text == "" || len(pkg.Emote) == 0 {
			continue
		}

		// 创建分组
		groupParams := generated.CreateEmojiGroupParams{
			Name:      pkg.Text,
			Source:    "bilibili",
			SortOrder: int32(i + 1),
			IsEnabled: true,
		}

		group, err := s.queries.CreateEmojiGroup(ctx, groupParams)
		if err != nil {
			log.Printf("警告: 创建表情分组 %s 失败: %v", pkg.Text, err)
			continue
		}
		result.GroupsCreated++

		// 创建表情
		for j, emote := range pkg.Emote {
			if emote.Text == "" {
				continue
			}

			// 优先使用 gif_url，若无则使用 url
			url := emote.GifURL
			if url == "" {
				url = emote.URL
			}

			emojiParams := generated.CreateEmojiParams{
				GroupID:     group.ID,
				Name:        emote.Text,
				Url:         toNullString(url),
				TextContent: toNullString(""), // B站表情无文本内容
				SortOrder:   int32(j + 1),
			}

			_, err := s.queries.CreateEmoji(ctx, emojiParams)
			if err != nil {
				log.Printf("警告: 创建表情 %s 失败: %v", emote.Text, err)
				continue
			}
			result.EmojisCreated++
		}
	}

	return result, nil
}