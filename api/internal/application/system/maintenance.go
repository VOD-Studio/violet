package system

import (
	"context"
	"io"
	"strconv"
	"strings"
	"time"

	domainshared "blog-api/internal/domain/shared"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

const (
	backupAutoEnabledKey    = "system_backup_auto_enabled"
	backupTimeUTCKey        = "system_backup_time_utc"
	backupRetentionCountKey = "system_backup_retention_count"
	backupIncludeUploadsKey = "system_backup_include_uploads"
	backupLastRunAtKey      = "system_backup_last_run_at"
	backupLastRunOKKey      = "system_backup_last_run_ok"
	backupLastRunFileKey    = "system_backup_last_run_file"
	backupLastRunErrorKey   = "system_backup_last_run_error"

	defaultBackupTimeUTC        = "04:00"
	defaultBackupRetentionCount = 30
	maxBackupRetentionCount     = 365
	maxBackupImportBytes        = 512 << 20
	maintenanceTimeout          = 30 * time.Minute
)

// ListBackups 返回完成的备份与自动调度设置。
func (s *Service) ListBackups(ctx context.Context) (*BackupListResponse, error) {
	if s.backups == nil {
		return nil, domainshared.Internal("备份服务未配置", nil)
	}
	items, err := s.backups.List(ctx)
	if err != nil {
		return nil, operationError("读取备份列表失败", err)
	}
	settings, err := s.GetBackupSettings(ctx)
	if err != nil {
		return nil, err
	}
	return &BackupListResponse{Backups: items, Settings: *settings}, nil
}

// StartManualBackup 启动手动备份任务。
func (s *Service) StartManualBackup(includeUploads bool) (*BackupTask, error) {
	return s.startBackup(BackupOriginManual, includeUploads)
}

func (s *Service) startBackup(origin string, includeUploads bool) (*BackupTask, error) {
	if s.backups == nil {
		return nil, domainshared.Internal("备份服务未配置", nil)
	}
	if !s.acquireMaintenance() {
		return nil, domainshared.Conflict("已有备份维护任务正在运行")
	}

	task := s.newTask("backup", "正在准备备份")
	snapshot := cloneTask(task)
	go func() {
		defer s.releaseMaintenance()
		ctx, cancel := context.WithTimeout(context.Background(), maintenanceTimeout)
		defer cancel()

		info, err := s.backups.Create(ctx, origin, includeUploads, s.progressReporter(task.ID))
		if err != nil {
			s.failTask(task.ID, err)
			if origin == BackupOriginAuto {
				s.saveLastBackupRun(context.Background(), nil, err)
			}
			return
		}
		if origin == BackupOriginAuto {
			settings, settingsErr := s.GetBackupSettings(ctx)
			if settingsErr != nil {
				log.Error().Err(settingsErr).Msg("读取自动备份轮转设置失败")
			} else if rotateErr := s.backups.RotateAuto(ctx, settings.RetentionCount); rotateErr != nil {
				log.Error().Err(rotateErr).Msg("轮转自动备份失败")
			}
			s.saveLastBackupRun(context.Background(), info, nil)
		}
		s.completeTask(task.ID, info.Filename)
	}()
	return snapshot, nil
}

// StartRestore 启动数据库恢复任务。
func (s *Service) StartRestore(filename string) (*BackupTask, error) {
	if s.backups == nil {
		return nil, domainshared.Internal("备份服务未配置", nil)
	}
	if !s.acquireMaintenance() {
		return nil, domainshared.Conflict("已有备份维护任务正在运行")
	}

	task := s.newTask("restore", "正在准备恢复")
	snapshot := cloneTask(task)
	go func() {
		defer s.releaseMaintenance()
		ctx, cancel := context.WithTimeout(context.Background(), maintenanceTimeout)
		defer cancel()
		if err := s.backups.Restore(ctx, filename, s.progressReporter(task.ID)); err != nil {
			s.failTask(task.ID, err)
			return
		}
		s.completeTask(task.ID, filename)
	}()
	return snapshot, nil
}

// ImportBackup 导入并验证一个备份文件。
func (s *Service) ImportBackup(ctx context.Context, filename string, src io.Reader) (*BackupInfo, error) {
	if s.backups == nil {
		return nil, domainshared.Internal("备份服务未配置", nil)
	}
	if !s.acquireMaintenance() {
		return nil, domainshared.Conflict("已有备份维护任务正在运行")
	}
	defer s.releaseMaintenance()

	info, err := s.backups.Import(ctx, filename, src, maxBackupImportBytes)
	if err != nil {
		return nil, operationError("导入备份失败", err)
	}
	return info, nil
}

// DeleteBackup 删除数据库备份及其配对上传归档。
func (s *Service) DeleteBackup(ctx context.Context, filename string) error {
	if s.backups == nil {
		return domainshared.Internal("备份服务未配置", nil)
	}
	if !s.acquireMaintenance() {
		return domainshared.Conflict("已有备份维护任务正在运行")
	}
	defer s.releaseMaintenance()
	if err := s.backups.Delete(ctx, filename); err != nil {
		return operationError("删除备份失败", err)
	}
	return nil
}

// OpenBackup 打开数据库备份或配对上传归档。
func (s *Service) OpenBackup(ctx context.Context, filename, part string) (io.ReadCloser, BackupDownload, error) {
	if s.backups == nil {
		return nil, BackupDownload{}, domainshared.Internal("备份服务未配置", nil)
	}
	file, metadata, err := s.backups.Open(ctx, filename, part)
	if err != nil {
		return nil, BackupDownload{}, operationError("打开备份失败", err)
	}
	return file, metadata, nil
}

// GetBackupTask 返回异步任务快照。
func (s *Service) GetBackupTask(id string) (*BackupTask, error) {
	s.tasksMu.RLock()
	defer s.tasksMu.RUnlock()
	task, ok := s.tasks[id]
	if !ok {
		return nil, domainshared.NotFound("备份任务")
	}
	return cloneTask(task), nil
}

// GetBackupSettings 返回自动备份设置、最近结果和下次执行时间。
func (s *Service) GetBackupSettings(ctx context.Context) (*BackupSettingsView, error) {
	settings := BackupSettings{
		TimeUTC: defaultBackupTimeUTC, RetentionCount: defaultBackupRetentionCount, IncludeUploads: true,
	}
	if s.settings == nil {
		return &BackupSettingsView{BackupSettings: settings}, nil
	}
	values, err := s.settings.GetAll(ctx)
	if err != nil {
		return nil, domainshared.Internal("读取自动备份设置失败", err)
	}
	settings.AutoEnabled, _ = strconv.ParseBool(values[backupAutoEnabledKey])
	if validBackupTime(values[backupTimeUTCKey]) {
		settings.TimeUTC = values[backupTimeUTCKey]
	}
	if count, parseErr := strconv.Atoi(values[backupRetentionCountKey]); parseErr == nil && count >= 1 && count <= maxBackupRetentionCount {
		settings.RetentionCount = count
	}
	if value, ok := values[backupIncludeUploadsKey]; ok {
		settings.IncludeUploads, _ = strconv.ParseBool(value)
	}

	view := &BackupSettingsView{BackupSettings: settings}
	if settings.AutoEnabled {
		next := nextBackupRun(time.Now().UTC(), settings.TimeUTC)
		view.NextRunAt = &next
	}
	if at, parseErr := time.Parse(time.RFC3339Nano, values[backupLastRunAtKey]); parseErr == nil {
		ok, _ := strconv.ParseBool(values[backupLastRunOKKey])
		view.LastRun = &BackupRunResult{
			At: at, OK: ok, Filename: values[backupLastRunFileKey], Error: values[backupLastRunErrorKey],
		}
	}
	return view, nil
}

// UpdateBackupSettings 校验并持久化自动备份设置。
func (s *Service) UpdateBackupSettings(ctx context.Context, input BackupSettings) (*BackupSettingsView, error) {
	if s.settings == nil {
		return nil, domainshared.Internal("自动备份设置存储未配置", nil)
	}
	input.TimeUTC = strings.TrimSpace(input.TimeUTC)
	if !validBackupTime(input.TimeUTC) {
		return nil, domainshared.BadRequest("自动备份时间必须是 UTC HH:mm")
	}
	if input.RetentionCount < 1 || input.RetentionCount > maxBackupRetentionCount {
		return nil, domainshared.BadRequest("自动备份保留份数必须在 1 到 365 之间")
	}
	if err := s.settings.UpsertMany(ctx, map[string]string{
		backupAutoEnabledKey:    strconv.FormatBool(input.AutoEnabled),
		backupTimeUTCKey:        input.TimeUTC,
		backupRetentionCountKey: strconv.Itoa(input.RetentionCount),
		backupIncludeUploadsKey: strconv.FormatBool(input.IncludeUploads),
	}); err != nil {
		return nil, domainshared.Internal("保存自动备份设置失败", err)
	}
	select {
	case s.settingsChanged <- struct{}{}:
	default:
	}
	return s.GetBackupSettings(ctx)
}

// RunBackupScheduler 运行可被设置变更唤醒的 UTC 每日备份调度器。
func (s *Service) RunBackupScheduler(ctx context.Context) {
	for {
		settings, err := s.GetBackupSettings(ctx)
		if err != nil {
			log.Error().Err(err).Msg("读取自动备份调度设置失败")
			_, running := s.waitForSchedule(ctx, time.Hour)
			if !running {
				return
			}
			continue
		}
		if !settings.AutoEnabled {
			_, running := s.waitForSchedule(ctx, time.Hour)
			if !running {
				return
			}
			continue
		}

		delay := time.Until(nextBackupRun(time.Now().UTC(), settings.TimeUTC))
		fired, running := s.waitForSchedule(ctx, delay)
		if !running {
			return
		}
		if !fired {
			continue
		}
		if _, err := s.startBackup(BackupOriginAuto, settings.IncludeUploads); err != nil {
			log.Warn().Err(err).Msg("自动备份未启动")
		}
	}
}

func (s *Service) waitForSchedule(ctx context.Context, delay time.Duration) (fired, running bool) {
	if delay < 0 {
		delay = 0
	}
	timer := time.NewTimer(delay)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return false, false
	case <-s.settingsChanged:
		return false, true
	case <-timer.C:
		return true, true
	}
}

