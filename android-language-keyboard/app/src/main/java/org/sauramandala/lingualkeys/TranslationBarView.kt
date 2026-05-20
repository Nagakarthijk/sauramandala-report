package org.sauramandala.lingualkeys

import android.animation.ObjectAnimator
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.res.ColorStateList
import android.content.res.Configuration
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

    var onSpeakClick: ((String) -> Unit)? = null

    private var currentTranslation = ""

    private val isDark: Boolean
        get() = (context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
            Configuration.UI_MODE_NIGHT_YES

    init {
        orientation = HORIZONTAL
        applyTheme()

        binding.contentArea.setOnClickListener {
            currentTranslation.takeIf { it.isNotEmpty() }?.let { text ->
                copyToClipboard(text)
                flashCopied(text)
            }
        }

        binding.contentArea.setOnLongClickListener {
            currentTranslation.takeIf { it.isNotEmpty() }?.let { text ->
                copyToClipboard(text)
                Toast.makeText(context, R.string.copied, Toast.LENGTH_SHORT).show()
                true
            } ?: false
        }

        binding.btnSpeak.setOnClickListener {
            currentTranslation.takeIf { it.isNotEmpty() }?.let { text ->
                onSpeakClick?.invoke(text)
                pulseSpeakButton()
            }
        }
    }

    fun applyTheme() {
        val dark = isDark
        setBackgroundColor(if (dark) 0xFF1A1A2E.toInt() else 0xFFFFFFFF.toInt())

        binding.tvLang.setBackgroundColor(if (dark) 0xFF2D1B69.toInt() else 0xFFEDE7F6.toInt())
        binding.tvLang.setTextColor(if (dark) 0xFFD4BBFF.toInt() else 0xFF6200EE.toInt())

        binding.dividerLeft.setBackgroundColor(if (dark) 0xFF2A2A3E.toInt() else 0xFFE5E7EB.toInt())
        binding.dividerRight.setBackgroundColor(if (dark) 0xFF2A2A3E.toInt() else 0xFFE5E7EB.toInt())

        binding.tvTranslation.setTextColor(if (dark) 0xFFF1F5F9.toInt() else 0xFF111827.toInt())
        binding.tvTranslation.setHintTextColor(if (dark) 0xFF4B5563.toInt() else 0xFF9CA3AF.toInt())

        refreshSpeakTint()
    }

    fun showLoading() {
        currentTranslation = ""
        binding.progressBar.visibility = View.VISIBLE
        binding.tvTranslation.visibility = View.INVISIBLE
        refreshSpeakTint()
    }

    fun showTranslation(translation: String, targetLang: Language) {
        currentTranslation = translation
        binding.tvLang.text = targetLang.code.uppercase()
        binding.tvTranslation.text = translation
        binding.progressBar.visibility = View.GONE
        binding.tvTranslation.visibility = View.VISIBLE
        refreshSpeakTint()
        fadeIn(binding.tvTranslation)
    }

    fun showListening() {
        currentTranslation = ""
        binding.tvTranslation.text = context.getString(R.string.listening)
        binding.progressBar.visibility = View.VISIBLE
        binding.tvTranslation.visibility = View.VISIBLE
        refreshSpeakTint()
    }

    fun showPartial(text: String) {
        binding.tvTranslation.text = "🎤 $text"
        binding.progressBar.visibility = View.GONE
        binding.tvTranslation.visibility = View.VISIBLE
    }

    fun showEmpty() {
        currentTranslation = ""
        binding.progressBar.visibility = View.GONE
        binding.tvTranslation.visibility = View.VISIBLE
        binding.tvTranslation.text = ""
        refreshSpeakTint()
    }

    fun showError() {
        currentTranslation = ""
        binding.progressBar.visibility = View.GONE
        binding.tvTranslation.visibility = View.VISIBLE
        binding.tvTranslation.text = context.getString(R.string.translation_error)
        refreshSpeakTint()
    }

    private fun refreshSpeakTint() {
        val hasContent = currentTranslation.isNotEmpty()
        binding.btnSpeak.isEnabled = hasContent
        val color = if (hasContent) {
            if (isDark) 0xFFBB86FC.toInt() else 0xFF6200EE.toInt()
        } else {
            if (isDark) 0xFF3D3D5C.toInt() else 0xFFD1D5DB.toInt()
        }
        binding.btnSpeak.imageTintList = ColorStateList.valueOf(color)
    }

    private fun flashCopied(original: String) {
        binding.tvTranslation.text = "✓  Copied"
        binding.tvTranslation.postDelayed({ binding.tvTranslation.text = original }, 1000)
    }

    private fun copyToClipboard(text: String) {
        val cm = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        cm.setPrimaryClip(ClipData.newPlainText("lingualkeys", text))
    }

    private fun fadeIn(view: View) {
        view.alpha = 0f
        ObjectAnimator.ofFloat(view, "alpha", 0f, 1f).setDuration(160).start()
    }

    private fun pulseSpeakButton() {
        binding.btnSpeak.animate()
            .scaleX(0.78f).scaleY(0.78f).setDuration(60)
            .withEndAction {
                binding.btnSpeak.animate().scaleX(1f).scaleY(1f).setDuration(100).start()
            }.start()
    }
}
