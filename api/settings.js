const { connectToDatabase } = require('../lib/mongodb');
const { verifyToken } = require('../lib/authMiddleware');
const { put } = require('@vercel/blob');

function setCors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

async function uploadImageIfBase64(base64String, folder) {
    if (!base64String || !base64String.startsWith('data:image')) return base64String;
    try {
        const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const blob = await put(`${folder}/${Date.now()}.jpg`, buffer, {
            access: 'public',
            contentType: 'image/jpeg'
        });
        return blob.url;
    } catch (err) {
        console.warn(`[storage] Vercel Blob failed (${err.message}). Storing as base64.`);
        return base64String;
    }
}

module.exports = async function handler(req, res) {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    const user = verifyToken(req, res);
    if (!user) {
        console.warn('[settings] Unauthorized attempt to access settings');
        return;
    }

    try {
        const { db } = await connectToDatabase();
        if (!db) throw new Error('Failed to connect to database');
        
        const settingsCol = db.collection('settings');

        // GET — any authenticated user can read settings
        if (req.method === 'GET') {
            try {
                const settings = await settingsCol.findOne({ type: 'global' });
                return res.status(200).json(settings || {});
            } catch (findErr) {
                console.error('[settings] Error fetching global settings:', findErr.message);
                return res.status(500).json({ message: 'Error fetching settings' });
            }
        }

        // POST — admin only
        if (req.method === 'POST') {
            if (user.role !== 'admin') {
                console.warn(`[settings] Non-admin user (${user.username}) tried to update settings`);
                return res.status(403).json({ message: 'Admin access required' });
            }

            let { dashboardLogo } = req.body || {};
            
            try {
                if (dashboardLogo && dashboardLogo.startsWith('data:image')) {
                    dashboardLogo = await uploadImageIfBase64(dashboardLogo, 'branding');
                }

                const update = {
                    type: 'global',
                    dashboardLogo: dashboardLogo || null,
                    updatedAt: new Date()
                };

                await settingsCol.updateOne(
                    { type: 'global' },
                    { $set: update },
                    { upsert: true }
                );

                return res.status(200).json({ message: 'Settings updated', dashboardLogo });
            } catch (saveErr) {
                console.error('[settings] Error saving settings:', saveErr.message);
                return res.status(500).json({ message: 'Error saving settings: ' + saveErr.message });
            }
        }

        return res.status(405).json({ message: 'Method Not Allowed' });
    } catch (error) {
        console.error('[settings] General Error:', error.message);
        return res.status(500).json({ message: 'Internal Server Error: ' + error.message });
    }
};
