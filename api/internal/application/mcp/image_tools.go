package mcp

import (
	"context"
	"encoding/base64"
	"fmt"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	appmedia "blog-api/internal/application/media"
	domainapitoken "blog-api/internal/domain/api_token"
	domainshared "blog-api/internal/domain/shared"
)

// maxUploadImageBytes 单张配图解码后的字节上限；base64 经 agent 上下文传输，过大既慢又贵。
const maxUploadImageBytes = 4 << 20

// ImageService MCP tool 依赖的文章配图保存端口；application/media.UploadService 实现之。
type ImageService interface {
	SavePostImage(ctx context.Context, in appmedia.SavePostImageInput) (appmedia.BotMediaDTO, error)
}

// ImageTools 文章配图 tool，挂在文章 MCP server 上。
type ImageTools struct {
	images ImageService
}

// NewImageTools 构造配图 tool 集合。
func NewImageTools(images ImageService) *ImageTools {
	return &ImageTools{images: images}
}

type uploadImageArgs struct {
	Filename   string `json:"filename,omitempty" jsonschema:"原始文件名（含扩展名），仅作记录"`
	DataBase64 string `json:"data_base64" jsonschema:"图片字节的标准 base64（不带 data: 前缀）；png/jpeg/gif/webp，解码后不超过 4MiB"`
}

// UploadImage 保存文章配图并返回站内 URL（需 posts:write）。
func (t *ImageTools) UploadImage(ctx context.Context, req *mcp.CallToolRequest, args uploadImageArgs) (*mcp.CallToolResult, any, error) {
	if err := requireScope(req, domainapitoken.ScopePostsWrite); err != nil {
		return errResult(err), nil, nil
	}
	data, err := base64.StdEncoding.DecodeString(args.DataBase64)
	if err != nil {
		return errResult(fmt.Errorf("data_base64 不是合法的标准 base64: %w", err)), nil, nil
	}
	if len(data) > maxUploadImageBytes {
		return errResult(fmt.Errorf("图片超过 %d MiB 上限", maxUploadImageBytes>>20)), nil, nil
	}
	ownerID, err := domainshared.ParseID(operatorUserID(req))
	if err != nil {
		return errResult(fmt.Errorf("无法识别令牌持有人: %w", err)), nil, nil
	}
	dto, err := t.images.SavePostImage(ctx, appmedia.SavePostImageInput{
		OwnerID:      ownerID,
		OriginalName: args.Filename,
		Data:         data,
	})
	if err != nil {
		return errResult(err), nil, nil
	}
	return okResult(dto), nil, nil
}
