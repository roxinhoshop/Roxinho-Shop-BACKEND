/**
 * Enhanced Categories API
 * Suporta o novo sistema de categorias com subcategorias do frontend
 */

const express = require("express");
const router = express.Router();

module.exports = (pool) => {
    /**
     * GET /api/categories/structured
     * Retorna categorias em formato estruturado para o frontend
     */
    router.get("/structured", async (req, res) => {
        try {
            // Estrutura de categorias que corresponde ao frontend
            const categoriesStructure = {
                'Hardware': {
                    icone: 'fa-microchip',
                    ordem: 1,
                    subcategorias: [
                        'Processadores',
                        'Placas de Vídeo',
                        'Memória RAM',
                        'SSD',
                        'HD',
                        'Placa Mãe',
                        'Fontes',
                        'Coolers',
                        'Gabinetes'
                    ]
                },
                'Periféricos': {
                    icone: 'fa-keyboard',
                    ordem: 2,
                    subcategorias: [
                        'Mouses',
                        'Teclados',
                        'Headsets',
                        'Webcams',
                        'Microfones',
                        'Mousepads',
                        'Monitores'
                    ]
                },
                'Computadores': {
                    icone: 'fa-desktop',
                    ordem: 3,
                    subcategorias: [
                        'Notebooks',
                        'Desktops',
                        'PCs Gamer',
                        'All-in-One',
                        'Workstations',
                        'Mini PCs'
                    ]
                },
                'Games': {
                    icone: 'fa-gamepad',
                    ordem: 4,
                    subcategorias: [
                        'Consoles',
                        'Controles',
                        'Jogos',
                        'Headsets Gamer',
                        'Cadeiras Gamer',
                        'Mesas Gamer'
                    ]
                },
                'Promoções': {
                    icone: 'fa-tag',
                    ordem: 5,
                    subcategorias: []
                },
                'Mais Vendidos': {
                    icone: 'fa-fire',
                    ordem: 6,
                    subcategorias: []
                },
                'PC Gamer': {
                    icone: 'fa-desktop',
                    ordem: 7,
                    subcategorias: []
                },
                'Giftcards': {
                    icone: 'fa-gift',
                    ordem: 8,
                    subcategorias: []
                }
            };

            res.json({
                success: true,
                categories: categoriesStructure
            });
        } catch (error) {
            console.error("Erro ao buscar categorias estruturadas:", error);
            res.status(500).json({
                success: false,
                message: "Erro ao buscar categorias",
                error: error.message
            });
        }
    });

    /**
     * GET /api/categories/main
     * Retorna apenas as categorias principais para a barra de navegação
     */
    router.get("/main", async (req, res) => {
        try {
            const mainCategories = [
                { nome: 'Promoções', slug: 'promocoes', icone: 'fa-tag' },
                { nome: 'Mais Vendidos', slug: 'mais-vendidos', icone: 'fa-fire' },
                { nome: 'PC Gamer', slug: 'pc-gamer', icone: 'fa-desktop' },
                { nome: 'Hardware', slug: 'hardware', icone: 'fa-microchip' },
                { nome: 'Giftcards', slug: 'giftcards', icone: 'fa-gift' }
            ];

            res.json({
                success: true,
                categories: mainCategories
            });
        } catch (error) {
            console.error("Erro ao buscar categorias principais:", error);
            res.status(500).json({
                success: false,
                message: "Erro ao buscar categorias principais",
                error: error.message
            });
        }
    });

    /**
     * GET /api/categories/:categoryName/subcategories
     * Retorna subcategorias de uma categoria específica
     */
    router.get("/:categoryName/subcategories", async (req, res) => {
        try {
            const { categoryName } = req.params;
            
            const categoriesMap = {
                'Hardware': ['Processadores', 'Placas de Vídeo', 'Memória RAM', 'SSD', 'HD', 'Placa Mãe', 'Fontes', 'Coolers', 'Gabinetes'],
                'Periféricos': ['Mouses', 'Teclados', 'Headsets', 'Webcams', 'Microfones', 'Mousepads', 'Monitores'],
                'Computadores': ['Notebooks', 'Desktops', 'PCs Gamer', 'All-in-One', 'Workstations', 'Mini PCs'],
                'Games': ['Consoles', 'Controles', 'Jogos', 'Headsets Gamer', 'Cadeiras Gamer', 'Mesas Gamer']
            };

            const subcategories = categoriesMap[categoryName] || [];

            res.json({
                success: true,
                category: categoryName,
                subcategories: subcategories
            });
        } catch (error) {
            console.error("Erro ao buscar subcategorias:", error);
            res.status(500).json({
                success: false,
                message: "Erro ao buscar subcategorias",
                error: error.message
            });
        }
    });

    return router;
};

