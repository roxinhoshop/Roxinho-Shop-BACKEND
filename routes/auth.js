
const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const mysql = require("mysql2/promise");
const nodemailer = require("nodemailer");

const JWT_SECRET = process.env.JWT_SECRET || "supersecretjwtkey";

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

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// Rota de registro
router.post("/register", async (req, res) => {
    try {
        const { nome, sobrenome, email, telefone, data_nascimento, senha } = req.body;
        
        // Verificar se o email já existe
        const [existingUsers] = await pool.query("SELECT * FROM usuarios WHERE email = ?", [email]);
        if (existingUsers.length > 0) {
            return res.status(400).json({ message: "Este e-mail já está cadastrado." });
        }
        
        const hashedPassword = await bcrypt.hash(senha, 10);
        const nomeCompleto = `${nome} ${sobrenome}`;
        
        await pool.query(
            "INSERT INTO usuarios (nome, email, telefone, data_nascimento, senha, is_admin, verificado) VALUES (?, ?, ?, ?, ?, 0, 1)", 
            [nomeCompleto, email, telefone, data_nascimento, hashedPassword]
        );
        
        res.status(201).json({ message: "Usuário registrado com sucesso!" });
    } catch (error) {
        console.error("Erro ao registrar usuário:", error);
        res.status(500).json({ message: error.message });
    }
});

// Rota de login
router.post("/login", async (req, res) => {
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

// Rota de verificação de e-mail (temporariamente desativada, mas mantida)
router.get("/verify-email/:token", async (req, res) => {
    try {
        const { token } = req.params;
        const decoded = jwt.verify(token, JWT_SECRET);
        await pool.query("UPDATE usuarios SET verificado = 1, verification_token = NULL WHERE email = ?", [decoded.email]);
        res.send("E-mail verificado com sucesso!");
    } catch (error) {
        res.status(500).send("Link de verificação inválido ou expirado.");
    }
});

module.exports = router;

