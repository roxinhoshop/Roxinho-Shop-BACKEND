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
    // Listar todas as categorias ativas (público)
    router.get("/", async (req, res) => {
        try {
            const [rows] = await pool.query(
                "SELECT * FROM categorias WHERE ativo = 1 ORDER BY ordem ASC, nome ASC"
            );
            const categorias = {};
            rows.forEach(row => {
                if (!row.categoria_pai_id) {
                    categorias[row.id] = { ...row, subcategorias: [] };
                }
            });
            rows.forEach(row => {
                if (row.categoria_pai_id && categorias[row.categoria_pai_id]) {
                    categorias[row.categoria_pai_id].subcategorias.push(row);
                }
            });
            res.json(Object.values(categorias));
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    });

    // Obter uma subcategoria por slug da categoria pai
    router.get("/:parentSlug/:subSlug", async (req, res) => {
        try {
            const { parentSlug, subSlug } = req.params;

            const [parentRows] = await pool.query(
                "SELECT id FROM categorias WHERE slug = ? AND ativo = 1",
                [parentSlug]
            );
            if (parentRows.length === 0) {
                return res.status(404).json({ message: "Categoria pai não encontrada." });
            }
            const parentId = parentRows[0].id;

            const [subRows] = await pool.query(
                "SELECT * FROM categorias WHERE slug = ? AND categoria_pai_id = ? AND ativo = 1",
                [subSlug, parentId]
            );
            if (subRows.length === 0) {
                return res.status(404).json({ message: "Subcategoria não encontrada." });
            }
            res.json(subRows[0]);
        } catch (error) {
            console.error("Erro ao obter subcategoria por slug:", error);
            res.status(500).json({ message: error.message });
        }
    });

    // Obter uma categoria por slug (incluindo suas subcategorias)
    router.get("/:slug", async (req, res) => {
        try {
            const { slug } = req.params;
            const [rows] = await pool.query(
                "SELECT * FROM categorias WHERE slug = ? AND ativo = 1",
                [slug]
            );
            if (rows.length === 0) {
                return res.status(404).json({ message: "Categoria não encontrada." });
            }
            const categoriaPrincipal = { ...rows[0], subcategorias: [] };

            const [subRows] = await pool.query(
                "SELECT * FROM categorias WHERE categoria_pai_id = ? AND ativo = 1 ORDER BY ordem ASC, nome ASC",
                [categoriaPrincipal.id]
            );
            categoriaPrincipal.subcategorias = subRows;

            res.json(categoriaPrincipal);
        } catch (error) {
            console.error("Erro ao obter categoria por slug:", error);
            res.status(500).json({ message: error.message });
        }
    });

    // Obter uma categoria por ID (deve vir por último para evitar conflito com slugs)
    router.get("/:id", async (req, res) => {
        try {
            const { id } = req.params;
            // Verificar se o ID é um número para evitar conflito com slugs
            if (isNaN(id)) {
                return res.status(404).json({ message: "Formato de ID inválido." });
            }
            const [rows] = await pool.query(
                "SELECT * FROM categorias WHERE id = ?",
                [id]
            );
            if (rows.length === 0) {
                return res.status(404).json({ message: "Categoria não encontrada." });
            }
            res.json(rows[0]);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    });

    // Listar todas as categorias incluindo inativas (admin)
    router.get("/all", authenticateToken, authorizeAdmin, async (req, res) => {
        try {
            const [rows] = await pool.query(
                "SELECT * FROM categorias ORDER BY ordem ASC, nome ASC"
            );
            res.json({
                status: 'success',
                categories: rows
            });
        } catch (error) {
            res.status(500).json({ 
                status: 'error',
                message: error.message 
            });
        }
    });

    // Criar nova categoria (admin)
    router.post("/", authenticateToken, authorizeAdmin, async (req, res) => {
        try {
            const { nome, slug, descricao, icone, categoria_pai_id, ordem } = req.body;
            
            // Validar campos obrigatórios
            if (!nome || !slug) {
                return res.status(400).json({ message: "Nome e slug são obrigatórios." });
            }

            // Verificar se o slug já existe
            const [existing] = await pool.query(
                "SELECT id FROM categorias WHERE slug = ?",
                [slug]
            );
            if (existing.length > 0) {
                return res.status(400).json({ message: "Slug já existe. Escolha outro." });
            }

            const [result] = await pool.query(
                "INSERT INTO categorias (nome, slug, descricao, icone, categoria_pai_id, ordem, ativo) VALUES (?, ?, ?, ?, ?, ?, 1)",
                [nome, slug, descricao || null, icone || null, categoria_pai_id || null, ordem || 0]
            );

            res.status(201).json({
                status: 'success',
                message: "Categoria criada com sucesso!",
                categoryId: result.insertId
            });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    });

    // Atualizar categoria (admin)
    router.put("/:id", authenticateToken, authorizeAdmin, async (req, res) => {
        try {
            const { id } = req.params;
            const { nome, slug, descricao, icone, categoria_pai_id, ordem, ativo } = req.body;

            // Verificar se a categoria existe
            const [existing] = await pool.query(
                "SELECT id FROM categorias WHERE id = ?",
                [id]
            );
            if (existing.length === 0) {
                return res.status(404).json({ message: "Categoria não encontrada." });
            }

            // Se o slug foi alterado, verificar se o novo slug já existe
            if (slug) {
                const [slugCheck] = await pool.query(
                    "SELECT id FROM categorias WHERE slug = ? AND id != ?",
                    [slug, id]
                );
                if (slugCheck.length > 0) {
                    return res.status(400).json({ message: "Slug já existe. Escolha outro." });
                }
            }

            const [result] = await pool.query(
                "UPDATE categorias SET nome = ?, slug = ?, descricao = ?, icone = ?, categoria_pai_id = ?, ordem = ?, ativo = ? WHERE id = ?",
                [nome, slug, descricao, icone, categoria_pai_id, ordem, ativo !== undefined ? ativo : 1, id]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ message: "Categoria não encontrada." });
            }

            res.json({ 
                status: 'success',
                message: "Categoria atualizada com sucesso!" 
            });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    });

    // Deletar categoria (soft delete - admin)
    router.delete("/:id", authenticateToken, authorizeAdmin, async (req, res) => {
        try {
            const { id } = req.params;

            // Verificar se há produtos usando esta categoria
            const [products] = await pool.query(
                "SELECT COUNT(*) as count FROM produto WHERE categoria_id = ? AND ativo = 1",
                [id]
            );

            if (products[0].count > 0) {
                return res.status(400).json({
                    message: `Não é possível deletar esta categoria. Existem ${products[0].count} produto(s) ativos usando-a.`
                });
            }

            const [result] = await pool.query(
                "UPDATE categorias SET ativo = 0 WHERE id = ?",
                [id]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ message: "Categoria não encontrada." });
            }

            res.json({ 
                status: 'success',
                message: "Categoria desativada com sucesso!" 
            });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    });

    return router;
};
