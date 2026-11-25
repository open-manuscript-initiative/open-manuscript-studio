#[derive(serde::Serialize)]
pub struct EditorMemoryInfo {
    total_mib: Option<u64>,
    available_mib: Option<u64>,
}

// System-wide information, not the WebView renderer's actual heap or PSS.
#[tauri::command]
pub fn editor_memory_info() -> EditorMemoryInfo {
    let contents = std::fs::read_to_string("/proc/meminfo").unwrap_or_default();
    fn mib(contents: &str, key: &str) -> Option<u64> {
        contents.lines().find_map(|line| {
            let value = line.strip_prefix(key)?;
            value.split_whitespace().next()?.parse::<u64>().ok().map(|kb| kb / 1024)
        })
    }
    EditorMemoryInfo {
        total_mib: mib(&contents, "MemTotal:"),
        available_mib: mib(&contents, "MemAvailable:"),
    }
}
