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
        this.handNumber = 1; // Start with hand 1 (first hand)
        
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
        console.log('TESTING - startNewHand function is running');
        console.log('Current dealer before rotation:', this.currentDealer);
        
        // Always rotate dealer (simple test)
        this.currentDealer = (this.currentDealer + 1) % 4;
        console.log('Dealer after rotation:', this.currentDealer);
        console.log('New dealer name:', this.players[this.currentDealer].name);
        
        // Reset for new hand
        this.deck = new Deck();
        this.deck.shuffle();
        this.phase = GAME_PHASES.DEALING;
        this.trump = null;
        this.currentBid = { amount: 0, player: null };
        this.bids = [];
        this.trick = [];
        this.currentTrick = [];
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
        
        console.log('Function complete - returning game state');
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
        console.log('selectTrump called with playerIndex:', playerIndex, 'suit:', suit);
        console.log('this.currentBid.player:', this.currentBid.player);
        
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
        this.currentPlayer = this.currentBid.player; // Winning bidder leads first
        console.log('Set currentPlayer to:', this.currentPlayer);
        
        this.phase = GAME_PHASES.PLAYING;
        this.trick = [];
        this.currentTrick = [];
        this.tricksWon = { team1: 0, team2: 0 };
        this.trickNumber = 1;
        
        console.log('Returning from selectTrump with currentPlayer:', this.currentPlayer);
        return this.getGameState();
    }
    
    playCard(playerIndex, cardIndex) {
        if (this.phase !== GAME_PHASES.PLAYING) {
            throw new Error('Not in playing phase');
        }
        
        if (playerIndex !== this.currentPlayer) {
            throw new Error('Not your turn to play');
        }
        
        const player = this.players[playerIndex];
        if (cardIndex < 0 || cardIndex >= player.hand.length) {
            throw new Error('Invalid card index');
        }
        
        const card = player.hand[cardIndex];
        
        // Validate the play (follow suit rules)
        if (!this.isValidPlay(card, player.hand)) {
            throw new Error('Invalid play - must follow suit if possible');
        }
        
        // Remove card from player's hand and add to current trick
        player.hand.splice(cardIndex, 1);
        this.currentTrick.push({
            card: card,
            player: playerIndex,
            playerName: player.name
        });
        
        // Add to all played cards for scoring
        this.playedCards.push({
            card: card,
            player: playerIndex,
            trick: this.trickNumber
        });
        
        // Check if trick is complete (4 cards played)
        if (this.currentTrick.length === 4) {
            this.completeTrick();
        } else {
            // Move to next player
            this.currentPlayer = (this.currentPlayer + 1) % 4;
        }
        
        return this.getGameState();
    }
    
    isValidPlay(card, hand) {
        // If this is the first card of the trick, any card is valid
        if (this.currentTrick.length === 0) {
            return true;
        }
        
        const leadCard = this.currentTrick[0].card;
        const leadSuit = this.getEffectiveSuit(leadCard);
        const playedSuit = this.getEffectiveSuit(card);
        
        // If playing the same suit as led, it's valid
        if (playedSuit === leadSuit) {
            return true;
        }
        
        // If player has cards of the led suit, they must play them
        const hasLeadSuit = hand.some(c => this.getEffectiveSuit(c) === leadSuit);
        
        // If they don't have the led suit, any card is valid
        return !hasLeadSuit;
    }
    
    getEffectiveSuit(card) {
        // Joker is always trump
        if (card.rank === RANKS.JOKER) {
            return this.trump;
        }
        return card.suit;
    }
    
    completeTrick() {
        // Determine trick winner
        const trickWinner = this.determineTrickWinner();
        const winningTeam = this.players[trickWinner].team;
        
        // Add trick to completed tricks
        this.trick.push({
            cards: [...this.currentTrick],
            winner: trickWinner,
            winnerName: this.players[trickWinner].name,
            winningTeam: winningTeam,
            trickNumber: this.trickNumber
        });
        
        // Update tricks won count
        this.tricksWon[winningTeam]++;
        
        // Clear current trick
        this.currentTrick = [];
        
        // Check if hand is complete (6 tricks)
        if (this.trickNumber === 6) {
            this.completeHand();
        } else {
            // Winner leads next trick
            this.currentPlayer = trickWinner;
            this.trickNumber++;
        }
    }
    
    determineTrickWinner() {
        const leadCard = this.currentTrick[0];
        const leadSuit = this.getEffectiveSuit(leadCard.card);
        
        let winningPlay = leadCard;
        let winningValue = this.getCardValue(leadCard.card, leadSuit);
        
        // Check each subsequent card
        for (let i = 1; i < this.currentTrick.length; i++) {
            const currentPlay = this.currentTrick[i];
            const currentValue = this.getCardValue(currentPlay.card, leadSuit);
            
            if (currentValue > winningValue) {
                winningPlay = currentPlay;
                winningValue = currentValue;
            }
        }
        
        return winningPlay.player;
    }
    
    getCardValue(card, leadSuit) {
        const cardSuit = this.getEffectiveSuit(card);
        
        // Trump cards always beat non-trump cards
        if (cardSuit === this.trump && leadSuit !== this.trump) {
            return 1000 + this.getTrumpRank(card);
        }
        
        // If card matches lead suit or is trump when trump was led
        if (cardSuit === leadSuit) {
            if (cardSuit === this.trump) {
                return 1000 + this.getTrumpRank(card);
            } else {
                return this.getRegularRank(card);
            }
        }
        
        // Card doesn't follow suit and isn't trump - can't win
        return 0;
    }
    
    getTrumpRank(card) {
        if (card.rank === RANKS.JOKER) {
            // Joker ranks between 10 and Jack, so it should have a higher value than 10
            const jokerIndex = TRUMP_RANK_ORDER.indexOf(RANKS.JOKER);
            return TRUMP_RANK_ORDER.length - jokerIndex; // Higher number = higher rank
        }
        const rankIndex = TRUMP_RANK_ORDER.indexOf(card.rank);
        return TRUMP_RANK_ORDER.length - rankIndex; // Higher number = higher rank
    }
    
    getRegularRank(card) {
        const rankIndex = REGULAR_RANK_ORDER.indexOf(card.rank);
        return REGULAR_RANK_ORDER.length - rankIndex; // Higher number = higher rank
    }
    
    completeHand() {
        console.log('=== COMPLETING HAND ===');
        this.phase = GAME_PHASES.SCORING;
        
        // Calculate the 6 points for this hand
        const handPoints = this.calculateHandPoints();
        console.log('Hand points calculated:', handPoints);
        
        // Award points to teams
        this.handScores.team1 = handPoints.team1;
        this.handScores.team2 = handPoints.team2;
        
        // Add to total scores
        this.scores.team1 += handPoints.team1;
        this.scores.team2 += handPoints.team2;
        
        console.log('Total scores after hand:', this.scores);
        
        // Check if game is over (21 points)
        if (this.scores.team1 >= GAME_SETTINGS.WINNING_SCORE || this.scores.team2 >= GAME_SETTINGS.WINNING_SCORE) {
            console.log('Game over! Final scores:', this.scores);
            this.phase = GAME_PHASES.GAME_OVER;
        } else {
            console.log('Hand complete, staying in scoring phase. Hand number:', this.handNumber);
        }
        
        return this.getGameState();
    }
    
    calculateHandPoints() {
        const points = { team1: 0, team2: 0 };
        const trumpCards = this.playedCards.filter(pc => this.isTrump(pc.card));
        
        if (trumpCards.length === 0) {
            // No trump played - only Game point available
            points[this.calculateGamePoint()] += 1;
            return points;
        }
        
        // 1. HIGH - Highest trump played
        const highTrump = this.findHighestTrump(trumpCards);
        if (highTrump) {
            const team = this.players[highTrump.player].team;
            points[team] += 1;
        }
        
        // 2. LOW - Lowest trump played  
        const lowTrump = this.findLowestTrump(trumpCards);
        if (lowTrump) {
            const team = this.players[lowTrump.player].team;
            points[team] += 1;
        }
        
        // 3. JACK - Jack of trump (if played)
        const jackOfTrump = trumpCards.find(pc => 
            pc.card.suit === this.trump && pc.card.rank === RANKS.JACK
        );
        if (jackOfTrump) {
            const team = this.players[jackOfTrump.player].team;
            points[team] += 1;
        }
        
        // 4. OFF-JACK - Jack of same color as trump (if captured)
        const offJackTeam = this.calculateOffJackPoint();
        if (offJackTeam) {
            points[offJackTeam] += 1;
        }
        
        // 5. JOKER - The joker (if played)
        const joker = this.playedCards.find(pc => pc.card.rank === RANKS.JOKER);
        if (joker) {
            const team = this.players[joker.player].team;
            points[team] += 1;
        }
        
        // 6. GAME - Most game points from captured cards
        const gameTeam = this.calculateGamePoint();
        points[gameTeam] += 1;
        
        return points;
    }
    
    findHighestTrump(trumpCards) {
        let highest = null;
        let highestValue = -1;
        
        trumpCards.forEach(pc => {
            const value = this.getTrumpRank(pc.card);
            if (value > highestValue) {
                highestValue = value;
                highest = pc;
            }
        });
        
        return highest;
    }
    
    findLowestTrump(trumpCards) {
        let lowest = null;
        let lowestValue = 999;
        
        trumpCards.forEach(pc => {
            const value = this.getTrumpRank(pc.card);
            if (value < lowestValue) {
                lowestValue = value;
                lowest = pc;
            }
        });
        
        return lowest;
    }
    
    calculateOffJackPoint() {
        const offJackSuit = this.getOffJackSuit();
        if (!offJackSuit) return null;
        
        // Find the off-jack in played cards
        const offJack = this.playedCards.find(pc => 
            pc.card.suit === offJackSuit && pc.card.rank === RANKS.JACK
        );
        
        if (!offJack) return null;
        
        // Find which team captured it (won the trick it was played in)
        const trickWithOffJack = this.trick.find(t => t.trickNumber === offJack.trick);
        return trickWithOffJack ? this.players[trickWithOffJack.winner].team : null;
    }
    
    calculateGamePoint() {
        const teamPoints = { team1: 0, team2: 0 };
        
        // Calculate game points for each team based on captured cards
        this.trick.forEach(trick => {
            const winningTeam = trick.winningTeam;
            trick.cards.forEach(play => {
                teamPoints[winningTeam] += play.card.getGameValue();
            });
        });
        
        // Team with most game points gets the point (tie goes to team1)
        return teamPoints.team1 >= teamPoints.team2 ? 'team1' : 'team2';
    }
    
    // =============================================================================
    // DEBUG / AUTO-PLAY METHODS FOR TESTING
    // =============================================================================
    
    autoPlay() {
        console.log('=== AUTO-PLAY TRIGGERED ===');
        console.log('Current phase:', this.phase);
        console.log('Current player:', this.currentPlayer);
        
        switch (this.phase) {
            case GAME_PHASES.BIDDING:
                return this.autoBid();
            case GAME_PHASES.TRUMP_SELECTION:
                return this.autoSelectTrump();
            case GAME_PHASES.PLAYING:
                return this.autoPlayCard();
            default:
                console.log('No auto-play available for phase:', this.phase);
                return null;
        }
    }
    
    autoBid() {
        const currentBidder = this.currentBidder;
        const currentBidAmount = this.currentBid.amount;
        
        // 60% chance to pass, 40% chance to bid
        if (Math.random() < 0.6 || currentBidAmount >= 5) {
            console.log(`Auto-bidding: Player ${currentBidder} passes`);
            return this.placeBid(currentBidder, 'pass');
        } else {
            // Bid one higher than current bid, but minimum 2
            const bidAmount = Math.max(2, Math.min(currentBidAmount + 1, 6));
            console.log(`Auto-bidding: Player ${currentBidder} bids ${bidAmount}`);
            return this.placeBid(currentBidder, bidAmount);
        }
    }
    
    autoSelectTrump() {
        const biddingPlayer = this.currentBid.player;
        const suits = Object.values(SUITS);
        const randomSuit = suits[Math.floor(Math.random() * suits.length)];
        
        console.log(`Auto trump selection: Player ${biddingPlayer} selects ${randomSuit}`);
        return this.selectTrump(biddingPlayer, randomSuit);
    }
    
    autoPlayCard() {
        const currentPlayer = this.currentPlayer;
        const player = this.players[currentPlayer];
        const hand = player.hand;
        
        if (hand.length === 0) {
            console.log('No cards in hand to auto-play');
            return null;
        }
        
        // Find valid cards to play
        const validCards = [];
        for (let i = 0; i < hand.length; i++) {
            if (this.isValidPlay(hand[i], hand)) {
                validCards.push(i);
            }
        }
        
        if (validCards.length === 0) {
            console.log('No valid cards found');
            return null;
        }
        
        // Play a random valid card
        const cardIndex = validCards[Math.floor(Math.random() * validCards.length)];
        const card = hand[cardIndex];
        
        console.log(`Auto-playing: Player ${currentPlayer} plays ${card.rank} of ${card.suit}`);
        return this.playCard(currentPlayer, cardIndex);
    }
    
    // Fast-forward through entire bidding phase
    autoCompleteBidding() {
        console.log('=== AUTO-COMPLETING BIDDING ===');
        let attempts = 0;
        while (this.phase === GAME_PHASES.BIDDING && attempts < 20) {
            this.autoBid();
            attempts++;
        }
        return this.getGameState();
    }
    
    // Auto-play entire hand to completion
    autoCompleteHand() {
        console.log('=== AUTO-COMPLETING HAND ===');
        console.log('Starting phase:', this.phase);
        console.log('Starting hand number:', this.handNumber);
        console.log('Starting dealer:', this.currentDealer);
        
        // Complete bidding if needed
        if (this.phase === GAME_PHASES.BIDDING) {
            this.autoCompleteBidding();
        }
        
        // Auto-select trump if needed
        if (this.phase === GAME_PHASES.TRUMP_SELECTION) {
            this.autoSelectTrump();
        }
        
        // Auto-play all cards
        let attempts = 0;
        while (this.phase === GAME_PHASES.PLAYING && attempts < 50) {
            this.autoPlayCard();
            attempts++;
        }
        
        console.log('Hand auto-completion finished.');
        console.log('Final phase:', this.phase);
        console.log('Final hand number:', this.handNumber);
        console.log('Final dealer:', this.currentDealer);
        console.log('Scores:', this.scores);
        
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
            currentTrick: this.currentTrick,
            playedCards: this.playedCards.length,
            trickNumber: this.trickNumber || 1,
            tricksWon: this.tricksWon || { team1: 0, team2: 0 }
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