use tauri::{
    plugin::{Builder, TauriPlugin},
    Runtime,
};

#[cfg(target_os = "android")]
const PLUGIN_IDENTIFIER: &str = "org.openmanuscript.auth_browser";

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("auth-browser")
        .setup(|_app, api| {
            #[cfg(target_os = "android")]
            {
                api.register_android_plugin(PLUGIN_IDENTIFIER, "AuthBrowserPlugin")?;
            }

            Ok(())
        })
        .build()
}
