# Worked Example: Critique and Refresh of a Cat

A personal brand logo for a developer and video editor: a geometric cat that mixes Neco-Arc with the Superintendent from *Halo 3: ODST*. `cat/before.svg` is the client's logo; `cat/after.svg` is the refresh. Read this for the Critique and Refresh modes and for a full ruler-and-compass construction. Every number below comes from the skill's commands; rerun them on the files to see the same output.

## 1. Critique of `cat/before.svg`

- **Verdict:** a strong silhouette (round head, swept-back ears, zigzag fringe, round eyes, one fang) whose details vanish at icon size.
- **What people recognize (must survive):** the head and ears, the fringe, the eyes and the fang.
- **What fails, most serious first:**
  1. `scale-report`: the gap between the face and the hair and the two ear-to-head gaps are about 10 units in a 700-unit frame, **0.68–0.69 px at 48 px**. At avatar size the fringe merges with the face.
  2. `series-audit --r0 240`: the six fringe arcs measure r 156.8 to 160.4, **8 to 12 units off R1**. They were set by eye.
  3. A dark face with light eyes leaves the fringe as a thin light line between two dark masses; the edge depends on that gap.

## 2. Refresh: what changed and why

The silhouette stays; one element is rethought (option C of the Refresh mode).

1. **The face turns light**, so the fringe becomes the edge between two tones instead of a thin gap that disappears below 48 px.
2. **The hair falls behind the head as a hood**, built from the same series.
3. **The fang becomes a 7**, a wink to Bungie: it drops R3 and moves in R4, a slope of φ.
4. **The gap around the hair widens to D7** (16.53 units): 1.14 px at 48 px.

## 3. Construction with the series (R0 = 240)

`R−1 388.33 · R0 240 · R1 148.33 · R2 91.67 · R3 56.66 · R4 35.02 · R5 21.64 · R6 13.37 · R7 8.27`; `D(n) = 2·R(n)`. The frame is `viewBox="150 190 700 700"` and the head's center is (500, 540). Each step has its drawing in `cat/steps/`.

| Step | Construction | Series step |
| --- | --- | --- |
| 1 · Square (`1-square.svg`) | The head's bounding square, 2·R0 = 480; its golden section sets the eye line. | D0 |
| 2 · Head and face (`2-head.svg`) | Head circle; the face is concentric, one R4 inside it. | R0, R0 − R4 |
| 3 · Ears (`3-ears.svg`) | Each ear is the lens between an R1 and an R−1 circle; the tip sits D5 above the square. | R1, R−1, D5 |
| 4 · Fringe and locks (`4-fringe.svg`) | Six R1 arcs draw the fringe; four R−1 arcs, tangent to the head, draw the locks. | R1, R−1 |
| 5 · Eyes and mouth (`5-features.svg`) | Each eye is where two R3 circles cross; the fang drops R3 and moves in R4. | R3, R4 |
| 6 · Hood and frame (`6-hood.svg`) | R2 corners; the bottom sits D5 below the square, the same margin as the ears on top. The gap around the hair is R0 + D7. | R2, D5, R0 + D7 |

## 4. What the commands still report on `cat/after.svg`

Honest leftovers, kept as they are because changing them is the client's call:

- `series-audit`: four curves of the hood (two mirrored pairs, r 153.60 and r 439.05) are off the series; they were hand-drawn edits. `series-fit` fits them to R1 and R−1 through the same end points, moving them at most 0.18 and 0.20 units.
- `scale-report`: the tip of each lock nearly touches the hood, an 8.71-unit gap that is 0.60 px at 48 px. Either it may merge at 48 px or it widens to D7.
- `render-png`: everything is drawn (fills only); at 16 px the ears and eyes still read.
