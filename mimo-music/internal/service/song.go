// Package service 是 grpc service impl 层（薄路由，无业务逻辑）。
//
// 每个方法恒一行 return resp, err（Execute 返回值类型，service 取地址返回指针满足 gRPC 签名）。
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
	return resp, err
}

// GetSongURL 获取播放直链。
func (s *SongServer) GetSongURL(ctx context.Context, req *mmpb.GetSongURLRequest) (*mmpb.GetSongURLResponse, error) {
	resp, err := engine.Execute(s.eng, ctx, songendpoint.URL, req)
	return resp, err
}

// GetLyric 获取歌词。
func (s *SongServer) GetLyric(ctx context.Context, req *mmpb.GetLyricRequest) (*mmpb.GetLyricResponse, error) {
	resp, err := engine.Execute(s.eng, ctx, songendpoint.Lyric, req)
	return resp, err
}

// --- 歌曲扩展（写操作，cookie override 路径） ---

// Like 喜欢或取消喜欢歌曲（toggle）。
func (s *SongServer) Like(ctx context.Context, req *mmpb.LikeRequest) (*mmpb.LikeResponse, error) {
	return executeOverride(s.eng, ctx, songendpoint.Like, req)
}

// Trash 把歌曲丢进垃圾桶。
func (s *SongServer) Trash(ctx context.Context, req *mmpb.TrashRequest) (*mmpb.TrashResponse, error) {
	return executeOverride(s.eng, ctx, songendpoint.Trash, req)
}

// DisallowRecommend 标记每日推荐歌曲不感兴趣。
func (s *SongServer) DisallowRecommend(ctx context.Context, req *mmpb.DisallowRecommendRequest) (*mmpb.DisallowRecommendResponse, error) {
	return executeOverride(s.eng, ctx, songendpoint.DisallowRecommend, req)
}

// --- 歌曲扩展（读操作，走缓存） ---

// CheckAvailable 检查音乐是否可用。
func (s *SongServer) CheckAvailable(ctx context.Context, req *mmpb.CheckAvailableRequest) (*mmpb.CheckAvailableResponse, error) {
	return engine.Execute(s.eng, ctx, songendpoint.CheckAvailable, req)
}

// LikedList 获取喜欢音乐列表。
func (s *SongServer) LikedList(ctx context.Context, req *mmpb.LikedListRequest) (*mmpb.LikedListResponse, error) {
	return engine.Execute(s.eng, ctx, songendpoint.LikedList, req)
}

// QualityDetail 获取歌曲音质详情。
func (s *SongServer) QualityDetail(ctx context.Context, req *mmpb.QualityDetailRequest) (*mmpb.QualityDetailResponse, error) {
	return engine.Execute(s.eng, ctx, songendpoint.QualityDetail, req)
}

// LikeCount 获取歌曲红心数量。
func (s *SongServer) LikeCount(ctx context.Context, req *mmpb.LikeCountRequest) (*mmpb.LikeCountResponse, error) {
	return engine.Execute(s.eng, ctx, songendpoint.LikeCount, req)
}

// IsLike 判断是否已喜爱歌曲（结果按调用方而异，走 cookie override 不缓存）。
func (s *SongServer) IsLike(ctx context.Context, req *mmpb.IsLikeRequest) (*mmpb.IsLikeResponse, error) {
	return executeOverride(s.eng, ctx, songendpoint.IsLike, req)
}

// DynamicCover 获取歌曲动态封面。
func (s *SongServer) DynamicCover(ctx context.Context, req *mmpb.DynamicCoverRequest) (*mmpb.DynamicCoverResponse, error) {
	return engine.Execute(s.eng, ctx, songendpoint.DynamicCover, req)
}

// ChorusTime 获取歌曲副歌时间。
func (s *SongServer) ChorusTime(ctx context.Context, req *mmpb.ChorusTimeRequest) (*mmpb.ChorusTimeResponse, error) {
	return engine.Execute(s.eng, ctx, songendpoint.ChorusTime, req)
}

// CreatorInfo 获取歌曲创作者信息。
func (s *SongServer) CreatorInfo(ctx context.Context, req *mmpb.CreatorInfoRequest) (*mmpb.CreatorInfoResponse, error) {
	return engine.Execute(s.eng, ctx, songendpoint.CreatorInfo, req)
}

// GetWordLyric 获取逐字歌词。
func (s *SongServer) GetWordLyric(ctx context.Context, req *mmpb.GetWordLyricRequest) (*mmpb.GetWordLyricResponse, error) {
	return engine.Execute(s.eng, ctx, songendpoint.WordLyricEP, req)
}
