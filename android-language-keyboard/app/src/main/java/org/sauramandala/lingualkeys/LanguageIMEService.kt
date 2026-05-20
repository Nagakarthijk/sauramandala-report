package org.sauramandala.lingualkeys

import android.content.pm.PackageManager
import android.content.res.Configuration
import android.inputmethodservice.InputMethodService
import android.view.View
import android.view.inputmethod.EditorInfo
import android.widget.LinearLayout
import android.widget.Toast
import androidx.core.content.ContextCompat

class LanguageIMEService : InputMethodService() {

    private lateinit var translator: TranslationManager
    private lateinit var tts: TTSManager
    private lateinit var prefs: LanguagePreferences
    private lateinit var voice: VoiceInputManager

    private lateinit var translationBar: TranslationBarView
    private lateinit var keyboardView: KeyboardView

    private val composedText = StringBuilder()

    override fun onCreate() {
        super.onCreate()
        translator = TranslationManager()
        tts = TTSManager(this)
        prefs = LanguagePreferences(this)
        initVoice()
    }

    private fun initVoice() {
        voice = VoiceInputManager(
            context = this,
            onPartial = { partial ->
                translationBar.showPartial(partial)
            },
            onResult = { text ->
                val ic = currentInputConnection ?: return@VoiceInputManager
                ic.commitText("$text ", 1)
                composedText.append(text).append(' ')
                keyboardView.setMicListening(false)
                scheduleTranslation()
            },
            onListening = {
                translationBar.showListening()
                keyboardView.setMicListening(true)
            },
            onStopped = {
                keyboardView.setMicListening(false)
                scheduleTranslation()
            },
            onError = {
                keyboardView.setMicListening(false)
                Toast.makeText(this, R.string.voice_error, Toast.LENGTH_SHORT).show()
            }
        )
    }

    override fun onCreateInputView(): View {
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
        }

        translationBar = TranslationBarView(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                resources.getDimensionPixelSize(R.dimen.translation_bar_height)
            )
            onSpeakClick = { text ->
                if (prefs.ttsEnabled) {
                    val lang = LanguageData.byCode(prefs.targetLanguage)
                    tts.speak(text, lang?.ttsLocale ?: "en-US")
                }
            }
        }

        keyboardView = KeyboardView(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
            onKey = ::handleKeyEvent
        }

        container.addView(translationBar)
        container.addView(keyboardView)
        return container
    }

    override fun onStartInputView(info: EditorInfo?, restarting: Boolean) {
        super.onStartInputView(info, restarting)
        composedText.clear()
        val existing = currentInputConnection?.getTextBeforeCursor(300, 0)?.toString() ?: ""
        composedText.append(existing)
        if (composedText.isNotEmpty()) scheduleTranslation() else translationBar.showEmpty()
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        // Refresh theme when night mode toggles
        if (::translationBar.isInitialized) translationBar.applyTheme()
        if (::keyboardView.isInitialized) keyboardView.refreshTheme()
    }

    private fun handleKeyEvent(event: KeyboardView.KeyEvent) {
        val ic = currentInputConnection ?: return
        when (event) {
            is KeyboardView.KeyEvent.Char -> {
                ic.commitText(event.c.toString(), 1)
                composedText.append(event.c)
                scheduleTranslation()
            }
            is KeyboardView.KeyEvent.SwipeWord -> {
                ic.commitText("${event.word} ", 1)
                composedText.append(event.word).append(' ')
                scheduleTranslation()
            }
            is KeyboardView.KeyEvent.Space -> {
                ic.commitText(" ", 1)
                composedText.append(' ')
                scheduleTranslation()
            }
            is KeyboardView.KeyEvent.Backspace -> {
                val selected = ic.getSelectedText(0)
                if (!selected.isNullOrEmpty()) {
                    ic.commitText("", 1)
                } else {
                    ic.deleteSurroundingText(1, 0)
                    if (composedText.isNotEmpty()) composedText.deleteCharAt(composedText.lastIndex)
                }
                scheduleTranslation()
            }
            is KeyboardView.KeyEvent.Enter -> {
                ic.commitText("\n", 1)
                composedText.clear()
                translationBar.showEmpty()
            }
            is KeyboardView.KeyEvent.MicTap -> handleMicTap()
            is KeyboardView.KeyEvent.ShiftToggle,
            is KeyboardView.KeyEvent.SwitchToNumbers -> Unit
        }
    }

    private fun handleMicTap() {
        if (!hasRecordPermission()) {
            Toast.makeText(this, R.string.mic_permission_needed, Toast.LENGTH_LONG).show()
            return
        }
        voice.toggle(prefs.sourceLanguage)
    }

    private fun scheduleTranslation() {
        if (!prefs.translationEnabled) return
        val phrase = currentPhrase()
        if (phrase.isEmpty()) {
            translationBar.showEmpty()
            translator.cancel()
            return
        }
        val targetLang = LanguageData.byCode(prefs.targetLanguage) ?: return
        translator.translateDebounced(
            text = phrase,
            src = prefs.sourceLanguage,
            tgt = prefs.targetLanguage,
            onLoading = { translationBar.showLoading() },
            onResult = { t -> translationBar.showTranslation(t, targetLang) },
            onError = { translationBar.showError() }
        )
    }

    private fun currentPhrase(): String {
        val text = composedText.toString()
        val last = text.lastIndexOfAny(charArrayOf('.', '!', '?', '\n'))
        return if (last >= 0) text.substring(last + 1).trim() else text.trim()
    }

    private fun hasRecordPermission() =
        ContextCompat.checkSelfPermission(this, android.Manifest.permission.RECORD_AUDIO) ==
            PackageManager.PERMISSION_GRANTED

    override fun onFinishInput() {
        super.onFinishInput()
        translator.cancel()
        if (voice.isListening) voice.stop()
        composedText.clear()
    }

    override fun onDestroy() {
        super.onDestroy()
        translator.destroy()
        tts.destroy()
        voice.destroy()
    }
}
