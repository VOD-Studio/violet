package presence

import (
	"bytes"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"io"
	"math"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	apppresence "blog-api/internal/application/presence"
	domainpresence "blog-api/internal/domain/presence"
)

// nowbeam.v1 线上消息。字段名与协议 Schema 一致（camelCase），与站点 REST 的 snake_case 无关。

type wireApplication struct {
	DisplayName string `json:"displayName"`
}

type wireWindow struct {
	Title string `json:"title"`
}

type wirePlayback struct {
	State      string       `json:"state"`
	DurationMS *int64       `json:"durationMs"`
	PositionMS *int64       `json:"positionMs"`
	Rate       *json.Number `json:"rate"`
}

type wireMedia struct {
	SessionID  string       `json:"sessionId"`
	PlayerName string       `json:"playerName"`
	Title      string       `json:"title"`
	Artist     *string      `json:"artist"`
	Album      *string      `json:"album"`
	Playback   wirePlayback `json:"playback"`
}

type wireSources struct {
	Application *wireApplication `json:"application"`
	Window      *wireWindow      `json:"window"`
	Media       *wireMedia       `json:"media"`
}

type wireSnapshot struct {
	ProtocolVersion int         `json:"protocolVersion"`
	Type            string      `json:"type"`
	ConnectionID    string      `json:"connectionId"`
	Sequence        int64       `json:"sequence"`
	ObservedAt      string      `json:"observedAt"`
	Sources         wireSources `json:"sources"`
}

type wireWelcome struct {
	ProtocolVersion     int    `json:"protocolVersion"`
	Type                string `json:"type"`
	ConnectionID        string `json:"connectionId"`
	DeviceID            string `json:"deviceId"`
	ServerTime          string `json:"serverTime"`
	HeartbeatIntervalMS int64  `json:"heartbeatIntervalMs"`
	LeaseDurationMS     int64  `json:"leaseDurationMs"`
	MaxMessageBytes     int    `json:"maxMessageBytes"`
}

type wireAck struct {
	ProtocolVersion int    `json:"protocolVersion"`
	Type            string `json:"type"`
	ConnectionID    string `json:"connectionId"`
	Sequence        int64  `json:"sequence"`
	ReceivedAt      string `json:"receivedAt"`
	ExpiresAt       string `json:"expiresAt"`
}

type wireError struct {
	ProtocolVersion int    `json:"protocolVersion"`
	Type            string `json:"type"`
	ConnectionID    string `json:"connectionId"`
	Sequence        *int64 `json:"sequence"`
	Code            string `json:"code"`
}

func newWelcome(connectionID, deviceID string, now time.Time) wireWelcome {
	return wireWelcome{
		ProtocolVersion: 1, Type: "welcome", ConnectionID: connectionID, DeviceID: deviceID, ServerTime: wireTime(now),
		HeartbeatIntervalMS: domainpresence.HeartbeatInterval.Milliseconds(),
		LeaseDurationMS:     domainpresence.Lease.Milliseconds(),
		MaxMessageBytes:     domainpresence.MaxMessageBytes,
	}
}

func newAck(ack apppresence.Ack) wireAck {
	return wireAck{
		ProtocolVersion: 1, Type: "ack", ConnectionID: ack.ConnectionID, Sequence: ack.Sequence,
		ReceivedAt: wireTime(ack.ReceivedAt), ExpiresAt: wireTime(ack.ExpiresAt),
	}
}

func wireTime(t time.Time) string { return t.UTC().Format("2006-01-02T15:04:05.000Z") }

var (
	errInvalidMessage = errors.New("invalid_message")
	connectionIDRe    = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)
	timestampRe       = regexp.MustCompile(`^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-5][0-9](\.[0-9]{1,3})?Z$`)
)

