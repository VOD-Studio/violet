// Package engine 的 Execute 泛型函数与 Endpoint 声明类型。
//
// Execute 串起缓存检查 → MapRequest → RawDo → MapResponse → 缓存回填。
// 缓存命中时跳过 RawDo，但 gRPC 链上的 auth/rate/trace/recovery 照常执行
// （它们在 interceptor，Execute 在 service 方法里被调用，时序在拦截器之后）。
//
// 类型参数设计：Req/Resp 都用 proto 生成的指针类型（如 *mmpb.GetSongDetailRequest）。
// 这是 gRPC 的天然签名，也避免 proto message 值拷贝 mutex 的问题（protoimpl.MessageState 含锁）。
// 缓存序列化用 proto.Message 接口（指针天然实现），反序列化用 reflect 构造实例。
package engine

import (
	"context"
	"encoding/json"
	"fmt"
	"reflect"
	"time"

	"google.golang.org/protobuf/proto"
)

// Endpoint 是一个网易云接口的完整声明。
//
// 数据（Meta + Cache）+ 两个映射函数（MapRequest + MapResponse）。
// 不是活跃服务，是声明。每接口一个包级 var。
//
// Req/Resp 用 proto 生成的指针类型（如 *mmpb.GetSongDetailRequest）。
type Endpoint[Req, Resp any] struct {
	// Meta 是网易云 endpoint 的执行元数据。
	Meta Meta
	// Cache 是缓存策略。nil 表示不缓存。
	Cache *CachePolicy[Req]
	// MapRequest 把 proto 请求转成网易云加密前的 params map。
	MapRequest func(req Req) (map[string]any, error)
	// MapResponse 把网易云原始 JSON 转成 proto 响应（指针类型）。
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
			if r, ok := unmarshalCached[Resp](hit); ok {
				return r, nil
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
		if pm, ok := any(resp).(proto.Message); ok {
			if data, err := proto.Marshal(pm); err == nil {
				_ = e.cache.Set(ctx, key, data, ep.Cache.TTL)
			}
		}
	}

	return resp, nil
}

// unmarshalCached 把缓存字节反序列化成 Resp（proto 指针类型）。
//
// Resp 是 *pb.X 形式。zero 是 nil 指针，reflect.TypeOf(zero) 可能返回 nil（typed nil）。
// 用 reflect 构造新实例：rt.Elem() 得到 pb.X，reflect.New 返回 *pb.X。
func unmarshalCached[Resp any](data []byte) (Resp, bool) {
	var zero Resp
	// 尝试类型断言确认 Resp 是 proto.Message 的指针类型。
	// zero 可能是 nil，any(nil指针) 的断言会失败，所以用 reflect。
	rt := reflect.TypeOf(zero)
	if rt == nil || rt.Kind() != reflect.Pointer {
		return zero, false
	}
	// 构造 *pb.X 的新实例。
	newVal := reflect.New(rt.Elem())
	pm, ok := newVal.Interface().(proto.Message)
	if !ok {
		return zero, false
	}
	if err := proto.Unmarshal(data, pm); err != nil {
		return zero, false
	}
	r, ok := newVal.Interface().(Resp)
	return r, ok
}
