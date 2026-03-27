require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');
const http = require('http');
const ws = require('ws');
const crypto = require('crypto');

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const upload = multer();
const server = http.createServer(app);
const wss = new ws.WebSocketServer({ server, path: '/agent-ws' });

let pool;

const connectedAgents = new Map();
const pendingRequests = new Map();

wss.on('connection', async (wsClient, req) => {
    try {
        const urlObj = new URL(req.url, `http://${req.headers.host}`);
        const token = urlObj.searchParams.get('token');
        if (!token) return wsClient.close(4001, 'Unauthorized');

        const [rows] = await pool.query('SELECT id FROM users WHERE agent_token = ?', [token]);
        if (rows.length === 0) return wsClient.close(4001, 'Invalid Token');

        const userId = rows[0].id;
        connectedAgents.set(userId, wsClient);

        wsClient.isAlive = true;
        wsClient.on('pong', () => { wsClient.isAlive = true; });

        wsClient.on('message', (message) => {
            try {
                const parsed = JSON.parse(message);
                if (parsed.type === 'RESPONSE' && pendingRequests.has(parsed.id)) {
                    pendingRequests.get(parsed.id).resolve(parsed);
                    pendingRequests.delete(parsed.id);
                }
            } catch(e) {}
        });

        wsClient.on('close', () => {
            if (connectedAgents.get(userId) === wsClient) connectedAgents.delete(userId);
        });
    } catch(e) { wsClient.close(5000, 'Server Error'); }
});

async function connectDB() {
    pool = mysql.createPool({
        host: process.env.DB_HOST || 'resty-flow-db',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || process.env.DB_PASS || 'root',
        database: process.env.DB_NAME || 'app_db',
        waitForConnections: true, connectionLimit: 10, queueLimit: 0
    });
    
    try {
        const [userCols] = await pool.query(`SHOW COLUMNS FROM users LIKE 'email'`);
        if (userCols.length === 0) {
            await pool.query(`ALTER TABLE users ADD COLUMN full_name VARCHAR(255) DEFAULT 'User' AFTER id`);
            await pool.query(`ALTER TABLE users ADD COLUMN email VARCHAR(255) DEFAULT NULL AFTER full_name`);
            await pool.query(`ALTER TABLE users ADD UNIQUE (email)`);
        }
    } catch(e) { console.error("Migration Error:", e.message); }
}

connectDB();

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-123';

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user; next();
    });
};

