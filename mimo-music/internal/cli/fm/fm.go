// Package fm 提供私人 FM 命令。
package fm

import (
	"github.com/spf13/cobra"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/VOD-Studio/mimo-music/internal/cli/kit"
	fmendpoint "github.com/VOD-Studio/mimo-music/internal/netease/endpoint/fm"
)

// NewCommand 创建 fm 命令(私人 FM 只有一个接口,直接作为可执行命令)。
func NewCommand(k *kit.Kit) *cobra.Command {
	return &cobra.Command{
		Use:   "fm",
		Short: "私人 FM",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			return kit.PrintExec(k, fmendpoint.GetPersonalFM, &mmpb.GetPersonalFMRequest{})
		},
	}
}
