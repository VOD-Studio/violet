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

// --- 专辑扩展 ---

// NewAlbumShelf 获取新碟上架。
func (s *AlbumServer) NewAlbumShelf(ctx context.Context, req *mmpb.NewAlbumShelfRequest) (*mmpb.NewAlbumShelfResponse, error) {
	resp, err := engine.Execute(s.eng, ctx, albumendpoint.NewAlbumShelf, req)
	return resp, err
}

// NewestAlbums 获取最新专辑。
func (s *AlbumServer) NewestAlbums(ctx context.Context, req *mmpb.NewestAlbumsRequest) (*mmpb.NewestAlbumsResponse, error) {
	resp, err := engine.Execute(s.eng, ctx, albumendpoint.NewestAlbums, req)
	return resp, err
}

// AllNewAlbums 获取全部新碟。
func (s *AlbumServer) AllNewAlbums(ctx context.Context, req *mmpb.AllNewAlbumsRequest) (*mmpb.AllNewAlbumsResponse, error) {
	resp, err := engine.Execute(s.eng, ctx, albumendpoint.AllNewAlbums, req)
	return resp, err
}

// SubscribedAlbums 获取已收藏专辑列表（结果按调用方而异，走 cookie override）。
func (s *AlbumServer) SubscribedAlbums(ctx context.Context, req *mmpb.SubscribedAlbumsRequest) (*mmpb.SubscribedAlbumsResponse, error) {
	resp, err := executeOverride(s.eng, ctx, albumendpoint.SubscribedAlbums, req)
	return resp, err
}

// AlbumDynamic 获取专辑动态信息。
func (s *AlbumServer) AlbumDynamic(ctx context.Context, req *mmpb.AlbumDynamicRequest) (*mmpb.AlbumDynamicResponse, error) {
	resp, err := engine.Execute(s.eng, ctx, albumendpoint.AlbumDynamic, req)
	return resp, err
}

// AlbumSongQuality 获取专辑歌曲音质。
func (s *AlbumServer) AlbumSongQuality(ctx context.Context, req *mmpb.AlbumSongQualityRequest) (*mmpb.AlbumSongQualityResponse, error) {
	resp, err := engine.Execute(s.eng, ctx, albumendpoint.AlbumSongQuality, req)
	return resp, err
}

// SubscribeAlbum 收藏专辑。
func (s *AlbumServer) SubscribeAlbum(ctx context.Context, req *mmpb.SubscribeAlbumRequest) (*mmpb.SubscribeAlbumResponse, error) {
	resp, err := executeOverride(s.eng, ctx, albumendpoint.Subscribe, req)
	return resp, err
}

// UnsubscribeAlbum 取消收藏专辑。
func (s *AlbumServer) UnsubscribeAlbum(ctx context.Context, req *mmpb.UnsubscribeAlbumRequest) (*mmpb.UnsubscribeAlbumResponse, error) {
	resp, err := executeOverride(s.eng, ctx, albumendpoint.Unsubscribe, req)
	return resp, err
}
