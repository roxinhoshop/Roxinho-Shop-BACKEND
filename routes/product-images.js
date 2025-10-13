const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "supersecretjwtkey";

// Middleware de autenticação
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

// Middleware de autorização admin
const authorizeAdmin = (req, res, next) => {
    if (!req.user || req.user.isAdmin !== 1) {
        return res.status(403).json({ message: "Acesso negado. Requer privilégios de administrador." });
    }
    next();
};

module.exports = (pool) => {
    // Listar imagens de um produto
    router.get("/product/:id", async (req, res) => {
        try {
            const { id } = req.params;
            const [rows] = await pool.query(
                "SELECT * FROM produto_imagens WHERE produto_id = ? ORDER BY ordem ASC",
                [id]
            );
            res.json({
                status: 'success',
                images: rows
            });
        } catch (error) {
            res.status(500).json({
                status: 'error',
                message: error.message
            });
        }
    });

    // Adicionar imagem ao produto (Admin)
    router.post("/", authenticateToken, authorizeAdmin, async (req, res) => {
        try {
            const { produto_id, url, tipo, ordem, alt_text } = req.body;

            if (!produto_id || !url) {
                return res.status(400).json({
                    status: 'error',
                    message: 'produto_id e url são obrigatórios'
                });
            }

            const [result] = await pool.query(
                `INSERT INTO produto_imagens 
                (produto_id, url, tipo, ordem, alt_text) 
                VALUES (?, ?, ?, ?, ?)`,
                [produto_id, url, tipo || 'galeria', ordem || 0, alt_text || '']
            );

            res.status(201).json({
                status: 'success',
                message: 'Imagem adicionada com sucesso',
                id: result.insertId
            });
        } catch (error) {
            res.status(500).json({
                status: 'error',
                message: error.message
            });
        }
    });

    // Atualizar imagem (Admin)
    router.put("/:id", authenticateToken, authorizeAdmin, async (req, res) => {
        try {
            const { id } = req.params;
            const { url, tipo, ordem, alt_text } = req.body;

            const [result] = await pool.query(
                `UPDATE produto_imagens 
                SET url = COALESCE(?, url),
                    tipo = COALESCE(?, tipo),
                    ordem = COALESCE(?, ordem),
                    alt_text = COALESCE(?, alt_text)
                WHERE id = ?`,
                [url, tipo, ordem, alt_text, id]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Imagem não encontrada'
                });
            }

            res.json({
                status: 'success',
                message: 'Imagem atualizada com sucesso'
            });
        } catch (error) {
            res.status(500).json({
                status: 'error',
                message: error.message
            });
        }
    });

    // Deletar imagem (Admin)
    router.delete("/:id", authenticateToken, authorizeAdmin, async (req, res) => {
        try {
            const { id } = req.params;

            const [result] = await pool.query(
                "DELETE FROM produto_imagens WHERE id = ?",
                [id]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Imagem não encontrada'
                });
            }

            res.json({
                status: 'success',
                message: 'Imagem deletada com sucesso'
            });
        } catch (error) {
            res.status(500).json({
                status: 'error',
                message: error.message
            });
        }
    });

    return router;
};

