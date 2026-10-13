#![no_std]
#![forbid(unsafe_code)]

extern crate alloc;

mod birth;
mod codec;
mod life;
pub mod proof;
mod rng;

pub use birth::{derive_birth, Birth, BirthInput};
pub use life::{act, Action, ActError, Outcome, Pet, Phase};

use alloc::string::String;
use serde::Deserialize;

pub use codec::{ErrorBody, OkBody};

pub const RULES_VERSION: u32 = 1;

/// 线上命令:`op` 为判别字段。
#[derive(Deserialize)]
#[cfg_attr(feature = "schema", derive(schemars::JsonSchema))]
#[serde(tag = "op", rename_all = "snake_case")]
pub enum Command {
    Birth(BirthInput),
    Frame(pet_term::FrameInput),
    VerifyBirth {
        certificate: proof::Certificate,
        issuer_pub: String,
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
        Err(e) => codec::error("bad_input", &alloc::format!("{e}")),
        Ok(Command::Birth(b)) => match derive_birth(&b) {
            Ok(v) => codec::ok(&v),
            Err(e) => codec::error("bad_input", e),
        },
        Ok(Command::Frame(f)) => codec::ok(&pet_term::render(&f)),
        Ok(Command::VerifyBirth { certificate, issuer_pub }) => {
            match codec::unhex(&issuer_pub).and_then(|v| <[u8; 32]>::try_from(v).ok()) {
                Some(k) => codec::ok(&proof::verify(&certificate, &k)),
                None => codec::error("bad_input", "issuer_pub must be 32 bytes hex"),
            }
        }
        Ok(Command::Act { pet, action, now, request_id }) => {
            match act(pet, action, now, &request_id) {
                Ok(v) => codec::ok(&v),
                Err(e) => codec::error(e.code(), e.message()),
            }
        }
    };
    out
}
