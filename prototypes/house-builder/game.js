const GRID_WIDTH = 80;
const GRID_HEIGHT = 60;
const STEP_DELAY_MS = 450;

const canvas = document.getElementById("gridCanvas");
const ctx = canvas.getContext("2d");
const inputsContainer = document.getElementById("typeInputs");
const legend = document.getElementById("legend");
const logContainer = document.getElementById("log");
const generateButton = document.getElementById("generateButton");
const statusLabel = document.getElementById("status");
let roomTypes = [];
let roomPool = [];
let grid = [];
let roomTypeLookup = new Map();

const offset = {
  x: Math.floor(GRID_WIDTH / 2),
  y: Math.floor(GRID_HEIGHT / 2)
};

const doorColor = "#f59e0b";
const wallColor = "#4b5563";

const {
  getDoorPosition,
  computeOriginFromDoor,
  canPlaceRoom,
  placeRoom,
  bakeWalls
} = window.HouseBuilderCore;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const toGridCoords = (worldX, worldY) => ({
  x: worldX + offset.x,
  y: worldY + offset.y
});

const isInside = (worldX, worldY) => {
  const { x, y } = toGridCoords(worldX, worldY);
  return x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT;
};

const getCell = (worldX, worldY) => {
  if (!isInside(worldX, worldY)) {
    return null;
  }
  const { x, y } = toGridCoords(worldX, worldY);
  return grid[y][x];
};

const setCell = (worldX, worldY, cellData) => {
  if (!isInside(worldX, worldY)) {
    return;
  }
  const { x, y } = toGridCoords(worldX, worldY);
  grid[y][x] = cellData;
};

const resetGrid = () => {
  grid = Array.from({ length: GRID_HEIGHT }, () =>
    Array.from({ length: GRID_WIDTH }, () => ({ type: "empty", color: "#ffffff" }))
  );
  drawGrid();
};

const drawGrid = () => {
  const cellSize = Math.floor(
    Math.min(canvas.width / GRID_WIDTH, canvas.height / GRID_HEIGHT)
  );

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < GRID_HEIGHT; y += 1) {
    for (let x = 0; x < GRID_WIDTH; x += 1) {
      const cell = grid[y][x];
      if (cell.type !== "empty") {
        ctx.fillStyle = cell.color;
        ctx.fillRect(x * cellSize, (GRID_HEIGHT - 1 - y) * cellSize, cellSize, cellSize);
      }
    }
  }

  ctx.strokeStyle = "rgba(148, 163, 184, 0.35)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= GRID_WIDTH; x += 1) {
    ctx.beginPath();
    ctx.moveTo(x * cellSize, 0);
    ctx.lineTo(x * cellSize, GRID_HEIGHT * cellSize);
    ctx.stroke();
  }
  for (let y = 0; y <= GRID_HEIGHT; y += 1) {
    ctx.beginPath();
    ctx.moveTo(0, y * cellSize);
    ctx.lineTo(GRID_WIDTH * cellSize, y * cellSize);
    ctx.stroke();
  }
};

const logMessage = (message, prefix = "") => {
  const entry = document.createElement("div");
  entry.className = "log-entry";
  entry.innerHTML = `${prefix ? `<strong>${prefix}</strong> ` : ""}${message}`;
  logContainer.appendChild(entry);
  logContainer.scrollTop = logContainer.scrollHeight;
};

const clearLog = () => {
  logContainer.innerHTML = "";
};

const createLegend = () => {
  legend.innerHTML = "";
  roomTypes.forEach((type) => {
    const item = document.createElement("div");
    item.className = "legend-item";

    const swatch = document.createElement("span");
    swatch.className = "legend-swatch";
    swatch.style.background = type.color;

    const label = document.createElement("span");
    label.textContent = type.typeID;

    item.appendChild(swatch);
    item.appendChild(label);
    legend.appendChild(item);
  });

  const wall = document.createElement("div");
  wall.className = "legend-item";
  wall.innerHTML = `<span class="legend-swatch" style="background:${wallColor}"></span>Wall`;
  legend.appendChild(wall);

  const door = document.createElement("div");
  door.className = "legend-item";
  door.innerHTML = `<span class="legend-swatch" style="background:${doorColor}"></span>Door`;
  legend.appendChild(door);
};

