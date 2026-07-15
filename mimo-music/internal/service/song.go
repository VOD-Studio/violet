// Package service 是 grpc service impl 层（薄路由，无业务逻辑）。
//
// 每个方法恒一行 return &resp, err（Execute 返回值类型，service 取地址返回指针满足 gRPC 签名）。
// service 是 gRPC server interface 的 adapter 边界。
package service

import (
	"context"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/VOD-Studio/mimo-music/internal/netease/engine"
	songendpoint "github.com/VOD-Studio/mimo-music/internal/netease/endpoint/song"
)

// SongServer 实现 SongServiceServer，持有 *engine.Engine。
type SongServer struct {
	mmpb.UnimplementedSongServiceServer
	eng *engine.Engine
}

// NewSongServer 创建 SongServer。
func NewSongServer(eng *engine.Engine) *SongServer {
	return &SongServer{eng: eng}
}

// GetSongDetail 获取歌曲详情。恒一行。
func (s *SongServer) GetSongDetail(ctx context.Context, req *mmpb.GetSongDetailRequest) (*mmpb.GetSongDetailResponse, error) {
	resp, err := engine.Execute(s.eng, ctx, songendpoint.Detail, req)
	return &resp, err
}

// GetSongURL 获取播放直链。
func (s *SongServer) GetSongURL(ctx context.Context, req *mmpb.GetSongURLRequest) (*mmpb.GetSongURLResponse, error) {
	resp, err := engine.Execute(s.eng, ctx, songendpoint.URL, req)
	return &resp, err
}

// GetLyric 获取歌词。
func (s *SongServer) GetLyric(ctx context.Context, req *mmpb.GetLyricRequest) (*mmpb.GetLyricResponse, error) {
	resp, err := engine.Execute(s.eng, ctx, songendpoint.Lyric, req)
	return &resp, err
}
