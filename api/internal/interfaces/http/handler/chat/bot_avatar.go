package chat

import (
	"errors"
	"io"
	"mime"
	"net/http"

	appchat "blog-api/internal/application/chat"
	appmedia "blog-api/internal/application/media"
	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/interfaces/http/response"
	"github.com/rs/zerolog/log"
)

// WithBotAvatars 接入只修改当前 Bot Token 所属账号的头像用例。
func (h *BotHandler) WithBotAvatars(service *appchat.BotAvatarService) *BotHandler {
	h.avatars = service
	return h
}

// UploadAvatar 上传并设置自身头像，仅接受单个 multipart file。
func (h *BotHandler) UploadAvatar(w http.ResponseWriter, r *http.Request) {
	bot, err := h.requireBot(r)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	if h.avatars == nil {
		response.RespondError(w, r, domainshared.Internal("Bot 头像上传未启用", nil))
		return
	}
	if r.URL.RawQuery != "" {
		response.RespondError(w, r, domainshared.BadRequest("头像端点不接受查询参数"))
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, appchat.MaxBotAvatarBytes+(1<<20))
	err = r.ParseMultipartForm(1 << 20)
	if r.MultipartForm != nil {
		defer func() {
			if err := r.MultipartForm.RemoveAll(); err != nil {
				log.Warn().Err(err).Msg("清理头像 multipart 临时文件失败")
			}
		}()
	}
	if err != nil {
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			response.RespondPayloadTooLarge(w, r, "头像超过 10 MiB")
			return
		}
		response.RespondError(w, r, domainshared.BadRequest("multipart 请求格式错误"))
		return
	}
	if len(r.MultipartForm.Value) != 0 || len(r.MultipartForm.File) != 1 || len(r.MultipartForm.File["file"]) != 1 {
		response.RespondError(w, r, domainshared.BadRequest("仅接受一个 file，不接受目标账号或素材 ID"))
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		response.RespondError(w, r, domainshared.BadRequest("缺少头像文件"))
		return
	}
	defer func() {
		if err := file.Close(); err != nil {
			log.Warn().Err(err).Msg("关闭头像上传文件失败")
		}
	}()
	data, err := io.ReadAll(io.LimitReader(file, appchat.MaxBotAvatarBytes+1))
	if err != nil {
		response.RespondError(w, r, domainshared.BadRequest("读取头像失败"))
		return
	}
	if len(data) > appchat.MaxBotAvatarBytes {
		response.RespondPayloadTooLarge(w, r, "头像超过 10 MiB")
		return
	}
	mimeType, _, err := mime.ParseMediaType(header.Header.Get("Content-Type"))
	if err != nil {
		response.RespondError(w, r, domainshared.BadRequest("头像 MIME 类型无效"))
		return
	}
	if mimeType == "application/octet-stream" {
		mimeType = http.DetectContentType(data)
	}
	dto, err := h.avatars.Set(r.Context(), bot, appmedia.SaveBotMediaInput{
		OriginalName: header.Filename, MIMEType: mimeType, Data: data,
	})
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, dto)
}
