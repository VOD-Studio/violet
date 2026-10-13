import type { BirthResult, Command, OutcomeResult, Pet, ErrorBody, ResultOf } from "../src/index";
import { run } from "../src/index";

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const assert = <_T extends true>() => {};

// 返回类型随 op 变化
const birth = run({ op: "birth", world: "w", request_id: "r", server_seed: "", client_seed: "", born_at: "0" });
assert<Equal<typeof birth, BirthResult | ErrorBody>>();
declare const pet: Pet;
const acted = run({ op: "act", pet, action: "feed", now: "1", request_id: "r" });
assert<Equal<typeof acted, OutcomeResult | ErrorBody>>();
assert<Equal<ResultOf<Extract<Command, { op: "frame" }>>["ok"], boolean>>();

// u64 必须是字符串,不能是 number
// @ts-expect-error now 以字符串编码
run({ op: "act", pet, action: "feed", now: 1, request_id: "r" });
// 非法动作
// @ts-expect-error unknown action
run({ op: "act", pet, action: "fly", now: "1", request_id: "r" });
// birth 缺字段:Command 交叉类型必须保留 BirthInput 的字段
// @ts-expect-error missing world etc.
run({ op: "birth" });
// 未知 op
// @ts-expect-error unknown op
run({ op: "teleport" });

// 错误码是封闭联合,不是 string
import type { ErrorCode } from "../src/index";
assert<Equal<ErrorBody["code"], ErrorCode>>();
// @ts-expect-error not a known error code
const bad: ErrorCode = "oops";
const good: ErrorCode = "no_food";
void bad; void good;
