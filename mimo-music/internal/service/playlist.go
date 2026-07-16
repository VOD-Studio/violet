// Package service 的 PlaylistService impl。
package service

import (
	"context"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	playlistendpoint "github.com/VOD-Studio/mimo-music/internal/netease/endpoint/playlist"
	"github.com/VOD-Studio/mimo-music/internal/netease/engine"
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

// --- 写操作（cookie override，不走 Execute） ---

// Subscribe 收藏/取消收藏歌单。
func (s *PlaylistServer) Subscribe(ctx context.Context, req *mmpb.SubscribeRequest) (*mmpb.SubscribeResponse, error) {
	raw, _, err := s.eng.RawDoWithCookieAndInput(ctx, playlistendpoint.SubscribeMeta, playlistendpoint.SubscribeRequest(req))
	if err != nil {
		return nil, err
	}
	return playlistendpoint.ParseSubscribed(raw), nil
}

// Create 新建歌单。
func (s *PlaylistServer) Create(ctx context.Context, req *mmpb.CreateRequest) (*mmpb.CreateResponse, error) {
	raw, _, err := s.eng.RawDoWithCookieAndInput(ctx, playlistendpoint.CreateMeta, playlistendpoint.CreateRequest(req))
	if err != nil {
		return nil, err
	}
	return playlistendpoint.ParseCreateResponse(raw), nil
}

// Delete 删除歌单。
func (s *PlaylistServer) Delete(ctx context.Context, req *mmpb.DeleteRequest) (*mmpb.DeleteResponse, error) {
	_, _, err := s.eng.RawDoWithCookieAndInput(ctx, playlistendpoint.DeleteMeta, playlistendpoint.DeleteRequest(req))
	if err != nil {
		return nil, err
	}
	return &mmpb.DeleteResponse{}, nil
}

// UpdateName 更新歌单名。
func (s *PlaylistServer) UpdateName(ctx context.Context, req *mmpb.UpdateNameRequest) (*mmpb.UpdateNameResponse, error) {
	_, _, err := s.eng.RawDoWithCookieAndInput(ctx, playlistendpoint.UpdateNameMeta, playlistendpoint.UpdateNameRequest(req))
	if err != nil {
		return nil, err
	}
	return &mmpb.UpdateNameResponse{}, nil
}

// UpdateDesc 更新歌单描述。
func (s *PlaylistServer) UpdateDesc(ctx context.Context, req *mmpb.UpdateDescRequest) (*mmpb.UpdateDescResponse, error) {
	_, _, err := s.eng.RawDoWithCookieAndInput(ctx, playlistendpoint.UpdateDescMeta, playlistendpoint.UpdateDescRequest(req))
	if err != nil {
		return nil, err
	}
	return &mmpb.UpdateDescResponse{}, nil
}

// UpdateTags 更新歌单标签。
func (s *PlaylistServer) UpdateTags(ctx context.Context, req *mmpb.UpdateTagsRequest) (*mmpb.UpdateTagsResponse, error) {
	_, _, err := s.eng.RawDoWithCookieAndInput(ctx, playlistendpoint.UpdateTagsMeta, playlistendpoint.UpdateTagsRequest(req))
	if err != nil {
		return nil, err
	}
	return &mmpb.UpdateTagsResponse{}, nil
}

// UpdateTracks 添加或删除歌曲。
func (s *PlaylistServer) UpdateTracks(ctx context.Context, req *mmpb.UpdateTracksRequest) (*mmpb.UpdateTracksResponse, error) {
	raw, _, err := s.eng.RawDoWithCookieAndInput(ctx, playlistendpoint.UpdateTracksMeta, playlistendpoint.UpdateTracksRequest(req))
	if err != nil {
		return nil, err
	}
	return playlistendpoint.ParseUpdateTracksResponse(raw), nil
}

// SimilarPlaylists 基于歌曲获取相似歌单。
func (s *PlaylistServer) SimilarPlaylists(ctx context.Context, req *mmpb.SimilarPlaylistsRequest) (*mmpb.SimilarPlaylistsResponse, error) {
	return engine.Execute(s.eng, ctx, playlistendpoint.SimilarPlaylists, req)
}

// RelatedPlaylistRecommend 基于歌单获取相关歌单推荐。
func (s *PlaylistServer) RelatedPlaylistRecommend(ctx context.Context, req *mmpb.RelatedPlaylistRecommendRequest) (*mmpb.RelatedPlaylistRecommendResponse, error) {
	return engine.Execute(s.eng, ctx, playlistendpoint.RelatedPlaylistRecommend, req)
}
