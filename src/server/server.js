require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const { SetbackGame } = require('./gameLogic');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../public')));

// Game rooms storage (in production, use Redis or database)
const gameRooms = new Map();
const activeGames = new Map(); // Store actual game instances

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Join game room
  socket.on('joinRoom', (roomId, playerName) => {
    socket.join(roomId);
    socket.playerName = playerName;
    socket.roomId = roomId;
    
    console.log(`${playerName} joined room ${roomId}`);
    
    // Initialize room if it doesn't exist
    if (!gameRooms.has(roomId)) {
      gameRooms.set(roomId, {
        players: [],
        gameState: null,
        maxPlayers: 4
      });
    }
    
    const room = gameRooms.get(roomId);
    
    // Add player if room isn't full
    if (room.players.length < room.maxPlayers) {
      room.players.push({
        id: socket.id,
        name: playerName,
        ready: false
      });
      
      // Notify all players in room
      io.to(roomId).emit('playerJoined', {
        players: room.players,
        message: `${playerName} joined the game`
      });
    } else {
      socket.emit('roomFull', 'Room is full');
    }
  });

  // Handle player ready state
  socket.on('playerReady', () => {
    const room = gameRooms.get(socket.roomId);
    if (room) {
      const player = room.players.find(p => p.id === socket.id);
      if (player) {
        player.ready = !player.ready;
        io.to(socket.roomId).emit('playerReadyUpdate', room.players);
        
        // Check if all players are ready
        if (room.players.length === 4 && room.players.every(p => p.ready)) {
          // Create and start new game
          const game = new SetbackGame(socket.roomId, room.players);
          activeGames.set(socket.roomId, game);
          
          const gameState = game.startNewHand();
          
          // Send game state to all players with their individual hands
          room.players.forEach((player, index) => {
            const playerGameState = game.getPlayerGameState(index);
            io.to(player.id).emit('gameStarted', playerGameState);
          });
        }
      }
    }
  });

  // Handle bidding
  socket.on('placeBid', (bidAmount) => {
    const game = activeGames.get(socket.roomId);
    if (game) {
      try {
        const room = gameRooms.get(socket.roomId);
        const playerIndex = room.players.findIndex(p => p.id === socket.id);
        
        if (playerIndex === -1) {
          socket.emit('gameError', 'Player not found');
          return;
        }
        
        const gameState = game.placeBid(playerIndex, bidAmount);
        
        // Send updated game state to all players
        room.players.forEach((player, index) => {
          const playerGameState = game.getPlayerGameState(index);
          io.to(player.id).emit('gameStateUpdate', playerGameState);
        });
        
      } catch (error) {
        socket.emit('gameError', error.message);
      }
    }
  });

  // Handle trump selection
  socket.on('selectTrump', (suit) => {
    console.log('=== TRUMP SELECTION EVENT RECEIVED ===');
    console.log('Suit selected:', suit);
    
    const game = activeGames.get(socket.roomId);
    if (game) {
      try {
        const room = gameRooms.get(socket.roomId);
        const playerIndex = room.players.findIndex(p => p.id === socket.id);
        
        if (playerIndex === -1) {
          socket.emit('gameError', 'Player not found');
          return;
        }
        
        console.log('Trump selection by player index:', playerIndex);
        console.log('Current bid player:', game.currentBid.player);
        console.log('Player name:', room.players[playerIndex].name);
        
        const gameState = game.selectTrump(playerIndex, suit);
        
        console.log('After trump selection - current player:', gameState.currentPlayer);
        console.log('Current player name:', room.players[gameState.currentPlayer].name);
        
        // Send updated game state to all players
        room.players.forEach((player, index) => {
          const playerGameState = game.getPlayerGameState(index);
          console.log(`Sending to player ${index} (${player.name}): currentPlayer=${playerGameState.currentPlayer}, playerIndex=${index}`);
          io.to(player.id).emit('gameStateUpdate', playerGameState);
        });
        
      } catch (error) {
        console.log('Error in trump selection:', error.message);
        socket.emit('gameError', error.message);
      }
    } else {
      console.log('No game found for room:', socket.roomId);
    }
  });

  // Handle card playing
  socket.on('playCard', (cardIndex) => {
    const game = activeGames.get(socket.roomId);
    if (game) {
      try {
        const room = gameRooms.get(socket.roomId);
        const playerIndex = room.players.findIndex(p => p.id === socket.id);
        
        if (playerIndex === -1) {
          socket.emit('gameError', 'Player not found');
          return;
        }
        
        const gameState = game.playCard(playerIndex, cardIndex);
        
        // Send updated game state to all players
        room.players.forEach((player, index) => {
          const playerGameState = game.getPlayerGameState(index);
          io.to(player.id).emit('gameStateUpdate', playerGameState);
        });
        
      } catch (error) {
        socket.emit('gameError', error.message);
      }
    }
  });

  // Handle starting next hand
