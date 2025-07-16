// Game client-side logic
class SetbackGame {
    constructor() {
        this.socket = null;
        this.playerName = '';
        this.roomId = '';
        this.currentScreen = 'login';
        this.gameState = null;
        this.lastTrickKey = null;
        
        this.init();
    }
    
    init() {
        this.socket = io();
        this.initializeChat();
        this.setupSocketListeners();
        this.setupUIEventListeners();
    }
    
    setupSocketListeners() {
        // Connection events
        this.socket.on('connect', () => {
            console.log('Connected to server');
        });
        
        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.showMessage('Disconnected from server', 'error');
        });
        
        // Lobby events
        this.socket.on('playerJoined', (data) => {
            this.updatePlayersList(data.players);
            this.showMessage(data.message, 'info');
        });
        
        this.socket.on('playerLeft', (data) => {
            this.updatePlayersList(data.players);
            this.showMessage(data.message, 'info');
        });
        
        this.socket.on('playerReadyUpdate', (players) => {
            this.updatePlayersList(players);
        });
        
        this.socket.on('roomFull', (message) => {
            this.showMessage(message, 'error');
        });
        
        this.socket.on('gameStart', (message) => {
            this.showMessage(message, 'success');
            this.switchScreen('game');
        });

        // Game events
        this.socket.on('gameStarted', (gameState) => {
            this.gameState = gameState;
            this.switchScreen('game');
            this.updateGameDisplay();
            this.showMessage('Game started! Cards dealt.', 'success');
        });

        this.socket.on('gameStateUpdate', (gameState) => {
            this.gameState = gameState;
            this.updateGameDisplay();
        });

         // ADD THIS NEW LISTENER
        this.socket.on('trickWinner', (data) => {
        console.log('🏆 Received trickWinner event:', data);
        this.showTrickWinnerAnimation(data.winnerName, data.trickNumber);
        });

        this.socket.on('gameError', (message) => {
            this.showMessage(message, 'error');
        });
    }
    
    setupUIEventListeners() {
        // Login screen
        document.getElementById('joinGameBtn').addEventListener('click', () => {
            this.joinGame();
        });
        
        // Allow Enter key to join game
        document.getElementById('playerName').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinGame();
        });
        
        document.getElementById('roomId').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinGame();
        });
        
        // Lobby screen
        document.getElementById('readyBtn').addEventListener('click', () => {
            this.toggleReady();
        });
        
        document.getElementById('leaveRoomBtn').addEventListener('click', () => {
            this.leaveRoom();
        });
        
        // Game screen - bidding
        document.querySelectorAll('.bid-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const bid = btn.dataset.bid;
                this.placeBid(bid);
            });
        });
        
        // Game screen - trump selection
        document.querySelectorAll('.trump-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const suit = btn.dataset.suit;
                this.selectTrump(suit);
            });
        });
    }
    
    joinGame() {
        const playerNameInput = document.getElementById('playerName');
        const roomIdInput = document.getElementById('roomId');
        
        this.playerName = playerNameInput.value.trim();
        this.roomId = roomIdInput.value.trim() || this.generateRoomId();
        
        if (!this.playerName) {
            this.showMessage('Please enter your name', 'error');
            return;
        }
        
        if (this.playerName.length > 20) {
            this.showMessage('Name too long (max 20 characters)', 'error');
            return;
        }
        
        // Join the room
        this.socket.emit('joinRoom', this.roomId, this.playerName);
        
        // Switch to lobby screen
        this.switchScreen('lobby');
        document.getElementById('currentRoomId').textContent = this.roomId;
    }
    
    generateRoomId() {
        return Math.random().toString(36).substr(2, 6).toUpperCase();
    }
    
    toggleReady() {
        this.socket.emit('playerReady');
        const readyBtn = document.getElementById('readyBtn');
        readyBtn.classList.toggle('ready');
        readyBtn.textContent = readyBtn.classList.contains('ready') ? 'Not Ready' : 'Ready';
    }
    
    leaveRoom() {
        this.socket.disconnect();
        this.socket.connect();
        this.switchScreen('login');
        
        // Reset form
        document.getElementById('playerName').value = '';
        document.getElementById('roomId').value = '';
        document.getElementById('readyBtn').classList.remove('ready');
        document.getElementById('readyBtn').textContent = 'Ready';
    }
    
    updatePlayersList(players) {
        const playersList = document.getElementById('playersList');
        const playerCount = document.getElementById('playerCount');
        
        playersList.innerHTML = '';
        playerCount.textContent = players.length;
        
        players.forEach(player => {
            const li = document.createElement('li');
            li.textContent = player.name;
            if (player.ready) {
                li.classList.add('player-ready');
                li.textContent += ' (Ready)';
            }
            playersList.appendChild(li);
        });
    }
    
    switchScreen(screenName) {
        // Hide all screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.add('hidden');
        });
        
        // Show target screen
        document.getElementById(screenName + 'Screen').classList.remove('hidden');
        this.currentScreen = screenName;
    }
    
    showMessage(message, type = 'info') {
        // Try to find any available message container
        const possibleContainers = [
            'messageArea',      // Game screen messages
            'gameMessages',     // Alternative game messages
            'lobbyMessages',    // Lobby messages
            'chatMessages'      // Chat as fallback
        ];
        
        let messagesContainer = null;
        
        for (const containerId of possibleContainers) {
            messagesContainer = document.getElementById(containerId);
            if (messagesContainer) {
                console.log(`Using message container: ${containerId}`);
                break;
            }
        }
        
        // If still no container found, just log to console and continue
        if (!messagesContainer) {
            console.log(`Message (${type}): ${message}`);
            console.log('Available elements:', document.querySelectorAll('[id*="message"], [id*="Message"]'));
            return;
        }
        
        const messageDiv = document.createElement('div');
        messageDiv.textContent = message;
        messageDiv.className = `message ${type}`;
        
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        // Remove old messages if too many
        if (messagesContainer.children.length > 20) {
            messagesContainer.removeChild(messagesContainer.firstChild);
        }
    }
    
    placeBid(bid) {
        console.log('Placing bid:', bid);
        this.socket.emit('placeBid', bid === 'pass' ? 'pass' : parseInt(bid));
    }
    
    selectTrump(suit) {
        console.log('Selecting trump:', suit);
        this.socket.emit('selectTrump', suit);
    }
    
    playCard(card) {
        console.log('Playing card:', card);
        // TODO: Implement card playing logic
    }

    updateGameDisplay() {
        if (!this.gameState) return;

        console.log('=== updateGameDisplay called ===');
        console.log('Game phase:', this.gameState.phase);
        console.log('Current trick length:', this.gameState.currentTrick?.length);

        // Update scores
        document.getElementById('team1Score').textContent = this.gameState.scores.team1;
        document.getElementById('team2Score').textContent = this.gameState.scores.team2;

        // Update trump, bid, and dealer info
        document.getElementById('trumpSuit').textContent = this.gameState.trump || '-';
        
        // Update bid info with player name and team
        if (this.gameState.currentBid.amount > 0) {
        const bidder = this.gameState.players[this.gameState.currentBid.player];
        const teamName = this.getTeamName(bidder.team);
        document.getElementById('currentBid').textContent = 
        `${this.gameState.currentBid.amount} (${bidder.name} - ${teamName})`;
        } else {
        document.getElementById('currentBid').textContent = '-';
    }
        
        // Show current dealer
        const dealerName = this.gameState.players[this.gameState.currentDealer]?.name || '-';
        document.getElementById('currentDealer').textContent = dealerName;

        // Update current player info
        this.updateCurrentPlayerInfo();

        // Update team information
        this.updateTeamInfo();

        // Update player hand
        this.displayPlayerHand();

        // Update trick area
        this.displayTrickArea();

        // Check for trick winner
        console.log('About to call checkForTrickWinner...');
        this.checkForTrickWinner();

        // Show/hide game sections based on phase
        this.updateGamePhase();
    }

    checkForTrickWinner() {
        console.log('=== checkForTrickWinner called ===');
        console.log('Game phase:', this.gameState.phase);
        console.log('Current trick length:', this.gameState.currentTrick?.length);
        
        // TRIGGER ANIMATION WHEN WE HIT 4 CARDS
        if (this.gameState.phase === 'playing' && 
            this.gameState.currentTrick && 
            this.gameState.currentTrick.length === 4) {
            
            console.log('🎉 FULL TRICK DETECTED!', this.gameState.currentTrick);
            
            // Check if this is a new trick completion
            const trickKey = this.gameState.currentTrick.map(p => p.playerName + p.card.suit + p.card.rank).join('');
            if (this.lastTrickKey !== trickKey) {
                this.lastTrickKey = trickKey;
                
                // Determine trick winner
                const winner = this.gameState.currentTrick[this.gameState.currentTrick.length - 1];
                console.log('🏆 Showing animation for winner:', winner.playerName);
                this.showTrickWinnerAnimation(winner.playerName, this.gameState.trickNumber || 1);
            }
        }
    }

    showTrickWinnerAnimation(winnerName, trickNumber) {
        const notification = document.getElementById('trickWinnerNotification');
        const text = document.getElementById('trickWinnerText');
        
        // Set the winner text
        text.textContent = `${winnerName} wins trick ${trickNumber}!`;
        
        // Show the notification
        notification.classList.remove('hidden');
        
        // Hide after animation completes (3 seconds)
        setTimeout(() => {
            notification.classList.add('hidden');
        }, 3000);
    }

    initializeChat() {
        const chatInput = document.getElementById('chatInput');
        const chatSendBtn = document.getElementById('chatSendBtn');
        
        // Send message on button click
        chatSendBtn.addEventListener('click', () => {
            this.sendChatMessage();
        });
        
        // Send message on Enter key
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendChatMessage();
            }
        });
        
        // Listen for incoming chat messages
        this.socket.on('chatMessage', (data) => {
            this.displayChatMessage(data);
        });
    }
    
    sendChatMessage() {
        const chatInput = document.getElementById('chatInput');
        const message = chatInput.value.trim();
        
        if (message && message.length > 0) {
            // Send to server
            this.socket.emit('chatMessage', {
                message: message,
                player: this.playerName
            });
            
            // Clear input
            chatInput.value = '';
        }
    }
    
    displayChatMessage(data) {
        const chatMessages = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message';
        
        // Get player's team for color coding
        const player = this.gameState.players.find(p => p.name === data.player);
        const teamClass = player ? player.team : '';
        
        messageDiv.innerHTML = `
            <span class="chat-player ${teamClass}">${data.player}:</span>
            <span class="chat-text">${data.message}</span>
        `;
        
        chatMessages.appendChild(messageDiv);
        
        // Auto-scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    getTeamName(team) {
        return team === 'team1' ? 'Me & My Uncle' : 'West Texas Cowboys';
    }

    displayTrickArea() {
        const playedCardsContainer = document.getElementById('playedCards');
        playedCardsContainer.innerHTML = '';

        if (!this.gameState.currentTrick || this.gameState.currentTrick.length === 0) {
            playedCardsContainer.innerHTML = '<p>Waiting for cards to be played...</p>';
            return;
        }

        // Create a container for the current trick
        const trickContainer = document.createElement('div');
        trickContainer.className = 'current-trick';
        
        this.gameState.currentTrick.forEach((play, index) => {
            const playedCard = document.createElement('div');
            playedCard.className = 'played-card-container';
            
            const cardElement = this.createCardElementForDisplay(play.card);
            cardElement.classList.add('played-card');
            
            const playerLabel = document.createElement('div');
            playerLabel.className = 'player-label';
            playerLabel.textContent = play.playerName;
            
            playedCard.appendChild(cardElement);
            playedCard.appendChild(playerLabel);
            trickContainer.appendChild(playedCard);
        });

        playedCardsContainer.appendChild(trickContainer);
    }

    createCardElementForDisplay(card) {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'card';

        // Add red color class for hearts and diamonds
        if (card.suit === 'hearts' || card.suit === 'diamonds') {
            cardDiv.classList.add('red');
        }

        // Handle joker specially
        if (card.rank === 'JOKER') {
            cardDiv.classList.add('joker');
            cardDiv.innerHTML = '<div>JOKER</div>';
        } else {
            // Create standard playing card layout
            const suitSymbols = {
                'spades': '♠',
                'hearts': '♥',
                'diamonds': '♦',
                'clubs': '♣'
            };
            
            const suit = suitSymbols[card.suit];
            const rank = card.rank;
            
            cardDiv.innerHTML = `
                <div class="rank-suit-top">
                    <div class="rank">${rank}</div>
                    <div class="suit">${suit}</div>
                </div>
                <div class="center-suit">${suit}</div>
                <div class="rank-suit-bottom">
                    <div class="rank">${rank}</div>
                    <div class="suit">${suit}</div>
                </div>
            `;
        }

        return cardDiv;
    }

    updateCurrentPlayerInfo() {
        const currentPlayerName = document.getElementById('currentPlayerName');
        
        console.log('updateCurrentPlayerInfo called');
        console.log('Game phase:', this.gameState.phase);
        console.log('Current player index:', this.gameState.currentPlayer);
        console.log('My player index:', this.gameState.playerIndex);
        console.log('Current bid player:', this.gameState.currentBid.player);
        
        if (this.gameState.phase === 'bidding') {
            const currentBidder = this.gameState.players[this.gameState.currentBidder];
            currentPlayerName.textContent = currentBidder ? currentBidder.name : '-';
        } else if (this.gameState.phase === 'playing') {
            const currentPlayer = this.gameState.players[this.gameState.currentPlayer];
            currentPlayerName.textContent = currentPlayer ? currentPlayer.name : '-';
            console.log('Current player name:', currentPlayer ? currentPlayer.name : 'unknown');
        } else {
            currentPlayerName.textContent = '-';
        }
    }

    updateTeamInfo() {
        const team1Players = document.getElementById('team1Players');
        const team2Players = document.getElementById('team2Players');
        const team1Section = document.getElementById('team1Section');
        const team2Section = document.getElementById('team2Section');
        
        // Clear existing content
        team1Players.innerHTML = '';
        team2Players.innerHTML = '';
        
        // Remove previous highlighting
        team1Section.classList.remove('my-team');
        team2Section.classList.remove('my-team');
        
        // Get current player's team
        const myTeam = this.gameState.players[this.gameState.playerIndex]?.team;
        
        // Populate team rosters
        this.gameState.players.forEach(player => {
            const playerDiv = document.createElement('div');
            playerDiv.className = 'player-name';
            playerDiv.textContent = player.name;
            
            // Highlight current user
            if (player.name === this.playerName) {
                playerDiv.classList.add('current-user');
            }
            
            if (player.team === 'team1') {
                team1Players.appendChild(playerDiv);
            } else {
                team2Players.appendChild(playerDiv);
            }
        });
        
        // Highlight the player's team
        if (myTeam === 'team1') {
            team1Section.classList.add('my-team');
        } else if (myTeam === 'team2') {
            team2Section.classList.add('my-team');
        }
    }
    
    getTeamName(team) {
        return team === 'team1' ? 'Me & My Uncle' : 'West Texas Cowboys';
    }
    
    displayDetailedScoring() {
        const breakdown = document.getElementById('scoringBreakdown');
        const nextHandBtn = document.getElementById('nextHandBtn');
        
        const scoringData = this.gameState.scoringBreakdown || {};
        const bidResult = this.gameState.bidResult || null;
        
        breakdown.innerHTML = `
    ${bidResult ? `
        <div class="bid-result ${bidResult.success ? 'bid-made' : 'bid-failed'}">
            <strong>${bidResult.message}</strong>
        </div>
    ` : ''}
    
    <div class="points-grid">
        <div class="point-item">
            <div class="point-header">
                <div class="point-name">High:</div>
                <div class="point-winner ${scoringData.high?.winner || ''}">${scoringData.high ? this.getTeamName(scoringData.high.winner) : 'None'}</div>
            </div>
            <div class="point-detail">${scoringData.high?.detail || 'No trump played'}</div>
        </div>
        
        <div class="point-item">
            <div class="point-header">
                <div class="point-name">Low:</div>
                <div class="point-winner ${scoringData.low?.winner || ''}">${scoringData.low ? this.getTeamName(scoringData.low.winner) : 'None'}</div>
            </div>
            <div class="point-detail">${scoringData.low?.detail || 'No trump played'}</div>
        </div>
        
        <div class="point-item">
            <div class="point-header">
                <div class="point-name">Jack:</div>
                <div class="point-winner ${scoringData.jack?.winner || ''}">${scoringData.jack ? this.getTeamName(scoringData.jack.winner) : 'None'}</div>
            </div>
            <div class="point-detail">${scoringData.jack?.detail || 'Jack of trump not played'}</div>
        </div>
        
        <div class="point-item">
            <div class="point-header">
                <div class="point-name">Off-Jack:</div>
                <div class="point-winner ${scoringData.offJack?.winner || ''}">${scoringData.offJack ? this.getTeamName(scoringData.offJack.winner) : 'None'}</div>
            </div>
            <div class="point-detail">${scoringData.offJack?.detail || 'Off-jack not played'}</div>
        </div>
        
        <div class="point-item">
            <div class="point-header">
                <div class="point-name">Joker:</div>
                <div class="point-winner ${scoringData.joker?.winner || ''}">${scoringData.joker ? this.getTeamName(scoringData.joker.winner) : 'None'}</div>
            </div>
            <div class="point-detail">${scoringData.joker?.detail || 'Joker not played'}</div>
        </div>
        
        <div class="point-item">
            <div class="point-header">
                <div class="point-name">Game:</div>
                <div class="point-winner ${scoringData.game?.winner || ''}">${scoringData.game ? this.getTeamName(scoringData.game.winner) : 'None'}</div>
            </div>
            <div class="point-detail">${scoringData.game?.detail || 'Most game points'}</div>
        </div>
    </div>
    
    <div class="scoring-totals">
        <div class="team-total">
            <h5>Me & My Uncle</h5>
            <div class="total-points team1">${this.gameState.handScores?.team1 || 0}</div>
        </div>
        <div class="team-total">
            <h5>West Texas Cowboys</h5>
            <div class="total-points team2">${this.gameState.handScores?.team2 || 0}</div>
        </div>
    </div>
`;
   // Set up next hand button
   nextHandBtn.onclick = () => {
    this.socket.emit('nextHand');
    nextHandBtn.disabled = true;
    nextHandBtn.textContent = 'Starting...';
};
}
        
