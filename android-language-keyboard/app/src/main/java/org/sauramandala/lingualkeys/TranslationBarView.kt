package org.sauramandala.lingualkeys

import android.content.Context
import android.util.AttributeSet
import android.view.LayoutInflater
import android.view.View
import android.widget.LinearLayout
import org.sauramandala.lingualkeys.databinding.TranslationBarBinding

class TranslationBarView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : LinearLayout(context, attrs) {

    private val binding = TranslationBarBinding.inflate(LayoutInflater.from(context), this, true)

    var onSpeakClick: ((String) -> Unit)? = null
    var onTranslationLongClick: ((String) -> Unit)? = null

    private var currentTranslation = ""

    init {
        orientation = HORIZONTAL
        setBackgroundColor(0xFFFFFFFF.toInt())

        binding.btnSpeak.setOnClickListener {
            if (currentTranslation.isNotEmpty()) onSpeakClick?.invoke(currentTranslation)
        }
        binding.tvTranslation.setOnLongClickListener {
            if (currentTranslation.isNotEmpty()) {
                onTranslationLongClick?.invoke(currentTranslation)
                true
            } else false
        }
    }

    fun showLoading() {
        binding.progressBar.visibility = View.VISIBLE
        binding.tvTranslation.visibility = View.INVISIBLE
        binding.btnSpeak.isEnabled = false
    }

    fun showTranslation(translated: String, targetLang: Language) {
        currentTranslation = translated
        binding.progressBar.visibility = View.GONE
        binding.tvTranslation.visibility = View.VISIBLE
        binding.tvTranslation.text = translated
        binding.tvTargetLang.text = targetLang.nativeName
        binding.btnSpeak.isEnabled = true
    }

    fun showEmpty() {
        currentTranslation = ""
        binding.progressBar.visibility = View.GONE
        binding.tvTranslation.visibility = View.VISIBLE
        binding.tvTranslation.text = ""
        binding.btnSpeak.isEnabled = false
    }

    fun showError() {
        currentTranslation = ""
        binding.progressBar.visibility = View.GONE
        binding.tvTranslation.visibility = View.VISIBLE
        binding.tvTranslation.text = context.getString(R.string.translation_error)
        binding.btnSpeak.isEnabled = false
    }
}
