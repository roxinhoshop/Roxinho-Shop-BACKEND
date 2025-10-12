require("dotenv").config();
const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const nodemailer = require("nodemailer");

const JWT_SECRET = process.env.JWT_SECRET || "supersecretjwtkey";
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

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

const authorizeAdmin = (req, res, next) => {
    if (!req.user || req.user.isAdmin !== 1) {
        return res.status(403).json({ message: "Acesso negado. Requer privilégios de administrador." });
    }
    next();
};

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

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, "uploads");
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath);
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname);
    }
});
const upload = multer({ storage: storage });

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

app.get("/api/produtos", async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM produto WHERE ativo = 1");
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.post("/api/register", async (req, res) => {
    try {
        const { nome, email, senha } = req.body;
        const hashedPassword = await bcrypt.hash(senha, 10);
        await pool.query("INSERT INTO usuarios (nome, email, senha, is_admin, verificado) VALUES (?, ?, ?, 0, 1)", [nome, email, hashedPassword]);
        res.status(201).json({ message: "Usuário registrado com sucesso!" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.post("/api/login", async (req, res) => {
    try {
        const { email, senha } = req.body;
        const [users] = await pool.query("SELECT * FROM usuarios WHERE email = ?", [email]);
        const user = users[0];
        if (!user) return res.status(401).json({ message: "Credenciais inválidas." });

        const isPasswordValid = await bcrypt.compare(senha, user.senha);
        if (!isPasswordValid) return res.status(401).json({ message: "Credenciais inválidas." });
        const token = jwt.sign({ userId: user.id, email: user.email, isAdmin: user.is_admin }, JWT_SECRET, { expiresIn: "1h" });
        res.json({ token });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.get("/api/verify-email/:token", async (req, res) => {
    try {
        const { token } = req.params;
        const decoded = jwt.verify(token, JWT_SECRET);
        await pool.query("UPDATE usuarios SET verificado = 1, verification_token = NULL WHERE email = ?", [decoded.email]);
        res.send("E-mail verificado com sucesso!");
    } catch (error) {
        res.status(500).send("Link de verificação inválido ou expirado.");
    }
});

app.use((req, res) => {
    res.status(404).json({ message: "Endpoint não encontrado" });
});

if (require.main === module) {
    app.listen(port, () => {
        console.log(`Servidor Node.js rodando em http://localhost:${port}`);
    });
}

module.exports = app;
