# Smashterpiece

Smashterpiece is a 3D stone carving game for young children. The player
hits a block of stone with tools. Chips and dust fly. The block slowly
becomes a statue.

The game runs in the browser. It does not use a server, ads, links to
other sites, or data collection. All data stays in the browser.

## How to play

The game does not use words. Each button has a large picture.

1. On the start screen, select one of the three large buttons:
   - **Block and hammer**: free mode. Carve any shape.
   - **Ghost with a star**: challenge mode. Carve a shape.
   - **Museum**: look at your statues.
2. In challenge mode, select a shape: star, fish, heart, duck, smiley
   face, or rocket.
3. Select a stone. The number of hammers on the button shows the number
   of hits that each piece of stone needs:
   - Sand (light yellow): 1 hit. Sand cannot hang in the air. Thin parts
     with nothing below them crumble and pour down.
   - Sandstone (orange): 1 hit.
   - Marble (white): 2 hits. Small cracks show after the first hit.
   - Granite (gray): 3 hits.
   - Glass (light blue): 2 hits. You can see through glass. It cracks
     after the first hit and breaks into shiny pieces. In glass, the
     ghost shape is pink.
4. Select a tool at the bottom of the screen:
   - **Hammer**: removes a large ball of stone.
   - **Point chisel**: removes a small ball of stone.
   - **File**: removes small bumps and makes the surface smooth.
5. Point at the stone. Yellow blocks show the stone that the tool
   removes. Orange blocks show the stone that only gets cracks.
6. Tap or click to hit.
7. Drag to turn the camera. Pinch or scroll to zoom.

A tap that moves less than 8 pixels is a hit. A larger move turns the
camera.

The game works on phones, tablets and computers. On a phone in
portrait, the buttons are in two rows at the top. On a phone in
landscape, the tools are on the left side. When you turn the phone, the
camera moves to show all of the stone.

When a piece of stone does not touch the pedestal any more, it falls
and breaks.

### Buttons during the game

| Picture | Function |
| --- | --- |
| House | Go back to the start screen. |
| Arrow | Undo the last hit (up to 30 steps). |
| Museum | Save the statue to the Museum. |
| Block with a sparkle | Start with a new stone (free mode only). |
| Ghost | Show or hide the ghost shape (challenge mode only). |
| Trophy | Finish the challenge (challenge mode only). |

In challenge mode, the transparent ghost shape shows the statue to
carve. The stars at the top fill when the stone looks more like the
ghost. The trophy button shows when the first star is full. Push the
trophy to finish and get 1, 2 or 3 stars.

On a keyboard, you can also use these keys:

- `1`, `2`, `3`: select the hammer, the point chisel, or the file.
- `Ctrl+Z` or `Cmd+Z`: undo.

### The Museum

The Museum shows the saved statues on pedestals. Drag to turn the
camera. Use the arrow buttons to go to the next statue, or tap a
statue. To delete a statue, push the trash button, then push the green
check mark. The Museum keeps up to 40 statues. When it is full, it
removes the oldest statue.

## How to run the game on your computer

The game uses native ES modules. The browser must get the files from a
web server. It cannot open `index.html` directly from the disk.

1. Start a static web server in the root folder of the repository.
   Use one of these commands:

   ```sh
   npx serve .
   ```

   ```sh
   python3 -m http.server 8000
   ```

2. Open the address that the server shows, for example
   `http://localhost:8000/`.

The game loads three.js from `cdn.jsdelivr.net`. Your computer must
have an internet connection.

## How to run the tests

You must have Node.js 20 or a later version. The tests use only the
built-in Node test runner. There are no dependencies to install.

```sh
npm test
```

## How to deploy

The workflow file `.github/workflows/pages.yml` deploys the game to
GitHub Pages.

1. On GitHub, open **Settings > Pages** of the repository.
2. Set **Source** to **GitHub Actions**.
3. Push to the `main` branch.

The workflow runs the tests first. If a test fails, the workflow does
not deploy. When the tests pass, the workflow copies `index.html`,
`style.css`, and the `src` folder to the site. It does not deploy the
tests or the workflow files.

The game uses only relative paths. Thus it works at
`https://<USER>.github.io/<REPO>/` and on a local server.

## Files

| Path | Contents |
| --- | --- |
| `index.html` | The page, the import map for three.js, and the screens. |
| `style.css` | The look of the buttons and the screens. |
| `src/core/` | The game logic. These modules do not use three.js or the DOM. |
| `src/game/` | The 3D views, the sounds, and the user interface. |
| `test/` | The unit tests for the modules in `src/core/`. |

The modules in `src/core/` are:

| Module | Function |
| --- | --- |
| `grid.js` | The 32 x 32 x 32 voxel grid and the pedestal. |
| `stones.js` | The hardness of each stone, and which stone crumbles. |
| `sand.js` | The crumble rule for sand. |
| `carve.js` | The voxel removal for each tool. |
| `connect.js` | The connection check. It finds the pieces that fall. |
| `shapes.js` | The ghost shapes for the challenge mode. |
| `score.js` | The match score and the stars. |
| `codec.js` | Save and load: run-length compression, Base64, and the Museum data. |
| `history.js` | The undo history. |
| `raycast.js` | Finds the voxel under the pointer. |
| `mesher.js` | Makes the mesh data with face culling and ambient occlusion. |

## Technical notes

- The stone is a voxel grid. The pedestal is the bottom layer. The
  player cannot remove it.
- The view divides the grid into chunks of 8 x 8 x 8 voxels. Each chunk
  is one mesh that has only the visible faces. After a hit, the game
  builds again only the chunks that changed.
- After each hit, a flood fill starts at the pedestal. Stone that the
  flood fill does not reach falls and breaks into chips.
- In challenge mode, the block is a thick slab around the ghost shape.
  Thus the child needs fewer hits to finish.
- The match score is `keep x clear`. `keep` is the part of the ghost
  shape that is still stone. `clear` is the part of the extra stone
  that the player removed. A score of 0.55 or more gives 2 stars. A
  score of 0.8 or more gives 3 stars. The player always gets at least
  1 star.
- The Web Audio API makes all sounds. The game draws all textures on a
  canvas. The game does not load sound or image files.
- When the frame rate is too low, the game makes the pixel ratio
  smaller.
