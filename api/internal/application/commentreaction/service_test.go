package commentreaction

import (
	"context"
	"errors"
	"testing"

	domaincr "blog-api/internal/domain/commentreaction"
)

// fakeStore CommentReactionStore 的内存 stub，记录调用参数与返回值。
type fakeStore struct {
	listRes  []domaincr.AggregatedReaction
	listErr  error
	batchRes []domaincr.ReactionList
	batchErr error

	listCalls  []listCall
	batchCalls []batchCall
	addCalls   []addCall
	rmCalls    []removeCall
}

type listCall struct {
	commentID, viewerUserID string
}

type batchCall struct {
	commentIDs   []string
	viewerUserID string
}

type addCall struct {
	commentID, userID, ipHash string
	emojiID                   int32
}

type removeCall = addCall

func (f *fakeStore) ListByComment(_ context.Context, commentID, viewerUserID string) ([]domaincr.AggregatedReaction, error) {
	f.listCalls = append(f.listCalls, listCall{commentID, viewerUserID})
	return f.listRes, f.listErr
}

func (f *fakeStore) BatchByComments(_ context.Context, commentIDs []string, viewerUserID string) ([]domaincr.ReactionList, error) {
	f.batchCalls = append(f.batchCalls, batchCall{commentIDs, viewerUserID})
	return f.batchRes, f.batchErr
}

func (f *fakeStore) Add(_ context.Context, commentID, userID, ipHash string, emojiID int32) error {
	f.addCalls = append(f.addCalls, addCall{commentID, userID, ipHash, emojiID})
	return nil
}

func (f *fakeStore) Remove(_ context.Context, commentID, userID, ipHash string, emojiID int32) error {
	f.rmCalls = append(f.rmCalls, removeCall{commentID, userID, ipHash, emojiID})
	return nil
}

func TestService_List_PassesCommentAndViewer(t *testing.T) {
	want := []domaincr.AggregatedReaction{
		{EmojiID: 1, EmojiName: "👍", Count: 3, Self: true},
		{EmojiID: 2, EmojiName: "❤️", Count: 1, Self: false},
	}
	store := &fakeStore{listRes: want}
	svc := NewService(store)

	got, err := svc.List(context.Background(), "c-1", "u-1")
	if err != nil {
		t.Fatalf("List 返回错误: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("返回 %d 条反应, want 2", len(got))
	}
	if got[0].EmojiID != 1 || got[0].Count != 3 || !got[0].Self {
		t.Errorf("首条 = %+v, want EmojiID=1 Count=3 Self=true", got[0])
	}
	if got[1].EmojiName != "❤️" {
		t.Errorf("第二条 EmojiName = %q, want ❤️", got[1].EmojiName)
	}
	// commentID 与 viewer 必须透传
	if len(store.listCalls) != 1 {
		t.Fatalf("store.ListByComment 调用 %d 次, want 1", len(store.listCalls))
	}
	if store.listCalls[0].commentID != "c-1" || store.listCalls[0].viewerUserID != "u-1" {
		t.Errorf("透传 = (%+v), want commentID=c-1 viewerUserID=u-1", store.listCalls[0])
	}
}

func TestService_List_PropagatesStoreError(t *testing.T) {
	wantErr := errors.New("store unavailable")
	store := &fakeStore{listErr: wantErr}
	svc := NewService(store)

	if _, err := svc.List(context.Background(), "c-1", ""); !errors.Is(err, wantErr) {
		t.Errorf("err = %v, want %v", err, wantErr)
	}
}

func TestService_Batch_FansOutToStore(t *testing.T) {
	want := []domaincr.ReactionList{
		{CommentID: "c-1", Reactions: []domaincr.AggregatedReaction{{EmojiID: 1, Count: 2}}},
		{CommentID: "c-2", Reactions: nil},
	}
	store := &fakeStore{batchRes: want}
	svc := NewService(store)

	got, err := svc.Batch(context.Background(), []string{"c-1", "c-2"}, "u-9")
	if err != nil {
		t.Fatalf("Batch 返回错误: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("返回 %d 条列表, want 2", len(got))
	}
	if got[0].CommentID != "c-1" || len(got[0].Reactions) != 1 {
		t.Errorf("首条 = %+v, want CommentID=c-1 1 reaction", got[0])
	}
	if got[1].CommentID != "c-2" {
		t.Errorf("第二条 CommentID = %q, want c-2", got[1].CommentID)
	}
	// 透传校验
	if len(store.batchCalls) != 1 {
		t.Fatalf("store.BatchByComments 调用 %d 次, want 1", len(store.batchCalls))
	}
	bc := store.batchCalls[0]
	if len(bc.commentIDs) != 2 || bc.commentIDs[0] != "c-1" || bc.commentIDs[1] != "c-2" {
		t.Errorf("透传 commentIDs = %v, want [c-1 c-2]", bc.commentIDs)
	}
	if bc.viewerUserID != "u-9" {
		t.Errorf("透传 viewerUserID = %q, want u-9", bc.viewerUserID)
	}
}