// parseSnapshot 严格解码一条快照：未声明字段、缺键、重复键、非有限数字都拒收；
// 指纹取规范化后的消息，键顺序、空白与等值数字写法不影响重复判定。
func parseSnapshot(data []byte) (apppresence.Snapshot, error) {
	var empty apppresence.Snapshot
	if len(data) > domainpresence.MaxMessageBytes {
		return empty, errInvalidMessage
	}
	v, err := decodeObject(data)
	if err != nil {
		return empty, err
	}
	m, ok := object(v, "protocolVersion", "type", "connectionId", "sequence", "observedAt", "sources")
	if !ok || m["type"] != "snapshot" {
		return empty, errInvalidMessage
	}
	if _, ok := integer(m["protocolVersion"], 1, 1); !ok {
		return empty, errInvalidMessage
	}
	connectionID, ok := m["connectionId"].(string)
	if !ok || !connectionIDRe.MatchString(connectionID) {
		return empty, errInvalidMessage
	}
	sequence, ok := integer(m["sequence"], 1, domainpresence.MaxSequence)
	if !ok {
		return empty, errInvalidMessage
	}
	observedAt, ok := m["observedAt"].(string)
	if !ok || !validTime(observedAt) {
		return empty, errInvalidMessage
	}
	sources, ok := parseSources(m["sources"])
	if !ok {
		return empty, errInvalidMessage
	}
	domainSources := sources.toDomain()
	if err := domainSources.Validate(); err != nil {
		return empty, errInvalidMessage
	}
	canonical, err := json.Marshal(wireSnapshot{1, "snapshot", connectionID, sequence, observedAt, sources})
	if err != nil {
		return empty, errInvalidMessage
	}
	return apppresence.Snapshot{
		ConnectionID: connectionID, Sequence: sequence, Sources: domainSources, Fingerprint: sha256.Sum256(canonical),
	}, nil
}

func parseSources(v any) (wireSources, bool) {
	var sources wireSources
	m, ok := object(v, "application", "window", "media")
	if !ok {
		return sources, false
	}
	if m["application"] != nil {
		a, ok := object(m["application"], "displayName")
		name, isString := a["displayName"].(string)
		if !ok || !isString {
			return sources, false
		}
		sources.Application = &wireApplication{name}
	}
	if m["window"] != nil {
		w, ok := object(m["window"], "title")
		title, isString := w["title"].(string)
		if !ok || !isString {
			return sources, false
		}
		sources.Window = &wireWindow{title}
	}
	if m["media"] != nil {
		media, ok := parseMedia(m["media"])
		if !ok {
			return sources, false
		}
		sources.Media = &media
	}
	return sources, true
}

func parseMedia(v any) (wireMedia, bool) {
	var media wireMedia
	m, ok := object(v, "sessionId", "playerName", "title", "artist", "album", "playback")
	if !ok {
		return media, false
	}
	var okID, okPlayer, okTitle, okArtist, okAlbum, okPlayback bool
	media.SessionID, okID = m["sessionId"].(string)
	media.PlayerName, okPlayer = m["playerName"].(string)
	media.Title, okTitle = m["title"].(string)
	media.Artist, okArtist = nullableString(m["artist"])
	media.Album, okAlbum = nullableString(m["album"])
	media.Playback, okPlayback = parsePlayback(m["playback"])
	return media, okID && okPlayer && okTitle && okArtist && okAlbum && okPlayback
}

func parsePlayback(v any) (wirePlayback, bool) {
	var playback wirePlayback
	m, ok := object(v, "state", "durationMs", "positionMs", "rate")
	if !ok {
		return playback, false
	}
	if playback.State, ok = m["state"].(string); !ok {
		return playback, false
	}
	if playback.DurationMS, ok = nullableInteger(m["durationMs"], 1); !ok {
		return playback, false
	}
	if playback.PositionMS, ok = nullableInteger(m["positionMs"], 0); !ok {
		return playback, false
	}
	if m["rate"] != nil {
		rate, ok := parseRate(m["rate"])
		if !ok {
			return playback, false
		}
		playback.Rate = &rate
	}
	return playback, true
}

