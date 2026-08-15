const SUPABASE_URL = 'https://tlrgfkjbqmpjdmlfdpam.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_pHr9pd1Ck9MNpfA8GQ5tFQ_RurgMylt';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
//size of the map
let inputX = document.getElementById("x");
let inputY = document.getElementById("y");
//generate a random map
let makeButton = document.getElementById("make");
//map edit
let grid = document.getElementById("grid");
//place Raku on the map
let buttonRaku = document.getElementById("buttonRaku");
let buttonStartPoint = document.getElementById("buttonStartPoint");
//Code window
let codeInput = document.getElementById("codeInput");
//Map publish
let exportButton = document.getElementById("exportButton");
//Erase everything from the map
let eraseButton = document.getElementById("eraseButton");
//Use random mode(Markov chain type of rng)
let randomButton = document.getElementById("randomButton");
//shows visually where is Raku right now
let whereIsRakuButton = document.getElementById("whereIsRakuButton");
//Conway's Game of Life
let gameOfLife = document.getElementById("gameOfLife");
//Start the Game of Life or the code for Raku
let startTheCodeButton = document.getElementById("startTheCodeButton");
//Change speed
let speedInput = document.getElementById("speed");
let speed = parseInt(speedInput.value, 10);

speedInput.addEventListener("input", function () {
    speed = parseInt(speedInput.value, 10);
});

let clickedStatus = "none";
let rakuPlaced = false;
let rakuCoordinates = "none";
let rakuDirection = 0;
let mapMatrix = [];
const userFunctions = {};

let isRandomModeRunning = false;
let gameOfLiveActive = false;
let isGameOfLifeRunning = false;

let scopeStack = [{}];

function setVar(name, value) {
    scopeStack[scopeStack.length - 1][name] = value;
}

function getVar(name) {
    for (let i = scopeStack.length - 1; i >= 0; i--) {
        if (Object.prototype.hasOwnProperty.call(scopeStack[i], name)) {
            return scopeStack[i][name];
        }
    }
    return undefined;
}

function getVisibleVars() {
    let merged = {};
    for (let frame of scopeStack) {
        Object.assign(merged, frame);
    }
    return merged;
}

function firstToken(str) {
    const m = str.match(/^([a-zA-Z_]\w*)/);
    return m ? m[1] : "";
}

const rockInventory = { red: 0, green: 0, blue: 0 };
const rockMap = {};

const rockSprites = {
    red: "RedRock.svg",
    green: "GreenRock.svg",
    blue: "BlueRock.svg"
};

//this is made for reset stats of rocks inside Raku's inventory
function resetRockState() {
    for (let key in rockMap) delete rockMap[key];
    rockInventory.red = 0;
    rockInventory.green = 0;
    rockInventory.blue = 0;
}

function clearRockAt(x, y) {
    delete rockMap[`${x},${y}`];
}

/*---------------ADDEVENTLISTENER HELL--------------*/

makeButton.addEventListener("click", async function () {
    let cols = parseInt(inputX.value) || 8;
    let rows = parseInt(inputY.value) || 8;

    mapCreate(cols, rows);

    try {
        await supabaseClient.rpc('increment_stat', { stat_name: 'total_maps_created' });
        await loadStats();
    } catch (err) {
        console.error("Error updating stats:", err);
    }
});

whereIsRakuButton.addEventListener("click", function () {
    whereIsRakuMode();
});

randomButton.addEventListener("click", function () {
    randomMode();
});

buttonRaku.addEventListener("click", function () {
    clickedStatus = "Raku";
});

gameOfLife.addEventListener("click", function () {
    if (!gameOfLiveActive) {
        gameOfLiveActive = true;
        startTheCodeButton.textContent = "Start";
        funcGameOfLife();
    } else {
        gameOfLiveActive = false;
        isGameOfLifeRunning = false;
        startTheCodeButton.textContent = "start the code";

        let cols = parseInt(inputX.value) || 8;
        let rows = parseInt(inputY.value) || 8;
        mapCreate(cols, rows);
    }
});

startTheCodeButton.addEventListener("click", function () {
    supabaseClient.rpc('increment_stat', { stat_name: 'total_scripts_run' });
    if (gameOfLiveActive) {
        gameOfLifeLogic();
        return;
    }

    let code = codeInput.value;
    codeExecution(code);
});

