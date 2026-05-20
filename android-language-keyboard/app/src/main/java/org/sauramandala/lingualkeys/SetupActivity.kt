package org.sauramandala.lingualkeys

import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.view.inputmethod.InputMethodManager
import androidx.appcompat.app.AppCompatActivity
import org.sauramandala.lingualkeys.databinding.ActivitySetupBinding

class SetupActivity : AppCompatActivity() {

    private lateinit var binding: ActivitySetupBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivitySetupBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.btnSettings.setOnClickListener {
            startActivity(Intent(this, SettingsActivity::class.java))
        }
    }

    override fun onResume() {
        super.onResume()
        refreshStatus()
    }

    private fun refreshStatus() {
        val imm = getSystemService(INPUT_METHOD_SERVICE) as InputMethodManager
        val isEnabled = imm.enabledInputMethodList.any { it.packageName == packageName }

        if (isEnabled) {
            binding.tvStatus.setText(R.string.keyboard_enabled)
            binding.tvStatus.setTextColor(getColor(R.color.status_ok))
            binding.btnPrimary.setText(R.string.switch_keyboard)
            binding.btnPrimary.setOnClickListener { imm.showInputMethodPicker() }
        } else {
            binding.tvStatus.setText(R.string.keyboard_not_enabled)
            binding.tvStatus.setTextColor(getColor(R.color.status_warn))
            binding.btnPrimary.setText(R.string.enable_keyboard)
            binding.btnPrimary.setOnClickListener {
                startActivity(Intent(Settings.ACTION_INPUT_METHOD_SETTINGS))
            }
        }
    }
}