const createInputs = () => {
  inputsContainer.innerHTML = "";
  roomTypes.forEach((type) => {
    const card = document.createElement("div");
    card.className = "input-card";
    card.dataset.typeId = type.typeID;

    const title = document.createElement("h3");
    title.textContent = type.typeID;

    const amountRow = document.createElement("div");
    amountRow.className = "input-row";
    const amountLabel = document.createElement("label");
    amountLabel.textContent = "Amount";
    const amountInput = document.createElement("input");
    amountInput.type = "range";
    amountInput.min = "0";
    amountInput.max = "5";
    amountInput.value = "1";
    amountInput.className = "amount-slider";
    const amountValue = document.createElement("span");
    amountValue.className = "amount-value";
    amountValue.textContent = amountInput.value;
    amountInput.addEventListener("input", () => {
      amountValue.textContent = amountInput.value;
    });

    amountRow.appendChild(amountLabel);
    amountRow.appendChild(amountInput);
    amountRow.appendChild(amountValue);

    card.appendChild(title);
    card.appendChild(amountRow);
    inputsContainer.appendChild(card);
  });
};

const getCountsFromInputs = () => {
  const counts = {};
  document.querySelectorAll(".input-card").forEach((card) => {
    const typeId = card.dataset.typeId;
    const input = card.querySelector("input[type='range']");
    const amount = Number(input.value);
    counts[typeId] = { amount };
  });
  return counts;
};

const validateFeasibility = (counts) => {
  logMessage("Validating room types and neighbor rules...", "Step 1");
  let valid = true;

  roomTypes.forEach((type) => {
    if (!Array.isArray(type.allowedNeighborTypeIDs)) {
      valid = false;
      logMessage(`${type.typeID} has no neighbor definitions.`, "Error");
    }
  });

  Object.entries(counts).forEach(([typeId, range]) => {
    if (Number.isNaN(range.amount) || range.amount < 0 || range.amount > 5) {
      valid = false;
      logMessage(`${typeId} has an invalid amount.`, "Error");
    }
    if (range.amount > 0 && !roomPool.some((room) => room.typeID === typeId)) {
      valid = false;
      logMessage(`${typeId} has no prefabs in the room pool.`, "Error");
    }
  });

  if (valid) {
    logMessage("Feasibility check passed.", "OK");
  }

  return valid;
};

const randomFromArray = (arr) => arr[Math.floor(Math.random() * arr.length)];

const getTypeOrder = (typeId) => {
  const type = roomTypeLookup.get(typeId);
  return Number.isFinite(type?.order) ? type.order : 0;
};

const buildRoomInstance = (prefab, typeId, idCounter) => ({
  id: `${typeId}-${idCounter}`,
  typeID: typeId,
  width: prefab.width,
  height: prefab.height,
  doorSockets: prefab.doorSockets,
  color: roomTypeLookup.get(typeId).color
});

const canPlaceRoomOnGrid = (room, origin, doorPosition) =>
  canPlaceRoom(room, origin, doorPosition, isInside, getCell);

const placeRoomOnGrid = (room, origin, doorPosition) =>
  placeRoom(room, origin, doorPosition, setCell, doorColor);

const shuffle = (arr) => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const getOrderedPrefabs = (prefabs) => {
  const grouped = new Map();
  prefabs.forEach((prefab) => {
    const order = getTypeOrder(prefab.typeID);
    if (!grouped.has(order)) {
      grouped.set(order, []);
    }
    grouped.get(order).push(prefab);
  });

  return [...grouped.entries()]
    .sort(([orderA], [orderB]) => orderA - orderB)
    .flatMap(([, group]) => shuffle(group));
};

