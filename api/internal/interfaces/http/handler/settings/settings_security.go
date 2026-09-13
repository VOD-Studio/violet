package settings

import (
	"net/http"

	"github.com/rs/zerolog/log"

	"blog-api/internal/domain/opsgrant"
	domainsettings "blog-api/internal/domain/settings"
	"blog-api/internal/domain/shared"
	interfacesmw "blog-api/internal/interfaces/http/middleware"
	"blog-api/internal/interfaces/http/response"
)

// ErrOpsGrantRequired 缺少短时运维授权。
var ErrOpsGrantRequired = shared.Forbidden("高危安全变更需要短时运维授权，请先完成二次验证")

// GetSecurity GET /admin/settings/security —— 组视图 + 待确认变更（如有）。
func (h *Handler) GetSecurity(w http.ResponseWriter, r *http.Request) {
	data, err := h.svc.GetGroup(r.Context(), domainsettings.Security)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	payload := map[string]any{"values": data.Values, "meta": data.Meta}
	if pending, ok := h.svc.PendingSecurityChange(); ok {
		payload["pending"] = pending
	}
	response.RespondOK(w, payload)
}

// RequestSecurityChange PUT /admin/settings/security —— 保存待确认变更。
// 只校验与暂存，不写数据库；未确认（或超时）自动维持上一有效配置。
func (h *Handler) RequestSecurityChange(w http.ResponseWriter, r *http.Request) {
	var req UpdateGroupRequest
	if err := decodeRequest(w, r, &req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if req.ExpectedVersion == nil || *req.ExpectedVersion < 0 {
		response.RespondError(w, r, shared.BadRequest("expected_version 必须是非负整数"))
		return
	}
	pending, err := h.svc.RequestSecurityChange(r.Context(), *req.ExpectedVersion, req.Values, interfacesmw.GetUserIDFromContext(r))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, map[string]any{"pending": pending})
}

// ConfirmSecurityChange POST /admin/settings/security/confirm —— 确认生效。
// 前置：当前会话持有 security 类别的短时运维授权；本方法在确认时刻重新
// 校验，不信任发起时的状态。请求体携带待确认变更标识，槽位被替换的旧
// 确认请求会被拒绝。授权本身不替代 settings:update 权限（路由层
// RequirePermission 已独立校验）。
func (h *Handler) ConfirmSecurityChange(w http.ResponseWriter, r *http.Request) {
	if !h.holdsSecurityGrant(r) {
		response.RespondError(w, r, ErrOpsGrantRequired)
		return
	}
	var req struct {
		PendingID string `json:"pending_id"`
	}
	if err := decodeRequest(w, r, &req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if req.PendingID == "" {
		response.RespondError(w, r, shared.BadRequest("缺少待确认变更标识"))
		return
	}
	data, err := h.svc.ConfirmSecurityChange(r.Context(), req.PendingID)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, data)
}

// CancelSecurityChange DELETE /admin/settings/security/pending —— 放弃待确认变更。
func (h *Handler) CancelSecurityChange(w http.ResponseWriter, r *http.Request) {
	if err := h.svc.CancelSecurityChange(r.Context()); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "已取消待确认的安全策略变更")
}

// holdsSecurityGrant 在确认时刻校验当前会话是否持有 security 类别授权。
// 存储故障按未持有处理（fail-closed）。
func (h *Handler) holdsSecurityGrant(r *http.Request) bool {
	if h.grants == nil {
		return false
	}
	ok, err := h.grants.Exists(r.Context(),
		interfacesmw.GetUserIDFromContext(r), interfacesmw.GetSessionIDFromContext(r),
		opsgrant.CategorySecurity)
	if err != nil {
		log.Error().Err(err).Msg("校验运维授权失败")
		return false
	}
	return ok
}

// compile-time guard: grants 端口由容器注入。
