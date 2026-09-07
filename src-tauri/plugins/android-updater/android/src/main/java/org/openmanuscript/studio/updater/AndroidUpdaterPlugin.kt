package org.openmanuscript.studio.updater

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.core.content.FileProvider
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

@InvokeArg
class InstallUpdateArgs {
    lateinit var url: String
    lateinit var sha256: String
}

@TauriPlugin
class AndroidUpdaterPlugin(private val activity: Activity) : Plugin(activity) {
    @Command
    fun installUpdate(invoke: Invoke) {
        val args = invoke.parseArgs(InstallUpdateArgs::class.java)

        Thread {
            try {
                val expectedDigest = normalizeDigest(args.sha256)
                validateReleaseUrl(args.url)
                val apk = downloadAndVerify(args.url, expectedDigest)

                Handler(Looper.getMainLooper()).post {
                    try {
                        openPackageInstaller(apk)
                        invoke.resolve(JSObject().apply { put("status", "installer-opened") })
                    } catch (error: Exception) {
                        invoke.reject(error.message ?: "Unable to open Android package installer.")
                    }
                }
            } catch (error: Exception) {
                invoke.reject(error.message ?: "Unable to download Android update.")
            }
        }.start()
    }

    private fun validateReleaseUrl(value: String) {
        val uri = Uri.parse(value)
        require(uri.scheme == "https") { "Android update URL must use HTTPS." }
        require(uri.host.equals("github.com", ignoreCase = true)) {
            "Android update URL must use the trusted GitHub release host."
        }
        require(
            uri.path?.startsWith(
                "/open-manuscript-initiative/open-manuscript-studio/releases/download/",
            ) == true,
        ) { "Android update URL is not an Open Manuscript Studio release asset." }
        require(uri.path?.endsWith(".apk", ignoreCase = true) == true) {
            "Android update asset must be an APK."
        }
    }

    private fun normalizeDigest(value: String): String {
        val normalized = value.trim().removePrefix("sha256:").lowercase()
        require(normalized.matches(Regex("^[0-9a-f]{64}$"))) {
            "Android update is missing a valid SHA-256 digest."
        }
        return normalized
    }

    private fun downloadAndVerify(url: String, expectedDigest: String): File {
        val updateDir = File(activity.cacheDir, "updates").apply { mkdirs() }
        val partial = File(updateDir, "Open-Manuscript-Studio-update.apk.part")
        val completed = File(updateDir, "Open-Manuscript-Studio-update.apk")
        partial.delete()
        completed.delete()

        val connection = URL(url).openConnection() as HttpURLConnection
        connection.instanceFollowRedirects = true
        connection.connectTimeout = 30_000
        connection.readTimeout = 60_000
        connection.setRequestProperty("User-Agent", "Open-Manuscript-Studio-Android-Updater")
        connection.setRequestProperty("Accept", "application/vnd.android.package-archive, application/octet-stream")

        try {
            connection.connect()
            require(connection.responseCode in 200..299) {
                "Android update download failed with HTTP ${connection.responseCode}."
            }

            val contentLength = connection.contentLengthLong
            require(contentLength <= MAX_APK_BYTES || contentLength < 0) {
                "Android update package is unexpectedly large."
            }

            val digest = MessageDigest.getInstance("SHA-256")
            var totalBytes = 0L
            connection.inputStream.use { input ->
                FileOutputStream(partial).use { output ->
                    val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
                    while (true) {
                        val count = input.read(buffer)
                        if (count < 0) break
                        if (count == 0) continue
                        totalBytes += count
                        require(totalBytes <= MAX_APK_BYTES) {
                            "Android update package exceeded the maximum allowed size."
                        }
                        digest.update(buffer, 0, count)
                        output.write(buffer, 0, count)
                    }
                    output.fd.sync()
                }
            }

            require(totalBytes > 0) { "Android update download returned an empty file." }
            val actualDigest = digest.digest().joinToString("") { "%02x".format(it) }
            require(actualDigest == expectedDigest) {
                "Android update SHA-256 verification failed."
            }

            require(partial.renameTo(completed)) {
                "Unable to finalize the downloaded Android update."
            }
            return completed
        } catch (error: Exception) {
            partial.delete()
            completed.delete()
            throw error
        } finally {
            connection.disconnect()
        }
    }

    @Suppress("DEPRECATION")
    private fun openPackageInstaller(apk: File) {
        val uri = FileProvider.getUriForFile(
            activity,
            "${activity.packageName}.omi_updates",
            apk,
        )
        val intent = Intent(Intent.ACTION_INSTALL_PACKAGE).apply {
            data = uri
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            putExtra(Intent.EXTRA_RETURN_RESULT, false)
        }
        require(intent.resolveActivity(activity.packageManager) != null) {
            "No Android package installer is available on this device."
        }
        activity.startActivity(intent)
    }

    companion object {
        private const val MAX_APK_BYTES = 200L * 1024L * 1024L
    }
}
