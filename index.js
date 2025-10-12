
require("dotenv").config();
const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
const port = process.env.PORT || 3000;

// Importar rotas
const authRoutes = require("./routes/auth");
const productRoutes = require("./routes/products");

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Conexão com o banco de dados (mantida aqui para rotas gerais, mas as rotas específicas usarão seus próprios pools)
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Rotas da API
app.get("/", (req, res) => {
    res.json({
        message: "API Backend Node.js está funcionando",
        version: "1.0.0"
    });
});

app.get("/api/test", async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT 1 as test, NOW() as now");
        res.json({ message: "Conexão com banco de dados estabelecida", result: rows[0] });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Usar as rotas modularizadas
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);

// Middleware para lidar com rotas não encontradas
app.use((req, res) => {
    res.status(404).json({ message: "Endpoint não encontrado" });
});

if (require.main === module) {
    app.listen(port, () => {
        console.log(`Servidor Node.js rodando em http://localhost:${port}`);
    });
}

module.exports = app;

