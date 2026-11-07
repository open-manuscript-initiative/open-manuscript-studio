use std::sync::Mutex;
use tauri::{Emitter, Manager, Runtime};

#[derive(Default)]
pub struct OpenedDocuments(Mutex<Vec<String>>);

#[tauri::command]
pub fn take_opened_documents(
    webview: tauri::Webview,
    documents: tauri::State<'_, OpenedDocuments>,
) -> Result<Vec<String>, String> {
    if webview.label() != "main" {
        return Err("Only the Studio main WebView can receive documents.".into());
    }
    let mut queue = documents.0.lock().map_err(|e| e.to_string())?;
    Ok(std::mem::take(&mut *queue))
}

pub fn enqueue<R: Runtime>(app: &tauri::AppHandle<R>, urls: Vec<tauri::Url>) {
    let documents = app.state::<OpenedDocuments>();
    if let Ok(mut queue) = documents.0.lock() {
        // Android file managers grant access to content:// documents. OAuth and
        // web URLs must never enter the document reader.
        for url in urls.into_iter().filter(|url| url.scheme() == "content") {
            if queue.len() < 32 {
                queue.push(url.to_string());
            }
        }
    }
    // The queue also survives a cold start/login before the frontend subscribes.
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.emit("omi-opened-documents", ());
    }
}
