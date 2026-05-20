package org.sauramandala.lingualkeys

import android.icu.text.Transliterator
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

    // ICU4J Transliterator instances are thread-safe but expensive to create — cache them.
    private val transliteratorCache = mutableMapOf<String, Transliterator?>()

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
                val encoded = URLEncoder.encode(text.trim(), "UTF-8")
                // Always request dt=rm (romanization of the translated text).
                // We use it either directly (Latin source) or as an intermediate for
                // ICU re-transliteration into the source language's own script.
                val url = "https://translate.googleapis.com/translate_a/single" +
                    "?client=gtx&sl=$src&tl=$tgt&dt=t&dt=rm&q=$encoded"

                val body = client.newCall(
                    Request.Builder().url(url).header("User-Agent", "Mozilla/5.0").build()
                ).execute().use { it.body?.string() } ?: throw IllegalStateException("Empty body")

                val display = buildDisplayText(body, src, tgt)
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
     * Rule: always show the translation in the SOURCE language's script so the
     * learner can actually read it.
     *
     * Pipeline:
     *   1. API gives: translation (target script) + romanization (Latin)
     *   2. Latin source (en/es/fr/…) → return romanization directly
     *   3. Non-Latin source (kn/hi/ta/…) → use ICU4J to re-transliterate the
     *      Latin romanization into the source language's script
     *   4. Fallback → return translation in target's own script
     *
     * Example:  kn → hi
     *   translation = "आप कैसे हैं?"  (Devanagari — user can't read this)
     *   romanized   = "Āp kaise hain?"  (Latin intermediate)
     *   ICU Latin→Kannada = "ಆಪ್ ಕೈಸೆ ಹೈಂ?"  ← what we show
     */
    private fun buildDisplayText(body: String, src: String, tgt: String): String {
        val segs = JSONArray(body).getJSONArray(0)
        val translation = StringBuilder()
        val romanized = StringBuilder()

        for (i in 0 until segs.length()) {
            val seg = segs.optJSONArray(i) ?: continue
            seg.optString(0).takeIf { it.isNotBlank() }?.let { translation.append(it) }
            seg.optString(2).takeIf { it.isNotBlank() }?.let { romanized.append(it) }
        }

        val tStr = translation.toString().trim()
        val rStr = romanized.toString().trim()

        return when {
            // Same script family or same language → plain translation is fine
            src == tgt -> tStr

            // Latin-script source → romanized is already readable
            src in LATIN_LANGS -> if (rStr.isNotEmpty() && rStr != tStr) rStr else tStr

            // Non-Latin source with a romanized intermediate available →
            // re-transliterate Latin → source script via ICU4J
            rStr.isNotEmpty() -> {
                val result = transliterateToSourceScript(rStr, src)
                result ?: tStr   // if ICU has no mapping, fall back to target script
            }

            // No romanization from API → show translation in target's own script
            else -> tStr
        }
    }

    /**
     * Use Android's built-in ICU4J (android.icu.text.Transliterator, API 24+) to
     * convert a Latin/romanized string into the script of [langCode].
     * Returns null if no transliterator is available for that script.
     */
    private fun transliterateToSourceScript(latin: String, langCode: String): String? {
        val icuId = ICU_TRANSLITERATOR_IDS[langCode] ?: return null
        val t = synchronized(transliteratorCache) {
            transliteratorCache.getOrPut(icuId) {
                try { Transliterator.getInstance(icuId) } catch (e: Exception) { null }
            }
        } ?: return null
        return try { t.transliterate(latin) } catch (e: Exception) { null }
    }

    fun cancel() { pendingJob?.cancel() }

    fun destroy() { scope.cancel() }

    companion object {
        // Languages whose readers use Latin script — romanization is the display form.
        private val LATIN_LANGS = setOf(
            "en", "es", "fr", "de", "it", "pt", "nl", "pl", "cs", "sk",
            "ro", "hu", "tr", "id", "ms", "vi", "fi", "sv", "da", "no",
            "hr", "sl", "lt", "lv", "et", "af", "sq", "sw", "cy"
        )

        // ICU4J transliterator IDs: Latin → <target script>
        // These are built into Android (android.icu) since API 24 — no extra library needed.
        private val ICU_TRANSLITERATOR_IDS = mapOf(
            "hi" to "Latin-Devanagari",   // Hindi
            "mr" to "Latin-Devanagari",   // Marathi
            "ne" to "Latin-Devanagari",   // Nepali
            "kn" to "Latin-Kannada",      // Kannada
            "ta" to "Latin-Tamil",        // Tamil
            "te" to "Latin-Telugu",       // Telugu
            "ml" to "Latin-Malayalam",    // Malayalam
            "bn" to "Latin-Bengali",      // Bengali
            "gu" to "Latin-Gujarati",     // Gujarati
            "pa" to "Latin-Gurmukhi",     // Punjabi
            "si" to "Latin-Sinhala",      // Sinhala
            "ar" to "Latin-Arabic",       // Arabic
            "ru" to "Latin-Cyrillic",     // Russian
            "uk" to "Latin-Cyrillic",     // Ukrainian
            "bg" to "Latin-Cyrillic",     // Bulgarian
            "sr" to "Latin-Cyrillic",     // Serbian
            "ja" to "Latin-Hiragana",     // Japanese (phonetic)
            "th" to "Latin-Thai"          // Thai
        )
    }
}
