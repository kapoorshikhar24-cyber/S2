const { connectToDatabase } = require('../lib/mongodb');
const { verifyToken } = require('../lib/authMiddleware');
const { put } = require('@vercel/blob');
const { ObjectId } = require('mongodb');

function setCors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

async function uploadImageIfBase64(base64String) {
    if (!base64String || !base64String.startsWith('data:image')) return base64String;
    try {
        const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const blob = await put(`entries/${Date.now()}.jpg`, buffer, {
            access: 'public',
            contentType: 'image/jpeg'
        });
        return blob.url;
    } catch (err) {
        console.warn(`[entries] Vercel Blob failed (${err.message}). Storing as base64.`);
        return base64String;
    }
}

module.exports = async function handler(req, res) {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    const user = verifyToken(req, res);
    if (!user) return;

    try {
        const { db } = await connectToDatabase();
        const entriesCol = db.collection('entries');
        const notifsCol  = db.collection('notifications');

        // GET — filter by project access
        if (req.method === 'GET') {
            const isInternal = user.type === 'internal';
            let entries;

            if (user.role === 'admin') {
                entries = await entriesCol.find({}).sort({ _id: -1 }).toArray();
            } else if (isInternal) {
                const projectsCol = db.collection('projects');
                const myProjects = await projectsCol.find({ users: user.username }).toArray();
                const myNames = myProjects.map(p => p.name);
                entries = await entriesCol.find({ project: { $in: myNames } }).sort({ _id: -1 }).toArray();
            } else {
                // External user: see all entries for their project OR things they submitted
                const myProject = user.project || 'Unassigned';
                entries = await entriesCol.find({
                    $or: [
                        { project: myProject },
                        { submittedBy: user.username }
                    ]
                }).sort({ _id: -1 }).toArray();
            }
            return res.status(200).json(entries);
        }

        // POST — submit entries
        if (req.method === 'POST') {

            let { image, remark, pageModule, project } = req.body || {};

            if (!pageModule) return res.status(400).json({ message: 'pageModule is required' });
            if (!image && !remark) return res.status(400).json({ message: 'Image or remark is required' });

            image = await uploadImageIfBase64(image);
            
            const projectName = project || user.project || 'Unassigned';
            
            // Lookup SLA Hours for the project
            const projectsCol = db.collection('projects');
            const projectDoc = await projectsCol.findOne({ name: projectName });
            const slaHours = (projectDoc && projectDoc.slaHours) ? projectDoc.slaHours : 48;
            
            const createDate = new Date();
            const deadlineDate = new Date(createDate.getTime() + (slaHours * 60 * 60 * 1000));

            const entry = {
                image: image || null,
                remark: remark || '',
                pageModule,
                project: projectName,
                submittedBy: user.username,
                date: createDate.toISOString(),
                slaDeadline: deadlineDate.toISOString(),
                status: 'Backlog',
                solvedDate: '',
                internalComment: '',
                customerStatus: 'Pending',
                customerComment: '',
                read: false,
                userRead: true  // user already knows about their own submission
            };

            const result = await entriesCol.insertOne(entry);
            return res.status(201).json({ ...entry, _id: result.insertedId });
        }

        // PUT — admin/manager update status/comments; user updates customerStatus/customerComment
        if (req.method === 'PUT') {
            const { _id, ...updateData } = req.body || {};
            if (!_id) return res.status(400).json({ message: '_id is required' });

            const isInternal = user.type === 'internal';

            // Restrict what non-admin/non-internal users can update
            if (user.role !== 'admin' && !isInternal) {
                const allowed = ['customerStatus', 'customerComment', 'userRead'];
                const keys = Object.keys(updateData);
                if (keys.some(k => !allowed.includes(k))) {
                    return res.status(403).json({ message: 'You can only update customerStatus and customerComment' });
                }
            }

            // Auto-set solvedDate when status is set to Solved
            if (updateData.status === 'Solved' && !updateData.solvedDate) {
                updateData.solvedDate = new Date().toISOString();
            }

            // When admin/internal updates internalComment or status, notify the user
            if (user.role === 'admin' || isInternal) {
                if ('internalComment' in updateData || 'status' in updateData) {
                    updateData.userRead = false;
                    updateData.date = new Date().toISOString(); // Refresh timestamp for sort
                }
            }

            // When user updates customerStatus/customerComment, mark as unread for admin
            if (user.role !== 'admin' && !isInternal) {
                if ('customerStatus' in updateData || 'customerComment' in updateData) {
                    updateData.read = false;
                    updateData.date = new Date().toISOString(); // Refresh timestamp for sort
                }
            }

            // Update entries collection
            await entriesCol.updateOne({ _id: new ObjectId(_id) }, { $set: updateData });

            // Sync the same change to the notifications collection (same _id)
            try {
                await notifsCol.updateOne({ _id: new ObjectId(_id) }, { $set: updateData });
            } catch (_) { /* ignore if no matching notification */ }

            return res.status(200).json({ message: 'Entry updated successfully' });
        }

        // DELETE — admin only
        if (req.method === 'DELETE') {
            if (user.role !== 'admin') return res.status(403).json({ message: 'Admin access required' });

            const { _id } = req.body || {};
            if (!_id) return res.status(400).json({ message: '_id is required' });

            await entriesCol.deleteOne({ _id: new ObjectId(_id) });
            return res.status(200).json({ message: 'Entry deleted successfully' });
        }

        return res.status(405).json({ message: 'Method Not Allowed' });
    } catch (error) {
        console.error('[entries] Error:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};
