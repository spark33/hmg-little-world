package ai.littleworld

/** Native visibility policy remains effective if the web renderer or JavaScript fails. */
class NativePresentationPolicy {
    private var foreground = false
    private var pageReady = false
    private var focused = false
    private var interactive = true
    private var rendererFailed = false
    private var destroyed = false

    fun foreground() { if (!destroyed) foreground = true }
    fun background() { foreground = false }
    fun focusChanged(value: Boolean) { focused = value && !destroyed }
    fun displayChanged(value: Boolean) { interactive = value && !destroyed }
    fun pageLoading() { pageReady = false }
    fun pageReady() { if (!destroyed && !rendererFailed) pageReady = true }
    fun contentFailed() { rendererFailed = true; pageReady = false }
    fun destroy() { destroyed = true; foreground = false; pageReady = false }

    fun allowed(safety: SafetyState, nonVehiclePreview: Boolean): Boolean =
        foreground && focused && interactive && pageReady && !rendererFailed && !destroyed &&
            canInteract(safety, nonVehiclePreview)
}
