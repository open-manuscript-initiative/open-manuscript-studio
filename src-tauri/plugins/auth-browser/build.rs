const COMMANDS: &[&str] = &["open_auth_url"];

fn main() {
    tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .build();
}
