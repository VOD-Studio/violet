#![no_std]
#![forbid(unsafe_code)]

extern crate alloc;

mod birth;
mod codec;
mod life;
mod rng;

pub use birth::{derive_birth, Birth, BirthInput};
pub use life::{act, Action, ActError, Outcome, Pet, Phase};

use alloc::string::String;
use serde::Deserialize;

pub const RULES_VERSION: u32 = 1;

#[derive(Deserialize)]
#[serde(tag = "op", rename_all = "snake_case")]
enum Command {
    Birth(BirthInput),
    Act {
        pet: Pet,
        action: Action,
        #[serde(with = "codec::u64_string")]
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
        Ok(Command::Act { pet, action, now, request_id }) => {
            match act(pet, action, now, &request_id) {
                Ok(v) => codec::ok(&v),
                Err(e) => codec::error(e.code(), e.message()),
            }
        }
    };
    out
}