func (s wireSources) toDomain() domainpresence.Sources {
	var out domainpresence.Sources
	if s.Application != nil {
		out.Application = &domainpresence.Application{DisplayName: s.Application.DisplayName}
	}
	if s.Window != nil {
		out.Window = &domainpresence.Window{Title: s.Window.Title}
	}
	if m := s.Media; m != nil {
		media := &domainpresence.Media{
			SessionID: m.SessionID, PlayerName: m.PlayerName, Title: m.Title, Artist: m.Artist, Album: m.Album,
			Playback: domainpresence.Playback{
				State:      domainpresence.PlaybackState(m.Playback.State),
				DurationMS: m.Playback.DurationMS,
				PositionMS: m.Playback.PositionMS,
			},
		}
		if m.Playback.Rate != nil {
			// parseRate 已把速率规范为精确十进制并限定在 [0, 4]，转浮点只用于展示；
			// 极小的正速率下溢为 0 时取最小正浮点，避免被误判成暂停
			rate, _ := strconv.ParseFloat(m.Playback.Rate.String(), 64)
			if rate == 0 && *m.Playback.Rate != "0" {
				rate = math.SmallestNonzeroFloat64
			}
			media.Playback.Rate = &rate
		}
		out.Media = media
	}
	return out
}

func validTime(s string) bool {
	if !timestampRe.MatchString(s) {
		return false
	}
	_, err := time.Parse(time.RFC3339Nano, s)
	return err == nil
}

// decodeObject 保留数字原文，拒绝重复键、孤立代理码点和过深嵌套。
func decodeObject(data []byte) (map[string]any, error) {
	if !utf8.Valid(data) || !validEscapes(data) {
		return nil, errInvalidMessage
	}
	d := json.NewDecoder(bytes.NewReader(data))
	d.UseNumber()
	v, err := decodeValue(d, 0)
	if err != nil {
		return nil, errInvalidMessage
	}
	if _, err = d.Token(); err != io.EOF {
		return nil, errInvalidMessage
	}
	m, ok := v.(map[string]any)
	if !ok {
		return nil, errInvalidMessage
	}
	return m, nil
}

func decodeValue(d *json.Decoder, depth int) (any, error) {
	if depth > 16 {
		return nil, errInvalidMessage
	}
	t, err := d.Token()
	if err != nil {
		return nil, err
	}
	switch t := t.(type) {
	case json.Delim:
		switch t {
		case '{':
			m := make(map[string]any)
			for d.More() {
				k, err := d.Token()
				if err != nil {
					return nil, err
				}
				key, ok := k.(string)
				if !ok {
					return nil, errInvalidMessage
				}
				if _, exists := m[key]; exists {
					return nil, errInvalidMessage
				}
				if m[key], err = decodeValue(d, depth+1); err != nil {
					return nil, err
				}
			}
			if end, err := d.Token(); err != nil || end != json.Delim('}') {
				return nil, errInvalidMessage
			}
			return m, nil
		case '[':
			a := make([]any, 0)
			for d.More() {
				v, err := decodeValue(d, depth+1)
				if err != nil {
					return nil, err
				}
				a = append(a, v)
			}
			if end, err := d.Token(); err != nil || end != json.Delim(']') {
				return nil, errInvalidMessage
			}
			return a, nil
		default:
			return nil, errInvalidMessage
		}
	case json.Number:
		f, err := t.Float64()
		if err != nil || math.IsNaN(f) || math.IsInf(f, 0) {
			return nil, errInvalidMessage
		}
	}
	return t, nil
}

