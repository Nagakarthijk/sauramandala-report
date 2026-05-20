package org.sauramandala.lingualkeys

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import java.util.Locale

class VoiceInputManager(
    private val context: Context,
    private val onPartial: (String) -> Unit,
    private val onResult: (String) -> Unit,
    private val onListening: () -> Unit,
    private val onStopped: () -> Unit,
    private val onError: () -> Unit
) {
    private var recognizer: SpeechRecognizer? = null

    var isListening = false
        private set

    fun toggle(languageCode: String) {
        if (isListening) stop() else start(languageCode)
    }

    fun start(languageCode: String) {
        if (!SpeechRecognizer.isRecognitionAvailable(context)) {
            onError()
            return
        }
        recognizer?.destroy()
        recognizer = SpeechRecognizer.createSpeechRecognizer(context).apply {
            setRecognitionListener(makeListener())
        }
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale(languageCode).toLanguageTag())
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 1500L)
        }
        recognizer?.startListening(intent)
        isListening = true
        onListening()
    }

    fun stop() {
        recognizer?.stopListening()
        isListening = false
        onStopped()
    }

    private fun makeListener() = object : RecognitionListener {
        override fun onReadyForSpeech(p: Bundle?) {}
        override fun onBeginningOfSpeech() {}
        override fun onRmsChanged(rms: Float) {}
        override fun onBufferReceived(b: ByteArray?) {}
        override fun onEvent(type: Int, p: Bundle?) {}

        override fun onEndOfSpeech() {
            isListening = false
            onStopped()
        }

        override fun onPartialResults(bundle: Bundle?) {
            val text = bundle?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()
            if (!text.isNullOrBlank()) onPartial(text)
        }

        override fun onResults(bundle: Bundle?) {
            val text = bundle?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()
            isListening = false
            onStopped()
            if (!text.isNullOrBlank()) onResult(text) else onError()
        }

        override fun onError(code: Int) {
            isListening = false
            onStopped()
            // ERROR_NO_MATCH and ERROR_SPEECH_TIMEOUT are benign (user just didn't speak)
            if (code != SpeechRecognizer.ERROR_NO_MATCH &&
                code != SpeechRecognizer.ERROR_SPEECH_TIMEOUT) onError()
        }
    }

    fun destroy() {
        recognizer?.destroy()
        recognizer = null
    }
}
