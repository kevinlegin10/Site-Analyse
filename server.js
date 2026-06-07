const express = require('express');
const cors = require('cors');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));

const DB_DIR = path.join(__dirname, 'databases');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

// In-memory cache: avoids re-reading disk on every request
const cache = {};

function getDBPath(profile) {
    const safe = (profile || 'default').replace(/[^a-zA-Z0-9_\-]/g, '');
    return path.join(DB_DIR, `DB_${safe}.json`);
}

async function readDB(profile) {
    if (cache[profile]) return cache[profile];
    try {
        const raw = await fsp.readFile(getDBPath(profile), 'utf8');
        cache[profile] = JSON.parse(raw);
    } catch {
        cache[profile] = {};
    }
    return cache[profile];
}

async function writeDB(profile, data) {
    cache[profile] = data;
    await fsp.writeFile(getDBPath(profile), JSON.stringify(data, null, 2), 'utf8');
}

// --- Routes ---

app.get('/api/profiles', (req, res) => {
    try {
        const files = fs.readdirSync(DB_DIR);
        const profiles = files
            .filter(f => f.startsWith('DB_') && f.endsWith('.json'))
            .map(f => f.slice(3, -5));
        if (!profiles.includes('default')) profiles.push('default');
        res.json({ profiles: profiles.sort() });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/data', async (req, res) => {
    try {
        res.json(await readDB(req.query.profile));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/upload-db', async (req, res) => {
    try {
        const { profile, dbData } = req.body;
        if (!dbData || typeof dbData !== 'object') return res.status(400).json({ error: 'Invalid data' });
        await writeDB(profile, dbData);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/update-cell', async (req, res) => {
    try {
        const { profile, table, index, field, value } = req.body;
        const db = await readDB(profile);
        if (!db[table] || db[table][index] === undefined)
            return res.status(400).json({ error: 'Row not found' });
        db[table][index][field] = value;
        await writeDB(profile, db);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/delete-row', async (req, res) => {
    try {
        const { profile, table, index } = req.body;
        const db = await readDB(profile);
        if (!db[table]) return res.status(400).json({ error: 'Table not found' });
        db[table].splice(index, 1);
        await writeDB(profile, db);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/add-row', async (req, res) => {
    try {
        const { profile, table, rowData } = req.body;
        const db = await readDB(profile);
        if (!db[table]) db[table] = [];
        db[table].unshift(rowData);
        await writeDB(profile, db);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Invalidate cache entry on profile switch (optional endpoint for future use)
app.post('/api/invalidate-cache', (req, res) => {
    const { profile } = req.body;
    if (profile && cache[profile]) delete cache[profile];
    res.json({ success: true });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 80;
app.listen(PORT, '0.0.0.0', () => console.log(`DataPortal running on http://localhost:${PORT}`));
