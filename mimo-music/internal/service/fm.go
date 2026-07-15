// Package service 的 FMService impl。
package service

import (
	"context"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/VOD-Studio/mimo-music/internal/netease/engine"
	fmendpoint "github.com/VOD-Studio/mimo-music/internal/netease/endpoint/fm"
)

// FMServer 实现 FMServiceServer。
type FMServer struct {
	mmpb.UnimplementedFMServiceServer
	eng *engine.Engine
}

// NewFMServer 创建 FMServer。
func NewFMServer(eng *engine.Engine) *FMServer {
	return &FMServer{eng: eng}
}

// GetPersonalFM 获取私人 FM。恒一行。
func (s *FMServer) GetPersonalFM(ctx context.Context, req *mmpb.GetPersonalFMRequest) (*mmpb.GetPersonalFMResponse, error) {
	resp, err := engine.Execute(s.eng, ctx, fmendpoint.GetPersonalFM, req)
	return resp, err
}
