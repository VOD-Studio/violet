// Package system 提供系统面板 HTTP 入口。
package system

import (
	"encoding/json"
	"errors"
	"io"
	"mime"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog/log"

	appsystem "blog-api/internal/application/system"
	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/interfaces/http/response"
)

const (
	maxJSONBodyBytes         = 1 << 20
	maxBackupImportBodyBytes = 513 << 20
)

// Handler 处理系统状态、数据库操作和备份维护请求。
type Handler struct {
	svc *appsystem.Service
}

// NewHandler 构造系统面板 handler。
func NewHandler(svc *appsystem.Service) *Handler {
	return &Handler{svc: svc}
}

// GetSnapshot 返回实时服务器快照。
func (h *Handler) GetSnapshot(w http.ResponseWriter, r *http.Request) {
	data, err := h.svc.GetSnapshot(r.Context())
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, data)
}

// GetHistory 返回服务器历史趋势。
func (h *Handler) GetHistory(w http.ResponseWriter, r *http.Request) {
	data, err := h.svc.GetHistory(r.Context())
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, data)
}

// GetDatabaseStatus 返回 PostgreSQL 状态与表统计。
func (h *Handler) GetDatabaseStatus(w http.ResponseWriter, r *http.Request) {
	data, err := h.svc.GetDatabaseStatus(r.Context())
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, data)
}

// GetDatabaseSchema 返回 SQL 补全与导出选择使用的 schema。
func (h *Handler) GetDatabaseSchema(w http.ResponseWriter, r *http.Request) {
	data, err := h.svc.GetDatabaseSchema(r.Context())
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, data)
}

// ExecuteSQL 执行受控 SQL 请求。
func (h *Handler) ExecuteSQL(w http.ResponseWriter, r *http.Request) {
	var input appsystem.ExecuteSQLInput
	if err := decodeJSON(w, r, &input); err != nil {
		response.RespondError(w, r, err)
		return
	}
	result, err := h.svc.ExecuteSQL(r.Context(), input)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, result)
}

// ExportData 以附件流返回表或只读查询结果。
func (h *Handler) ExportData(w http.ResponseWriter, r *http.Request) {
	var input appsystem.ExportInput
	if err := decodeJSON(w, r, &input); err != nil {
		response.RespondError(w, r, err)
		return
	}
	stream, metadata, err := h.svc.ExportData(r.Context(), input)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	defer stream.Close()
	writeAttachment(w, stream, metadata.Filename, metadata.ContentType, -1)
}

// ListBackups 返回备份清单和自动调度设置。
func (h *Handler) ListBackups(w http.ResponseWriter, r *http.Request) {
	data, err := h.svc.ListBackups(r.Context())
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, data)
}

// CreateBackup 启动手动备份任务。
func (h *Handler) CreateBackup(w http.ResponseWriter, r *http.Request) {
	var input struct {
		IncludeUploads bool `json:"include_uploads"`
	}
	if err := decodeJSON(w, r, &input); err != nil {
		response.RespondError(w, r, err)
		return
	}
	task, err := h.svc.StartManualBackup(input.IncludeUploads)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.WriteJSON(w, http.StatusAccepted, response.Envelope{Data: task})
}

// ImportBackup 流式导入当前实例签名的 SQL 备份。
func (h *Handler) ImportBackup(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxBackupImportBodyBytes)
	reader, err := r.MultipartReader()
	if err != nil {
		response.RespondError(w, r, domainshared.BadRequest("请求必须是 multipart/form-data"))
		return
	}
	for {
		part, nextErr := reader.NextPart()
		if errors.Is(nextErr, io.EOF) {
			response.RespondError(w, r, domainshared.BadRequest("缺少 file 字段"))
			return
		}
		if nextErr != nil {
			response.RespondError(w, r, domainshared.BadRequest("读取备份文件失败"))
			return
		}
		if part.FormName() != "file" || part.FileName() == "" {
			_ = part.Close()
			continue
		}
		info, importErr := h.svc.ImportBackup(r.Context(), part.FileName(), part)
		_ = part.Close()
		if importErr != nil {
			response.RespondError(w, r, importErr)
			return
		}
		response.RespondCreated(w, info)
		return
	}
}

// DownloadBackup 下载数据库 SQL 或配对上传归档。
func (h *Handler) DownloadBackup(w http.ResponseWriter, r *http.Request) {
	stream, metadata, err := h.svc.OpenBackup(
		r.Context(),
		chi.URLParam(r, "filename"),
		r.URL.Query().Get("part"),
	)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	defer stream.Close()
	writeAttachment(w, stream, metadata.Filename, metadata.ContentType, metadata.Size)
}

// RestoreBackup 启动数据库恢复任务；确认文本必须与文件名完全一致。
func (h *Handler) RestoreBackup(w http.ResponseWriter, r *http.Request) {
	filename := chi.URLParam(r, "filename")
	var input struct {
		ConfirmFilename string `json:"confirm_filename"`
	}
	if err := decodeJSON(w, r, &input); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if input.ConfirmFilename != filename {
		response.RespondError(w, r, domainshared.BadRequest("确认文件名与目标备份不一致"))
		return
	}
	task, err := h.svc.StartRestore(filename)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.WriteJSON(w, http.StatusAccepted, response.Envelope{Data: task})
}

// DeleteBackup 删除数据库备份及其配对上传归档。
func (h *Handler) DeleteBackup(w http.ResponseWriter, r *http.Request) {
	if err := h.svc.DeleteBackup(r.Context(), chi.URLParam(r, "filename")); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondNoContent(w)
}

// GetBackupTask 返回异步备份或恢复任务快照。
func (h *Handler) GetBackupTask(w http.ResponseWriter, r *http.Request) {
	task, err := h.svc.GetBackupTask(chi.URLParam(r, "id"))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, task)
}

// UpdateBackupSettings 更新 UTC 自动备份计划。
func (h *Handler) UpdateBackupSettings(w http.ResponseWriter, r *http.Request) {
	var input appsystem.BackupSettings
	if err := decodeJSON(w, r, &input); err != nil {
		response.RespondError(w, r, err)
		return
	}
	settings, err := h.svc.UpdateBackupSettings(r.Context(), input)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, settings)
}

func decodeJSON(w http.ResponseWriter, r *http.Request, target any) error {
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxJSONBodyBytes))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return domainshared.BadRequest("请求体格式非法")
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return domainshared.BadRequest("请求体只能包含一个 JSON 值")
	}
	return nil
}

func writeAttachment(w http.ResponseWriter, stream io.Reader, filename, contentType string, size int64) {
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Content-Disposition", mime.FormatMediaType("attachment", map[string]string{"filename": filename}))
	if size >= 0 {
		w.Header().Set("Content-Length", strconv.FormatInt(size, 10))
	}
	w.WriteHeader(http.StatusOK)
	if _, err := io.Copy(w, stream); err != nil {
		log.Warn().Err(err).Str("filename", filename).Msg("附件响应中断")
	}
}
