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
    let playerTeamYearMap = {}; // Added for hints
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
        messageEl.innerHTML = text; // Use innerHTML for HTML content
        messageEl.className = `message ${type}`; // Apply class for styling
        console.log(`Message (${type}): ${text.replace(/<br>|<[^>]+>/g, ' ')}`); // Log plain text version
        // Clear message after duration if provided
        if (duration && typeof duration === 'number') {
            setTimeout(() => {
                if (messageEl.innerHTML === text) { // Avoid clearing newer messages
                    messageEl.innerHTML = '';
                    messageEl.className = 'message';
                }
            }, duration);
        }
    }

    function disableControls(disabled) {
        // Initial disabling based on the 'disabled' flag
        if (playerInputEl) playerInputEl.disabled = disabled;
        if (addStepButton) addStepButton.disabled = disabled;
        if (resetButton) resetButton.disabled = disabled;
        if (showAnswerButton) showAnswerButton.disabled = disabled;
        if (showHintButton) showHintButton.disabled = disabled;
        if (minGamesSelectEl) minGamesSelectEl.disabled = disabled;
        if (startYearSelectEl) startYearSelectEl.disabled = disabled;
        if (endYearSelectEl) endYearSelectEl.disabled = disabled;

        // --- Refined Re-enabling Logic ---
        if (!disabled && isDataProcessed) {
            // Settings and Reset are generally available once data is processed
            if (minGamesSelectEl) minGamesSelectEl.disabled = false;
            if (startYearSelectEl) startYearSelectEl.disabled = false;
            if (endYearSelectEl) endYearSelectEl.disabled = false;
            if (resetButton) resetButton.disabled = false;

            // Game-specific controls depend on having a start/end player AND game not being won
            if (startPlayer && endPlayer) {
                const gameWon = currentPath.includes(endPlayer);

                if (!gameWon) {
                    // Game is active and running: Enable input, add, hint, answer
                    if (playerInputEl) playerInputEl.disabled = false;
                    if (addStepButton) addStepButton.disabled = false;
                    if (showAnswerButton) showAnswerButton.disabled = false;
                    if (showHintButton) showHintButton.disabled = false;
                } else {
                    // Game is won: Keep input, add, hint, answer disabled
                    if (playerInputEl) playerInputEl.disabled = true;
                    if (addStepButton) addStepButton.disabled = true;
                    if (showAnswerButton) showAnswerButton.disabled = true;
                    if (showHintButton) showHintButton.disabled = true;
                }
            } else {
                // No game loaded (start/end players not set): Keep input, add, hint, answer disabled
                if (playerInputEl) playerInputEl.disabled = true;
                if (addStepButton) addStepButton.disabled = true;
                if (showAnswerButton) showAnswerButton.disabled = true;
                if (showHintButton) showHintButton.disabled = true;
            }
        } else if (disabled) {
             // If explicitly disabling, ensure all relevant controls are off
             // This covers the initial state and errors during load/setup
            if (playerInputEl) playerInputEl.disabled = true;
            if (addStepButton) addStepButton.disabled = true;
            if (showAnswerButton) showAnswerButton.disabled = true;
            if (showHintButton) showHintButton.disabled = true;
            // Allow reset even if general disable is called (e.g., on error)
             if (resetButton && isDataProcessed) resetButton.disabled = false; // Keep reset enabled if data is there
             else if (resetButton) resetButton.disabled = !isDataProcessed; // Disable reset if data isn't even processed
        }
    } // End disableControls


    function hideAnswer() {
        if (answerDisplayEl) {
            answerDisplayEl.style.display = 'none';
            answerDisplayEl.classList.remove('visible');
        }
        // We don't clear the list here anymore, displayShortestPath handles it
    }

    function hideHint() {
        if (hintDisplayEl) {
            hintDisplayEl.style.display = 'none';
            hintDisplayEl.classList.remove('visible');
        }
        if (hintContentEl) hintContentEl.innerHTML = ''; // Clear content when hiding
    }

    function findConnectingMatch(playerA, playerB) {
        // (Keep the robust version from previous steps)
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
                                try {
                                    const parts = matchId.split('-');
                                    if (parts.length < 4) throw new Error("Match ID format unexpected");
                                    const year = parts[0]; let round = parts[1]; let teamStartIndex = 2;
                                    if (parts.length > 4 && parts[3] === 'v') { teamStartIndex = 2; }
                                    else if (parts.length > 5 && parts[4] === 'v') { round += '-' + parts[2]; teamStartIndex = 3; }
                                    else if (parts.length > 3 && parts[2].toLowerCase().includes('trial')) { round = parts[2]; teamStartIndex = 3; }
                                    let teamsStr = parts.slice(teamStartIndex).join('-');
                                    return `(${year} Rd ${round}: ${teamsStr.replace('-v-', ' v ')})`;
                                } catch (e) { console.warn("Could not parse match ID:", matchId, e); return `(Match: ${matchId})`; }
                            }
                         } else { break; } // Invalid player data structure
                    }
                }
            }
        }
        return null; // No connecting match found
    }

    // --- Data Loading and Processing ---
    function processFullDataset() {
        // (Keep the robust version from previous steps)
        console.log("Processing full dataset...");
        if (!rawAllMatchesData) { console.error("Raw data not loaded."); return false; }
        globalPlayerGameCounts = {}; globalAdjacencyList = {}; globalAllPlayers = new Set();
        playerYearMap = {}; playerTeamYearMap = {}; let processedCount = 0; let errorCount = 0;
        try {
            for (const matchId in rawAllMatchesData) {
                try {
                    const match = rawAllMatchesData[matchId]; if (!match) continue;
                    let matchYear = null;
                    if (typeof match.year === 'number') matchYear = match.year;
                    else { const y = parseInt(matchId.split('-')[0], 10); if (!isNaN(y)) matchYear = y; }
                    if (matchYear === null) continue;
                    if (!match.teams || typeof match.teams !== 'object') continue;
                    for (const teamName in match.teams) {
                        const players = match.teams[teamName]; if (!players || !Array.isArray(players)) continue;
                        const teamPlayerNames = players.filter(p => p && typeof p === 'object' && typeof p.name === 'string' && p.name.trim() !== '').map(p => p.name.trim());
                        if (teamPlayerNames.length === 0 && players.length > 0) continue;
                        teamPlayerNames.forEach(playerName => {
                            globalAllPlayers.add(playerName);
                            globalPlayerGameCounts[playerName] = (globalPlayerGameCounts[playerName] || 0) + 1;
                            if (!playerYearMap[playerName]) playerYearMap[playerName] = new Set();
                            playerYearMap[playerName].add(matchYear);
                            if (!globalAdjacencyList[playerName]) globalAdjacencyList[playerName] = new Set();
                            teamPlayerNames.forEach(tn => { if (playerName !== tn) globalAdjacencyList[playerName].add(tn); });
                            if (!playerTeamYearMap[playerName]) playerTeamYearMap[playerName] = {};
                            if (!playerTeamYearMap[playerName][teamName] || matchYear < playerTeamYearMap[playerName][teamName]) {
                                playerTeamYearMap[playerName][teamName] = matchYear;
                            }
                        });
                    }
                    processedCount++;
                } catch (innerError) { console.error(`ERROR PROCESSING MATCH ID: ${matchId}`, innerError); errorCount++; }
            }
        } catch (outerError) { console.error("FATAL ERROR during dataset processing loop:", outerError); isDataProcessed = false; return false; }
        console.log(`Finished processing. Processed ${processedCount} matches with ${errorCount} errors.`);
        if (errorCount > 0) showMessage(`Warning: Errors occurred processing ${errorCount} matches.`, 'error', 10000);
        console.log(`Found ${globalAllPlayers.size} unique players overall.`); isDataProcessed = true; return true;
    }

    async function loadRawDataAndProcess() {
         // (Keep the robust version from previous steps)
        if (isDataProcessed) return true;
        console.log("Loading raw data..."); showMessage('Loading and processing player data...', 'info'); disableControls(true);
        try {
            if (!rawAllMatchesData) {
                const r = await fetch('data.json'); if (!r.ok) throw new Error(`HTTP error: ${r.status}`);
                rawAllMatchesData = await r.json(); console.log(`Loaded data.json.`);
                if (typeof rawAllMatchesData !== 'object' || !rawAllMatchesData || !Object.keys(rawAllMatchesData).length) throw new Error("Data invalid.");
            }
             minDataYear = Infinity; maxDataYear = -Infinity;
             for (const mId in rawAllMatchesData) {
                const m = rawAllMatchesData[mId]; let y = null;
                 if (m && typeof m.year === 'number') y = m.year;
                 else if (m) { const yId = parseInt(mId.split('-')[0], 10); if (!isNaN(yId)) y = yId; }
                 if (y !== null) { minDataYear = Math.min(minDataYear, y); maxDataYear = Math.max(maxDataYear, y); }
             }
             if (minDataYear === Infinity) throw new Error("No year range.");
             console.log(`Year range: ${minDataYear}-${maxDataYear}`);
             if (startYearSelectEl && endYearSelectEl) populateYearSelectors(minDataYear, maxDataYear);
             else if (dataYearsEl) dataYearsEl.textContent = `${minDataYear} - ${maxDataYear}`;
             const success = processFullDataset(); if (!success) throw new Error("Data processing failed.");
             console.log("Data processed."); return true;
        } catch (error) {
            console.error('Load/Process Error:', error); showMessage(`Error: ${error.message}. Refresh?`, 'error');
            rawAllMatchesData = null; isDataProcessed = false; disableControls(true);
             if (resetButton) resetButton.disabled = false; // Allow reset even on failure
            return false;
        }
    }

    function populateYearSelectors(minYear, maxYear) {
        // (Keep the robust version from previous steps)
        if (!startYearSelectEl || !endYearSelectEl) return; startYearSelectEl.innerHTML = ''; endYearSelectEl.innerHTML = '';
        const aY = []; if (minYear === Infinity || !minYear || !maxYear) return;
        for (let y = minYear; y <= maxYear; y++) { aY.push(y); const sO=document.createElement('option'); sO.value=y; sO.textContent=y; startYearSelectEl.appendChild(sO); const eO=document.createElement('option'); eO.value=y; eO.textContent=y; endYearSelectEl.appendChild(eO); }
        console.log(`Populated year selectors ${minYear}-${maxYear}.`);
        const dSY=2010, dEY=2024; // Adjust defaults as needed
        startYearSelectEl.value = aY.includes(dSY)?dSY:minYear; endYearSelectEl.value = aY.includes(dEY)?dEY:maxYear;
        console.log(`Defaults set: ${startYearSelectEl.value}-${endYearSelectEl.value}`);
    }

    function addPlayerStepToDisplay(playerName, connectingMatchInfo, listElement) {
        // **FIXED:** Ensure connectingMatchInfo is displayed correctly
        if (!listElement) { console.error("Target list element missing."); return; }
        try {
            const li = document.createElement('li');
            const nameSpan = document.createElement('span');
            nameSpan.textContent = playerName;
            li.appendChild(nameSpan);

            if (connectingMatchInfo) {
                const matchSpan = document.createElement('small');
                matchSpan.className = 'match-info'; // For styling via CSS
                // Add a space before the match info for readability
                matchSpan.textContent = ` ${connectingMatchInfo}`;
                li.appendChild(matchSpan);
            }
            listElement.appendChild(li);
        } catch (e) { console.error("Error adding player step to display:", e, playerName); }
    }

    // --- Game Setup ---
    function selectStartAndEndPlayers() {
        // (Keep the robust version including the direct connection check)
        console.log("Selecting start and end players...");
        if (!isDataProcessed || globalAllPlayers.size === 0) { showMessage("Data not ready.", "error"); return { startPlayer: null, endPlayer: null }; }
        const selMinGames = minGamesSelectEl ? parseInt(minGamesSelectEl.value, 10) : 0;
        const selSY = startYearSelectEl ? parseInt(startYearSelectEl.value, 10) : minDataYear;
        const selEY = endYearSelectEl ? parseInt(endYearSelectEl.value, 10) : maxDataYear;
        const eligiblePlayers = [];
        for (const pName of globalAllPlayers) {
            if ((globalPlayerGameCounts[pName] || 0) >= selMinGames) {
                let playedInRange = true;
                if (startYearSelectEl && playerYearMap[pName]) {
                    playedInRange = [...playerYearMap[pName]].some(y => y >= selSY && y <= selEY);
                } else if (startYearSelectEl && !playerYearMap[pName]) { playedInRange = false; }
                if (playedInRange) eligiblePlayers.push(pName);
            }
        }
        console.log(`Found ${eligiblePlayers.length} eligible players.`);
        if (eligiblePlayers.length < 2) { showMessage(`Not enough eligible players (${eligiblePlayers.length}). Adjust filters?`, 'error'); return { startPlayer: null, endPlayer: null }; }
        let attempt = 0; const maxAttempts = 50;
        while (attempt < maxAttempts) {
            attempt++;
            const sIdx = Math.floor(Math.random() * eligiblePlayers.length);
            let eIdx; do { eIdx = Math.floor(Math.random() * eligiblePlayers.length); } while (sIdx === eIdx);
            const potentialStart = eligiblePlayers[sIdx]; const potentialEnd = eligiblePlayers[eIdx];
            const areDirectlyConnected = globalAdjacencyList[potentialStart]?.has(potentialEnd);
            if (areDirectlyConnected) continue; // Skip directly connected pairs
            const path = findShortestPath(potentialStart, potentialEnd);
            if (path && path.length > 1) {
                console.log(`Selected pair: ${potentialStart} -> ${potentialEnd} (Path length: ${path.length - 1})`);
                shortestPath = path; // Cache path
                return { startPlayer: potentialStart, endPlayer: potentialEnd };
            }
        }
        console.warn(`Could not find suitable pair after ${maxAttempts} attempts.`);
        showMessage('Could not find a suitable pair with current filters. Try again or adjust settings.', 'error');
        return { startPlayer: null, endPlayer: null };
    }


    function setupNewGame() {
        console.log("Setting up new game...");
        hideAnswer(); hideHint(); // Hide previous game's info
        shortestPath = null; // Clear cached path
        if (playerInputEl) playerInputEl.value = '';
        messageEl.innerHTML = ''; messageEl.className = 'message'; // Clear message area

        if (!isDataProcessed) { showMessage("Data not ready.", "error"); disableControls(true); return false; }

        const selSY = startYearSelectEl ? startYearSelectEl.value : minDataYear;
        const selEY = endYearSelectEl ? endYearSelectEl.value : maxDataYear;
        if (dataYearsEl) dataYearsEl.textContent = startYearSelectEl ? `${selSY}-${selEY}` : `${minDataYear}-${maxDataYear}`;

        const players = selectStartAndEndPlayers();
        startPlayer = players.startPlayer;
        endPlayer = players.endPlayer;

        if (!startPlayer || !endPlayer) {
            if (startPlayerEl) startPlayerEl.textContent = 'N/A'; if (endPlayerEl) endPlayerEl.textContent = 'N/A';
            currentPath = []; if (pathListEl) pathListEl.innerHTML = '';
            disableControls(true); // Keep core controls disabled
            // Ensure settings/reset ARE enabled
            if (minGamesSelectEl) minGamesSelectEl.disabled = false;
            if (startYearSelectEl) startYearSelectEl.disabled = false;
            if (endYearSelectEl) endYearSelectEl.disabled = false;
            if (resetButton) resetButton.disabled = false;
            return false;
        }

        // Setup successful game state
        if (startPlayerEl) startPlayerEl.textContent = startPlayer;
        if (endPlayerEl) endPlayerEl.textContent = endPlayer;
        currentPath = [startPlayer]; // Initialize path

        if (pathListEl) {
            pathListEl.innerHTML = '';
            addPlayerStepToDisplay(startPlayer, null, pathListEl); // Display start player
        }
        if (playerDatalistEl) { // Populate datalist
            playerDatalistEl.innerHTML = '';
            globalAllPlayers.forEach(p => { const o = document.createElement('option'); o.value = p; playerDatalistEl.appendChild(o); });
        }

        showMessage(`Game started! Connect ${startPlayer} to ${endPlayer}.`, 'success', 6000);
        disableControls(false); // Enable controls for the new game
        console.log(`Game ready: ${startPlayer} -> ${endPlayer}`);
        return true;
    }

    async function initializeGame() {
        console.log("Initializing game...");
        disableControls(true); // Disable all controls initially
        showMessage('Loading game data...', 'info');
        hideAnswer(); hideHint(); // Clear any old displays
        if (pathListEl) pathListEl.innerHTML = ''; if (answerListEl) answerListEl.innerHTML = '';
        if(startPlayerEl) startPlayerEl.textContent = '...'; if(endPlayerEl) endPlayerEl.textContent = '...';

        const dataReady = await loadRawDataAndProcess();
        if (!dataReady) {
            if (startPlayerEl) startPlayerEl.textContent = 'Error'; if (endPlayerEl) endPlayerEl.textContent = 'Error';
            // disableControls(true) already called, error message shown by load function
             if(resetButton) resetButton.disabled = false; // Ensure reset is enabled on error
            return;
        }
        showMessage(`Data ready. Setting up new game...`, 'info');
        setTimeout(setupNewGame, 50); // Use timeout for message visibility
    }

    // --- Game Logic ---
    function findShortestPath(start, end) {
         // (Keep the robust version from previous steps)
        if (!start || !end || typeof globalAdjacencyList !== 'object' || !globalAdjacencyList[start]) return null;
        const q = [[start, [start]]]; const v = new Set([start]);
        while (q.length > 0) {
            const [curr, p] = q.shift(); if (curr === end) return p;
            const n = globalAdjacencyList[curr] || new Set();
            for (const neighbor of n) { if (!v.has(neighbor)) { v.add(neighbor); const nP = [...p, neighbor]; q.push([neighbor, nP]); } }
        }
        return null; // Path not found
    }

    // --- Helper to Display Shortest Path ---
    function displayShortestPath() {
        // **FIXED:** Ensure this function handles visibility correctly
        if (!startPlayer || !endPlayer || !answerListEl || !answerDisplayEl) {
            console.error("Cannot display shortest path - missing elements or game state.");
            return null;
        }

        // Calculate if not cached
        if (!shortestPath) {
             console.log("Calculating shortest path for display...");
             shortestPath = findShortestPath(startPlayer, endPlayer);
        } else { console.log("Using cached shortest path for display."); }

        answerListEl.innerHTML = ''; // Clear previous answer list

        if (shortestPath && shortestPath.length > 0) {
            for (let i = 0; i < shortestPath.length; i++) {
                const currentPlayer = shortestPath[i];
                let connectingMatch = (i > 0) ? findConnectingMatch(shortestPath[i - 1], currentPlayer) : null;
                addPlayerStepToDisplay(currentPlayer, connectingMatch, answerListEl);
            }
            // Make the answer section visible
            answerDisplayEl.style.display = 'block';
            void answerDisplayEl.offsetWidth; // Force reflow for transition
            answerDisplayEl.classList.add('visible');
            hideHint(); // Hide hint when showing answer
        } else {
             console.warn("Could not find or display a shortest path.");
             showMessage("No path found between these players.", "error");
             // Ensure answer section is hidden if no path
             answerDisplayEl.style.display = 'none';
             answerDisplayEl.classList.remove('visible');
        }
        return shortestPath; // Return the path (or null)
    }

    // --- Main Game Actions ---
    function handleAddStep() {
        if (!startPlayer || !endPlayer || !playerInputEl || !pathListEl) return;

        const enteredPlayerName = playerInputEl.value.trim();
        const lastPlayerInPath = currentPath[currentPath.length - 1];

        // --- Input Validation ---
        if (!enteredPlayerName) { showMessage("Please enter a player's name.", "error", 3000); return; }
        if (!globalAllPlayers.has(enteredPlayerName)) { showMessage(`Player "${enteredPlayerName}" not found. Check spelling.`, "error", 4000); playerInputEl.focus(); return; }
        if (currentPath.includes(enteredPlayerName)) { showMessage(`"${enteredPlayerName}" is already in your path.`, "error", 3000); playerInputEl.value = ''; return; }
        if (enteredPlayerName === startPlayer && currentPath.length > 1) { showMessage(`Cannot add start player ("${startPlayer}") again.`, "error", 3000); playerInputEl.value = ''; return; }

        // --- Connection Check ---
        const isConnected = globalAdjacencyList[lastPlayerInPath]?.has(enteredPlayerName);

        if (isConnected) {
            const connectingMatch = findConnectingMatch(lastPlayerInPath, enteredPlayerName);
            currentPath.push(enteredPlayerName);
            addPlayerStepToDisplay(enteredPlayerName, connectingMatch, pathListEl); // Update UI path
            playerInputEl.value = ''; // Clear input
            hideAnswer(); hideHint(); // Hide any open answer/hint

            // --- Win Condition Check ---
            // **FIXED:** Check if the newly added player connects to the end player
            const connectsToEnd = globalAdjacencyList[enteredPlayerName]?.has(endPlayer);

            if (connectsToEnd) {
                // ---- GAME WON ----
                console.log("Win condition met!");

                // 1. Add final player & connection to UI path
                const finalConnectionMatch = findConnectingMatch(enteredPlayerName, endPlayer);
                currentPath.push(endPlayer); // Add to internal state *after* finding connection info
                addPlayerStepToDisplay(endPlayer, finalConnectionMatch, pathListEl);

                // 2. Calculate and DISPLAY the shortest path answer
                const actualShortestPath = displayShortestPath(); // This makes the answer section visible

                // 3. Show Congratulations Message
                let successMsg = `🎉 <strong>CONGRATULATIONS!</strong> 🎉<br>You connected ${startPlayer} to ${endPlayer} in ${currentPath.length - 1} steps!`;
                if (actualShortestPath) {
                    const shortestSteps = actualShortestPath.length - 1;
                    successMsg += (currentPath.length - 1 === shortestSteps)
                        ? `<br><em>That's the shortest possible path!</em> 👍`
                        : `<br>(Shortest possible path was ${shortestSteps} steps - shown below)`;
                } else { successMsg += `<br>(Could not verify shortest path)`; }
                showMessage(successMsg, 'success'); // Permanent success banner

                // 4. Disable game controls (disableControls handles this correctly now)
                disableControls(true);

                return; // --- End Win ---
            }

             // If not a win, provide standard feedback for successful step
             showMessage(`"${enteredPlayerName}" added. Find teammate of ${enteredPlayerName}.`, 'info', 4000);

        } else {
             // Not connected
             showMessage(`"${enteredPlayerName}" was not a teammate of "${lastPlayerInPath}". Try again.`, "error");
             playerInputEl.focus();
        }
    }

    function handleShowAnswer() {
        // **FIXED:** Ensure visibility and control logic is correct
        if (!startPlayer || !endPlayer) { showMessage("Game not started.", "error"); return; }
        if (currentPath.includes(endPlayer)) { showMessage("Game already won.", "info"); return; } // Don't show if won

        showMessage("Calculating and showing shortest path...", "info");
        // No need to disable controls here, displayShortestPath doesn't take long
        // and user might click hint right after.

        setTimeout(() => { // Use timeout to allow message render
            const displayedPath = displayShortestPath(); // This handles visibility
            if (displayedPath) {
                showMessage(`Shortest path (${displayedPath.length - 1} steps) displayed.`, 'info', 5000);
            } // Error message handled within displayShortestPath
             // Controls remain enabled as game is still active
        }, 50);
    }

    function handleShowHint() {
        // **FIXED:** Ensure visibility is handled correctly
        if (!startPlayer || !endPlayer || !hintContentEl || !playerTeamYearMap || !hintDisplayEl) {
            showMessage("Hint unavailable.", "error"); return;
        }
         if (currentPath.includes(endPlayer)) { showMessage("Game already won.", "info"); return; } // Don't show if won


        let hintHTML = '';
        const lastPlayer = currentPath[currentPath.length - 1];
        const lastPlayerTeams = playerTeamYearMap[lastPlayer];
        hintHTML += `<p><strong>Hints for ${lastPlayer}:</strong></p><ul>`;
         if (lastPlayerTeams && Object.keys(lastPlayerTeams).length > 0) {
             const sorted = Object.entries(lastPlayerTeams).sort((a, b) => a[0].localeCompare(b[0]));
             sorted.forEach(([t, y]) => { hintHTML += `<li>Played for <strong>${t}</strong> (First seen: ${y})</li>`; });
         } else { hintHTML += `<li>No team data for ${lastPlayer}.</li>`; }
         hintHTML += `</ul>`;

        const endPlayerTeams = playerTeamYearMap[endPlayer];
        hintHTML += `<p><strong>Hints for Target (${endPlayer}):</strong></p><ul>`;
         if (endPlayerTeams && Object.keys(endPlayerTeams).length > 0) {
             const sorted = Object.entries(endPlayerTeams).sort((a, b) => a[0].localeCompare(b[0]));
             sorted.forEach(([t, y]) => { hintHTML += `<li>Played for <strong>${t}</strong> (First seen: ${y})</li>`; });
         } else { hintHTML += `<li>No team data for ${endPlayer}.</li>`; }
         hintHTML += `</ul>`;

        hintContentEl.innerHTML = hintHTML;

        // Make hint section visible
        hintDisplayEl.style.display = 'block';
        void hintDisplayEl.offsetWidth; // Reflow
        hintDisplayEl.classList.add('visible');

        hideAnswer(); // Hide answer if visible
        showMessage("Hints displayed.", "info", 4000);
         // Controls remain enabled
    }

    // --- Filter Change Handlers ---
    function handleMinGamesChange() { initializeGame(); }
    function handleYearChange() {
        if (!startYearSelectEl || !endYearSelectEl) return;
        const sY = parseInt(startYearSelectEl.value, 10); const eY = parseInt(endYearSelectEl.value, 10);
        if (isNaN(sY) || isNaN(eY)) { showMessage("Invalid year.", "error"); return; }
        if (sY > eY) { showMessage("Start year cannot be after end year.", "warning", 4000); endYearSelectEl.value = sY; /* Adjust end */ }
        initializeGame();
    }

    // --- Event Listeners ---
    if (addStepButton) addStepButton.addEventListener('click', handleAddStep); else console.error("#add-step-button missing");
    if (resetButton) resetButton.addEventListener('click', initializeGame); else console.error("#reset-button missing");
    if (showAnswerButton) showAnswerButton.addEventListener('click', handleShowAnswer); else console.error("#show-answer-button missing");
    if (showHintButton) showHintButton.addEventListener('click', handleShowHint); else console.error("#show-hint-button missing");
    if (minGamesSelectEl) minGamesSelectEl.addEventListener('change', handleMinGamesChange);
    if (startYearSelectEl) startYearSelectEl.addEventListener('change', handleYearChange);
    if (endYearSelectEl) endYearSelectEl.addEventListener('change', handleYearChange);
    if (playerInputEl) {
        playerInputEl.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (addStepButton && !addStepButton.disabled) handleAddStep(); // Trigger click if enabled
            }
        });
    } else { console.error("#player-input missing"); }

    // --- Initial Load ---
    initializeGame(); // Start the game automatically

}); // End DOMContentLoaded