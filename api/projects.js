const { connectToDatabase } = require('../lib/mongodb');
const { verifyToken, requireAdmin } = require('../lib/authMiddleware');
const { put } = require('@vercel/blob');
const { ObjectId } = require('mongodb');

function setCors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
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

    // All project operations require authentication
    const user = verifyToken(req, res);
    if (!user) return;

    try {
        const { db } = await connectToDatabase();
        const projectsCol = db.collection('projects');

        // GET — any authenticated user (users see all project names for selection)
        // GET — filter by role and assignment
        if (req.method === 'GET') {
            const isInternal = user.type === 'internal';
            let query = {};

            if (user.role === 'admin') {
                query = {};
            } else if (isInternal) {
                query = { users: user.username };
            } else {
                // External user
                query = { name: user.project };
            }

            const projects = await projectsCol.find(query).toArray();
            
            // If external user and externalPower is false, restrict project data
            if (user.role !== 'admin' && user.type === 'external') {
                return res.status(200).json(projects.map(p => {
                    if (p.externalPower === false) {
                        return {
                            _id: p._id,
                            name: p.name,
                            isRestricted: true,
                            message: 'External Power (advanced features) disabled for this project.'
                        };
                    }
                    return p;
                }));
            }

            return res.status(200).json(projects);
        }

        // POST — admin only
        if (req.method === 'POST') {
            if (user.role !== 'admin') return res.status(403).json({ message: 'Admin access required' });

            let { name, users: assignedUsers, brandImage, externalPower, slaHours } = req.body || {};
            if (!name || !name.trim()) {
                return res.status(400).json({ message: 'Project name is required' });
            }

            brandImage = await uploadImageIfBase64(brandImage, 'projects');

            const project = {
                name: name.trim(),
                users: Array.isArray(assignedUsers) ? assignedUsers : [],
                brandImage: brandImage || null,
                externalPower: externalPower !== undefined ? !!externalPower : true,
                startDate: req.body.startDate || null,
                endDate: req.body.endDate || null,
                slaHours: slaHours ? parseInt(slaHours, 10) : 48
            };

            const result = await projectsCol.insertOne(project);
            return res.status(201).json({ ...project, _id: result.insertedId });
        }

        // PUT — admin only
        if (req.method === 'PUT') {
            if (user.role !== 'admin') return res.status(403).json({ message: 'Admin access required' });

            const { _id, name, users: assignedUsers, brandImage: incomingImage, externalPower, slaHours } = req.body || {};
            if (!_id) return res.status(400).json({ message: '_id is required' });

            const resolvedImage = await uploadImageIfBase64(incomingImage, 'projects');

            const updateData = {};

            if (name) updateData.name = name.trim();
            if (Array.isArray(assignedUsers)) updateData.users = assignedUsers;
            if (resolvedImage !== undefined) updateData.brandImage = resolvedImage || null;
            if (externalPower !== undefined) updateData.externalPower = !!externalPower;
            if (req.body.startDate !== undefined) updateData.startDate = req.body.startDate || null;
            if (req.body.endDate !== undefined) updateData.endDate = req.body.endDate || null;
            if (slaHours !== undefined) updateData.slaHours = parseInt(slaHours, 10) || 48;

            await projectsCol.updateOne({ _id: new ObjectId(_id) }, { $set: updateData });
            return res.status(200).json({ message: 'Project updated successfully' });
        }

        // DELETE — admin only
        if (req.method === 'DELETE') {
            if (user.role !== 'admin') return res.status(403).json({ message: 'Admin access required' });

            const { _id, name } = req.body || {};
            if (_id) {
                await projectsCol.deleteOne({ _id: new ObjectId(_id) });
            } else if (name) {
                await projectsCol.deleteOne({ name });
            } else {
                return res.status(400).json({ message: '_id or name required' });
            }
            return res.status(200).json({ message: 'Project deleted successfully' });
        }

        return res.status(405).json({ message: 'Method Not Allowed' });
    } catch (error) {
        console.error('[projects] Error:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};
