package system

import (
	"runtime/pprof"

	"github.com/shirou/gopsutil/v3/process"
)

// pprofThreadCount 返回当前进程的 OS 线程数（通过 pprof threadcreate profile）。
// 跨平台兜底：取不到返回 0。
func pprofThreadCount() int {
	if p := pprof.Lookup("threadcreate"); p != nil {
		return p.Count()
	}
	return 0
}

// processCount 返回系统进程总数。
func processCount() int {
	procs, err := process.Processes()
	if err != nil {
		return 0
	}
	return len(procs)
}
