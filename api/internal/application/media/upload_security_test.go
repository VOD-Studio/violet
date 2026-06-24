package media

import (
	"context"
	"testing"
	"time"

	domainshared "blog-api/internal/domain/shared"
	domainupload "blog-api/internal/domain/upload"
)

// ownerMismatchSessionRepo 假的 sessionRepo,FindByID 返回固定 owner 的会话
// 其余接口方法返回零值(编译需要,本测试不触达)
type ownerMismatchSessionRepo struct{ ownerID domainshared.ID }

func (m *ownerMismatchSessionRepo) FindByID(ctx context.Context, id domainshared.ID) (*domainupload.UploadSession, error) {
	zero := time.Time{}
	return domainupload.ReconstructUploadSession(
		id, m.ownerID, "f.jpg", 100, "image/jpeg", "hash", "avatar",
		100, 1, []int{}, domainupload.SessionActive, "/tmp/x", zero, zero, zero,
	), nil
}
func (m *ownerMismatchSessionRepo) FindByHash(ctx context.Context, hash string, userID domainshared.ID) (*domainupload.UploadSession, error) {
	return nil, nil
}
func (m *ownerMismatchSessionRepo) Save(ctx context.Context, s *domainupload.UploadSession) error { return nil }
func (m *ownerMismatchSessionRepo) UpdateStatus(ctx context.Context, id domainshared.ID, oldStatus, newStatus string) (bool, error) {
	return false, nil
}
func (m *ownerMismatchSessionRepo) AppendChunk(ctx context.Context, id domainshared.ID, index int) error { return nil }
func (m *ownerMismatchSessionRepo) Delete(ctx context.Context, id domainshared.ID) error                { return nil }
func (m *ownerMismatchSessionRepo) DeleteExpired(ctx context.Context) error                            { return nil }

var _ domainupload.UploadSessionRepository = (*ownerMismatchSessionRepo)(nil)

// TestSaveChunk_RejectsNonOwner 非会话 owner 调用 SaveChunk 应返回 Forbidden
func TestSaveChunk_RejectsNonOwner(t *testing.T) {
	ownerA := domainshared.NewID()
	ownerB := domainshared.NewID()
	repo := &ownerMismatchSessionRepo{ownerID: ownerA}
	svc := NewUploadService(nil, repo, nil, "/tmp")
	err := svc.SaveChunk(context.Background(), "00000000-0000-0000-0000-000000000001", 0, []byte("x"), ownerB.String())
	if err == nil {
		t.Fatal("非 owner 应被拒绝")
	}
	if !domainshared.IsDomainError(err, domainshared.CodeForbidden) {
		t.Fatalf("应为 Forbidden,实际: %v", err)
	}
}

// TestCancelUpload_RejectsNonOwner 非会话 owner 调用 CancelUpload 应返回 Forbidden
func TestCancelUpload_RejectsNonOwner(t *testing.T) {
	ownerA := domainshared.NewID()
	ownerB := domainshared.NewID()
	repo := &ownerMismatchSessionRepo{ownerID: ownerA}
	svc := NewUploadService(nil, repo, nil, "/tmp")
	err := svc.CancelUpload(context.Background(), "00000000-0000-0000-0000-000000000001", ownerB.String())
	if err == nil {
		t.Fatal("非 owner 应被拒绝")
	}
	if !domainshared.IsDomainError(err, domainshared.CodeForbidden) {
		t.Fatalf("应为 Forbidden,实际: %v", err)
	}
}

// TestGetUploadStatus_RejectsNonOwner 非会话 owner 调用 GetUploadStatus 应返回 Forbidden
func TestGetUploadStatus_RejectsNonOwner(t *testing.T) {
	ownerA := domainshared.NewID()
	ownerB := domainshared.NewID()
	repo := &ownerMismatchSessionRepo{ownerID: ownerA}
	svc := NewUploadService(nil, repo, nil, "/tmp")
	_, err := svc.GetUploadStatus(context.Background(), "00000000-0000-0000-0000-000000000001", ownerB.String())
	if err == nil {
		t.Fatal("非 owner 应被拒绝")
	}
	if !domainshared.IsDomainError(err, domainshared.CodeForbidden) {
		t.Fatalf("应为 Forbidden,实际: %v", err)
	}
}

// TestGetUploadStatus_AllowsOwner owner 本人查询应放行(校验通过后走正常流程,
// fake repo 的 FindByID 返回 active 会话,owner 一致时不应返回 Forbidden)
func TestGetUploadStatus_AllowsOwner(t *testing.T) {
	owner := domainshared.NewID()
	repo := &ownerMismatchSessionRepo{ownerID: owner}
	svc := NewUploadService(nil, repo, nil, "/tmp")
	_, err := svc.GetUploadStatus(context.Background(), "00000000-0000-0000-0000-000000000001", owner.String())
	// owner 一致 → 不应返回 Forbidden(可能因其他原因出错,但绝不应是 Forbidden)
	if err != nil && domainshared.IsDomainError(err, domainshared.CodeForbidden) {
		t.Fatalf("owner 本人不应被 Forbidden,实际: %v", err)
	}
}
