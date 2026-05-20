package org.sauramandala.lingualkeys

data class TranslationResult(
    val nativeScript: String,  // ಹೇಗಿದ್ದೀರಿ?
    val romanized: String?     // Hēgiddīri? — null for Latin-script targets like Spanish/French
) {
    // What the learner reads: romanized pronunciation if available, else the translation itself
    val primaryText: String get() = romanized ?: nativeScript

    // Shown smaller below primary — the "real" script to aspirationally learn
    val secondaryText: String? get() = if (romanized != null) nativeScript else null
}
