package mcp

import (
	"context"
	"fmt"
	"strings"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	appnote "blog-api/internal/application/note"
	apptag "blog-api/internal/application/tag"
	domainapitoken "blog-api/internal/domain/api_token"
	domainnote "blog-api/internal/domain/note"
)

// NoteWritingService 笔记 MCP tool 依赖的服务端口。
// application/note.Service 实现之；抽接口便于单测 fake 替换（与 CommentTools 同 seam 模式）。
type NoteWritingService interface {
	Create(ctx context.Context, in appnote.CreateInput) (appnote.NoteDTO, error)
	Update(ctx context.Context, in appnote.UpdateInput) (appnote.NoteDTO, error)
	Get(ctx context.Context, noteID string) (appnote.NoteDTO, error)
	List(ctx context.Context, query appnote.ListQuery) ([]appnote.NoteSummaryDTO, int64, error)
	Publish(ctx context.Context, noteID string) (appnote.NoteDTO, error)
	Delete(ctx context.Context, noteID string) error
}

// TagEnsureService 标签幂等创建端口；application/tag.Service 实现之。
type TagEnsureService interface {
	CreateOrGet(ctx context.Context, name string) (apptag.TagDTO, error)
}

// NoteTools 笔记 tool 集合，挂在 violet-notes server（/api/v1/mcp/notes）。
// AI 会话沉淀的运输层：AuthorID 一律取 PAT 持有人，不接受调用方指定。
type NoteTools struct {
	notes NoteWritingService
	tags  TagEnsureService
}

func NewNoteTools(notes NoteWritingService, tags TagEnsureService) *NoteTools {
	return &NoteTools{notes: notes, tags: tags}
}

// --- tool 参数结构（jsonschema 由结构体 tag 推导） ---

type createNoteArgs struct {
	Title     string   `json:"title,omitempty" jsonschema:"标题，可空；空则展示层以正文开头兜底，最多 120 字符"`
	ContentMD string   `json:"content_md" jsonschema:"正文 Markdown 源；content_html 由服务端渲染"`
	Tags      []string `json:"tags,omitempty" jsonschema:"标签名列表，最多 8 个；不存在的标签自动创建"`
	Status    string   `json:"status,omitempty" jsonschema:"入库状态：draft（默认，只需 notes:write）或 published（需额外 notes:publish——仅在用户明确裁定直发时使用）"`
}

type updateNoteArgs struct {
	ID        string   `json:"id" jsonschema:"笔记 ID"`
	ContentMD string   `json:"content_md" jsonschema:"新正文 Markdown 源（必填，全量替换）"`
	Title     string   `json:"title,omitempty" jsonschema:"新标题；空串表示清除标题"`
	Tags      []string `json:"tags,omitempty" jsonschema:"新标签列表（全量替换）；不存在的自动创建，空数组表示清除"`
}

type deleteNoteArgs struct {
	ID string `json:"id" jsonschema:"笔记 ID"`
}

type listNotesArgs struct {
	Status string `json:"status,omitempty" jsonschema:"状态筛选：draft / published，空为全部（默认含草稿）"`
	Page   int    `json:"page,omitempty" jsonschema:"页码，从 1 开始（默认 1）"`
	Limit  int    `json:"limit,omitempty" jsonschema:"每页条数（默认 20，上限 100）"`
}

type getNoteArgs struct {
	ID string `json:"id" jsonschema:"笔记 ID"`
}

// ensureTags 幂等创建标签：与文章侧「先 create_tag 再 create_post」不同，
// 笔记是 AI 高频自动写入，标签放行自动创建（CreateOrGet），减少两跳。
func (t *NoteTools) ensureTags(ctx context.Context, names []string) error {
	for _, name := range names {
		name = strings.TrimSpace(name)
		if name == "" {
			continue
		}
		if _, err := t.tags.CreateOrGet(ctx, name); err != nil {
			return fmt.Errorf("创建标签 %q 失败: %w", name, err)
		}
	}
	return nil
}

// CreateNote 建笔记（需 notes:write；status=published 额外需 notes:publish）。
// 直发的安全语义：published 是唯一需要人工点击授权的动作，scope 即授权凭据。
func (t *NoteTools) CreateNote(ctx context.Context, req *mcp.CallToolRequest, args createNoteArgs) (*mcp.CallToolResult, any, error) {
	if err := requireScope(req, domainapitoken.ScopeNotesWrite); err != nil {
		return errResult(err), nil, nil
	}
	status := strings.TrimSpace(args.Status)
	if status == "" {
		status = domainnote.StatusDraft
	}
	if status != domainnote.StatusDraft && status != domainnote.StatusPublished {
		return errResult(fmt.Errorf("status 必须是 draft 或 published，收到 %q", status)), nil, nil
	}
	if err := requireScopeIf(req, status == domainnote.StatusPublished, domainapitoken.ScopeNotesPublish); err != nil {
		return errResult(err), nil, nil
	}
	userID := operatorUserID(req)
	if userID == "" {
		return errResult(fmt.Errorf("未认证：缺少访问令牌")), nil, nil
	}
	if err := t.ensureTags(ctx, args.Tags); err != nil {
		return errResult(err), nil, nil
	}
	dto, err := t.notes.Create(ctx, appnote.CreateInput{
		UserID: userID, Title: args.Title, ContentMD: args.ContentMD, Tags: args.Tags,
	})
	if err != nil {
		return errResult(err), nil, nil
	}
	if status == domainnote.StatusPublished {
		if dto, err = t.notes.Publish(ctx, dto.ID); err != nil {
			return errResult(fmt.Errorf("笔记已存为草稿但发布失败: %w", err)), nil, nil
		}
	}
	return okResult(dto), nil, nil
}

