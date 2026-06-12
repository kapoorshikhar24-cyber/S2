const { connectToDatabase } = require('../lib/mongodb');
const { verifyToken } = require('../lib/authMiddleware');
const { ObjectId } = require('mongodb');

function setCors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

module.exports = async function handler(req, res) {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    const user = verifyToken(req, res);
    if (!user) return;

    try {
        const { db } = await connectToDatabase();
        const notifsCol = db.collection('notifications');
        const projectsCol = db.collection('projects');

        const isInternal = user.type === 'internal';

        // GET — filter by visibility
        if (req.method === 'GET') {
            let notifications;

            if (user.role === 'admin') {
                notifications = await notifsCol.find({}).sort({ _id: -1 }).toArray();
            } else if (isInternal) {
                // Find projects this internal user is assigned to
                const myProjects = await projectsCol.find({ users: user.username }).toArray();
                const myProjectNames = myProjects.map(p => p.name);
                notifications = await notifsCol
                    .find({ project: { $in: myProjectNames } })
                    .sort({ _id: -1 })
                    .toArray();
            } else {
                // External user: see notifications for their project IF they didn't submit it,
                // OR see their own submissions IF there is an unread response (userRead: false).
                const myProject = user.project || 'Unassigned';
                notifications = await notifsCol.find({
                    $or: [
                        { project: myProject, submittedBy: { $ne: user.username } },
                        { submittedBy: user.username, userRead: false }
                    ]
                }).sort({ _id: -1 }).toArray();
            }

            return res.status(200).json(notifications);
        }

        // POST — create notification (called internally when entry is submitted)
        if (req.method === 'POST') {
            const notification = req.body;
            if (!notification) return res.status(400).json({ message: 'Body required' });

            // IMPORTANT: reuse the entry's _id (as an ObjectId) so that future syncs
            // via `notifsCol.updateOne({ _id: new ObjectId(entryId) })` actually match.
            const notifToInsert = { ...notification, read: false };
            if (notification._id) {
                try { notifToInsert._id = new ObjectId(notification._id); } catch (_) {}
            }

            const result = await notifsCol.insertOne(notifToInsert);
            return res.status(201).json({ ...notifToInsert, _id: result.insertedId });
        }

        // PUT — mark as read (single or all), or update fields
        if (req.method === 'PUT') {
            const { _id, markAllRead, ...extraFields } = req.body || {};
            const entriesCol = db.collection('entries');

            if (markAllRead) {
                if (user.role === 'admin') {
                    await notifsCol.updateMany({}, { $set: { read: true } });
                    await entriesCol.updateMany({}, { $set: { read: true } });
                } else if (isInternal) {
                    const myProjects = await projectsCol.find({ users: user.username }).toArray();
                    const myProjectNames = myProjects.map(p => p.name);
                    const filter = { project: { $in: myProjectNames } };
                    await notifsCol.updateMany(filter, { $set: { read: true } });
                    await entriesCol.updateMany(filter, { $set: { read: true } });
                } else if (user.project) {
                    const filter = { project: user.project };
                    await notifsCol.updateMany(filter, { $set: { read: true } });
                    await entriesCol.updateMany(filter, { $set: { read: true } });
                }
                return res.status(200).json({ message: 'All marked as read' });
            }

            if (_id) {
                // Build update: always mark read; merge any extra field updates
                const updateSet = { read: true, ...extraFields };
                let pushSet = null;

                if (updateSet.newComment) {
                    const comment = updateSet.newComment;
                    
                    // SECURITY: Enforce author from verified user session
                    comment.author = user.name || user.username || 'System';
                    
                    // SECURITY: Enforce type based on role
                    if (!(user.role === 'admin' || isInternal)) {
                        comment.type = 'Customer';
                    } else {
                        // Admins can be CCC or Customer, but default to 'CCC' if type missing
                        comment.type = comment.type || 'CCC';
                    }

                    comment.timestamp = new Date().toISOString();
                    
                    pushSet = { comments: comment };
                    delete updateSet.newComment;
                }

                // If admin/internal is setting internalComment, status, or pushing a CCC comment, notify the user
                if (user.role === 'admin' || isInternal) {
                    if ('internalComment' in extraFields || 'status' in extraFields || pushSet) {
                        updateSet.userRead = false;
                        updateSet.date = new Date().toISOString(); // Refresh for sort
                    }
                } else {
                    // Client updating remark/status or pushing customer comment
                    if ('customerStatus' in extraFields || 'customerComment' in extraFields || pushSet) {
                        updateSet.read = false; // Unread for admin
                        updateSet.date = new Date().toISOString(); // Refresh for sort
                    }
                }

                const queryOperator = { $set: updateSet };
                if (pushSet) {
                    queryOperator.$push = pushSet;
                }

                await notifsCol.updateOne({ _id: new ObjectId(_id) }, queryOperator);
                // Keep entries collection in sync
                try {
                    await entriesCol.updateOne({ _id: new ObjectId(_id) }, queryOperator);
                } catch (_) { /* ignore */ }

                return res.status(200).json({ message: 'Updated' });
            }

            return res.status(400).json({ message: '_id or markAllRead required' });
        }

        return res.status(405).json({ message: 'Method Not Allowed' });
    } catch (error) {
        console.error('[notifications] Error:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};
