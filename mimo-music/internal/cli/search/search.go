// Package search 提供搜索相关命令。search 本身既是分组也是可执行命令。
package search

import (
	"github.com/spf13/cobra"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/VOD-Studio/mimo-music/internal/cli/kit"
	searchendpoint "github.com/VOD-Studio/mimo-music/internal/netease/endpoint/search"
)

// NewCommand 创建 search 命令(带 keyword 时直接搜索,同时作为分组挂载子命令)。
func NewCommand(k *kit.Kit) *cobra.Command {
	var keyword string
	var limit, offset int
	c := &cobra.Command{
		Use:   "search",
		Short: "搜索(默认单曲)",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			kw, err := kit.ResolveKeyword(keyword, args)
			if err != nil {
				return err
			}
			return kit.RenderExec(k, searchendpoint.Search, &mmpb.SearchRequest{Keyword: kw, Limit: int32(limit), Offset: int32(offset)})
		},
	}
	c.Flags().StringVar(&keyword, "keyword", "", "搜索关键词")
	c.Flags().IntVar(&limit, "limit", 10, "返回数量")
	c.Flags().IntVar(&offset, "offset", 0, "偏移量")
	c.AddCommand(newSuggest(k), newHot(k), newHotDetail(k), newDefaultKeyword(k))
	return c
}

func newSuggest(k *kit.Kit) *cobra.Command {
	var keyword string
	c := &cobra.Command{
		Use:   "suggest",
		Short: "搜索建议",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			kw, err := kit.ResolveKeyword(keyword, args)
			if err != nil {
				return err
			}
			return kit.RenderExec(k, searchendpoint.Suggest, &mmpb.SuggestRequest{Keyword: kw})
		},
	}
	c.Flags().StringVar(&keyword, "keyword", "", "搜索关键词")
	return c
}

func newHot(k *kit.Kit) *cobra.Command {
	return &cobra.Command{
		Use:   "hot",
		Short: "热搜列表",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			return kit.RenderExec(k, searchendpoint.Hot, &mmpb.HotRequest{})
		},
	}
}

func newHotDetail(k *kit.Kit) *cobra.Command {
	return &cobra.Command{
		Use:   "hot-detail",
		Short: "热搜详情",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			return kit.RenderExec(k, searchendpoint.HotDetail, &mmpb.HotDetailRequest{})
		},
	}
}

func newDefaultKeyword(k *kit.Kit) *cobra.Command {
	return &cobra.Command{
		Use:   "default-keyword",
		Short: "默认搜索关键词",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			return kit.RenderExec(k, searchendpoint.DefaultKeyword, &mmpb.DefaultKeywordRequest{})
		},
	}
}
