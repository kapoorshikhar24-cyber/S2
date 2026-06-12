const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'changeme-set-JWT_SECRET-in-env';

/**
 * Verifies the Bearer token from the Authorization header.
 * Returns the decoded user payload, or responds 401 and returns null.
 */
function verifyToken(req, res) {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
        res.status(401).json({ message: 'No token provided' });
        return null;
    }

    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (err) {
        res.status(401).json({ message: 'Invalid or expired token' });
        return null;
    }
}

/**
 * Verifies token AND asserts admin role.
 */
function requireAdmin(req, res) {
    const user = verifyToken(req, res);
    if (!user) return null;
    if (user.role !== 'admin') {
        res.status(403).json({ message: 'Admin access required' });
        return null;
    }
    return user;
}

/**
 * Verifies token AND asserts admin or internal role.
 */
function requireInternal(req, res) {
    const user = verifyToken(req, res);
    if (!user) return null;
    if (user.role !== 'admin' && user.type !== 'internal') {
        res.status(403).json({ message: 'Internal user/employee access required' });
        return null;
    }
    return user;
}

function signToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
}

module.exports = { verifyToken, requireAdmin, requireInternal, signToken };