const getRootRoomType = (requiredCounts) => {
  const eligible = Object.entries(requiredCounts)
    .filter(([, amount]) => amount > 0)
    .map(([typeId]) => typeId);

  if (eligible.length === 0) {
    return null;
  }

  const minOrder = Math.min(...eligible.map((typeId) => getTypeOrder(typeId)));
  const lowestOrderTypes = eligible.filter((typeId) => getTypeOrder(typeId) === minOrder);
  return randomFromArray(lowestOrderTypes);
};

const getOppositeEdge = (edge) => {
  switch (edge) {
    case "N":
      return "S";
    case "S":
      return "N";
    case "E":
      return "W";
    case "W":
      return "E";
    default:
      return null;
  }
};

const getDoorKey = (socket) => `${socket.edge}:${socket.offset}`;
const getDoorPositionKey = (position) => `${position.x},${position.y}`;

const MAX_GENERATION_ATTEMPTS = 10;

const hasSatisfiedCounts = (placedCounts, requiredCounts) =>
  Object.entries(requiredCounts).every(
    ([typeId, required]) => (placedCounts[typeId] || 0) === required
  );

const collectAvailableDoors = (placedRooms) => {
  const allowedNeighborsGlobalList = new Set();
  const availablePlacedDoors = [];

  placedRooms.forEach(({ room, origin, usedSockets }) => {
    const allowedNeighbors = roomTypeLookup.get(room.typeID).allowedNeighborTypeIDs;
    room.doorSockets.forEach((socket, index) => {
      const socketKey = getDoorKey(socket);
      if (usedSockets.has(socketKey)) {
        return;
      }
      allowedNeighbors.forEach((neighbor) => allowedNeighborsGlobalList.add(neighbor));
      availablePlacedDoors.push({
        room,
        roomId: room.id,
        origin,
        socket,
        socketIndex: index,
        socketKey,
        doorPosition: getDoorPosition(room, origin, socket)
      });
    });
  });

  return { allowedNeighborsGlobalList, availablePlacedDoors };
};

const findPlacementForRoom = (room, availablePlacedDoors) => {
  const targetSockets = shuffle(room.doorSockets.map((socket, index) => ({ socket, index })));

  for (const source of availablePlacedDoors) {
    const allowedNeighbors = roomTypeLookup.get(source.room.typeID).allowedNeighborTypeIDs;
    const allowedReverse = roomTypeLookup.get(room.typeID).allowedNeighborTypeIDs;
    if (!allowedNeighbors.includes(room.typeID) || !allowedReverse.includes(source.room.typeID)) {
      continue;
    }

    const requiredEdge = getOppositeEdge(source.socket.edge);
    for (const target of targetSockets) {
      if (requiredEdge && target.socket.edge !== requiredEdge) {
        continue;
      }
      const targetKey = getDoorKey(target.socket);
      const targetOrigin = computeOriginFromDoor(room, target.socket, source.doorPosition);
      if (canPlaceRoomOnGrid(room, targetOrigin, source.doorPosition)) {
        return {
          sourceId: source.roomId,
          sourceSocketIndex: source.socketIndex,
          targetSocketIndex: target.index,
          sourceSocketKey: source.socketKey,
          targetSocketKey: targetKey,
          origin: targetOrigin,
          door: source.doorPosition
        };
      }
    }
  }

  return null;
};

const renderDoorSockets = (placedRooms) => {
  placedRooms.forEach(({ room, origin }) => {
    room.doorSockets.forEach((socket) => {
      const doorPosition = getDoorPosition(room, origin, socket);
      if (!isInside(doorPosition.x, doorPosition.y)) {
        return;
      }
      const existing = getCell(doorPosition.x, doorPosition.y);
      if (existing && existing.type === "interior") {
        return;
      }
      setCell(doorPosition.x, doorPosition.y, { type: "door", color: doorColor });
    });
  });
};

