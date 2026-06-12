const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;

// Module-level cached connection — critical for Vercel serverless cold starts
let cachedClient = null;
let cachedDb = null;

async function connectToDatabase() {
    if (cachedClient && cachedDb) {
        return { client: cachedClient, db: cachedDb };
    }

    if (!uri) {
        throw new Error('MONGODB_URI environment variable is not defined');
    }

    const client = new MongoClient(uri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 10000,
    });

    await client.connect();

    const dbName = process.env.MONGODB_DB || 'dashboard';
    const db = client.db(dbName);

    cachedClient = client;
    cachedDb = db;

    return { client, db };
}

module.exports = { connectToDatabase };
