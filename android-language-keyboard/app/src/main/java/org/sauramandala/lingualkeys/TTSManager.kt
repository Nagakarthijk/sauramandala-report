package org.sauramandala.lingualkeys

import android.content.Context
import android.speech.tts.TextToSpeech
import java.util.Locale

class TTSManager(context: Context) : TextToSpeech.OnInitListener {

    private val tts = TextToSpeech(context, this)
    private var ready = false
    private var pending: Pair<String, String>? = null

    override fun onInit(status: Int) {
        ready = status == TextToSpeech.SUCCESS
        pending?.let { (text, locale) ->
            speak(text, locale)
            pending = null
        }
    }

    fun speak(text: String, localeCode: String) {
        if (!ready) {
            pending = text to localeCode
            return
        }
        val locale = localeCode.split("-").let { parts ->
            if (parts.size >= 2) Locale(parts[0], parts[1]) else Locale(parts[0])
        }
        val result = tts.setLanguage(locale)
        if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
            tts.setLanguage(Locale.ENGLISH)
        }
        tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "lk_tts")
    }

    fun stop() = tts.stop()

    fun destroy() {
        tts.stop()
        tts.shutdown()
    }
}
