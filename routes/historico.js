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
            
            const [historico] = await pool.query(`
                SELECT 
                    h.id,
                    h.produto_id,
                    h.data_visualizacao,
                    p.nome as produto_nome,
                    p.preco,
                    p.imagem_principal as imagem_url
                FROM historico_visualizacoes h
                INNER JOIN produtos p ON h.produto_id = p.id
                WHERE h.usuario_id = ?
                ORDER BY h.data_visualizacao DESC
                LIMIT 50
            `, [userId]);
            
            res.json({
                success: true,
                historico: historico
            });
            
        } catch (error) {
            console.error('Erro ao buscar histórico:', error);
            res.status(500).json({
                success: false,
                error: 'Erro ao buscar histórico de produtos'
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
            } else {
                // Inserir nova visualização
                await pool.query(`
                    INSERT INTO historico_visualizacoes (usuario_id, produto_id, data_visualizacao)
                    VALUES (?, ?, NOW())
                `, [userId, productId]);
            }
            
            res.json({
                success: true,
                message: 'Produto adicionado ao histórico'
            });
            
        } catch (error) {
            console.error('Erro ao adicionar ao histórico:', error);
            res.status(500).json({
                success: false,
                error: 'Erro ao adicionar produto ao histórico'
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
            
            await pool.query(`
                DELETE FROM historico_visualizacoes
                WHERE usuario_id = ?
            `, [userId]);
            
            res.json({
                success: true,
                message: 'Histórico limpo com sucesso'
            });
            
        } catch (error) {
            console.error('Erro ao limpar histórico:', error);
            res.status(500).json({
                success: false,
                error: 'Erro ao limpar histórico'
            });
        }
    });
    
    return router;
};

