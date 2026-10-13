/* 由 scripts/gen-types.mjs 从 schema/pet.schema.json 生成,请勿手改。 */

/**
 * This interface was referenced by `PetWireProtocol`'s JSON-Schema
 * via the `definition` "Action".
 */
export type Action =
  | ("feed" | "rest" | "play" | "heal" | "wait")
  | {
      evolve: {
        branch: Branch;
      };
    };
/**
 * This interface was referenced by `PetWireProtocol`'s JSON-Schema
 * via the `definition` "Branch".
 */
export type Branch = ("curious" | "gentle" | "steady" | "sage" | "guardian" | "wanderer") | "radiant";
/**
 * This interface was referenced by `PetWireProtocol`'s JSON-Schema
 * via the `definition` "Stage".
 */
export type Stage = "baby" | "young" | "adult";
/**
 * This interface was referenced by `PetWireProtocol`'s JSON-Schema
 * via the `definition` "MissingKind".
 */
export type MissingKind = "level" | "curious" | "affection" | "calm" | "topic" | "topic_variety" | "food";
/**
 * 业务错误分类。调用方按此分支处理,`message` 仅供人读。
 *
 * This interface was referenced by `PetWireProtocol`'s JSON-Schema
 * via the `definition` "ErrorCode".
 */
export type ErrorCode =
  | "bad_input"
  | "dead"
  | "no_food"
  | "no_medicine"
  | "not_sick"
  | "too_tired"
  | "time_backwards"
  | "unsupported_rules"
  | "not_eligible"
  | "invalid_reward";
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
  | {
      now: string;
      op: "grant";
      pet: Pet;
      request_id: string;
      reward: Reward;
    }
  | {
      op: "evolution_options";
      pet: Pet;
    }
  | (BirthInput & {
      op: "birth";
    })
  | (FrameInput & {
      op: "frame";
    })
  | {
      certificate: Certificate;
      issuer_keys: IssuerKey[];
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
 * 短期情绪,由身体状态派生,不存储,所以不会成为永久状态。
 *
 * This interface was referenced by `PetWireProtocol`'s JSON-Schema
 * via the `definition` "Mood".
 */
export type Mood = "sick" | "hungry" | "tired" | "happy" | "content";
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
  | (
      | "valid"
      | "unsupported_rules"
      | "bad_encoding"
      | "commit_signature"
      | "commitment_mismatch"
      | "accept_signature"
      | "result_mismatch"
    )
  | "unknown_key"
  | "key_not_valid"
  | "key_revoked";

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
  growth?: Growth;
  id: string;
  last_request: string;
  last_tick: string;
  medicine: number;
  /**
   * 持续失养的逻辑时间,决定预警、生病与死亡。
   */
  neglect: string;
  /**
   * 个体出生时所用的规则版本。缺省为 1，兼容该字段出现之前保存的个体。
   */
  rules_version?: number;
  satiety: number;
  /**
   * 饱食衰减的余数刻度,保证结算频率不影响总衰减量。
   */
  satiety_rem?: number;
}
/**
 * 成长状态:经验、阶段、性格、主题倾向。缺省为初始值,兼容没有该字段的旧存档。
 */
export interface Growth {
  /**
   * 后天罕见形态:0 无,1 为 Radiant。与出生稀有度无关,出生档位不变。
   */
  acquired_rarity: number;
  /**
   * 出生底色,由基因决定,创建后不变。当前性格最多偏离底色 +200。
   *
   * @minItems 3
   * @maxItems 3
   */
  base_traits: [number, number, number];
  /**
   * 性格漂移预算所属的天(逻辑时间 / 1440)。
   */
  drift_day: string;
  /**
   * 当天各维度已使用的漂移点数。
   *
   * @minItems 3
   * @maxItems 3
   */
  drift_used: [number, number, number];
  /**
   * 累计经验,至多 1500。
   */
  exp: number;
  /**
   * 已选择的进化分支,按发生顺序。出生身份与基因不随进化改变。
   */
  lineage: Branch[];
  stage: Stage;
  /**
   * 主题倾向,至多 8 项。
   */
  topics: TopicCount[];
  /**
   * 当前性格:好奇、亲和、沉稳,各 0 到 1000。
   *
   * @minItems 3
   * @maxItems 3
   */
  traits: [number, number, number];
}
/**
 * 主题倾向:接入方映射后的主题标签及累计次数。
 *
 * This interface was referenced by `PetWireProtocol`'s JSON-Schema
 * via the `definition` "TopicCount".
 */