exportButton.addEventListener("click", function () {
    let title = prompt("Name your map:") || "Untitled Map";
    let authorName = prompt("Enter your name:") || "Anonymous"; 
    shareMapToCommunity(title, authorName); 
});

eraseButton.addEventListener("click", function () {
    eraseEveryting();
});

//editing the map
grid.addEventListener("click", function (e) {
    if (e.target.tagName !== "IMG") return;

    let x = parseInt(e.target.dataset.x);
    let y = parseInt(e.target.dataset.y);

    if (clickedStatus === "Raku") {
        if (e.target.classList.contains("Wall")) {
            alert("You cannot place Raku on a wall! Select an empty tile.");
            clickedStatus = "none";
        } else if (e.target.classList.contains("Empty")) {
            if (rakuPlaced && rakuCoordinates !== "none") {
                let [oldX, oldY] = rakuCoordinates.split(",").map(Number);
                let oldImg = grid.querySelector(`img[data-x="${oldX}"][data-y="${oldY}"]`);
                if (oldImg) {
                    oldImg.classList.remove("Raku");
                    oldImg.classList.add("Empty");
                    mapMatrix[oldY][oldX] = 0;
                    renderTile(oldX, oldY);
                }
            }

            rakuPlaced = true;
            e.target.classList.remove("Empty");
            e.target.classList.add("Raku");
            e.target.src = "Raku.svg";
            rakuCoordinates = x + "," + y;
            mapMatrix[y][x] = 2;
            clickedStatus = "none";
        }
    } else {
        if (e.target.classList.contains("Wall")) {
            clearRockAt(x, y);
            e.target.style.backgroundColor = "";
            e.target.src = "Empty.svg";
            e.target.classList.remove("Wall");
            e.target.classList.add("Empty");
            mapMatrix[y][x] = 0;
        } else if (e.target.classList.contains("Empty")) {
            clearRockAt(x, y);
            e.target.style.backgroundColor = "";
            e.target.src = "Wall.svg";
            e.target.classList.remove("Empty");
            e.target.classList.add("Wall");
            mapMatrix[y][x] = -1;
        } else if (e.target.classList.contains("Raku")) {
            e.target.classList.remove("Raku");
            e.target.classList.add("Empty");
            mapMatrix[y][x] = 0;
            rakuPlaced = false;
            rakuCoordinates = "none";
            renderTile(x, y);
        } else if (e.target.classList.contains("deadCell")) {
            e.target.classList.remove("deadCell");
            e.target.classList.add("liveCell");
            mapMatrix[y][x] = 1;
        } else if (e.target.classList.contains("liveCell")) {
            e.target.classList.remove("liveCell");
            e.target.classList.add("deadCell");
            mapMatrix[y][x] = 0;
        }
    }
});


/*-----Game of Life logic-----*/
async function funcGameOfLife() {
    resetRockState();
    let cols = parseInt(inputX.value) || 8;
    let rows = parseInt(inputY.value) || 8;

    grid.innerHTML = "";
    grid.style.setProperty("--cols", cols);
    grid.style.setProperty("--rows", rows);

    rakuDirection = 0;
    rakuPlaced = false;
    rakuCoordinates = "none";
    mapMatrix = [];

    for (let y = 0; y < rows; y++) {
        let row = [];

        for (let x = 0; x < cols; x++) {
            let img = new Image();
            img.draggable = false;
            img.classList.add("deadCell", "border");
            row.push(0);

            img.dataset.y = y;
            img.dataset.x = x;
            grid.appendChild(img);
        }

        mapMatrix.push(row);
    }
}

