use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn execute(input: &str) -> String {
    pet_core::execute(input)
}

