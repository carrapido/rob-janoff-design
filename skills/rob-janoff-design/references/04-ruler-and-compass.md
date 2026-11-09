# Ruler-and-Compass Method (Golden Series)

Every curve of the logo is an arc of a circle from **a single series**; no measurement is chosen by eye. The method turns Janoff's intuition ("Play with the choices and test all the applications until everything about your logo design feels inevitable") into geometry that can be measured, explained and repeated. The examples come from a real logo built this way: a cat constructed in a 700-unit frame.

## 1. The Series

- **Formula:** `R(n) = R0 / φⁿ`, with φ ≈ 1.618 ([golden ratio](https://en.wikipedia.org/wiki/Golden_ratio)). R0 is the radius of the main shape; the diameters are `D(n) = 2·R(n)`.
- **Example with R0 = 240:** R−1 388.3 · R0 240 · R1 148.3 · R2 91.7 · R3 56.7 · R4 35 · R5 21.6 · R6 13.4 · R7 8.3.
- **Most-used property:** `R(n) = R(n+1) + R(n+2)`. An even R4 outline around an R2 corner leaves an R3 corner on the same center (R2 − R4 = R3), so offsets also land on the series.
- **Golden slope:** 1 wide by φ tall (for example, a fang that drops R3 and moves in R4).

## 2. Construction

1. **Origin and square:** Put the origin at the center of the main shape and draw its bounding square. Name every position as a series distance from that center or from the sides of the square ("the ear tip, D5 above the top side").
2. **Series arcs only:** Every SVG `A` command declares a series radius. Check the large-arc and sweep flags by computing the center the browser will choose ([endpoint-to-center conversion](https://www.w3.org/TR/SVG2/implnote.html#ArcConversionEndpointToCenter)) and comparing it with the construction center.
3. **Symmetry:** When you mirror in x, flip the sweep flag; if the segment is also traversed in reverse, the flag stays the same.
4. **Joins without kinks:** Where two curves meet, use a tangent arc: its center lies on the line from the first arc's center through the contact point. A single tangent arc cannot pass through a corner; chain two there (an R4 eyelid that continues, tangent, into an R−1 arc).
5. **Framing:** Margins also come from the series. For the optical center, leave top and bottom margins in a 1 : φ ratio (for example, R2 on top and R1 at the bottom).
6. **Document the construction:** In the code, every measurement carries the name of its series step, so whoever reads it can rebuild it.
7. **Audit:** `node <skill-dir>/scripts/series-audit.ts logo.svg --r0 240` measures every `A` arc and every Bézier as a circle. It accepts a radius on one step, or a concentric offset of a series circle (the face `R0 − R4` around the head `R0`, the hair gap `R0 + D7`), and lists the rest with the nearest step. A Bézier's center is where its end normals cross, which is exact for the cubic copy of section 3.

## 3. From Hand-Drawn Edit to Golden Fit

The client draws, the agent measures. This way no shapes are imposed on the client: they get their own stroke back, exact.

1. **Editable copy:** Deliver a copy of the logo with literal paths in cubic Béziers of at most 90° per segment (control point at `4/3 · tan(θ/4) · r`, see [circles and cubic Béziers](https://pomax.github.io/bezierinfo/#circles_cubic)), so the client can drag each node in the editor.
2. **The client adjusts by hand** and gives the signal ("run the process").
3. **Compare:** Read the current version (it may have changed since your last read) and diff its paths against the last copy to know exactly what moved. `node <skill-dir>/scripts/series-fit.ts edited.svg --r0 240 --since last-copy.svg` does it: a curve counts as changed when it moved more than the tolerance, so an editor that rewrites arcs as cubics, reverses a path or rounds differently changes nothing.
4. **Fit each change to the series:** Sample the stroke, try candidates (series radii and positions) and pick the one with the lowest root-mean-square error. Report the number and the cause of the residual ("6.4 RMS, mostly from the asymmetry of the sides"). `series-fit` tries every series radius through the curve's own end points, so it stays joined to its neighbours, and prints the RMS, the largest error and where it sits, the runner-up, how far the tangent turns at each end (a kink with the neighbour) and the `A` command to paste. Positions and concentric offsets (`R0 − R4`) are still yours to name. Without `--since`, it fits every curve `series-audit` lists as off series or not circular.
5. **Apply without overwriting:** The result goes into the golden component, as a toggle whose default value keeps what was approved. Never overwrite the client's hand-drawn sheet.
6. **Respect the meaning:** If one of the client's shapes represents something (a "hood" that is really hair falling behind the head), fit the shape they drew. Before turning it into something else, ask what it is: an even frame around the face, for example, was read as a double chin.

## 4. Tests Beyond Color, Monochrome and 256 / 48 / 16 px

- **Scale in numbers:** The on-screen size of a detail is `measurement × px ÷ frame width`. Anything under 1 px disappears: a 10-unit gap in a 700-unit frame measures 0.7 px at 48 px, while at D7 (16.6) it already measures 1.1 px. `node <skill-dir>/scripts/scale-report.ts logo.svg` computes it for each contour's narrowest gap to another contour, each contour's size and each stroke width. Thin parts inside one contour (a neck, a sharp tip) still need the enlarged 16 px render.
- **Real pixels:** `node <skill-dir>/scripts/render-png.ts logo.svg` writes PNGs at 256, 48 and 16 px and a sheet with the 16 px render enlarged ×8; look at the sheet before showing anything. In the HTML preview, show the 16 px PNG enlarged ×8 with [`image-rendering: pixelated`](https://developer.mozilla.org/en-US/docs/Web/CSS/image-rendering).
- **Avatar:** Most social networks crop the avatar to a circle. Compute the smallest circle that contains the mark and frame it with a series margin (R4); the square's inscribed circle usually cuts off the tips.
- **Dark background and watermark:** A single-color version with an [SVG mask](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/mask) made from the same shapes (ink → white, paper → black), so the face and the gaps stay cut out. With several copies on one page, each mask needs its own id (a hash of what it draws).
- **Usage mockup:** Test the logo where it will live (avatar, header, watermark at 10–25 % over an image), not only in isolation.
- **Real browser:** `render-png` draws fills only and lists what it leaves out (strokes, masks, gradients, text). Check those in a browser; stroke joins and masks can also look different there.

## 5. Traps That Already Showed Up

- **Flat tips:** With `stroke-linejoin: miter`, if `1 / sin(θ/2)` exceeds [`stroke-miterlimit`](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/stroke-miterlimit) (4 by default), the browser falls back to a bevel and the tip goes flat. Raising the limit stretches the point too far; instead, cap the tip and redraw the outline with tangent arcs that close into a short point (R5 beyond the tip).
- **Straight cuts over curves:** They leave kinks and "claws". Cut with tangent arcs.
- **Thin lines between layers:** Two layers that share an edge leave an antialiasing line; overlap them by about 4 units so the top one covers it.
- **Invisible pieces that do work:** A cream disc on a cream background may be covering the tails of other pieces. Before removing something that "isn't visible", check what it covers.
