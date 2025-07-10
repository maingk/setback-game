// Game constants and enums
const SUITS = {
    SPADES: 'spades',
    HEARTS: 'hearts',
    DIAMONDS: 'diamonds',
    CLUBS: 'clubs'
};

const RANKS = {
    TWO: '2',
    THREE: '3',
    FOUR: '4',
    FIVE: '5',
    SIX: '6',
    SEVEN: '7',
    EIGHT: '8',
    NINE: '9',
    TEN: '10',
    JACK: 'J',
    QUEEN: 'Q',
    KING: 'K',
    ACE: 'A',
    JOKER: 'JOKER'
};

// Card values for "Game" point calculation
const CARD_VALUES = {
    [RANKS.ACE]: 4,
    [RANKS.KING]: 3,
    [RANKS.QUEEN]: 2,
    [RANKS.JACK]: 1,
    [RANKS.TEN]: 10,
    [RANKS.JOKER]: 1,
    // All other cards are worth 0 for game points
};

// Trump ranking order (highest to lowest when suit is trump)
// Note: Joker fits between 10 and Jack
const TRUMP_RANK_ORDER = [
    RANKS.ACE,      // Highest trump
    RANKS.KING,
    RANKS.QUEEN,
    RANKS.JACK,     // Jack of trump
    RANKS.JOKER,    // Joker (always trump, between 10 and Jack)
    RANKS.TEN,
    RANKS.NINE,
    RANKS.EIGHT,
    RANKS.SEVEN,
    RANKS.SIX,
    RANKS.FIVE,
    RANKS.FOUR,
    RANKS.THREE,
    RANKS.TWO       // Lowest trump
];

// Non-trump ranking order (highest to lowest)
const REGULAR_RANK_ORDER = [
    RANKS.ACE,
    RANKS.KING,
    RANKS.QUEEN,
    RANKS.JACK,
    RANKS.TEN,
    RANKS.NINE,
    RANKS.EIGHT,
    RANKS.SEVEN,
    RANKS.SIX,
    RANKS.FIVE,
    RANKS.FOUR,
    RANKS.THREE,
    RANKS.TWO
];

// Suit colors for off-jack calculation
const SUIT_COLORS = {
    [SUITS.SPADES]: 'black',
    [SUITS.CLUBS]: 'black',
    [SUITS.HEARTS]: 'red',
    [SUITS.DIAMONDS]: 'red'
};

// Game settings
const GAME_SETTINGS = {
    PLAYERS_PER_GAME: 4,
    CARDS_PER_PLAYER: 6,
    WINNING_SCORE: 21,
    MIN_BID: 2,
    MAX_BID: 6,
    POINTS_PER_HAND: [
        'HIGH',     // Highest trump played
        'LOW',      // Lowest trump played  
        'JACK',     // Jack of trump (if played)
        'OFF_JACK', // Jack of same color as trump
        'JOKER',    // Joker (if played)
        'GAME'      // Most game points from captured cards
    ]
};

// Game phases
const GAME_PHASES = {
    WAITING: 'waiting',
    DEALING: 'dealing',
    BIDDING: 'bidding',
    TRUMP_SELECTION: 'trump_selection',
    PLAYING: 'playing',
    SCORING: 'scoring',
    GAME_OVER: 'game_over'
};

// Export for Node.js or browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        SUITS,
        RANKS,
        CARD_VALUES,
        TRUMP_RANK_ORDER,
        REGULAR_RANK_ORDER,
        SUIT_COLORS,
        GAME_SETTINGS,
        GAME_PHASES
    };
} else {
    // Browser global
    window.GameConstants = {
        SUITS,
        RANKS,
        CARD_VALUES,
        TRUMP_RANK_ORDER,
        REGULAR_RANK_ORDER,
        SUIT_COLORS,
        GAME_SETTINGS,
        GAME_PHASES
    };
}