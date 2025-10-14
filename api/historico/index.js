const mysql = require("mysql2/promise");
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

// Middleware para verificar token
const verificarToken = (req) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        throw new Error('Token não fornecido');
    }

    try {
        return jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    } catch (error) {
        throw new Error('Token inválido');
    }
};

module.exports = async (req, res) => {
    // Configurar CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const usuario = verificarToken(req);

        if (req.method === 'GET') {
            // Buscar histórico do usuário
            const [rows] = await pool.query(`
                SELECT h.*, p.nome, p.preco, p.imagem_url 
                FROM historico_visualizacao h 
                JOIN produtos p ON h.produto_id = p.id 
                WHERE h.usuario_id = ? 
                ORDER BY h.data_visualizacao DESC 
                LIMIT 10
            `, [usuario.id]);

            return res.json({
                status: "success",
                historico: rows
            });

        } else if (req.method === 'POST') {
            const { produto_id } = req.body;

            if (!produto_id) {
                return res.status(400).json({
                    status: "error",
                    message: "ID do produto é obrigatório"
                });
            }

            // Verificar se o produto existe
            const [produto] = await pool.query(
                'SELECT id FROM produtos WHERE id = ?',
                [produto_id]
            );

            if (produto.length === 0) {
                return res.status(404).json({
                    status: "error",
                    message: "Produto não encontrado"
                });
            }

            // Verificar se já existe no histórico
            const [existente] = await pool.query(
                'SELECT id FROM historico_visualizacao WHERE usuario_id = ? AND produto_id = ?',
                [usuario.id, produto_id]
            );

            if (existente.length > 0) {
                // Atualizar data de visualização
                await pool.query(
                    'UPDATE historico_visualizacao SET data_visualizacao = NOW() WHERE usuario_id = ? AND produto_id = ?',
                    [usuario.id, produto_id]
                );
            } else {
                // Inserir novo registro
                await pool.query(
                    'INSERT INTO historico_visualizacao (usuario_id, produto_id, data_visualizacao) VALUES (?, ?, NOW())',
                    [usuario.id, produto_id]
                );
            }

            return res.json({
                status: "success",
                message: "Produto adicionado ao histórico"
            });

        } else {
            return res.status(405).json({
                status: "error",
                message: "Método não permitido"
            });
        }

    } catch (error) {
        console.error('Erro no histórico:', error);
        
        if (error.message.includes('Token')) {
            return res.status(401).json({
                status: "error",
                message: error.message
            });
        }

        return res.status(500).json({
            status: "error",
            message: "Erro interno do servidor"
        });
    }
};