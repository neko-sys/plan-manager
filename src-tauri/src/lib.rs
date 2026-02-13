// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use serde::Deserialize;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[derive(Deserialize)]
struct OllamaTag {
    name: String,
}

#[derive(Deserialize)]
struct OllamaTagsResponse {
    models: Vec<OllamaTag>,
}

#[tauri::command]
async fn list_ollama_models() -> Result<Vec<String>, String> {
    let response = reqwest::Client::new()
        .get("http://127.0.0.1:11434/api/tags")
        .send()
        .await
        .map_err(|error| format!("failed to connect ollama: {error}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "ollama request failed with status {}",
            response.status()
        ));
    }

    let payload: OllamaTagsResponse = response
        .json()
        .await
        .map_err(|error| format!("failed to parse ollama response: {error}"))?;

    let mut names: Vec<String> = payload.models.into_iter().map(|item| item.name).collect();
    names.sort();
    names.dedup();
    Ok(names)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, list_ollama_models])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
