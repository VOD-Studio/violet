package system

import (
	"context"
	"io"

	domainshared "blog-api/internal/domain/shared"
)

// GetDatabaseStatus 读取 PostgreSQL 诊断聚合。
func (s *Service) GetDatabaseStatus(ctx context.Context) (*DatabaseStatus, error) {
	if s.database == nil {
		return nil, domainshared.Internal("数据库诊断未配置", nil)
	}
	result, err := s.database.GetDatabaseStatus(ctx)
	if err != nil {
		return nil, operationError("读取数据库状态失败", err)
	}
	if s.db != nil {
		if sqlDB, dbErr := s.db.DB(); dbErr == nil {
			stats := sqlDB.Stats()
			result.Pool = PoolStats{
				InUse:     stats.InUse,
				Idle:      stats.Idle,
				MaxOpen:   stats.MaxOpenConnections,
				WaitCount: stats.WaitCount,
			}
		}
	}
	return result, nil
}

// GetDatabaseSchema 读取可管理的用户表、列与外键关系。
func (s *Service) GetDatabaseSchema(ctx context.Context) (*DatabaseSchema, error) {
	if s.database == nil {
		return nil, domainshared.Internal("数据库操作未配置", nil)
	}
	result, err := s.database.GetSchema(ctx)
	if err != nil {
		return nil, operationError("读取数据库结构失败", err)
	}
	return result, nil
}

// ExecuteSQL 执行系统面板 SQL 控制台请求。
func (s *Service) ExecuteSQL(ctx context.Context, input ExecuteSQLInput) (*SQLResult, error) {
	if s.database == nil {
		return nil, domainshared.Internal("数据库操作未配置", nil)
	}
	result, err := s.database.ExecuteSQL(ctx, input)
	if err != nil {
		return nil, operationError("SQL 执行失败", err)
	}
	return result, nil
}

// ExportData 打开表或只读查询结果的下载流。
func (s *Service) ExportData(ctx context.Context, input ExportInput) (io.ReadCloser, ExportMetadata, error) {
	if s.database == nil {
		return nil, ExportMetadata{}, domainshared.Internal("数据库导出未配置", nil)
	}
	stream, metadata, err := s.database.Export(ctx, input)
	if err != nil {
		return nil, ExportMetadata{}, operationError("数据导出失败", err)
	}
	return stream, metadata, nil
}

func operationError(message string, err error) error {
	if domainshared.AsDomainError(err) != nil {
		return err
	}
	return domainshared.Internal(message, err)
}
