// Links found on specific pages — some as embedded text hyperlinks (citations
// with no visible URL, recovered from the source Canva design's text layer,
// not visible via OCR or by looking for underlined text), some as plain
// printed URLs, and most as QR codes (recovered by scanning every page image
// with zbarimg; several pages had QR codes crammed close enough together
// that isolating each one required cropping and re-scanning individually).
// `box` is the QR/text region on the ORIGINAL 2000x1000 page image,
// normalized to 0..1 (x, y, width, height), used to position a clickable
// overlay directly on top of it — some links have more than one box because
// their text wraps across lines. `qr` is a freshly generated, cleanly-spaced
// QR encoding the same link, shown in the per-page "Links" panel so it's
// easy to scan even where the original print layout crowded several codes
// together.
window.PAGE_LINKS = {
  25: [
    { label: "Illustrator: Balaiamon Kharngapkynta (StoryWeaver profile)", url: "https://storyweaver.org.in/en/users/907254-balaiamon-kharngapkynta", qr: "assets/qr/025-1.png", box: [0.8675, 0.844, 0.085, 0.036] },
    { label: "Illustrator: Balaiamon Kharngapkynta (StoryWeaver profile)", url: "https://storyweaver.org.in/en/users/907254-balaiamon-kharngapkynta", qr: "assets/qr/025-1.png", box: [0.570, 0.872, 0.135, 0.040] }
  ],
  36: [
    { label: "Cover photo of The Root Bridge — read on StoryWeaver", url: "https://storyweaver.org.in/en/stories/609676-the-root-bridge", qr: "assets/qr/036-1.png", box: [0.7265, 0.842, 0.0355, 0.070] }
  ],
  39: [
    { label: "Recording: Premji Khongjawer", url: "https://drive.google.com/file/d/1ngcWzz8iHHSsnHh11u35aFL_4KJ1lqD5/view?usp=drive_link", qr: "assets/qr/039-1.png", box: [0.8355, 0.797, 0.057, 0.113] },
    { label: "Recording: Deabiarth Marak", url: "https://drive.google.com/file/d/1JmNeedxC7HX5BaeMkn-EEge2N-_49Alv/view?usp=drive_link", qr: "assets/qr/039-2.png", box: [0.8985, 0.797, 0.057, 0.113] }
  ],
  41: [
    { label: "Recording: Premji Khongjawer (condensation example)", url: "https://drive.google.com/file/d/1UwuqnsK9KBV3dsiJcEpWzSD9WtmxzwQO/view?usp=drive_link", qr: "assets/qr/041-1.png", box: [0.406, 0.812, 0.0495, 0.099] }
  ],
  46: [
    { label: "Alluring ethnic attire | Deccan Herald", url: "https://www.deccanherald.com/content/304557/alluring-ethnic-attire.html", qr: "assets/qr/046-1.png", box: [0.545, 0.442, 0.235, 0.030] },
    { label: "Putting on Khasi Traditional Dresses by myself", url: "https://www.youtube.com/watch?v=XCCfrwJxqOc", qr: "assets/qr/046-2.png", box: [0.545, 0.485, 0.3225, 0.027] },
    { label: "Marina-Kyntiew Kbani (YouTube channel)", url: "https://www.youtube.com/@marina-kyntiewkbani699", qr: "assets/qr/046-3.png", box: [0.904, 0.483, 0.056, 0.029] },
    { label: "Marina-Kyntiew Kbani (YouTube channel)", url: "https://www.youtube.com/@marina-kyntiewkbani699", qr: "assets/qr/046-3.png", box: [0.545, 0.525, 0.1125, 0.031] }
  ],
  47: [
    { label: "Read the article on Scroll.in", url: "https://scroll.in/latest/841867/delhi-golf-club-asks-meghalaya-woman-wearing-traditional-dress-to-leave-for-looking-like-a-maid", qr: "assets/qr/047-1.png", box: [0.04, 0.095, 0.415, 0.09] }
  ],
  68: [
    { label: "Watch: 'U Slap' animated jingle", url: "https://drive.google.com/file/d/1Zo8rRGizTAxZmL_BGJ2GpZFJad5xZA4g/view?usp=drive_link", qr: "assets/qr/068-1.png", box: [0.9188, 0.0788, 0.042, 0.0838] }
  ],
  69: [
    { label: "Watch: 'Apjon Apjon' animated jingle", url: "https://drive.google.com/file/d/1O-Q2zY8UaKfTpCPiZqc9iQUocqL3JFcQ/view?usp=drive_link", qr: "assets/qr/069-1.png", box: [0.9095, 0.088, 0.0465, 0.092] }
  ],
  70: [
    { label: "Watch: 'Mai Jing Jing' animated song", url: "https://drive.google.com/file/d/1xK4KiDf-MDas_JlJHVFITlXw7k3XgI3Z/view?usp=sharing", qr: "assets/qr/070-1.png", box: [0.9105, 0.089, 0.045, 0.091] }
  ],
  72: [
    { label: "StoryWeaver website", url: "https://storyweaver.org.in/en", qr: "assets/qr/072-1.png", box: [0.62, 0.533, 0.0665, 0.133] },
    { label: "How to publish your book on StoryWeaver", url: "https://www.youtube.com/watch?v=o3513gpzIMw&t=64s", qr: "assets/qr/072-2.png", box: [0.813, 0.532, 0.067, 0.135] }
  ],
  79: [
    { label: "TFFP Storytelling Handbook (full document)", url: "https://drive.google.com/file/d/17zBH9BBdhElAoKI2y8ZyXFPHVhIa3h9c/view?usp=drive_link", qr: "assets/qr/079-1.png", box: [0.9125, 0.824, 0.0435, 0.088] }
  ],
  80: [
    { label: "Storytelling Handbook, pages 18–20", url: "https://drive.google.com/file/d/1zkr_ynQwsMAHw4yHJbH-sBBVHsy_z1yZ/view?usp=drive_link", qr: "assets/qr/080-1.png", box: [0.9035, 0.799, 0.044, 0.088] }
  ],
  81: [
    { label: "sauramandala.org/tffp", url: "https://www.sauramandala.org/tffp", qr: "assets/qr/081-1.png", box: [0.3275, 0.188, 0.1065, 0.202] },
    { label: "sauramandala.org/tffp", url: "https://www.sauramandala.org/tffp", qr: "assets/qr/081-1.png", box: [0.3375, 0.092, 0.10, 0.025] },
    { label: "TFFP Storytelling Handbook (full document)", url: "https://drive.google.com/file/d/17zBH9BBdhElAoKI2y8ZyXFPHVhIa3h9c/view?usp=drive_link", qr: "assets/qr/079-1.png", box: [0.037, 0.831, 0.044, 0.088] }
  ],
  83: [
    { label: "Field pilot documentation (1 of 2)", url: "https://drive.google.com/file/d/1KeOBQDcfxQ4CRzxt8ruJCzW3D2UjcE1w/view?usp=drive_link", qr: "assets/qr/083-1.png", box: [0.919, 0.838, 0.0415, 0.082] },
    { label: "Field pilot documentation (2 of 2)", url: "https://drive.google.com/file/d/1o0RvRVlVaYcsKcOtk6OS_Q6yPs1guCMp/view?usp=drive_link", qr: "assets/qr/083-2.png", box: [0.8635, 0.835, 0.0435, 0.087] }
  ],
  87: [
    { label: "Field pilot documentation (1 of 4)", url: "https://drive.google.com/file/d/1nX-Ryatwo7Nb1TWOvadHFVEHi36-Mi60/view?usp=drive_link", qr: "assets/qr/087-4.png", box: [0.762, 0.843, 0.046, 0.091] },
    { label: "Field pilot documentation (2 of 4)", url: "https://drive.google.com/file/d/1sPgOYwE3CEfuUizIEbtn9dv3gCwV-f66/view?usp=drive_link", qr: "assets/qr/087-1.png", box: [0.812, 0.843, 0.045, 0.09] },
    { label: "Field pilot documentation (3 of 4)", url: "https://drive.google.com/file/d/1o3fGL_vNo9GTpivThd4yaH5maw4G8X6D/view?usp=drive_link", qr: "assets/qr/087-2.png", box: [0.8615, 0.844, 0.045, 0.089] },
    { label: "Field pilot documentation (4 of 4)", url: "https://drive.google.com/file/d/1evhu87ui0IDrrqpbe3456Ve2ZVlxUVW1/view?usp=drive_link", qr: "assets/qr/087-3.png", box: [0.911, 0.838, 0.045, 0.09] }
  ]
};