displayGameOverScoring() {
    const breakdown = document.getElementById('scoringBreakdown');
    const nextHandBtn = document.getElementById('nextHandBtn');
    
    const scoringData = this.gameState.scoringBreakdown || {};
    const bidResult = this.gameState.bidResult || null;
    
    // Same scoring display as regular hands
    breakdown.innerHTML = `
        ${bidResult ? `
            <div class="bid-result ${bidResult.success ? 'bid-made' : 'bid-failed'}">
                <strong>${bidResult.message}</strong>
            </div>
        ` : ''}
        
        <div class="points-grid">
            <div class="point-item">
                <div class="point-header">
                    <div class="point-name">High:</div>
                    <div class="point-winner ${scoringData.high?.winner || ''}">${scoringData.high ? this.getTeamName(scoringData.high.winner) : 'None'}</div>
                </div>
                <div class="point-detail">${scoringData.high?.detail || 'No trump played'}</div>
            </div>
            
            <div class="point-item">
                <div class="point-header">
                    <div class="point-name">Low:</div>
                    <div class="point-winner ${scoringData.low?.winner || ''}">${scoringData.low ? this.getTeamName(scoringData.low.winner) : 'None'}</div>
                </div>
                <div class="point-detail">${scoringData.low?.detail || 'No trump played'}</div>
            </div>
            
            <div class="point-item">
                <div class="point-header">
                    <div class="point-name">Jack:</div>
                    <div class="point-winner ${scoringData.jack?.winner || ''}">${scoringData.jack ? this.getTeamName(scoringData.jack.winner) : 'None'}</div>
                </div>
                <div class="point-detail">${scoringData.jack?.detail || 'Jack of trump not played'}</div>
            </div>
            
            <div class="point-item">
                <div class="point-header">
                    <div class="point-name">Off-Jack:</div>
                    <div class="point-winner ${scoringData.offJack?.winner || ''}">${scoringData.offJack ? this.getTeamName(scoringData.offJack.winner) : 'None'}</div>
                </div>
                <div class="point-detail">${scoringData.offJack?.detail || 'Off-jack not played'}</div>
            </div>
            
            <div class="point-item">
                <div class="point-header">
                    <div class="point-name">Joker:</div>
                    <div class="point-winner ${scoringData.joker?.winner || ''}">${scoringData.joker ? this.getTeamName(scoringData.joker.winner) : 'None'}</div>
                </div>
                <div class="point-detail">${scoringData.joker?.detail || 'Joker not played'}</div>
            </div>
            
            <div class="point-item">
                <div class="point-header">
                    <div class="point-name">Game:</div>
                    <div class="point-winner ${scoringData.game?.winner || ''}">${scoringData.game ? this.getTeamName(scoringData.game.winner) : 'None'}</div>
                </div>
                <div class="point-detail">${scoringData.game?.detail || 'Most game points'}</div>
            </div>
        </div>
        
        <div class="scoring-totals">
            <div class="team-total">
                <h5>Me & My Uncle</h5>
                <div class="total-points team1">${this.gameState.handScores?.team1 || 0}</div>
            </div>
            <div class="team-total">
                <h5>West Texas Cowboys</h5>
                <div class="total-points team2">${this.gameState.handScores?.team2 || 0}</div>
            </div>
        </div>
        
        <div class="game-over-info">
            <h4>🎉 Final Scores 🎉</h4>
            <p><strong>Me & My Uncle:</strong> ${this.gameState.scores.team1} points</p>
            <p><strong>West Texas Cowboys:</strong> ${this.gameState.scores.team2} points</p>
            <p class="winner">🏆 ${this.gameState.scores.team1 >= 21 ? 'Me & My Uncle' : 'West Texas Cowboys'} Wins! 🏆</p>
        </div>
    `;
    
    // Change button to "Start New Game"
    nextHandBtn.textContent = 'Start New Game';
    nextHandBtn.onclick = () => {
        // Reload the page to start fresh
        window.location.reload();
    };
}    
         
            
          
        
     

    displayHandResults() {
        // Legacy method for compatibility
        this.displayDetailedScoring();
    }

    displayGameResults() {
        // TODO: Show final game results
        const team1Score = this.gameState.scores.team1;
        const team2Score = this.gameState.scores.team2;
        const winner = team1Score >= 21 ? 'Me & My Uncle' : 'West Texas Cowboys';
        this.showMessage(`Game Over! ${winner} wins ${Math.max(team1Score, team2Score)} to ${Math.min(team1Score, team2Score)}!`, 'success');
    }

    displayPlayerHand() {
        const handContainer = document.getElementById('handCards');
        handContainer.innerHTML = '';

        if (!this.gameState.playerHand) return;

        console.log('=== DISPLAYING PLAYER HAND ===');
        console.log('Number of cards:', this.gameState.playerHand.length);
        console.log('Game phase:', this.gameState.phase);
        console.log('Current player:', this.gameState.currentPlayer);
        console.log('My player index:', this.gameState.playerIndex);

        this.gameState.playerHand.forEach((card, index) => {
            console.log(`Creating card ${index}:`, card);
            
            const cardElement = this.createCardElement(card, index);
            
            // Replace the test click handler with the real one
            cardElement.addEventListener('click', () => {
                console.log('REAL CLICK HANDLER - Card clicked:', index);
                console.log('this object:', this);
                console.log('this.playCard exists:', typeof this.playCard);
                console.log('this.playCard function:', this.playCard);
                console.log('Calling this.playCard with index:', index);
                
                try {
                    this.playCard(index);
                } catch (error) {
                    console.error('Error calling playCard:', error);
                }
            });
            
            // Highlight playable cards during playing phase
            if (this.gameState.phase === 'playing') {
                if (this.gameState.currentPlayer === this.gameState.playerIndex) {
                    cardElement.classList.add('playable');
                    console.log(`Card ${index} marked as playable`);
                } else {
                    cardElement.classList.add('disabled');
                }
            }
            
            handContainer.appendChild(cardElement);
            console.log(`Card ${index} added to hand container`);
        });
        
        console.log('Hand display complete');
    }

    createCardElement(card, index) {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'card';
        cardDiv.dataset.cardIndex = index;

        // Add red color class for hearts and diamonds
        if (card.suit === 'hearts' || card.suit === 'diamonds') {
            cardDiv.classList.add('red');
        }

        // Handle joker specially
        if (card.rank === 'JOKER') {
            cardDiv.classList.add('joker');
            cardDiv.innerHTML = '<div>JOKER</div>';
        } else {
            // Create standard playing card layout
            const suitSymbols = {
                'spades': '♠',
                'hearts': '♥',
                'diamonds': '♦',
                'clubs': '♣'
            };
            
            const suit = suitSymbols[card.suit];
            const rank = card.rank;
            
            cardDiv.innerHTML = `
                <div class="rank-suit-top">
                    <div class="rank">${rank}</div>
                    <div class="suit">${suit}</div>
                </div>
                <div class="center-suit">${suit}</div>
                <div class="rank-suit-bottom">
                    <div class="rank">${rank}</div>
                    <div class="suit">${suit}</div>
                </div>
            `;
        }

        // Add click handler for playing cards (TODO: implement)
        cardDiv.addEventListener('click', () => {
            console.log('Clicked card:', card);
            // TODO: Implement card playing
        });

        return cardDiv;
    }

    updateGamePhase() {
        const biddingSection = document.getElementById('biddingSection');
        const trumpSelection = document.getElementById('trumpSelection');
        const scoringDisplay = document.getElementById('scoringDisplay');
        
        // Reset next hand button when leaving scoring phase
        const nextHandBtn = document.getElementById('nextHandBtn');
        if (nextHandBtn && this.gameState.phase !== 'scoring') {
        nextHandBtn.disabled = false;
        nextHandBtn.textContent = 'Start Next Hand';
        }
        
        // Hide all sections first
        biddingSection.style.display = 'none';
        trumpSelection.style.display = 'none';
        scoringDisplay.style.display = 'none';

        // Show appropriate section based on game phase
        switch (this.gameState.phase) {
            case 'bidding':
                biddingSection.style.display = 'block';
                this.updateBiddingInterface();
                break;
            case 'trump_selection':
                if (this.gameState.currentBid.player === this.gameState.playerIndex) {
                    trumpSelection.style.display = 'block';
                    this.showMessage('You won the bid! Choose trump suit.', 'success');
                } else {
                    const winnerName = this.gameState.players[this.gameState.currentBid.player].name;
                    this.showMessage(`${winnerName} won the bid and is choosing trump.`, 'info');
                }
                break;
            case 'playing':
                if (this.gameState.currentPlayer === this.gameState.playerIndex) {
                    this.showMessage('Your turn! Click a card to play it.', 'success');
                } else {
                    const currentPlayerName = this.gameState.players[this.gameState.currentPlayer].name;
                    this.showMessage(`${currentPlayerName} is playing...`, 'info');
                }
                break;
            case 'scoring':
                scoringDisplay.style.display = 'block';
                this.displayDetailedScoring();
                this.showMessage('Hand complete! Check the scoring breakdown.', 'info');
                break;
            case 'game_over':
                // Show scoring display for final hand
                scoringDisplay.style.display = 'block';
                this.displayGameOverScoring();
                this.showMessage('Game Over!', 'success');
                break;
        }
    }

    playCard(cardIndex) {
        console.log('=== playCard function called ===');
        console.log('cardIndex received:', cardIndex);
        console.log('typeof cardIndex:', typeof cardIndex);
        console.log('this.gameState exists:', !!this.gameState);
        
        if (!this.gameState) {
            console.log('ERROR: No game state found');
            this.showMessage('Game not ready', 'error');
            return;
        }
        
        console.log('playCard called with cardIndex:', cardIndex);
        console.log('Current game state:', this.gameState);

        if (this.gameState.phase !== 'playing') {
            console.log('Not in playing phase, current phase:', this.gameState.phase);
            this.showMessage('Not in playing phase', 'error');
            return;
        }

        if (this.gameState.currentPlayer !== this.gameState.playerIndex) {
            console.log('Not your turn. Current player:', this.gameState.currentPlayer, 'Your index:', this.gameState.playerIndex);
            this.showMessage('Wait for your turn', 'error');
            return;
        }

        console.log('All checks passed. Sending playCard to server with cardIndex:', cardIndex);
        this.socket.emit('playCard', cardIndex);
        console.log('playCard event sent to server');
    }

    updateBiddingInterface() {
        const bidButtons = document.querySelectorAll('.bid-btn');
        const currentBid = this.gameState.currentBid.amount;
        const isMyTurn = this.gameState.currentBidder === this.gameState.playerIndex;

        bidButtons.forEach(btn => {
            const bid = btn.dataset.bid;
            
            if (bid === 'pass') {
                btn.disabled = !isMyTurn;
            } else {
                const bidValue = parseInt(bid);
                btn.disabled = !isMyTurn || bidValue <= currentBid;
            }
        });

        if (isMyTurn) {
            this.showMessage('Your turn to bid!', 'info');
        } else {
            const currentBidderName = this.gameState.players[this.gameState.currentBidder].name;
            this.showMessage(`${currentBidderName} is bidding...`, 'info');
        }
    }
}

// Initialize the game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new SetbackGame();
});

// =============================================================================
// AUTO-JOIN FOR TESTING (Remove in production)
// =============================================================================

// Auto-join if URL has ?autotest parameter
if (window.location.search.includes('autotest')) {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            // Auto-generate player name based on which tab this is
            const playerNames = ['Rich', 'Evan', 'Pres', 'Trent'];
            const randomName = playerNames[Math.floor(Math.random() * playerNames.length)] + Math.floor(Math.random() * 1000);
            
            document.getElementById('playerName').value = randomName;
            document.getElementById('roomId').value = 'SPRADLIN';
            
            // Auto-click join
            document.getElementById('joinGameBtn').click();
            
            // Auto-ready after joining
            setTimeout(() => {
                const readyBtn = document.getElementById('readyBtn');
                if (readyBtn && !readyBtn.classList.contains('ready')) {
                    readyBtn.click();
                }
            }, 1000);
        }, 500);
    });
}