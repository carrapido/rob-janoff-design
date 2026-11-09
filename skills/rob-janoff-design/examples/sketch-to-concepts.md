# Worked Example: Three Different Concepts from One Sketch

A hand-drawn sketch by [@marsanwishito](https://www.tiktok.com/@marsanwishito): a melancholic girl with a side fringe over one eye and a red heart on her chest, tied by a red thread to a poster. The brief was a T-shirt logo: vectorize her head and hair, imagine how the hair falls behind her head, then design. Read this before drawing the three concepts of phase 3: it shows how to make them genuinely different.

## The rule this example teaches

**Each concept pulls a different detail out of the source**, so the three are three ideas, not one silhouette with three treatments:

| Concept | Detail it pulls | Idea | File |
| --- | --- | --- | --- |
| Reference | — | The sketch traced in vectors, keeping the pencil's width. | `sketch-to-concepts/1-reference.svg` |
| A · Silhouette and cut | The fringe over one eye | The fringe becomes a straight cut across the face that leaves one eye. | `sketch-to-concepts/2-concept-a.svg` |
| B · Negative-space wink | The heart on her chest | Her hair is an upside-down heart and the face is its hole; turn it 180° and the heart appears. | `sketch-to-concepts/3-concept-b.svg` |
| C · Graphic continuum | The red thread | One line runs from the hair to the chin and turns into the thread, ending in her heart. | `sketch-to-concepts/4-concept-c.svg` |

All three start from the same one-ink head: the hair is the mass and the face is the hole. What differs is the idea each one carries.

## What the commands report today

These concepts were drawn before the skill had its commands, so they show what a critique would now catch:

- **Radii:** concept A uses Fibonacci radii × 1.5 (89, 55, 13, 8, 3), an approximation of φ rather than one series `R0 / φⁿ`. `series-audit` would flag them; `series-fit` would move them onto a series.
- **Scale:** `scale-report` fails A and B at 48 px. A's mouth is 9 units tall (0.90 px) and B's is 6.75 units (0.68 px), so both mouths vanish on an avatar.
- **Strokes:** concept C is a 14-unit stroke (1.40 px at 48 px, it passes), but `render-png` does not draw strokes and reports them; check C in a browser or outline the line as a fill. At 16 px the line breaks up, so an icon would need a simpler cut.
