// Package endpoint 定义网易云每个接口的声明。
//
// 每个文件一个接口的 Endpoint 声明（Meta + CachePolicy + MapRequest + MapResponse），
// 不是活跃服务。grpc service 层（internal/service）的每个方法恒一行调用 engine.Execute。
package song

import (
	"encoding/json"
	"fmt"
	"time"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/VOD-Studio/mimo-music/internal/netease/engine"
	"github.com/VOD-Studio/mimo-music/internal/netease/model"
	"github.com/VOD-Studio/mimo-music/internal/netease/session"
)

// Detail 是获取歌曲详情的接口声明。
// Req 用指针（gRPC 天然传指针），Resp 用值（Execute 序列化用 new(Resp) 构造）。
var Detail = &engine.Endpoint[*mmpb.GetSongDetailRequest, *mmpb.GetSongDetailResponse]{
	Meta: engine.Meta{
		Path:   "/weapi/v3/song/detail",
		Method: "POST",
		Crypto: engine.CryptoWeAPI,
		Auth:   session.AuthAnonymous,
	},
	Cache: &engine.CachePolicy[*mmpb.GetSongDetailRequest]{
		Key: func(req *mmpb.GetSongDetailRequest) string {
			return fmt.Sprintf("song:detail:%d", req.GetSongId())
		},
		TTL: 24 * time.Hour,
	},
	MapRequest: func(req *mmpb.GetSongDetailRequest) (map[string]any, error) {
		idStr := fmt.Sprintf("%d", req.GetSongId())
		return map[string]any{
			"c":   fmt.Sprintf(`[{"id":%s}]`, idStr),
			"ids": fmt.Sprintf("[%s]", idStr),
		}, nil
	},
	MapResponse: func(raw json.RawMessage) (*mmpb.GetSongDetailResponse, error) {
		songs, err := model.DecodeSongDetail(raw)
		if err != nil {
			return &mmpb.GetSongDetailResponse{}, err
		}
		if len(songs) == 0 {
			return &mmpb.GetSongDetailResponse{}, fmt.Errorf("歌曲不存在")
		}
		return &mmpb.GetSongDetailResponse{Song: songs[0]}, nil
	},
}