async function gameOfLifeLogic() {
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    if (isGameOfLifeRunning) {
        isGameOfLifeRunning = false;
        console.log("Game of Life stopped.");
        return;
    }

    if (!mapMatrix.length) return;

    isGameOfLifeRunning = true;
    const targetY = mapMatrix.length;
    const targetX = mapMatrix[0].length;

    while (isGameOfLiveActiveCheck()) {
        let currentGen = [];
        for (let y = 0; y < targetY; y++) {
            let row = [];
            for (let x = 0; x < targetX; x++) {
                let cell = grid.querySelector(`img[data-x="${x}"][data-y="${y}"]`);
                row.push(cell.classList.contains("liveCell") ? 1 : 0);
            }
            currentGen.push(row);
        }

        let nextGen = [];
        for (let y = 0; y < targetY; y++) {
            let row = [];
            for (let x = 0; x < targetX; x++) {
                let liveNeighbors = 0;

                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (dx === 0 && dy === 0) continue;

                        let ny = y + dy;
                        let nx = x + dx;

                        if (ny >= 0 && ny < targetY && nx >= 0 && nx < targetX) {
                            liveNeighbors += currentGen[ny][nx];
                        }
                    }
                }

                let alive = currentGen[y][x] === 1;
                let staysAlive = alive && (liveNeighbors === 2 || liveNeighbors === 3);
                let becomesAlive = !alive && liveNeighbors === 3;

                row.push(staysAlive || becomesAlive ? 1 : 0);
            }
            nextGen.push(row);
        }

        for (let y = 0; y < targetY; y++) {
            for (let x = 0; x < targetX; x++) {
                let cell = grid.querySelector(`img[data-x="${x}"][data-y="${y}"]`);

                if (nextGen[y][x] === 1) {
                    cell.classList.remove("deadCell");
                    cell.classList.add("liveCell");
                } else {
                    cell.classList.remove("liveCell");
                    cell.classList.add("deadCell");
                }

                mapMatrix[y][x] = nextGen[y][x];
            }
        }

        await delay(speed);
    }
}

function isGameOfLiveActiveCheck() {
    return isGameOfLifeRunning;
}


//Random mode
const MarkovChain = {
    forward: { forward: 0.3, left: 0.35, right: 0.35 },
    left: { forward: 0.6, left: 0.1, right: 0.3 },
    right: { forward: 0.6, left: 0.3, right: 0.1 }
};

async function randomMode() {
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    if (!rakuPlaced) {
        alert("Raku is not placed!!!");
        return;
    }

    if (isRandomModeRunning) {
        isRandomModeRunning = false;
        console.log("Random mode stopped.");
        return;
    }

    isRandomModeRunning = true;
    let currentAction = "forward";

    while (isRandomModeRunning) {
        if (currentAction === "forward") {
            let steps = Math.floor(Math.random() * 3) + 1;
            await forward(steps);
        } else if (currentAction === "left") {
            left();
        } else if (currentAction === "right") {
            right();
        }

        let probabilities = MarkovChain[currentAction];
        let randomNumber = Math.random();
        let cumulative = 0;
        let nextSelectedAction = "forward";

        for (let actionName in probabilities) {
            cumulative += probabilities[actionName];
            if (randomNumber < cumulative) {
                nextSelectedAction = actionName;
                break;
            }
        }

        currentAction = nextSelectedAction;

        await delay(speed);
    }
}

function eraseEveryting() {
    let choice = confirm("Do you want to erase the map?");

    if (choice) {
        resetRockState();
        let cols = parseInt(inputX.value) || 8;
        let rows = parseInt(inputY.value) || 8;

        grid.innerHTML = "";
        grid.style.setProperty("--cols", cols);
        grid.style.setProperty("--rows", rows);

        rakuDirection = 0;
        rakuPlaced = false;
        rakuCoordinates = "none";
        mapMatrix = [];

        for (let y = 0; y < rows; y++) {
            let row = [];

            for (let x = 0; x < cols; x++) {
                let img = new Image();
                img.draggable = false;

                img.src = "Empty.svg";
                img.classList.add("Empty", "border");

                row.push(0);

                img.dataset.y = y;
                img.dataset.x = x;
                grid.appendChild(img);
            }

            mapMatrix.push(row);
        }
    }
}


//Cool feature to store maps inside the links :) Needed to remove this and add DB method, because the links were too long 
function exportMap() {
    if (!mapMatrix || mapMatrix.length === 0) {
        alert("Please generate or load a map first!");
        return;
    }

    const map = {
        x: mapMatrix[0].length,
        y: mapMatrix.length,
        mapTales: mapMatrix
    };

    let mapJSON = JSON.stringify(map);
    let mapEncoded = btoa(mapJSON);

    let shareableURL = `${window.location.origin}${window.location.pathname}?map=${mapEncoded}`;
    navigator.clipboard.writeText(shareableURL);
    alert("Map link copied to clipboard!");
}