// ==========================================
// INJECT EXAMPLE WORKSPACE HELPER
// ==========================================
async function injectExampleWorkspace(userId, workspaceId) {
    try {
        const [fRes] = await pool.query('INSERT INTO folders (workspace_id, name) VALUES (?, ?)', [workspaceId, 'example_req_payment_flow']);
        const folderId = fRes.insertId;

        const vars = [
            { k: "example_v_base_url", v: "https://jsonplaceholder.typicode.com" },
            { k: "example_v_user_email", v: "user@example.com" },
            { k: "example_v_user_password", v: "secure123" },
            { k: "example_v_token", v: "" }, { k: "example_v_cart_id", v: "" },
            { k: "example_v_order_id", v: "" }, { k: "example_v_payment_id", v: "" }
        ];
        for (let v of vars) await pool.query('INSERT INTO variables (user_id, workspace_id, var_key, var_value) VALUES (?, ?, ?, ?)', [userId, workspaceId, v.k, v.v]);

        const mockMap = {};
        const mocks = [
            { oldId: 201, n: "example_mocks_bank_verify", m: "POST", p: "/mock/bank/verify", s: 200, b: "{\n  \"status\": \"VERIFIED\",\n  \"card_valid\": true\n}" },
            { oldId: 202, n: "example_mocks_fraud_check", m: "POST", p: "/mock/fraud/check", s: 200, b: "{\n  \"score\": 0.05,\n  \"action\": \"ALLOW\"\n}" },
            { oldId: 203, n: "example_mocks_loyalty", m: "GET", p: "/mock/loyalty/balance", s: 200, b: "{\n  \"points\": 1500,\n  \"tier\": \"GOLD\"\n}" },
            { oldId: 204, n: "example_mocks_pg_callback", m: "POST", p: "/mock/pg/webhook", s: 200, b: "{\n  \"message\": \"Webhook processed successfully\"\n}" }
        ];
        for (let m of mocks) {
            const [mRes] = await pool.query('INSERT INTO mocks (user_id, workspace_id, name, method, path, status, headers, body) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 
            [userId, workspaceId, m.n, m.m, m.p, m.s, JSON.stringify([{"key": "Content-Type", "value": "application/json"}]), m.b]);
            mockMap[m.oldId] = mRes.insertId;
        }

        const reqMap = {};
        const requests = [
            { oldId: 101, n: "1. Login User", m: "POST", url: "{{example_v_base_url}}/posts", bType: "json", body: "{\n  \"email\": \"{{example_v_user_email}}\",\n  \"password\": \"{{example_v_user_password}}\"\n}", auth: {"type": "none"}, pre: "console.log('Preparing login for', variables['example_v_user_email']);", post: "if(response.status === 201) { variables['example_v_token'] = 'dummy_token_' + Date.now(); }", assrt: [{"type": "status", "operator": "equals", "value": "201"}] },
            { oldId: 102, n: "2. Get Profile", m: "GET", url: "{{example_v_base_url}}/users/1", bType: "none", body: "", auth: {"type": "bearer", "token": "{{example_v_token}}"}, pre: "", post: "", assrt: [{"type": "status", "operator": "equals", "value": "200"}] },
            { oldId: 103, n: "3. Create Cart", m: "POST", url: "{{example_v_base_url}}/posts", bType: "json", body: "{\n  \"action\": \"create_cart\"\n}", auth: {"type": "bearer", "token": "{{example_v_token}}"}, pre: "", post: "if(response.status === 201) { variables['example_v_cart_id'] = 'CART-' + Math.floor(Math.random() * 10000); }", assrt: [{"type": "status", "operator": "equals", "value": "201"}] },
            { oldId: 104, n: "4. Add Item to Cart", m: "POST", url: "{{example_v_base_url}}/posts", bType: "json", body: "{\n  \"cart_id\": \"{{example_v_cart_id}}\",\n  \"product_id\": \"PROD-999\",\n  \"qty\": 2\n}", auth: {"type": "bearer", "token": "{{example_v_token}}"}, pre: "request.body = JSON.stringify({ cart_id: variables['example_v_cart_id'], product_id: 'PROD-' + Math.floor(Math.random() * 1000), qty: 1 });", post: "", assrt: [{"type": "status", "operator": "equals", "value": "201"}] },
            { oldId: 105, n: "5. Apply Promo Code", m: "PUT", url: "{{example_v_base_url}}/posts/1?code=DISC50", bType: "none", body: "", auth: {"type": "bearer", "token": "{{example_v_token}}"}, pre: "", post: "", assrt: [{"type": "status", "operator": "equals", "value": "200"}] },
            { oldId: 106, n: "6. Checkout Order", m: "POST", url: "{{example_v_base_url}}/posts", bType: "json", body: "{\n  \"cart_id\": \"{{example_v_cart_id}}\",\n  \"shipping_address\": \"Jl. Sudirman No. 1\"\n}", auth: {"type": "bearer", "token": "{{example_v_token}}"}, pre: "", post: "variables['example_v_order_id'] = 'ORD-' + Date.now();", assrt: [{"type": "status", "operator": "equals", "value": "201"}] },
            { oldId: 107, n: "7. Get Payment Options", m: "GET", url: "{{example_v_base_url}}/comments?postId=1&order_id={{example_v_order_id}}", bType: "none", body: "", auth: {"type": "bearer", "token": "{{example_v_token}}"}, pre: "", post: "", assrt: [{"type": "time", "operator": "less_than", "value": "3000"}] },
            { oldId: 108, n: "8. Initiate Payment", m: "POST", url: "{{example_v_base_url}}/posts", bType: "json", body: "{\n  \"order_id\": \"{{example_v_order_id}}\",\n  \"method\": \"credit_card\"\n}", auth: {"type": "bearer", "token": "{{example_v_token}}"}, pre: "", post: "variables['example_v_payment_id'] = 'PAY-' + Math.floor(Math.random() * 99999);", assrt: [{"type": "status", "operator": "equals", "value": "201"}] },
            { oldId: 109, n: "9. Check Payment Status", m: "GET", url: "{{example_v_base_url}}/posts/1", bType: "none", body: "", auth: {"type": "bearer", "token": "{{example_v_token}}"}, pre: "console.log('Polling payment status...');", post: "", assrt: [{"type": "status", "operator": "equals", "value": "200"}] },
            { oldId: 110, n: "10. Get Receipt", m: "GET", url: "{{example_v_base_url}}/posts/1", bType: "none", body: "", auth: {"type": "bearer", "token": "{{example_v_token}}"}, pre: "", post: "console.log('E2E Payment flow finished successfully!');", assrt: [{"type": "status", "operator": "equals", "value": "200"}] }
        ];

        for (let r of requests) {
            let h = [{"key": "Content-Type", "value": "application/json"}];
            if (r.bType === 'none') h = [];
            const [rRes] = await pool.query('INSERT INTO requests (user_id, workspace_id, folder_id, name, method, url, headers, body_type, body, assertions, authorization, pre_request_script, post_request_script) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 
            [userId, workspaceId, folderId, r.n, r.m, r.url, JSON.stringify(h), r.bType, r.body, JSON.stringify(r.assrt), JSON.stringify(r.auth), r.pre, r.post]);
            reqMap[r.oldId] = rRes.insertId;
        }

        // FULL 14 Nodes and 13 Edges
        const fullNodes = [
          { "id": "n1", "type": "request", "refId": reqMap[101], "name": "1. Login User", "method": "POST", "iterations": 1, "delay": 0, "x": 100, "y": 100 },
          { "id": "n2", "type": "request", "refId": reqMap[102], "name": "2. Get Profile", "method": "GET", "iterations": 1, "delay": 0, "x": 450, "y": 100 },
          { "id": "n3", "type": "mock", "refId": mockMap[203], "name": "example_mocks_loyalty", "method": "GET", "iterations": 1, "delay": 0, "x": 800, "y": 100 },
          { "id": "n4", "type": "request", "refId": reqMap[103], "name": "3. Create Cart", "method": "POST", "iterations": 1, "delay": 0, "x": 100, "y": 300 },
          { "id": "n5", "type": "request", "refId": reqMap[104], "name": "4. Add Item to Cart", "method": "POST", "iterations": 1, "delay": 0, "x": 450, "y": 300 },
          { "id": "n6", "type": "request", "refId": reqMap[105], "name": "5. Apply Promo Code", "method": "PUT", "iterations": 1, "delay": 0, "x": 800, "y": 300 },
          { "id": "n7", "type": "mock", "refId": mockMap[202], "name": "example_mocks_fraud_check", "method": "POST", "iterations": 1, "delay": 0, "x": 100, "y": 500 },
          { "id": "n8", "type": "request", "refId": reqMap[106], "name": "6. Checkout Order", "method": "POST", "iterations": 1, "delay": 0, "x": 450, "y": 500 },
          { "id": "n9", "type": "request", "refId": reqMap[107], "name": "7. Get Payment Options", "method": "GET", "iterations": 1, "delay": 0, "x": 800, "y": 500 },
          { "id": "n10", "type": "request", "refId": reqMap[108], "name": "8. Initiate Payment", "method": "POST", "iterations": 1, "delay": 0, "x": 100, "y": 700 },
          { "id": "n11", "type": "mock", "refId": mockMap[201], "name": "example_mocks_bank_verify", "method": "POST", "iterations": 1, "delay": 0, "x": 450, "y": 700 },
          { "id": "n12", "type": "mock", "refId": mockMap[204], "name": "example_mocks_pg_callback", "method": "POST", "iterations": 1, "delay": 0, "x": 800, "y": 700 },
          { "id": "n13", "type": "request", "refId": reqMap[109], "name": "9. Check Payment Status", "method": "GET", "iterations": 1, "delay": 0, "x": 100, "y": 900 },
          { "id": "n14", "type": "request", "refId": reqMap[110], "name": "10. Get Receipt", "method": "GET", "iterations": 1, "delay": 0, "x": 450, "y": 900 }
        ];
        const fullEdges = [
          { "id": "e1", "source": "n1", "sourceHandle": "right", "target": "n2", "targetHandle": "left" },
          { "id": "e2", "source": "n2", "sourceHandle": "right", "target": "n3", "targetHandle": "left" },
          { "id": "e3", "source": "n3", "sourceHandle": "bottom", "target": "n4", "targetHandle": "top" },
          { "id": "e4", "source": "n4", "sourceHandle": "right", "target": "n5", "targetHandle": "left" },
          { "id": "e5", "source": "n5", "sourceHandle": "right", "target": "n6", "targetHandle": "left" },
          { "id": "e6", "source": "n6", "sourceHandle": "bottom", "target": "n7", "targetHandle": "top" },
          { "id": "e7", "source": "n7", "sourceHandle": "right", "target": "n8", "targetHandle": "left" },
          { "id": "e8", "source": "n8", "sourceHandle": "right", "target": "n9", "targetHandle": "left" },
          { "id": "e9", "source": "n9", "sourceHandle": "bottom", "target": "n10", "targetHandle": "top" },
          { "id": "e10", "source": "n10", "sourceHandle": "right", "target": "n11", "targetHandle": "left" },
          { "id": "e11", "source": "n11", "sourceHandle": "right", "target": "n12", "targetHandle": "left" },
          { "id": "e12", "source": "n12", "sourceHandle": "bottom", "target": "n13", "targetHandle": "top" },
          { "id": "e13", "source": "n13", "sourceHandle": "right", "target": "n14", "targetHandle": "left" }
        ];

        await pool.query('INSERT INTO scenarios (user_id, workspace_id, name, nodes) VALUES (?, ?, ?, ?)', 
            [userId, workspaceId, "Example API Flow Test", JSON.stringify({type: 'api_flow', config: {vus: 10, spawnRate: 2, duration: 15}, nodes: fullNodes, edges: fullEdges})]
        );

        // Inject Performance Test with the same Full Nodes but different config
        await pool.query('INSERT INTO scenarios (user_id, workspace_id, name, nodes) VALUES (?, ?, ?, ?)', 
            [userId, workspaceId, "Example Performance Load Test", JSON.stringify({type: 'performance', config: {vus: 10, spawnRate: 2, duration: 20}, nodes: fullNodes.map(n=>({...n, id: 'p_'+n.id})), edges: fullEdges.map(e=>({...e, id: 'pe_'+e.id, source: 'p_'+e.source, target: 'p_'+e.target}))})]
        );

    } catch(e) { console.error('Failed injecting sample workspace:', e); }
}

