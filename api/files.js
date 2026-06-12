const { connectToDatabase } = require('../lib/mongodb');
const { verifyToken, requireAdmin } = require('../lib/authMiddleware');
const { put } = require('@vercel/blob');
const { ObjectId } = require('mongodb');

function setCors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

/**
 * Uploads a file (base64) to Vercel Blob.
 * Falls back to returning the base64 string if upload fails.
 */
async function uploadFile(base64String, fileName, contentType) {
    if (!base64String || !base64String.includes('base64,')) return base64String;
    try {
        const base64Data = base64String.split('base64,')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        const blob = await put(`shared-files/${Date.now()}-${fileName.replace(/\s+/g, '_')}`, buffer, {
            access: 'public',
            contentType: contentType || 'application/octet-stream'
        });
        return blob.url;
    } catch (err) {
        console.warn(`[files] Vercel Blob failed: ${err.message}. Storing as base64 fallback.`);
        return base64String; // Fallback to base64 in DB
    }
}

module.exports = async function handler(req, res) {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { db } = await connectToDatabase();
        const filesCol = db.collection('files');

        // GET — Fetch files based on role/project
        if (req.method === 'GET') {
            const user = verifyToken(req, res);
            if (!user) return;

            let query = {};
            if (user.role !== 'admin') {
                const isInternal = user.type === 'internal';
                if (isInternal) {
                    // Internal users: see their assigned projects + Global
                    const projectsCol = db.collection('projects');
                    const myProjects = await projectsCol.find({ users: user.username }).toArray();
                    const myProjectNames = myProjects.map(p => p.name);
                    query = {
                        $or: [
                            { project: 'Global' },
                            { project: { $in: myProjectNames } }
                        ]
                    };
                } else {
                    // External users: see their project + Global
                    query = {
                        $or: [
                            { project: 'Global' },
                            { project: user.project || 'Unassigned' }
                        ]
                    };
                }
            }

            const files = await filesCol.find(query).sort({ createdAt: -1 }).toArray();
            return res.status(200).json(files);
        }

        // POST — Admin only: Upload file
        if (req.method === 'POST') {
            const user = requireAdmin(req, res);
            if (!user) return;

            const { name, type, size, project, fileData } = req.body || {};

            if (!name || !fileData) {
                return res.status(400).json({ message: 'File name and data are required' });
            }

            const url = await uploadFile(fileData, name, type);

            const fileDoc = {
                name,
                type,
                size,
                project: project || 'Global',
                url,
                uploadedBy: user.username,
                createdAt: new Date().toISOString()
            };

            const result = await filesCol.insertOne(fileDoc);
            return res.status(201).json({ ...fileDoc, _id: result.insertedId });
        }

        // DELETE — Admin only
        if (req.method === 'DELETE') {
            const user = requireAdmin(req, res);
            if (!user) return;

            const { _id } = req.body || {};
            if (!_id) return res.status(400).json({ message: '_id is required' });

            // Note: Ideally we should also delete from Vercel Blob, but Vercel Blob API doesn't 
            // easily support deleting by URL alone without a specific token-based call or tracking the path.
            // For now we'll just remove from DB. In production, you'd call `del(url)`.
            
            await filesCol.deleteOne({ _id: new ObjectId(_id) });
            return res.status(200).json({ message: 'File record deleted successfully' });
        }

        return res.status(405).json({ message: 'Method Not Allowed' });
    } catch (error) {
        console.error('[files] Error:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};