function loadMapFromURL() {
    let urlParams = new URLSearchParams(window.location.search);
    let mapParam = urlParams.get("map");

    if (!mapParam) return false;

    try {
        let jsonString = atob(mapParam);
        let mapData = JSON.parse(jsonString);

        if (mapData && mapData.mapTales) {
            buildGridFromMatrix(mapData.mapTales);
            return true;
        }
    } catch (e) {
        console.error("Invalid map link in URL", e);
    }
    return false;
}

function buildGridFromMatrix(matrix) {
    resetRockState();
    grid.innerHTML = "";

    let targetY = matrix.length;
    let targetX = matrix[0].length;

    grid.style.setProperty("--cols", targetX);
    grid.style.setProperty("--rows", targetY);
    rakuDirection = 0;
    mapMatrix = matrix;
    rakuPlaced = false;
    rakuCoordinates = "none";

    for (let y = 0; y < targetY; y++) {
        for (let x = 0; x < targetX; x++) {
            let img = new Image();
            img.draggable = false;
            let tileValue = matrix[y][x];

            if (tileValue === -1) {
                img.src = "Wall.svg";
                img.classList.add("Wall");
            } else if (tileValue === 2) {
                img.src = "Raku.svg";
                img.classList.add("Raku");
                rakuPlaced = true;
                rakuCoordinates = `${x},${y}`;
            } else {
                img.src = "Empty.svg";
                img.classList.add("Empty");
            }

            img.style.width = "2vw";
            img.dataset.y = y;
            img.dataset.x = x;
            img.classList.add("border");
            grid.appendChild(img);
        }
    }
}

window.addEventListener("DOMContentLoaded", () => {
    if (!loadMapFromURL()) {
        mapCreate(8, 8);
    }

    loadNews();
    loadStats();
    loadCommunityMaps();
    loadLeaderboard('longest_route');
});

//Algorithm of generating the map
function mapCreate(targetX, targetY) {
    resetRockState();
    grid.innerHTML = "";
    grid.style.setProperty("--cols", targetX);
    grid.style.setProperty("--rows", targetY);
    rakuDirection = 0;
    mapMatrix = [];

    for (let y = 0; y < targetY; y++) {
        let row = [];

        for (let x = 0; x < targetX; x++) {
            let img = new Image();
            img.draggable = false;
            let oneOrZero = Math.random() > 0.5 ? 1 : 0;

            img.src = oneOrZero === 1 ? "Wall.svg" : "Empty.svg";
            img.classList.add(oneOrZero === 1 ? "Wall" : "Empty");

            let tileValue = oneOrZero === 1 ? -1 : 0;
            row.push(tileValue);

            img.dataset.y = y;
            img.dataset.x = x;
            img.classList.add("border");
            grid.appendChild(img);
        }

        mapMatrix.push(row);
    }

    rakuPlaced = false;
    console.log("Map Created:", mapMatrix);
}

//Code execution logic

async function forward(steps) {
    if (rakuCoordinates === "none") return;

    steps = parseInt(steps, 10) || 1;

    console.log("Moving forward", steps);

    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const maxRows = mapMatrix.length;
    const maxCols = mapMatrix[0].length;

    for (let index = 0; index < steps; index++) {
        let [currentX, currentY] = rakuCoordinates.split(",").map(Number);
        let nextX = currentX;
        let nextY = currentY;

        if (rakuDirection === 0) nextY++;
        else if (rakuDirection === 1) nextX--;
        else if (rakuDirection === 2) nextY--;
        else if (rakuDirection === 3) nextX++;

        if (nextX < 0 || nextX >= maxCols || nextY < 0 || nextY >= maxRows) {
            console.log("Raku hit the edge of the map!");
            break;
        }

        let newElement = grid.querySelector(`img[data-x="${nextX}"][data-y="${nextY}"]`);

        if (newElement && newElement.classList.contains("Wall")) {
            console.log("There is a wall in front of Raku");
            break;
        }

        let oldElement = grid.querySelector(`img[data-x="${currentX}"][data-y="${currentY}"]`);

        mapMatrix[currentY][currentX] = 0;
        mapMatrix[nextY][nextX] = 2;
        rakuCoordinates = `${nextX},${nextY}`;

        oldElement.classList.remove("Raku");
        oldElement.classList.add("Empty");
        oldElement.style.transform = "";
        renderTile(currentX, currentY);

        newElement.classList.remove("Empty");
        newElement.classList.add("Raku");
        newElement.src = "Raku.svg";
        newElement.style.transform = `rotate(${rakuDirection * 90}deg)`;

        await delay(speed);
    }
}

