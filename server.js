const express = require('express');
const cors = require('cors');
const path = require('path');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'dist')));

let dbClient;
let database;

async function connectDB() {
    try {
        dbClient = new MongoClient(MONGO_URI);
        await dbClient.connect();
        database = dbClient.db("DataPortal");
        console.log("Connected to MongoDB");
    } catch (err) {
        console.error("MongoDB Connection Failed:", err);
    }
}
connectDB();

// API Routes here...

// Serve Frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});