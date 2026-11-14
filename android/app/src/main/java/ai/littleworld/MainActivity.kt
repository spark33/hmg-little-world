package ai.littleworld

import android.app.Activity
import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.view.View
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
    private lateinit var web: WebView
    private lateinit var safetyCover: TextView
    private lateinit var vehicle: VehicleIntegration
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private var foreground = false
    private val origin = "https://appassets.androidplatform.net"
    private val entryPage = "$origin/assets/web/index.html"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        vehicle = createVehicleAdapter(this)
        web = WebView(this)
        val root = FrameLayout(this)
        root.addView(web, FrameLayout.LayoutParams(-1, -1))
        safetyCover = TextView(this).apply {
            text = getString(R.string.safety_cover)
            textSize = 24f
            gravity = Gravity.CENTER
            setTextColor(Color.rgb(60, 83, 63))
            setBackgroundColor(Color.rgb(237, 240, 223))
            isClickable = true
        }
        root.addView(safetyCover, FrameLayout.LayoutParams(-1, -1))
        setContentView(root)
        publishSafety()

        val loader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            setSupportMultipleWindows(false)
        }
        val bridge = PleosBridge(vehicle)
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(web, "NativeBridge", setOf(origin)) {
                    _, message, source, mainFrame, proxy ->
                if (foreground && mainFrame && source.toString() == origin &&
                    canInteract(vehicle.safety.value, BuildConfig.DEVELOPMENT_PREVIEW)) {
                    proxy.postMessage(bridge.reply(message.data ?: ""))
                }
            }
        }
        web.webViewClient = object : WebViewClient() {
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

            override fun onPageFinished(view: WebView, url: String) { publishSafety() }
        }
        scope.launch { vehicle.safety.collect { publishSafety() } }
        web.loadUrl(entryPage)
    }

    private fun publishSafety(active: Boolean = foreground) {
        if (!::web.isInitialized) return
        // Native visibility gates remain effective even when JavaScript is busy or fails.
        val allowed = active && canInteract(vehicle.safety.value, BuildConfig.DEVELOPMENT_PREVIEW)
        web.visibility = if (allowed) View.VISIBLE else View.INVISIBLE
        safetyCover.visibility = if (allowed) View.GONE else View.VISIBLE
        val payload = JSONObject()
            .put("state", if (active) vehicle.safety.value.name.lowercase() else "unknown")
            .put("preview", active && BuildConfig.DEVELOPMENT_PREVIEW)
        web.evaluateJavascript(
            "window.dispatchEvent(new CustomEvent('vehicle-safety',{detail:$payload}));", null
        )
    }

    override fun onPause() {
        foreground = false
        publishSafety(false)
        web.onPause()
        vehicle.restoreLighting()
        super.onPause()
    }

    override fun onResume() {
        super.onResume()
        foreground = true
        if (::web.isInitialized) {
            web.onResume()
            publishSafety()
        }
    }

    override fun onDestroy() {
        scope.cancel()
        vehicle.restoreLighting()
        vehicle.close()
        web.destroy()
        super.onDestroy()
    }
}
