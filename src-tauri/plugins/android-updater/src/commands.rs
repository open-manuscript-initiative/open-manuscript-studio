use tauri::{command, AppHandle, Runtime};

use crate::{AndroidUpdaterExt, Result};

#[command]
pub(crate) async fn install_update<R: Runtime>(
    app: AppHandle<R>,
    url: String,
    sha256: String,
) -> Result<()> {
    app.android_updater().install_update(url, sha256).await
}
