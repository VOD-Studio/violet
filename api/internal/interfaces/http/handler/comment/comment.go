// Package comment 提供 comment 模块的 HTTP handler。
package comment

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"

	"github.com/go-playground/validator/v10"

	appcomment "blog-api/internal/application/comment"
	"blog-api/internal/domain/shared"
	domainpost "blog-api/internal/domain/post"
	domainuser "blog-api/internal/domain/user"
	interfacesmw "blog-api/internal/interfaces/http/middleware"
	"blog-api/internal/interfaces/http/response"
	"blog-api/internal/middleware"
)

// commentService handler 层依赖的 application service 接口视图。
//
// 之所以独立定义而非直接用 *appcomment.Service 具体类型：让 handler 测试可以注入
// stub 实现（见 comment_test.go 的 stubCommentService），避免在测试里启动完整 service +
// 真实 repo/codeStore。*appcomment.Service 通过 Go 结构化接口天然满足此契约。
type commentService interface {
	ListByPost(ctx context.Context, postID, viewerUserID, postAuthorID string, page, limit int) ([]appcomment.CommentDTO, int64, error)
	Create(ctx context.Context, in appcomment.CreateInput) (appcomment.CommentDTO, error)
	SendCode(ctx context.Context, in appcomment.SendCodeInput) error
	ListPending(ctx context.Context, page, limit int) ([]appcomment.CommentDTO, int64, error)
	ListAll(ctx context.Context, status string, page, limit int) ([]appcomment.AdminCommentDTO, int64, error)
	CountPending(ctx context.Context) (int64, error)
	GetDetail(ctx context.Context, id string) (appcomment.AdminCommentDTO, error)
	BatchUpdateStatus(ctx context.Context, ids []string, status string) (int64, error)
	Approve(ctx context.Context, id string) error
	MarkSpam(ctx context.Context, id string) error
	Delete(ctx context.Context, id string) error
}

// Handler 评论 HTTP 处理器。
type Handler struct {
	svc      commentService            // application 层用例服务
	users    domainuser.UserRepository // 取登录评论者的资料（username/avatar）填充 author_*；匿名评论不查
	posts    domainpost.PostRepository // 取文章 author_id 用于计算 CommentDTO.is_author（作者高亮）
	validate *validator.Validate       // 请求体字段校验（go-playground/validator）
}

// NewHandler 创建评论 handler。
//
// users/posts 可为 nil（仅当确信不需要登录评论资料/作者高亮时；正常流程应注入）。
func NewHandler(svc *appcomment.Service, users domainuser.UserRepository, posts domainpost.PostRepository) *Handler {
	return &Handler{svc: svc, users: users, posts: posts, validate: validator.New()}
}

// ListByPost 按文章列出评论（前台公开）。
//
// 黑洞模式：匿名 viewer（无会话）→ service 返回空数组；
// 登录 viewer → service 返回 approved ∪ 自己 pending。
func (h *Handler) ListByPost(w http.ResponseWriter, r *http.Request) {
	postID := r.PathValue("postId")
	viewerID := interfacesmw.GetUserIDFromContext(r)
	page, limit := response.ParsePaging(r)

	// 查 post 拿 author_id，用于 service 计算 CommentDTO.is_author（作者高亮）。
	// 查询失败时留空，is_author 恒为 false（不阻塞评论列表）。
	var authorID string
	if h.posts != nil {
		pid, err := shared.ParseID(postID)
		if err == nil {
			if p, err := h.posts.FindByID(r.Context(), pid); err == nil {
				authorID = p.AuthorID().String()
			}
		}
	}

	items, total, err := h.svc.ListByPost(r.Context(), postID, viewerID, authorID, page, limit)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondPaged(w, items, page, limit, total)
}

// ListPending 列出待审核评论（后台）
func (h *Handler) ListPending(w http.ResponseWriter, r *http.Request) {
	page, limit := response.ParsePaging(r)
	items, total, err := h.svc.ListPending(r.Context(), page, limit)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondPaged(w, items, page, limit, total)
}

// ListAll 全局评论列表（后台管理，支持状态筛选）
func (h *Handler) ListAll(w http.ResponseWriter, r *http.Request) {
	page, limit := response.ParsePaging(r)
	status := r.URL.Query().Get("status")
	items, total, err := h.svc.ListAll(r.Context(), status, page, limit)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondPaged(w, items, page, limit, total)
}

// CountPending 统计待审核评论数量（后台角标）
func (h *Handler) CountPending(w http.ResponseWriter, r *http.Request) {
	count, err := h.svc.CountPending(r.Context())
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, map[string]any{"count": count})
}

// GetDetail 获取评论详情（后台管理，含所属文章）
func (h *Handler) GetDetail(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	dto, err := h.svc.GetDetail(r.Context(), id)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, dto)
}

type batchUpdateStatusRequest struct {
	IDs    []string `json:"ids" validate:"required,min=1,max=100"`
	Status string   `json:"status" validate:"required,oneof=pending approved spam deleted"`
}

// BatchUpdateStatus 批量更新评论状态
func (h *Handler) BatchUpdateStatus(w http.ResponseWriter, r *http.Request) {
	var req batchUpdateStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.validate.Struct(req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	affected, err := h.svc.BatchUpdateStatus(r.Context(), req.IDs, req.Status)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, map[string]any{"affected": affected})
}

