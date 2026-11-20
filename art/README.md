# Art

Put art from ChatGPT here, exactly as it was made: the full-size image drawn against a footprint template (1024 × 1024, or 1024 × 1536 for the tall templates), with a transparent background. **Don't resize, crop or trim it.** `npm run art` does that, and writes game-ready sprites plus a manifest to `public/art/`. The game finds them by name.

## Names

`<kind>_<subject>_<era>_<W>x<H>_v<NN>[_<state>].png`, lowercase.

| Example | What it is |
| --- | --- |
| `buildings/bronze/bld_home_bronze_1x1_v01.png` | Bronze era mudbrick home, first variant |
| `buildings/bronze/bld_home_bronze_1x1_v01_winter.png` | The same home with snow |
| `nature/nat_broadleaf_any_1x1_v01_autumn.png` | A broadleaf tree in autumn |

Up to three variants (`v01`–`v03`) of anything are used at random. States the game looks for: `winter` for buildings; `spring`, `autumn` and `winter` for trees.

## Asset names the game uses today

| Game thing | File name start |
| --- | --- |
| Hide tent | `bld_tent_bronze_1x1` |
| Round hut | `bld_hut-round_bronze_1x1` |
| Mudbrick home | `bld_home_bronze_1x1` |
| Family house (2×2) | `bld_house-large_bronze_2x2` |
| Gathering hall (3×3) | `bld_longhouse_bronze_3x3` |
| Granary | `bld_granary_bronze_1x1` |
| Potter's kiln | `bld_kiln_bronze_1x1` |
| Bronze furnace | `bld_furnace_bronze_1x1` |
| Stone circle (2×2) | `bld_shrine_bronze_2x2` |
| Well | `bld_well_bronze_1x1` |
| Fishing dock | `bld_dock_bronze_1x1` |
| Market stall | `bld_stall_bronze_1x1` |
| Burial ground (3×3) | `bld_burial_bronze_3x3` |
| The hearth | `lnd_hearth_any_1x1` |
| The Old Stone | `lnd_old-stone_any_1x1` |
| Trees and rocks | `nat_broadleaf_any_1x1`, `nat_pine_any_1x1`, `nat_fruit_any_1x1`, `nat_bush_any_1x1`, `nat_rock_any_1x1` |

## Night lights and smoke

To make windows glow at night or a chimney smoke, add a JSON file with the same name next to the image, with points in the image's own pixels:

```json
{ "lights": [[300, 700], [645, 605]], "smoke": [[512, 210]] }
```

## Trying art before committing it

In the game, **Settings → Art test scene** lets you drop in an image, see it on the real grid next to other buildings (by day and night, summer and winter, and at 48 px), and use it in your city right away. Art used that way stays on that computer until the file is added here.

`_reference/` holds the style anchor, the era style sheets and the footprint templates.
