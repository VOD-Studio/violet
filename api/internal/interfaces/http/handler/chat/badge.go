package chat

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	domainappearance "blog-api/internal/domain/chatappearance"
	"blog-api/internal/interfaces/http/response"
)

// badgeGrantDTO 徽章持有记录的对外形态;awarded_by 为空表示系统授予。
type badgeGrantDTO struct {
	BadgeID   string `json:"badge_id"`
	AwardedAt string `json:"awarded_at"`
	AwardedBy string `json:"awarded_by,omitempty"`
}

// GetMyBadges 返回当前登录用户的徽章持有记录,按授予时间升序。
func (h *Handler) GetMyBadges(w http.ResponseWriter, r *http.Request) {
	actor, err := currentUserID(r)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	w.Header().Set("Cache-Control", "private, no-store")
	if h.appearance == nil {
		appearanceError(w, r, errors.New("appearance service not configured"))
		return
	}
	grants, err := h.appearance.MyBadges(r.Context(), actor.String())
	if err != nil {
		appearanceError(w, r, err)
		return
	}
	response.RespondOK(w, badgeGrantsResponse(grants))
}

// AdminListGrants 返回指定用户的持有记录,供管理端授予对话框回显。
func (h *Handler) AdminListGrants(w http.ResponseWriter, r *http.Request) {
	if h.appearance == nil {
		appearanceError(w, r, errors.New("appearance service not configured"))
		return
	}
	userID := r.URL.Query().Get("user_id")
	if !domainappearance.ValidUserID(userID) {
		appearanceError(w, r, domainappearance.ErrInvalid)
		return
	}
	grants, err := h.appearance.GrantsOf(r.Context(), userID)
	if err != nil {
		appearanceError(w, r, err)
		return
	}
	response.RespondOK(w, badgeGrantsResponse(grants))
}

type grantBadgesRequest struct {
	UserID   string   `json:"user_id"`
	BadgeIDs []string `json:"badge_ids"`
}

// AdminGrant 批量授予徽章;已持有项静默跳过。
func (h *Handler) AdminGrant(w http.ResponseWriter, r *http.Request) {
	operator, err := currentUserID(r)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	if h.appearance == nil {
		appearanceError(w, r, errors.New("appearance service not configured"))
		return
	}
	var req grantBadgesRequest
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096))
	if dec.Decode(&req) != nil || req.UserID == "" || len(req.BadgeIDs) == 0 {
		appearanceError(w, r, domainappearance.ErrInvalid)
		return
	}
	if err = h.appearance.Grant(r.Context(), operator.String(), req.UserID, req.BadgeIDs); err != nil {
		appearanceError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "徽章已授予")
}

// AdminRevoke 撤销一枚徽章;展示侧因读取交集自动消失。
func (h *Handler) AdminRevoke(w http.ResponseWriter, r *http.Request) {
	if h.appearance == nil {
		appearanceError(w, r, errors.New("appearance service not configured"))
		return
	}
	userID := r.PathValue("userId")
	badgeID := r.PathValue("badgeId")
	if err := h.appearance.Revoke(r.Context(), userID, badgeID); err != nil {
		appearanceError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "徽章已撤销")
}

// badgeGrantsResponse 把持有记录转成对外 DTO;恒返回非 nil 数组。
func badgeGrantsResponse(grants []domainappearance.BadgeGrant) []badgeGrantDTO {
	out := make([]badgeGrantDTO, 0, len(grants))
	for _, grant := range grants {
		out = append(out, badgeGrantDTO{
			BadgeID:   grant.BadgeID,
			AwardedAt: grant.AwardedAt.Format(time.RFC3339),
			AwardedBy: grant.AwardedBy,
		})
	}
	return out
}
