# Smashterpiece

Smashterpiece is a 3D stone carving game for young children. The player
hits a block of stone with tools. Chips and dust fly. The block slowly
becomes a statue.

The game runs in the browser. It does not use a server, ads, links to
other sites, or data collection. All data stays in the browser.

## How to play

Each button has a large picture. The buttons on the start screen and
the stone picker also have a short name, for players who can read.

1. On the start screen, select one of the large buttons:
   - **Continue** (green arrow): go back to the last block. This button
     shows only when there is a saved game.
   - **Carve** (block and hammer): free mode. Carve any shape.
   - **Shapes** (ghost with a star): challenge mode. Carve a shape.
   - **Museum**: look at your statues.
   - **Treasures** (treasure chest): look at the treasures that you
     found. The red badge shows how many kinds you have.
2. In challenge mode, select a shape: star, fish, heart, duck, smiley
   face, or rocket.
3. Select a material. The number of hammers on the button shows the
   number of hits that each piece needs:
   - Sand (light yellow): 1 hit. Sand cannot hang in the air. Thin parts
     with nothing below them crumble and pour down.
   - Sandstone (orange): 1 hit.
   - Chocolate (brown): 1 hit. It has small white chocolate chips.
   - Cheese (yellow): 1 hit. It has air holes in it. Sometimes a mouse
     squeaks.
   - Ice (very light blue): 1 hit. You can see through ice. It breaks
     into shiny pieces.
   - Wood (brown with rings): 2 hits. It makes thin wood shavings.
   - Marble (white): 2 hits. Small cracks show after the first hit.
   - Glass (light blue): 2 hits. You can see through glass. It cracks
     after the first hit and breaks into shiny pieces.
   - Granite (gray): 3 hits.

   In ice and glass, the ghost shape is pink.
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

### Hidden treasures

Each new block has 2 or 3 treasures in it, in random places. You cannot
see them at the start. Small gold sparkles come out of the stone when a
treasure is near the surface. Dig there! When a treasure touches the
air, it jumps out of the stone. A "NEW!" badge shows when you find a
treasure for the first time.

There are 18 treasures: 6 common, 6 rare and 6 super rare. The game
keeps your treasures in the browser. Open **Treasures** on the start
screen to see your collection. A treasure that you did not find yet is
a gray shape with a question mark. Tap a found treasure to hear it.

In challenge mode, the treasures are never in the ghost shape.

### Saving

The game saves the block automatically after each hit, and when you
close the page or the app. Push **Continue** on the start screen to go
back to it. When you start a new block, the game asks first, because
the new block replaces the saved block.

The **gear** button at the bottom left of the start screen opens the
**Save file** panel. This panel is for parents:

- **Save** puts all the data in one small file: the Museum, the
  treasures and the saved block. On a phone or a tablet, the share
  sheet opens. There you can keep the file in Files, in Google Drive,
  or send it to a different device. On a computer, the file goes to
  the downloads folder.
- **Load** adds the data of a file to this device. Nothing on the
  device is removed: the Museum gets the statues that it does not have,
  and each treasure gets the larger count.

Use a save file to move the game to a new device, or from Safari to
the installed app. A save file also keeps the data safe when the
browser removes the data of the site. For example, Safari can remove
the data of a website that you did not open for some time. It does not
remove the data of an installed app.

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

## Install the game on a phone or a tablet

Smashterpiece is a Progressive Web App (PWA). You can install it and
play it without a network connection.

- **iPhone and iPad (Safari):** open the game, push the **Share**
  button, then push **Add to Home Screen**.
- **Android (Chrome):** open the game, open the menu, then push
  **Install app** or **Add to Home screen**.
- **Computer (Chrome or Edge):** push the install button in the address
  bar.

After the first visit, the service worker (`sw.js`) keeps a copy of the
game files and of three.js. Then the game starts without a network
connection. When a new version is on the server, the game gets it in
the background and shows it at the next start.

On iPhone and iPad, the installed app has its own storage. The Museum
and the treasures in the app are not the same as in Safari.

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
`style.css`, `manifest.webmanifest`, `sw.js`, and the `src` and `icons`
folders to the site. It does not deploy the tests or the workflow files.

The game uses only relative paths. Thus it works at
`https://<USER>.github.io/<REPO>/` and on a local server.

## Files

| Path | Contents |
| --- | --- |
| `index.html` | The page, the import map for three.js, and the screens. |
| `style.css` | The look of the buttons and the screens. |
| `manifest.webmanifest` | The app data for the installed app (PWA). |
| `sw.js` | The service worker that keeps the files for offline play. |
| `icons/` | The app icons. |
| `src/core/` | The game logic. These modules do not use three.js or the DOM. |
| `src/game/` | The 3D views, the sounds, and the user interface. |
| `test/` | The unit tests for the modules in `src/core/`. |

The modules in `src/core/` are:

| Module | Function |
| --- | --- |
| `grid.js` | The 32 x 32 x 32 voxel grid and the pedestal. |
| `stones.js` | The hardness of each stone, and which stone crumbles. |
| `sand.js` | The crumble rule for sand. |
| `holes.js` | The air holes in cheese. |
| `treasures.js` | The hidden treasures and the treasure collection. |
| `save.js` | The automatic save, and the save file (backup) for all data. |
| `random.js` | A random number generator with a seed. |
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
