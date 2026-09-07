package org.openmanuscript.studio.updater

import androidx.core.content.FileProvider

/**
 * Gives the updater its own manifest component identity.
 *
 * The generated Tauri app also declares AndroidX FileProvider for regular file
 * sharing. Using FileProvider directly here makes Android's manifest merger
 * treat both declarations as the same component, even though their authorities
 * and path resources are intentionally different.
 */
class OmiUpdateFileProvider : FileProvider()
