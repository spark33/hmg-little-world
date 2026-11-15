package ai.littleworld

/** A disconnected optional service must not prevent other resources from being released. */
internal fun cleanupSafely(vararg actions: () -> Unit) {
    for (action in actions) {
        try { action() }
        catch (_: Exception) { /* Continue releasing independent resources. */ }
        catch (_: LinkageError) { /* An optional platform API can disappear on unsupported devices. */ }
    }
}