// ==========================================
// ROUTES
// ==========================================
app.post('/api/auth/register', async (req, res) => {
    try {
        const { full_name, email, username, password } = req.body;
        if (!full_name || !email || !username || !password) return res.status(400).json({ error: 'All fields are required' });
        
        const [rows] = await pool.query('SELECT * FROM users WHERE username = ? OR email = ?', [username, email]);
        if (rows.length > 0) return res.status(409).json({ error: 'Username or Email already exists' });
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const agentToken = crypto.randomBytes(24).toString('hex');
        const [result] = await pool.query('INSERT INTO users (full_name, email, username, password, agent_token) VALUES (?, ?, ?, ?, ?)', [full_name, email, username, hashedPassword, agentToken]);
        
        const userId = result.insertId;
        const [wsResult] = await pool.query('INSERT INTO workspaces (user_id, name) VALUES (?, ?)', [userId, 'My First Workspace']);
        
        await injectExampleWorkspace(userId, wsResult.insertId);
        res.status(201).json({ message: 'User created successfully' });
    } catch (error) { res.status(500).json({ error: 'Internal server error' }); }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
        if (rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
        
        const user = rows[0];
        if (await bcrypt.compare(password, user.password)) {
            const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
            res.json({ token, username: user.username });
        } else { res.status(401).json({ error: 'Invalid credentials' }); }
    } catch (error) { res.status(500).json({ error: 'Internal server error' }); }
});

