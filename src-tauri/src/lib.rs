#[cfg(desktop)]
mod updater;

#[cfg(mobile)]
fn install_mobile_crypto_provider() {
    let _ = rustls::crypto::ring::default_provider().install_default();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(mobile)]
    install_mobile_crypto_provider();

    // The persisted-scope plugin must be registered after the filesystem
    // plugin. It restores only paths the author explicitly granted through a
    // native dialog, so synchronized folders remain usable after a restart
    // without broadening the static filesystem capability.
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_persisted_scope::init());

    #[cfg(desktop)]
    let builder = builder.invoke_handler(tauri::generate_handler![
        updater::check_for_update,
        updater::install_update,
    ]);

    builder
        .run(tauri::generate_context!())
        .expect("error while running Open Manuscript Studio");
}
