package runtimelog

import "sync/atomic"

const (
	streamCapacity     int64 = 8
	streamBatchLimit         = 200
	streamPollInterval       = 500
	exportCapacity     int64 = 2
	exportRecordLimit        = 50_000
	exportByteLimit    int64 = 64 << 20
)

type StreamDeliveryStatus struct {
	Active            int64  `json:"active"`
	Capacity          int64  `json:"capacity"`
	BatchLimit        int    `json:"batch_limit"`
	PollIntervalMS    int    `json:"poll_interval_ms"`
	Opened            uint64 `json:"opened"`
	CapacityRejected  uint64 `json:"capacity_rejected"`
	ReadFailures      uint64 `json:"read_failures"`
	WriteFailures     uint64 `json:"write_failures"`
	AccessRevocations uint64 `json:"access_revocations"`
}

type ExportDeliveryStatus struct {
	Active           int64  `json:"active"`
	Capacity         int64  `json:"capacity"`
	RecordLimit      int    `json:"record_limit"`
	ByteLimit        int64  `json:"byte_limit"`
	Completed        uint64 `json:"completed"`
	Failed           uint64 `json:"failed"`
	Cancelled        uint64 `json:"cancelled"`
	CapacityRejected uint64 `json:"capacity_rejected"`
}

type DeliveryStatus struct {
	Stream StreamDeliveryStatus `json:"stream"`
	Export ExportDeliveryStatus `json:"export"`
}

type deliveryMonitor struct {
	activeStreams          atomic.Int64
	openedStreams          atomic.Uint64
	streamCapacityRejected atomic.Uint64
	streamReadFailures     atomic.Uint64
	streamWriteFailures    atomic.Uint64
	streamAccessRevoked    atomic.Uint64
	activeExports          atomic.Int64
	exportCompleted        atomic.Uint64
	exportFailed           atomic.Uint64
	exportCancelled        atomic.Uint64
	exportCapacityRejected atomic.Uint64
}

func (m *deliveryMonitor) acquireStream() bool {
	if !acquire(&m.activeStreams, streamCapacity) {
		m.streamCapacityRejected.Add(1)
		return false
	}
	m.openedStreams.Add(1)
	return true
}

func (m *deliveryMonitor) acquireExport() bool {
	if !acquire(&m.activeExports, exportCapacity) {
		m.exportCapacityRejected.Add(1)
		return false
	}
	return true
}

func (m *deliveryMonitor) snapshot() DeliveryStatus {
	return DeliveryStatus{
		Stream: StreamDeliveryStatus{
			Active:            m.activeStreams.Load(),
			Capacity:          streamCapacity,
			BatchLimit:        streamBatchLimit,
			PollIntervalMS:    streamPollInterval,
			Opened:            m.openedStreams.Load(),
			CapacityRejected:  m.streamCapacityRejected.Load(),
			ReadFailures:      m.streamReadFailures.Load(),
			WriteFailures:     m.streamWriteFailures.Load(),
			AccessRevocations: m.streamAccessRevoked.Load(),
		},
		Export: ExportDeliveryStatus{
			Active:           m.activeExports.Load(),
			Capacity:         exportCapacity,
			RecordLimit:      exportRecordLimit,
			ByteLimit:        exportByteLimit,
			Completed:        m.exportCompleted.Load(),
			Failed:           m.exportFailed.Load(),
			Cancelled:        m.exportCancelled.Load(),
			CapacityRejected: m.exportCapacityRejected.Load(),
		},
	}
}

func acquire(counter *atomic.Int64, limit int64) bool {
	for {
		current := counter.Load()
		if current >= limit {
			return false
		}
		if counter.CompareAndSwap(current, current+1) {
			return true
		}
	}
}
