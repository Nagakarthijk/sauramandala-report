package org.sauramandala.lingualkeys

import android.animation.ValueAnimator
import android.content.Context
import android.content.res.Configuration
import android.graphics.*
import android.graphics.drawable.Drawable
import android.util.AttributeSet
import android.view.HapticFeedbackConstants
import android.view.MotionEvent
import android.view.View
import androidx.appcompat.content.res.AppCompatResources

class KeyboardView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : View(context, attrs) {

    // ── Key events ────────────────────────────────────────────────────────────
    sealed class KeyEvent {
        data class Char(val c: kotlin.Char) : KeyEvent()
        data class SwipeWord(val word: String) : KeyEvent()
        object Backspace : KeyEvent()
        object Space : KeyEvent()
        object Enter : KeyEvent()
        object ShiftToggle : KeyEvent()
        object SwitchToNumbers : KeyEvent()
        object MicTap : KeyEvent()
    }

    var onKey: ((KeyEvent) -> Unit)? = null

    // ── State ─────────────────────────────────────────────────────────────────
    private var shifted = false
    private var showNumbers = false
    private var micListening = false
    private var micPulseAlpha = 255

    // ── Dark mode ─────────────────────────────────────────────────────────────
    private val isDark: Boolean
        get() = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
            Configuration.UI_MODE_NIGHT_YES

    private val colBoard get() = if (isDark) Color.parseColor("#0D0D1A") else Color.parseColor("#E2E4E8")
    private val colKeyNormal get() = if (isDark) Color.parseColor("#1E2035") else Color.WHITE
    private val colKeySpecial get() = if (isDark) Color.parseColor("#0D0D1A") else Color.parseColor("#AEB3BB")
    private val colKeyShiftActive get() = if (isDark) Color.parseColor("#3D1A78") else Color.parseColor("#D8B4FE")
    private val colText get() = if (isDark) Color.parseColor("#E8ECF4") else Color.parseColor("#1F2937")
    private val colTextSpecial get() = if (isDark) Color.parseColor("#94A3B8") else Color.parseColor("#374151")
    private val colShadow get() = if (isDark) Color.parseColor("#08080F") else Color.parseColor("#B0B3BA")
    private val colSwipeTrail get() = if (isDark) 0xAABB86FC.toInt() else 0xAA6200EE.toInt()
    private val colSwipeDot get() = if (isDark) 0xFFBB86FC.toInt() else 0xFF6200EE.toInt()
    private val colMicActive = Color.parseColor("#EF4444")

    // ── Key data ──────────────────────────────────────────────────────────────
    private data class Key(val label: String, val rect: RectF, val isSpecial: Boolean)

    private val keys = mutableListOf<Key>()

    private val letterRows = listOf(
        listOf("q", "w", "e", "r", "t", "y", "u", "i", "o", "p"),
        listOf("a", "s", "d", "f", "g", "h", "j", "k", "l"),
        listOf("⇧", "z", "x", "c", "v", "b", "n", "m", "⌫"),
        listOf("?123", ",", "SPACE", "🎤", "↩")
    )

    private val numberRows = listOf(
        listOf("1", "2", "3", "4", "5", "6", "7", "8", "9", "0"),
        listOf("@", "#", "$", "%", "&", "-", "+", "(", ")", "/"),
        listOf("=", "*", "\"", "'", ":", ";", "!", "?", "⌫"),
        listOf("ABC", ",", "SPACE", "🎤", "↩")
    )

