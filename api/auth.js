const { connectToDatabase } = require('../lib/mongodb');
const { signToken } = require('../lib/authMiddleware');

// Hardcoded admin account — override by setting ADMIN_PASSWORD env var
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

module.exports = async function handler(req, res) {
    // CORS headers for Vercel deployment
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

    const { username, password } = req.body || {};

    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }

    const cleanUsername = username.trim().toLowerCase();
    const cleanPassword = password.trim();

    // 1. Check hardcoded admin account — handle entirely without DB
    if (cleanUsername === 'admin') {
        if (cleanPassword !== ADMIN_PASSWORD) {
            return res.status(401).json({ message: 'Incorrect Password' });
        }
        const token = signToken({ username: 'admin', role: 'admin', type: null, designation: null, project: null });
        return res.status(200).json({
            message: 'Login successful',
            token,
            user: { username: 'admin', role: 'admin', type: null, designation: null, project: null }
        });
    }

    // 2. Check dynamic users in MongoDB
    try {
        const { db } = await connectToDatabase();
        const allUsers = await db.collection('users').find({}).toArray();
        const userRec = allUsers.find(u => u.name && u.name.trim().toLowerCase() === cleanUsername);

        if (!userRec) {
            return res.status(401).json({ message: 'Incorrect ID' });
        }
        
        if (userRec.password.trim() !== cleanPassword) {
            return res.status(401).json({ message: 'Incorrect Password' });
        }

        // Check if account is inactive
        if (userRec.status === 'inactive') {
            return res.status(401).json({ message: 'Account is inactive. Please contact support.' });
        }

        const payload = {
            userId: userRec._id,
            username: userRec.name.trim(),
            role: 'user',
            type: userRec.type || null,
            designation: userRec.designation || null,
            project: userRec.project || null,
            status: userRec.status || 'active',
            canManageSubUsers: !!userRec.canManageSubUsers,
            isOwner: !!userRec.isOwner,
            isPOC: !!userRec.isPOC,
            fullName: userRec.fullName || userRec.name.trim(),
            profileImage: userRec.profileImage || null
        };

        const token = signToken(payload);

        // --- Log Login Activity ---
        try {
            await db.collection('login_logs').insertOne({
                username: userRec.name.trim(),
                fullName: userRec.fullName || userRec.name.trim(),
                type: userRec.type || 'internal',
                project: userRec.project || null,
                timestamp: new Date()
            });
        } catch (logErr) {
            console.error('[auth] Logging failed:', logErr);
        }

        return res.status(200).json({ 
            token: token, 
            ...payload 
        });

    } catch (error) {
        console.error('[auth] DB error:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};