export interface TopicCount {
  count: number;
  topic: string;
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
 * This interface was referenced by `PetWireProtocol`'s JSON-Schema
 * via the `definition` "BranchOption".
 */
export interface BranchOption {
  branch: Branch;
  eligible: boolean;
  missing: Missing[];
  to_stage: Stage;
}
/**
 * 未满足的进化条件:还差多少。
 *
 * This interface was referenced by `PetWireProtocol`'s JSON-Schema
 * via the `definition` "Missing".
 */
export interface Missing {
  have: number;
  kind: MissingKind;
  need: number;
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
  /**
   * 签发方声称的签发时间(逻辑时间)。它由签名保护但由签发方自报,
   * 所以撤销被盗密钥时应取最早可能的泄露时间,见 pet/docs/birth-protocol.md。
   */
  issued_at: string;
  issuer: string;
  /**
   * 签名密钥标识。验证方按它在密钥集中选择公钥,从而支持轮换。
   */
  kid: string;
  request_id: string;
  rules_version: number;
  world: string;
}
/**
 * 经服务裁决后发放的奖励。核心只校验单次上限,不决定谁有资格(见 ADR-0021)。
 *
 * This interface was referenced by `PetWireProtocol`'s JSON-Schema
 * via the `definition` "Reward".
 */
export interface Reward {
  /**
   * 经验,单次至多 100。
   */
  exp: number;
  /**
   * 食物,单次至多 10。
   */
  food: number;
  /**
   * 药品,单次至多 3。
   */
  medicine: number;
  /**
   * 接入方映射后的主题标签,至多 32 字节;缺省则不记录主题。
   */
  topic?: string | null;
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
 * 验证方信任的一把签发公钥及其有效期。
 *
 * This interface was referenced by `PetWireProtocol`'s JSON-Schema
 * via the `definition` "IssuerKey".
 */
export interface IssuerKey {
  kid: string;
  /**
   * 轮换后旧钥的结束时间(含);缺省表示仍在使用。已签发的旧证书在窗口内仍然有效。
   */
  not_after?: string | null;
  /**
   * 自该时间起签发的证书有效(含)。
   */
  not_before: string;
  /**
   * Ed25519 公钥,64 位十六进制。
   */
  public_key: string;
  /**
   * 撤销时间:自该时间起(含)签发的证书无效,之前的证书不受影响。
   */
  revoked_at?: string | null;
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
 * via the `definition` "EvolutionOptions".
 */
export interface EvolutionOptions {
  level: number;
  options: BranchOption[];
  stage: Stage;
}
/**
 * 成功响应信封。
 *
 * This interface was referenced by `PetWireProtocol`'s JSON-Schema
 * via the `definition` "EvolutionOptionsResult".
 */
export interface EvolutionOptionsResult {
  ok: boolean;
  value: EvolutionOptions;
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
 * 成长状态。所有字段有默认值,保证没有该结构的旧存档仍可加载。
 *
 * This interface was referenced by `PetWireProtocol`'s JSON-Schema
 * via the `definition` "Growth".
 */
export interface Growth1 {
  /**
   * 后天罕见形态:0 无,1 为 Radiant。与出生稀有度无关,出生档位不变。
   */
  acquired_rarity: number;
  /**
   * 出生底色,由基因决定,创建后不变。当前性格最多偏离底色 +200。
   *
   * @minItems 3
   * @maxItems 3
   */
  base_traits: [number, number, number];
  /**
   * 性格漂移预算所属的天(逻辑时间 / 1440)。
   */
  drift_day: string;
  /**
   * 当天各维度已使用的漂移点数。
   *
   * @minItems 3
   * @maxItems 3
   */
  drift_used: [number, number, number];
  /**
   * 累计经验,至多 1500。
   */
  exp: number;
  /**
   * 已选择的进化分支,按发生顺序。出生身份与基因不随进化改变。
   */
  lineage: Branch[];
  stage: Stage;
  /**
   * 主题倾向,至多 8 项。
   */
  topics: TopicCount[];
  /**
   * 当前性格:好奇、亲和、沉稳,各 0 到 1000。
   *
   * @minItems 3
   * @maxItems 3
   */
  traits: [number, number, number];
}
/**
 * This interface was referenced by `PetWireProtocol`'s JSON-Schema
 * via the `definition` "Outcome".
 */
export interface Outcome {
  mood: Mood;
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
  evolution_options: EvolutionOptionsResult;
  frame: FrameResult;
  grant: OutcomeResult;
  verify_birth: VerdictResult;
}
export type ResultOf<C extends Command> = OpResults[C["op"]] | ErrorBody;
