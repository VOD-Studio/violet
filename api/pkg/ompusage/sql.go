// Package ompusage 提供原生宿主适配器共用的 PostgreSQL 契约，不依赖认证、HTTP 路由或 ORM。
package ompusage

import _ "embed"

const SchemaVersion = 1

// SchemaSQL 是初始 schema 的唯一来源；宿主迁移保存其不可变快照。
//
//go:embed schema.sql
var SchemaSQL string

// IngestSQL 依次绑定认证用户 ID 与已整体校验的事件 JSON 数组。
//
//go:embed queries/ingest.sql
var IngestSQL string

// SummarySQL 依次绑定用户 ID、包含端点的 UTC 窗口起点与当前时间。
//
//go:embed queries/summary.sql
var SummarySQL string

// ModelsSQL 的参数顺序与 SummarySQL 一致。
//
//go:embed queries/models.sql
var ModelsSQL string

// TimeseriesSQL 在相同三参数后绑定已校验的 day 或 hour 粒度。
//
//go:embed queries/timeseries.sql
var TimeseriesSQL string

// EventSchemaJSON 描述严格的上报事件，不包含数据库归属字段。
//
//go:embed event.schema.json
var EventSchemaJSON string
