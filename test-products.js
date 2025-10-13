const express = require('express');
require('dotenv').config();

const app = express();
const productRoutes = require('./routes/products');

app.use(express.json());
app.use('/api/products', productRoutes);

app.listen(3002, async () => {
    
    // Fazer uma requisição de teste
    setTimeout(async () => {
        try {
            const response = await fetch('http://localhost:3002/api/products');
            const data = await response.json();
        } catch (error) {
            console.error('Erro:', error.message);
        } finally {
            process.exit(0);
        }
    }, 1000);
});

