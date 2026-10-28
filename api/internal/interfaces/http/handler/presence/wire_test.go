package presence

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	domainpresence "blog-api/internal/domain/presence"
)

const sample = `{"protocolVersion":1,"type":"snapshot","connectionId":"01234567-89ab-4cde-8fab-0123456789ab","sequence":1,"observedAt":"2026-10-25T12:30:00.123Z","sources":{"application":{"displayName":"示例应用"},"window":{"title":"示例窗口"},"media":{"sessionId":"11234567-89ab-4cde-8fab-0123456789ab","playerName":"示例播放器","title":"虚构曲目","artist":null,"album":null,"playback":{"state":"playing","durationMs":10000,"positionMs":500,"rate":1}}}}`

func TestParseSnapshotRejectsAmbiguousAndInvalidJSON(t *testing.T) {
	cases := map[string]string{
		"duplicate":                 strings.Replace(sample, `"sequence":1`, `"sequence":1,"sequence":1`, 1),
		"escaped duplicate":         strings.Replace(sample, `"sequence":1`, `"sequence":1,"sequence":1`, 1),
		"unknown":                   strings.Replace(sample, `"sequence":1`, `"sequence":1,"secret":"x"`, 1),
		"case insensitive key":      strings.Replace(sample, `"sequence"`, `"Sequence"`, 1),
		"nested unknown":            strings.Replace(sample, `"displayName":"示例应用"`, `"displayName":"示例应用","pid":1`, 1),
		"missing source":            strings.Replace(sample, `"application":{"displayName":"示例应用"},`, "", 1),
		"null sources":              strings.Replace(sample, `"sources":`, `"sources":null,"ignored":`, 1),
		"null scalar":               strings.Replace(sample, `"sequence":1`, `"sequence":null`, 1),
		"unsafe integer":            strings.Replace(sample, `"sequence":1`, `"sequence":9007199254740992`, 1),
		"rounded integer":           strings.Replace(sample, `"sequence":1`, `"sequence":9007199254740991.1`, 1),
		"fraction":                  strings.Replace(sample, `"sequence":1`, `"sequence":1.1`, 1),
		"NaN":                       strings.Replace(sample, `"rate":1`, `"rate":NaN`, 1),
		"infinity":                  strings.Replace(sample, `"rate":1`, `"rate":1e999`, 1),
		"rounded upper rate":        strings.Replace(sample, `"rate":1`, `"rate":4.000000000000000001`, 1),
		"negative rate":             strings.Replace(sample, `"rate":1`, `"rate":-0.00000001`, 1),
		"playing zero":              strings.Replace(sample, `"rate":1`, `"rate":0`, 1),
		"paused nonzero":            strings.Replace(sample, `"state":"playing"`, `"state":"paused"`, 1),
		"stopped state":             strings.Replace(sample, `"state":"playing"`, `"state":"stopped"`, 1),
		"position exceeds duration": strings.Replace(sample, `"positionMs":500`, `"positionMs":10001`, 1),
		"missing artist":            strings.Replace(sample, `"artist":null,`, "", 1),
		"zero duration":             strings.Replace(sample, `"durationMs":10000`, `"durationMs":0`, 1),
		"bad UUID":                  strings.Replace(sample, "01234567-89ab-4cde", "01234567-89ab-1cde", 1),
		"timezone offset":           strings.Replace(sample, "12:30:00.123Z", "12:30:00+00:00", 1),
		"invalid calendar":          strings.Replace(sample, "2026-10-25", "2026-02-30", 1),
		"leap second":               strings.Replace(sample, "12:30:00.123Z", "12:30:60Z", 1),
		"too many milliseconds":     strings.Replace(sample, ".123Z", ".1234Z", 1),
		"control text":              strings.Replace(sample, "示例应用", `hello\nworld`, 1),
		"blank text":                strings.Replace(sample, "示例应用", "  ", 1),
		"long text":                 strings.Replace(sample, "示例应用", strings.Repeat("字", 129), 1),
		"surrogate high":            strings.Replace(sample, "示例应用", `\ud800`, 1),
		"surrogate low":             strings.Replace(sample, "示例应用", `\udc00`, 1),
		"surrogate pair reversed":   strings.Replace(sample, "示例应用", `\udc00\ud800`, 1),
		"invalid UTF8":              strings.Replace(sample, "示例应用", string([]byte{0xff}), 1),
		"trailing JSON":             sample + `{}`,
		"wrong type":                strings.Replace(sample, `"type":"snapshot"`, `"type":"welcome"`, 1),
		"too large":                 sample + strings.Repeat(" ", domainpresence.MaxMessageBytes),
	}
	for name, data := range cases {
		t.Run(name, func(t *testing.T) {
			_, err := parseSnapshot([]byte(data))
			assert.Error(t, err)
		})
	}
}

