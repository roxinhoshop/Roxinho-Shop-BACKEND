
require("dotenv").config();
const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
const port = process.env.PORT || 3000;


app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Middleware de log para depuração
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
});

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
        status: "success",
        message: "API Backend Roxinho Shop está funcionando",
        version: "2.0.0",
        endpoints: {
            test: "GET /api/test",
            auth: {
                register: "POST /api/auth/register",
                login: "POST /api/auth/login",
                verifyEmail: "GET /api/auth/verify-email/:token"
            },
            products: {
                list: "GET /api/products",
                getById: "GET /api/products/:id",
                create: "POST /api/products (admin)",
                update: "PUT /api/products/:id (admin)",
                delete: "DELETE /api/products/:id (admin)"
            },
            categories: {
                list: "GET /api/categories",
                listAll: "GET /api/categories/all (admin)",
                getById: "GET /api/categories/:id",
                create: "POST /api/categories (admin)",
                update: "PUT /api/categories/:id (admin)",
                delete: "DELETE /api/categories/:id (admin)"
            }
        }
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

// Importar e usar as rotas modularizadas
const authRoutes = require("./routes/auth")(pool);
const productRoutes = require("./routes/products")(pool);
const categoryRoutes = require("./routes/categories")(pool);
const productImagesRoutes = require("./routes/product-images")(pool);
const reviewsRoutes = require("./routes/reviews")(pool);
const productScraperRoutes = require("./routes/product-scraper")(pool);
const historicoRoutes = require("./routes/historico")(pool);

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/produtos", productRoutes); // Alias em português
app.use("/api/categories", categoryRoutes);
app.use("/api/categorias", categoryRoutes); // Alias em português
app.use("/api/product-images", productImagesRoutes);
app.use("/api/reviews", reviewsRoutes);
app.use("/api/avaliacoes", reviewsRoutes); // Alias em português
app.use("/api/products", productScraperRoutes);
app.use("/api/historico", historicoRoutes);

// Middleware para lidar com rotas não encontradas
app.use((req, res) => {
    res.status(404).json({ 
        status: "error",
        message: "Endpoint não encontrado",
        path: req.path,
        method: req.method
    });
});

if (require.main === module) {
    app.listen(port, () => {
        console.log(`Servidor Node.js rodando em http://localhost:${port}`);
    });
}

module.exports = app;

