// Package friendlink 提供友链模块的 HTTP handler。
package friendlink

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"github.com/go-playground/validator/v10"
	"net/http"
	appfriendlink "blog-api/internal/application/friendlink"
	"blog-api/internal/domain/shared"
	domainuser "blog-api/internal/domain/user"
	ifmw "blog-api/internal/interfaces/http/middleware"
	mw "blog-api/internal/middleware"
	"blog-api/internal/interfaces/http/response"
)

// friendlinkService handler 层依赖的 application service 接口视图。
//
// 独立定义而非直接用 *appfriendlink.Service：让 handler 测试可注入 stub，
// 避免启动完整 service + 真实 repo/codeStore。*appfriendlink.Service 通过
// Go 结构化接口天然满足此契约。
type friendlinkService interface {
	ListPublic(ctx context.Context) ([]appfriendlink.FriendLinkDTO, error)
	Apply(ctx context.Context, in appfriendlink.ApplyInput) (appfriendlink.FriendLinkDTO, error)
	SendCode(ctx context.Context, in appfriendlink.SendCodeInput) error

	ListByStatus(ctx context.Context, status string, page, limit int) ([]appfriendlink.FriendLinkAdminDTO, int64, error)
	CountPending(ctx context.Context) (int64, error)
	CreateManual(ctx context.Context, in appfriendlink.ManualInput) (appfriendlink.FriendLinkAdminDTO, error)
	Update(ctx context.Context, id string, in appfriendlink.ManualInput) (appfriendlink.FriendLinkAdminDTO, error)
	Approve(ctx context.Context, id string) error
	Reject(ctx context.Context, id string) error
	Disable(ctx context.Context, id string) error
	Restore(ctx context.Context, id string) error
	Delete(ctx context.Context, id string) error
}

// Handler 友链 HTTP 处理器。
type Handler struct {
	svc      friendlinkService
	users    domainuser.UserRepository // 登录态取联系邮箱（防伪造：覆盖请求体 contact_email）
	validate *validator.Validate
}

// NewHandler 创建友链 handler。
//
// users 可为 nil（确认不需要登录申请路径时；正常流程应注入以支持双轨防伪造）。
func NewHandler(svc *appfriendlink.Service, users domainuser.UserRepository) *Handler {
	return &Handler{svc: svc, users: users, validate: validator.New()}
}

// ListPublic 前台公开友链列表（GET /friend-links，仅 approved）。
func (h *Handler) ListPublic(w http.ResponseWriter, r *http.Request) {
	items, err := h.svc.ListPublic(r.Context())
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, items)
}

// applyRequest 申请友链的请求体（双轨认证：登录/匿名字段混在同一结构）。
//
// 字段消费规则（见 Handler.Apply）：
//   - 登录态：忽略 ContactEmail，由 handler 从 user 资料覆盖（防伪造）；忽略 Code
//   - 匿名态：ContactEmail 必填 + Code 必填（邮箱验证码）
type applyRequest struct {
	Name         string `json:"name"         validate:"required"`
	URL          string `json:"url"          validate:"required"`
	AvatarURL    string `json:"avatar_url"`
	Description  string `json:"description"`
	OwnerName    string `json:"owner_name"`
	LinkbackURL  string `json:"linkback_url"`

	// ContactEmail 联系邮箱；登录态由 handler 从 user 资料覆盖（防伪造）；
	// 匿名态手填必填。service 层会再做归一化。
	ContactEmail string `json:"contact_email"`
	// Code 匿名必填：邮箱验证码（来自 /friend-links/code）。登录态忽略。
	Code string `json:"code"`
}

// Apply 申请友链（POST /friend-links，双轨认证）。
//
// 双轨认证（PRD-0014）：
//   - 登录（会话有 userID）：跳过验证码；contact_email 从 user 资料填充，忽略请求体
//   - 匿名：必须 contact_email + 邮箱验证码 code
//
// ip_hash 一律由 handler 从 middleware.GetClientIP + SHA256 计算填充。
func (h *Handler) Apply(w http.ResponseWriter, r *http.Request) {
	var req applyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.validate.Struct(req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	userID := ifmw.GetUserIDFromContext(r)
	ipHash := hashIP(mw.GetClientIP(r))

	in := appfriendlink.ApplyInput{
		Name: req.Name, URL: req.URL, AvatarURL: req.AvatarURL,
		Description: req.Description, OwnerName: req.OwnerName,
		LinkbackURL: req.LinkbackURL, Code: req.Code, IPHash: ipHash,
	}

	if userID != "" {
		// 登录路径：从 user 资料填 contact_email，忽略请求体里的对应字段（防伪造）。
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
			in.ContactEmail = u.Email().String()
		}
		in.UserID = userID
	} else {
		// 匿名路径：必须手填 contact_email。
		if req.ContactEmail == "" {
			response.RespondError(w, r, shared.BadRequest("联系邮箱不能为空"))
			return
		}
		in.ContactEmail = req.ContactEmail
	}

	dto, err := h.svc.Apply(r.Context(), in)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondCreated(w, dto)
}

