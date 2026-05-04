// Package service 提供业务逻辑层，封装数据访问和业务规则
package service

import (
	"bytes"
	"fmt"
	"regexp"

	"github.com/yuin/goldmark"

	"blog-api/internal/repository/generated"
)

// EmojiCache 表情缓存接口
type EmojiCache interface {
	Get(name string) *EmojiInfo
	GetAll() map[string]*EmojiInfo
}

// EmojiInfo 表情信息
type EmojiInfo struct {
	Name        string
	URL         string
	TextContent string
	GroupName   string
	GroupSource string
}

// EmojiRenderer 表情渲染器
type EmojiRenderer struct {
	markdown     goldmark.Markdown
	emojiCache   EmojiCache
	emojiRegex   *regexp.Regexp
}

// NewEmojiRenderer 创建表情渲染器
func NewEmojiRenderer(emojiCache EmojiCache) *EmojiRenderer {
	return &EmojiRenderer{
		markdown:   goldmark.New(),
		emojiCache: emojiCache,
		emojiRegex: regexp.MustCompile(`\[([^\[\]]+)\]`),
	}
}

// Render 渲染 Markdown，处理表情 shortcode
func (r *EmojiRenderer) Render(md string) (string, error) {
	// 1. 替换表情 shortcode
	md = r.replaceEmojis(md)

	// 2. 使用 goldmark 渲染 Markdown
	var buf bytes.Buffer
	if err := r.markdown.Convert([]byte(md), &buf); err != nil {
		return "", err
	}

	return buf.String(), nil
}

// replaceEmojis 替换表情 shortcode 为图片或文本
func (r *EmojiRenderer) replaceEmojis(md string) string {
	return r.emojiRegex.ReplaceAllStringFunc(md, func(match string) string {
		// 提取表情名称（去掉两边的方括号）
		name := match[1:len(match)-1]

		if r.emojiCache != nil {
			emoji := r.emojiCache.Get(name)
			if emoji != nil {
				return formatEmoji(emoji)
			}
		}

		// 找不到表情，保留原文
		return match
	})
}

// formatEmoji 根据表情类型生成 HTML 或纯文本
func formatEmoji(emoji *EmojiInfo) string {
	// 图片类表情：生成 img 标签
	if emoji.URL != "" {
		return fmt.Sprintf(`<img src="%s" alt="%s" class="emoji-in-comment" loading="lazy" />`,
			emoji.URL, emoji.Name)
	}

	// 文本类表情（颜文字）：直接返回文本
	if emoji.TextContent != "" {
		return emoji.TextContent
	}

	// 如果既没有图片也没有文本，返回名称
	return fmt.Sprintf("[%s]", emoji.Name)
}

// SimpleEmojiCache 简单的表情缓存实现
type SimpleEmojiCache struct {
	emojis map[string]*EmojiInfo // key: emoji name
}

// NewSimpleEmojiCache 创建简单缓存
func NewSimpleEmojiCache(emojis []*generated.ListAllEmojisWithGroupRow) *SimpleEmojiCache {
	cache := &SimpleEmojiCache{
		emojis: make(map[string]*EmojiInfo),
	}

	for _, e := range emojis {
		cache.emojis[e.Name] = &EmojiInfo{
			Name:        e.Name,
			URL:         nullStringValue(e.Url),
			TextContent: nullStringValue(e.TextContent),
			GroupName:   e.GroupName,
			GroupSource: e.GroupSource,
		}
	}

	return cache
}

// Get 获取表情信息
func (c *SimpleEmojiCache) Get(name string) *EmojiInfo {
	return c.emojis[name]
}

// GetAll 获取所有表情
func (c *SimpleEmojiCache) GetAll() map[string]*EmojiInfo {
	return c.emojis
}