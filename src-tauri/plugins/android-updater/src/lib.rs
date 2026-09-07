use tauri::{
    plugin::{Builder, TauriPlugin},
    Manager, Runtime,
};

mod commands;
mod error;
mod mobile;

pub use error::{Error, Result};
pub use mobile::AndroidUpdater;

pub trait AndroidUpdaterExt<R: Runtime> {
    fn android_updater(&self) -> &AndroidUpdater<R>;
}

impl<R: Runtime, T: Manager<R>> AndroidUpdaterExt<R> for T {
    fn android_updater(&self) -> &AndroidUpdater<R> {
        self.state::<AndroidUpdater<R>>().inner()
    }
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("android-updater")
        .invoke_handler(tauri::generate_handler![commands::install_update])
        .setup(|app, api| {
            let updater = mobile::init(app, api)?;
            app.manage(updater);
            Ok(())
        })
        .build()
}