socket.on('nextHand', () => {
    console.log('=== NEXT HAND EVENT RECEIVED ===');
    const game = activeGames.get(socket.roomId);
    if (game) {
      console.log('Game found, current phase:', game.phase);
      console.log('Game dealer before startNewHand:', game.currentDealer);
      console.log('Game players:', game.players.map(p => p.name));
      try {
        if (game.phase === 'scoring') {
          console.log('Starting next hand...');
          console.log('About to call game.startNewHand()');
          
          const gameState = game.startNewHand();
          
          console.log('startNewHand() returned, new phase:', gameState.phase);
          console.log('Game dealer after startNewHand:', game.currentDealer);
          console.log('New dealer name:', game.players[game.currentDealer].name);
          
          const room = gameRooms.get(socket.roomId);
          
          // Send updated game state to all players
          room.players.forEach((player, index) => {
            const playerGameState = game.getPlayerGameState(index);
            io.to(player.id).emit('gameStateUpdate', playerGameState);
          });
          console.log('Next hand started and sent to all players');
        } else {
          console.log('Not in scoring phase, cannot start next hand');
        }
      } catch (error) {
        console.log('Error starting next hand:', error.message);
        console.log('Error stack:', error.stack);
        socket.emit('gameError', error.message);
      }
    } else {
      console.log('No game found for nextHand event');
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    if (socket.roomId) {
      const room = gameRooms.get(socket.roomId);
      if (room) {
        // Remove player from room
        room.players = room.players.filter(p => p.id !== socket.id);
        
        // Notify remaining players
        io.to(socket.roomId).emit('playerLeft', {
          players: room.players,
          message: `${socket.playerName} left the game`
        });
        
        // Clean up empty rooms and games
        if (room.players.length === 0) {
          gameRooms.delete(socket.roomId);
          activeGames.delete(socket.roomId);
        }
      }
    }
  });
});

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/index.html'));
});

app.get('/constants.js', (req, res) => {
  res.sendFile(path.join(__dirname, '../shared/constants.js'));
});

app.get('/health', (req, res) => {
  res.json({ status: 'Server is running', rooms: gameRooms.size });
});

// =============================================================================
// DEBUG ENDPOINTS FOR AUTO-PLAY
// =============================================================================

app.post('/debug/autoplay/:roomId', (req, res) => {
  const game = activeGames.get(req.params.roomId);
  if (!game) {
    return res.json({ error: 'Game not found' });
  }
  
  const gameState = game.autoPlay();
  if (gameState) {
    // Send updated game state to all players
    const room = gameRooms.get(req.params.roomId);
    room.players.forEach((player, index) => {
      const playerGameState = game.getPlayerGameState(index);
      io.to(player.id).emit('gameStateUpdate', playerGameState);
    });
    res.json({ success: true, phase: gameState.phase });
  } else {
    res.json({ error: 'No auto-play available for current phase' });
  }
});

app.post('/debug/complete-bidding/:roomId', (req, res) => {
  const game = activeGames.get(req.params.roomId);
  if (!game) {
    return res.json({ error: 'Game not found' });
  }
  
  const gameState = game.autoCompleteBidding();
  const room = gameRooms.get(req.params.roomId);
  room.players.forEach((player, index) => {
    const playerGameState = game.getPlayerGameState(index);
    io.to(player.id).emit('gameStateUpdate', playerGameState);
  });
  res.json({ success: true, phase: gameState.phase });
});

app.post('/debug/complete-hand/:roomId', (req, res) => {
  const game = activeGames.get(req.params.roomId);
  if (!game) {
    return res.json({ error: 'Game not found' });
  }
  
  const gameState = game.autoCompleteHand();
  const room = gameRooms.get(req.params.roomId);
  room.players.forEach((player, index) => {
    const playerGameState = game.getPlayerGameState(index);
    io.to(player.id).emit('gameStateUpdate', playerGameState);
  });
  res.json({ success: true, phase: gameState.phase });
});

app.get('/debug/game-state/:roomId', (req, res) => {
  const game = activeGames.get(req.params.roomId);
  if (!game) {
    return res.json({ error: 'Game not found' });
  }
  
  res.json({
    phase: game.phase,
    currentPlayer: game.currentPlayer,
    currentDealer: game.currentDealer,
    handNumber: game.handNumber,
    scores: game.scores,
    trump: game.trump
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

app.post('/debug/complete-game/:roomId', (req, res) => {
    const game = activeGames.get(req.params.roomId);
    if (!game) {
      return res.json({ error: 'Game not found' });
    }
    
    console.log('=== AUTO-COMPLETING ENTIRE GAME ===');
    let handsPlayed = 0;
    const maxHands = 50; // Safety limit
    
    try {
      while (game.scores.team1 < 21 && game.scores.team2 < 21 && handsPlayed < maxHands) {
        handsPlayed++;
        console.log(`Auto-playing hand ${handsPlayed}...`);
        
        // Complete one full hand
        game.autoCompleteHand();
        
        // If we're in scoring phase, start next hand
        if (game.phase === 'scoring' && game.scores.team1 < 21 && game.scores.team2 < 21) {
          game.startNewHand();
        }
        
        console.log(`After hand ${handsPlayed}: Team1=${game.scores.team1}, Team2=${game.scores.team2}`);
      }
      
      console.log('=== GAME COMPLETE ===');
      console.log(`Total hands played: ${handsPlayed}`);
      console.log(`Final scores: Team1=${game.scores.team1}, Team2=${game.scores.team2}`);
      console.log(`Winner: ${game.scores.team1 >= 21 ? 'Team1' : 'Team2'}`);
      
      // Send final game state to all players
      const room = gameRooms.get(req.params.roomId);
      room.players.forEach((player, index) => {
        const playerGameState = game.getPlayerGameState(index);
        io.to(player.id).emit('gameStateUpdate', playerGameState);
      });
      
      res.json({ 
        success: true, 
        handsPlayed: handsPlayed,
        finalScores: game.scores,
        winner: game.scores.team1 >= 21 ? 'Team1' : 'Team2',
        phase: game.phase
      });
      
    } catch (error) {
      console.error('Error in complete-game:', error);
      res.json({ error: error.message });
    }
  });