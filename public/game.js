// Game client-side logic
class SetbackGame {
    constructor() {
        this.socket = null;
        this.playerName = '';
        this.roomId = '';
        this.currentScreen = 'login';
        this.gameState = null;
        
        this.init();
    }
    
    init() {
        this.socket = io();
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
        const messagesContainer = this.currentScreen === 'lobby' 
            ? document.getElementById('lobbyMessages')
            : document.getElementById('gameMessages');
        
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

        // Update scores
        document.getElementById('team1Score').textContent = this.gameState.scores.team1;
        document.getElementById('team2Score').textContent = this.gameState.scores.team2;

        // Update trump and bid info
        document.getElementById('trumpSuit').textContent = this.gameState.trump || '-';
        document.getElementById('currentBid').textContent = 
            this.gameState.currentBid.amount > 0 ? this.gameState.currentBid.amount : '-';

        // Update current player info
        this.updateCurrentPlayerInfo();

        // Update team information
        this.updateTeamInfo();

        // Update player hand
        this.displayPlayerHand();

        // Show/hide game sections based on phase
        this.updateGamePhase();
    }

    updateCurrentPlayerInfo() {
        const currentPlayerName = document.getElementById('currentPlayerName');
        
        if (this.gameState.phase === 'bidding') {
            const currentBidder = this.gameState.players[this.gameState.currentBidder];
            currentPlayerName.textContent = currentBidder ? currentBidder.name : '-';
        } else if (this.gameState.phase === 'playing') {
            const currentPlayer = this.gameState.players[this.gameState.currentPlayer];
            currentPlayerName.textContent = currentPlayer ? currentPlayer.name : '-';
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

    displayPlayerHand() {
        const handContainer = document.getElementById('handCards');
        handContainer.innerHTML = '';

        if (!this.gameState.playerHand) return;

        this.gameState.playerHand.forEach((card, index) => {
            const cardElement = this.createCardElement(card, index);
            handContainer.appendChild(cardElement);
        });
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

        // Hide all sections first
        biddingSection.style.display = 'none';
        trumpSelection.style.display = 'none';

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
                this.showMessage('Playing phase started!', 'info');
                break;
        }
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