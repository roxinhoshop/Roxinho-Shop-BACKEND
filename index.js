require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Criar pool de conexões
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 60000,
    acquireTimeout: 60000,
    timeout: 60000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
});

// Endpoint raiz
app.get('/', (req, res) => {
    res.json({
        status: 'success',
        message: 'API Backend Node.js está funcionando',
        version: '1.0.0',
        endpoints: {
            test: 'GET /api/test',
            produtos: 'GET /api/produtos',
            produtoById: 'GET /api/produtos/:id',
            produtosByCategoria: 'GET /api/produtos/categoria/:categoriaId',
            produtosDestaque: 'GET /api/produtos/destaque/lista',
            categorias: 'GET /api/categorias'
        }
    });
});

// Endpoint de teste de conexão
app.get('/api/test', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT 1 as test, NOW() as now');
        res.json({
            status: 'success',
            message: 'Conexão com banco de dados estabelecida',
            database: process.env.DB_NAME,
            result: rows[0]
        });
    } catch (error) {
        console.error('Erro no /api/test:', error);
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

// Endpoint para listar todos os produtos ativos
app.get('/api/produtos', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT 
                p.*,
                c.nome as categoria_nome
            FROM produto p
            LEFT JOIN categorias c ON p.categoria_id = c.id
            WHERE p.ativo = 1
            ORDER BY p.data_criacao DESC
        `);
        
        res.json({
            status: 'success',
            count: rows.length,
            products: rows
        });
    } catch (error) {
        console.error('Erro ao buscar produtos:', error);
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

// Endpoint para buscar produto por ID
app.get('/api/produtos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(`
            SELECT 
                p.*,
                c.nome as categoria_nome
            FROM produto p
            LEFT JOIN categorias c ON p.categoria_id = c.id
            WHERE p.id = ? AND p.ativo = 1
        `, [id]);
        
        if (rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Produto não encontrado'
            });
        }
        
        res.json({
            status: 'success',
            product: rows[0]
        });
    } catch (error) {
        console.error('Erro ao buscar produto:', error);
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

// Endpoint para buscar produtos por categoria
app.get('/api/produtos/categoria/:categoriaId', async (req, res) => {
    try {
        const { categoriaId } = req.params;
        const [rows] = await pool.query(`
            SELECT 
                p.*,
                c.nome as categoria_nome
            FROM produto p
            LEFT JOIN categorias c ON p.categoria_id = c.id
            WHERE p.categoria_id = ? AND p.ativo = 1
            ORDER BY p.data_criacao DESC
        `, [categoriaId]);
        
        res.json({
            status: 'success',
            count: rows.length,
            products: rows
        });
    } catch (error) {
        console.error('Erro ao buscar produtos por categoria:', error);
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

// Endpoint para buscar produtos em destaque
app.get('/api/produtos/destaque/lista', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT 
                p.*,
                c.nome as categoria_nome
            FROM produto p
            LEFT JOIN categorias c ON p.categoria_id = c.id
            WHERE p.ativo = 1 AND p.destaque = 1
            ORDER BY p.data_criacao DESC
        `);
        
        res.json({
            status: 'success',
            count: rows.length,
            products: rows
        });
    } catch (error) {
        console.error('Erro ao buscar produtos em destaque:', error);
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

// Endpoint para listar categorias
app.get('/api/categorias', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT 
                c.*,
                COUNT(p.id) as total_produtos
            FROM categorias c
            LEFT JOIN produto p ON c.id = p.categoria_id AND p.ativo = 1
            GROUP BY c.id
            ORDER BY c.nome
        `);
        
        res.json({
            status: 'success',
            count: rows.length,
            categories: rows
        });
    } catch (error) {
        console.error('Erro ao buscar categorias:', error);
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

// Endpoint para criar novo produto (admin)
app.post('/api/produtos', async (req, res) => {
    try {
        const {
            nome, slug, descricao, descricao_curta, categoria_id,
            marca, modelo, sku, preco, preco_promocional, estoque,
            peso, dimensoes, imagem_principal, galeria_imagens,
            especificacoes, ativo, destaque
        } = req.body;

        const [result] = await pool.query(`
            INSERT INTO produto (
                nome, slug, descricao, descricao_curta, categoria_id,
                marca, modelo, sku, preco, preco_promocional, estoque,
                peso, dimensoes, imagem_principal, galeria_imagens,
                especificacoes, ativo, destaque
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            nome, slug, descricao, descricao_curta, categoria_id,
            marca, modelo, sku, preco, preco_promocional, estoque,
            peso, dimensoes, imagem_principal, 
            galeria_imagens ? JSON.stringify(galeria_imagens) : null,
            especificacoes ? JSON.stringify(especificacoes) : null,
            ativo !== undefined ? ativo : 1,
            destaque !== undefined ? destaque : 0
        ]);

        res.status(201).json({
            status: 'success',
            message: 'Produto criado com sucesso',
            productId: result.insertId
        });
    } catch (error) {
        console.error('Erro ao criar produto:', error);
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

// Endpoint para atualizar produto (admin)
app.put('/api/produtos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        const fields = Object.keys(updates);
        const values = Object.values(updates);
        
        if (fields.length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Nenhum campo para atualizar'
            });
        }
        
        const setClause = fields.map(field => `${field} = ?`).join(', ');
        values.push(id);
        
        const [result] = await pool.query(
            `UPDATE produto SET ${setClause} WHERE id = ?`,
            values
        );
        
        if (result.affectedRows === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Produto não encontrado'
            });
        }
        
        res.json({
            status: 'success',
            message: 'Produto atualizado com sucesso'
        });
    } catch (error) {
        console.error('Erro ao atualizar produto:', error);
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

// Endpoint para deletar produto (soft delete)
app.delete('/api/produtos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const [result] = await pool.query(
            'UPDATE produto SET ativo = 0 WHERE id = ?',
            [id]
        );
        
        if (result.affectedRows === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Produto não encontrado'
            });
        }
        
        res.json({
            status: 'success',
            message: 'Produto desativado com sucesso'
        });
    } catch (error) {
        console.error('Erro ao deletar produto:', error);
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

// Tratamento de rotas não encontradas
app.use((req, res) => {
    res.status(404).json({
        status: 'error',
        message: 'Endpoint não encontrado',
        path: req.path
    });
});

// Iniciar servidor
if (require.main === module) {
    app.listen(port, () => {
        console.log(`Servidor Node.js rodando em http://localhost:${port}`);
    });
}

// Exportar para Vercel
module.exports = app;

