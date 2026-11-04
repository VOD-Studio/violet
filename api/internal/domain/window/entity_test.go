package window

import (
	"math"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestConditionFromWMO(t *testing.T) {
	cases := map[int]Condition{
		0: ConditionClear, 1: ConditionClear, 2: ConditionCloudy, 3: ConditionCloudy,
		45: ConditionFog, 48: ConditionFog,
		51: ConditionRain, 57: ConditionRain, 61: ConditionRain, 67: ConditionRain, 80: ConditionRain, 82: ConditionRain,
		71: ConditionSnow, 77: ConditionSnow, 85: ConditionSnow, 86: ConditionSnow,
		95: ConditionStorm, 99: ConditionStorm,
		4: ConditionCloudy, 100: ConditionCloudy,
	}
	for code, want := range cases {
		assert.Equal(t, want, ConditionFromWMO(code), "code %d", code)
	}
}

func TestSlotFor(t *testing.T) {
	assert.Equal(t, SlotNight, SlotFor(ConditionClear, false))
	assert.Equal(t, SlotNight, SlotFor(ConditionRain, false))
	assert.Equal(t, SlotClear, SlotFor(ConditionClear, true))
	assert.Equal(t, SlotCloudy, SlotFor(ConditionFog, true))
	assert.Equal(t, SlotRain, SlotFor(ConditionStorm, true))
	assert.Equal(t, SlotSnow, SlotFor(ConditionSnow, true))
}

func TestCityValidate(t *testing.T) {
	ok := City{Name: "杭州", Latitude: 30.29, Longitude: 120.16, Timezone: "Asia/Shanghai"}
	assert.NoError(t, ok.Validate())

	bad := []City{
		{Name: "", Latitude: 30, Longitude: 120, Timezone: "Asia/Shanghai"},
		{Name: "杭州", Latitude: 91, Longitude: 120, Timezone: "Asia/Shanghai"},
		{Name: "杭州", Latitude: 30, Longitude: -181, Timezone: "Asia/Shanghai"},
		{Name: "杭州", Latitude: math.NaN(), Longitude: 120, Timezone: "Asia/Shanghai"},
		{Name: "杭州", Latitude: 30, Longitude: 120, Timezone: ""},
		{Name: "杭州", Latitude: 30, Longitude: 120, Timezone: "Mars/Olympus"},
	}
	for _, c := range bad {
		assert.ErrorIs(t, c.Validate(), ErrInvalidCity, "%+v", c)
	}
}

func TestIsValidPhotoSlot(t *testing.T) {
	for _, s := range PhotoSlots {
		assert.True(t, IsValidPhotoSlot(s))
	}
	assert.False(t, IsValidPhotoSlot("sunset"))
}