// UpdateNote 全量替换可编辑内容（需 notes:write）。状态与发布时间不变。
func (t *NoteTools) UpdateNote(ctx context.Context, req *mcp.CallToolRequest, args updateNoteArgs) (*mcp.CallToolResult, any, error) {
	if err := requireScope(req, domainapitoken.ScopeNotesWrite); err != nil {
		return errResult(err), nil, nil
	}
	if strings.TrimSpace(args.ContentMD) == "" {
		return errResult(fmt.Errorf("content_md 不能为空：更新是全量替换语义")), nil, nil
	}
	if err := t.ensureTags(ctx, args.Tags); err != nil {
		return errResult(err), nil, nil
	}
	dto, err := t.notes.Update(ctx, appnote.UpdateInput{
		NoteID: args.ID, Title: args.Title, ContentMD: args.ContentMD, Tags: args.Tags,
	})
	if err != nil {
		return errResult(err), nil, nil
	}
	return okResult(dto), nil, nil
}

// DeleteNote 删除笔记（需 notes:write）。物理删除，note_tags 级联清理。
func (t *NoteTools) DeleteNote(ctx context.Context, req *mcp.CallToolRequest, args deleteNoteArgs) (*mcp.CallToolResult, any, error) {
	if err := requireScope(req, domainapitoken.ScopeNotesWrite); err != nil {
		return errResult(err), nil, nil
	}
	if err := t.notes.Delete(ctx, args.ID); err != nil {
		return errResult(err), nil, nil
	}
	return okResult(map[string]string{"deleted": args.ID}), nil, nil
}

// ListNotes 列 PAT 持有人自己的笔记（需 notes:read），含草稿——沉淀前查重用。
func (t *NoteTools) ListNotes(ctx context.Context, req *mcp.CallToolRequest, args listNotesArgs) (*mcp.CallToolResult, any, error) {
	if err := requireScope(req, domainapitoken.ScopeNotesRead); err != nil {
		return errResult(err), nil, nil
	}
	items, total, err := t.notes.List(ctx, appnote.ListQuery{
		Author: operatorUserID(req),
		Status: strings.TrimSpace(args.Status),
		Page:   args.Page,
		Limit:  args.Limit,
	})
	if err != nil {
		return errResult(err), nil, nil
	}
	return okResult(map[string]any{"notes": items, "total": total}), nil, nil
}

// GetNote 读自己的单条笔记（需 notes:read），含草稿与 Markdown 源。
func (t *NoteTools) GetNote(ctx context.Context, req *mcp.CallToolRequest, args getNoteArgs) (*mcp.CallToolResult, any, error) {
	if err := requireScope(req, domainapitoken.ScopeNotesRead); err != nil {
		return errResult(err), nil, nil
	}
	dto, err := t.notes.Get(ctx, args.ID)
	if err != nil {
		return errResult(err), nil, nil
	}
	return okResult(dto), nil, nil
}

// NewNotesServer 构造笔记 MCP 服务器（/api/v1/mcp/notes），注册 5 个 tool。
// 笔记是独立 bounded context（AI 会话沉淀），不挂 violet-posts。
func NewNotesServer(tools *NoteTools) *mcp.Server {
	s := mcp.NewServer(NotesServerMeta, &mcp.ServerOptions{
		Instructions: notesInstructions,
	})

	mcp.AddTool(s, &mcp.Tool{
		Name: "create_note",
		Description: "创建知识笔记（markdown + 标签，标题可选）。默认入草稿；仅当用户一键裁定「直接发布」时传 status=published（需额外 notes:publish）。" +
			"标签不存在的自动创建。返回完整笔记 DTO。需 notes:write。",
	}, tools.CreateNote)

	mcp.AddTool(s, &mcp.Tool{
		Name: "update_note",
		Description: "全量替换笔记的标题/正文/标签（content_md 必填）；状态与发布时间不变。" +
			"对同主题知识点的补充应优先 update_note 而非重复 create_note。需 notes:write。",
	}, tools.UpdateNote)

	mcp.AddTool(s, &mcp.Tool{
		Name:        "delete_note",
		Description: "物理删除笔记（不可恢复）。需 notes:write。",
	}, tools.DeleteNote)

	mcp.AddTool(s, &mcp.Tool{
		Name:        "list_notes",
		Description: "列出自己的笔记（含草稿），可按状态筛选。沉淀前先查重：同主题已有时用 update_note 补充。需 notes:read。",
	}, tools.ListNotes)

	mcp.AddTool(s, &mcp.Tool{
		Name:        "get_note",
		Description: "读取自己的单条笔记，含草稿与 Markdown 源。需 notes:read。",
	}, tools.GetNote)

	return s
}
