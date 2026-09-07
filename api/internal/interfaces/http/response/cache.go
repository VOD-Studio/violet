package response

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/rs/zerolog/log"
)

// WriteCacheableJSON 写入带内容哈希 ETag 的 JSON；匹配 If-None-Match 时只返回 304。
func WriteCacheableJSON(w http.ResponseWriter, r *http.Request, cacheControl string, body any) error {
	payload, err := json.Marshal(body)
	if err != nil {
		return err
	}
	digest := sha256.Sum256(payload)
	etag := `W/"` + hex.EncodeToString(digest[:16]) + `"`
	w.Header().Set("Cache-Control", cacheControl)
	w.Header().Set("ETag", etag)
	if matchesETag(r.Header.Get("If-None-Match"), etag) {
		w.WriteHeader(http.StatusNotModified)
		return nil
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	if _, err := w.Write(payload); err != nil {
		log.Error().Err(err).Msg("响应 JSON 写入失败")
	}
	return nil
}

func matchesETag(header, etag string) bool {
	for candidate := range strings.SplitSeq(header, ",") {
		candidate = strings.TrimSpace(candidate)
		if candidate == "*" || candidate == etag {
			return true
		}
	}
	return false
}
