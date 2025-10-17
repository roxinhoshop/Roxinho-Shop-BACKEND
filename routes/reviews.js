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

module.exports = (pool) => {
    // Listar avaliações de um produto
    router.get("/product/:id", async (req, res) => {
        try {
            const { id } = req.params;
            const [rows] = await pool.query(
                `SELECT 
                    a.*,
                    u.nome as usuario_nome,
                    u.foto_perfil as usuario_foto
                FROM avaliacoes a
                JOIN usuarios u ON a.usuario_id = u.id
                WHERE a.produto_id = ?
                ORDER BY a.data_criacao DESC`,
                [id]
            );

            // Calcular estatísticas
            const [stats] = await pool.query(
                `SELECT 
                    COUNT(*) as total,
                    AVG(nota) as media,
                    SUM(CASE WHEN nota = 5 THEN 1 ELSE 0 END) as cinco_estrelas,
                    SUM(CASE WHEN nota = 4 THEN 1 ELSE 0 END) as quatro_estrelas,
                    SUM(CASE WHEN nota = 3 THEN 1 ELSE 0 END) as tres_estrelas,
                    SUM(CASE WHEN nota = 2 THEN 1 ELSE 0 END) as duas_estrelas,
                    SUM(CASE WHEN nota = 1 THEN 1 ELSE 0 END) as uma_estrela
                FROM avaliacoes
                WHERE produto_id = ?`,
                [id]
            );

            res.json({
                status: 'success',
                reviews: rows,
                stats: stats[0]
            });
        } catch (error) {
            res.status(500).json({
                status: 'error',
                message: error.message
            });
        }
    });

    // Criar avaliação (usuário autenticado)
    router.post("/", authenticateToken, async (req, res) => {
        try {
            const { produto_id, nota, titulo, comentario } = req.body;
            const usuario_id = req.user.id;

            // Validações
            if (!produto_id || !nota) {
                return res.status(400).json({
                    status: 'error',
                    message: 'produto_id e nota são obrigatórios'
                });
            }

            if (nota < 1 || nota > 5) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Nota deve estar entre 1 e 5'
                });
            }

            // Verificar se o usuário já avaliou este produto
            const [existing] = await pool.query(
                "SELECT id FROM avaliacoes WHERE produto_id = ? AND usuario_id = ?",
                [produto_id, usuario_id]
            );

            if (existing.length > 0) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Você já avaliou este produto'
                });
            }

            // Criar avaliação
            const [result] = await pool.query(
                `INSERT INTO avaliacoes 
                (produto_id, usuario_id, usuario_nome, nota, titulo, comentario) 
                VALUES (?, ?, ?, ?, ?, ?)`,
                [produto_id, usuario_id, req.user.nome, nota, titulo || null, comentario || null]
            );

            res.status(201).json({
                status: 'success',
                message: 'Avaliação criada com sucesso',
                id: result.insertId
            });
        } catch (error) {
            res.status(500).json({
                status: 'error',
                message: error.message
            });
        }
    });

    // Atualizar avaliação (próprio usuário)
    router.put("/:id", authenticateToken, async (req, res) => {
        try {
            const { id } = req.params;
            const { nota, titulo, comentario } = req.body;
            const usuario_id = req.user.id;

            // Verificar se a avaliação pertence ao usuário
            const [review] = await pool.query(
                "SELECT usuario_id FROM avaliacoes WHERE id = ?",
                [id]
            );

            if (review.length === 0) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Avaliação não encontrada'
                });
            }

            if (review[0].usuario_id !== usuario_id) {
                return res.status(403).json({
                    status: 'error',
                    message: 'Você não tem permissão para editar esta avaliação'
                });
            }

            // Atualizar avaliação
            const [result] = await pool.query(
                `UPDATE avaliacoes 
                SET nota = COALESCE(?, nota),
                    titulo = COALESCE(?, titulo),
                    comentario = COALESCE(?, comentario)
                WHERE id = ?`,
                [nota, titulo, comentario, id]
            );

            res.json({
                status: 'success',
                message: 'Avaliação atualizada com sucesso'
            });
        } catch (error) {
            res.status(500).json({
                status: 'error',
                message: error.message
            });
        }
    });

    // Deletar avaliação (próprio usuário)
    router.delete("/:id", authenticateToken, async (req, res) => {
        try {
            const { id } = req.params;
            const usuario_id = req.user.id;

            // Verificar se a avaliação pertence ao usuário
            const [review] = await pool.query(
                "SELECT usuario_id FROM avaliacoes WHERE id = ?",
                [id]
            );

            if (review.length === 0) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Avaliação não encontrada'
                });
            }

            if (review[0].usuario_id !== usuario_id) {
                return res.status(403).json({
                    status: 'error',
                    message: 'Você não tem permissão para deletar esta avaliação'
                });
            }

            // Deletar avaliação
            await pool.query("DELETE FROM avaliacoes WHERE id = ?", [id]);

            res.json({
                status: 'success',
                message: 'Avaliação deletada com sucesso'
            });
        } catch (error) {
            res.status(500).json({
                status: 'error',
                message: error.message
            });
        }
    });

    // Votar em avaliação como útil
    router.post("/:id/vote", authenticateToken, async (req, res) => {
        try {
            const { id } = req.params;
            const { util } = req.body; // true ou false
            const usuario_id = req.user.id;

            // Verificar se já votou
            const [existing] = await pool.query(
                "SELECT id FROM avaliacao_votos WHERE avaliacao_id = ? AND usuario_id = ?",
                [id, usuario_id]
            );

            if (existing.length > 0) {
                // Atualizar voto
                await pool.query(
                    "UPDATE avaliacao_votos SET util = ? WHERE avaliacao_id = ? AND usuario_id = ?",
                    [util, id, usuario_id]
                );
            } else {
                // Criar voto
                await pool.query(
                    "INSERT INTO avaliacao_votos (avaliacao_id, usuario_id, util) VALUES (?, ?, ?)",
                    [id, usuario_id, util]
                );
            }

            // Atualizar contador na avaliação
            const [votes] = await pool.query(
                "SELECT COUNT(*) as count FROM avaliacao_votos WHERE avaliacao_id = ? AND util = 1",
                [id]
            );

            await pool.query(
                "UPDATE avaliacoes SET util_count = ? WHERE id = ?",
                [votes[0].count, id]
            );

            res.json({
                status: 'success',
                message: 'Voto registrado com sucesso',
                util_count: votes[0].count
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

