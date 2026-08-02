package shared

import (
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ============================================================
// ID
// ============================================================

func TestNewID_GeneratesNonZeroUnique(t *testing.T) {
	a := NewID()
	b := NewID()

	assert.False(t, a.IsZero(), "NewID 不应生成零值")
	assert.False(t, b.IsZero())
	assert.False(t, a.Equal(b), "两次 NewID 应互不相等")
	assert.NotEqual(t, uuid.Nil, a.UUID())
}

func TestID_String_RoundTrips(t *testing.T) {
	id := NewID()
	s := id.String()

	assert.NotEmpty(t, s)
	assert.Equal(t, 36, len(s), "UUID v4 字符串长度应为 36")

	parsed, err := ParseID(s)
	require.NoError(t, err)
	assert.True(t, id.Equal(parsed), "String→ParseID 应可往返")
}

func TestParseID_Valid(t *testing.T) {
	raw := "550e8400-e29b-41d4-a716-446655440000"
	id, err := ParseID(raw)

	assert.NoError(t, err)
	assert.False(t, id.IsZero())
	assert.Equal(t, raw, id.String())
}

func TestParseID_InvalidReturnsErrInvalidID(t *testing.T) {
	id, err := ParseID("not-a-uuid")

	assert.Error(t, err)
	assert.True(t, id.IsZero(), "解析失败应返回零值 ID")
	assert.True(t, IsDomainError(err, "INVALID_ID"), "应返回 INVALID_ID 领域错误")
	// Unwrap 链应暴露底层解析错误
	assert.ErrorIs(t, err, errors.Unwrap(err))
}

func TestParseID_EmptyString(t *testing.T) {
	_, err := ParseID("")
	assert.Error(t, err)
}

func TestMustParseID_Valid(t *testing.T) {
	raw := "550e8400-e29b-41d4-a716-446655440000"
	id := MustParseID(raw)
	assert.Equal(t, raw, id.String())
}

func TestMustParseID_InvalidPanics(t *testing.T) {
	assert.Panics(t, func() {
		MustParseID("bogus")
	})
}

func TestID_IsZero(t *testing.T) {
	var zero ID
	assert.True(t, zero.IsZero(), "零值 ID 应 IsZero")

	assert.False(t, NewID().IsZero())
}

func TestID_Equal(t *testing.T) {
	a := NewID()
	assert.True(t, a.Equal(a), "ID 与自身相等")
	assert.False(t, a.Equal(NewID()), "不同 ID 不应相等")

	var zero ID
	assert.True(t, zero.Equal(ID{}), "两个零值 ID 相等")
}

// ============================================================
// AggregateRoot
// ============================================================

// fakeEvent 测试用领域事件
type fakeEvent struct {
	BaseEvent
	payload string
}

func TestAggregateRoot_GetSetID(t *testing.T) {
	var root AggregateRoot
	assert.True(t, root.GetID().IsZero(), "零值聚合根 ID 应为零值")

	id := NewID()
	root.SetID(id)
	assert.True(t, root.GetID().Equal(id))
}

func TestAggregateRoot_RecordEvent_PullEvents(t *testing.T) {
	var root AggregateRoot
	root.SetID(NewID())

	assert.False(t, root.HasEvents())

	ev1 := fakeEvent{BaseEvent: NewBaseEvent("music.playlist.created", root.GetID()), payload: "a"}
	ev2 := fakeEvent{BaseEvent: NewBaseEvent("music.playlist.updated", root.GetID()), payload: "b"}

	root.RecordEvent(ev1)
	root.RecordEvent(ev2)

	assert.True(t, root.HasEvents(), "记录事件后应有待发布事件")

	pulled := root.PullEvents()
	assert.Len(t, pulled, 2)
	assert.False(t, root.HasEvents(), "PullEvents 后应清空事件队列")
	assert.Equal(t, "music.playlist.created", pulled[0].EventName())
	assert.Equal(t, "music.playlist.updated", pulled[1].EventName())

	// 再次 Pull 应返回 nil
	assert.Nil(t, root.PullEvents())
}

// ============================================================
// Timestamps
// ============================================================

func TestTimestamps_Construct(t *testing.T) {
	now := time.Now()
	ts := Timestamps{CreatedAt: now, UpdatedAt: now.Add(time.Hour)}

	assert.True(t, ts.CreatedAt.Equal(now))
	assert.True(t, ts.UpdatedAt.Equal(now.Add(time.Hour)))
}

// ============================================================
// DomainError
// ============================================================

func TestNewError_Construct(t *testing.T) {
	de := NewError("USER_NOT_FOUND", "用户不存在")

	assert.Equal(t, ErrorCode("USER_NOT_FOUND"), de.Code)
	assert.Equal(t, "用户不存在", de.Message)
	assert.Nil(t, de.Err)
}

func TestDomainError_Error_WithoutErr(t *testing.T) {
	de := NewError("BAD_REQUEST", "参数错误")
	assert.Equal(t, "BAD_REQUEST: 参数错误", de.Error())
}

func TestDomainError_Error_WithErr(t *testing.T) {
	base := errors.New("db connection refused")
	de := NewError("INTERNAL_ERROR", "服务器内部错误").WithErr(base)

	assert.Contains(t, de.Error(), "INTERNAL_ERROR: 服务器内部错误")
	assert.Contains(t, de.Error(), "caused by: db connection refused")
}

func TestDomainError_WithErr_ChainsUnwrap(t *testing.T) {
	base := errors.New("orig")
	de := NewError("X", "msg").WithErr(base)

	assert.ErrorIs(t, de, base, "errors.Is 应通过 Unwrap 命中底层错误")
	assert.Equal(t, base, de.Unwrap())
}

func TestDomainError_WithErr_FluentReturnsSamePointer(t *testing.T) {
	de := NewError("X", "msg")
	same := de.WithErr(errors.New("e"))
	assert.Same(t, de, same, "WithErr 应返回同一指针以支持链式调用")
}

func TestDomainError_WithMessage_Overrides(t *testing.T) {
	de := NewError("X", "旧消息").WithMessage("新消息")
	assert.Equal(t, "新消息", de.Message)
	assert.Same(t, de, de.WithMessage("x"))
}

func TestDomainError_ConvenienceConstructors(t *testing.T) {
	cases := []struct {
		name string
		got  *DomainError
		code ErrorCode
	}{
		{"NotFound", NotFound("歌单"), CodeNotFound},
		{"BadRequest", BadRequest("参数错"), CodeBadRequest},
		{"Unauthorized", Unauthorized("未认证"), CodeUnauthorized},
		{"Forbidden", Forbidden("无权限"), CodeForbidden},
		{"Conflict", Conflict("冲突"), CodeConflict},
		{"Validation", Validation("校验失败"), CodeValidation},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			assert.Equal(t, c.code, c.got.Code)
			assert.NotEmpty(t, c.got.Message)
		})
	}
}

