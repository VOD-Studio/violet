// Package service 的 PlaylistService impl。
package service

import (
	"context"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/VOD-Studio/mimo-music/internal/netease/engine"
	playlistendpoint "github.com/VOD-Studio/mimo-music/internal/netease/endpoint/playlist"
)

// PlaylistServer 实现 PlaylistServiceServer。
type PlaylistServer struct {
	mmpb.UnimplementedPlaylistServiceServer
	eng *engine.Engine
}

// NewPlaylistServer 创建 PlaylistServer。
func NewPlaylistServer(eng *engine.Engine) *PlaylistServer {
	return &PlaylistServer{eng: eng}
}

// GetPlaylist 获取歌单详情。恒一行。
func (s *PlaylistServer) GetPlaylist(ctx context.Context, req *mmpb.GetPlaylistRequest) (*mmpb.GetPlaylistResponse, error) {
	resp, err := engine.Execute(s.eng, ctx, playlistendpoint.GetPlaylist, req)
	return resp, err
}
