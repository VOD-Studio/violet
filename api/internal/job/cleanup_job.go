package job

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"blog-api/internal/model"

	"gorm.io/gorm"
)

// CleanupJob 定时清理任务，负责清理过期的上传会话、孤立临时文件和已软删的物理文件
type CleanupJob struct {
	db       *gorm.DB // GORM 数据库实例
	chunkDir string   // 临时分片目录，如 uploads/tmp
}

// NewCleanupJob 创建定时清理任务实例
func NewCleanupJob(db *gorm.DB, chunkDir string) *CleanupJob {
	return &CleanupJob{
		db:       db,
		chunkDir: chunkDir,
	}
}

// CleanExpiredSessions 清理过期的上传会话
// 查找 status=active 且已超过 expires_at 的会话，删除其临时目录并标记为 expired
func (j *CleanupJob) CleanExpiredSessions(ctx context.Context) (int, error) {
	var sessions []model.UploadSession

	err := j.db.WithContext(ctx).
		Where("status = ? AND expires_at < ?", model.SessionStatusActive, time.Now()).
		Find(&sessions).Error
	if err != nil {
		return 0, fmt.Errorf("查询过期会话失败: %w", err)
	}

	if len(sessions) == 0 {
		return 0, nil
	}

	cleaned := 0
	for _, s := range sessions {
		// 删除临时分片目录
		if s.TmpPath != "" {
			if err := os.RemoveAll(s.TmpPath); err != nil {
				log.Printf("清理: 删除会话 %s 临时目录 %s 失败: %v", s.ID, s.TmpPath, err)
				continue
			}
		}

		// 更新会话状态为过期
		if err := j.db.WithContext(ctx).Model(&s).Update("status", model.SessionStatusExpired).Error; err != nil {
			log.Printf("清理: 更新会话 %s 状态失败: %v", s.ID, err)
			continue
		}

		cleaned++
	}

	return cleaned, nil
}

// CleanOrphanTmp 清理孤立的临时分片目录
// 扫描 chunkDir 下的子目录，检查是否对应有效的活跃上传会话，无效则删除
func (j *CleanupJob) CleanOrphanTmp(ctx context.Context) (int, error) {
	entries, err := os.ReadDir(j.chunkDir)
	if err != nil {
		if os.IsNotExist(err) {
			return 0, nil
		}
		return 0, fmt.Errorf("读取分片目录 %s 失败: %w", j.chunkDir, err)
	}

	cleaned := 0
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		dirName := entry.Name()
		// 跳过非 UUID 格式的目录名
		if !isValidUUID(dirName) {
			continue
		}

		// 查询对应的会话记录
		var session model.UploadSession
		result := j.db.WithContext(ctx).Where("id = ?", dirName).First(&session)

		if result.Error == gorm.ErrRecordNotFound {
			// 会话不存在，删除孤立目录
			dirPath := filepath.Join(j.chunkDir, dirName)
			if err := os.RemoveAll(dirPath); err != nil {
				log.Printf("清理: 删除孤立目录 %s 失败: %v", dirPath, err)
				continue
			}
			cleaned++
			continue
		}
		if result.Error != nil {
			log.Printf("清理: 查询目录 %s 对应会话失败: %v", dirName, result.Error)
			continue
		}

		// 会话存在但非活跃状态，删除残留目录
		if session.Status != model.SessionStatusActive {
			dirPath := filepath.Join(j.chunkDir, dirName)
			if err := os.RemoveAll(dirPath); err != nil {
				log.Printf("清理: 删除非活跃目录 %s 失败: %v", dirPath, err)
				continue
			}
			cleaned++
		}
	}

	return cleaned, nil
}

// PhysicalDeleteFiles 物理删除已软删超过保留天数的文件
// 先删除数据库记录，再删除磁盘文件（顺序不可反）
// ref_count > 0 的文件会被跳过（安全检查）
func (j *CleanupJob) PhysicalDeleteFiles(ctx context.Context, retentionDays int) (int, error) {
	cutoff := time.Now().AddDate(0, 0, -retentionDays)

	var files []model.File
	err := j.db.WithContext(ctx).
		Where("status = ? AND deleted_at < ? AND ref_count = 0", model.FileStatusDeleted, cutoff).
		Find(&files).Error
	if err != nil {
		return 0, fmt.Errorf("查询待删除文件失败: %w", err)
	}

	if len(files) == 0 {
		return 0, nil
	}

	cleaned := 0
	for _, f := range files {
		// 安全检查：跳过仍有引用的文件
		if f.RefCount > 0 {
			log.Printf("清理: 跳过文件 %s，仍有 %d 个引用", f.ID, f.RefCount)
			continue
		}

		// 先物理删除数据库记录
		if err := j.db.WithContext(ctx).Unscoped().Delete(&f).Error; err != nil {
			log.Printf("清理: 硬删除文件记录 %s 失败: %v", f.ID, err)
			continue
		}

		// 再删除磁盘文件
		if f.Path != "" {
			if err := os.Remove(f.Path); err != nil && !os.IsNotExist(err) {
				log.Printf("清理: 删除物理文件 %s 失败 (记录已删除): %v", f.Path, err)
			}
		}

		cleaned++
	}

	return cleaned, nil
}

// Start 启动后台定时清理任务
// 每 1 小时清理过期会话和孤立临时文件
// 每 24 小时物理删除已软删超过 7 天的文件
// 通过 ctx 取消时优雅退出
func (j *CleanupJob) Start(ctx context.Context) {
	hourlyTicker := time.NewTicker(1 * time.Hour)
	defer hourlyTicker.Stop()

	dailyTicker := time.NewTicker(24 * time.Hour)
	defer dailyTicker.Stop()

	log.Println("清理任务: 已启动")

	for {
		select {
		case <-ctx.Done():
			log.Println("清理任务: 已停止")
			return

		case <-hourlyTicker.C:
			j.runHourly(ctx)

		case <-dailyTicker.C:
			j.runDaily(ctx)
		}
	}
}

// runHourly 执行每小时清理：过期会话 + 孤立临时文件
func (j *CleanupJob) runHourly(ctx context.Context) {
	sessions, err := j.CleanExpiredSessions(ctx)
	if err != nil {
		log.Printf("清理任务: 清理过期会话出错: %v", err)
	} else {
		log.Printf("清理任务: 清理了 %d 个过期会话", sessions)
	}

	orphans, err := j.CleanOrphanTmp(ctx)
	if err != nil {
		log.Printf("清理任务: 清理孤立临时文件出错: %v", err)
	} else {
		log.Printf("清理任务: 清理了 %d 个孤立临时目录", orphans)
	}
}

// runDaily 执行每日清理：物理删除软删文件
func (j *CleanupJob) runDaily(ctx context.Context) {
	files, err := j.PhysicalDeleteFiles(ctx, 7)
	if err != nil {
		log.Printf("清理任务: 物理删除文件出错: %v", err)
	} else {
		log.Printf("清理任务: 物理删除了 %d 个文件", files)
	}
}

// isValidUUID 检查字符串是否为标准 UUID 格式
func isValidUUID(s string) bool {
	if len(s) != 36 {
		return false
	}
	for i, r := range s {
		if i == 8 || i == 13 || i == 18 || i == 23 {
			if r != '-' {
				return false
			}
			continue
		}
		if !((r >= '0' && r <= '9') || (r >= 'a' && r <= 'f') || (r >= 'A' && r <= 'F')) {
			return false
		}
	}
	return true
}
