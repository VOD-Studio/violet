/* 由 scripts/gen-types.mjs 从 schema/pet.schema.json 生成,请勿手改。 */

/**
 * This interface was referenced by `PetWireProtocol`'s JSON-Schema
 * via the `definition` "Action".
 */
export type Action = "feed" | "rest" | "play" | "heal" | "wait";
/**
 * 业务错误分类。调用方按此分支处理,`message` 仅供人读。
 *
 * This interface was referenced by `PetWireProtocol`'s JSON-Schema
 * via the `definition` "ErrorCode".
 */
export type ErrorCode = "bad_input" | "dead" | "no_food" | "no_medicine" | "not_sick" | "too_tired" | "time_backwards";
/**
 * This interface was referenced by `PetWireProtocol`'s JSON-Schema
 * via the `definition` "Charset".
 */
export type Charset = "ascii" | "unicode";
/**
 * 线上命令:`op` 为判别字段。
 *
 * This interface was referenced by `PetWireProtocol`'s JSON-Schema
 * via the `definition` "Command".
 */
export type Command =
  | {
      op: "capabilities";
    }
  | (BirthInput & {
      op: "birth";
    })
  | (FrameInput & {
      op: "frame";
    })
  | {
      certificate: Certificate;
      issuer_pub: string;
      op: "verify_birth";
    }
  | {
      action: Action;
      now: string;
      op: "act";
      pet: Pet;
      request_id: string;
    };
/**
 * This interface was referenced by `PetWireProtocol`'s JSON-Schema
 * via the `definition` "Pose".
 */
export type Pose = "idle" | "sick" | "sleep";
/**
 * This interface was referenced by `PetWireProtocol`'s JSON-Schema
 * via the `definition` "Phase".
 */
export type Phase = "healthy" | "warned" | "sick" | "dead";
/**
 * This interface was referenced by `PetWireProtocol`'s JSON-Schema
 * via the `definition` "Verdict".
 */
export type Verdict =
  | "valid"
  | "unsupported_rules"
  | "bad_encoding"
  | "commit_signature"
  | "commitment_mismatch"
  | "accept_signature"
  | "result_mismatch";

/**
 * This interface was referenced by `PetWireProtocol`'s JSON-Schema
 * via the `definition` "Birth".
 */
export interface Birth {
  /**
   * @minItems 8
   * @maxItems 8
   */
  genes: [number, number, number, number, number, number, number, number];
  id: string;
  pet: Pet;
  rarity: number;
  species: number;
}
/**
 * This interface was referenced by `PetWireProtocol`'s JSON-Schema
 * via the `definition` "Pet".
 */
export interface Pet {
  energy: number;
  /**
   * 精力衰减的余数刻度。
   */
  energy_rem?: number;
  food: number;
  id: string;
  last_request: string;
  last_tick: string;
  medicine: number;
  /**
   * 持续失养的逻辑时间,决定预警、生病与死亡。
   */
  neglect: string;
  satiety: number;
  /**
   * 饱食衰减的余数刻度,保证结算频率不影响总衰减量。
   */
  satiety_rem?: number;
}
/**
 * This interface was referenced by `PetWireProtocol`'s JSON-Schema
 * via the `definition` "BirthInput".
 */
export interface BirthInput {
  born_at: string;
  client_seed: string;
  request_id: string;
  /**
   * 服务端承诺并揭示的随机材料,64 位十六进制。
   */
  server_seed: string;
  world: string;
}
/**
 * 成功响应信封。
 *
 * This interface was referenced by `PetWireProtocol`'s JSON-Schema
 * via the `definition` "BirthResult".
 */
export interface BirthResult {
  ok: boolean;
  value: Birth;
}
/**
 * 一项可调用能力。能力发现、CLI 帮助与文档都由这张表产出,新增命令必须在此登记。
 *
 * This interface was referenced by `PetWireProtocol`'s JSON-Schema
 * via the `definition` "Capability".
 */
