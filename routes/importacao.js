const express = require('express');
const router = express.Router();

// Placeholder para rota de importação
router.post('/importar', (req, res) => {
  res.status(501).json({ sucesso: false, mensagem: 'Funcionalidade de importação ainda não implementada.' });
});

module.exports = router;
