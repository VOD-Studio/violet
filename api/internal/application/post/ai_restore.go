package post

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/rs/zerolog/log"
	"golang.org/x/net/html"

	"blog-api/internal/infrastructure/llm"
)

// aiRestoreTimeout LLM 反推单次调用超时（占位批量发送，30s 足够）。
const aiRestoreTimeout = 60 * time.Second

// aiPendingItem 描述一个待反推的公式占位。
type aiPendingItem struct {
	idx     int    // placeholders 中的索引
	id      int    // LLM prompt 里的序号（从 1 开始）
	formula string // formulaText
	isBlock bool
}

// restoreFormulasWithAI 用 LLM 反推无源码公式的 LaTeX，返回非致命警告列表。
//
// 流程：
//  1. collectPlaceholders 收集所有占位
//  2. 过滤出「无源码但有 formulaText」的占位（有源码的无需反推）
//  3. 批量调 LLM，返回 {id → latex} 映射
//  4. SetPlaceholderLatex 注入反推结果
//  5. finalizePlaceholders 统一替换
//
// 任一步失败都不抛错，降级为空占位，返回 warnings 提示用户。
func (s *Service) restoreFormulasWithAI(ctx context.Context, articleNode *html.Node) []string {
	placeholders := collectPlaceholders(articleNode)
	if len(placeholders) == 0 {
		return nil
	}

	// 仅反推「无源码且有 formulaText」的占位（索引到原 placeholders 的位置）
	var queue []aiPendingItem
	for i, p := range placeholders {
		if p.Latex == "" && strings.TrimSpace(p.FormulaText) != "" {
			queue = append(queue, aiPendingItem{idx: i, id: len(queue) + 1, formula: p.FormulaText, isBlock: p.IsBlock})
		}
	}
	if len(queue) == 0 {
		// 没有需要反推的，直接 finalize
		finalizePlaceholders(placeholders)
		return nil
	}

	client, err := s.getLLMClient(ctx)
	if err != nil {
		// LLM 未配置，降级
		finalizePlaceholders(placeholders)
		return []string{fmt.Sprintf("AI 还原未启用（%s），%d 个公式保留空占位", err.Error(), len(queue))}
	}

	// 构造 prompt 并调用
	userPrompt := buildAIRestorePrompt(queue)
	aiCtx, cancel := context.WithTimeout(ctx, aiRestoreTimeout)
	defer cancel()
	resp, err := client.Complete(aiCtx, llm.CompleteRequest{
		SystemPrompt: aiRestoreSystemPrompt,
		UserPrompt:   userPrompt,
	})
	if err != nil {
		log.Warn().Err(err).Msg("LLM 反推公式失败，降级为空占位")
		finalizePlaceholders(placeholders)
		return []string{fmt.Sprintf("AI 还原调用失败（%s），%d 个公式保留空占位", err.Error(), len(queue))}
	}

	// 解析 LLM 返回的 JSON 数组
	results, parseErr := parseAIRestoreResponse(resp.Content)
	if parseErr != nil {
		log.Warn().Err(parseErr).Str("raw", resp.Content).Msg("LLM 响应解析失败")
		finalizePlaceholders(placeholders)
		return []string{fmt.Sprintf("AI 还原响应解析失败，%d 个公式保留空占位", len(queue))}
	}

	// 注入反推结果
	restored := 0
	for _, p := range queue {
		if latex, ok := results[p.id]; ok && strings.TrimSpace(latex) != "" {
			SetPlaceholderLatex(&placeholders[p.idx], strings.TrimSpace(latex))
			restored++
		}
	}
	finalizePlaceholders(placeholders)

	if restored < len(queue) {
		return []string{fmt.Sprintf("AI 还原了 %d/%d 个公式，其余保留空占位", restored, len(queue))}
	}
	return nil
}

// getLLMClient 从 site_settings 构造 LLM 客户端。
// 未配置（无 key）或 store 未注入时返回错误，调用方据此降级。
func (s *Service) getLLMClient(ctx context.Context) (llm.Client, error) {
	if s.settingsStore == nil {
		return nil, fmt.Errorf("未配置 LLM")
	}
	m, err := s.settingsStore.GetAll(ctx)
	if err != nil {
		return nil, fmt.Errorf("读取站点设置失败: %w", err)
	}
	return llm.NewClientFromSettings(m)
}

// aiRestoreSystemPrompt LLM 反推公式的系统提示。
const aiRestoreSystemPrompt = `你是 LaTeX 公式还原专家。给定一组从网页 HTML 提取的公式文本快照（KaTeX 渲染节点的 textContent），
请还原成标准 LaTeX 源码。

转换规则：
- 上标字符（²³⁴等）→ ^2 ^3 ^4；下标字符（₂₃等）→ _2 _3
- 希腊字母（αβγπθλμ等）→ \alpha \beta \gamma \pi \theta \lambda \mu
- 求和 ∑ → \sum，积分 ∫ → \int，连乘 ∏ → \prod，极限 lim → \lim
- 分数、根号、矩阵等结构按上下文补全：√x → \sqrt{x}，a/b → \frac{a}{b}
- 空格和等号保持原样

只返回一个 JSON 数组，每个元素 {"id": 数字, "latex": "源码"}，不要其他文字、不要 markdown 代码块标记。
id 必须与输入的序号一一对应。`

// buildAIRestorePrompt 构造用户提示，列出所有待反推公式。
func buildAIRestorePrompt(queue []aiPendingItem) string {
	var b strings.Builder
	b.WriteString("请还原以下公式的 LaTeX 源码：\n\n")
	for _, p := range queue {
		mode := "行内"
		if p.isBlock {
			mode = "块级"
		}
		fmt.Fprintf(&b, "%d. [%s] %s\n", p.id, mode, p.formula)
	}
	return b.String()
}

// parseAIRestoreResponse 解析 LLM 返回的 JSON 数组，兼容被 markdown 代码块包裹的情况。
func parseAIRestoreResponse(raw string) (map[int]string, error) {
	content := strings.TrimSpace(raw)
	// 兼容 ```json ... ``` 包裹
	if strings.HasPrefix(content, "```") {
		// 去掉首行 ```json 与末尾 ```
		lines := strings.Split(content, "\n")
		if len(lines) >= 3 {
			content = strings.Join(lines[1:len(lines)-1], "\n")
		}
	}
	// 截取第一个 [ 到最后一个 ]（防止 LLM 加前后废话）
	start := strings.Index(content, "[")
	end := strings.LastIndex(content, "]")
	if start < 0 || end < 0 || end <= start {
		return nil, fmt.Errorf("响应未找到 JSON 数组")
	}
	content = content[start : end+1]

	var items []struct {
		ID    int    `json:"id"`
		Latex string `json:"latex"`
	}
	if err := json.Unmarshal([]byte(content), &items); err != nil {
		return nil, fmt.Errorf("解析 JSON 失败: %w", err)
	}
	result := make(map[int]string, len(items))
	for _, it := range items {
		result[it.ID] = it.Latex
	}
	return result, nil
}