function right() {
    if (rakuCoordinates === "none") return;

    rakuDirection = (rakuDirection + 1) % 4;
    rotateRakuSprite();
}

function left() {
    if (rakuCoordinates === "none") return;

    rakuDirection = (rakuDirection + 3) % 4;
    rotateRakuSprite();
}

function rotateRakuSprite() {
    let [currentX, currentY] = rakuCoordinates.split(",").map(Number);
    let element = grid.querySelector(`img[data-x="${currentX}"][data-y="${currentY}"]`);
    if (element) {
        element.style.transform = `rotate(${rakuDirection * 90}deg)`;
    }
}

function whereIsRakuMode() {
    if (!rakuPlaced) {
        alert("Raku is not placed!!!");
        return;
    }

    let [currentX, currentY] = rakuCoordinates.split(",").map(Number);
    let whereIsRaku = grid.querySelector(`img[data-x="${currentX}"][data-y="${currentY}"]`);

    if (whereIsRaku) {
        whereIsRaku.style.transform = `rotate(${rakuDirection * 90}deg) scale(1.6)`;
        whereIsRaku.style.zIndex = "10";
        whereIsRaku.style.transition = "transform 0.3s ease";

        setTimeout(() => {
            whereIsRaku.style.transform = `rotate(${rakuDirection * 90}deg)`;
            whereIsRaku.style.zIndex = "1";
        }, 1500);
    }
}

function getHowFarFromMe() {
    if (rakuCoordinates === "none") return 0;

    let [currentX, currentY] = rakuCoordinates.split(",").map(Number);
    let steps = 0;
    let maxRows = mapMatrix.length;
    let maxCols = mapMatrix[0].length;

    while (true) {
        if (rakuDirection === 0) currentY++;
        else if (rakuDirection === 1) currentX--;
        else if (rakuDirection === 2) currentY--;
        else if (rakuDirection === 3) currentX++;

        if (currentX < 0 || currentX >= maxCols || currentY < 0 || currentY >= maxRows) {
            break;
        }

        if (mapMatrix[currentY][currentX] === -1) {
            break;
        }

        steps++;
    }

    return steps;
}

async function ifSituation(conditionStr, codeInside) {
    let evalCondition = conditionStr;

    if (evalCondition.includes("HowFarFromMe")) {
        let distance = getHowFarFromMe();
        evalCondition = evalCondition.replace(/HowFarFromMe(\(\))?/g, distance);
    }

    const visibleVars = getVisibleVars();
    for (let varName in visibleVars) {
        let regexVar = new RegExp(`\\b${varName}\\b`, "g");
        evalCondition = evalCondition.replace(regexVar, visibleVars[varName]);
    }

    let conditionMet = false;
    try {
        conditionMet = Boolean(Function(`"use strict"; return (${evalCondition})`)());
    } catch (e) {
        console.error(`Error evaluating condition: "${conditionStr}" -> "${evalCondition}"`);
        return;
    }

    if (conditionMet && codeInside.trim()) {
        await codeExecution(codeInside.trim());
    }
}

async function forSituation(cycles, variableName, codeInside) {
    const parts = cycles.split(";").map(s => s.trim());
    if (parts.length < 3) {
        console.error("Invalid for loop syntax inside parentheses:", cycles);
        return;
    }

    const startMatch = parts[0].match(/=\s*(-?\d+)/);
    let startVal = startMatch ? parseInt(startMatch[1], 10) : 0;

    const condMatch = parts[1].match(/([<>=!]+)\s*(-?\d+)/);
    let op = condMatch ? condMatch[1] : "<";
    let limit = condMatch ? parseInt(condMatch[2], 10) : 0;

    let stepStr = parts[2];

    const checkCondition = (val) => {
        switch (op) {
            case "<":  return val < limit;
            case "<=": return val <= limit;
            case ">":  return val > limit;
            case ">=": return val >= limit;
            case "==": return val === limit;
            case "!=": return val !== limit;
            default:   return false;
        }
    };

    const applyStep = (val) => {
        if (stepStr.includes("++")) return val + 1;
        if (stepStr.includes("--")) return val - 1;
        if (stepStr.includes("+=")) {
            const num = stepStr.match(/\+=\s*(\d+)/);
            return val + (num ? parseInt(num[1], 10) : 1);
        }
        if (stepStr.includes("-=")) {
            const num = stepStr.match(/-=\s*(\d+)/);
            return val - (num ? parseInt(num[1], 10) : 1);
        }
        return val + 1;
    };

    scopeStack.push({});
    try {
        for (let i = startVal; checkCondition(i); i = applyStep(i)) {
            setVar(variableName, i);
            await codeExecution(codeInside);
        }
    } finally {
        scopeStack.pop();
    }
}

