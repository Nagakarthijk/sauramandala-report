package org.sauramandala.lingualkeys

data class Language(
    val code: String,
    val name: String,
    val nativeName: String,
    val ttsLocale: String
)

object LanguageData {
    val supported = listOf(
        Language("en", "English", "English", "en-US"),
        Language("hi", "Hindi", "हिन्दी", "hi-IN"),
        Language("kn", "Kannada", "ಕನ್ನಡ", "kn-IN"),
        Language("ta", "Tamil", "தமிழ்", "ta-IN"),
        Language("te", "Telugu", "తెలుగు", "te-IN"),
        Language("ml", "Malayalam", "മലയാളം", "ml-IN"),
        Language("mr", "Marathi", "मराठी", "mr-IN"),
        Language("bn", "Bengali", "বাংলা", "bn-IN"),
        Language("gu", "Gujarati", "ગુજરાતી", "gu-IN"),
        Language("pa", "Punjabi", "ਪੰਜਾਬੀ", "pa-IN"),
        Language("es", "Spanish", "Español", "es-ES"),
        Language("fr", "French", "Français", "fr-FR"),
        Language("de", "German", "Deutsch", "de-DE"),
        Language("it", "Italian", "Italiano", "it-IT"),
        Language("pt", "Portuguese", "Português", "pt-BR"),
        Language("ru", "Russian", "Русский", "ru-RU"),
        Language("ja", "Japanese", "日本語", "ja-JP"),
        Language("ko", "Korean", "한국어", "ko-KR"),
        Language("zh", "Chinese", "中文", "zh-CN"),
        Language("ar", "Arabic", "العربية", "ar-SA")
    )

    fun byCode(code: String): Language? = supported.find { it.code == code }
}