// createCommentRequest 创建评论的请求体（双轨认证：登录/匿名字段混在同一结构）。
//
// 字段消费规则（见 Handler.Create）：
//   - 登录态：忽略 AuthorName/AuthorEmail/AuthorURL/AvatarURL，从 user 资料填充；忽略 Code
//   - 匿名态：AuthorName/AuthorEmail 必填，Code 必填（邮箱验证码）
//   - Anchor 非空时强制登录（匿名带 anchor → 401）
type createCommentRequest struct {
	Body     string `json:"body" validate:"required"` // 评论正文（纯文本）
	ParentID string `json:"parent_id"`                // 父评论 id；非空表示嵌套回复

	// 以下四项仅匿名评论消费；登录态由 handler 从 user 资料覆盖（防伪造）。
	AuthorName  string `json:"author_name"  validate:"omitempty"`           // 匿名必填（handler 层校验，非 validator）
	AuthorEmail string `json:"author_email" validate:"omitempty,email"`     // 匿名必填；email 格式校验
	AuthorURL   string `json:"author_url"`                                // 可选个人站点
	AvatarURL   string `json:"avatar_url"`                                // 可选头像 URL

	Code     string                      `json:"code"`     // 匿名必填：邮箱验证码（来自 /comments/code）
	Anchor   *appcomment.AnchorInput     `json:"anchor"`   // 选区批注锚点；非空强制登录
	Pictures []appcomment.PictureInput   `json:"pictures"` // 评论附图（可选，Bilibili 式）
}

// Create 创建评论（前台公开，双轨认证）。
//
// 双轨认证（PRD-0001）：
//   - 登录（会话有 userID）：跳过验证码/配额，author_* 从 user 资料填充
//   - 匿名：必须 author_name + author_email + 邮箱验证码 code；走一篇一次配额
//   - 带 anchor（选区批注）：强制登录，否则 401
//
// ip_hash 一律由 handler 从 middleware.GetClientIP + SHA256 计算填充。
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	postID := r.PathValue("postId")
	var req createCommentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.validate.Struct(req); err != nil {
		response.RespondError(w, r, err)
		return
	}

	userID := interfacesmw.GetUserIDFromContext(r)
	ipHash := hashIP(middleware.GetClientIP(r))

	in := appcomment.CreateInput{
		PostID: postID, ParentID: req.ParentID,
		Body: req.Body, Code: req.Code,
		Anchor:   req.Anchor.ToDomain(),
		Pictures: appcomment.PicturesToDomain(req.Pictures),
		IPHash:   ipHash, UserAgent: r.UserAgent(),
	}

	if userID != "" {
		// 登录路径：从 user 资料填 author_*，忽略请求体里的对应字段（防伪造）。
		uid, err := shared.ParseID(userID)
		if err != nil {
			response.RespondError(w, r, err)
			return
		}
		if h.users != nil {
			u, err := h.users.FindByID(r.Context(), uid)
			if err != nil {
				response.RespondError(w, r, err)
				return
			}
			in.AuthorName = u.Username().String()
			in.AuthorEmail = u.Email().String()
			in.AvatarURL = u.AvatarURL()
		}
		in.UserID = userID
	} else {
		// 匿名路径：必须手填 author_name + author_email。
		if req.AuthorName == "" || req.AuthorEmail == "" {
			response.RespondError(w, r, shared.BadRequest("昵称和邮箱不能为空"))
			return
		}
		in.AuthorName = req.AuthorName
		in.AuthorEmail = req.AuthorEmail
		in.AuthorURL = req.AuthorURL
		in.AvatarURL = req.AvatarURL
	}

	// 批注强制登录：anchor 非空 + 匿名 → 401。
	// （domain.NewComment 也会做这层校验，但提前在 handler 返回更精确的 HTTP 语义。）
	if in.Anchor != nil && userID == "" {
		response.RespondError(w, r, shared.Unauthorized("划线批注需要登录"))
		return
	}

	dto, err := h.svc.Create(r.Context(), in)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondCreated(w, dto)
}

// sendCodeRequest 匿名评论发码请求体（仅 email 一项）。
type sendCodeRequest struct {
	Email string `json:"email" validate:"required,email"` // 接收验证码的邮箱
}

// SendCode 匿名评论第一步：发送邮箱验证码（前台公开）。
//
// 仅匿名评论需要；登录用户不调用此端点。挂独立限流 CommentCodeRateLimit 防邮件轰炸。
func (h *Handler) SendCode(w http.ResponseWriter, r *http.Request) {
	postID := r.PathValue("postId")
	var req sendCodeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.validate.Struct(req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.svc.SendCode(r.Context(), appcomment.SendCodeInput{
		PostID: postID, Email: req.Email,
	}); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "验证码已发送")
}

// hashIP 把客户端 IP 转成 SHA256 hex（即 comments.ip_hash 列存的值）。
//
// 为什么不存明文 IP：兼顾反垃圾/配额识别与隐私（IP 属于个人信息）。
// 为什么用 SHA256 而非可逆加密：配额只需要判断「同一身份」，不需要还原 IP；
// 单向 hash 足够且泄露风险更低。
func hashIP(ip string) string {
	if ip == "" {
		return ""
	}
	sum := sha256.Sum256([]byte(ip))
	return hex.EncodeToString(sum[:])
}

// Approve 审核通过
func (h *Handler) Approve(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.svc.Approve(r.Context(), id); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "评论已审核通过")
}

// MarkSpam 标记垃圾
func (h *Handler) MarkSpam(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.svc.MarkSpam(r.Context(), id); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "评论已标记为垃圾")
}

// Delete 删除评论
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.svc.Delete(r.Context(), id); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "评论已删除")
}
