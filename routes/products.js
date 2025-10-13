const express = require("express");
const router = express.Router();
const mysql = require("mysql2/promise");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "supersecretjwtkey";

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (token == null) return res.sendStatus(401);
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

const authorizeAdmin = (req, res, next) => {
    if (!req.user || req.user.isAdmin !== 1) {
        return res.status(403).json({ message: "Acesso negado. Requer privilégios de administrador." });
    }
    next();
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, "../uploads"); // Ajustado para subir um nível
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath);
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname);
    }
});
const upload = multer({ storage: storage });

module.exports = (pool) => {
    // Rota para listar todos os produtos
    router.get("/", async (req, res) => {
        try {
            const [rows] = await pool.query("SELECT * FROM produto WHERE ativo = 1");
            res.json({
                status: 'success',
                products: rows
            });
        } catch (error) {
            res.status(500).json({ 
                status: 'error',
                message: error.message 
            });
        }
    });

    // Rota para obter um produto por ID
    router.get("/:id", async (req, res) => {
        try {
            const { id } = req.params;
            const [rows] = await pool.query("SELECT * FROM produto WHERE id = ? AND ativo = 1", [id]);
            if (rows.length === 0) {
                return res.status(404).json({ 
                    status: 'error',
                    message: "Produto não encontrado." 
                });
            }
            res.json({
                status: 'success',
                product: rows[0]
            });
        } catch (error) {
            res.status(500).json({ 
                status: 'error',
                message: error.message 
            });
        }
    });

    // Rota para criar um novo produto (SEM autenticação para permitir importação)
    router.post("/", async (req, res) => {
        try {
            const { 
                nome, 
                descricao, 
                preco, 
                estoque = 10, 
                imagem, 
                origem = 'Manual',
                link_original = '',
                ativo = 1,
                marca = null,
                modelo = null
            } = req.body;
            
            // Determinar link correto baseado na origem
            let link_amazon = null;
            let link_mercado_livre = null;
            let preco_amazon = null;
            let preco_mercado_livre = null;
            
            if (origem === 'Amazon') {
                link_amazon = link_original;
                preco_amazon = preco;
            } else if (origem === 'Mercado Livre') {
                link_mercado_livre = link_original;
                preco_mercado_livre = preco;
            }
            
            // Inserir produto com campos corretos da tabela
            const [result] = await pool.query(
                `INSERT INTO produto (
                    nome, descricao, preco, estoque, 
                    imagem_principal, marca, modelo,
                    link_amazon, preco_amazon,
                    link_mercado_livre, preco_mercado_livre,
                    ativo
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
                [
                    nome, 
                    descricao, 
                    preco, 
                    estoque, 
                    imagem, 
                    marca,
                    modelo,
                    link_amazon,
                    preco_amazon,
                    link_mercado_livre,
                    preco_mercado_livre,
                    ativo
                ]
            );
            
            res.status(201).json({ 
                success: true,
                status: 'success',
                message: "Produto criado com sucesso!", 
                id: result.insertId,
                productId: result.insertId
            });
        } catch (error) {
            console.error('Erro ao criar produto:', error);
            res.status(500).json({ 
                success: false,
                status: 'error',
                message: error.message 
            });
        }
    });

    // Rota para atualizar um produto existente (apenas admin)
    router.put("/:id", authenticateToken, authorizeAdmin, upload.single("imagem"), async (req, res) => {
        try {
            const { id } = req.params;
            const { nome, descricao, preco, estoque, categoria_id } = req.body;
            let imagem_principal = req.file ? `/uploads/${req.file.filename}` : null;

            // Se uma nova imagem não for enviada, mantenha a imagem existente
            if (!imagem_principal) {
                const [product] = await pool.query("SELECT imagem_principal FROM produto WHERE id = ?", [id]);
                if (product.length > 0) {
                    imagem_principal = product[0].imagem_principal;
                }
            }

            const [result] = await pool.query("UPDATE produto SET nome = ?, descricao = ?, preco = ?, estoque = ?, imagem_principal = ?, categoria_id = ? WHERE id = ?", [nome, descricao, preco, estoque, imagem_principal, categoria_id, id]);
            if (result.affectedRows === 0) {
                return res.status(404).json({ message: "Produto não encontrado." });
            }
            res.json({ 
                status: 'success',
                message: "Produto atualizado com sucesso!" 
            });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    });

    // Rota para desativar (soft delete) um produto (apenas admin)
    router.delete("/:id", authenticateToken, authorizeAdmin, async (req, res) => {
        try {
            const { id } = req.params;
            const [result] = await pool.query("UPDATE produto SET ativo = 0 WHERE id = ?", [id]);
            if (result.affectedRows === 0) {
                return res.status(404).json({ message: "Produto não encontrado." });
            }
            res.json({ 
                status: 'success',
                message: "Produto desativado com sucesso!" 
            });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    });

    return router;
};
