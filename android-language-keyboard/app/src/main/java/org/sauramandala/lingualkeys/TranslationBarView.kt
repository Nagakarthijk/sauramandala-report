package org.sauramandala.lingualkeys

import android.animation.ObjectAnimator
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.res.ColorStateList
import android.util.AttributeSet
import android.view.LayoutInflater
import android.view.View
import android.widget.LinearLayout
import android.widget.Toast
import org.sauramandala.lingualkeys.databinding.TranslationBarBinding

class TranslationBarView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : LinearLayout(context, attrs) {

    private val binding = TranslationBarBinding.inflate(LayoutInflater.from(context), this, true)

    var onSpeakClick: ((nativeScriptText: String) -> Unit)? = null

    private var currentResult: TranslationResult? = null

    init {
        orientation = HORIZONTAL
        setBackgroundColor(0xFFFFFFFF.toInt())

        // Tap content area → copy romanized (primary) text with inline feedback
        binding.contentArea.setOnClickListener {
            currentResult?.let { copyWithFeedback(it.primaryText) }
        }

        // Long-press → copy native script (for when user wants to paste actual script)
        binding.contentArea.setOnLongClickListener {
            val result = currentResult ?: return@setOnLongClickListener false
            val native = result.secondaryText
            if (native != null) {
                copyToClipboard(native)
                Toast.makeText(context, R.string.native_copied, Toast.LENGTH_SHORT).show()
            } else {
                copyWithFeedback(result.primaryText)
            }
            true
        }

        // Tap speaker → hear the translation spoken aloud
        binding.btnSpeak.setOnClickListener {
            currentResult?.nativeScript?.takeIf { it.isNotEmpty() }?.let { text ->
                onSpeakClick?.invoke(text)
                pulseSpeakButton()
            }
        }
    }

    fun showLoading() {
        binding.progressBar.visibility = View.VISIBLE
        binding.translationContent.visibility = View.INVISIBLE
        setSpeakEnabled(false)
        currentResult = null
    }

    fun showTranslation(result: TranslationResult, targetLang: Language) {
        currentResult = result

        binding.tvLang.text = targetLang.code.uppercase()

        // Primary: romanized pronunciation ("Hēgiddīri?") or plain translation for Latin scripts
        binding.tvPrimary.text = result.primaryText

        // Secondary: native script below ("ಹೇಗಿದ್ದೀರಿ?") — only shown when romanization exists
        if (result.secondaryText != null) {
            binding.tvSecondary.text = result.secondaryText
            binding.tvSecondary.visibility = View.VISIBLE
        } else {
            binding.tvSecondary.visibility = View.GONE
        }

        binding.progressBar.visibility = View.GONE
        binding.translationContent.visibility = View.VISIBLE
        setSpeakEnabled(true)

        fadeIn(binding.translationContent)
    }

    fun showEmpty() {
        currentResult = null
        binding.progressBar.visibility = View.GONE
        binding.translationContent.visibility = View.VISIBLE
        binding.tvPrimary.text = ""
        binding.tvSecondary.visibility = View.GONE
        setSpeakEnabled(false)
    }

    fun showError() {
        currentResult = null
        binding.progressBar.visibility = View.GONE
        binding.translationContent.visibility = View.VISIBLE
        binding.tvPrimary.text = context.getString(R.string.translation_error)
        binding.tvSecondary.visibility = View.GONE
        setSpeakEnabled(false)
    }

    private fun setSpeakEnabled(enabled: Boolean) {
        binding.btnSpeak.isEnabled = enabled
        val tint = if (enabled) 0xFF6200EE.toInt() else 0xFFC4B5FD.toInt()
        binding.btnSpeak.imageTintList = ColorStateList.valueOf(tint)
    }

    private fun copyWithFeedback(text: String) {
        copyToClipboard(text)
        val prev = binding.tvPrimary.text
        binding.tvPrimary.text = "✓  Copied"
        binding.tvPrimary.postDelayed({ binding.tvPrimary.text = prev }, 1100)
    }

    private fun copyToClipboard(text: String) {
        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        clipboard.setPrimaryClip(ClipData.newPlainText("lingualkeys", text))
    }

    private fun fadeIn(view: View) {
        view.alpha = 0f
        ObjectAnimator.ofFloat(view, "alpha", 0f, 1f).apply {
            duration = 180
            start()
        }
    }

    private fun pulseSpeakButton() {
        binding.btnSpeak.animate()
            .scaleX(0.82f).scaleY(0.82f).setDuration(70)
            .withEndAction {
                binding.btnSpeak.animate().scaleX(1f).scaleY(1f).setDuration(120).start()
            }.start()
    }
}