func (s *Service) saveLastBackupRun(ctx context.Context, info *BackupInfo, runErr error) {
	if s.settings == nil {
		return
	}
	values := map[string]string{
		backupLastRunAtKey:    time.Now().UTC().Format(time.RFC3339Nano),
		backupLastRunOKKey:    strconv.FormatBool(runErr == nil),
		backupLastRunFileKey:  "",
		backupLastRunErrorKey: "",
	}
	if info != nil {
		values[backupLastRunFileKey] = info.Filename
	}
	if runErr != nil {
		values[backupLastRunErrorKey] = runErr.Error()
	}
	if err := s.settings.UpsertMany(ctx, values); err != nil {
		log.Error().Err(err).Msg("保存自动备份结果失败")
	}
}

func (s *Service) acquireMaintenance() bool {
	s.maintenanceMu.Lock()
	defer s.maintenanceMu.Unlock()
	if s.maintenanceActive {
		return false
	}
	s.maintenanceActive = true
	return true
}

func (s *Service) releaseMaintenance() {
	s.maintenanceMu.Lock()
	s.maintenanceActive = false
	s.maintenanceMu.Unlock()
}

func (s *Service) newTask(kind, message string) *BackupTask {
	task := &BackupTask{
		ID: uuid.NewString(), Kind: kind, Status: "running", Message: message, StartedAt: time.Now().UTC(),
	}
	s.tasksMu.Lock()
	s.tasks[task.ID] = task
	s.tasksMu.Unlock()
	return task
}

