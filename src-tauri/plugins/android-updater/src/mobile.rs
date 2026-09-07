use serde::{de::DeserializeOwned, Serialize};
use tauri::{
    plugin::{PluginApi, PluginHandle},
    AppHandle, Runtime,
};

const PLUGIN_IDENTIFIER: &str = "org.openmanuscript.studio.updater";

pub fn init<R: Runtime, C: DeserializeOwned>(
    _app: &AppHandle<R>,
    api: PluginApi<R, C>,
) -> crate::Result<AndroidUpdater<R>> {
    let handle = api.register_android_plugin(PLUGIN_IDENTIFIER, "AndroidUpdaterPlugin")?;
    Ok(AndroidUpdater(handle))
}

pub struct AndroidUpdater<R: Runtime>(PluginHandle<R>);

impl<R: Runtime> AndroidUpdater<R> {
    pub async fn install_update(&self, url: String, sha256: String) -> crate::Result<()> {
        self.0
            .run_mobile_plugin_async("installUpdate", InstallUpdatePayload { url, sha256 })
            .await
            .map_err(Into::into)
    }
}

#[derive(Serialize)]
struct InstallUpdatePayload {
    url: String,
    sha256: String,
}
