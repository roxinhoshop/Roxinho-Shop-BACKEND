require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// Criar pool de conexões
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

console.log('Pool criado');

app.get('/test', async (req, res) => {
    try {
        console.log('Endpoint /test chamado');
        console.log('Pool:', typeof pool);
        const [rows] = await pool.query('SELECT 1 as test');
        console.log('Query executada:', rows);
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Erro:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(\`Servidor rodando na porta \${port}\`);
});
