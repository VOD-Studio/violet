// Package server 装配 gRPC server 与 grpc-gateway runtime mux。
//
// gRPC server 监听 gRPC 端口对外提供强类型 RPC；gateway runtime mux 监听 HTTP 端口，
// 通过 dial 连本地 gRPC server，把 REST 请求转成 gRPC 调用。这是双 server 标准架构：
// 跨语言调用方走 gRPC，curl/Postman/前端走 gateway 暴露的 REST。
//
// 地基阶段（issue 0001）：service 全部注册为 unimplemented 占位，只保证 server 能启动、
// grpcurl 能 reflection 连上。真实接口实现在 issue 0005 迁移 15 接口时填入。
package server

import (
	"context"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/reflection"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"

	runtime "github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
)

// gatewayHandlers 是全部领域 service 的 gateway REST handler 注册函数。
// 签名统一（func(ctx, mux, endpoint, dialOpts) error），可以表驱动。
// gRPC server 注册因各 Server 类型不同无法表驱动，用显式调用。
var gatewayHandlers = []func(context.Context, *runtime.ServeMux, string, []grpc.DialOption) error{
	mmpb.RegisterSongServiceHandlerFromEndpoint,
	mmpb.RegisterPlaylistServiceHandlerFromEndpoint,
	mmpb.RegisterAuthServiceHandlerFromEndpoint,
	mmpb.RegisterSearchServiceHandlerFromEndpoint,
	mmpb.RegisterAlbumServiceHandlerFromEndpoint,
	mmpb.RegisterArtistServiceHandlerFromEndpoint,
	mmpb.RegisterRecommendServiceHandlerFromEndpoint,
	mmpb.RegisterFMServiceHandlerFromEndpoint,
}

// App 持有 gRPC server 与 gateway HTTP server，统一管理生命周期。
type App struct {
	grpcServer *grpc.Server
	httpServer *http.Server
}

// NewApp 创建双 server 应用。
func NewApp(grpcAddr, httpAddr string) (*App, error) {
	grpcServer := grpc.NewServer()

	// 注册全部领域 service（显式调用，因各 Server 类型不同）。
	// 地基阶段全部 unimplemented 占位；issue 0005 后换成注入真实 impl。
	mmpb.RegisterSongServiceServer(grpcServer, mmpb.UnimplementedSongServiceServer{})
	mmpb.RegisterPlaylistServiceServer(grpcServer, mmpb.UnimplementedPlaylistServiceServer{})
	mmpb.RegisterAuthServiceServer(grpcServer, mmpb.UnimplementedAuthServiceServer{})
	mmpb.RegisterSearchServiceServer(grpcServer, mmpb.UnimplementedSearchServiceServer{})
	mmpb.RegisterAlbumServiceServer(grpcServer, mmpb.UnimplementedAlbumServiceServer{})
	mmpb.RegisterArtistServiceServer(grpcServer, mmpb.UnimplementedArtistServiceServer{})
	mmpb.RegisterRecommendServiceServer(grpcServer, mmpb.UnimplementedRecommendServiceServer{})
	mmpb.RegisterFMServiceServer(grpcServer, mmpb.UnimplementedFMServiceServer{})

	// 开启 gRPC reflection，grpcurl 可列出并调用全部 RPC（地基阶段验收依赖）。
	reflection.Register(grpcServer)

	// 启动 gRPC server。
	lis, err := net.Listen("tcp", grpcAddr)
	if err != nil {
		return nil, fmt.Errorf("listen grpc %s: %w", grpcAddr, err)
	}
	go func() {
		slog.InfoContext(context.Background(), "grpc server starting", slog.String("addr", grpcAddr))
		if err := grpcServer.Serve(lis); err != nil {
			slog.ErrorContext(context.Background(), "grpc server failed", slog.String("error", err.Error()))
		}
	}()

	// gateway runtime mux：通过 dial 连本地 gRPC server。
	mux := runtime.NewServeMux()
	muxOpts := []grpc.DialOption{grpc.WithTransportCredentials(insecure.NewCredentials())}
	for _, h := range gatewayHandlers {
		if err := h(context.Background(), mux, grpcAddr, muxOpts); err != nil {
			return nil, fmt.Errorf("register gateway handler: %w", err)
		}
	}

	httpServer := &http.Server{
		Addr:         httpAddr,
		Handler:      mux,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  60 * time.Second,
	}
	go func() {
		slog.InfoContext(context.Background(), "gateway server starting", slog.String("addr", httpAddr))
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.ErrorContext(context.Background(), "gateway server failed", slog.String("error", err.Error()))
		}
	}()

	return &App{grpcServer: grpcServer, httpServer: httpServer}, nil
}

// Shutdown 优雅关闭 gRPC server 与 gateway HTTP server。
func (a *App) Shutdown(ctx context.Context) error {
	a.grpcServer.GracefulStop()
	return a.httpServer.Shutdown(ctx)
}
