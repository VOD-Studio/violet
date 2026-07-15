// Package engine 的 Execute 泛型函数与 Endpoint 声明类型。
//
// Execute 串起缓存检查 → MapRequest → RawDo → MapResponse → 缓存回填。
// 缓存命中时跳过 RawDo，但 gRPC 链上的 auth/rate/trace/recovery 照常执行
// （它们在 interceptor，Execute 在 service 方法里被调用，时序在拦截器之后）。
//
// Endpoint 是声明：数据 + 两个映射函数，不是活跃服务。每接口一个包级 var。
package engine

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"google.golang.org/protobuf/proto"
)

// Endpoint 是一个网易云接口的完整声明。
//
// 数据（Meta + Cache）+ 两个映射函数（MapRequest + MapResponse）。
// 不是活跃服务，是声明。每接口一个包级 var。
type Endpoint[Req, Resp any] struct {
	// Meta 是网易云 endpoint 的执行元数据。
	Meta Meta
	// Cache 是缓存策略。nil 表示不缓存。
	Cache *CachePolicy[Req]
	// MapRequest 把 proto 请求转成网易云加密前的 params map。
	MapRequest func(req Req) (map[string]any, error)
	// MapResponse 把网易云原始 JSON 转成 proto 响应。
	// 通常调 internal/netease/model 的 map 函数组装。
	MapResponse func(raw json.RawMessage) (Resp, error)
}

// CachePolicy 声明缓存策略。endpoint 只声明，不执行（执行在 Execute）。
type CachePolicy[Req any] struct {
	// Key 从请求算 cache key。
	Key func(req Req) string
	// TTL 是缓存存活时间。
	TTL time.Duration
}

// Execute 串起缓存检查 → MapRequest → RawDo → MapResponse → 缓存回填。
//
// 缓存命中时跳过 RawDo，但 gRPC 链上的 auth/rate/trace/recovery 照常执行
// （它们在 interceptor，Execute 在 service 方法里被调用）。
//
// cache 在此处而非 interceptor 的理由：cache 是唯一的 per-endpoint policy 驱动 +
// 类型相关序列化横切关注点，policy（ep.Cache）和具体 Resp 类型都在手边，
// 无需注册表查 FullMethod→CachePolicy、无需 reflection 反序列化，
// 也消灭了「缓存命中漏鉴权」的拦截器顺序 footgun。
func Execute[Req, Resp any](e *Engine, ctx context.Context, ep *Endpoint[Req, Resp], req Req) (Resp, error) {
	var zero Resp

	// 1. 缓存命中直接返回（policy 在 ep 上，Resp 是具体类型，零 reflection）。
	if ep.Cache != nil && e.cache != nil {
		key := ep.Cache.Key(req)
		if hit, ok, err := e.cache.Get(ctx, key); err == nil && ok {
			var resp Resp
			// Resp 必须是 proto.Message 才能反序列化。
			if pm, ok := any(&resp).(proto.Message); ok {
				if err := proto.Unmarshal(hit, pm); err == nil {
					return resp, nil
				}
			}
		}
	}

	// 2. 真实调用：MapRequest → RawDo → MapResponse。
	params, err := ep.MapRequest(req)
	if err != nil {
		return zero, fmt.Errorf("map request: %w", err)
	}

	raw, err := e.RawDo(ctx, ep.Meta, params)
	if err != nil {
		return zero, err
	}

	resp, err := ep.MapResponse(raw)
	if err != nil {
		return zero, fmt.Errorf("map response: %w", err)
	}

	// 3. 回填缓存。
	if ep.Cache != nil && e.cache != nil {
		key := ep.Cache.Key(req)
		if pm, ok := any(&resp).(proto.Message); ok {
			if data, err := proto.Marshal(pm); err == nil {
				_ = e.cache.Set(ctx, key, data, ep.Cache.TTL)
			}
		}
	}

	return resp, nil
}
