const express = require("express");
const router = express.Router();
const axios = require("axios");

module.exports = (pool) => {
    // Função para buscar categorias do banco de dados
    async function getCategoriesFromDB() {
        const connection = await pool.getConnection();
        try {
            const [rows] = await connection.query("SELECT id, name, slug FROM Categories");
            return rows;
        } finally {
            connection.release();
        }
    }

    // Função para detectar a categoria com base no nome do produto
    async function detectCategory(productName) {
        const name = productName.toLowerCase();
        const categories = await getCategoriesFromDB();
        
        // Mapeamento de palavras-chave para categorias (ID: slug)
        const categoryMap = {
            1: ["processador", "cpu", "ryzen", "intel core", "placa de vídeo", "gpu", "rtx", "gtx", "radeon", 
                "memória ram", "ddr4", "ddr5", "ssd", "nvme", "hd", "hard disk", "fonte", "psu", 
                "placa mãe", "motherboard", "cooler", "water cooler", "gabinete", "case"],
            2: ["mouse", "teclado", "keyboard", "headset", "fone", "headphone", "webcam", "câmera", 
                "microfone", "mic", "mousepad", "monitor", "display", "controle", "gamepad"],
            3: ["notebook", "laptop", "desktop", "pc gamer", "computador", "all in one", "workstation", 
                "mini pc", "chromebook", "ultrabook", "tablet"],
            4: ["console", "playstation", "ps5", "ps4", "xbox", "nintendo", "switch", "jogo", "game", 
                "volante", "racing wheel", "cadeira gamer", "mesa gamer"],
            5: ["celular", "smartphone", "iphone", "galaxy", "xiaomi", "redmi", "motorola", "samsung", 
                "capa celular", "película", "carregador celular", "fone bluetooth", "smartwatch", "relógio inteligente"],
            6: ["tv", "televisão", "smart tv", "4k tv", "8k tv", "suporte tv", "conversor", "antena", 
                "soundbar", "home theater", "receiver"],
            7: ["caixa de som", "alto-falante", "speaker", "jbl", "amplificador", "interface de áudio", 
                "monitor de referência", "subwoofer"],
            8: ["cadeira gamer", "mesa gamer", "suporte monitor", "braço articulado", "iluminação rgb", 
                "led strip", "decoração gamer", "organizador", "tapete"],
            9: ["alexa", "google home", "assistente virtual", "lâmpada inteligente", "smart light", 
                "tomada inteligente", "câmera segurança", "fechadura inteligente", "sensor"],
            10: ["nobreak", "ups", "estabilizador", "filtro de linha", "power bank", "bateria externa", 
                 "carregador portátil", "painel solar"]
        };

        for (const category of categories) {
            const keywords = categoryMap[category.id] || [];
            for (const keyword of keywords) {
                if (name.includes(keyword)) {
                    return category.id;
                }
            }
        }
        return 2; // Categoria padrão: Periféricos
    }

    // Função para extrair dados de um produto do Mercado Livre via API
    async function extractFromMercadoLivreAPI(url) {
        const mlbMatch = url.match(/MLB-?(\d+)/i);
        if (!mlbMatch) {
            throw new Error("ID do produto não encontrado na URL do Mercado Livre.");
        }
        const productId = mlbMatch[0].replace("-", "");
        const apiUrl = `https://api.mercadolibre.com/items/${productId}`;

        const response = await axios.get(apiUrl);
        const data = response.data;

        const categoria_id = await detectCategory(data.title);

        return {
            nome: data.title,
            preco: data.price,
            descricao: data.plain_text || data.subtitle || "",
            imagem: data.thumbnail || data.pictures?.[0]?.url || data.secure_thumbnail,
            galeria_imagens: JSON.stringify(data.pictures?.map(p => p.url) || []),
            marca: data.attributes?.find(a => a.id === "BRAND")?.value_name || null,
            modelo: data.attributes?.find(a => a.id === "MODEL")?.value_name || null,
            estoque: data.available_quantity || 0,
            categoria_id: categoria_id,
            link_original: url,
            ativo: 1
        };
    }

    // Rota para extrair dados do produto a partir de uma URL
    router.post("/extract-product", async (req, res) => {
        try {
            const { url } = req.body;
            if (!url) {
                return res.status(400).json({ success: false, message: "URL é obrigatória." });
            }

            let productData;
            if (url.includes("mercadolivre.com.br") || url.includes("mercadolibre.com")) {
                productData = await extractFromMercadoLivreAPI(url);
            } else {
                // Para outras plataformas, podemos implementar APIs de terceiros ou um formulário manual no frontend
                return res.status(400).json({ success: false, message: "Plataforma não suportada via API no momento. Por favor, insira os dados manualmente." });
            }

            res.json({ success: true, product: productData });

        } catch (error) {
            console.error("Erro ao extrair dados do produto:", error);
            res.status(500).json({ success: false, message: "Erro ao processar a URL", error: error.message });
        }
    });

    return router;
};
