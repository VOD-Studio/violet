package openapi

import "github.com/getkin/kin-openapi/openapi3"

func registerTweetCommentReactionPaths(t *openapi3.T) {
	const base = "/tweets/{id}/comments/{commentId}/reactions"
	parameters := func() openapi3.Parameters {
		return openapi3.Parameters{pathStrParam("id", "推文 ID（UUID）"), pathStrParam("commentId", "该推文下的评论 ID（UUID）")}
	}
	get(t, base, &openapi3.Operation{
		Tags: []string{"推文"}, Summary: "获取推文评论回应",
		Description: "按推文公开可见性校验评论归属；匿名 self=false。聚合顺序、gif_url、至多 3 名公开最近回应者与文章回应一致；无回应返回 []。",
		Parameters:  parameters(),
		Responses: responses(
			200, dataArrayResponse("AggregatedReaction", "评论回应聚合列表", 200, false),
			400, errorResponse("非法 UUID"), 404, errorResponse("推文或评论不存在/不属于该推文"),
		),
	})
	post(t, base, &openapi3.Operation{
		Tags: []string{"推文"}, Summary: "添加推文评论回应", Security: securityCookie(),
		Description: "需登录与 CSRF；仅启用的系统目录普通/颜文字可回应，不允许会员、购买或私人表情。重复添加幂等。",
		Parameters:  append(parameters(), csrfHeaderParam()), RequestBody: jsonBody("AddReactionRequest", true, "表情 ID"),
		Responses: responses(
			200, messageResponse("回应已添加"), 400, errorResponse("非法表情或请求"),
			401, errorResponse("未登录"), 404, errorResponse("推文、评论或表情不存在"),
		),
	})
	del(t, base+"/{emojiId}", &openapi3.Operation{
		Tags: []string{"推文"}, Summary: "取消推文评论回应", Security: securityCookie(),
		Description: "只取消自己的回应；重复取消幂等。表情分组已禁用时仍可取消。",
		Parameters:  append(parameters(), pathIntParam("emojiId", "表情 ID"), csrfHeaderParam()),
		Responses: responses(
			200, messageResponse("回应已移除"), 400, errorResponse("非法请求"),
			401, errorResponse("未登录"), 404, errorResponse("推文或评论不存在/归属不符"),
		),
	})
	post(t, "/tweets/{id}/comments/reactions/batch", &openapi3.Operation{
		Tags: []string{"推文"}, Summary: "批量获取推文评论回应",
		Description: "公开读操作，POST 承载 comment_ids 数组，仍需 CSRF。请求体最多 16 KiB、至多 100 个唯一 UUID（重复项不占额外名额），按首次出现顺序返回。以固定次数查询筛选同推文目标；已删除、不存在或其它推文的合法评论 ID 均返回该 ID 的空 reactions，不读取其它推文回应。空输入/空回应均为 []；匿名 self=false。",
		Parameters:  openapi3.Parameters{pathStrParam("id", "推文 ID（UUID）"), csrfHeaderParam()},
		RequestBody: jsonBody("BatchReactionsRequest", true, "至多 100 个唯一评论 UUID，重复项合并，请求体最多 16 KiB"),
		Responses: responses(
			200, dataArrayResponse("CommentReactionBatchResult", "各评论的回应汇总", 200, false),
			400, errorResponse("非法 UUID、超过 100 个唯一评论或非法请求"),
			404, errorResponse("推文不存在"), 413, errorResponse("请求体超过 16 KiB"),
		),
	})
}
