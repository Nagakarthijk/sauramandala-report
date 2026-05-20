package org.sauramandala.lingualkeys

import kotlinx.coroutines.*
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.net.URLEncoder
import java.util.concurrent.TimeUnit

class TranslationManager {

    private val client = OkHttpClient.Builder()
        .connectTimeout(8, TimeUnit.SECONDS)
        .readTimeout(8, TimeUnit.SECONDS)
        .build()

    // LRU-style cache keyed by "src|tgt|text"
    private val cache = object : LinkedHashMap<String, String>(64, 0.75f, true) {
        override fun removeEldestEntry(eldest: Map.Entry<String, String>) = size > 64
    }

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var pendingJob: Job? = null

    fun translateDebounced(
        text: String,
        src: String,
        tgt: String,
        onLoading: () -> Unit,
        onResult: (String) -> Unit,
        onError: () -> Unit
    ) {
        pendingJob?.cancel()
        if (text.isBlank() || text.length < 2) return

        pendingJob = scope.launch {
            delay(550)

            val key = "$src|$tgt|${text.trim()}"
            val hit = synchronized(cache) { cache[key] }
            if (hit != null) {
                withContext(Dispatchers.Main) { onResult(hit) }
                return@launch
            }

            withContext(Dispatchers.Main) { onLoading() }

            try {
                val encoded = URLEncoder.encode(text.trim(), "UTF-8")
                val url = "https://api.mymemory.translated.net/get?q=$encoded&langpair=$src|$tgt"
                val req = Request.Builder().url(url).build()
                val body = client.newCall(req).execute().use { it.body?.string() }
                    ?: throw IllegalStateException("Empty body")
                val translated = JSONObject(body)
                    .getJSONObject("responseData")
                    .getString("translatedText")

                synchronized(cache) { cache[key] = translated }
                withContext(Dispatchers.Main) { onResult(translated) }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                withContext(Dispatchers.Main) { onError() }
            }
        }
    }

    fun cancel() {
        pendingJob?.cancel()
    }

    fun destroy() {
        scope.cancel()
    }
}
