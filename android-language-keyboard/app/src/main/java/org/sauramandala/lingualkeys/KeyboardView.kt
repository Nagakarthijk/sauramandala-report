package org.sauramandala.lingualkeys

import android.content.Context
import android.graphics.*
import android.util.AttributeSet
import android.view.HapticFeedbackConstants
import android.view.MotionEvent
import android.view.View

class KeyboardView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : View(context, attrs) {

    sealed class KeyEvent {
        data class Char(val c: kotlin.Char) : KeyEvent()
        object Backspace : KeyEvent()
        object Space : KeyEvent()
        object Enter : KeyEvent()
        object ShiftToggle : KeyEvent()
        object SwitchToNumbers : KeyEvent()
    }

    var onKey: ((KeyEvent) -> Unit)? = null

    private var shifted = false
    private var showNumbers = false

    private val rows = listOf(
        listOf("q", "w", "e", "r", "t", "y", "u", "i", "o", "p"),
        listOf("a", "s", "d", "f", "g", "h", "j", "k", "l"),
        listOf("⇧", "z", "x", "c", "v", "b", "n", "m", "⌫"),
        listOf("?123", ",", "SPACE", ".", "↩")
    )

    private val numberRows = listOf(
        listOf("1", "2", "3", "4", "5", "6", "7", "8", "9", "0"),
        listOf("@", "#", "$", "%", "&", "-", "+", "(", ")", "/"),
        listOf("=", "*", "\"", "'", ":", ";", "!", "?", "⌫"),
        listOf("ABC", ",", "SPACE", ".", "↩")
    )

    private data class Key(val label: String, val rect: RectF, val isSpecial: Boolean)

    private val keys = mutableListOf<Key>()
    private val keyPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val specialPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val textPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val shadowPaint = Paint(Paint.ANTI_ALIAS_FLAG)

    private val keyCorner = dp(5f)
    private val keyGap = dp(4f)

    init {
        keyPaint.color = Color.WHITE
        specialPaint.color = Color.parseColor("#D1D5DB")
        textPaint.apply {
            color = Color.parseColor("#1F2937")
            textAlign = Paint.Align.CENTER
            isFakeBoldText = false
        }
        shadowPaint.apply {
            color = Color.parseColor("#E5E7EB")
            style = Paint.Style.FILL
        }
        isHapticFeedbackEnabled = true
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        buildKeys(w.toFloat(), h.toFloat())
    }

    private fun buildKeys(w: Float, h: Float) {
        keys.clear()
        val activeRows = if (showNumbers) numberRows else rows
        val rowH = h / activeRows.size
        val horizontalPad = dp(4f)

        activeRows.forEachIndexed { rowIdx, row ->
            val top = rowIdx * rowH + keyGap / 2
            val bottom = top + rowH - keyGap

            val totalSpecialWeight = row.sumOf { keyWeight(it).toDouble() }.toFloat()
            val keyW = (w - horizontalPad * 2 - keyGap * row.size) / totalSpecialWeight
            var x = horizontalPad + keyGap / 2

            row.forEach { label ->
                val thisW = keyW * keyWeight(label)
                val rect = RectF(x, top, x + thisW, bottom)
                keys.add(Key(label, rect, isSpecial(label)))
                x += thisW + keyGap
            }
        }
    }

    private fun keyWeight(label: String) = when (label) {
        "SPACE" -> 4f
        "⇧", "⌫" -> 1.5f
        "?123", "ABC", "↩" -> 1.5f
        else -> 1f
    }

    private fun isSpecial(label: String) =
        label in setOf("⇧", "⌫", "?123", "ABC", "↩", "SPACE")

    override fun onDraw(canvas: Canvas) {
        canvas.drawColor(Color.parseColor("#F3F4F6"))

        keys.forEach { key ->
            val paint = if (key.isSpecial || (key.label == "⇧" && shifted)) specialPaint else keyPaint

            // Shadow
            canvas.drawRoundRect(
                RectF(key.rect.left, key.rect.top + dp(1.5f), key.rect.right, key.rect.bottom + dp(1.5f)),
                keyCorner, keyCorner, shadowPaint
            )
            // Key face
            canvas.drawRoundRect(key.rect, keyCorner, keyCorner, paint)

            val cx = key.rect.centerX()
            val cy = key.rect.centerY()
            val displayLabel = displayText(key.label)

            textPaint.textSize = when (key.label) {
                "⇧", "⌫" -> sp(16f)
                "?123", "ABC" -> sp(12f)
                "↩" -> sp(18f)
                "SPACE" -> sp(11f)
                else -> sp(17f)
            }
            textPaint.color = when {
                key.label == "⇧" && shifted -> Color.parseColor("#6D28D9")
                key.isSpecial -> Color.parseColor("#374151")
                else -> Color.parseColor("#1F2937")
            }

            val textY = cy - (textPaint.descent() + textPaint.ascent()) / 2
            canvas.drawText(displayLabel, cx, textY, textPaint)
        }
    }

    private fun displayText(label: String): String = when (label) {
        "SPACE" -> "space"
        "⇧" -> if (shifted) "⬆" else "⇧"
        else -> if (shifted && label.length == 1 && label[0].isLetter()) label.uppercase() else label
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        if (event.action == MotionEvent.ACTION_UP) {
            val key = keys.firstOrNull { it.rect.contains(event.x, event.y) } ?: return true
            performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP)
            handleKey(key.label)
        }
        return true
    }

    private fun handleKey(label: String) {
        when (label) {
            "⌫" -> onKey?.invoke(KeyEvent.Backspace)
            "SPACE" -> onKey?.invoke(KeyEvent.Space)
            "↩" -> onKey?.invoke(KeyEvent.Enter)
            "⇧" -> {
                shifted = !shifted
                invalidate()
                onKey?.invoke(KeyEvent.ShiftToggle)
            }
            "?123", "ABC" -> {
                showNumbers = !showNumbers
                shifted = false
                buildKeys(width.toFloat(), height.toFloat())
                invalidate()
                onKey?.invoke(KeyEvent.SwitchToNumbers)
            }
            else -> {
                val ch = if (shifted && label.length == 1 && label[0].isLetter())
                    label[0].uppercaseChar() else label[0]
                onKey?.invoke(KeyEvent.Char(ch))
                if (shifted) {
                    shifted = false
                    invalidate()
                }
            }
        }
    }

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        val w = MeasureSpec.getSize(widthMeasureSpec)
        val h = (w * 0.48f).toInt()
        setMeasuredDimension(w, h)
    }

    private fun dp(v: Float) = v * resources.displayMetrics.density
    private fun sp(v: Float) = v * resources.displayMetrics.scaledDensity
}
