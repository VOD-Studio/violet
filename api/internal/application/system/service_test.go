package system

import (
	"context"
	"testing"
)

// fakeCollector 测试用采集器桩
type fakeCollector struct {
	snap *Snapshot
	err  error
}

func (f *fakeCollector) Collect() (*Snapshot, error) {
	if f.err != nil {
		return nil, f.err
	}
	return f.snap, nil
}

func TestGetSnapshot_ReturnsSnapshot(t *testing.T) {
	collector := &fakeCollector{snap: &Snapshot{
		CPU: CPUInfo{UsagePercent: 42.5, Cores: 4},
	}}
	// db/redis 传 nil：GetSnapshot 不应 panic，依赖探活会记录失败但返回
	svc := NewService(nil, nil, collector)

	snap, err := svc.GetSnapshot(context.Background())
	if err != nil {
		t.Fatalf("GetSnapshot 返回错误: %v", err)
	}
	if snap.CPU.UsagePercent != 42.5 {
		t.Errorf("CPU 使用率 = %v, 期望 42.5", snap.CPU.UsagePercent)
	}
	if snap.CPU.Cores != 4 {
		t.Errorf("核心数 = %v, 期望 4", snap.CPU.Cores)
	}
}

func TestGetHistory_RedisNil_ReturnsEmpty(t *testing.T) {
	svc := NewService(nil, nil, &fakeCollector{snap: &Snapshot{}})
	resp, err := svc.GetHistory(context.Background())
	if err != nil {
		t.Fatalf("GetHistory 返回错误: %v", err)
	}
	if len(resp.Points) != 0 {
		t.Errorf("历史点数 = %v, 期望 0", len(resp.Points))
	}
	if resp.Interval != 30 {
		t.Errorf("间隔 = %v, 期望 30", resp.Interval)
	}
}

func TestToSamplePoint_MapsFields(t *testing.T) {
	snap := &Snapshot{
		CPU: CPUInfo{UsagePercent: 55.0, PerCore: []float64{50, 60}},
	}
	p := ToSamplePoint(snap)
	if p.CPU.UsagePercent != 55.0 {
		t.Errorf("CPU 使用率 = %v, 期望 55", p.CPU.UsagePercent)
	}
	if len(p.CPU.PerCore) != 2 {
		t.Errorf("每核数 = %v, 期望 2", len(p.CPU.PerCore))
	}
}

// TestToSamplePoint_DiskIO 验证磁盘 IO 累计读写被正确映射到历史采样点。
func TestToSamplePoint_DiskIO(t *testing.T) {
	snap := &Snapshot{
		Disk: []DiskInfo{
			{Path: "/", UsedPercent: 40, ReadBytes: 1024, WriteBytes: 2048},
			{Path: "/home", UsedPercent: 70, ReadBytes: 100, WriteBytes: 200},
		},
	}
	p := ToSamplePoint(snap)
	if len(p.Disk) != 2 {
		t.Fatalf("磁盘点数 = %v, 期望 2", len(p.Disk))
	}
	// 第一块盘
	if p.Disk[0].Path != "/" || p.Disk[0].UsedPercent != 40 {
		t.Errorf("盘0 = {Path:%v, UP:%v}, 期望 {/, 40}", p.Disk[0].Path, p.Disk[0].UsedPercent)
	}
	if p.Disk[0].ReadBytes != 1024 || p.Disk[0].WriteBytes != 2048 {
		t.Errorf("盘0 IO = {R:%v, W:%v}, 期望 {1024, 2048}", p.Disk[0].ReadBytes, p.Disk[0].WriteBytes)
	}
	// 第二块盘
	if p.Disk[1].ReadBytes != 100 || p.Disk[1].WriteBytes != 200 {
		t.Errorf("盘1 IO = {R:%v, W:%v}, 期望 {100, 200}", p.Disk[1].ReadBytes, p.Disk[1].WriteBytes)
	}
}

// TestToSamplePoint_NoDisk 验证无磁盘时不产生 disk 点（避免 nil/空切片混淆）。
func TestToSamplePoint_NoDisk(t *testing.T) {
	snap := &Snapshot{}
	p := ToSamplePoint(snap)
	if len(p.Disk) != 0 {
		t.Errorf("无磁盘时 disk 点数 = %v, 期望 0", len(p.Disk))
	}
}
