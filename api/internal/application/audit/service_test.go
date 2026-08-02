package audit

import (
	"context"
	"errors"
	"testing"

	domainaudit "blog-api/internal/domain/audit"
)

// fakeStore AuditStore 的内存 stub，记录调用参数与返回值。
type fakeStore struct {
	// 返回值
	listRes     domainaudit.ListResult
	listErr     error
	listByUserRes domainaudit.ListResult
	listByUserErr error
	appendErr   error
	// 调用记录
	listCalls      []pageLimit
	listByUserCalls []listByUserCall
}

type pageLimit struct {
	page, limit int
}

type listByUserCall struct {
	userID       string
	page, limit  int
}

func (f *fakeStore) Append(_ context.Context, _ domainaudit.AuditLog) error {
	return f.appendErr
}

func (f *fakeStore) List(_ context.Context, page, limit int) (domainaudit.ListResult, error) {
	f.listCalls = append(f.listCalls, pageLimit{page, limit})
	return f.listRes, f.listErr
}

func (f *fakeStore) ListByUser(_ context.Context, userID string, page, limit int) (domainaudit.ListResult, error) {
	f.listByUserCalls = append(f.listByUserCalls, listByUserCall{userID, page, limit})
	return f.listByUserRes, f.listByUserErr
}

func TestService_List_PassesThroughStoreResult(t *testing.T) {
	logs := []domainaudit.AuditLog{
		{ID: 1, Action: "login", Resource: "auth", ResourceID: "42", IPAddress: "1.2.3.4"},
		{ID: 2, Action: "logout", Resource: "auth", ResourceID: "42"},
	}
	store := &fakeStore{listRes: domainaudit.ListResult{Logs: logs, Total: 2}}
	svc := NewService(store)

	got, err := svc.List(context.Background(), 2, 20)
	if err != nil {
		t.Fatalf("List 返回错误: %v", err)
	}
	if got.Total != 2 {
		t.Errorf("Total = %d, want 2", got.Total)
	}
	if len(got.Logs) != 2 {
		t.Fatalf("Logs 长度 = %d, want 2", len(got.Logs))
	}
	if got.Logs[0].Action != "login" || got.Logs[0].IPAddress != "1.2.3.4" {
		t.Errorf("首条日志 = %+v, want Action=login IPAddress=1.2.3.4", got.Logs[0])
	}
	// 透传分页参数到 store
	if len(store.listCalls) != 1 {
		t.Fatalf("store.List 调用 %d 次, want 1", len(store.listCalls))
	}
	if store.listCalls[0].page != 2 || store.listCalls[0].limit != 20 {
		t.Errorf("透传分页 = (%d,%d), want (2,20)", store.listCalls[0].page, store.listCalls[0].limit)
	}
}

func TestService_List_PropagatesStoreError(t *testing.T) {
	wantErr := errors.New("db down")
	store := &fakeStore{listErr: wantErr}
	svc := NewService(store)

	_, err := svc.List(context.Background(), 1, 10)
	if !errors.Is(err, wantErr) {
		t.Errorf("err = %v, want %v", err, wantErr)
	}
}

func TestService_ListByUser_PassesUserIDAndPagination(t *testing.T) {
	logs := []domainaudit.AuditLog{{ID: 7, Action: "create", Resource: "post"}}
	store := &fakeStore{listByUserRes: domainaudit.ListResult{Logs: logs, Total: 1}}
	svc := NewService(store)

	got, err := svc.ListByUser(context.Background(), "user-99", 3, 5)
	if err != nil {
		t.Fatalf("ListByUser 返回错误: %v", err)
	}
	if got.Total != 1 || len(got.Logs) != 1 {
		t.Fatalf("Total=%d, Logs=%d, want 1/1", got.Total, len(got.Logs))
	}
	// userID 与分页参数必须透传到 store
	if len(store.listByUserCalls) != 1 {
		t.Fatalf("store.ListByUser 调用 %d 次, want 1", len(store.listByUserCalls))
	}
	c := store.listByUserCalls[0]
	if c.userID != "user-99" || c.page != 3 || c.limit != 5 {
		t.Errorf("透传 = (user=%s, page=%d, limit=%d), want (user-99, 3, 5)", c.userID, c.page, c.limit)
	}
}
