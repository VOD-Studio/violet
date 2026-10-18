package roadmap

import (
	"cmp"
	"context"
	"slices"
	"time"

	domain "blog-api/internal/domain/roadmap"
	"blog-api/internal/domain/shared"
)

type MoveInput struct {
	// Stage 目标阶段，必须为 planned、in_progress 或 completed。
	Stage string
	// BeforeID 目标位置的前一条；空串表示无前邻居。
	BeforeID string
	// AfterID 目标位置的后一条；空串表示无后邻居。
	AfterID string
	// CompletionDate YYYY-MM-DD；进入 completed 时 nil 默认上海当天，其他阶段忽略。
	CompletionDate *string
	// DeliveredVersion 进入 completed 时的自由文本版本号，其他阶段自动清空。
	DeliveredVersion string
}

func (s *Service) Move(ctx context.Context, projectID, itemID string, in MoveInput) (ItemDTO, error) {
	if err := requireProjectUpdate(ctx, s.checker); err != nil {
		return ItemDTO{}, err
	}
	pid, id, err := parseIDs(projectID, itemID)
	if err != nil {
		return ItemDTO{}, err
	}
	stage := domain.Stage(in.Stage)
	if !stage.Valid() {
		return ItemDTO{}, shared.BadRequest("路线图阶段无效")
	}
	var completionDate *time.Time
	if stage == domain.Completed && in.CompletionDate != nil {
		date, err := time.Parse(time.DateOnly, *in.CompletionDate)
		if err != nil {
			return ItemDTO{}, shared.BadRequest("完成日期必须为 YYYY-MM-DD")
		}
		completionDate = &date
	}
	var item *domain.Item
	var dto ItemDTO
	err = s.repo.WithinProject(ctx, pid, func(repo domain.Repository) error {
		var err error
		item, err = findProjectItem(ctx, repo, pid, id, false)
		if err != nil {
			return err
		}
		items, err := repo.FindByProject(ctx, pid)
		if err != nil {
			return err
		}
		position, err := movePosition(items, stage, id, in.BeforeID, in.AfterID)
		if err != nil {
			return err
		}
		previousStage, previousPosition := item.Stage(), item.Position()
		if err := item.Move(stage, position, completionDate, in.DeliveredVersion, s.now().In(siteLocation)); err != nil {
			return err
		}
		if previousStage != item.Stage() || previousPosition != item.Position() {
			if err := repo.Save(ctx, item); err != nil {
				return err
			}
		}
		dto, err = toBlockedDTO(ctx, repo, item)
		return err
	})
	if err != nil {
		return ItemDTO{}, err
	}
	s.publishEvents(ctx, item)
	return dto, nil
}

func movePosition(items []*domain.Item, stage domain.Stage, itemID shared.ID, beforeID, afterID string) (string, error) {
	target := make([]*domain.Item, 0, len(items))
	for _, item := range items {
		if item.Stage() == stage && !item.ID().Equal(itemID) && item.DeletedAt() == nil {
			target = append(target, item)
		}
	}
	slices.SortFunc(target, func(a, b *domain.Item) int {
		if order := cmp.Compare(a.Position(), b.Position()); order != 0 {
			return order
		}
		return cmp.Compare(a.Number(), b.Number())
	})
	last := ""
	if len(target) > 0 {
		last = target[len(target)-1].Position()
	}
	appendToEnd := func() (string, error) { return domain.PositionBetween(last, "") }
	if stage == domain.Completed || beforeID == "" && afterID == "" {
		return appendToEnd()
	}
	before, after := -1, len(target)
	for index, item := range target {
		if item.ID().String() == beforeID {
			before = index
		}
		if item.ID().String() == afterID {
			after = index
		}
	}
	if beforeID != "" && before == -1 || afterID != "" && after == len(target) || after != before+1 {
		return appendToEnd()
	}
	beforePosition, afterPosition := "", ""
	if before >= 0 {
		beforePosition = target[before].Position()
	}
	if after < len(target) {
		afterPosition = target[after].Position()
	}
	position, err := domain.PositionBetween(beforePosition, afterPosition)
	if err != nil {
		return appendToEnd()
	}
	return position, nil
}
