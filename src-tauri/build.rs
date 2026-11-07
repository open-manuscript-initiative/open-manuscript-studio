fn main() {
    // build.rs runs on the host, so use Cargo's target metadata, not cfg!(android).
    let android = std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("android");
    let bits64 = std::env::var("CARGO_CFG_TARGET_POINTER_WIDTH").as_deref() == Ok("64");
    if android && bits64 {
        println!("cargo:rustc-link-arg-cdylib=-Wl,-z,max-page-size=16384");
        println!("cargo:rustc-link-arg-cdylib=-Wl,-z,common-page-size=16384");
    }
    if android {
        tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
            tauri_build::AppManifest::new().commands(&["take_opened_documents"]),
        ))
        .expect("failed to build Studio permissions")
    } else {
        tauri_build::build()
    }
}