function rocksSituation(color, amountArg) {
    let amount;
    const resolved = getVar(amountArg);

    if (resolved !== undefined) {
        amount = resolved;
    } else if (!isNaN(amountArg)) {
        amount = parseInt(amountArg, 10);
    } else {
        amount = 0;
    }

    if (rockInventory[color] === undefined) {
        console.error(`color "${color}" does not exist`);
        return;
    }

    rockInventory[color] += amount;
    console.log(`Rocks: red=${rockInventory.red} green=${rockInventory.green} blue=${rockInventory.blue}`);
}

function placeSituation(color) {
    if (rakuCoordinates === "none") {
        console.error("Raku is not placed — nothing to place a rock under.");
        return;
    }

    if (rockInventory[color] === undefined) {
        console.error(`color "${color}" does not exist`);
        return;
    }

    if (rockInventory[color] <= 0) {
        console.error(`No ${color} rocks left in inventory.`);
        return;
    }

    rockInventory[color]--;

    let [currentX, currentY] = rakuCoordinates.split(",").map(Number);
    rockMap[`${currentX},${currentY}`] = color;

    renderTile(currentX, currentY);
}

function renderTile(x, y) {
    const cell = grid.querySelector(`img[data-x="${x}"][data-y="${y}"]`);
    if (!cell) return;

    if (cell.classList.contains("Raku") || cell.classList.contains("Wall")) return;

    const rock = rockMap[`${x},${y}`];

    if (rock) {
        cell.src = rockSprites[rock];
        cell.style.backgroundColor = "white";
    } else {
        cell.src = "Empty.svg";
        cell.style.backgroundColor = "";
    }
}

function defineFunction(name, param, codeInside) {
    userFunctions[name] = { param, body: codeInside };
    console.log(`Defined function: ${name}(${param || ""})`);
}

let callDepth = 0;
const MAX_CALL_DEPTH = 100;

