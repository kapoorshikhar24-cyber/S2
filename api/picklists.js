const { connectToDatabase } = require('../lib/mongodb');
const { verifyToken } = require('../lib/authMiddleware');

function setCors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// Maps Picklist Name to DB Collection and Field for rel-checks
const PICKLIST_MAPPING = {
    'Modules': { collection: 'entries', field: 'pageModule' },
    'Designations': { collection: 'users', field: 'designation' }
};

// Default setup values if DB is empty
const DEFAULTS = [
    { type: 'picklist', name: 'Modules', values: ['Dashboard', 'User Management', 'Reports', 'Settings', 'Profile', 'Billing', 'Analytics', 'Other'] },
    { type: 'picklist', name: 'Designations', values: ['Sales Person', 'Tech Lead', 'Project Manager', 'Business Analysis', 'Tester(QA)', 'Developer'] }
];

module.exports = async function handler(req, res) {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    const user = verifyToken(req, res);
    if (!user) return; // auth middleware handles the response

    try {
        const { db } = await connectToDatabase();
        if (!db) throw new Error('Failed to connect to database');
        
        const settingsCol = db.collection('settings');

        // ==== GET: Fetch all picklists ====
        if (req.method === 'GET') {
            try {
                let picklists = await settingsCol.find({ type: 'picklist' }).toArray();
                
                // If DB is totally empty of picklists, seed with DEFAULTS for seamless transition
                if (picklists.length === 0) {
                    await settingsCol.insertMany(DEFAULTS.map(p => ({ ...p, updatedAt: new Date() })));
                    picklists = await settingsCol.find({ type: 'picklist' }).toArray();
                }

                // Convert to a dictionary for easy client parsing: { "Modules": ["A", "B"], "Designations": [...] }
                const result = {};
                picklists.forEach(p => {
                    result[p.name] = p.values || [];
                });
                return res.status(200).json(result);
            } catch (err) {
                console.error('[picklists] GET Error:', err.message);
                return res.status(500).json({ message: 'Error fetching picklists' });
            }
        }

        // ==== POST: Modify Picklists (Admin Only) ====
        if (req.method === 'POST') {
            if (user.role !== 'admin') {
                return res.status(403).json({ message: 'Admin access required' });
            }

            const { action, name, values, value, oldValue, newValue, replacementValue } = req.body || {};
            if (!name || !action) {
                return res.status(400).json({ message: 'action and name are required' });
            }

            // Fetch the current record
            let current = await settingsCol.findOne({ type: 'picklist', name: name });
            if (!current) {
                // Initialize if missing
                current = { type: 'picklist', name, values: [], updatedAt: new Date() };
                await settingsCol.insertOne(current);
            }
            
            let currentValues = current.values || [];

            // 1. REORDER: Sets the full array
            if (action === 'reorder') {
                if (!Array.isArray(values)) return res.status(400).json({ message: 'values array required' });
                await settingsCol.updateOne(
                    { type: 'picklist', name },
                    { $set: { values, updatedAt: new Date() } }
                );
                return res.status(200).json({ message: 'Reordered successfully' });
            }

            // 2. ADD: Add new value to the array
            if (action === 'add') {
                if (!value) return res.status(400).json({ message: 'value is required' });
                if (currentValues.includes(value)) return res.status(400).json({ message: 'Value already exists' });
                
                currentValues.push(value);
                await settingsCol.updateOne(
                    { type: 'picklist', name },
                    { $set: { values: currentValues, updatedAt: new Date() } }
                );
                return res.status(200).json({ message: 'Added successfully' });
            }

            // 3. RENAME: Rename in picklist AND bulk update records in DB
            if (action === 'rename') {
                if (!oldValue || !newValue) return res.status(400).json({ message: 'oldValue and newValue required' });
                if (currentValues.includes(newValue)) return res.status(400).json({ message: 'New value already exists' });

                // Replace in array
                const index = currentValues.indexOf(oldValue);
                if (index === -1) return res.status(404).json({ message: 'Old value not found in picklist' });
                currentValues[index] = newValue;
                await settingsCol.updateOne({ type: 'picklist', name }, { $set: { values: currentValues, updatedAt: new Date() } });

                // Bulk update related records if mapping exists
                const mapping = PICKLIST_MAPPING[name];
                if (mapping) {
                    const targetCol = db.collection(mapping.collection);
                    const filter = { [mapping.field]: oldValue };
                    const update = { $set: { [mapping.field]: newValue } };

                    await targetCol.updateMany(filter, update);

                    // Special case for 'entries': Also need to mirror changes to 'notifications'
                    if (mapping.collection === 'entries') {
                        const notifCol = db.collection('notifications');
                        await notifCol.updateMany(filter, update);
                    }
                }
                return res.status(200).json({ message: 'Renamed and mapping updated successfully' });
            }

            // 4. DELETE: Delete from picklist after checking usage
            if (action === 'delete') {
                if (!value) return res.status(400).json({ message: 'value is required' });

                const mapping = PICKLIST_MAPPING[name];
                
                if (mapping) {
                    const targetCol = db.collection(mapping.collection);
                    const count = await targetCol.countDocuments({ [mapping.field]: value });

                    // Value is currently used in DB
                    if (count > 0) {
                        if (!replacementValue) {
                            return res.status(400).json({ 
                                code: 'IN_USE',
                                message: `Cannot delete: This value is in use by ${count} record(s). Please provide a mapping replacement.` 
                            });
                        }
                        
                        // Execute replacement migration
                        const filter = { [mapping.field]: value };
                        const update = { $set: { [mapping.field]: replacementValue } };
                        await targetCol.updateMany(filter, update);

                        // Special mirror for 'entries' -> 'notifications'
                        if (mapping.collection === 'entries') {
                            const notifCol = db.collection('notifications');
                            await notifCol.updateMany(filter, update);
                        }
                    }
                }

                // Remove from array and save
                currentValues = currentValues.filter(v => v !== value);
                await settingsCol.updateOne({ type: 'picklist', name }, { $set: { values: currentValues, updatedAt: new Date() } });

                return res.status(200).json({ message: 'Deleted successfully' });
            }

            return res.status(400).json({ message: 'Unknown action' });
        }

        return res.status(405).json({ message: 'Method Not Allowed' });
    } catch (error) {
        console.error('[picklists] General Error:', error.message);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};
