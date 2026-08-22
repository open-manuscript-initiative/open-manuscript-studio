package org.openmanuscript.auth_browser

import android.app.Activity
import android.content.Intent
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin

@InvokeArg
class OpenAuthUrlArgs {
    lateinit var url: String
}

@TauriPlugin
class AuthBrowserPlugin(private val activity: Activity) : Plugin(activity) {
    @Command
    fun open_auth_url(invoke: Invoke) {
        val args = invoke.parseArgs(OpenAuthUrlArgs::class.java)
        val uri = runCatching { Uri.parse(args.url) }.getOrNull()

        if (uri == null || uri.scheme != "https") {
            invoke.reject("Authentication URL must use HTTPS")
            return
        }

        try {
            CustomTabsIntent.Builder()
                .setShowTitle(true)
                .build()
                .launchUrl(activity, uri)

            invoke.resolve(JSObject())
        } catch (error: Exception) {
            try {
                val fallback = Intent(Intent.ACTION_VIEW, uri).apply {
                    addCategory(Intent.CATEGORY_BROWSABLE)
                }
                activity.startActivity(fallback)
                invoke.resolve(JSObject())
            } catch (fallbackError: Exception) {
                invoke.reject(
                    fallbackError.message ?: error.message ?: "Unable to open authentication browser",
                )
            }
        }
    }
}
