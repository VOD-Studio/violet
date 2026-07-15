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

// GetPlaylist 获取歌单详情。
func (s *PlaylistServer) GetPlaylist(ctx context.Context, req *mmpb.GetPlaylistRequest) (*mmpb.GetPlaylistResponse, error) {
	return engine.Execute(s.eng, ctx, playlistendpoint.GetPlaylist, req)
}

// HighQuality 获取精品歌单列表。
func (s *PlaylistServer) HighQuality(ctx context.Context, req *mmpb.HighQualityRequest) (*mmpb.HighQualityResponse, error) {
	return engine.Execute(s.eng, ctx, playlistendpoint.HighQuality, req)
}

// HighQualityTags 获取精品歌单标签列表。
func (s *PlaylistServer) HighQualityTags(ctx context.Context, req *mmpb.HighQualityTagsRequest) (*mmpb.HighQualityTagsResponse, error) {
	return engine.Execute(s.eng, ctx, playlistendpoint.HighQualityTags, req)
}

// CatList 获取歌单分类列表。
func (s *PlaylistServer) CatList(ctx context.Context, req *mmpb.CatListRequest) (*mmpb.CatListResponse, error) {
	return engine.Execute(s.eng, ctx, playlistendpoint.CatList, req)
}

// BrowseHot 获取网友精选碟（热门歌单）。
func (s *PlaylistServer) BrowseHot(ctx context.Context, req *mmpb.BrowseHotRequest) (*mmpb.BrowseHotResponse, error) {
	return engine.Execute(s.eng, ctx, playlistendpoint.BrowseHot, req)
}

// Subscribers 获取歌单收藏者列表。
func (s *PlaylistServer) Subscribers(ctx context.Context, req *mmpb.SubscribersRequest) (*mmpb.SubscribersResponse, error) {
	return engine.Execute(s.eng, ctx, playlistendpoint.Subscribers, req)
}

// AllTracks 获取歌单全量歌曲（分页）。
func (s *PlaylistServer) AllTracks(ctx context.Context, req *mmpb.AllTracksRequest) (*mmpb.AllTracksResponse, error) {
	return engine.Execute(s.eng, ctx, playlistendpoint.AllTracks, req)
}
