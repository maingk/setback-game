const { SUITS, RANKS, CARD_VALUES, TRUMP_RANK_ORDER, REGULAR_RANK_ORDER, SUIT_COLORS, GAME_SETTINGS, GAME_PHASES } = require('../shared/constants');

class Card {
    constructor(suit, rank) {
        this.suit = suit;
        this.rank = rank;
        this.id = `${rank}_${suit}`;
    }
    
    // Get the display value for the card
    getDisplayValue() {
        if (this.rank === RANKS.JOKER) {
            return 'JOKER';
        }
        return `${this.rank}${this.getSuitSymbol()}`;
    }
    
    // Get suit symbol for display
    getSuitSymbol() {
        const symbols = {
            [SUITS.SPADES]: '♠',
            [SUITS.HEARTS]: '♥',
            [SUITS.DIAMONDS]: '♦',
            [SUITS.CLUBS]: '♣'
        };
        return symbols[this.suit] || '';
    }
    
    // Get card value for "Game" point calculation
    getGameValue() {
        return CARD_VALUES[this.rank] || 0;
    }
    
    // Check if card is red (for CSS styling)
    isRed() {
        return SUIT_COLORS[this.suit] === 'red';
    }
}

class Deck {
    constructor() {
        this.cards = [];
        this.createDeck();
    }
    
    createDeck() {
        this.cards = [];
        
        // Create standard 52 cards
        for (const suit of Object.values(SUITS)) {
            for (const rank of Object.values(RANKS)) {
                if (rank !== RANKS.JOKER) {
                    this.cards.push(new Card(suit, rank));
                }
            }
        }
        
        // Add one joker (no suit - will become trump when played)
        this.cards.push(new Card(null, RANKS.JOKER));
    }
    
    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }
    
    deal(numCards) {
        return this.cards.splice(0, numCards);
    }
    
    size() {
        return this.cards.length;
    }
}

class SetbackGame {
    constructor(roomId, players) {
        this.roomId = roomId;
        this.players = players; // Array of player objects
        this.deck = new Deck();
        this.phase = GAME_PHASES.WAITING;
        this.currentDealer = 0;
        this.currentBidder = 0;
        this.currentPlayer = 0;
        this.trump = null;
        this.currentBid = { amount: 0, player: null };
        this.bids = [];
        this.trick = [];
        this.playedCards = [];
        this.scores = {
            team1: 0, // Players 0 and 2
            team2: 0  // Players 1 and 3
        };
        this.handScores = {
            team1: 0,
            team2: 0
        };
        
        this.initializePlayers();
    }
    
    initializePlayers() {
        this.players.forEach((player, index) => {
            player.hand = [];
            player.team = index % 2 === 0 ? 'team1' : 'team2';
            player.position = index;
            player.ready = false;
        });
    }
    
    startNewHand() {
        // Reset for new hand
        this.deck = new Deck();
        this.deck.shuffle();
        this.phase = GAME_PHASES.DEALING;
        this.trump = null;
        this.currentBid = { amount: 0, player: null };
        this.bids = [];
        this.trick = [];
        this.playedCards = [];
        this.handScores = { team1: 0, team2: 0 };
        
        // Clear players' hands
        this.players.forEach(player => {
            player.hand = [];
        });
        
        // Deal cards
        this.dealCards();
        
        // Start bidding with player to left of dealer
        this.currentBidder = (this.currentDealer + 1) % 4;
        this.phase = GAME_PHASES.BIDDING;
        
        return this.getGameState();
    }
    
    dealCards() {
        // Deal 6 cards to each player
        for (let i = 0; i < GAME_SETTINGS.CARDS_PER_PLAYER; i++) {
            for (let playerIndex = 0; playerIndex < GAME_SETTINGS.PLAYERS_PER_GAME; playerIndex++) {
                const card = this.deck.deal(1)[0];
                this.players[playerIndex].hand.push(card);
            }
        }
    }
    
