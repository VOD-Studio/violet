package runtimelog

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	applog "blog-api/internal/application/runtimelog"
	domainlog "blog-api/internal/domain/runtimelog"
	"blog-api/internal/domain/shared"
	"blog-api/internal/interfaces/http/response"
)

type Handler struct {
	service      *applog.Service
	status       applog.StatusProvider
	minimumLevel func() string
}

func NewHandler(service *applog.Service, status applog.StatusProvider, minimumLevel func() string) *Handler {
	return &Handler{service: service, status: status, minimumLevel: minimumLevel}
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	filter, err := parseFilter(r)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	page, err := h.service.List(r.Context(), filter)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	response.RespondOK(w, page)
}

func (h *Handler) Status(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	response.RespondOK(w, struct {
		applog.CollectionStatus
		MinimumLevel string    `json:"minimum_level"`
		ObservedAt   time.Time `json:"observed_at"`
	}{h.status.Stats(), h.minimumLevel(), time.Now().UTC()})
}

func parseFilter(r *http.Request) (domainlog.Filter, error) {
	query := r.URL.Query()
	filter := domainlog.Filter{Source: query.Get("source"), Keyword: query.Get("keyword"), RequestID: query.Get("request_id"), TraceID: query.Get("trace_id")}
	if levels := query.Get("levels"); levels != "" {
		filter.Levels = strings.Split(levels, ",")
	}
	for key, target := range map[string]*int64{"before": &filter.Before, "after": &filter.After} {
		if value := query.Get(key); value != "" {
			id, err := strconv.ParseInt(value, 10, 64)
			if err != nil || id <= 0 {
				return filter, shared.BadRequest("日志游标格式错误")
			}
			*target = id
		}
	}
	direction := query.Get("direction")
	if direction != "" && direction != "forward" && direction != "backward" {
		return filter, shared.BadRequest("未知日志读取方向")
	}
	filter.Ascending = filter.After > 0 || direction == "forward"
	if value := query.Get("limit"); value != "" {
		limit, err := strconv.Atoi(value)
		if err != nil || limit < 1 {
			return filter, shared.BadRequest("日志读取数量格式错误")
		}
		filter.Limit = limit
	}
	for key, target := range map[string]*time.Time{"from": &filter.From, "until": &filter.Until} {
		if value := query.Get(key); value != "" {
			instant, err := time.Parse(time.RFC3339Nano, value)
			if err != nil {
				return filter, shared.BadRequest("日志时间必须为 RFC3339 格式")
			}
			*target = instant
		}
	}
	return filter, nil
}