    // ── Paint objects ─────────────────────────────────────────────────────────
    private val keyPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val shadowPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { textAlign = Paint.Align.CENTER }
    private val swipeTrailPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
    }
    private val swipeDotPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }

    private val cornerRadius = dp(5f)
    private val keyGap = dp(4f)

    // ── Icon drawables ────────────────────────────────────────────────────────
    private val micDrawable: Drawable? by lazy {
        AppCompatResources.getDrawable(context, R.drawable.ic_mic)
    }

    // ── Swipe state ───────────────────────────────────────────────────────────
    private var touchStartX = 0f
    private var touchStartY = 0f
    private var isSwipe = false
    private val swipePath = mutableListOf<String>()    // letter sequence
    private val swipePts = mutableListOf<PointF>()     // screen points for trail

    private val SWIPE_THRESHOLD = dp(18f)
    private val MIN_SWIPE_KEYS = 2

    // ── Mic pulse animator ────────────────────────────────────────────────────
    private val micAnimator = ValueAnimator.ofInt(255, 80).apply {
        repeatMode = ValueAnimator.REVERSE
        repeatCount = ValueAnimator.INFINITE
        duration = 700
        addUpdateListener {
            micPulseAlpha = it.animatedValue as Int
            invalidateKeyLabel("🎤")
        }
    }

    // ── Layout ────────────────────────────────────────────────────────────────
    override fun onSizeChanged(w: Int, h: Int, oldW: Int, oldH: Int) {
        super.onSizeChanged(w, h, oldW, oldH)
        rebuildKeys(w.toFloat(), h.toFloat())
    }

    private fun rebuildKeys(w: Float, h: Float) {
        keys.clear()
        val activeRows = if (showNumbers) numberRows else letterRows
        val rowH = h / activeRows.size
        val hPad = dp(3f)

        activeRows.forEachIndexed { row, cols ->
            val top = row * rowH + keyGap / 2
            val bottom = top + rowH - keyGap
            val totalW = cols.sumOf { weight(it).toDouble() }.toFloat()
            val unitW = (w - hPad * 2 - keyGap * cols.size) / totalW
            var x = hPad + keyGap / 2

            cols.forEach { label ->
                val kw = unitW * weight(label)
                keys.add(Key(label, RectF(x, top, x + kw, bottom), isSpecialKey(label)))
                x += kw + keyGap
            }
        }
    }

    private fun weight(label: String) = when (label) {
        "SPACE" -> 3.8f
        "⇧", "⌫" -> 1.5f
        "?123", "ABC", "↩" -> 1.5f
        "🎤" -> 0.9f
        "," -> 0.7f
        else -> 1f
    }

    private fun isSpecialKey(label: String) =
        label in setOf("⇧", "⌫", "?123", "ABC", "↩", "SPACE", "🎤")

    // ── Drawing ───────────────────────────────────────────────────────────────
    override fun onDraw(canvas: Canvas) {
        canvas.drawColor(colBoard)

        keys.forEach { key -> drawKey(canvas, key) }

        // Swipe trail
        if (isSwipe && swipePts.size >= 2) {
            drawSwipeTrail(canvas)
        }
    }

    private fun drawKey(canvas: Canvas, key: Key) {
        val isShiftActive = key.label == "⇧" && shifted

        // Shadow
        shadowPaint.color = colShadow
        canvas.drawRoundRect(
            RectF(key.rect.left, key.rect.top + dp(1.5f), key.rect.right, key.rect.bottom + dp(1.5f)),
            cornerRadius, cornerRadius, shadowPaint
        )

        // Face
        keyPaint.color = when {
            isShiftActive -> colKeyShiftActive
            key.isSpecial -> colKeySpecial
            else -> colKeyNormal
        }
        canvas.drawRoundRect(key.rect, cornerRadius, cornerRadius, keyPaint)

        // Label text
        when (key.label) {
            "🎤" -> drawMicIcon(canvas, key.rect)
            else -> drawKeyLabel(canvas, key, isShiftActive)
        }
    }

    private fun drawKeyLabel(canvas: Canvas, key: Key, shiftActive: Boolean) {
        val label = when {
            key.label == "SPACE" -> "space"
            shifted && key.label.length == 1 && key.label[0].isLetter() -> key.label.uppercase()
            else -> key.label
        }

        textPaint.textSize = when (key.label) {
            "⇧", "⌫" -> sp(16f)
            "?123", "ABC" -> sp(12f)
            "↩" -> sp(18f)
            "SPACE" -> sp(11f)
            else -> sp(16f)
        }
        textPaint.color = when {
            shiftActive -> if (isDark) 0xFFDDD6FE.toInt() else 0xFF5B21B6.toInt()
            key.isSpecial -> colTextSpecial
            else -> colText
        }

        val cx = key.rect.centerX()
        val cy = key.rect.centerY() - (textPaint.descent() + textPaint.ascent()) / 2
        canvas.drawText(label, cx, cy, textPaint)
    }

    private fun drawMicIcon(canvas: Canvas, rect: RectF) {
        val drawable = micDrawable ?: return
        val size = dp(18f).toInt()
        val l = (rect.centerX() - size / 2).toInt()
        val t = (rect.centerY() - size / 2).toInt()
        drawable.setBounds(l, t, l + size, t + size)

        if (micListening) {
            drawable.setTint(Color.argb(micPulseAlpha, 239, 68, 68))  // red pulse
        } else {
            drawable.setTint(if (isDark) 0xFF94A3B8.toInt() else 0xFF6B7280.toInt())
        }
        drawable.draw(canvas)
    }

    private fun drawSwipeTrail(canvas: Canvas) {
        // Gradient trail: brighter near the fingertip
        swipeTrailPaint.color = colSwipeTrail
        swipeTrailPaint.strokeWidth = dp(4f)

        val path = Path()
        path.moveTo(swipePts[0].x, swipePts[0].y)
        for (i in 1 until swipePts.size) {
            val prev = swipePts[i - 1]
            val curr = swipePts[i]
            // Cubic bezier for smooth curve
            path.quadTo(prev.x, prev.y, (prev.x + curr.x) / 2f, (prev.y + curr.y) / 2f)
        }
        path.lineTo(swipePts.last().x, swipePts.last().y)
        canvas.drawPath(path, swipeTrailPaint)

        // Fingertip dot
        swipeDotPaint.color = colSwipeDot
        canvas.drawCircle(swipePts.last().x, swipePts.last().y, dp(5f), swipeDotPaint)

        // Show swiped letters as a hint above the trail
        if (swipePath.size >= 2) {
            textPaint.textSize = sp(12f)
            textPaint.color = colSwipeDot
            val hint = swipePath.joinToString("").let {
                if (shifted) it.uppercase() else it.lowercase()
            }
            val lastPt = swipePts.last()
            canvas.drawText(hint, lastPt.x, lastPt.y - dp(18f), textPaint)
        }
    }

    // ── Touch ─────────────────────────────────────────────────────────────────
    override fun onTouchEvent(event: MotionEvent): Boolean {
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                touchStartX = event.x
                touchStartY = event.y
                isSwipe = false
                swipePath.clear()
                swipePts.clear()

                keyAt(event.x, event.y)?.let { key ->
                    if (key.label.isLetterKey()) {
                        swipePts.add(PointF(event.x, event.y))
                        swipePath.add(key.label.lowercase())
                    }
                }
            }

            MotionEvent.ACTION_MOVE -> {
                val dx = event.x - touchStartX
                val dy = event.y - touchStartY
                val dist = Math.sqrt((dx * dx + dy * dy).toDouble()).toFloat()

                if (dist > SWIPE_THRESHOLD) {
                    isSwipe = true
                    swipePts.add(PointF(event.x, event.y))

                    keyAt(event.x, event.y)?.let { key ->
                        if (key.label.isLetterKey()) {
                            val lc = key.label.lowercase()
                            if (swipePath.isEmpty() || swipePath.last() != lc) {
                                swipePath.add(lc)
                            }
                        }
                    }
                    invalidate()
                }
            }

            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                if (isSwipe && swipePath.size >= MIN_SWIPE_KEYS) {
                    performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP)
                    val raw = swipePath.joinToString("")
                    val word = SwipeDictionary.match(raw) ?: raw
                    onKey?.invoke(KeyEvent.SwipeWord(if (shifted) word.replaceFirstChar { it.uppercase() } else word))
                    if (shifted) { shifted = false }
                } else if (event.action == MotionEvent.ACTION_UP) {
                    // Regular tap — use the key at the UP location (better for fast typing)
                    val tapKey = keyAt(event.x, event.y) ?: keyAt(touchStartX, touchStartY)
                    tapKey?.let {
                        performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP)
                        handleKey(it.label)
                    }
                }

                isSwipe = false
                swipePath.clear()
                swipePts.clear()
                invalidate()
            }
        }
        return true
    }

    private fun handleKey(label: String) {
        when (label) {
            "⌫" -> onKey?.invoke(KeyEvent.Backspace)
            "SPACE" -> onKey?.invoke(KeyEvent.Space)
            "↩" -> onKey?.invoke(KeyEvent.Enter)
            "🎤" -> onKey?.invoke(KeyEvent.MicTap)
            "⇧" -> {
                shifted = !shifted
                invalidate()
                onKey?.invoke(KeyEvent.ShiftToggle)
            }
            "?123", "ABC" -> {
                showNumbers = !showNumbers
                shifted = false
                rebuildKeys(width.toFloat(), height.toFloat())
                invalidate()
                onKey?.invoke(KeyEvent.SwitchToNumbers)
            }
            else -> {
                val ch = if (shifted && label.length == 1 && label[0].isLetter())
                    label[0].uppercaseChar() else label[0]
                onKey?.invoke(KeyEvent.Char(ch))
                if (shifted) { shifted = false; invalidate() }
            }
        }
    }

    // ── Public API ────────────────────────────────────────────────────────────
    fun setMicListening(listening: Boolean) {
        micListening = listening
        if (listening) micAnimator.start()
        else { micAnimator.cancel(); micPulseAlpha = 255 }
        invalidate()
    }

    fun refreshTheme() {
        invalidate()
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    private fun keyAt(x: Float, y: Float): Key? = keys.firstOrNull { it.rect.contains(x, y) }

    private fun String.isLetterKey() = length == 1 && this[0].isLetter()

    private fun invalidateKeyLabel(label: String) {
        keys.firstOrNull { it.label == label }?.let { invalidate(it.rect.toIntRect()) }
    }

    private fun RectF.toIntRect() =
        android.graphics.Rect(left.toInt(), top.toInt(), right.toInt(), bottom.toInt())

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        val w = MeasureSpec.getSize(widthMeasureSpec)
        setMeasuredDimension(w, (w * 0.47f).toInt())
    }

    private fun dp(v: Float) = v * resources.displayMetrics.density
    private fun sp(v: Float) = v * resources.displayMetrics.scaledDensity
}
