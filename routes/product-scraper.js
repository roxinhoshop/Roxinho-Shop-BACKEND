/**
 * Product Scraper - Extração de dados de produtos via URL
 * Suporta Mercado Livre e Amazon
 */

const express = require('express');
const router = express.Router();

module.exports = (pool) => {
    /**
     * POST /api/products/extract-from-url
     * Extrai dados de um produto a partir de uma URL do Mercado Livre ou Amazon
     */
    router.post('/extract-from-url', async (req, res) => {
        try {
            const { url } = req.body;
            
            if (!url) {
                return res.status(400).json({
                    success: false,
                    message: 'URL é obrigatória'
                });
            }
            
            // Detectar plataforma
            let platform = null;
            if (url.includes('mercadolivre.com.br') || url.includes('mercadolibre.com')) {
                platform = 'mercadolivre';
            } else if (url.includes('amazon.com.br') || url.includes('amazon.com')) {
                platform = 'amazon';
            } else {
                return res.status(400).json({
                    success: false,
                    message: 'URL não suportada. Use links do Mercado Livre ou Amazon.'
                });
            }
            
            // Extrair dados baseado na plataforma
            let productData;
            if (platform === 'mercadolivre') {
                productData = await extractFromMercadoLivre(url);
            } else if (platform === 'amazon') {
                productData = await extractFromAmazon(url);
            }
            
            if (!productData) {
                return res.status(500).json({
                    success: false,
                    message: 'Não foi possível extrair dados do produto'
                });
            }
            
            res.json({
                success: true,
                product: productData,
                platform: platform
            });
            
        } catch (error) {
            console.error('Erro ao extrair dados do produto:', error);
            res.status(500).json({
                success: false,
                message: 'Erro ao processar a URL',
                error: error.message
            });
        }
    });
    
    /**
     * Extrai dados de um produto do Mercado Livre
     */
    async function extractFromMercadoLivre(url) {
        try {
            // Extrair ID do produto da URL
            const mlbMatch = url.match(/MLB-?(\d+)/i);
            if (!mlbMatch) {
                throw new Error('ID do produto não encontrado na URL');
            }
            
            const productId = mlbMatch[0].replace('-', '');
            const apiUrl = `https://api.mercadolibre.com/items/${productId}`;
            
            // Fazer requisição à API do Mercado Livre
            const response = await fetch(apiUrl);
            if (!response.ok) {
                throw new Error('Produto não encontrado no Mercado Livre');
            }
            
            const data = await response.json();
            
            // Extrair dados relevantes
            return {
                nome: data.title,
                preco: data.price,
                descricao: data.plain_text || data.subtitle || '',
                imagem: data.thumbnail || data.pictures?.[0]?.url || data.secure_thumbnail,
                galeria_imagens: JSON.stringify(data.pictures?.map(p => p.url) || []),
                marca: data.attributes?.find(a => a.id === 'BRAND')?.value_name || null,
                modelo: data.attributes?.find(a => a.id === 'MODEL')?.value_name || null,
                estoque: data.available_quantity || 0,
                link_mercado_livre: url,
                preco_mercado_livre: data.price,
                ativo: 1
            };
            
        } catch (error) {
            console.error('Erro ao extrair do Mercado Livre:', error);
            throw error;
        }
    }
    
    /**
     * Extrai dados de um produto da Amazon
     */
    async function extractFromAmazon(url) {
        try {
            // Extrair ASIN da URL
            const asinMatch = url.match(/\/dp\/([A-Z0-9]{10})/i) || url.match(/\/gp\/product\/([A-Z0-9]{10})/i);
            if (!asinMatch) {
                throw new Error('ASIN do produto não encontrado na URL');
            }
            
            const asin = asinMatch[1];
            
            // NOTA: A Amazon não possui uma API pública gratuita para extração de dados
            // Esta é uma implementação simplificada que retorna dados mockados
            // Para produção, seria necessário usar um serviço de scraping ou API paga
            
            return {
                nome: `Produto Amazon ${asin}`,
                preco: 0.00,
                descricao: 'Descrição do produto da Amazon. Para obter dados reais, é necessário integrar com um serviço de scraping ou API paga.',
                imagem: 'https://via.placeholder.com/400?text=Amazon+Product',
                galeria_imagens: JSON.stringify([]),
                marca: null,
                modelo: null,
                estoque: 0,
                link_amazon: url,
                preco_amazon: 0.00,
                ativo: 1
            };
            
        } catch (error) {
            console.error('Erro ao extrair da Amazon:', error);
            throw error;
        }
    }
    
    return router;
};

