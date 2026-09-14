const TILE = 1;
const maps = {
  warm: {
    name: 'Warm office', cols: 24, rows: 16,
    status: '24 × 16 · East exit → Quiet workroom',
    exits: [{ edge: 'east', at: 7, width: 2, target: 'quiet', targetEdge: 'west', targetAt: 4 }],
    fixtures: [
      ['desk', 2, 2, 4, 3], ['chair', 3, 5, 2, 2], ['bookcase', 17, 2, 2, 3], ['plant', 20, 11, 2, 2], ['rug', 10, 9, 4, 3]
    ]
  },
  quiet: {
    name: 'Quiet workroom', cols: 12, rows: 10,
    status: '12 × 10 · West exit → Warm office',
    exits: [{ edge: 'west', at: 4, width: 2, target: 'warm', targetEdge: 'east', targetAt: 7 }],
    fixtures: [
      ['desk', 3, 2, 4, 3], ['chair', 4, 5, 2, 2], ['bookcase', 8, 2, 2, 3], ['plant', 8, 7, 2, 2], ['rug', 2, 7, 3, 2]
    ]
  }
};
const src = {
  desk: 'normalized-core/desk-walnut.png', chair: 'normalized-core/chair-blue.png',
  bookcase: 'normalized-core/bookcase-walnut.png', plant: 'normalized-core/plant-large.png', rug: 'normalized-core/rug-navy.png'
};
const mapEl = document.querySelector('#map');
const nameEl = document.querySelector('#room-name');
const statusEl = document.querySelector('#map-status');
const positionEl = document.querySelector('#position');
let roomId = 'warm'; let actor = { x: 12, y: 7 };
const cell = (x, y) => `left:calc(${x} * var(--tile));top:calc(${y} * var(--tile));`;
const isDoor = (room, edge, value) => room.exits.some(exit => exit.edge === edge && value >= exit.at && value < exit.at + exit.width);
function blocked(room, x, y) {
  return room.fixtures.some(([, fx, fy, fw, fh]) => x >= fx && x < fx + fw && y >= fy && y < fy + fh);
}
function wallTiles(room) {
  const tiles = [];
  for (let x = 0; x < room.cols; x++) { tiles.push(['wall', x, 0]); tiles.push(['wall', x, room.rows - 1]); }
  for (let y = 1; y < room.rows - 1; y++) {
    if (!isDoor(room, 'west', y)) tiles.push(['wall', 0, y]); else tiles.push(['doorway', 0, y]);
    if (!isDoor(room, 'east', y)) tiles.push(['wall', room.cols - 1, y]); else tiles.push(['doorway', room.cols - 1, y]);
  }
  return tiles;
}
function render() {
  const room = maps[roomId];
  mapEl.style.setProperty('--cols', room.cols); mapEl.style.setProperty('--rows', room.rows);
  nameEl.textContent = room.name; statusEl.textContent = room.status; mapEl.replaceChildren();
  wallTiles(room).forEach(([kind, x, y]) => { const tile = document.createElement('i'); tile.className = `tile ${kind}`; tile.style.cssText = cell(x, y); mapEl.append(tile); });
  room.fixtures.forEach(([kind, x, y, width, height]) => { const item = document.createElement('img'); item.className = `fixture ${kind}`; item.src = src[kind]; item.alt = ''; item.style.cssText = `${cell(x, y)}width:calc(${width} * var(--tile));height:calc(${height} * var(--tile));`; mapEl.append(item); });
  const sprite = document.createElement('i'); sprite.className = 'actor'; sprite.style.left = `calc((${actor.x} + .5) * var(--tile))`; sprite.style.top = `calc((${actor.y} + .5) * var(--tile))`; mapEl.append(sprite);
  positionEl.textContent = `${roomId} · tile ${actor.x},${actor.y}`;
}
function transition(exit) {
  roomId = exit.target;
  const target = maps[roomId];
  actor = exit.targetEdge === 'west' ? { x: 1, y: exit.targetAt } : { x: target.cols - 2, y: exit.targetAt };
  render();
}
function move(dx, dy) {
  const room = maps[roomId]; const nx = actor.x + dx; const ny = actor.y + dy;
  const edge = nx === 0 ? 'west' : nx === room.cols - 1 ? 'east' : ny === 0 ? 'north' : ny === room.rows - 1 ? 'south' : null;
  if (edge) { const at = edge === 'east' || edge === 'west' ? actor.y : actor.x; const exit = room.exits.find(item => item.edge === edge && at >= item.at && at < item.at + item.width); if (exit) transition(exit); return; }
  if (nx < 0 || ny < 0 || nx >= room.cols || ny >= room.rows || blocked(room, nx, ny)) return;
  actor = { x: nx, y: ny }; render();
}
mapEl.addEventListener('keydown', event => { const keys = { ArrowUp: [0, -TILE], w: [0, -TILE], ArrowDown: [0, TILE], s: [0, TILE], ArrowLeft: [-TILE, 0], a: [-TILE, 0], ArrowRight: [TILE, 0], d: [TILE, 0] }; const step = keys[event.key] || keys[event.key.toLowerCase()]; if (!step) return; event.preventDefault(); move(...step); });
document.querySelectorAll('[data-treatment]').forEach(button => button.addEventListener('click', () => { document.body.className = `treatment-${button.dataset.treatment}`; document.querySelectorAll('[data-treatment]').forEach(item => item.classList.toggle('active', item === button)); mapEl.focus(); }));
render(); mapEl.focus();
