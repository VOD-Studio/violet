package stats

import "testing"

func TestNormalizeTrendDays(t *testing.T) {
	tests := []struct {
		name string
		in   int
		want int
	}{
		{"档位 7 原样通过", 7, 7},
		{"档位 30 原样通过", 30, 30},
		{"零回退默认", 0, DefaultTrendDays},
		{"负数回退默认", -7, DefaultTrendDays},
		{"非白名单档位回退默认", 90, DefaultTrendDays},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := NormalizeTrendDays(tt.in); got != tt.want {
				t.Errorf("NormalizeTrendDays(%d) = %d, want %d", tt.in, got, tt.want)
			}
		})
	}
}