func (s *Service) progressReporter(id string) ProgressReporter {
	return func(message string, progress int) {
		if progress < 0 {
			progress = 0
		} else if progress > 100 {
			progress = 100
		}
		s.tasksMu.Lock()
		if task := s.tasks[id]; task != nil {
			task.Message = message
			task.Progress = progress
		}
		s.tasksMu.Unlock()
	}
}

func (s *Service) failTask(id string, err error) {
	now := time.Now().UTC()
	s.tasksMu.Lock()
	if task := s.tasks[id]; task != nil {
		task.Status = "failed"
		task.Message = "任务失败"
		task.Error = err.Error()
		task.FinishedAt = &now
	}
	s.tasksMu.Unlock()
}

func (s *Service) completeTask(id, resultFile string) {
	now := time.Now().UTC()
	s.tasksMu.Lock()
	if task := s.tasks[id]; task != nil {
		task.Status = "succeeded"
		task.Message = "任务完成"
		task.Progress = 100
		task.ResultFile = resultFile
		task.FinishedAt = &now
	}
	s.tasksMu.Unlock()
}

func cloneTask(task *BackupTask) *BackupTask {
	copy := *task
	return &copy
}

func validBackupTime(value string) bool {
	_, err := time.Parse("15:04", value)
	return err == nil && len(value) == 5
}

func nextBackupRun(now time.Time, value string) time.Time {
	parsed, _ := time.Parse("15:04", value)
	next := time.Date(now.Year(), now.Month(), now.Day(), parsed.Hour(), parsed.Minute(), 0, 0, time.UTC)
	if !next.After(now) {
		next = next.Add(24 * time.Hour)
	}
	return next
}
