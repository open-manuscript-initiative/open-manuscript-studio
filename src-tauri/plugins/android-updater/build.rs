const COMMANDS: &[&str] = &["install_update", "open_play_store"];

fn main() {
    tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .build();
}
