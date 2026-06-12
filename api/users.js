const { connectToDatabase } = require('../lib/mongodb');
const { verifyToken, requireAdmin } = require('../lib/authMiddleware');
const { ObjectId } = require('mongodb');

function setCors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

module.exports = async function handler(req, res) {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    // ── Auth first — before any DB connection ──────────────────────────────
    const isWrite = ['POST', 'PUT', 'DELETE'].includes(req.method);
    const user = verifyToken(req, res);
    if (!user) return;

    // Additional authorization for write operations
    if (isWrite && user.role !== 'admin' && !user.canManageSubUsers) {
        // Allow users to update their own profile via PUT
        const isSelfUpdate = req.method === 'PUT' && req.body && String(req.body._id) === String(user.userId || user._id);
        if (!isSelfUpdate) {
            return res.status(403).json({ message: 'Unauthorized. Admin, Client Lead, or self-update access required.' });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const usersCol = db.collection('users');

        // GET — admin sees all; other roles see only their own record (or project members for Managers)
        if (req.method === 'GET') {
            const users = await usersCol.find({}, { projection: { password: 0 } }).toArray();
            if (user.role === 'admin') return res.status(200).json(users);
            
            // External managers (Lead, Owner, POC) see everyone in their project
            const isExternalManager = user.role !== 'admin' && (user.canManageSubUsers || user.isOwner || user.isPOC);
            if (isExternalManager && user.project) {
                return res.status(200).json(users.filter(u => u.project === user.project));
            }

            // Normal users see only themselves
            return res.status(200).json(users.filter(u => u.name === user.username));
        }

        // POST — create user
        if (req.method === 'POST') {
            let { name, password, type, designation, project, status } = req.body || {};
            
            const isExternalManager = user.role !== 'admin' && (user.canManageSubUsers || user.isOwner || user.isPOC);
            if (isExternalManager) {
                type = 'external';
                project = user.project;
                req.body.canManageSubUsers = false;
                req.body.isOwner = false;
                req.body.isPOC = false;
            }

            if (!name || !password || !type || !designation) {
                return res.status(400).json({ message: 'name, password, type, and designation are required' });
            }
            if (type === 'external' && !project) {
                return res.status(400).json({ message: 'project is required for external (client) users' });
            }

            const existing = await usersCol.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
            if (existing) return res.status(409).json({ message: 'Username already exists' });

            const newUser = { 
                name: name.trim(), 
                password: password.trim(), 
                type: type, 
                designation: designation, 
                project: project || '', 
                status: status || 'active',
                canManageSubUsers: !!req.body.canManageSubUsers, // only admin can set this to true
                isOwner: !!req.body.isOwner,
                isPOC: !!req.body.isPOC,
                assignedEmployee: req.body.assignedEmployee || '',
                fullName: req.body.fullName || name.trim(),
                allowProfileImage: !!req.body.allowProfileImage,
                profileImage: req.body.profileImage || null
            };
            const result = await usersCol.insertOne(newUser);
            const { password: _pw, ...safeUser } = newUser;
            return res.status(201).json({ ...safeUser, _id: result.insertedId });
        }

        // PUT — update user
        if (req.method === 'PUT') {
            const { _id, ...updateData } = req.body || {};
            if (!_id) return res.status(400).json({ message: '_id is required' });

            const target = await usersCol.findOne({ _id: new ObjectId(_id) });
            if (!target) return res.status(404).json({ message: 'User not found' });

            // Authorization for External Managers
            const isExternalManager = user.role !== 'admin' && (user.canManageSubUsers || user.isOwner || user.isPOC);
            if (isExternalManager) {
                // Can only update users in their project
                if (target.project !== user.project) {
                    return res.status(403).json({ message: 'You can only manage users in your project.' });
                }
                // Cannot update security fields
                delete updateData.project;
                delete updateData.canManageSubUsers;
                delete updateData.isOwner;
                delete updateData.isPOC;
                delete updateData.type;
                delete updateData.role;
                delete updateData.status; 
            }

            // Normal users (non-admin, non-manager) also cannot update security fields if they are self-updating
            if (user.role !== 'admin' && !user.canManageSubUsers) {
                delete updateData.project;
                delete updateData.canManageSubUsers;
                delete updateData.isOwner;
                delete updateData.isPOC;
                delete updateData.type;
                delete updateData.role;
                delete updateData.status;
            }

            if (updateData.password !== undefined && !updateData.password.trim()) delete updateData.password;
            
            // Re-validate external user project requirement
            const finalType = updateData.type || target.type;
            const finalProject = updateData.project !== undefined ? updateData.project : target.project;
            if (finalType === 'external' && !finalProject) {
                return res.status(400).json({ message: 'Project is required for external (client) users' });
            }

            await usersCol.updateOne({ _id: new ObjectId(_id) }, { $set: updateData });
            return res.status(200).json({ message: 'User updated successfully' });
        }

        // DELETE — remove user (admin only)
        if (req.method === 'DELETE') {
            if (user.role !== 'admin') {
                return res.status(403).json({ message: 'External Managers cannot delete users. Change status to Inactive instead.' });
            }
            const { _id, name } = req.body || {};
            if (_id) {
                await usersCol.deleteOne({ _id: new ObjectId(_id) });
            } else if (name) {
                await usersCol.deleteOne({ name });
            } else {
                return res.status(400).json({ message: '_id or name required' });
            }
            return res.status(200).json({ message: 'User deleted successfully' });
        }

        return res.status(405).json({ message: 'Method Not Allowed' });
    } catch (error) {
        console.error('[users] Error:', error.message);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};
