package org.sauramandala.lingualkeys

import android.content.Context
import android.content.SharedPreferences
import androidx.core.content.edit

class LanguagePreferences(context: Context) {
    private val prefs: SharedPreferences =
        context.getSharedPreferences("lingualkeys_prefs", Context.MODE_PRIVATE)

    var sourceLanguage: String
        get() = prefs.getString(KEY_SOURCE, "en") ?: "en"
        set(v) = prefs.edit { putString(KEY_SOURCE, v) }

    var targetLanguage: String
        get() = prefs.getString(KEY_TARGET, "kn") ?: "kn"
        set(v) = prefs.edit { putString(KEY_TARGET, v) }

    var translationEnabled: Boolean
        get() = prefs.getBoolean(KEY_TRANSLATION, true)
        set(v) = prefs.edit { putBoolean(KEY_TRANSLATION, v) }

    var ttsEnabled: Boolean
        get() = prefs.getBoolean(KEY_TTS, true)
        set(v) = prefs.edit { putBoolean(KEY_TTS, v) }

    companion object {
        private const val KEY_SOURCE = "source_language"
        private const val KEY_TARGET = "target_language"
        private const val KEY_TRANSLATION = "translation_enabled"
        private const val KEY_TTS = "tts_enabled"
    }
}
