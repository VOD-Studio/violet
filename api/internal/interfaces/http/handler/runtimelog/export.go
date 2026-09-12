package runtimelog

import (
	"bufio"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	domainlog "blog-api/internal/domain/runtimelog"
	"blog-api/internal/interfaces/http/response"
	"github.com/rs/zerolog/log"
)

const exportWriteTimeout = 10 * time.Second

type exportFooter struct {
	Export exportSummary `json:"_export"`
}

type exportSummary struct {
	Exported      int    `json:"exported"`
	PayloadBytes  int64  `json:"payload_bytes"`
	ThroughCursor string `json:"through_cursor"`
	LastCursor    string `json:"last_cursor"`
	Truncated     bool   `json:"truncated"`
	Reason        string `json:"reason,omitempty"`
	Error         string `json:"error,omitempty"`
}

func (h *Handler) Export(w http.ResponseWriter, r *http.Request) {
	filter, err := parseFilter(r)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	if !h.delivery.acquireExport() {
		w.Header().Set("Retry-After", "2")
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusTooManyRequests)
		_, _ = w.Write([]byte(`{"error":"capacity_exceeded","message":"运行日志导出任务已满，请稍后重试"}`))
		return
	}
	defer h.delivery.activeExports.Add(-1)

	plan, err := h.service.PrepareExport(r.Context(), filter, exportRecordLimit)
	if err != nil {
		if r.Context().Err() != nil {
			h.delivery.exportCancelled.Add(1)
			return
		}
		h.delivery.exportFailed.Add(1)
		response.RespondError(w, r, err)
		return
	}

	filename := "runtime-logs-" + time.Now().UTC().Format("20060102T150405Z") + ".ndjson"
	w.Header().Set("Content-Type", "application/x-ndjson; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", filename))
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("X-Export-Record-Limit", fmt.Sprint(exportRecordLimit))
	w.Header().Set("X-Export-Byte-Limit", fmt.Sprint(exportByteLimit))

	writer := bufio.NewWriterSize(w, 32<<10)
	controller := http.NewResponseController(w)
	var payloadBytes int64
	writtenSinceFlush := 0
	byteLimitReached := false
	result, err := h.service.WalkExport(r.Context(), plan, func(entry domainlog.Entry) (bool, error) {
		payload, err := json.Marshal(entry)
		if err != nil {
			return false, err
		}
		lineBytes := int64(len(payload) + 1)
		if payloadBytes+lineBytes > exportByteLimit {
			byteLimitReached = true
			return false, nil
		}
		if err := writeExportLine(controller, writer, payload); err != nil {
			return false, err
		}
		payloadBytes += lineBytes
		writtenSinceFlush++
		if writtenSinceFlush >= 100 {
			if err := flushExport(controller, writer); err != nil {
				return false, err
			}
			writtenSinceFlush = 0
		}
		return true, nil
	})
	if err != nil {
		if r.Context().Err() != nil {
			h.delivery.exportCancelled.Add(1)
			return
		}
		h.delivery.exportFailed.Add(1)
		log.Error().Err(err).Str("source", "runtimelog-export").Msg("运行日志导出中断")
		_ = writeExportFooter(controller, writer, exportSummary{
			Exported: result.Exported, PayloadBytes: payloadBytes,
			ThroughCursor: result.ThroughCursor, LastCursor: result.LastCursor,
			Truncated: true, Reason: "failure", Error: "export_interrupted",
		})
		return
	}

	reason := ""
	if result.RecordLimitReached {
		reason = "record_limit"
	} else if byteLimitReached {
		reason = "byte_limit"
	}
	if err := writeExportFooter(controller, writer, exportSummary{
		Exported: result.Exported, PayloadBytes: payloadBytes,
		ThroughCursor: result.ThroughCursor, LastCursor: result.LastCursor,
		Truncated: result.RecordLimitReached || result.SinkStopped, Reason: reason,
	}); err != nil {
		if r.Context().Err() != nil {
			h.delivery.exportCancelled.Add(1)
		} else {
			h.delivery.exportFailed.Add(1)
		}
		return
	}
	h.delivery.exportCompleted.Add(1)
	log.Info().Str("source", "runtimelog-export").Int("records", result.Exported).Int64("bytes", payloadBytes).Msg("运行日志导出完成")
}

func writeExportFooter(controller *http.ResponseController, writer *bufio.Writer, summary exportSummary) error {
	payload, err := json.Marshal(exportFooter{Export: summary})
	if err != nil {
		return err
	}
	if err := writeExportLine(controller, writer, payload); err != nil {
		return err
	}
	return flushExport(controller, writer)
}

func writeExportLine(controller *http.ResponseController, writer *bufio.Writer, payload []byte) error {
	if err := controller.SetWriteDeadline(time.Now().Add(exportWriteTimeout)); err != nil {
		return err
	}
	_, err := writer.Write(payload)
	if err == nil {
		err = writer.WriteByte('\n')
	}
	_ = controller.SetWriteDeadline(time.Time{})
	return err
}

func flushExport(controller *http.ResponseController, writer *bufio.Writer) error {
	if err := controller.SetWriteDeadline(time.Now().Add(exportWriteTimeout)); err != nil {
		return err
	}
	err := writer.Flush()
	if err == nil {
		err = controller.Flush()
	}
	_ = controller.SetWriteDeadline(time.Time{})
	return err
}
