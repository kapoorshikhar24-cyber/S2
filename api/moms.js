const { connectToDatabase } = require('../lib/mongodb');
const { verifyToken } = require('../lib/authMiddleware');

function setCors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

module.exports = async function handler(req, res) {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    const user = verifyToken(req, res);
    if (!user) return; // verifyToken already sends 401 response

    try {
        const { db } = await connectToDatabase();
        const momsCol = db.collection('moms');

        // GET — Retrieve MOMs (with permission checks)
        if (req.method === 'GET') {
            let query = {};
            if (user.role !== 'admin') {
                if (user.type === 'internal') {
                    // Internal employee — find projects assigned to this user
                    const projectsCol = db.collection('projects');
                    const myProjects = await projectsCol.find({ users: user.username }).toArray();
                    const projNames = myProjects.map(p => p.name);
                    query = { projectName: { $in: projNames } };
                } else {
                    // External user — only MOMs matching their project
                    query = { projectName: user.project };
                }
            }

            const moms = await momsCol.find(query).toArray();
            return res.status(200).json(moms);
        }

        // POST — Create new MOM
        if (req.method === 'POST') {
            const meetingData = req.body;
            if (!meetingData || !meetingData.id || !meetingData.title || !meetingData.projectName) {
                return res.status(400).json({ message: 'Missing required meeting details (id, title, projectName)' });
            }

            // Ensure the user has access to write to this project
            if (user.role !== 'admin') {
                if (user.type === 'external' && meetingData.projectName !== user.project) {
                    return res.status(403).json({ message: 'You are not authorized to create MOMs for this project' });
                }
                if (user.type === 'internal') {
                    const projectsCol = db.collection('projects');
                    const proj = await projectsCol.findOne({ name: meetingData.projectName, users: user.username });
                    if (!proj) {
                        return res.status(403).json({ message: 'You are not assigned to this project' });
                    }
                }
            }

            const result = await momsCol.insertOne(meetingData);
            return res.status(201).json({ message: 'MOM created successfully', result });
        }

        // PUT — Update existing MOM
        if (req.method === 'PUT') {
            const meetingData = req.body;
            if (!meetingData || !meetingData.id) {
                return res.status(400).json({ message: 'Missing meeting id' });
            }

            // Verify authorization
            const existing = await momsCol.findOne({ id: meetingData.id });
            if (!existing) {
                return res.status(404).json({ message: 'MOM not found' });
            }

            if (user.role !== 'admin') {
                if (user.type === 'external' && existing.projectName !== user.project) {
                    return res.status(403).json({ message: 'You are not authorized to modify MOMs for this project' });
                }
                if (user.type === 'internal') {
                    const projectsCol = db.collection('projects');
                    const proj = await projectsCol.findOne({ name: existing.projectName, users: user.username });
                    if (!proj) {
                        return res.status(403).json({ message: 'You are not assigned to this project' });
                    }
                }
            }

            // Don't modify the _id field during update
            const { _id, ...updateFields } = meetingData;
            await momsCol.updateOne({ id: meetingData.id }, { $set: updateFields });
            return res.status(200).json({ message: 'MOM updated successfully' });
        }

        // DELETE — Delete a MOM
        if (req.method === 'DELETE') {
            const { id } = req.body || req.query || {};
            if (!id) {
                return res.status(400).json({ message: 'Missing meeting id' });
            }

            const existing = await momsCol.findOne({ id });
            if (!existing) {
                return res.status(404).json({ message: 'MOM not found' });
            }

            if (user.role !== 'admin') {
                if (user.type === 'external' && existing.projectName !== user.project) {
                    return res.status(403).json({ message: 'You are not authorized to delete MOMs for this project' });
                }
                if (user.type === 'internal') {
                    const projectsCol = db.collection('projects');
                    const proj = await projectsCol.findOne({ name: existing.projectName, users: user.username });
                    if (!proj) {
                        return res.status(403).json({ message: 'You are not assigned to this project' });
                    }
                }
            }

            await momsCol.deleteOne({ id });
            return res.status(200).json({ message: 'MOM deleted successfully' });
        }

        return res.status(405).json({ message: 'Method Not Allowed' });
    } catch (error) {
        console.error('[moms] Error:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};
