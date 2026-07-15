// Package service 的 ArtistService impl。
package service

import (
	"context"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/VOD-Studio/mimo-music/internal/netease/engine"
	artistendpoint "github.com/VOD-Studio/mimo-music/internal/netease/endpoint/artist"
)

// ArtistServer 实现 ArtistServiceServer。
type ArtistServer struct {
	mmpb.UnimplementedArtistServiceServer
	eng *engine.Engine
}

// NewArtistServer 创建 ArtistServer。
func NewArtistServer(eng *engine.Engine) *ArtistServer {
	return &ArtistServer{eng: eng}
}

// GetArtist 获取歌手信息。恒一行。
func (s *ArtistServer) GetArtist(ctx context.Context, req *mmpb.GetArtistRequest) (*mmpb.GetArtistResponse, error) {
	resp, err := engine.Execute(s.eng, ctx, artistendpoint.GetArtist, req)
	return &resp, err
}