func TestParseSnapshotRequiresEveryFieldAndOnlyDeclaredNulls(t *testing.T) {
	paths := [][]string{
		{}, {"sources"}, {"sources", "application"}, {"sources", "window"},
		{"sources", "media"}, {"sources", "media", "playback"},
	}
	walk := func(root map[string]any, path []string) map[string]any {
		for _, part := range path {
			root = root[part].(map[string]any)
		}
		return root
	}
	for _, path := range paths {
		original, err := decodeObject([]byte(sample))
		require.NoError(t, err)
		for key := range walk(original, path) {
			t.Run(strings.Join(append(append([]string{}, path...), key), "/"), func(t *testing.T) {
				copied, _ := decodeObject([]byte(sample))
				at := walk(copied, path)
				delete(at, key)
				data, _ := json.Marshal(copied)
				_, err := parseSnapshot(data)
				assert.Error(t, err, "缺字段必须拒收")

				at[key] = nil
				data, _ = json.Marshal(copied)
				nullable := (len(path) == 1 && path[0] == "sources") ||
					(len(path) == 2 && path[1] == "media" && (key == "artist" || key == "album")) ||
					(len(path) == 3 && (key == "rate" || key == "positionMs" || key == "durationMs"))
				_, err = parseSnapshot(data)
				assert.Equal(t, nullable, err == nil, "字段 %s 的可空性不符合协议", key)
			})
		}
	}
}

func TestParseSnapshotCanonicalFingerprintAndUnicodeLength(t *testing.T) {
	expected, err := parseSnapshot([]byte(sample))
	require.NoError(t, err)
	assert.Equal(t, "示例应用", expected.Sources.Application.DisplayName)
	require.NotNil(t, expected.Sources.Media.Playback.Rate)
	assert.InDelta(t, 1.0, *expected.Sources.Media.Playback.Rate, 0)

	object, _ := decodeObject([]byte(sample))
	reordered, _ := json.MarshalIndent(object, "", "  ")
	data := strings.Replace(string(reordered), `"rate": 1`, `"rate": 10e-1`, 1)
	data = strings.Replace(data, `"sequence": 1`, `"sequence": 1.0`, 1)
	actual, err := parseSnapshot([]byte(data))
	require.NoError(t, err)
	assert.Equal(t, expected.Fingerprint, actual.Fingerprint, "键顺序、空白与等值数字写法不得改变指纹")

	changed, err := parseSnapshot([]byte(strings.Replace(sample, "示例窗口", "另一个窗口", 1)))
	require.NoError(t, err)
	assert.NotEqual(t, expected.Fingerprint, changed.Fingerprint)

	for _, text := range []string{strings.Repeat("😀", 128), `😀`, `literal\\ud800`} {
		_, err := parseSnapshot([]byte(strings.Replace(sample, "示例应用", text, 1)))
		assert.NoError(t, err, "合法 Unicode 文本被拒收: %s", text)
	}
	for _, rate := range []string{"null", "4", "1e-1000"} {
		parsed, err := parseSnapshot([]byte(strings.Replace(sample, `"rate":1`, `"rate":`+rate, 1)))
		require.NoError(t, err, "合法播放速率被拒收: %s", rate)
		if rate == "1e-1000" {
			assert.Positive(t, *parsed.Sources.Media.Playback.Rate, "极小正速率不得下溢成暂停")
		}
	}
}
