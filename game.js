document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const startPlayerEl = document.getElementById('start-player');
    const endPlayerEl = document.getElementById('end-player');
    const pathListEl = document.getElementById('path-list');
    const playerInputEl = document.getElementById('player-input');
    const playerDatalistEl = document.getElementById('player-datalist');
    const addStepButton = document.getElementById('add-step-button');
    const resetButton = document.getElementById('reset-button');
    const messageEl = document.getElementById('message');
    const showAnswerButton = document.getElementById('show-answer-button');
    const answerDisplayEl = document.getElementById('answer-display');
    const answerListEl = document.getElementById('answer-list');
    const dataYearsEl = document.getElementById('data-years');
    const minGamesSelectEl = document.getElementById('min-games-select');
    const startYearSelectEl = document.getElementById('start-year-select');
    const endYearSelectEl = document.getElementById('end-year-select');
    const showHintButton = document.getElementById('show-hint-button');
    const hintDisplayEl = document.getElementById('hint-display');
    const hintContentEl = document.getElementById('hint-content');

    // --- Game State ---
    let rawAllMatchesData = null;
    let globalPlayerGameCounts = {};
    let globalAdjacencyList = {};
    let globalAllPlayers = new Set();
    let playerYearMap = {};
    let playerTeamYearMap = {};
    let currentPath = [];
    let startPlayer = null;
    let endPlayer = null;
    let shortestPath = null; // Cache for the current game pair
    let minDataYear = Infinity;
    let maxDataYear = -Infinity;
    let isDataProcessed = false;

    // --- Utility Functions ---
    function showMessage(text, type = 'info', duration = null) {
        if (!messageEl) return;
        // Allow HTML in message text
        messageEl.innerHTML = text; // Use innerHTML instead of textContent
        messageEl.className = `message ${type}`;
        console.log(`Message (${type}): ${text.replace(/<br>/g, ' ')}`); // Log plain text version
        if (duration && typeof duration === 'number') {
            setTimeout(() => {
                // Check if message content is still the same before clearing
                if (messageEl.innerHTML === text) {
                    messageEl.innerHTML = '';
                    messageEl.className = 'message';
                }
            }, duration);
        }
    }

    function disableControls(disabled) {
        if (playerInputEl) playerInputEl.disabled = disabled;
        if (addStepButton) addStepButton.disabled = disabled;
        if (resetButton) resetButton.disabled = disabled;
        if (showAnswerButton) showAnswerButton.disabled = disabled;
        if (showHintButton) showHintButton.disabled = disabled;
        if (minGamesSelectEl) minGamesSelectEl.disabled = disabled;
        if (startYearSelectEl) startYearSelectEl.disabled = disabled;
        if (endYearSelectEl) endYearSelectEl.disabled = disabled;

        if (!disabled && isDataProcessed) {
            if (minGamesSelectEl) minGamesSelectEl.disabled = false;
            if (startYearSelectEl) startYearSelectEl.disabled = false;
            if (endYearSelectEl) endYearSelectEl.disabled = false;
            if (resetButton) resetButton.disabled = false;
            // Enable hint/answer if game is ready
             if (startPlayer && endPlayer) {
                if(showAnswerButton) showAnswerButton.disabled = false;
                if(showHintButton) showHintButton.disabled = false;
             }
        }
        if (!startPlayer || !endPlayer) {
            if (playerInputEl) playerInputEl.disabled = true;
            if (addStepButton) addStepButton.disabled = true;
            if (showAnswerButton) showAnswerButton.disabled = true;
            if (showHintButton) showHintButton.disabled = true;
        }
        if (currentPath.includes(endPlayer)) {
            if (playerInputEl) playerInputEl.disabled = true;
            if (addStepButton) addStepButton.disabled = true;
            // Ensure hint/answer are disabled on win too
            if (showAnswerButton) showAnswerButton.disabled = true;
            if (showHintButton) showHintButton.disabled = true;
        }
    }

    function hideAnswer() {
        if(answerDisplayEl) { answerDisplayEl.style.display = 'none'; answerDisplayEl.classList.remove('visible'); }
        if(answerListEl) answerListEl.innerHTML = '';
    }

    function hideHint() {
         if(hintDisplayEl) { hintDisplayEl.style.display = 'none'; hintDisplayEl.classList.remove('visible'); }
         if(hintContentEl) hintContentEl.innerHTML = '';
    }

    function findConnectingMatch(playerA, playerB) { /* ... same as previous correct version ... */
        if (!playerA || !playerB || !rawAllMatchesData) return null;
        for (const matchId in rawAllMatchesData) {
            const match = rawAllMatchesData[matchId];
            if (match && match.teams) {
                for (const teamName in match.teams) {
                    const players = match.teams[teamName];
                    if (players && Array.isArray(players) && players.length > 0) {
                         if (typeof players[0] === 'object' && players[0] !== null && 'name' in players[0]){
                            const teamPlayerNames = players.map(p => p.name).filter(name => name);
                            const playerAFound = teamPlayerNames.includes(playerA);
                            const playerBFound = teamPlayerNames.includes(playerB);
                            if (playerAFound && playerBFound) {
                                try { const parts = matchId.split('-'); if (parts.length < 4) throw new Error("Format"); const year = parts[0]; let round = parts[1]; let teamStartIndex = 2; if (parts.length > 4 && parts[3] === 'v') teamStartIndex = 2; else if (parts.length > 5 && parts[4] === 'v') { round += '-' + parts[2]; teamStartIndex = 3; } else if (parts.length > 3 && parts[2].toLowerCase().includes('trial')) { round = parts[2]; teamStartIndex = 3; } let teamsStr = parts.slice(teamStartIndex).join('-'); return `(${year} Rd ${round}: ${teamsStr.replace('-v-', ' v ')})`; } catch (e) { return `(Match: ${matchId})`; }
                            }
                         } else { break; }
                    }
                }
            }
        }
        return null;
    }

    // --- Data Loading and Processing ---
    function processFullDataset() { /* ... same as previous correct version ... */
        console.log("Processing full dataset..."); if (!rawAllMatchesData) return false; globalPlayerGameCounts = {}; globalAdjacencyList = {}; globalAllPlayers = new Set(); playerYearMap = {}; playerTeamYearMap = {}; let pCount = 0; let eCount = 0; try { for (const matchId in rawAllMatchesData) { try { const match = rawAllMatchesData[matchId]; if (!match) continue; let matchYear = null; if (typeof match.year === 'number') matchYear = match.year; else { const y = parseInt(matchId.split('-')[0], 10); if (!isNaN(y)) matchYear = y; } if (matchYear === null) continue; pCount++; if (!match.teams || typeof match.teams !== 'object') continue; for (const teamName in match.teams) { const players = match.teams[teamName]; if (!players || !Array.isArray(players)) continue; const teamPlayerNames = players.filter(p => p && typeof p === 'object' && typeof p.name === 'string' && p.name.trim() !== '').map(p => p.name.trim()); if (teamPlayerNames.length === 0 && players.length > 0) continue; teamPlayerNames.forEach(playerName => { globalAllPlayers.add(playerName); globalPlayerGameCounts[playerName] = (globalPlayerGameCounts[playerName] || 0) + 1; if (!playerYearMap[playerName]) playerYearMap[playerName] = new Set(); playerYearMap[playerName].add(matchYear); if (!globalAdjacencyList[playerName]) globalAdjacencyList[playerName] = new Set(); teamPlayerNames.forEach(tn => { if (playerName !== tn) globalAdjacencyList[playerName].add(tn); }); if (!playerTeamYearMap[playerName]) playerTeamYearMap[playerName] = {}; if (!playerTeamYearMap[playerName][teamName] || matchYear < playerTeamYearMap[playerName][teamName]) playerTeamYearMap[playerName][teamName] = matchYear; }); } } catch (innerError) { console.error(`ERROR PROCESSING MATCH ID: ${matchId}`, innerError); eCount++; } } } catch (outerError) { console.error("FATAL ERROR during dataset processing loop:", outerError); isDataProcessed = false; return false; } console.log(`Finished processing. Processed ${pCount} matches with ${eCount} errors.`); if (eCount > 0) showMessage(`Warning: Errors occurred processing ${eCount} matches.`, 'error', 10000); console.log(`Found ${globalAllPlayers.size} unique players overall.`); isDataProcessed = true; return true;
    }

    async function loadRawDataAndProcess() { /* ... same as previous correct version ... */
        if (isDataProcessed) return true; console.log("Loading raw data..."); showMessage('Loading...', 'info'); disableControls(true); try { if (!rawAllMatchesData) { const r = await fetch('data.json'); if (!r.ok) throw new Error(`HTTP ${r.status}`); rawAllMatchesData = await r.json(); console.log(`Loaded data.json.`); if (typeof rawAllMatchesData !== 'object' || !rawAllMatchesData || !Object.keys(rawAllMatchesData).length) throw new Error("Data invalid."); } minDataYear = Infinity; maxDataYear = -Infinity; for (const mId in rawAllMatchesData) { const m = rawAllMatchesData[mId]; let y = null; if (m && typeof m.year === 'number') y = m.year; else if (m) { const yId = parseInt(mId.split('-')[0], 10); if (!isNaN(yId)) y = yId; } if (y !== null) { minDataYear = Math.min(minDataYear, y); maxDataYear = Math.max(maxDataYear, y); } } if (minDataYear === Infinity) throw new Error("No year range."); console.log(`Year range: ${minDataYear}-${maxDataYear}`); if (startYearSelectEl && endYearSelectEl) populateYearSelectors(minDataYear, maxDataYear); else if (dataYearsEl) dataYearsEl.textContent = `${minDataYear} - ${maxDataYear}`; const success = processFullDataset(); if (!success) throw new Error("Data processing failed."); console.log("Data processed."); return true; } catch (error) { console.error('Load/Process Error:', error); showMessage(`Error: ${error.message}. Refresh?`, 'error'); rawAllMatchesData = null; isDataProcessed = false; disableControls(true); if (resetButton) resetButton.disabled = false; return false; }
    }

    function populateYearSelectors(minYear, maxYear) { /* ... same as previous correct version ... */
        if (!startYearSelectEl || !endYearSelectEl) return; startYearSelectEl.innerHTML = ''; endYearSelectEl.innerHTML = ''; const aY = []; if (minYear === Infinity || !minYear || !maxYear) return; for (let y = minYear; y <= maxYear; y++) { aY.push(y); const sO=document.createElement('option'); sO.value=y; sO.textContent=y; startYearSelectEl.appendChild(sO); const eO=document.createElement('option'); eO.value=y; eO.textContent=y; endYearSelectEl.appendChild(eO); } console.log(`Added options ${minYear}-${maxYear}.`); const dSY=2010, dEY=2024; startYearSelectEl.value = aY.includes(dSY)?dSY:minYear; endYearSelectEl.value = aY.includes(dEY)?dEY:maxYear; console.log(`Defaults: ${startYearSelectEl.value}-${endYearSelectEl.value}`);
    }

    function addPlayerStepToDisplay(playerName, connectingMatchInfo, listElement) { /* ... same as previous correct version ... */
        if (!listElement) { console.error("List element missing for display."); return; } try { const li = document.createElement('li'); const nameSpan = document.createElement('span'); nameSpan.textContent = playerName; li.appendChild(nameSpan); if (connectingMatchInfo) { const matchSpan = document.createElement('small'); matchSpan.className = 'match-info'; matchSpan.textContent = `Connected via: ${connectingMatchInfo}`; li.appendChild(matchSpan); } listElement.appendChild(li); } catch (e) { console.error("Error adding player step to display:", e, playerName, connectingMatchInfo); }
    }

    // --- Game Setup ---
    function setupNewGame() { /* ... same as previous correct version ... */
        console.log("Setting up new game..."); hideAnswer(); hideHint(); shortestPath = null; if (playerInputEl) playerInputEl.value = ''; if (!isDataProcessed) { showMessage("Data not processed.", "error"); disableControls(false); return false; } const selMinGames = minGamesSelectEl? parseInt(minGamesSelectEl.value, 10) : 0; const selSY = startYearSelectEl? parseInt(startYearSelectEl.value, 10) : minDataYear; const selEY = endYearSelectEl? parseInt(endYearSelectEl.value, 10) : maxDataYear; if (dataYearsEl) dataYearsEl.textContent = startYearSelectEl ? `${selSY}-${selEY}` : `${minDataYear}-${maxDataYear}`; const elPlayers = []; for (const pName of globalAllPlayers) { if ((globalPlayerGameCounts[pName] || 0) >= selMinGames) { let playedInRange = true; if (startYearSelectEl) { const years = playerYearMap[pName] || new Set(); playedInRange = [...years].some(y => y >= selSY && y <= selEY); } if (playedInRange) elPlayers.push(pName); } } console.log(`Found ${elPlayers.length} eligible players.`); if (elPlayers.length < 2) { showMessage(`Not enough players (${elPlayers.length}). Adjust filters?`, 'error'); startPlayer=null; endPlayer=null; if (startPlayerEl) startPlayerEl.textContent='N/A'; if (endPlayerEl) endPlayerEl.textContent='N/A'; currentPath=[]; if (pathListEl) pathListEl.innerHTML=''; disableControls(false); if (playerInputEl) playerInputEl.disabled=true; if (addStepButton) addStepButton.disabled=true; if (showAnswerButton) showAnswerButton.disabled=true; if (showHintButton) showHintButton.disabled=true; return false; } let sIdx=Math.floor(Math.random()*elPlayers.length); let eIdx; do { eIdx=Math.floor(Math.random()*elPlayers.length); } while (sIdx===eIdx); startPlayer=elPlayers[sIdx]; endPlayer=elPlayers[eIdx]; if (startPlayerEl) startPlayerEl.textContent=startPlayer; if (endPlayerEl) endPlayerEl.textContent=endPlayer; currentPath=[startPlayer]; if (pathListEl) { pathListEl.innerHTML=''; addPlayerStepToDisplay(startPlayer, null, pathListEl); } if (playerDatalistEl) playerDatalistEl.innerHTML=''; globalAllPlayers.forEach(p => { const o=document.createElement('option'); o.value=p; if (playerDatalistEl) playerDatalistEl.appendChild(o); }); console.log(`Populated datalist.`); showMessage(`Game started! Connect ${startPlayer} to ${endPlayer}.`, 'success', 6000); disableControls(false); console.log(`Game ready: ${startPlayer} -> ${endPlayer}`); return true;
    }

    async function initializeGame() { /* ... same as previous correct version ... */
        console.log("Initializing game..."); disableControls(true); showMessage('Loading...', 'info'); hideAnswer(); hideHint(); if(pathListEl) pathListEl.innerHTML=''; if(answerListEl) answerListEl.innerHTML=''; const dataReady = await loadRawDataAndProcess(); if (!dataReady) { if (startPlayerEl) startPlayerEl.textContent='Error'; if (endPlayerEl) endPlayerEl.textContent='Error'; return; } showMessage(`Data ready. Setting up...`, 'info'); setTimeout(setupNewGame, 50);
    }

    // --- Game Logic ---
    function findShortestPath(start, end) { /* ... same as previous correct version ... */
        if (!start || !end || typeof globalAdjacencyList !== 'object' || !globalAdjacencyList[start]) return null; const q = [[start, [start]]]; const v = new Set([start]); while (q.length > 0) { const [curr, p] = q.shift(); if (curr === end) return p; const n = globalAdjacencyList[curr] || new Set(); for (const neighbor of n) { if (!v.has(neighbor)) { v.add(neighbor); const nP = [...p, neighbor]; q.push([neighbor, nP]); } } } return null;
    }


    // --- Added: Helper to Display Shortest Path (Refactored) ---
    function displayShortestPath() {
        if (!startPlayer || !endPlayer || !answerListEl) return null;
        if (!shortestPath) {
             console.log("Calculating shortest path for display...");
             shortestPath = findShortestPath(startPlayer, endPlayer);
        } else { console.log("Using cached shortest path."); }
        answerListEl.innerHTML = '';
        if (shortestPath) {
            for (let i = 0; i < shortestPath.length; i++) {
                const currentPlayer = shortestPath[i]; let connectingMatch = null;
                if (i > 0) connectingMatch = findConnectingMatch(shortestPath[i - 1], currentPlayer);
                addPlayerStepToDisplay(currentPlayer, connectingMatch, answerListEl);
            }
            if (answerDisplayEl) { answerDisplayEl.style.display = 'block'; void answerDisplayEl.offsetWidth; answerDisplayEl.classList.add('visible'); }
            hideHint(); // Hide hint when showing answer
        } else {
            if (answerDisplayEl) { answerDisplayEl.style.display = 'none'; answerDisplayEl.classList.remove('visible'); }
        }
        return shortestPath;
    }
    // --- End Helper ---


    // --- Main Game Logic ---
    // Modified handleAddStep Win Condition
    function handleAddStep() {
        if (!startPlayer || !endPlayer || !playerInputEl || !pathListEl) return;
        const nextPlayerName = playerInputEl.value.trim();
        const lastPlayerName = currentPath[currentPath.length - 1];
        if (!nextPlayerName) { showMessage("Enter player.", "error", 3000); return; }
        if (!globalAllPlayers.has(nextPlayerName)) { showMessage(`"${nextPlayerName}" not found.`, "error", 4000); return; }
        if (currentPath.includes(nextPlayerName)) { showMessage(`"${nextPlayerName}" already in path.`, "error", 3000); return; }

        if (typeof globalAdjacencyList === 'object' && globalAdjacencyList[lastPlayerName]?.has(nextPlayerName)) {
            const connectingMatch = findConnectingMatch(lastPlayerName, nextPlayerName);
            currentPath.push(nextPlayerName);
            addPlayerStepToDisplay(nextPlayerName, connectingMatch, pathListEl);
            playerInputEl.value = ''; hideAnswer(); hideHint();

            // --- Win Condition Logic - Modified ---
            if (nextPlayerName === endPlayer) {
                // 1. Calculate and Display the Shortest Path Answer
                const actualShortestPath = displayShortestPath(); // Use helper

                // 2. Create the Success Message
                let successMsg = `🎉 CONGRATULATIONS! 🎉<br>You connected ${startPlayer} to ${endPlayer} in ${currentPath.length - 1} steps!`;
                if (actualShortestPath) {
                    const shortestSteps = actualShortestPath.length - 1;
                    if (currentPath.length - 1 === shortestSteps) {
                        successMsg += `<br>That's the shortest possible path!`;
                    } else {
                        successMsg += `<br>(Shortest possible path: ${shortestSteps} steps)`;
                    }
                }
                showMessage(successMsg, 'success'); // Show enhanced message

                // 3. Disable Controls (keep settings/reset enabled)
                disableControls(true);
                if(minGamesSelectEl) minGamesSelectEl.disabled = false;
                if(startYearSelectEl) startYearSelectEl.disabled = false;
                if(endYearSelectEl) endYearSelectEl.disabled = false;
                if(resetButton) resetButton.disabled = false;
                // Ensure answer/hint buttons remain disabled on win
                if(showAnswerButton) showAnswerButton.disabled = true;
                if(showHintButton) showHintButton.disabled = true;

            } else {
                 // Normal step message
                 showMessage(`"${nextPlayerName}" added. Find teammate.`, 'info', 3000);
            }
            // --- End Win Condition Logic ---

        } else { showMessage(`"${nextPlayerName}" not teammate of "${lastPlayerName}".`, "error"); }
    }

     // Modified handleShowAnswer to use helper
     function handleShowAnswer() {
         if (!startPlayer || !endPlayer) { showMessage("Game not started.", "error"); return; }
         showMessage("Calculating and showing shortest path...", "info");
         disableControls(true); // Disable controls while showing

         setTimeout(() => {
             const displayedPath = displayShortestPath(); // Use helper

             if(!displayedPath) {
                 showMessage(`Could not find or display a path.`, 'error');
             } else {
                 showMessage(`Shortest path (${displayedPath.length - 1} steps) displayed.`, 'info', 4000);
             }

             // Re-enable controls ONLY if game not won
             if (!currentPath.includes(endPlayer)) {
                 disableControls(false);
             } else {
                  // If game already won, keep controls disabled except settings/reset
                 if(playerInputEl) playerInputEl.disabled = true;
                 if(addStepButton) addStepButton.disabled = true;
                 if(showAnswerButton) showAnswerButton.disabled = true; // Keep disabled
                 if(showHintButton) showHintButton.disabled = true;   // Keep disabled
                 if(minGamesSelectEl) minGamesSelectEl.disabled = false;
                 if(startYearSelectEl) startYearSelectEl.disabled = false;
                 if(endYearSelectEl) endYearSelectEl.disabled = false;
                 if(resetButton) resetButton.disabled = false;
             }
         }, 50);
     }

    function handleShowHint() { /* ... as before ... */
        if (!startPlayer || !endPlayer || !hintContentEl || !playerTeamYearMap) { showMessage("Hint unavailable.", "error"); return; } let hintHTML = ''; const sPT = playerTeamYearMap[startPlayer]; hintHTML += `<p><strong>${startPlayer}:</strong></p><ul>`; if (sPT && Object.keys(sPT).length > 0) { const s = Object.entries(sPT).sort((a, b) => a[0].localeCompare(b[0])); s.forEach(([t, y]) => { hintHTML += `<li>${t} (First: ${y})</li>`; }); } else { hintHTML += `<li>No team data.</li>`; } hintHTML += `</ul>`; const ePT = playerTeamYearMap[endPlayer]; hintHTML += `<p><strong>${endPlayer}:</strong></p><ul>`; if (ePT && Object.keys(ePT).length > 0) { const s = Object.entries(ePT).sort((a, b) => a[0].localeCompare(b[0])); s.forEach(([t, y]) => { hintHTML += `<li>${t} (First: ${y})</li>`; }); } else { hintHTML += `<li>No team data.</li>`; } hintHTML += `</ul>`; hintContentEl.innerHTML = hintHTML; if(hintDisplayEl) { hintDisplayEl.style.display = 'block'; void hintDisplayEl.offsetWidth; hintDisplayEl.classList.add('visible'); } hideAnswer(); showMessage("Hints.", "info", 3000);
    }

    // Event handlers remain the same
    function handleMinGamesChange() { initializeGame(); }
    function handleYearChange() { if (!startYearSelectEl || !endYearSelectEl) return; const sY = parseInt(startYearSelectEl.value, 10); const eY = parseInt(endYearSelectEl.value, 10); if (isNaN(sY) || isNaN(eY)) { showMessage("Invalid year.", "error"); return; } if (sY > eY) { showMessage("Start > end.", "error", 4000); endYearSelectEl.value = sY; return; } initializeGame(); }

    // --- Event Listeners ---
    // ... (as before) ...
    if (addStepButton) addStepButton.addEventListener('click', handleAddStep); else console.error("Missing: add-step-button");
    if (resetButton) resetButton.addEventListener('click', initializeGame); else console.error("Missing: reset-button");
    if (showAnswerButton) showAnswerButton.addEventListener('click', handleShowAnswer); else console.error("Missing: show-answer-button");
    if (showHintButton) showHintButton.addEventListener('click', handleShowHint); else console.error("Missing: show-hint-button");
    if (minGamesSelectEl) minGamesSelectEl.addEventListener('change', handleMinGamesChange); else console.error("Missing: min-games-select");
    if (startYearSelectEl) startYearSelectEl.addEventListener('change', handleYearChange); else console.log("Missing: start-year-select listener");
    if (endYearSelectEl) endYearSelectEl.addEventListener('change', handleYearChange); else console.log("Missing: end-year-select listener");
    if (playerInputEl) { playerInputEl.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); if (addStepButton && !addStepButton.disabled) handleAddStep(); } }); } else { console.error("Missing: player-input"); }


    // --- Initial Load ---
    initializeGame();

}); // End DOMContentLoaded