const removeUnusedDoorSockets = (placedRooms) => {
  const usedDoorPositions = new Set();
  placedRooms.forEach(({ room, origin, usedSockets }) => {
    usedSockets.forEach((socketKey) => {
      const socket = room.doorSockets.find((entry) => getDoorKey(entry) === socketKey);
      if (!socket) {
        return;
      }
      const doorPosition = getDoorPosition(room, origin, socket);
      usedDoorPositions.add(getDoorPositionKey(doorPosition));
    });
  });

  placedRooms.forEach(({ room, origin }) => {
    room.doorSockets.forEach((socket) => {
      const doorPosition = getDoorPosition(room, origin, socket);
      if (!isInside(doorPosition.x, doorPosition.y)) {
        return;
      }
      if (usedDoorPositions.has(getDoorPositionKey(doorPosition))) {
        return;
      }
      const existing = getCell(doorPosition.x, doorPosition.y);
      if (existing && existing.type === "door") {
        setCell(doorPosition.x, doorPosition.y, { type: "empty", color: "#ffffff" });
      }
    });
  });
};

const attemptRoomPlacement = async (requiredCounts, attempt) => {
  resetGrid();
  const placedRooms = new Map();
  let idCounter = 1;
  const placedCounts = Object.fromEntries(Object.keys(requiredCounts).map((typeId) => [typeId, 0]));

  const selectedRootType = getRootRoomType(requiredCounts);
  if (!selectedRootType) {
    logMessage("Root room type must have amount > 0.", "Error");
    return { success: false };
  }

  const rootPool = roomPool.filter((room) => room.typeID === selectedRootType);
  if (rootPool.length === 0) {
    logMessage(`No prefabs for root room type ${selectedRootType}.`, "Error");
    return { success: false };
  }

  const rootPrefab = randomFromArray(rootPool);
  const root = buildRoomInstance(rootPrefab, selectedRootType, idCounter);
  idCounter += 1;
  const rootOrigin = { x: 0, y: 0 };
  if (!canPlaceRoomOnGrid(root, rootOrigin, null)) {
    logMessage(`Attempt ${attempt}: root room does not fit inside grid.`, "Warning");
    return { success: false };
  }

  placedRooms.set(root.id, {
    room: root,
    origin: rootOrigin,
    usedSockets: new Set()
  });
  placedCounts[root.typeID] = (placedCounts[root.typeID] || 0) + 1;
  placeRoomOnGrid(root, rootOrigin, null);
  renderDoorSockets(placedRooms);
  drawGrid();
  logMessage(`Attempt ${attempt}: placed root room ${root.id} at (0,0).`, "OK");
  await sleep(STEP_DELAY_MS);

  if (hasSatisfiedCounts(placedCounts, requiredCounts)) {
    logMessage("All required rooms placed with root placement.", "OK");
    return { success: true, placedRooms };
  }

  while (!hasSatisfiedCounts(placedCounts, requiredCounts)) {
    const { allowedNeighborsGlobalList, availablePlacedDoors } = collectAvailableDoors(placedRooms);

    if (availablePlacedDoors.length === 0) {
      logMessage(`Attempt ${attempt}: no available doors to expand from.`, "Warning");
      return { success: false };
    }

    const placeableRoomPrefabs = getOrderedPrefabs(
      roomPool.filter(
        (prefab) =>
          allowedNeighborsGlobalList.has(prefab.typeID) &&
          (placedCounts[prefab.typeID] || 0) < requiredCounts[prefab.typeID]
      )
    );

    if (placeableRoomPrefabs.length === 0) {
      logMessage(
        `Attempt ${attempt}: no remaining rooms match allowed neighbor types.`,
        "Warning"
      );
      return { success: false };
    }

    let placedRoomThisLoop = false;
    for (const prefab of placeableRoomPrefabs) {
      const room = buildRoomInstance(prefab, prefab.typeID, idCounter);
      idCounter += 1;
      const placement = findPlacementForRoom(room, availablePlacedDoors);

      if (placement) {
        const source = placedRooms.get(placement.sourceId);
        source.usedSockets.add(placement.sourceSocketKey);
        placedRooms.set(room.id, {
          room,
          origin: placement.origin,
          usedSockets: new Set([placement.targetSocketKey])
        });
        placeRoomOnGrid(room, placement.origin, placement.door);
        renderDoorSockets(placedRooms);
        drawGrid();
        logMessage(
          `Connected ${room.id} to ${placement.sourceId} using sockets ${placement.sourceSocketIndex}→${placement.targetSocketIndex}.`,
          "OK"
        );
        await sleep(STEP_DELAY_MS);
        placedCounts[room.typeID] = (placedCounts[room.typeID] || 0) + 1;
        placedRoomThisLoop = true;
        break;
      }
    }

    if (!placedRoomThisLoop) {
      logMessage(
        `Attempt ${attempt}: no placeable rooms fit available doors. Aborting.`,
        "Warning"
      );
      return { success: false };
    }
  }

  return { success: true, placedRooms };
};

