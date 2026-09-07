package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"

	"blog-api/config"
	domainpublication "blog-api/internal/domain/publication"
	gormrepo "blog-api/internal/infrastructure/persistence/gorm"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

type discrepancyOutput struct {
	Kind     domainpublication.Kind            `json:"kind"`
	SourceID string                            `json:"source_id"`
	Type     domainpublication.DiscrepancyType `json:"type"`
}

type reportOutput struct {
	Missing  []discrepancyOutput `json:"missing"`
	Orphaned []discrepancyOutput `json:"orphaned"`
	Drifted  []discrepancyOutput `json:"drifted"`
}

func main() {
	cfg := config.Load()
	db, err := gorm.Open(postgres.Open(cfg.Database.DSN()), &gorm.Config{})
	if err != nil {
		fmt.Fprintf(os.Stderr, "连接数据库失败: %v\n", err)
		os.Exit(1)
	}
	report, err := gormrepo.NewPublicationConsistencyChecker(db).Check(context.Background())
	if err != nil {
		fmt.Fprintf(os.Stderr, "校验发布物投影失败: %v\n", err)
		os.Exit(1)
	}
	if err := json.NewEncoder(os.Stdout).Encode(toOutput(report)); err != nil {
		fmt.Fprintf(os.Stderr, "输出校验结果失败: %v\n", err)
		os.Exit(1)
	}
	if len(report.Missing)+len(report.Orphaned)+len(report.Drifted) > 0 {
		os.Exit(2)
	}
}

func toOutput(report domainpublication.ConsistencyReport) reportOutput {
	return reportOutput{
		Missing:  toDiscrepancyOutput(report.Missing),
		Orphaned: toDiscrepancyOutput(report.Orphaned),
		Drifted:  toDiscrepancyOutput(report.Drifted),
	}
}

func toDiscrepancyOutput(discrepancies []domainpublication.Discrepancy) []discrepancyOutput {
	out := make([]discrepancyOutput, len(discrepancies))
	for i, discrepancy := range discrepancies {
		out[i] = discrepancyOutput{
			Kind: discrepancy.Kind, SourceID: discrepancy.SourceID.String(), Type: discrepancy.Type,
		}
	}
	return out
}
