// Links found on specific pages — some printed as a plain URL, most as a QR
// code. Decoded by scanning every page image with zbarimg; a few pages had
// QR codes crammed close enough together that decoders (this one included,
// and likely a phone camera too) can't isolate all of them — see the two
// "unresolved" notes below. `box` is the QR/text region on the ORIGINAL
// 2000x1000 page image, normalized to 0..1 (x, y, width, height), used to
// position a clickable overlay directly on top of it. `qr` is a freshly
// generated, cleanly-spaced QR encoding the same link, shown in the
// per-page "Links" panel so it's easy to scan even where the original
// print layout crowded several codes together.
window.PAGE_LINKS = {
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
  47: [
    { label: "Read the article on Scroll.in", url: "https://scroll.in/latest/841867/delhi-golf-club-asks-meghalaya-woman-wearing-traditional-dress-to-leave-for-looking-like-a-maid", qr: "assets/qr/047-1.png", box: [0.05, 0.095, 0.41, 0.075] }
  ],
  69: [
    { label: "Watch: the animated song", url: "https://drive.google.com/file/d/1O-Q2zY8UaKfTpCPiZqc9iQUocqL3JFcQ/view?usp=drive_link", qr: "assets/qr/069-1.png", box: [0.9095, 0.088, 0.0465, 0.092] }
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
    { label: "sauramandala.org/tffp", url: "https://www.sauramandala.org/tffp", qr: "assets/qr/081-1.png", box: [0.295, 0.09, 0.145, 0.31] },
    { label: "TFFP Storytelling Handbook (full document)", url: "https://drive.google.com/file/d/17zBH9BBdhElAoKI2y8ZyXFPHVhIa3h9c/view?usp=drive_link", qr: "assets/qr/079-1.png", box: [0.037, 0.831, 0.044, 0.088] }
  ],
  83: [
    { label: "Field pilot documentation (1 of 2)", url: "https://drive.google.com/file/d/1KeOBQDcfxQ4CRzxt8ruJCzW3D2UjcE1w/view?usp=drive_link", qr: "assets/qr/083-1.png", box: [0.919, 0.838, 0.0415, 0.082] }
    // A second QR sits right after this one but is cut off by the page's
    // right edge in the source artwork — undecodable. See README.
  ],
  87: [
    { label: "Field pilot documentation (1 of 4)", url: "https://drive.google.com/file/d/1sPgOYwE3CEfuUizIEbtn9dv3gCwV-f66/view?usp=drive_link", qr: "assets/qr/087-1.png", box: [0.812, 0.843, 0.045, 0.09] },
    { label: "Field pilot documentation (2 of 4)", url: "https://drive.google.com/file/d/1o3fGL_vNo9GTpivThd4yaH5maw4G8X6D/view?usp=drive_link", qr: "assets/qr/087-2.png", box: [0.8615, 0.844, 0.045, 0.089] },
    { label: "Field pilot documentation (3 of 4)", url: "https://drive.google.com/file/d/1evhu87ui0IDrrqpbe3456Ve2ZVlxUVW1/view?usp=drive_link", qr: "assets/qr/087-3.png", box: [0.911, 0.838, 0.045, 0.09] }
    // The 4th QR in this row is cut off by the page's right edge in the
    // source artwork — undecodable. See README.
  ]
};
