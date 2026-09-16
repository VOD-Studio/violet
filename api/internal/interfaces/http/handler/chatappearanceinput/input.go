// Package chatappearanceinput 校验外观端点收窄后的请求载荷。
package chatappearanceinput

import (
	"encoding/json"
	"fmt"
	"io"
	"strings"

	domain "blog-api/internal/domain/chatappearance"
)

// MaxBodyBytes 在解码前拦住超大输入。
const MaxBodyBytes = 2048

// Decode 只接受恰好一个 JSON 对象,缺键、null、未知键与重复键一律拒绝。
func Decode(reader io.Reader) (domain.State, error) {
	var zero domain.State
	data, err := io.ReadAll(io.LimitReader(reader, MaxBodyBytes+1))
	if err != nil {
		return zero, err
	}
	if len(data) > MaxBodyBytes {
		return zero, fmt.Errorf("%w: 请求体过大", domain.ErrInvalid)
	}
	dec := json.NewDecoder(strings.NewReader(string(data)))
	token, err := dec.Token()
	if err != nil || token != json.Delim('{') {
		return zero, domain.ErrInvalid
	}
	fields := make(map[string]json.RawMessage, 4)
	for dec.More() {
		token, err = dec.Token()
		if err != nil {
			return zero, domain.ErrInvalid
		}
		key, ok := token.(string)
		if !ok {
			return zero, domain.ErrInvalid
		}
		if _, exists := fields[key]; exists {
			return zero, domain.ErrInvalid
		}
		switch key {
		case "avatar_frame_id", "avatar_charm_id", "bubble_theme_id", "revision":
		default:
			return zero, domain.ErrInvalid
		}
		var raw json.RawMessage
		if dec.Decode(&raw) != nil || string(raw) == "null" {
			return zero, domain.ErrInvalid
		}
		fields[key] = raw
	}
	token, err = dec.Token()
	if err != nil || token != json.Delim('}') || len(fields) != 4 {
		return zero, domain.ErrInvalid
	}
	if _, err = dec.Token(); err != io.EOF {
		return zero, domain.ErrInvalid
	}
	var result domain.State
	for key, target := range map[string]any{
		"avatar_frame_id": &result.AvatarFrameID,
		"avatar_charm_id": &result.AvatarCharmID,
		"bubble_theme_id": &result.BubbleThemeID,
		"revision":        &result.Revision,
	} {
		if json.Unmarshal(fields[key], target) != nil {
			return zero, domain.ErrInvalid
		}
	}
	if result.Revision < 0 || result.Revision > domain.MaxRevision {
		return zero, domain.ErrInvalid
	}
	if err = result.Validate(); err != nil {
		return zero, err
	}
	return result, nil
}

// ParseUserIDs 校验有上界的逗号分隔查询参数,并把 UUID 统一为小写。
func ParseUserIDs(value string) ([]string, error) {
	if len(value) == 0 || len(value) > domain.MaxBatch*37 {
		return nil, domain.ErrInvalid
	}
	ids := strings.Split(value, ",")
	if len(ids) > domain.MaxBatch {
		return nil, domain.ErrInvalid
	}
	for i := range ids {
		ids[i] = strings.ToLower(strings.TrimSpace(ids[i]))
		if !domain.ValidUserID(ids[i]) {
			return nil, domain.ErrInvalid
		}
	}
	return ids, nil
}