async function callFunction(name, argStr) {
    const def = userFunctions[name];

    if (!def) {
        console.error(`Unknown function: "${name}"`);
        return;
    }

    if (callDepth >= MAX_CALL_DEPTH) {
        console.error(`Call to "${name}" stopped — max recursion depth (${MAX_CALL_DEPTH}) exceeded.`);
        return;
    }

    let argValue = argStr.trim().replace(/^["']|["']$/g, "");
    if (argValue !== "") {
        const resolved = getVar(argValue);
        if (resolved !== undefined) {
            argValue = resolved;
        } else if (!isNaN(argValue)) {
            argValue = parseFloat(argValue);
        }
    }

    scopeStack.push({});
    if (def.param) {
        setVar(def.param, argValue);
    }

    callDepth++;
    try {
        await codeExecution(def.body);
    } finally {
        callDepth--;
        scopeStack.pop();
    }
}

function splitIntoCommands(code) {
    const commands = [];
    let buffer = "";
    let depth = 0;
    let sawBrace = false;

    for (let i = 0; i < code.length; i++) {
        const ch = code[i];

        if (ch === "\n" && depth === 0) {
            const t = buffer.trim();
            if (t) commands.push(t);
            buffer = "";
            sawBrace = false;
            continue;
        }

        buffer += ch;

        if (ch === "{") {
            depth++;
            sawBrace = true;
        } else if (ch === "}") {
            depth--;
            if (depth === 0 && sawBrace) {
                const t = buffer.trim();
                if (t) commands.push(t); 
                buffer = "";
                sawBrace = false;
            }
        }
    }

    const t = buffer.trim();
    if (t) commands.push(t);

    return commands;
}

async function codeExecution(code) {
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const commands = splitIntoCommands(code);

    for (let trimmed of commands) {
        trimmed = trimmed.replace(/;$/, "").trim();
        const head = firstToken(trimmed);

        if (head === "variable") {
            let cleanCommand = trimmed.replace(/;$/, "");

            const regex = /^variable\s+["']?([^"'\s=]+)["']?\s*=\s*(?:"([^"]*)"|'([^']*)'|(-?\d+(?:\.\d+)?))$/;
            const match = cleanCommand.match(regex);

            if (match) {
                const varName = match[1];
                const rawStringVal = match[2] !== undefined ? match[2] : match[3];
                const varValue = rawStringVal !== undefined ? rawStringVal : parseFloat(match[4]);

                setVar(varName, varValue);
                console.log(`Stored variable: ${varName} =`, varValue);
            } else {
                console.error(`Syntax error in command: ${trimmed}`);
            }
        } else if (head === "forward") {
            let match = trimmed.match(/^forward\(\s*([^)]+)\s*\)$/);
            let steps = 1;

            if (match) {
                let arg = match[1].trim().replace(/^["']|["']$/g, "");
                let resolved = getVar(arg);

                if (resolved === undefined) {
                    const visible = getVisibleVars();
                    const key = Object.keys(visible).find((k) => k.toLowerCase() === arg.toLowerCase());
                    if (key !== undefined) resolved = visible[key];
                }

                if (resolved !== undefined) {
                    steps = resolved;
                } else if (!isNaN(arg)) {
                    steps = parseInt(arg, 10);
                }
            } else {
                console.error(`Syntax error in command: ${trimmed}`);
            }

            await forward(steps);
        } else if (head === "right") {
            if (/^right\s*\(\s*\)$/.test(trimmed)) {
                right();
            } else {
                console.error(`Syntax error in command: ${trimmed}`);
            }
        } else if (head === "left") {
            if (/^left\s*\(\s*\)$/.test(trimmed)) {
                left();
            } else {
                console.error(`Syntax error in command: ${trimmed}`);
            }
        } else if (head === "if") {
            const regex = /^if\s*\((.*?)\)\s*\{([\s\S]*)\}$/;
            const match = trimmed.match(regex);

            if (match) {
                const conditionStr = match[1].trim();
                const codeInside = match[2].trim();

                await ifSituation(conditionStr, codeInside);
            } else {
                console.error(`Syntax error in command: ${trimmed}`);
            }
        } else if (head === "for") {
            let cleanFor = trimmed.replace(/;$/, "");
            
            const regex = /^for\s*\(\s*([a-zA-Z_]\w*)\s*=[^;]+;[^;]+;[^)]+\)\s*\{([\s\S]*)\}$/;
            const match = cleanFor.match(regex);

            if (match) {
                const variableName = match[1].trim(); 
                
                const insideParensMatch = cleanFor.match(/^for\s*\(([^)]+)\)/);
                const cycles = insideParensMatch ? insideParensMatch[1] : "";
                
                const codeInside = match[2].trim();

                await forSituation(cycles, variableName, codeInside);
            } else {
                console.error(`Syntax error in command: ${trimmed}`);
            }
        } else if (head === "while") {
            console.error(`while loops are not implemented yet: "${trimmed}"`);
        } else if (head === "HowFarFromMe") {
            const distance = getHowFarFromMe();
            console.log("HowFarFromMe:", distance);
        } else if (head === "function") {
            const regex = /^function\s+([a-zA-Z_]\w*)\s*\(\s*([a-zA-Z_]\w*)?\s*\)\s*\{([\s\S]*)\}$/;
            const match = trimmed.match(regex);

            if (match) {
                const name = match[1].trim();
                const param = match[2] ? match[2].trim() : null;
                const codeInside = match[3].trim();

                defineFunction(name, param, codeInside);
            } else {
                console.error(`Syntax error in command: ${trimmed}`);
            }
        } else if (head === "rocks") {
            const regex = /^rocks\.(\w+)\(\s*([^)]+)\s*\)$/;
            const match = trimmed.match(regex);

            if (match) {
                const color = match[1].trim();
                const amountArg = match[2].trim().replace(/^["']|["']$/g, "");

                rocksSituation(color, amountArg);
            } else {
                console.error(`Syntax error in command: ${trimmed}`);
            }
        } else if (head === "place") {
            const regex = /^place\.(\w+)\(\s*\)$/;
            const match = trimmed.match(regex);

            if (match) {
                const color = match[1].trim();

                placeSituation(color);
            } else {
                console.error(`Syntax error in command: ${trimmed}`);
            }
        } else {
            const callRegex = /^([a-zA-Z_]\w*)\s*\(\s*([^)]*)\s*\)$/;
            const callMatch = trimmed.match(callRegex);

            if (callMatch && userFunctions[callMatch[1]]) {
                await callFunction(callMatch[1], callMatch[2]);
            } else {
                console.error(`Unknown command: "${trimmed}"`);
            }
        }

        await delay(speed);
    }
}