// validEscapes 拒绝 \u 转义出的孤立代理码点；encoding/json 会把它们静默替换成 U+FFFD。
func validEscapes(b []byte) bool {
	inString := false
	for i := 0; i < len(b); i++ {
		if b[i] == '"' {
			inString = !inString
			continue
		}
		if !inString || b[i] != '\\' {
			continue
		}
		i++
		if i >= len(b) {
			return false
		}
		if b[i] != 'u' {
			continue
		}
		if i+4 >= len(b) {
			return false
		}
		v, err := strconv.ParseUint(string(b[i+1:i+5]), 16, 16)
		if err != nil {
			return false
		}
		i += 4
		if v >= 0xdc00 && v <= 0xdfff {
			return false
		}
		if v < 0xd800 || v > 0xdbff {
			continue
		}
		if i+6 >= len(b) || b[i+1] != '\\' || b[i+2] != 'u' {
			return false
		}
		low, err := strconv.ParseUint(string(b[i+3:i+7]), 16, 16)
		if err != nil || low < 0xdc00 || low > 0xdfff {
			return false
		}
		i += 6
	}
	return true
}

// object 要求 v 恰好包含 fields 列出的键：缺键或多键都拒收。
func object(v any, fields ...string) (map[string]any, bool) {
	m, ok := v.(map[string]any)
	if !ok || len(m) != len(fields) {
		return nil, false
	}
	for _, field := range fields {
		if _, ok := m[field]; !ok {
			return nil, false
		}
	}
	return m, true
}

func nullableString(v any) (*string, bool) {
	if v == nil {
		return nil, true
	}
	s, ok := v.(string)
	return &s, ok
}

func nullableInteger(v any, min int64) (*int64, bool) {
	if v == nil {
		return nil, true
	}
	n, ok := integer(v, min, domainpresence.MaxSequence)
	return &n, ok
}

// integer 按十进制原文解析整数，避免 float64 在安全整数上界附近舍入，且不按巨大指数分配内存。
func integer(v any, min, max int64) (int64, bool) {
	digits, exponent, negative, ok := decimal(v)
	if !ok {
		return 0, false
	}
	if digits == "" {
		return 0, min <= 0 && max >= 0
	}
	if exponent < 0 || exponent > 16 || int64(len(digits))+exponent > 16 {
		return 0, false
	}
	s := digits + strings.Repeat("0", int(exponent))
	if negative {
		s = "-" + s
	}
	value, err := strconv.ParseInt(s, 10, 64)
	return value, err == nil && value >= min && value <= max
}

// parseRate 精确校验 0 ≤ rate ≤ 4，并规范为「有效数字 e 指数」以便指纹对 1、1.0、1e0 一致。
func parseRate(v any) (json.Number, bool) {
	digits, exponent, negative, ok := decimal(v)
	if !ok {
		return "", false
	}
	if digits == "" {
		return json.Number("0"), true
	}
	if negative {
		return "", false
	}
	magnitude := int64(len(digits)) + exponent
	if magnitude > 1 || (magnitude == 1 && (digits[0] > '4' || (digits[0] == '4' && len(digits) > 1))) {
		return "", false
	}
	return json.Number(digits + "e" + strconv.FormatInt(exponent, 10)), true
}

// decimal 把 JSON 数字拆成去掉首尾零的有效数字与十进制指数；digits 为空表示零。
func decimal(v any) (digits string, exponent int64, negative bool, ok bool) {
	n, isNumber := v.(json.Number)
	if !isNumber {
		return "", 0, false, false
	}
	s := n.String()
	negative = strings.HasPrefix(s, "-")
	s = strings.TrimPrefix(s, "-")
	exponentText := "0"
	if i := strings.IndexAny(s, "eE"); i >= 0 {
		exponentText, s = s[i+1:], s[:i]
	}
	if i := strings.IndexByte(s, '.'); i >= 0 {
		exponent -= int64(len(s) - i - 1)
		s = s[:i] + s[i+1:]
	}
	s = strings.TrimLeft(s, "0")
	if s == "" {
		return "", 0, negative, true
	}
	e, err := strconv.ParseInt(exponentText, 10, 32)
	if err != nil {
		return "", 0, false, false
	}
	exponent += e
	for strings.HasSuffix(s, "0") {
		s = s[:len(s)-1]
		exponent++
	}
	return s, exponent, negative, true
}