app.get('/api/users/profile', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT username, full_name, email FROM users WHERE id = ?', [req.user.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
        res.json(rows[0]);
    } catch(e) { res.status(500).json({error: 'Error fetching profile'}); }
});

app.put('/api/users/profile', authenticateToken, async (req, res) => {
    try {
        const { full_name, email, password } = req.body;
        if (password) {
            const hashed = await bcrypt.hash(password, 10);
            await pool.query('UPDATE users SET full_name=?, email=?, password=? WHERE id=?', [full_name, email, hashed, req.user.id]);
        } else {
            await pool.query('UPDATE users SET full_name=?, email=? WHERE id=?', [full_name, email, req.user.id]);
        }
        res.json({message: 'Profile updated successfully'});
    } catch(e) { 
        if(e.code === 'ER_DUP_ENTRY') return res.status(409).json({error: 'Email already in use'});
        res.status(500).json({error: 'Error updating profile'}); 
    }
});

app.delete('/api/users/profile', authenticateToken, async (req, res) => {
    try {
        const [ws] = await pool.query('SELECT id FROM workspaces WHERE user_id = ?', [req.user.id]);
        const wsIds = ws.map(w => w.id);
        await pool.query('DELETE FROM collaborators WHERE user_id = ?', [req.user.id]);
        await pool.query('DELETE FROM invitations WHERE sender_id = ? OR receiver_id = ?', [req.user.id, req.user.id]);
        if (wsIds.length > 0) await pool.query('DELETE FROM collaborators WHERE resource_type = "workspace" AND resource_id IN (?)', [wsIds]);
        await pool.query('DELETE FROM users WHERE id = ?', [req.user.id]);
        res.json({ message: 'Account deleted successfully' });
    } catch(e) { res.status(500).json({ error: 'Error deleting account' }); }
});

