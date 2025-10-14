/**
 * Histórico de Produtos Visualizados
 * Gerencia o histórico de produtos visualizados pelos usuários
 */

const express = require('express');
const router = express.Router();

module.exports = (pool) => {
    /**
     * GET /api/historico/:userId
     * Retorna o histórico de produtos visualizados por um usuário
     */
    router.get('/:userId', async (req, res) => {
        try {
            const { userId } = req.params;
            const { limit = 50 } = req.query;
            
            if (!userId || isNaN(userId)) {
                return res.status(400).json({
                    success: false,
                    error: 'ID do usuário inválido'
                });
            }
            
            const [historico] = await pool.query(`
                SELECT 
                    h.id,
                    h.produto_id,
                    h.data_visualizacao,
                    p.nome as produto_nome,
                    p.preco,
                    p.preco_promocional,
                    p.imagem_principal as imagem_url,
                    p.slug,
                    p.ativo
                FROM historico_visualizacoes h
                INNER JOIN produtos p ON h.produto_id = p.id
                WHERE h.usuario_id = ? AND p.ativo = 1
                ORDER BY h.data_visualizacao DESC
                LIMIT ?
            `, [userId, parseInt(limit)]);
            
            res.json({
                success: true,
                count: historico.length,
                historico: historico
            });
            
        } catch (error) {
            console.error('Erro ao buscar histórico:', error);
            res.status(500).json({
                success: false,
                error: 'Erro interno do servidor ao buscar histórico de produtos'
            });
        }
    });
    
    /**
     * POST /api/historico
     * Adiciona um produto ao histórico de visualizações
     */
    router.post('/', async (req, res) => {
        try {
            const { userId, productId } = req.body;
            
            if (!userId || !productId) {
                return res.status(400).json({
                    success: false,
                    error: 'userId e productId são obrigatórios'
                });
            }
            
            if (isNaN(userId) || isNaN(productId)) {
                return res.status(400).json({
                    success: false,
                    error: 'userId e productId devem ser números válidos'
                });
            }
            
            // Verificar se o produto existe e está ativo
            const [produto] = await pool.query(
                'SELECT id FROM produtos WHERE id = ? AND ativo = 1',
                [productId]
            );
            
            if (produto.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Produto não encontrado ou inativo'
                });
            }
            
            // Verificar se já existe uma visualização recente (últimas 24 horas)
            const [existing] = await pool.query(`
                SELECT id FROM historico_visualizacoes
                WHERE usuario_id = ? AND produto_id = ?
                AND data_visualizacao > DATE_SUB(NOW(), INTERVAL 24 HOUR)
            `, [userId, productId]);
            
            if (existing.length > 0) {
                // Atualizar data de visualização
                await pool.query(`
                    UPDATE historico_visualizacoes
                    SET data_visualizacao = NOW()
                    WHERE id = ?
                `, [existing[0].id]);
                
                res.json({
                    success: true,
                    message: 'Visualização atualizada no histórico',
                    action: 'updated'
                });
            } else {
                // Inserir nova visualização
                const [result] = await pool.query(`
                    INSERT INTO historico_visualizacoes (usuario_id, produto_id, data_visualizacao)
                    VALUES (?, ?, NOW())
                `, [userId, productId]);
                
                res.json({
                    success: true,
                    message: 'Produto adicionado ao histórico',
                    action: 'created',
                    id: result.insertId
                });
            }
            
        } catch (error) {
            console.error('Erro ao adicionar ao histórico:', error);
            res.status(500).json({
                success: false,
                error: 'Erro interno do servidor ao adicionar produto ao histórico'
            });
        }
    });
    
    /**
     * DELETE /api/historico/:userId
     * Limpa todo o histórico de visualizações de um usuário
     */
    router.delete('/:userId', async (req, res) => {
        try {
            const { userId } = req.params;
            
            if (!userId || isNaN(userId)) {
                return res.status(400).json({
                    success: false,
                    error: 'ID do usuário inválido'
                });
            }
            
            const [result] = await pool.query(`
                DELETE FROM historico_visualizacoes
                WHERE usuario_id = ?
            `, [userId]);
            
            res.json({
                success: true,
                message: 'Histórico limpo com sucesso',
                deletedCount: result.affectedRows
            });
            
        } catch (error) {
            console.error('Erro ao limpar histórico:', error);
            res.status(500).json({
                success: false,
                error: 'Erro interno do servidor ao limpar histórico'
            });
        }
    });
    
    /**
     * DELETE /api/historico/:userId/:productId
     * Remove um produto específico do histórico
     */
    router.delete('/:userId/:productId', async (req, res) => {
        try {
            const { userId, productId } = req.params;
            
            if (!userId || !productId || isNaN(userId) || isNaN(productId)) {
                return res.status(400).json({
                    success: false,
                    error: 'IDs do usuário e produto devem ser números válidos'
                });
            }
            
            const [result] = await pool.query(`
                DELETE FROM historico_visualizacoes
                WHERE usuario_id = ? AND produto_id = ?
            `, [userId, productId]);
            
            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Produto não encontrado no histórico do usuário'
                });
            }
            
            res.json({
                success: true,
                message: 'Produto removido do histórico com sucesso'
            });
            
        } catch (error) {
            console.error('Erro ao remover produto do histórico:', error);
            res.status(500).json({
                success: false,
                error: 'Erro interno do servidor ao remover produto do histórico'
            });
        }
    });
    
    return router;
};