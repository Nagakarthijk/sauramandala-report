package org.sauramandala.lingualkeys

import android.inputmethodservice.InputMethodService
import android.view.View
import android.view.inputmethod.EditorInfo
import android.widget.LinearLayout

class LanguageIMEService : InputMethodService() {

    private lateinit var translator: TranslationManager
    private lateinit var tts: TTSManager
    private lateinit var prefs: LanguagePreferences

    private lateinit var translationBar: TranslationBarView
    private lateinit var keyboardView: KeyboardView

    private val composedText = StringBuilder()

    override fun onCreate() {
        super.onCreate()
        translator = TranslationManager()
        tts = TTSManager(this)
        prefs = LanguagePreferences(this)
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
            onSpeakClick = { nativeText ->
                if (prefs.ttsEnabled) {
                    val lang = LanguageData.byCode(prefs.targetLanguage)
                    tts.speak(nativeText, lang?.ttsLocale ?: "en-US")
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

    private fun handleKeyEvent(event: KeyboardView.KeyEvent) {
        val ic = currentInputConnection ?: return
        when (event) {
            is KeyboardView.KeyEvent.Char -> {
                ic.commitText(event.c.toString(), 1)
                composedText.append(event.c)
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
            is KeyboardView.KeyEvent.ShiftToggle,
            is KeyboardView.KeyEvent.SwitchToNumbers -> Unit
        }
    }

    // Translate the current phrase (text after last sentence boundary)
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
            onResult = { result -> translationBar.showTranslation(result, targetLang) },
            onError = { translationBar.showError() }
        )
    }

    private fun currentPhrase(): String {
        val text = composedText.toString()
        val lastBreak = text.lastIndexOfAny(charArrayOf('.', '!', '?', '\n'))
        return if (lastBreak >= 0) text.substring(lastBreak + 1).trim() else text.trim()
    }

    override fun onFinishInput() {
        super.onFinishInput()
        translator.cancel()
        composedText.clear()
    }

    override fun onDestroy() {
        super.onDestroy()
        translator.destroy()
        tts.destroy()
    }
}