func TestInternal_WrapsUnderlying(t *testing.T) {
	base := errors.New("boom")
	de := Internal("服务器错误", base)
	assert.Equal(t, CodeInternal, de.Code)
	assert.ErrorIs(t, de, base)
}

func TestIsDomainError(t *testing.T) {
	de := BadRequest("x")

	assert.True(t, IsDomainError(de, CodeBadRequest))
	assert.False(t, IsDomainError(de, CodeNotFound), "码不匹配应为 false")

	// 非 DomainError
	assert.False(t, IsDomainError(errors.New("plain"), CodeBadRequest))
}

func TestAsDomainError(t *testing.T) {
	de := Conflict("slug 冲突")
	wrapped := errors.Join(errors.New("ctx"), de) // 包装一层

	extracted := AsDomainError(wrapped)
	require.NotNil(t, extracted, "errors.As 应能透过包装提取 DomainError")
	assert.Equal(t, CodeConflict, extracted.Code)
	assert.True(t, strings.Contains(extracted.Message, "slug"))

	// 非领域错误返回 nil
	assert.Nil(t, AsDomainError(errors.New("plain error")))
}

// ============================================================
// BaseEvent
// ============================================================

func TestNewBaseEvent_Accessors(t *testing.T) {
	aggID := NewID()
	before := time.Now()
	ev := NewBaseEvent("user.registered", aggID)
	after := time.Now()

	assert.Equal(t, "user.registered", ev.EventName())
	assert.NotEqual(t, uuid.Nil, ev.EventID(), "事件 ID 应被自动生成")
	assert.False(t, ev.AggregateID().IsZero())
	assert.True(t, ev.AggregateID().Equal(aggID))

	// occurredAt 应介于构造前后之间
	assert.False(t, ev.OccurredAt().Before(before))
	assert.False(t, ev.OccurredAt().After(after))
}

func TestBaseEvent_UniqueEventIDs(t *testing.T) {
	aggID := NewID()
	a := NewBaseEvent("x", aggID)
	b := NewBaseEvent("x", aggID)
	assert.NotEqual(t, a.EventID(), b.EventID(), "每个事件应有唯一 ID")
}

func TestBaseEvent_ImplementsDomainEvent(t *testing.T) {
	// 编译期断言：BaseEvent 实现 DomainEvent 接口
	var _ DomainEvent = BaseEvent{}
}
