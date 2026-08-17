#[cfg(desktop)]
mod updater;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init());

    #[cfg(desktop)]
    let builder = builder.invoke_handler(tauri::generate_handler![
        updater::check_for_update,
        updater::install_update,
    ]);

    builder
        .run(tauri::generate_context!())
        .expect("error while running Open Manuscript Studio");
}
