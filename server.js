const express = require('express');
const cors = require('cors');
const path = require('path');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));

const MONGO_URI = process.env.MONGO_URI;
let dbClient;
let database;

async function connectDB() {
    try {
        dbClient = new MongoClient(MONGO_URI);
        await dbClient.connect();
        database = dbClient.db("DataPortal");
        console.log("Connected securely to Cloud MongoDB!");
    } catch (err) {
        console.error("MongoDB Connection Failed:", err);
    }
}
connectDB();

// 1. Get Database Profiles
app.get('/api/profiles', async (req, res) => {
    try {
        const collections = await database.listCollections().toArray();
        let profiles = collections.map(c => c.name);
        if (!profiles.includes('default')) profiles.push('default');
        res.json({ profiles: profiles.sort() });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// 2. Fetch Entire Dynamic Database Profile
app.get('/api/data', async (req, res) => {
    try {
        const profile = req.query.profile || 'default';
        const collection = database.collection(profile);
        const doc = await collection.findOne({ _id: "profile_data" });
        res.json(doc ? doc.data : {});
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 3. Upload Entire New Excel Database Structure
app.post('/api/upload-db', async (req, res) => {
    try {
        const { profile, dbData } = req.body;
        const collection = database.collection(profile || 'default');
        await collection.updateOne({ _id: "profile_data" }, { $set: { data: dbData } }, { upsert: true });
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// 4. Dynamic Inline Cell Update
app.post('/api/update-cell', async (req, res) => {
    const { profile, table, index, field, value } = req.body;
    try {
        const collection = database.collection(profile || 'default');
        const doc = await collection.findOne({ _id: "profile_data" });
        if (!doc || !doc.data[table] || !doc.data[table][index]) return res.status(400).json({ error: "Not found" });

        doc.data[table][index][field] = value;
        await collection.updateOne({ _id: "profile_data" }, { $set: { data: doc.data } });
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// 5. Dynamic Row Deletion
app.post('/api/delete-row', async (req, res) => {
    const { profile, table, index } = req.body;
    try {
        const collection = database.collection(profile || 'default');
        const doc = await collection.findOne({ _id: "profile_data" });
        if (doc && doc.data[table]) {
            doc.data[table].splice(index, 1);
            await collection.updateOne({ _id: "profile_data" }, { $set: { data: doc.data } });
        }
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// 6. Dynamic Row Addition
app.post('/api/add-row', async (req, res) => {
    const { profile, table, rowData } = req.body;
    try {
        const collection = database.collection(profile || 'default');
        const doc = await collection.findOne({ _id: "profile_data" }) || { data: {} };
        if (!doc.data[table]) doc.data[table] = [];
        doc.data[table].unshift(rowData);
        await collection.updateOne({ _id: "profile_data" }, { $set: { data: doc.data } }, { upsert: true });
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Cloud MongoDB Server running on port ${PORT}`));
