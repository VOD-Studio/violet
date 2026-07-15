// Package service 的 AlbumService impl。
package service

import (
	"context"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/VOD-Studio/mimo-music/internal/netease/engine"
	albumendpoint "github.com/VOD-Studio/mimo-music/internal/netease/endpoint/album"
)

// AlbumServer 实现 AlbumServiceServer。
type AlbumServer struct {
	mmpb.UnimplementedAlbumServiceServer
	eng *engine.Engine
}

// NewAlbumServer 创建 AlbumServer。
func NewAlbumServer(eng *engine.Engine) *AlbumServer {
	return &AlbumServer{eng: eng}
}

// GetAlbum 获取专辑详情。恒一行。
func (s *AlbumServer) GetAlbum(ctx context.Context, req *mmpb.GetAlbumRequest) (*mmpb.GetAlbumResponse, error) {
	resp, err := engine.Execute(s.eng, ctx, albumendpoint.GetAlbum, req)
	return resp, err
}
