const { connectToDatabase } = require('../lib/mongodb');
const { verifyToken } = require('../lib/authMiddleware');

function setCors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

module.exports = async function handler(req, res) {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ message: 'Method Not Allowed' });

    const user = verifyToken(req, res);
    if (!user) return;

    try {
        const { db } = await connectToDatabase();
        const logsCol = db.collection('login_logs');

        let query = {};

        // Role-Based Filtering
        const isAdmin = user.role === 'admin';
        const isInternal = user.type === 'internal';
        const isExternalManager = (user.type === 'external' && (user.canManageSubUsers || user.isOwner || user.isPOC));

        if (isAdmin || isInternal) {
            // Can see all
            query = {};
        } else if (isExternalManager && user.project) {
            // Can see all users in their project
            query = { project: user.project };
        } else {
            // Standard user sees only themselves
            query = { username: user.username };
        }

        const logs = await logsCol.find(query).sort({ timestamp: -1 }).limit(100).toArray();
        return res.status(200).json(logs);

    } catch (error) {
        console.error('[login-history] API Error:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};
