const { connectToDatabase } = require('../lib/mongodb');
const { requireInternal } = require('../lib/authMiddleware');
const jsforce = require('jsforce');

function setCors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

module.exports = async function handler(req, res) {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    const user = requireInternal(req, res);
    if (!user) return;

    const userId = user.userId || user._id;

    // Detect action from URL or query
    let action = 'unknown';
    if (req.url.includes('sf-auth')) action = 'auth';
    else if (req.url.includes('sf-run')) action = 'run';
    else if (req.url.includes('sf-fields')) action = 'fields';
    else if (req.url.includes('sf-objects')) action = 'objects';
    else if (req.url.includes('sf-history')) action = 'history';

    try {
        const { db } = await connectToDatabase();

        // ─── AUTH ───
        if (action === 'auth') {
            const sfCol = db.collection('sf_credentials');
            if (req.method === 'GET') {
                const creds = await sfCol.find({ userId }).toArray();
                const formatted = {};
                creds.forEach(c => {
                    const env = c.env_mode || 'sandbox';
                    if (!formatted[env]) formatted[env] = [];
                    formatted[env].push({ project_name: c.project_name, sf_url: c.sf_url, sf_username: c.sf_username, sf_password: c.sf_password });
                });
                return res.status(200).json({ status: 'success', full_name: user.fullName || user.name, username: user.username, role: user.role, type: user.type, credentials: formatted });
            }
            if (req.method === 'POST') {
                const { env_mode, project_name, sf_url, sf_username, sf_password } = req.body || {};
                if (!project_name || !sf_username) return res.status(400).json({ error: 'Missing required fields' });
                await sfCol.updateOne({ userId, env_mode, project_name }, { $set: { userId, env_mode, project_name, sf_url, sf_username, sf_password, updatedAt: new Date() } }, { upsert: true });
                return res.status(200).json({ status: 'success' });
            }
        }

        // ─── RUN ───
        if (action === 'run' && req.method === 'POST') {
            const payload = req.body;
            const task_type = payload.taskType;
            const project_name = payload.project_name;
            const sf_url = payload.credentials?.url;
            const sf_username = payload.credentials?.username;
            const sf_password = payload.credentials?.password;
            const dataList = payload.data || [];
            
            if (!sf_username || !sf_password || !task_type) return res.status(400).json({ status: 'error', message: 'Missing credentials.' });

            const conn = new jsforce.Connection({ loginUrl: sf_url || 'https://login.salesforce.com' });
            try { await conn.login(sf_username, sf_password); } 
            catch (e) { return res.status(401).json({ status: 'error', message: 'Login Failed: ' + e.message + ' (Append Security Token)' }); }

            const logHistory = async (dataType, objectName, fieldLabel, fieldName) => {
                await db.collection('sf_history').insertOne({ userId, projectName: project_name || 'Unknown', timestamp: new Date().toISOString(), objectName, dataType, fieldLabel, fieldName });
            };

            let successCount = 0;
            let errors = [];

            for (const item of dataList) {
                try {
                    if (task_type === 'field') {
                        const { objectName, dataType, fieldDetails } = item;
                        const label = fieldDetails.FieldLabel || fieldDetails.Label;
                        const name = fieldDetails.FieldName || fieldDetails.Name;
                        const customField = { fullName: `${objectName}.${name}`, label, type: dataType, required: false };
                        if (dataType === 'Text' || dataType === 'LongTextArea') customField.length = parseInt(fieldDetails.Length) || 255;
                        if (dataType === 'Number' || dataType === 'Currency') { customField.precision = parseInt(fieldDetails.Length)||18; customField.scale = parseInt(fieldDetails.DecimalPlaces)||0; }
                        if (dataType === 'Picklist' || dataType === 'MultiselectPicklist') {
                            const pValues = (fieldDetails.Values || fieldDetails.PicklistValues || '').split(',').map(v => ({ fullName: v.trim(), default: false }));
                            customField.valueSet = { valueSetDefinition: { sorted: false, value: pValues } };
                            if (dataType === 'MultiselectPicklist') customField.visibleLines = 4;
                        }
                        const result = await conn.metadata.create('CustomField', customField);
                        if (result.success || (Array.isArray(result) && result[0]?.success)) { await logHistory(dataType, objectName, label, name); successCount++; } 
                        else errors.push(`Field ${name}: ` + (Array.isArray(result) ? result[0].errors.message : result.errors?.message));
                    }
                    else if (task_type === 'validation_rule') {
                        const validationRule = { fullName: `${item.objectName}.${item.ruleName}`, active: true, errorConditionFormula: item.formula, errorMessage: item.errorMessage };
                        if (item.errorField) validationRule.errorDisplayField = item.errorField;
                        const result = await conn.metadata.create('ValidationRule', validationRule);
                        if (result.success || (Array.isArray(result) && result[0]?.success)) { await logHistory('Validation Rule', item.objectName, item.ruleName, item.ruleName); successCount++; } 
                        else errors.push(`Rule ${item.ruleName}: ` + (Array.isArray(result) ? result[0].errors.message : result.errors?.message));
                    }
                    else if (task_type === 'user') {
                        const pRecord = await conn.query(`SELECT Id FROM Profile WHERE Name = '${item.Profile}' LIMIT 1`);
                        if (!pRecord.records.length) throw new Error(`Profile not found`);
                        const alias = (item.FirstName?.substring(0,1)||'') + (item.LastName?.substring(0,4)||'User');
                        const result = await conn.sobject('User').create({ FirstName: item.FirstName, LastName: item.LastName, Email: item.Email, Username: item.Username, Alias: alias.substring(0,8), TimeZoneSidKey: 'America/Los_Angeles', LocaleSidKey: 'en_US', EmailEncodingKey: 'UTF-8', ProfileId: pRecord.records[0].Id, LanguageLocaleKey: 'en_US' });
                        if (result.success) { await logHistory('User Creation', 'User', item.FirstName+' '+item.LastName, item.Username); successCount++; } 
                        else errors.push(`User ${item.Username}: ${result.errors[0]}`);
                    }
                    else if (task_type === 'update_user_status') {
                        const uRecord = await conn.query(`SELECT Id FROM User WHERE Username = '${item.Username}' LIMIT 1`);
                        if (!uRecord.records.length) throw new Error(`User not found`);
                        const result = await conn.sobject('User').update({ Id: uRecord.records[0].Id, IsActive: item.IsActive });
                        if (result.success) { await logHistory('User Update', 'User', 'Status updated', item.Username); successCount++; } 
                        else errors.push(`User ${item.Username}: ${result.errors[0]}`);
                    }
                    else if (task_type === 'flow') {
                        // Build Flow Metadata
                        const flowMeta = {
                            fullName: item.apiName,
                            label: item.label,
                            description: item.description || '',
                            status: 'Draft',
                            processType: item.type || 'Flow',
                            startElementReference: null,
                        };

                        // Variables
                        if (item.variables && item.variables.length > 0) {
                            flowMeta.variables = item.variables.map(v => ({
                                name: v.name,
                                dataType: v.type === 'SObject Collection' ? 'SObject' : v.type,
                                isCollection: v.type === 'SObject Collection',
                                isInput: false,
                                isOutput: false,
                                value: v.defaultValue ? { stringValue: v.defaultValue } : undefined,
                            }));
                        }

                        // Elements
                        const assignments = [], decisions = [], recordCreates = [], recordUpdates = [], screens = [], loops = [];
                        (item.elements || []).forEach((el, idx) => {
                            const elName = el.name || `${el.type}_${idx}`;
                            const nextRef = item.elements[idx + 1]?.name || null;
                            if (el.type === 'Assignment') {
                                assignments.push({
                                    name: elName,
                                    label: el.label || elName,
                                    assignmentItems: [{
                                        assignToReference: el.variable || 'varTemp',
                                        operator: 'Assign',
                                        value: { stringValue: el.value || '' }
                                    }],
                                    connector: nextRef ? { targetReference: nextRef } : undefined
                                });
                            } else if (el.type === 'Decision') {
                                decisions.push({
                                    name: elName,
                                    label: el.label || 'Default',
                                    defaultConnectorLabel: el.label || 'Default',
                                    rules: el.condition ? [{
                                        name: `${elName}_Rule1`,
                                        label: 'Rule 1',
                                        conditionLogic: 'and',
                                        conditions: [{
                                            leftValueReference: el.condition.split('==')[0]?.trim() || 'varCondition',
                                            operator: 'EqualTo',
                                            rightValue: { stringValue: (el.condition.split('==')[1]?.trim() || '').replace(/['"]/g,'') }
                                        }],
                                        connector: nextRef ? { targetReference: nextRef } : undefined
                                    }] : [],
                                    defaultConnector: nextRef ? { targetReference: nextRef } : undefined
                                });
                            } else if (el.type === 'RecordCreate') {
                                recordCreates.push({
                                    name: elName,
                                    label: el.label || elName,
                                    object: el.object || 'Account',
                                    inputAssignments: el.field ? [{ field: el.field, value: { stringValue: el.value || '' } }] : [],
                                    connector: nextRef ? { targetReference: nextRef } : undefined
                                });
                            } else if (el.type === 'RecordUpdate') {
                                recordUpdates.push({
                                    name: elName,
                                    label: el.label || elName,
                                    object: el.object || 'Account',
                                    filters: [],
                                    inputAssignments: el.field ? [{ field: el.field, value: { stringValue: el.value || '' } }] : [],
                                    connector: nextRef ? { targetReference: nextRef } : undefined
                                });
                            } else if (el.type === 'Screen') {
                                screens.push({
                                    name: elName,
                                    label: el.label || elName,
                                    fields: [],
                                    connector: nextRef ? { targetReference: nextRef } : undefined
                                });
                            } else if (el.type === 'Loop') {
                                loops.push({
                                    name: elName,
                                    label: el.label || elName,
                                    collectionReference: el.variable || 'varCollection',
                                    iterationOrder: 'Asc',
                                    nextValueConnector: nextRef ? { targetReference: nextRef } : undefined
                                });
                            }
                        });

                        if (assignments.length > 0) flowMeta.assignments = assignments;
                        if (decisions.length > 0) flowMeta.decisions = decisions;
                        if (recordCreates.length > 0) flowMeta.recordCreates = recordCreates;
                        if (recordUpdates.length > 0) flowMeta.recordUpdates = recordUpdates;
                        if (screens.length > 0) flowMeta.screens = screens;
                        if (loops.length > 0) flowMeta.loops = loops;

                        // Set start element
                        if (item.elements && item.elements.length > 0) {
                            flowMeta.startElementReference = item.elements[0].name;
                        }

                        // Record-triggered flow start config
                        if (item.type === 'RecordBeforeSave' || item.type === 'RecordAfterSave') {
                            flowMeta.start = {
                                object: item.triggerObject || 'Account',
                                triggerType: item.triggerEvent || 'RecordBeforeCreate',
                                connector: flowMeta.startElementReference ? { targetReference: flowMeta.startElementReference } : undefined
                            };
                            flowMeta.startElementReference = undefined; // use start.connector instead
                        }

                        const result = await conn.metadata.create('Flow', flowMeta);
                        const ok = result.success || (Array.isArray(result) && result[0]?.success);
                        if (ok) {
                            await logHistory('Flow', item.type || 'Flow', item.label, item.apiName);
                            successCount++;
                        } else {
                            const errMsg = Array.isArray(result) ? result[0].errors?.message : result.errors?.message;
                            errors.push(`Flow ${item.apiName}: ${errMsg || 'Unknown error'}`);
                        }
                    }
                } catch(err) { errors.push(err.message); }
            }
            if (errors.length > 0) return res.status(400).json({ status: 'error', message: `Processed ${successCount}. Errors: ${errors.join(', ')}` });
            return res.status(200).json({ status: 'success', message: `Successfully processed ${successCount} items.` });
        }

        // ─── FIELDS ───
        if (action === 'fields' && req.method === 'GET') {
            const { object, project_name, env_mode } = req.query;
            const query = { userId };
            if (project_name) query.project_name = project_name;
            if (env_mode) query.env_mode = env_mode;
            
            let cred = null;
            if (project_name || env_mode) {
                cred = await db.collection('sf_credentials').findOne(query);
            }
            if (!cred) {
                cred = await db.collection('sf_credentials').findOne({ userId });
            }
            if (!cred) return res.status(401).json({ error: 'No credentials' });
            
            const conn = new jsforce.Connection({ loginUrl: cred.sf_url });
            await conn.login(cred.sf_username, cred.sf_password);
            const meta = await conn.describe(object);
            return res.status(200).json(meta.fields.map(f => ({ fieldName: f.name, fieldLabel: f.label, dataType: f.type, objectName: object })));
        }

        // ─── OBJECTS ───
        if (action === 'objects' && req.method === 'GET') {
            const { project_name, env_mode } = req.query;
            const query = { userId };
            if (project_name) query.project_name = project_name;
            if (env_mode) query.env_mode = env_mode;
            
            let cred = null;
            if (project_name || env_mode) {
                cred = await db.collection('sf_credentials').findOne(query);
            }
            if (!cred) {
                cred = await db.collection('sf_credentials').findOne({ userId });
            }
            if (!cred) return res.status(401).json({ error: 'No credentials' });
            
            const conn = new jsforce.Connection({ loginUrl: cred.sf_url });
            await conn.login(cred.sf_username, cred.sf_password);
            const meta = await conn.describeGlobal();
            return res.status(200).json(meta.sobjects.map(o => ({ name: o.name, label: o.label, custom: o.custom })));
        }

        // ─── HISTORY ───
        if (action === 'history' && req.method === 'GET') {
            const history = await db.collection('sf_history').find({ userId }).toArray();
            return res.status(200).json(history.map(h => ({ timestamp: h.timestamp, projectName: h.projectName, objectName: h.objectName, dataType: h.dataType, fieldLabel: h.fieldLabel, fieldName: h.fieldName })));
        }

        return res.status(405).json({ message: 'Method Not Allowed' });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
