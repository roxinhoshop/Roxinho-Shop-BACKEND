const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

module.exports = (pool) => {
    router.post('/importar', async (req, res) => {
        try {
            const mockProductsPath = path.join(__dirname, '../../mock_products.json');
            const mockProductsData = fs.readFileSync(mockProductsPath, 'utf8');
            const products = JSON.parse(mockProductsData);

            console.log(`Simulando importação de ${products.length} produtos...`);

            // Simular inserção no banco de dados
            for (const product of products) {
                // Aqui você faria a query SQL real para inserir o produto
                // Exemplo: await pool.query('INSERT INTO produtos (nome, preco_amazon, preco_mercado_livre, descricao, imagem) VALUES (?, ?, ?, ?, ?)', [product.name, product.amazon_price, product.ml_price, product.description, product.image]);
                console.log(`Simulando inserção: ${product.name} (Amazon: ${product.amazon_price}, ML: ${product.ml_price})`);
            }

            res.status(200).json({ success: true, message: `Simulação de importação de ${products.length} produtos concluída.` });
        } catch (error) {
            console.error('Erro na simulação de importação:', error);
            res.status(500).json({ success: false, message: 'Erro na simulação de importação.', error: error.message });
        }
    });

    return router;
};