// sendCodeRequest 匿名友链申请发码请求体（仅 email 一项）。
type sendCodeRequest struct {
	Email string `json:"email" validate:"required,email"`
}

// SendCode 匿名友链申请第一步：发送邮箱验证码（POST /friend-links/code）。
//
// 仅匿名申请需要；登录用户不调用此端点。挂独立限流 FriendLinkCodeRateLimit 防邮件轰炸。
func (h *Handler) SendCode(w http.ResponseWriter, r *http.Request) {
	var req sendCodeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.validate.Struct(req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.svc.SendCode(r.Context(), appfriendlink.SendCodeInput{Email: req.Email}); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "验证码已发送")
}

// ============================================================
// 后台管理 handler（routing 层挂 RequirePermission("friendlink:view"/"friendlink:manage")）
// ============================================================

// ListByStatus 后台友链列表（按状态筛选，分页）。
//
// status query param 控制状态筛选；空串 = 全部。friendlink:view 权限。
func (h *Handler) ListByStatus(w http.ResponseWriter, r *http.Request) {
	page, limit := response.ParsePaging(r)
	status := r.URL.Query().Get("status")
	items, total, err := h.svc.ListByStatus(r.Context(), status, page, limit)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondPaged(w, items, page, limit, total)
}

// CountPending 统计待审核友链数量（后台角标，friendlink:view 权限）。
func (h *Handler) CountPending(w http.ResponseWriter, r *http.Request) {
	count, err := h.svc.CountPending(r.Context())
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, map[string]any{"count": count})
}

// manualRequest 手动添加 / 编辑友链的请求体（friendlink:manage 权限）。
type manualRequest struct {
	Name         string `json:"name"        validate:"required"`
	URL          string `json:"url"         validate:"required"`
	AvatarURL    string `json:"avatar_url"`
	Description  string `json:"description"`
	OwnerName    string `json:"owner_name"`
	LinkbackURL  string `json:"linkback_url"`
	ContactEmail string `json:"contact_email"`
	SortOrder    int    `json:"sort_order"`
}

func (m manualRequest) toInput() appfriendlink.ManualInput {
	return appfriendlink.ManualInput{
		Name: m.Name, URL: m.URL, AvatarURL: m.AvatarURL,
		Description: m.Description, OwnerName: m.OwnerName,
		LinkbackURL: m.LinkbackURL, ContactEmail: m.ContactEmail, SortOrder: m.SortOrder,
	}
}

// CreateManual 手动添加友链（POST /admin/friend-links，friendlink:manage 权限）。
//
// 站长手动添加：直接 approved，无验证码/配额/IPHash。URL 占用由 service + DB 索引兜底。
func (h *Handler) CreateManual(w http.ResponseWriter, r *http.Request) {
	var req manualRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.validate.Struct(req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	dto, err := h.svc.CreateManual(r.Context(), req.toInput())
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondCreated(w, dto)
}

// Update 后台编辑友链（PATCH /admin/friend-links/{id}，friendlink:manage 权限）。
func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req manualRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.validate.Struct(req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	dto, err := h.svc.Update(r.Context(), id, req.toInput())
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, dto)
}

// Approve 批准申请（POST /admin/friend-links/{id}/approve）。
func (h *Handler) Approve(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.svc.Approve(r.Context(), id); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "友链已审核通过")
}

// Reject 拒绝申请（POST /admin/friend-links/{id}/reject）。
func (h *Handler) Reject(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.svc.Reject(r.Context(), id); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "友链已拒绝")
}

// Disable 下柜（POST /admin/friend-links/{id}/disable）。
func (h *Handler) Disable(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.svc.Disable(r.Context(), id); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "友链已下柜")
}

// Restore 恢复（POST /admin/friend-links/{id}/restore）。
func (h *Handler) Restore(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.svc.Restore(r.Context(), id); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "友链已恢复展示")
}

// Delete 物理删除（DELETE /admin/friend-links/{id}）。
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.svc.Delete(r.Context(), id); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "友链已删除")
}

// hashIP 把客户端 IP 转成 SHA256 hex（与评论域一致：单向 hash 兼顾反垃圾与隐私）。
func hashIP(ip string) string {
	if ip == "" {
		return ""
	}
	sum := sha256.Sum256([]byte(ip))
	return hex.EncodeToString(sum[:])
}
