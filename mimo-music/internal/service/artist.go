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

// GetArtist 获取歌手信息。
func (s *ArtistServer) GetArtist(ctx context.Context, req *mmpb.GetArtistRequest) (*mmpb.GetArtistResponse, error) {
	return engine.Execute(s.eng, ctx, artistendpoint.GetArtist, req)
}

// AllSongs 获取歌手全部歌曲（分页）。
func (s *ArtistServer) AllSongs(ctx context.Context, req *mmpb.AllSongsRequest) (*mmpb.AllSongsResponse, error) {
	return engine.Execute(s.eng, ctx, artistendpoint.AllSongs, req)
}

// TopSongs 获取歌手热门 50 首。
func (s *ArtistServer) TopSongs(ctx context.Context, req *mmpb.TopSongsRequest) (*mmpb.TopSongsResponse, error) {
	return engine.Execute(s.eng, ctx, artistendpoint.TopSongs, req)
}

// Albums 获取歌手专辑列表。
func (s *ArtistServer) Albums(ctx context.Context, req *mmpb.AlbumsRequest) (*mmpb.AlbumsResponse, error) {
	return engine.Execute(s.eng, ctx, artistendpoint.Albums, req)
}

// Desc 获取歌手详细描述。
func (s *ArtistServer) Desc(ctx context.Context, req *mmpb.DescRequest) (*mmpb.DescResponse, error) {
	return engine.Execute(s.eng, ctx, artistendpoint.Desc, req)
}

// Similar 获取相似歌手。
func (s *ArtistServer) Similar(ctx context.Context, req *mmpb.SimilarRequest) (*mmpb.SimilarResponse, error) {
	return engine.Execute(s.eng, ctx, artistendpoint.Similar, req)
}

// Fans 获取歌手粉丝数。
func (s *ArtistServer) Fans(ctx context.Context, req *mmpb.FansRequest) (*mmpb.FansResponse, error) {
	return engine.Execute(s.eng, ctx, artistendpoint.Fans, req)
}

// TopArtists 获取热门歌手列表。
func (s *ArtistServer) TopArtists(ctx context.Context, req *mmpb.TopArtistsRequest) (*mmpb.TopArtistsResponse, error) {
	return engine.Execute(s.eng, ctx, artistendpoint.TopArtists, req)
}

// ArtistSubscribe 收藏/取消收藏歌手（写操作，cookie override）。
func (s *ArtistServer) ArtistSubscribe(ctx context.Context, req *mmpb.ArtistSubscribeRequest) (*mmpb.ArtistSubscribeResponse, error) {
	raw, _, err := s.eng.RawDoWithCookieAndInput(ctx, artistendpoint.SubscribeMeta, artistendpoint.SubscribeRequest(req), req.GetCookie())
	if err != nil {
		return nil, err
	}
	return artistendpoint.ParseSubscribeResponse(raw), nil
}
