# Art

Put art from ChatGPT here, exactly as it was made: full size, transparent background. **Don't resize, crop or trim it.** `npm run art` does that, and writes game-ready sprites plus a manifest to `public/art/`. The game finds them by name.

Images made against a footprint template line up exactly. Others work too: the art step finds where the building stands from its outline. Check what it found with `npm run art -- --check some-folder`, which saves each image with its footprint drawn on. When an image isn't drawn in true 2:1 isometric (ChatGPT sometimes draws one side flatter), give it hand measurements in a sidecar file (below).

## Names

`<kind>_<subject>_<era>_<W>x<H>_v<NN>[_<state>].png`, lowercase.

| Example | What it is |
| --- | --- |
| `buildings/bronze/bld_home_bronze_1x1_v01.png` | Bronze era mudbrick home, first variant |
| `buildings/bronze/bld_home_bronze_1x1_v01_winter.png` | The same home with snow |
| `nature/nat_broadleaf_any_1x1_v01_autumn.png` | A broadleaf tree in autumn |
| `landmarks/lmk_hearth_bronze_1x1_v01.png` | The Hearth, a one-of-a-kind landmark |

Any number of variants (`v01`, `v02`, …) of anything are used at random. States the game looks for: `winter` for buildings; `spring`, `autumn` and `winter` for trees.

## Asset names the game uses today

| Game thing | File name start |
| --- | --- |
| Hide tent (families with nowhere to live yet) | `bld_hide-tent_bronze_1x1` |
| Lean-to (one person with nowhere to live yet) | `bld_lean-to_bronze_1x1` |
| Round hut | `bld_hut-round_bronze_1x1` |
| Mudbrick home (any number of variants) | `bld_home_bronze_1x1` |
| Family house (2×2, built by big families) | `bld_house-large_bronze_2x2` |
| Gathering hall (3×3) | `bld_longhouse_bronze_3x3` |
| Granary (2×2) | `bld_granary_bronze_2x2` |
| Potter's kiln (2×2) | `bld_kiln_bronze_2x2` |
| Bronze furnace | `bld_furnace_bronze_1x1` |
| Stone circle (2×2) | `bld_shrine_bronze_2x2` |
| Well | `bld_well_bronze_1x1` |
| Fishing dock | `bld_dock_bronze_1x1` |
| Market stall | `bld_stall_bronze_1x1` |
| Burial ground (3×3) | `bld_burial_bronze_3x3` |
| The Hearth (in `landmarks/`) | `lmk_hearth_bronze_1x1` |
| The Old Stone (in `landmarks/`, tall template) | `lmk_old-stone_bronze_1x1` |
| Trees, rocks and stumps | `nat_broadleaf_any_1x1`, `nat_pine_any_1x1`, `nat_fruit_any_1x1`, `nat_bush_any_1x1`, `nat_rock_any_1x1`, `nat_stump_any_1x1` |
| Animal pen (2×2) | `bld_pen_bronze_2x2` |

## Night lights and smoke

To make windows glow at night or a chimney smoke, or to set the footprint by hand, add a JSON file with the same name next to the image, with points in the image's own pixels:

```json
{ "lights": [[300, 700], [645, 605]], "smoke": [[512, 210]], "anchorPx": [603, 1142], "tilePx": 395 }
```

`anchorPx` is the base's lowest corner and `tilePx` is how many pixels wide one tile is. Homes without `lights` get a glow at the door. The Hearth's `smoke` point is where its living smoke rises from, and its painted fire flickers while you work.

Use the full-size image, not a pre-shrunk copy: sidecar points are in the full-size image's pixels.

## Trying art before committing it

In the game, **Settings → Art test scene** lets you drop in an image, see it on the real grid next to other buildings (by day and night, summer and winter, and at 48 px), and use it in your city right away. Art used that way stays on that computer until the file is added here.

`_reference/` holds the style anchor, the era style sheets and the footprint templates.