app.get('/api/agent', authenticateToken, async (req, res) => {
    try {
        let [rows] = await pool.query('SELECT agent_token FROM users WHERE id = ?', [req.user.id]);
        if (rows.length > 0 && !rows[0].agent_token) {
            const newToken = crypto.randomBytes(24).toString('hex');
            await pool.query('UPDATE users SET agent_token = ? WHERE id = ?', [newToken, req.user.id]);
            rows[0].agent_token = newToken;
        }
        const isOnline = connectedAgents.has(req.user.id);
        res.json({ token: rows[0]?.agent_token, online: isOnline });
    } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

app.post('/api/agent/regenerate', authenticateToken, async (req, res) => {
    try {
        const newToken = crypto.randomBytes(24).toString('hex');
        await pool.query('UPDATE users SET agent_token = ? WHERE id = ?', [newToken, req.user.id]);
        if (connectedAgents.has(req.user.id)) { connectedAgents.get(req.user.id).close(1000, 'Token regenerated'); connectedAgents.delete(req.user.id); }
        res.json({ token: newToken });
    } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

app.post('/api/invitations', authenticateToken, async (req, res) => {
    try {
        const { username, resourceType, resourceId } = req.body;
        const [ws] = await pool.query('SELECT user_id FROM workspaces WHERE id = ?', [resourceId]);
        if (ws.length === 0) return res.status(404).json({ error: 'Workspace not found' });
        if (ws[0].user_id !== req.user.id) return res.status(403).json({ error: 'Access Denied' });

        const [users] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
        if (users.length === 0) return res.status(404).json({ error: 'User not found' });
        
        const receiverId = users[0].id;
        if (receiverId === req.user.id) return res.status(400).json({ error: 'Cannot invite yourself' });

        await pool.query('INSERT INTO invitations (sender_id, receiver_id, resource_type, resource_id, status) VALUES (?, ?, ?, ?, "pending")', [req.user.id, receiverId, resourceType, resourceId]);
        res.status(201).json({ message: 'Invitation sent' });
    } catch (error) { res.status(500).json({ error: 'Internal server error' }); }
});

app.get('/api/invitations', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query(`SELECT i.*, u.username as sender_name, COALESCE(w.name, f.name, r.name) as resource_name FROM invitations i JOIN users u ON i.sender_id = u.id LEFT JOIN workspaces w ON i.resource_type = 'workspace' AND i.resource_id = w.id LEFT JOIN folders f ON i.resource_type = 'folder' AND i.resource_id = f.id LEFT JOIN requests r ON i.resource_type = 'request' AND i.resource_id = r.id WHERE i.receiver_id = ? AND i.status = 'pending' ORDER BY i.created_at DESC`, [req.user.id]);
        res.json(rows);
    } catch (error) { res.status(500).json({ error: 'Internal server error' }); }
});

app.post('/api/invitations/:id/respond', authenticateToken, async (req, res) => {
    try {
        const { status } = req.body; 
        const [invs] = await pool.query('SELECT * FROM invitations WHERE id = ? AND receiver_id = ? AND status = "pending"', [req.params.id, req.user.id]);
        if (invs.length === 0) return res.status(404).json({ error: 'Invitation not found' });
        const inv = invs[0];
        await pool.query('UPDATE invitations SET status = ? WHERE id = ?', [status, inv.id]);
        if (status === 'accepted') await pool.query('INSERT IGNORE INTO collaborators (user_id, resource_type, resource_id) VALUES (?, ?, ?)', [req.user.id, inv.resource_type, inv.resource_id]);
        res.json({ message: `Invitation ${status}` });
    } catch (error) { res.status(500).json({ error: 'Internal server error' }); }
});

app.get('/api/users/search', authenticateToken, async (req, res) => {
    try {
        const q = req.query.q || ''; if (q.length < 2) return res.json([]);
        const [users] = await pool.query('SELECT id, username FROM users WHERE username LIKE ? AND id != ? LIMIT 10', [`%${q}%`, req.user.id]);
        res.json(users);
    } catch(e) { res.status(500).json({error: 'Error searching users'}); }
});

app.get('/api/workspaces/:workspaceId/collaborators', authenticateToken, async (req, res) => {
    try { const [rows] = await pool.query(`SELECT c.user_id, u.username, c.created_at FROM collaborators c JOIN users u ON c.user_id = u.id WHERE c.resource_type = 'workspace' AND c.resource_id = ?`, [req.params.workspaceId]); res.json(rows); } catch(e) { res.status(500).json({error: 'Error'}); }
});
app.delete('/api/workspaces/:workspaceId/collaborators/:userId', authenticateToken, async (req, res) => {
    try { await pool.query('DELETE FROM collaborators WHERE user_id = ? AND resource_type = "workspace" AND resource_id = ?', [req.params.userId, req.params.workspaceId]); res.json({ message: 'Revoked' }); } catch(e) { res.status(500).json({error: 'Error'}); }
});

app.get('/api/workspaces', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query(`SELECT DISTINCT w.*, (w.user_id = ?) AS is_owner FROM workspaces w LEFT JOIN collaborators cw ON w.id = cw.resource_id AND cw.resource_type = 'workspace' AND cw.user_id = ? WHERE w.user_id = ? OR cw.id IS NOT NULL ORDER BY w.created_at ASC`, [req.user.id, req.user.id, req.user.id]);
        res.json(rows);
    } catch (error) { res.status(500).json({ error: 'Internal server error' }); }
});
app.post('/api/workspaces', authenticateToken, async (req, res) => {
    try { const [result] = await pool.query('INSERT INTO workspaces (user_id, name) VALUES (?, ?)', [req.user.id, req.body.name]); res.status(201).json({ id: result.insertId, name: req.body.name }); } catch (error) { res.status(500).json({ error: 'Error' }); }
});
app.delete('/api/workspaces/:id', authenticateToken, async (req, res) => {
    try {
        const [ws] = await pool.query('SELECT user_id FROM workspaces WHERE id = ?', [req.params.id]);
        if (ws.length === 0) return res.status(404).json({ error: 'Workspace not found' });
        if (ws[0].user_id === req.user.id) {
            await pool.query('DELETE FROM workspaces WHERE id = ?', [req.params.id]); res.json({ message: 'Deleted' });
        } else {
            await pool.query('DELETE FROM collaborators WHERE user_id = ? AND resource_type = "workspace" AND resource_id = ?', [req.user.id, req.params.id]); res.json({ message: 'Left workspace' });
        }
    } catch (error) { res.status(500).json({ error: 'Error' }); }
});