const generateHouse = async () => {
  generateButton.disabled = true;
  statusLabel.textContent = "Generating...";
  clearLog();
  resetGrid();

  const counts = getCountsFromInputs();
  if (!validateFeasibility(counts)) {
    statusLabel.textContent = "Validation failed";
    generateButton.disabled = false;
    return;
  }

  await sleep(STEP_DELAY_MS);

  const requiredCounts = Object.fromEntries(
    Object.entries(counts).map(([typeId, range]) => [typeId, range.amount])
  );
  const totalRooms = Object.values(requiredCounts).reduce((sum, value) => sum + value, 0);
  if (totalRooms === 0) {
    logMessage("No rooms selected. Increase the amount sliders.", "Error");
    statusLabel.textContent = "Idle";
    generateButton.disabled = false;
    return;
  }

  await sleep(STEP_DELAY_MS);
  logMessage("Placing rooms incrementally...", "Step 2");

  let finalPlacedRooms = null;
  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt += 1) {
    logMessage(`Generation attempt ${attempt} of ${MAX_GENERATION_ATTEMPTS}.`, "Step 2");
    const result = await attemptRoomPlacement(requiredCounts, attempt);
    if (result.success) {
      finalPlacedRooms = result.placedRooms;
      break;
    }
    await sleep(STEP_DELAY_MS);
  }

  if (!finalPlacedRooms) {
    logMessage("No valid layout found after all attempts.", "Error");
    statusLabel.textContent = "Failed";
    generateButton.disabled = false;
    return;
  }

  removeUnusedDoorSockets(finalPlacedRooms);
  bakeWalls(
    Array.from(finalPlacedRooms.values()).map((entry) => ({
      room: entry.room,
      origin: entry.origin
    })),
    isInside,
    getCell,
    setCell,
    wallColor
  );
  drawGrid();

  logMessage("Generation complete. All rooms connected.", "Step 5");
  statusLabel.textContent = "Complete";

  generateButton.disabled = false;
};

const init = async () => {
  const [roomTypesResponse, roomPoolResponse] = await Promise.all([
    fetch("RoomTypes.json"),
    fetch("RoomPool.json")
  ]);

  const roomTypesJson = await roomTypesResponse.json();
  const roomPoolJson = await roomPoolResponse.json();

  roomTypes = roomTypesJson.roomTypes;
  roomPool = roomPoolJson.rooms;
  roomTypeLookup = new Map(roomTypes.map((type) => [type.typeID, type]));

  createLegend();
  createInputs();
  resetGrid();

  generateButton.addEventListener("click", generateHouse);
};

init();
