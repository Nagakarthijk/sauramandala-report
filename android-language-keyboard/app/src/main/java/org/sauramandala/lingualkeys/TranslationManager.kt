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
            delay(500)

            val key = "$src|$tgt|${text.trim()}"
            val hit = synchronized(cache) { cache[key] }
            if (hit != null) {
                withContext(Dispatchers.Main) { onResult(hit) }
                return@launch
            }

            withContext(Dispatchers.Main) { onLoading() }

            try {
                val romanize = needsRomanization(src, tgt)
                val encoded = URLEncoder.encode(text.trim(), "UTF-8")
                // dt=rm requests romanization of the translated text — only added when source is
                // Latin-script so the user can read the result in their own familiar script.
                val dt = if (romanize) "dt=t&dt=rm" else "dt=t"
                val url = "https://translate.googleapis.com/translate_a/single" +
                    "?client=gtx&sl=$src&tl=$tgt&$dt&q=$encoded"

                val body = client.newCall(
                    Request.Builder().url(url).header("User-Agent", "Mozilla/5.0").build()
                ).execute().use { it.body?.string() } ?: throw IllegalStateException("Empty body")

                val display = parseDisplay(body, romanize)
                if (display.isBlank()) throw IllegalStateException("Empty translation")

                synchronized(cache) { cache[key] = display }
                withContext(Dispatchers.Main) { onResult(display) }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                withContext(Dispatchers.Main) { onError() }
            }
        }
    }

    /**
     * Decide whether to show the romanized (Latin) form of the translation.
     * Rule: if the user types in a Latin-script language but the target is
     * non-Latin, romanize so they can read and pronounce the result.
     * Examples: en→kn → romanize ("Hēgiddīri?"), hi→en → no romanize ("How are you?")
     */
    private fun needsRomanization(src: String, tgt: String) =
        src in LATIN_LANGS && tgt !in LATIN_LANGS

    /**
     * Parse the Google Translate gtx response.
     * Segments: [[[translatedText, sourceText, romanization?], ...], null, detectedLang]
     * translation at [0][i][0], romanization (when dt=rm) at [0][i][2]
     */
    private fun parseDisplay(body: String, romanize: Boolean): String {
        val segs = JSONArray(body).getJSONArray(0)
        val translation = StringBuilder()
        val romanized = StringBuilder()

        for (i in 0 until segs.length()) {
            val seg = segs.optJSONArray(i) ?: continue
            seg.optString(0).takeIf { it.isNotBlank() }?.let { translation.append(it) }
            if (romanize) seg.optString(2).takeIf { it.isNotBlank() }?.let { romanized.append(it) }
        }

        val tStr = translation.toString().trim()
        val rStr = romanized.toString().trim()
        // Prefer romanized when available and different from the native script
        return if (romanize && rStr.isNotEmpty() && rStr != tStr) rStr else tStr
    }

    fun cancel() { pendingJob?.cancel() }

    fun destroy() { scope.cancel() }

    companion object {
        // Languages whose users read Latin script — they need romanization when target is non-Latin
        private val LATIN_LANGS = setOf(
            "en", "es", "fr", "de", "it", "pt", "nl", "pl", "cs", "sk",
            "ro", "hu", "tr", "id", "ms", "vi", "fi", "sv", "da", "no",
            "hr", "sl", "lt", "lv", "et", "af", "sq", "sw", "cy"
        )
    }
}
