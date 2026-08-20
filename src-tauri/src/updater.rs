#[cfg(desktop)]
use serde::Serialize;
#[cfg(desktop)]
use tauri::{AppHandle, Runtime};
#[cfg(desktop)]
use tauri_plugin_updater::UpdaterExt;

#[cfg(desktop)]
const UPDATE_ENDPOINT: &str = "https://github.com/open-manuscript-initiative/open-manuscript-studio/releases/latest/download/latest.json";

#[cfg(desktop)]
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopUpdateInfo {
    current_version: String,
    version: String,
    date: Option<String>,
    body: Option<String>,
}

#[cfg(desktop)]
fn updater_public_key() -> Result<&'static str, String> {
    option_env!("OMI_UPDATER_PUBLIC_KEY")
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "Desktop updater is not configured for this build.".to_string())
}

#[cfg(desktop)]
async fn check<R: Runtime>(app: &AppHandle<R>) -> Result<Option<tauri_plugin_updater::Update>, String> {
    let pubkey = updater_public_key()?;
    let endpoint = UPDATE_ENDPOINT
        .parse()
        .map_err(|error| format!("Invalid updater endpoint: {error}"))?;

    app.updater_builder()
        .pubkey(pubkey)
        .endpoints(vec![endpoint])
        .map_err(|error| error.to_string())?
        .build()
        .map_err(|error| error.to_string())?
        .check()
        .await
        .map_err(|error| error.to_string())
}

#[cfg(desktop)]
#[tauri::command]
pub async fn check_for_update<R: Runtime>(app: AppHandle<R>) -> Result<Option<DesktopUpdateInfo>, String> {
    let current_version = app.package_info().version.to_string();
    let Some(update) = check(&app).await? else {
        return Ok(None);
    };

    Ok(Some(DesktopUpdateInfo {
        current_version,
        version: update.version.to_string(),
        date: update.date.map(|value| value.to_string()),
        body: update.body.clone(),
    }))
}

#[cfg(desktop)]
#[tauri::command]
pub async fn install_update<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    let Some(update) = check(&app).await? else {
        return Ok(());
    };

    update
        .download_and_install(|_, _| {}, || {})
        .await
        .map_err(|error| error.to_string())?;

    #[cfg(target_os = "windows")]
    {
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        app.restart()
    }
}
