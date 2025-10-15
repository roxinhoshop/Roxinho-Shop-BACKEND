/**
 * Enhanced Products API
 * Suporta filtros avançados, ordenação e paginação
 */

const express = require("express");
const router = express.Router();

module.exports = (pool) => {
    /**
     * GET /api/products-enhanced/filter
     * Retorna produtos com filtros, ordenação e paginação
     */
    router.get("/filter", async (req, res) => {
        try {
            const {
                categoria,
                subcategoria,
                marca,
                precoMin,
                precoMax,
                avaliacaoMin,
                emEstoque,
                desconto,

                ordenacao = 'relevancia',
                pagina = 1,
                itensPorPagina = 12,
                busca
            } = req.query;

            // Construir query base
            let query = "SELECT * FROM produto WHERE ativo = 1";
            const params = [];

            // Aplicar filtros
            if (categoria) {
                query += " AND categoria = ?";
                params.push(categoria);
            }

            if (subcategoria) {
                query += " AND subcategoria = ?";
                params.push(subcategoria);
            }

            if (marca) {
                query += " AND marca = ?";
                params.push(marca);
            }

            if (precoMin) {
                query += " AND preco >= ?";
                params.push(parseFloat(precoMin));
            }

            if (precoMax) {
                query += " AND preco <= ?";
                params.push(parseFloat(precoMax));
            }

            if (avaliacaoMin) {
                query += " AND avaliacao >= ?";
                params.push(parseFloat(avaliacaoMin));
            }

            if (emEstoque === 'true') {
                query += " AND estoque > 0";
            }

            if (desconto === 'true') {
                query += " AND desconto > 0";
            }



            if (busca) {
                query += " AND (nome LIKE ? OR descricao LIKE ? OR marca LIKE ?)";
                const buscaTerm = `%${busca}%`;
                params.push(buscaTerm, buscaTerm, buscaTerm);
            }

            // Aplicar ordenação
            switch (ordenacao) {
                case 'preco-asc':
                    query += " ORDER BY preco ASC";
                    break;
                case 'preco-desc':
                    query += " ORDER BY preco DESC";
                    break;
                case 'avaliacao':
                    query += " ORDER BY avaliacao DESC";
                    break;
                case 'desconto':
                    query += " ORDER BY desconto DESC";
                    break;
                case 'nome':
                    query += " ORDER BY nome ASC";
                    break;
                default:
                    query += " ORDER BY id DESC"; // relevancia
                    break;
            }

            // Executar query para contar total
            const [countRows] = await pool.query(query.replace("SELECT *", "SELECT COUNT(*) as total"), params);
            const total = countRows[0].total;

            // Aplicar paginação
            const offset = (parseInt(pagina) - 1) * parseInt(itensPorPagina);
            query += " LIMIT ? OFFSET ?";
            params.push(parseInt(itensPorPagina), offset);

            // Executar query final
            const [rows] = await pool.query(query, params);

            res.json({
                success: true,
                products: rows,
                pagination: {
                    total: total,
                    pagina: parseInt(pagina),
                    itensPorPagina: parseInt(itensPorPagina),
                    totalPaginas: Math.ceil(total / parseInt(itensPorPagina))
                }
            });

        } catch (error) {
            console.error("Erro ao filtrar produtos:", error);
            res.status(500).json({
                success: false,
                message: "Erro ao filtrar produtos",
                error: error.message
            });
        }
    });

    /**
     * GET /api/products-enhanced/marcas
     * Retorna lista de marcas únicas
     */
    router.get("/marcas", async (req, res) => {
        try {
            const [rows] = await pool.query(
                "SELECT DISTINCT marca FROM produto WHERE marca IS NOT NULL AND marca != '' AND ativo = 1 ORDER BY marca ASC"
            );

            const marcas = rows.map(row => row.marca);

            res.json({
                success: true,
                marcas: marcas
            });

        } catch (error) {
            console.error("Erro ao buscar marcas:", error);
            res.status(500).json({
                success: false,
                message: "Erro ao buscar marcas",
                error: error.message
            });
        }
    });

    /**
     * GET /api/products-enhanced/stats
     * Retorna estatísticas de produtos
     */
    router.get("/stats", async (req, res) => {
        try {
            const [totalRows] = await pool.query(
                "SELECT COUNT(*) as total FROM produto WHERE ativo = 1"
            );

            const [categoriaRows] = await pool.query(
                "SELECT categoria, COUNT(*) as total FROM produto WHERE ativo = 1 GROUP BY categoria"
            );

            const [precoRows] = await pool.query(
                "SELECT MIN(preco) as minimo, MAX(preco) as maximo, AVG(preco) as media FROM produto WHERE ativo = 1"
            );

            res.json({
                success: true,
                stats: {
                    total: totalRows[0].total,
                    porCategoria: categoriaRows,
                    preco: {
                        minimo: parseFloat(precoRows[0].minimo || 0),
                        maximo: parseFloat(precoRows[0].maximo || 0),
                        media: parseFloat(precoRows[0].media || 0)
                    }
                }
            });

        } catch (error) {
            console.error("Erro ao buscar estatísticas:", error);
            res.status(500).json({
                success: false,
                message: "Erro ao buscar estatísticas",
                error: error.message
            });
        }
    });

    /**
     * GET /api/products-enhanced/relacionados/:id
     * Retorna produtos relacionados
     */
    router.get("/relacionados/:id", async (req, res) => {
        try {
            const { id } = req.params;
            const limite = req.query.limite || 4;

            // Buscar produto atual
            const [produtoAtual] = await pool.query(
                "SELECT categoria, subcategoria FROM produto WHERE id = ? AND ativo = 1",
                [id]
            );

            if (produtoAtual.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Produto não encontrado"
                });
            }

            const { categoria, subcategoria } = produtoAtual[0];

            // Buscar produtos relacionados
            let query = "SELECT * FROM produto WHERE ativo = 1 AND id != ?";
            const params = [id];

            if (subcategoria) {
                query += " AND subcategoria = ?";
                params.push(subcategoria);
            } else if (categoria) {
                query += " AND categoria = ?";
                params.push(categoria);
            }

            query += " ORDER BY RAND() LIMIT ?";
            params.push(parseInt(limite));

            const [rows] = await pool.query(query, params);

            res.json({
                success: true,
                products: rows
            });

        } catch (error) {
            console.error("Erro ao buscar produtos relacionados:", error);
            res.status(500).json({
                success: false,
                message: "Erro ao buscar produtos relacionados",
                error: error.message
            });
        }
    });

    /**
     * GET /api/products-enhanced/destaques
     * Retorna produtos em destaque
     */
    router.get("/destaques", async (req, res) => {
        try {
            const limite = req.query.limite || 8;

            const [rows] = await pool.query(
                "SELECT * FROM produto WHERE ativo = 1 AND destaque = 1 ORDER BY RAND() LIMIT ?",
                [parseInt(limite)]
            );

            res.json({
                success: true,
                products: rows
            });

        } catch (error) {
            console.error("Erro ao buscar produtos em destaque:", error);
            res.status(500).json({
                success: false,
                message: "Erro ao buscar produtos em destaque",
                error: error.message
            });
        }
    });

    /**
     * GET /api/products-enhanced/promocoes
     * Retorna produtos em promoção
     */
    router.get("/promocoes", async (req, res) => {
        try {
            const limite = req.query.limite || 12;

            const [rows] = await pool.query(
                "SELECT * FROM produto WHERE ativo = 1 AND desconto > 0 ORDER BY desconto DESC LIMIT ?",
                [parseInt(limite)]
            );

            res.json({
                success: true,
                products: rows
            });

        } catch (error) {
            console.error("Erro ao buscar promoções:", error);
            res.status(500).json({
                success: false,
                message: "Erro ao buscar promoções",
                error: error.message
            });
        }
    });

    return router;
};

