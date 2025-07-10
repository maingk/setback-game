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
        // TODO: Implement bidding logic
        this.showMessage(`You bid ${bid}`, 'info');
    }
    
    selectTrump(suit) {
        console.log('Selecting trump:', suit);
        // TODO: Implement trump selection logic
        this.showMessage(`You selected ${suit} as trump`, 'info');
    }
    
    playCard(card) {
        console.log('Playing card:', card);
        // TODO: Implement card playing logic
    }
}

// Initialize the game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new SetbackGame();
});