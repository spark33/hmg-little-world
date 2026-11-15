package ai.littleworld

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Bitmap
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.TextView
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import org.json.JSONObject

class MainActivity : Activity() {
    private var web: WebView? = null
    private lateinit var root: FrameLayout
    private lateinit var safetyCover: TextView
    private lateinit var vehicle: VehicleIntegration
    private var audioFocus: AudioFocusIntegration? = null
    private var screenReceiverRegistered = false
    private val presentation = NativePresentationPolicy()
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private var destroyed = false
    private var bridgeRegistered = false
    private var contentFailure = false
    private val origin = "https://appassets.androidplatform.net"
    private val entryPage = "$origin/assets/web/index.html"
    private val screenOffReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == Intent.ACTION_SCREEN_OFF) {
                audioFocus?.releaseAudioFocus()
                publishAudioFocus(false)
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        root = FrameLayout(this)
        safetyCover = TextView(this).apply {
            text = getString(R.string.safety_cover)
            textSize = 24f
            gravity = Gravity.CENTER
            setPadding(32, 32, 32, 32)
            setTextColor(Color.rgb(60, 83, 63))
            setBackgroundColor(Color.rgb(237, 240, 223))
            isClickable = true
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_YES
        }
        root.addView(safetyCover, FrameLayout.LayoutParams(-1, -1))
        setContentView(root)
        // Show the native cover before initializing optional services or the renderer.
        vehicle = try {
            createVehicleAdapter(this)
        } catch (_: Exception) {
            DemoVehicleAdapter()
        } catch (_: LinkageError) {
            DemoVehicleAdapter()
        }
        audioFocus = AndroidAudioFocusController(this, {
            !destroyed && !contentFailure && presentation.allowed(vehicle.safety.value, BuildConfig.DEVELOPMENT_PREVIEW)
        }, ::publishAudioFocus)
        try {
            val filter = IntentFilter(Intent.ACTION_SCREEN_OFF)
            if (Build.VERSION.SDK_INT >= 33) registerReceiver(screenOffReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
            else registerReceiver(screenOffReceiver, filter)
            screenReceiverRegistered = true
        } catch (_: Exception) {
            // Lack of a screen-off observer cannot permit audio across suspend.
            audioFocus?.close()
            audioFocus = null
        }
        try {
            val created = WebView(this)
            web = created
            created.visibility = View.INVISIBLE
            root.addView(created, 0, FrameLayout.LayoutParams(-1, -1))
            configureWebView(created)
            created.loadUrl(entryPage)
            scope.launch { vehicle.safety.collect { publishSafety() } }
        } catch (_: Exception) {
            failContent()
        } catch (_: LinkageError) {
            failContent()
        }
    }

    private fun configureWebView(view: WebView) {
        val loader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
        view.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            setSupportMultipleWindows(false)
        }
        val bridge = PleosBridge(vehicle, audioFocus = audioFocus)
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(view, "NativeBridge", setOf(origin)) {
                    sender, message, source, mainFrame, proxy ->
                if (!destroyed && sender === web && mainFrame && source.toString() == origin &&
                    presentation.allowed(vehicle.safety.value, BuildConfig.DEVELOPMENT_PREVIEW)) {
                    try { proxy.postMessage(bridge.reply(message.data ?: "")) }
                    catch (_: Exception) { /* The frame may have disappeared during the reply. */ }
                }
            }
            bridgeRegistered = true
        }
        view.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest
            ): WebResourceResponse = loader.shouldInterceptRequest(request.url)
                ?: WebResourceResponse(
                    "text/plain", "UTF-8", 403, "Forbidden", emptyMap(),
                    "Blocked".byteInputStream()
                )

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest) =
                request.url.toString() != entryPage

            override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
                if (!destroyed && view === web) {
                    presentation.pageLoading()
                    publishSafety()
                }
            }

            override fun onPageFinished(view: WebView, url: String) {
                if (!destroyed && view === web && url == entryPage) {
                    presentation.pageReady()
                    publishSafety()
                }
            }

            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame && view === web) failContent()
            }

            override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                if (view === web) failContent()
                // Android requires the affected WebView to be removed and destroyed.
                disposeWebView(view)
                return true
            }
        }
    }

    private fun publishSafety() {
        if (destroyed || !::vehicle.isInitialized) return
        val view = web
        val allowed = view != null && presentation.allowed(vehicle.safety.value, BuildConfig.DEVELOPMENT_PREVIEW)
        // This opaque native gate does not depend on responsive or trustworthy JavaScript.
        view?.visibility = if (allowed) View.VISIBLE else View.INVISIBLE
        safetyCover.visibility = if (allowed) View.GONE else View.VISIBLE
        if (!allowed) audioFocus?.releaseAudioFocus()
        if (view == null || contentFailure) return
        val payload = JSONObject()
            .put("state", if (allowed) vehicle.safety.value.name.lowercase() else "unknown")
            .put("preview", allowed && BuildConfig.DEVELOPMENT_PREVIEW)
        try {
            view.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('vehicle-safety',{detail:$payload}));", null
            )
        } catch (_: Exception) {
            failContent()
        }
    }

    private fun failContent() {
        contentFailure = true
        presentation.contentFailed()
        web?.visibility = View.INVISIBLE
        safetyCover.visibility = View.VISIBLE
        safetyCover.setText(R.string.roamy_content_restart)
        audioFocus?.releaseAudioFocus()
        if (::vehicle.isInitialized) {
            cleanupSafely({ vehicle.onBackground() }, { vehicle.restoreLighting() })
        }
    }

    private fun publishAudioFocus(granted: Boolean) {
        val view = web ?: return
        if (destroyed) return
        val payload = JSONObject().put("granted", granted)
        try {
            view.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('roamy-audio-focus',{detail:$payload}));", null
            )
        } catch (_: Exception) {
            // Focus has already been abandoned; renderer failure must not reacquire it.
        }
    }

    private fun disposeWebView(view: WebView) {
        if (view === web) web = null
        if (bridgeRegistered && WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            try { WebViewCompat.removeWebMessageListener(view, "NativeBridge") }
            catch (_: Exception) { /* Renderer already gone. */ }
            bridgeRegistered = false
        }
        root.removeView(view)
        try { view.destroy() } catch (_: Exception) { /* Already destroyed. */ }
    }

    override fun onPause() {
        presentation.background()
        publishSafety()
        try { web?.onPause() } catch (_: Exception) { failContent() }
        if (::vehicle.isInitialized) {
            cleanupSafely({ vehicle.onBackground() }, { vehicle.restoreLighting() })
        }
        super.onPause()
    }

    override fun onResume() {
        super.onResume()
        if (destroyed || contentFailure || !::vehicle.isInitialized) return
        presentation.foreground()
        try {
            vehicle.onForeground()
            web?.onResume()
        } catch (_: Exception) {
            failContent()
            return
        } catch (_: LinkageError) {
            failContent()
            return
        }
        publishSafety()
    }

    override fun onDestroy() {
        cleanupSafely({ audioFocus?.close() })
        audioFocus = null
        destroyed = true
        presentation.destroy()
        scope.cancel()
        if (screenReceiverRegistered) {
            cleanupSafely({ unregisterReceiver(screenOffReceiver) })
            screenReceiverRegistered = false
        }
        if (::vehicle.isInitialized) {
            cleanupSafely({ vehicle.onBackground() }, { vehicle.restoreLighting() }, { vehicle.close() })
        }
        web?.let { disposeWebView(it) }
        super.onDestroy()
    }
}
