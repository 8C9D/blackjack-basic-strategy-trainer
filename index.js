import express from 'express';
import pkg from 'pg';
const { Pool } = pkg;

import dotenv from 'dotenv';

const app = express();

const cardSuits = ['S', 'C', 'D', 'H'];
const cardRanks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const actions = ["Split", "Hit", "Stand", "Double", "Surrender", "Insurance"];

const rankValueTen = ['10', 'J', 'Q', 'K'];
const blackjackCombos = ['A10', 'AJ', 'AQ', 'AK', '10A', 'JA', 'QA', 'KA'];

dotenv.config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT
});

let playerCard1 = {rank: '', suit: ''};
let playerCard2 = {rank: '', suit: ''};
let dealerUpcard = {rank: '', suit: ''};

// Middleware to specify the location of static files
app.use(express.static("public"));

async function checkDecision(userDecision, playerCard1, playerCard2, dealerUpcard){

    // console.log(playerCard1);
    // console.log(playerCard2);
    // console.log(dealerUpcard);

    let optDecision = '';
    let res = [];

    if (playerCard1.rank === playerCard2.rank || (rankValueTen.includes(playerCard1.rank) && rankValueTen.includes(playerCard2.rank))){ // Pair logic

        res = await pool.query(
            "SELECT optimal_decision FROM pairs WHERE player_pair=$1 AND dealer_upcard=$2", 
            [`${playerCard1.rank}${playerCard2.rank}`, `${dealerUpcard.rank}`]);
    } else if (playerCard1.rank === 'A' || playerCard2.rank === 'A'){ // Soft total logic
        res = await pool.query(
            "SELECT optimal_decision FROM soft_totals WHERE player_cards=$1 AND dealer_upcard=$2", 
            [`${playerCard1.rank}${playerCard2.rank}`, `${dealerUpcard.rank}`]);
    } else { // Hard total logic
        let player_total = 0;

        // Logic to handle J, Q, K
        if (rankValueTen.includes(playerCard1.rank)){
            player_total += 10;
            player_total += parseInt(playerCard2.rank)
        } else if (rankValueTen.includes(playerCard2.rank)){
            player_total += 10;
            player_total += parseInt(playerCard1.rank)
        } else{
            player_total += parseInt(playerCard1.rank);
            player_total += parseInt(playerCard2.rank);
        }

        // console.log(player_total);

        res = await pool.query(
            "SELECT optimal_decision FROM hard_totals WHERE player_total=$1 AND dealer_upcard=$2", 
            [player_total, `${dealerUpcard.rank}`]);        
    }

    optDecision = res.rows[0].optimal_decision;

    // console.log(optDecision);
    // console.log(userDecision === optDecision);

    return {isOptimal: userDecision === optDecision, optimalDecision: optDecision};
}

function randomRank(){
    const randomRank = cardRanks[Math.floor(Math.random() * cardRanks.length)];
    return randomRank;
}

function randomSuit(){
    const randomSuit = cardSuits[Math.floor(Math.random() * cardSuits.length)];
    return randomSuit;
}

app.get("/", (req, res) =>{
    // Stick to Standard Gameplay:

    // Deal Player Card 1
    playerCard1.rank = randomRank();
    playerCard1.suit = randomSuit();

    // Deal Dealer Card 1 (Face Up)
    dealerUpcard.rank = randomRank();
    dealerUpcard.suit = randomSuit();

    // Deal Player Card 2
    playerCard2.rank = randomRank();
    playerCard2.suit = randomSuit();

    res.render("index.ejs", {playerCard1: playerCard1, dealerUpcard: dealerUpcard, playerCard2: playerCard2, isBlackjack: blackjackCombos.includes(playerCard1.rank+playerCard2.rank)});
});


// Routes to handle user choices
actions.forEach(action => {
    app.post(`/${action.toLowerCase()}`, async (req, res) => {
        let data = await checkDecision(action, playerCard1, playerCard2, dealerUpcard);
        // console.log(data);

        res.render("decision_feedback.ejs", {
            playerCard1,
            dealerUpcard,
            playerCard2,
            isOptimal: data.isOptimal,
            optimalDecision: data.optimalDecision
        });
    });
});

app.listen(process.env.PORT, () =>{
    console.log("Server running on port 3000");
});