    placeBid(playerIndex, bidAmount) {
        if (this.phase !== GAME_PHASES.BIDDING) {
            throw new Error('Not in bidding phase');
        }
        
        if (playerIndex !== this.currentBidder) {
            throw new Error('Not your turn to bid');
        }
        
        // Validate bid
        if (bidAmount !== 'pass' && (bidAmount < GAME_SETTINGS.MIN_BID || bidAmount > GAME_SETTINGS.MAX_BID)) {
            throw new Error(`Bid must be between ${GAME_SETTINGS.MIN_BID} and ${GAME_SETTINGS.MAX_BID}`);
        }
        
        if (bidAmount !== 'pass' && bidAmount <= this.currentBid.amount) {
            throw new Error('Bid must be higher than current bid');
        }
        
        // Record the bid
        this.bids.push({
            player: playerIndex,
            amount: bidAmount,
            playerName: this.players[playerIndex].name
        });
        
        // Update current high bid
        if (bidAmount !== 'pass') {
            this.currentBid = {
                amount: bidAmount,
                player: playerIndex
            };
        }
        
        // Move to next bidder
        this.currentBidder = (this.currentBidder + 1) % 4;
        
        // Check if bidding is complete
        if (this.isBiddingComplete()) {
            if (this.currentBid.player !== null) {
                this.phase = GAME_PHASES.TRUMP_SELECTION;
            } else {
                // All players passed - dealer must bid minimum
                this.currentBid = {
                    amount: GAME_SETTINGS.MIN_BID,
                    player: this.currentDealer
                };
                this.phase = GAME_PHASES.TRUMP_SELECTION;
            }
        }
        
        return this.getGameState();
    }
    
    isBiddingComplete() {
        // Bidding is complete when all 4 players have bid
        return this.bids.length === 4;
    }
    
    selectTrump(playerIndex, suit) {
        if (this.phase !== GAME_PHASES.TRUMP_SELECTION) {
            throw new Error('Not in trump selection phase');
        }
        
        if (playerIndex !== this.currentBid.player) {
            throw new Error('Only the winning bidder can select trump');
        }
        
        if (!Object.values(SUITS).includes(suit)) {
            throw new Error('Invalid suit');
        }
        
        this.trump = suit;
        this.currentPlayer = (this.currentDealer + 1) % 4; // Player to left of dealer leads
        this.phase = GAME_PHASES.PLAYING;
        
        return this.getGameState();
    }
    
    // Get the off-jack suit (same color as trump)
    getOffJackSuit() {
        if (!this.trump) return null;
        
        const trumpColor = SUIT_COLORS[this.trump];
        for (const [suit, color] of Object.entries(SUIT_COLORS)) {
            if (suit !== this.trump && color === trumpColor) {
                return suit;
            }
        }
        return null;
    }
    
    // Check if a card is trump (including joker and off-jack considerations)
    isTrump(card) {
        if (!this.trump) return false;
        
        // Joker is always trump
        if (card.rank === RANKS.JOKER) return true;
        
        // Regular trump suit
        if (card.suit === this.trump) return true;
        
        return false;
    }
    
    getGameState() {
        return {
            roomId: this.roomId,
            phase: this.phase,
            players: this.players.map(p => ({
                id: p.id,
                name: p.name,
                team: p.team,
                position: p.position,
                handSize: p.hand.length,
                ready: p.ready
            })),
            currentDealer: this.currentDealer,
            currentBidder: this.currentBidder,
            currentPlayer: this.currentPlayer,
            trump: this.trump,
            currentBid: this.currentBid,
            bids: this.bids,
            scores: this.scores,
            handScores: this.handScores,
            trick: this.trick,
            playedCards: this.playedCards.length
        };
    }
    
    // Get game state for a specific player (includes their hand)
    getPlayerGameState(playerIndex) {
        const gameState = this.getGameState();
        gameState.playerHand = this.players[playerIndex].hand;
        gameState.playerIndex = playerIndex;
        return gameState;
    }
}

module.exports = { Card, Deck, SetbackGame };