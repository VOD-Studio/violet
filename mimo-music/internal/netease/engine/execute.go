// Package engine 的 Execute 泛型函数与 Endpoint 声明类型。
//
// Execute 串起缓存检查 → MapRequest → RawDo → MapResponse → 缓存回填。
// 缓存命中时跳过 RawDo，但 gRPC 链上的 auth/rate/trace/recovery 照常执行
// （它们在 interceptor，Execute 在 service 方法里被调用，时序在拦截器之后）。
//
// 类型参数设计：Req/Resp 都用 proto 生成的指针类型（如 *mmpb.GetSongDetailRequest）。
// 这是 gRPC 的天然签名，也避免 proto message 值拷贝 mutex 的问题（protoimpl.MessageState 含锁）。
// 缓存序列化/反序列化用 proto.Message 接口（指针天然实现），零 reflection。
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
// 数据（Meta + Cache + NewResp）+ 两个映射函数（MapRequest + MapResponse）。
// 不是活跃服务，是声明。每接口一个包级 var。
//
// Req/Resp 用 proto 生成的指针类型（如 *mmpb.GetSongDetailRequest）。
type Endpoint[Req, Resp any] struct {
	// Meta 是网易云 endpoint 的执行元数据。
	Meta Meta
	// PathFunc 可选:按请求动态生成 path(覆盖 Meta.Path)。
	// 部分网易云接口把 id 拼在 path 里(/weapi/artist/albums/{id}),
	// body 传 id 的形式上游 400——此类接口声明 PathFunc。
	PathFunc func(Req) string
	// Cache 是缓存策略。nil 表示不缓存。
	Cache *CachePolicy[Req]
	// NewResp 构造响应实例，用于缓存命中时反序列化。
	// 避免用 reflect 构造（ADR §4.5 零 reflection）。声明形如 func() *mmpb.X { return &mmpb.X{} }。
	NewResp func() Resp
	// MapRequest 把 proto 请求转成网易云加密前的 params map。
	MapRequest func(req Req) (map[string]any, error)
	// MapResponse 把网易云原始 JSON 转成 proto 响应（指针类型）。
	// 接收原始请求，使映射可按请求字段分支（如搜索按 type 分发、歌单按 filter 过滤）。
	MapResponse func(req Req, raw json.RawMessage) (Resp, error)
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
// 缓存命中时跳过 RawDo。cache 在此处而非 interceptor 的理由：cache 是唯一的
// per-endpoint policy 驱动 + 类型相关序列化横切关注点，policy 和具体 Resp 类型都在手边，
// 无需注册表查 FullMethod→CachePolicy、无需 reflection 反序列化，
// 也消灭了「缓存命中漏鉴权」的拦截器顺序 footgun。
func Execute[Req, Resp any](e *Engine, ctx context.Context, ep *Endpoint[Req, Resp], req Req) (Resp, error) {
	var zero Resp

	// 1. 缓存命中直接返回。
	if ep.Cache != nil && e.cache != nil {
		key := ep.Cache.Key(req)
		if hit, ok, err := e.cache.Get(ctx, key); err == nil && ok {
			if r, ok := unmarshalCached(ep.NewResp, hit); ok {
				return r, nil
			}
		}
	}

	// 2. 真实调用：MapRequest → RawDo → MapResponse。
	params, err := ep.MapRequest(req)
	if err != nil {
		return zero, fmt.Errorf("map request: %w", err)
	}

	meta := ep.Meta
	if ep.PathFunc != nil {
		meta.Path = ep.PathFunc(req)
	}

	raw, err := e.RawDo(ctx, meta, params)
	if err != nil {
		return zero, err
	}

	resp, err := ep.MapResponse(req, raw)
	if err != nil {
		return zero, fmt.Errorf("map response: %w", err)
	}

	// 3. 回填缓存。
	if ep.Cache != nil && e.cache != nil {
		key := ep.Cache.Key(req)
		if pm, ok := any(resp).(proto.Message); ok {
			if data, err := proto.Marshal(pm); err == nil {
				_ = e.cache.Set(ctx, key, data, ep.Cache.TTL)
			}
		}
	}

	return resp, nil
}

// unmarshalCached 用 NewResp 工厂构造实例，把缓存字节反序列化成 Resp。
//
// 零 reflection：NewResp 是 endpoint 声明的构造函数（如 func() *mmpb.X { return &mmpb.X{} }），
// 返回值天然实现 proto.Message，直接 proto.Unmarshal 填充。
func unmarshalCached[Resp any](newResp func() Resp, data []byte) (Resp, bool) {
	var zero Resp
	if newResp == nil {
		return zero, false
	}
	r := newResp()
	pm, ok := any(r).(proto.Message)
	if !ok {
		return zero, false
	}
	if err := proto.Unmarshal(data, pm); err != nil {
		return zero, false
	}
	return r, true
}
