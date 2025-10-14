const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// Configuração do banco de dados
const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    acquireTimeout: 60000,
    timeout: 60000,
    reconnect: true
};

const pool = mysql.createPool(dbConfig);

module.exports = async (req, res) => {
    // Configurar CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ status: "error", message: "Método não permitido" });
    }

    try {
        const { nome, email, senha } = req.body;

        if (!nome || !email || !senha) {
            return res.status(400).json({ 
                status: "error", 
                message: "Nome, email e senha são obrigatórios" 
            });
        }

        // Verificar se o email já existe
        const [existingUser] = await pool.query(
            'SELECT id FROM usuarios WHERE email = ?',
            [email]
        );

        if (existingUser.length > 0) {
            return res.status(409).json({ 
                status: "error", 
                message: "Email já cadastrado" 
            });
        }

        // Criptografar senha
        const senhaHash = await bcrypt.hash(senha, 10);

        // Inserir usuário no banco
        const [result] = await pool.query(
            'INSERT INTO usuarios (nome, email, senha) VALUES (?, ?, ?)',
            [nome, email, senhaHash]
        );

        // Gerar token JWT
        const token = jwt.sign(
            { id: result.insertId, email },
            process.env.JWT_SECRET || 'fallback_secret',
            { expiresIn: '24h' }
        );

        res.status(201).json({
            status: "success",
            message: "Usuário cadastrado com sucesso",
            token,
            usuario: {
                id: result.insertId,
                nome,
                email
            }
        });

    } catch (error) {
        console.error('Erro no registro:', error);
        res.status(500).json({
            status: "error",
            message: "Erro interno do servidor"
        });
    }
};