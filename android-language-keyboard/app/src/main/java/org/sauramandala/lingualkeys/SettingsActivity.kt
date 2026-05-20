package org.sauramandala.lingualkeys

import android.os.Bundle
import android.view.View
import android.widget.AdapterView
import android.widget.ArrayAdapter
import androidx.appcompat.app.AppCompatActivity
import org.sauramandala.lingualkeys.databinding.ActivitySettingsBinding

class SettingsActivity : AppCompatActivity() {

    private lateinit var binding: ActivitySettingsBinding
    private lateinit var prefs: LanguagePreferences

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivitySettingsBinding.inflate(layoutInflater)
        setContentView(binding.root)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        title = getString(R.string.settings)

        prefs = LanguagePreferences(this)
        setupSpinners()
        setupSwitches()
    }

    private fun setupSpinners() {
        val langs = LanguageData.supported
        val labels = langs.map { "${it.name}  ${it.nativeName}" }
        val adapter = ArrayAdapter(this, android.R.layout.simple_spinner_item, labels).apply {
            setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        }
        binding.spinnerSource.adapter = adapter
        binding.spinnerTarget.adapter = adapter

        binding.spinnerSource.setSelection(langs.indexOfFirst { it.code == prefs.sourceLanguage }.coerceAtLeast(0))
        binding.spinnerTarget.setSelection(langs.indexOfFirst { it.code == prefs.targetLanguage }.coerceAtLeast(0))

        binding.spinnerSource.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(p: AdapterView<*>, v: View?, pos: Int, id: Long) {
                prefs.sourceLanguage = langs[pos].code
            }
            override fun onNothingSelected(p: AdapterView<*>) {}
        }
        binding.spinnerTarget.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(p: AdapterView<*>, v: View?, pos: Int, id: Long) {
                prefs.targetLanguage = langs[pos].code
            }
            override fun onNothingSelected(p: AdapterView<*>) {}
        }
    }

    private fun setupSwitches() {
        binding.switchTranslation.isChecked = prefs.translationEnabled
        binding.switchTts.isChecked = prefs.ttsEnabled

        binding.switchTranslation.setOnCheckedChangeListener { _, v -> prefs.translationEnabled = v }
        binding.switchTts.setOnCheckedChangeListener { _, v -> prefs.ttsEnabled = v }
    }

    override fun onSupportNavigateUp(): Boolean {
        onBackPressedDispatcher.onBackPressed()
        return true
    }
}