//DB load logic
async function loadNews() {
    const { data, error } = await supabaseClient
        .from('news_posts')
        .select('title, body, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) { console.error(error); return; }

    const container = document.getElementById('newsFeed');
    if (container && data) {
        container.innerHTML = data.map(post => `
            <article class="news-item">
                <h3>${post.title}</h3>
                <time>${new Date(post.created_at).toLocaleDateString()}</time>
                <p>${post.body}</p>
            </article>
        `).join('');
    }
}

async function loadLeaderboard(category = 'longest_route') {
    const { data, error } = await supabaseClient
        .from('leaderboard_entries')
        .select('player_name, score, created_at')
        .eq('category', category)
        .order('score', { ascending: false })
        .limit(10);

    if (error) { console.error(error); return; }

    const container = document.getElementById('leaderboardList');
    if (container && data) {
        if (data.length === 0) {
            container.innerHTML = `<p>No scores yet!</p>`;
            return;
        }
        container.innerHTML = data.map((entry, index) => `
            <div class="leaderboard-item">
                <span>#${index + 1} <strong>${entry.player_name || 'Anonymous'}</strong></span>
                <span>${entry.score} pts</span>
            </div>
        `).join('');
    }
}

async function submitScore(playerName, category, score, mapId = null) {
    await supabaseClient.from('leaderboard_entries').insert({
        player_name: playerName, category, score, map_id: mapId
    });

    await supabaseClient.rpc('increment_stat', { stat_name: 'total_leaderboard_entries' });
    loadLeaderboard(category);
}

async function shareMapToCommunity(title, authorName) {
    if (!mapMatrix || mapMatrix.length === 0) {
        alert("Please generate or load a map first!");
        return;
    }

    const { data, error } = await supabaseClient.from('community_maps').insert({
        title: title,
        author_name: authorName,
        map_data: { x: mapMatrix[0].length, y: mapMatrix.length, mapTales: mapMatrix },
        cols: mapMatrix[0].length,
        rows: mapMatrix.length
    }).select('id').single();

    if (error) { console.error(error); return; }

    await supabaseClient.rpc('increment_stat', { stat_name: 'total_maps_created' });
    alert("Map shared to community!");
    loadCommunityMaps();
}

async function loadCommunityMaps() {
    const { data, error } = await supabaseClient
        .from('community_maps')
        .select('id, title, author_name, likes, plays, cols, rows, map_data')
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) { console.error(error); return; }

    const container = document.getElementById('communityMapsGallery');
    if (container && data) {
        if (data.length === 0) {
            container.innerHTML = `<p>No maps shared yet!</p>`;
            return;
        }
        container.innerHTML = data.map(map => `
            <div class="map-card" onclick="buildGridFromMatrix(${JSON.stringify(map.map_data.mapTales).replace(/"/g, '&quot;')})">
                <h4>${escapeHTML(map.title)}</h4>
                <small>By: ${escapeHTML(map.author_name || 'Anonymous')} (${map.cols}x${map.rows})</small>
            </div>
        `).join('');
    }
}

async function loadStats() {
    const { data: stats, error: statsErr } = await supabaseClient.from('site_stats').select('*').single();

    const { count: mapCount, error: countErr } = await supabaseClient
        .from('community_maps')
        .select('*', { count: 'exact', head: true });

    if (statsErr) console.error(statsErr);
    if (countErr) console.error(countErr);

    if (stats) {
        if (document.getElementById('statMapsCreated')) {
            document.getElementById('statMapsCreated').textContent = stats.total_maps_created;
        }
        if (document.getElementById('statScriptsRun')) {
            document.getElementById('statScriptsRun').textContent = stats.total_scripts_run;
        }
    }
    if (mapCount !== null && document.getElementById('statCommunityMaps')) {
        document.getElementById('statCommunityMaps').textContent = mapCount;
    }
}

//Javascript injection measures
function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g,
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}
