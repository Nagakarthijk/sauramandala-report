package org.sauramandala.lingualkeys

import kotlinx.coroutines.*
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import java.net.URLEncoder
import java.util.concurrent.TimeUnit

class TranslationManager {

    private val client = OkHttpClient.Builder()
        .connectTimeout(8, TimeUnit.SECONDS)
        .readTimeout(8, TimeUnit.SECONDS)
        .build()

    // LRU cache: key = "src|tgt|text"
    private val cache = object : LinkedHashMap<String, TranslationResult>(64, 0.75f, true) {
        override fun removeEldestEntry(eldest: Map.Entry<String, TranslationResult>) = size > 64
    }

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var pendingJob: Job? = null

    fun translateDebounced(
        text: String,
        src: String,
        tgt: String,
        onLoading: () -> Unit,
        onResult: (TranslationResult) -> Unit,
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
                // dt=t → translation, dt=rm → romanization of the translated text
                val url = "https://translate.googleapis.com/translate_a/single" +
                    "?client=gtx&sl=$src&tl=$tgt&dt=t&dt=rm&q=$encoded"
                val req = Request.Builder()
                    .url(url)
                    .header("User-Agent", "Mozilla/5.0")
                    .build()
                val body = client.newCall(req).execute().use { it.body?.string() }
                    ?: throw IllegalStateException("Empty body")

                val result = parseResponse(body)
                if (result.nativeScript.isBlank()) throw IllegalStateException("Empty translation")

                synchronized(cache) { cache[key] = result }
                withContext(Dispatchers.Main) { onResult(result) }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                withContext(Dispatchers.Main) { onError() }
            }
        }
    }

    // Response: [[[nativeText, sourceText, romanization?], ...], null, detectedLang]
    // Index [0][i][0] = translated segment i
    // Index [0][i][2] = romanization of segment i (present when dt=rm, language supports it)
    private fun parseResponse(body: String): TranslationResult {
        val arr = JSONArray(body)
        val segs = arr.getJSONArray(0)
        val translation = StringBuilder()
        val romanized = StringBuilder()

        for (i in 0 until segs.length()) {
            val seg = segs.optJSONArray(i) ?: continue
            seg.optString(0).takeIf { it.isNotBlank() }?.let { translation.append(it) }
            seg.optString(2).takeIf { it.isNotBlank() }?.let { romanized.append(it) }
        }

        val tStr = translation.toString().trim()
        // Only keep romanization if it differs from the translation (Latin-script languages won't have it)
        val rStr = romanized.toString().trim().takeIf { it.isNotEmpty() && it != tStr }
        return TranslationResult(tStr, rStr)
    }

    fun cancel() {
        pendingJob?.cancel()
    }

    fun destroy() {
        scope.cancel()
    }
}