export interface Capability {
  /**
   * 该能力可能返回的业务错误分类。
   */
  errors: ErrorCode[];
  /**
   * 是否产生需要持久化的状态变化(调用方负责提交,核心不写存储)。
   */
  mutates_state: boolean;
  op: string;
  summary: string;
}
/**
 * This interface was referenced by `PetWireProtocol`'s JSON-Schema
 * via the `definition` "CapabilityCatalog".
 */
export interface CapabilityCatalog {
  capabilities: Capability[];
  rules_version: number;
}
/**
 * 成功响应信封。
 *
 * This interface was referenced by `PetWireProtocol`'s JSON-Schema
 * via the `definition` "CapabilityCatalogResult".
 */
export interface CapabilityCatalogResult {
  ok: boolean;
  value: CapabilityCatalog;
}
/**
 * This interface was referenced by `PetWireProtocol`'s JSON-Schema
 * via the `definition` "Certificate".
 */
export interface Certificate {
  /**
   * 服务端承诺在先、接受客户端随机在后的签名收据。
   */
  accept_sig: string;
  client_seed: string;
  commit_sig: string;
  /**
   * 先于客户端随机材料公布。
   */
  commitment: string;
  context: Context;
  id: string;
  rarity: number;
  server_seed: string;
  species: number;
}
/**
 * 本次领取固定的上下文:世界、发行者、请求、资格与规则摘要。
 *
 * This interface was referenced by `PetWireProtocol`'s JSON-Schema
 * via the `definition` "Context".
 */
export interface Context {
  /**
   * 领取资格摘要,不含账号标识或原始活动。
   */
  eligibility: string;
  issuer: string;
  request_id: string;
  rules_version: number;
  world: string;
}
/**
 * 帧合成输入:投影字段 + 呈现时钟。呈现时钟只影响动作相位,不影响任何养成结果。
 *
 * This interface was referenced by `PetWireProtocol`'s JSON-Schema
 * via the `definition` "FrameInput".
 */
export interface FrameInput {
  charset: Charset;
  /**
   * @minItems 8
   * @maxItems 8
   */
  genes: [number, number, number, number, number, number, number, number];
  h: number;
  pose: Pose;
  species: number;
  t: string;
  w: number;
}
/**
 * 失败响应信封。
 *
 * This interface was referenced by `PetWireProtocol`'s JSON-Schema
 * via the `definition` "ErrorBody".
 */
export interface ErrorBody {
  code: ErrorCode;
  message: string;
  ok: boolean;
}
/**
 * This interface was referenced by `PetWireProtocol`'s JSON-Schema
 * via the `definition` "Frame".
 */
export interface Frame {
  /**
   * 与 rows 逐字符对应的 256 色索引;0 表示不着色。
   */
  colors: number[][];
  h: number;
  rows: string[];
  w: number;
}
/**
 * 成功响应信封。
 *
 * This interface was referenced by `PetWireProtocol`'s JSON-Schema
 * via the `definition` "FrameResult".
 */
export interface FrameResult {
  ok: boolean;
  value: Frame;
}
/**
 * This interface was referenced by `PetWireProtocol`'s JSON-Schema
 * via the `definition` "Outcome".
 */
export interface Outcome {
  pet: Pet;
  phase: Phase;
  replayed: boolean;
}
/**
 * 成功响应信封。
 *
 * This interface was referenced by `PetWireProtocol`'s JSON-Schema
 * via the `definition` "OutcomeResult".
 */
export interface OutcomeResult {
  ok: boolean;
  value: Outcome;
}
/**
 * 成功响应信封。
 *
 * This interface was referenced by `PetWireProtocol`'s JSON-Schema
 * via the `definition` "VerdictResult".
 */
export interface VerdictResult {
  ok: boolean;
  value: Verdict;
}

export interface OpResults {
  act: OutcomeResult;
  birth: BirthResult;
  capabilities: CapabilityCatalogResult;
  frame: FrameResult;
  verify_birth: VerdictResult;
}
export type ResultOf<C extends Command> = OpResults[C["op"]] | ErrorBody;
