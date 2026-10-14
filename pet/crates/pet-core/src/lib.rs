#![no_std]
#![forbid(unsafe_code)]

extern crate alloc;

mod birth;
mod caps;
mod codec;
pub mod growth;
mod life;
pub mod proof;
mod rng;

pub use birth::{derive_birth, Birth, BirthInput};
pub use life::{act, grant, Action, ActError, Mood, Outcome, Pet, Phase, Reward};

use alloc::string::String;
use alloc::vec::Vec;
use serde::Deserialize;

pub use caps::{catalog, Capability, CapabilityCatalog, CAPABILITIES};
pub use codec::{hex, ErrorBody, ErrorCode, OkBody};

pub const RULES_VERSION: u32 = 1;

/// 线上命令:`op` 为判别字段。
#[derive(Deserialize)]
#[cfg_attr(feature = "schema", derive(schemars::JsonSchema))]
#[serde(tag = "op", rename_all = "snake_case")]
pub enum Command {
    Capabilities,
    Grant {
        pet: Pet,
        reward: Reward,
        #[serde(with = "codec::u64_string")]
        #[cfg_attr(feature = "schema", schemars(with = "String"))]
        now: u64,
        request_id: String,
    },
    EvolutionOptions {
        pet: Pet,
    },
    Birth(BirthInput),
    Frame(pet_term::FrameInput),
    Sprite(pet_term::PixelInput),
    VerifyBirth {
        certificate: proof::Certificate,
        issuer_keys: Vec<proof::IssuerKey>,
    },
    Act {
        pet: Pet,
        action: Action,
        #[serde(with = "codec::u64_string")]
        #[cfg_attr(feature = "schema", schemars(with = "String"))]
        now: u64,
        request_id: String,
    },
}

/// 单一 JSON 入口:原生、浏览器 WebAssembly 与 Node WebAssembly 共用,三端输出逐字节比较。
pub fn execute(input: &str) -> String {
    let out = match serde_json::from_str::<Command>(input) {
        Err(e) => codec::error(ErrorCode::BadInput, &alloc::format!("{e}")),
        Ok(Command::Birth(b)) => match derive_birth(&b) {
            Ok(v) => codec::ok(&v),
            Err(e) => codec::error(ErrorCode::BadInput, e),
        },
        Ok(Command::Grant { pet, reward, now, request_id }) => match grant(pet, &reward, now, &request_id) {
            Ok(v) => codec::ok(&v),
            Err(e) => codec::error(e.code(), e.message()),
        },
        Ok(Command::EvolutionOptions { pet }) => codec::ok(&growth::evolution_options(&pet.growth, pet.food)),
        Ok(Command::Capabilities) => codec::ok(&catalog()),
        Ok(Command::Frame(f)) => codec::ok(&pet_term::render(&f)),
        Ok(Command::Sprite(s)) => codec::ok(&pet_term::render_pixels(&s)),
        Ok(Command::VerifyBirth { certificate, issuer_keys }) => codec::ok(&proof::verify(&certificate, &issuer_keys)),
        Ok(Command::Act { pet, action, now, request_id }) => {
            match act(pet, action, now, &request_id) {
                Ok(v) => codec::ok(&v),
                Err(e) => codec::error(e.code(), e.message()),
            }
        }
    };
    out
}
