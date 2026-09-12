// Package settings adapts versioned settings use cases to HTTP.
package settings

import (
	"encoding/json"
	"io"
	"net/http"

	authcmd "blog-api/internal/application/auth/command"
	appsettings "blog-api/internal/application/settings"
	domainsettings "blog-api/internal/domain/settings"
	"blog-api/internal/domain/shared"
	"blog-api/internal/interfaces/http/response"
)

type Handler struct {
	svc     *appsettings.Service
	creds   *authcmd.OAuthCredentials
	startup appsettings.StartupReader
}

func NewHandler(svc *appsettings.Service, creds *authcmd.OAuthCredentials, startup appsettings.StartupReader) *Handler {
	return &Handler{svc: svc, creds: creds, startup: startup}
}

func (h *Handler) GetPublicSettings(w http.ResponseWriter, r *http.Request) {
	data, err := h.svc.GetPublic(r.Context())
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	data["google_client_id"] = h.creds.GoogleClientID()
	data["github_client_id"] = h.creds.GithubClientID()
	response.RespondOK(w, data)
}

func (h *Handler) GetStartup(w http.ResponseWriter, r *http.Request) {
	response.RespondOK(w, h.startup.Snapshot())
}

type UpdateGroupRequest struct {
	ExpectedVersion *int64                     `json:"expected_version"` // Required; zero is the initial version.
	Values          map[string]json.RawMessage `json:"values"`           // Omitted keys preserve; null is rejected.
}

type ResetGroupRequest struct {
	ExpectedVersion *int64 `json:"expected_version"`
}

func decodeRequest(w http.ResponseWriter, r *http.Request, target any) error {
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return shared.BadRequest("请求格式错误：" + err.Error())
	}
	if err := decoder.Decode(new(any)); err != io.EOF {
		return shared.BadRequest("请求只能包含一个 JSON 对象")
	}
	return nil
}

func (h *Handler) getGroup(w http.ResponseWriter, r *http.Request, group domainsettings.Group) {
	data, err := h.svc.GetGroup(r.Context(), group)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, data)
}

func (h *Handler) updateGroup(w http.ResponseWriter, r *http.Request, group domainsettings.Group) {
	var req UpdateGroupRequest
	if err := decodeRequest(w, r, &req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if req.ExpectedVersion == nil || *req.ExpectedVersion < 0 {
		response.RespondError(w, r, shared.BadRequest("expected_version 必须是非负整数"))
		return
	}
	data, err := h.svc.UpdateGroup(r.Context(), group, *req.ExpectedVersion, req.Values)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, data)
}

func (h *Handler) resetGroup(w http.ResponseWriter, r *http.Request, group domainsettings.Group) {
	var req ResetGroupRequest
	if err := decodeRequest(w, r, &req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if req.ExpectedVersion == nil || *req.ExpectedVersion < 0 {
		response.RespondError(w, r, shared.BadRequest("expected_version 必须是非负整数"))
		return
	}
	data, err := h.svc.ResetGroup(r.Context(), group, *req.ExpectedVersion)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, data)
}

func (h *Handler) GetGeneral(w http.ResponseWriter, r *http.Request) {
	h.getGroup(w, r, domainsettings.General)
}
func (h *Handler) UpdateGeneral(w http.ResponseWriter, r *http.Request) {
	h.updateGroup(w, r, domainsettings.General)
}
func (h *Handler) ResetGeneral(w http.ResponseWriter, r *http.Request) {
	h.resetGroup(w, r, domainsettings.General)
}
func (h *Handler) GetAuth(w http.ResponseWriter, r *http.Request) {
	h.getGroup(w, r, domainsettings.Auth)
}
func (h *Handler) UpdateAuth(w http.ResponseWriter, r *http.Request) {
	h.updateGroup(w, r, domainsettings.Auth)
}
func (h *Handler) ResetAuth(w http.ResponseWriter, r *http.Request) {
	h.resetGroup(w, r, domainsettings.Auth)
}
func (h *Handler) GetGithub(w http.ResponseWriter, r *http.Request) {
	h.getGroup(w, r, domainsettings.Github)
}
func (h *Handler) UpdateGithub(w http.ResponseWriter, r *http.Request) {
	h.updateGroup(w, r, domainsettings.Github)
}
func (h *Handler) ResetGithub(w http.ResponseWriter, r *http.Request) {
	h.resetGroup(w, r, domainsettings.Github)
}
func (h *Handler) GetProfile(w http.ResponseWriter, r *http.Request) {
	h.getGroup(w, r, domainsettings.Profile)
}
func (h *Handler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	h.updateGroup(w, r, domainsettings.Profile)
}
func (h *Handler) ResetProfile(w http.ResponseWriter, r *http.Request) {
	h.resetGroup(w, r, domainsettings.Profile)
}
func (h *Handler) GetAbout(w http.ResponseWriter, r *http.Request) {
	h.getGroup(w, r, domainsettings.About)
}
func (h *Handler) UpdateAbout(w http.ResponseWriter, r *http.Request) {
	h.updateGroup(w, r, domainsettings.About)
}
func (h *Handler) ResetAbout(w http.ResponseWriter, r *http.Request) {
	h.resetGroup(w, r, domainsettings.About)
}
func (h *Handler) GetLlm(w http.ResponseWriter, r *http.Request) {
	h.getGroup(w, r, domainsettings.LLM)
}
func (h *Handler) UpdateLlm(w http.ResponseWriter, r *http.Request) {
	h.updateGroup(w, r, domainsettings.LLM)
}
func (h *Handler) ResetLlm(w http.ResponseWriter, r *http.Request) {
	h.resetGroup(w, r, domainsettings.LLM)
}
func (h *Handler) GetCodeRunner(w http.ResponseWriter, r *http.Request) {
	h.getGroup(w, r, domainsettings.CodeRunner)
}
func (h *Handler) UpdateCodeRunner(w http.ResponseWriter, r *http.Request) {
	h.updateGroup(w, r, domainsettings.CodeRunner)
}
func (h *Handler) ResetCodeRunner(w http.ResponseWriter, r *http.Request) {
	h.resetGroup(w, r, domainsettings.CodeRunner)
}