app.get('/api/workspaces/:workspaceId/folders', authenticateToken, async (req, res) => { try { const [rows] = await pool.query('SELECT * FROM folders WHERE workspace_id = ? ORDER BY created_at ASC', [req.params.workspaceId]); res.json(rows); } catch (e) { res.status(500).json({ error: 'Error' }); } });
app.post('/api/workspaces/:workspaceId/folders', authenticateToken, async (req, res) => { try { const [r] = await pool.query('INSERT INTO folders (workspace_id, name) VALUES (?, ?)', [req.params.workspaceId, req.body.name]); res.status(201).json({ id: r.insertId, name: req.body.name }); } catch (e) { res.status(500).json({ error: 'Error' }); } });
app.delete('/api/workspaces/:workspaceId/folders/:id', authenticateToken, async (req, res) => { try { await pool.query('DELETE FROM folders WHERE id = ? AND workspace_id = ?', [req.params.id, req.params.workspaceId]); res.json({ message: 'Deleted' }); } catch (e) { res.status(500).json({ error: 'Error' }); } });

const safeStr = (val) => typeof val === 'string' ? val : JSON.stringify(val || []);
const safeObj = (val) => typeof val === 'string' ? val : JSON.stringify(val || {});

app.get('/api/workspaces/:workspaceId/requests', authenticateToken, async (req, res) => { try { const [rows] = await pool.query('SELECT * FROM requests WHERE workspace_id = ? ORDER BY created_at DESC', [req.params.workspaceId]); res.json(rows); } catch (e) { res.status(500).json({ error: 'Error' }); } });
app.post('/api/workspaces/:workspaceId/requests', authenticateToken, async (req, res) => { try { const { name, method, url, headers, body, bodyType, assertions, authorization, pre_request_script, post_request_script, folder_id } = req.body; const [r] = await pool.query('INSERT INTO requests (user_id, workspace_id, folder_id, name, method, url, headers, body_type, body, assertions, authorization, pre_request_script, post_request_script) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [req.user.id, req.params.workspaceId, folder_id || null, name || 'Untitled', method, url, safeStr(headers), bodyType || 'none', body, safeStr(assertions), safeObj(authorization), pre_request_script || '', post_request_script || '']); res.status(201).json({ id: r.insertId }); } catch (e) { res.status(500).json({ error: 'Error' }); } });
app.put('/api/workspaces/:workspaceId/requests/:id', authenticateToken, async (req, res) => { try { const { name, method, url, headers, body, bodyType, assertions, authorization, pre_request_script, post_request_script, folder_id } = req.body; await pool.query('UPDATE requests SET name=?, method=?, url=?, headers=?, body_type=?, body=?, assertions=?, authorization=?, pre_request_script=?, post_request_script=?, folder_id=? WHERE id=? AND workspace_id=?', [name, method, url, safeStr(headers), bodyType || 'none', body, safeStr(assertions), safeObj(authorization), pre_request_script || '', post_request_script || '', folder_id || null, req.params.id, req.params.workspaceId]); res.json({ message: 'Updated' }); } catch (e) { res.status(500).json({ error: 'Error' }); } });
app.delete('/api/workspaces/:workspaceId/requests/:id', authenticateToken, async (req, res) => { try { await pool.query('DELETE FROM requests WHERE id = ? AND workspace_id = ?', [req.params.id, req.params.workspaceId]); res.json({ message: 'Deleted' }); } catch (e) { res.status(500).json({ error: 'Error' }); } });

app.get('/api/workspaces/:workspaceId/variables', authenticateToken, async (req, res) => { try { const [rows] = await pool.query('SELECT id, var_key, var_value FROM variables WHERE workspace_id = ? ORDER BY var_key ASC', [req.params.workspaceId]); res.json(rows); } catch (e) { res.status(500).json({ error: 'Error' }); } });
app.post('/api/workspaces/:workspaceId/variables', authenticateToken, async (req, res) => { try { await pool.query('INSERT INTO variables (user_id, workspace_id, var_key, var_value) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE var_value = ?', [req.user.id, req.params.workspaceId, req.body.var_key, req.body.var_value, req.body.var_value]); res.status(201).json({ message: 'Saved' }); } catch (e) { res.status(500).json({ error: 'Error' }); } });
app.delete('/api/workspaces/:workspaceId/variables/:id', authenticateToken, async (req, res) => { try { await pool.query('DELETE FROM variables WHERE id = ? AND workspace_id = ?', [req.params.id, req.params.workspaceId]); res.json({ message: 'Deleted' }); } catch (e) { res.status(500).json({ error: 'Error' }); } });

app.get('/api/workspaces/:workspaceId/mocks', authenticateToken, async (req, res) => { try { const [rows] = await pool.query('SELECT * FROM mocks WHERE workspace_id = ? ORDER BY path ASC', [req.params.workspaceId]); res.json(rows); } catch (e) { res.status(500).json({ error: 'Error' }); } });
app.post('/api/workspaces/:workspaceId/mocks', authenticateToken, async (req, res) => { try { let p = req.body.path.startsWith('/') ? req.body.path : '/'+req.body.path; const [r] = await pool.query('INSERT INTO mocks (user_id, workspace_id, name, method, path, status, headers, body) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [req.user.id, req.params.workspaceId, req.body.name||'Mock', req.body.method, p, req.body.status||200, JSON.stringify(req.body.headers||[]), req.body.body]); res.status(201).json({ id: r.insertId }); } catch (e) { res.status(500).json({ error: 'Error' }); } });
app.put('/api/workspaces/:workspaceId/mocks/:id', authenticateToken, async (req, res) => { try { let p = req.body.path.startsWith('/') ? req.body.path : '/'+req.body.path; await pool.query('UPDATE mocks SET name=?, method=?, path=?, status=?, headers=?, body=? WHERE id=? AND workspace_id=?', [req.body.name, req.body.method, p, req.body.status, JSON.stringify(req.body.headers||[]), req.body.body, req.params.id, req.params.workspaceId]); res.json({ message: 'Updated' }); } catch (e) { res.status(500).json({ error: 'Error' }); } });
app.delete('/api/workspaces/:workspaceId/mocks/:id', authenticateToken, async (req, res) => { try { await pool.query('DELETE FROM mocks WHERE id = ? AND workspace_id = ?', [req.params.id, req.params.workspaceId]); res.json({ message: 'Deleted' }); } catch (e) { res.status(500).json({ error: 'Error' }); } });

const applyVarsMock = (text, vars) => { if (!text) return text; let r = text; vars.forEach(v => { if (v.var_key && v.var_value) r = r.replace(new RegExp(`\\{\\{${v.var_key}\\}\\}`, 'g'), v.var_value); }); return r; };
app.all('/api/mock/:workspaceId/*', async (req, res) => {
    try {
        let p = '/' + req.params[0];
        let [rows] = await pool.query('SELECT * FROM mocks WHERE workspace_id = ? AND method = ? AND path = ?', [req.params.workspaceId, req.method, p]);
        if (rows.length === 0) { p = p.endsWith('/') ? p.slice(0, -1) : p + '/'; [rows] = await pool.query('SELECT * FROM mocks WHERE workspace_id = ? AND method = ? AND path = ?', [req.params.workspaceId, req.method, p]); }
        if (rows.length === 0) return res.status(404).json({ error: 'Mock not found' });
        const mock = rows[0]; const [varsList] = await pool.query('SELECT var_key, var_value FROM variables WHERE workspace_id = ?', [req.params.workspaceId]);
        if (mock.headers) { let h = []; try { h = typeof mock.headers === 'string' ? JSON.parse(mock.headers) : mock.headers; } catch(e){} h.forEach(hi => { if (hi.key && hi.value) res.setHeader(applyVarsMock(hi.key, varsList), applyVarsMock(hi.value, varsList)); }); }
        let body = applyVarsMock(mock.body || '', varsList); if (!res.getHeader('content-type') && body.trim().startsWith('{')) res.setHeader('Content-Type', 'application/json');
        res.status(mock.status || 200).send(body);
    } catch (e) { res.status(500).json({ error: 'Mock error' }); }
});

app.get('/api/workspaces/:workspaceId/scenarios', authenticateToken, async (req, res) => { try { const [rows] = await pool.query('SELECT * FROM scenarios WHERE workspace_id = ? ORDER BY created_at DESC', [req.params.workspaceId]); res.json(rows); } catch (e) { res.status(500).json({ error: 'Error' }); } });
app.post('/api/workspaces/:workspaceId/scenarios', authenticateToken, async (req, res) => { try { const [r] = await pool.query('INSERT INTO scenarios (user_id, workspace_id, name, nodes) VALUES (?, ?, ?, ?)', [req.user.id, req.params.workspaceId, req.body.name, JSON.stringify(req.body.nodes)]); res.status(201).json({ id: r.insertId }); } catch (e) { res.status(500).json({ error: 'Error' }); } });
app.put('/api/workspaces/:workspaceId/scenarios/:id', authenticateToken, async (req, res) => { try { await pool.query('UPDATE scenarios SET name=?, nodes=? WHERE id=? AND workspace_id=?', [req.body.name, JSON.stringify(req.body.nodes), req.params.id, req.params.workspaceId]); res.json({ message: 'Updated' }); } catch (e) { res.status(500).json({ error: 'Error' }); } });
app.delete('/api/workspaces/:workspaceId/scenarios/:id', authenticateToken, async (req, res) => { try { await pool.query('DELETE FROM scenarios WHERE id=? AND workspace_id=?', [req.params.id, req.params.workspaceId]); res.json({ message: 'Deleted' }); } catch (e) { res.status(500).json({ error: 'Error' }); } });

app.post('/api/proxy', authenticateToken, upload.any(), async (req, res) => {
    try {
        const { method, url, headersStr, bodyType } = req.body;
        const isLocal = url && (url.includes('localhost') || url.includes('127.0.0.1'));
        if (isLocal) {
            const agentWs = connectedAgents.get(req.user.id);
            if (!agentWs || agentWs.readyState !== 1) return res.status(502).json({ error: 'Local Agent is offline. Please start your agent.' });
            const reqId = crypto.randomUUID();
            let parts = [];
            if (bodyType === 'form-data') {
                for (const [k, v] of Object.entries(req.body)) { if (!['method','url','headersStr','bodyType','bodyContent'].includes(k) && !k.startsWith('urlencodedEntries[')) parts.push({ type: 'text', key: k, value: v }); }
                if (req.files) req.files.forEach(f => { parts.push({ type: 'file', key: f.fieldname, filename: f.originalname, buffer: f.buffer.toString('base64') }); });
            }
            agentWs.send(JSON.stringify({ type: 'REQUEST', id: reqId, method: method || 'GET', url: url, headersStr: headersStr || '[]', bodyType: bodyType || 'none', bodyContent: req.body.bodyContent || '', urlencodedEntries: req.body.urlencodedEntries || '[]', formDataParts: parts }));
            const agentResponse = await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => { pendingRequests.delete(reqId); reject(new Error('Agent request timed out')); }, 30000);
                pendingRequests.set(reqId, { resolve: (data) => { clearTimeout(timeout); resolve(data); }, reject });
            });
            return res.json({ status: agentResponse.status, statusText: agentResponse.statusText, headers: agentResponse.headers, data: agentResponse.data, time: agentResponse.time });
        }
        let headers = {};
        if (headersStr) { try { JSON.parse(headersStr).forEach(h => { if (h.key && h.value) headers[h.key] = h.value; }); } catch (e) {} }
        delete headers['host']; delete headers['content-length'];
        let data = req.body.bodyContent;
        if (bodyType === 'json') { try { if (data) JSON.parse(data); if (!headers['Content-Type']) headers['Content-Type'] = 'application/json'; } catch(e) { return res.status(400).json({ error: 'Invalid JSON body' }); } }
        else if (bodyType === 'form-data') { const fd = new FormData(); for (const [k, v] of Object.entries(req.body)) { if (!['method','url','headersStr','bodyType','bodyContent'].includes(k) && !k.startsWith('urlencodedEntries[')) fd.append(k, v); } if (req.files) req.files.forEach(f => fd.append(f.fieldname, f.buffer, {filename: f.originalname})); data = fd; Object.assign(headers, fd.getHeaders()); }
        else if (bodyType === 'urlencoded') { const p = new URLSearchParams(); if (req.body.urlencodedEntries) { try { let e = typeof req.body.urlencodedEntries === 'string' ? JSON.parse(req.body.urlencodedEntries) : req.body.urlencodedEntries; if(Array.isArray(e)) e.forEach(en => { if(en.key) p.append(en.key, en.value||''); }); } catch(err){} } data = p.toString(); if (!headers['Content-Type']) headers['Content-Type'] = 'application/x-www-form-urlencoded'; }
        
        const start = Date.now();
        const response = await axios({ method: method||'GET', url, headers, data, validateStatus: () => true, timeout: 30000 });
        res.json({ status: response.status, statusText: response.statusText, headers: response.headers, data: response.data, time: Date.now() - start });
    } catch (e) { res.status(500).json({ error: 'Failed to proxy request', details: e.message }); }
});

const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((wsClient) => {
        if (wsClient.isAlive === false) return wsClient.terminate();
        wsClient.isAlive = false; wsClient.ping();
    });
}, 30000);
wss.on('close', () => { clearInterval(heartbeatInterval); });

server.listen(port, () => { console.log(`Server running on port ${port}`); });

