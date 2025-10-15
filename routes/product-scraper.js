/**
 * Product Scraper - Extração de dados de produtos via URL
 * Suporta Mercado Livre, Amazon e um scraper genérico
 */

const express = require("express");
const router = express.Router();
const axios = require("axios");
const cheerio = require("cheerio");

module.exports = (pool) => {
    /**
     * POST /api/products/extract-from-url
     * Extrai dados de um produto a partir de uma URL do Mercado Livre, Amazon ou genericamente
     */
    router.post("/extract-from-url", async (req, res) => {
        try {
            const { url } = req.body;
            
            if (!url) {
                return res.status(400).json({
                    success: false,
                    message: "URL é obrigatória"
                });
            }
            
            let productData;
            let platform = "generico";

            if (url.includes("mercadolivre.com.br") || url.includes("mercadolibre.com")) {
                platform = "mercadolivre";
                productData = await extractFromMercadoLivre(url);
            } else if (url.includes("amazon.com.br") || url.includes("amazon.com")) {
                platform = "amazon";
                console.log("Iniciando extração da Amazon...");
                productData = await extractFromAmazon(url);
            } else {
                // Tentar scraper genérico para outras URLs
                productData = await extractGeneric(url);
            }
            
            if (!productData || !productData.nome) {
                return res.status(500).json({
                    success: false,
                    message: "Não foi possível extrair dados do produto ou nome do produto não encontrado."
                });
            }
            
            res.json({
                success: true,
                product: productData,
                platform: platform
            });
            
        } catch (error) {
            console.error("Erro ao extrair dados do produto:", error);
            res.status(500).json({
                success: false,
                message: "Erro ao processar a URL",
                error: error.message
            });
        }
    });
    
    /**
     * Detecta categoria automaticamente baseada no nome do produto
     * Sistema aprimorado com mais palavras-chave e lógica de prioridade
     */
    async function detectCategory(productName, mlCategoryId, pool) {
        try {
            const name = productName.toLowerCase();
            
            // Mapeamento de palavras-chave para categorias (ID: slug)
            // 1: hardware, 2: perifericos, 3: computadores, 4: games
            // 5: celular-smartphone, 6: tv-audio, 7: audio, 8: espaco-gamer
            // 9: casa-inteligente, 10: energia
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
            
            // Buscar categoria por palavra-chave (ordem de prioridade)
            for (const [catId, keywords] of Object.entries(categoryMap)) {
                for (const keyword of keywords) {
                    if (name.includes(keyword)) {
                        console.log(`✅ Categoria detectada: ${catId} (palavra-chave: ${keyword})`);
                        return parseInt(catId);
                    }
                }
            }
            
            console.log(`⚠️ Categoria não detectada, usando padrão: 2 (Periféricos)`);
            // Categoria padrão: Periféricos
            return 2;
            
        } catch (error) {
            console.error("❌ Erro ao detectar categoria:", error);
            return 2; // Categoria padrão
        }
    }
    
    /**
     * Extrai dados de um produto do Mercado Livre
     */
    async function extractFromMercadoLivre(url) {
        try {
            const mlbMatch = url.match(/MLB-?(\d+)/i);
            if (!mlbMatch) {
                throw new Error("ID do produto não encontrado na URL");
            }
            
            const productId = mlbMatch[0].replace("-", "");
            const apiUrl = `https://api.mercadolibre.com/items/${productId}`;
            
            const response = await axios.get(apiUrl);
            const data = response.data;
            
            const categoria_id = await detectCategory(data.title, data.category_id, pool);
            
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
                link_mercado_livre: url,
                preco_mercado_livre: data.price,
                ativo: 1
            };
            
        } catch (error) {
            console.error("Erro ao extrair do Mercado Livre:", error);
            throw error;
        }
    }
    
    /**
     * Extrai dados de um produto da Amazon usando scraping básico
     */
    async function extractFromAmazon(url) {
        try {
            const { data } = await axios.get(url, {
                timeout: 10000, // Adicionar um timeout para evitar requisições penduradas

                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
                }
            });
            const $ = cheerio.load(data);

            const productName = $("#productTitle").text().trim() || $("h1 span#title").text().trim() || $("meta[name=\"title\"]").attr("content") || $("meta[property=\"og:title\"]").attr("content");
            
            let price = 0.00;
            const priceSelectors = [
                "span.a-price span.a-offscreen",
                "#priceblock_ourprice",
                "#priceblock_dealprice",
                "#kindle-price",
                ".a-color-price"
            ];

            for (const selector of priceSelectors) {
                const priceText = $(selector).text().trim();
                if (priceText) {
                    price = parseFloat(priceText.replace(/[^0-9,.]/g, "").replace(",", "."));
                    if (!isNaN(price) && price > 0) break;
                }
            }

            const description = $("#productDescription p").first().text().trim() || $("#feature-bullets ul").text().trim() || $("meta[name=\"description\"]").attr("content") || $("meta[property=\"og:description\"]").attr("content");
            const imageUrl = $("#landingImage").attr("src") || $("#imgTagWrapperId img").attr("src") || $("meta[property=\"og:image\"]").attr("content") || $("meta[name=\"twitter:image\"]").attr("content");

            const categoria_id = await detectCategory(productName, null, pool);

            return {
                nome: productName || "Nome do Produto Amazon Desconhecido",
                preco: price || 0.00,
                descricao: description || "Descrição não disponível.",
                imagem: imageUrl || "https://via.placeholder.com/400?text=Amazon+Product",
                galeria_imagens: JSON.stringify(imageUrl ? [imageUrl] : []),
                marca: null,
                modelo: null,
                estoque: 0,
                categoria_id: categoria_id,
                link_amazon: url,
                preco_amazon: price || 0.00,
                ativo: 1
            };

        } catch (error) {
            console.error("Erro ao extrair da Amazon:", error.message, error.response?.status, error.response?.data);
            throw error;
        }
    }

    /**
     * Extrai dados de um produto de forma genérica usando scraping
     */
    async function extractGeneric(url) {
        try {
            const { data } = await axios.get(url, {
                timeout: 10000, // Adicionar um timeout para evitar requisições penduradas

                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
                }
            });
            const $ = cheerio.load(data);

            let productName = "";
            const nameSelectors = [
                "meta[property=\"og:title\"]",
                "meta[name=\"twitter:title\"]",
                "h1.product-title",
                "h1.item-title",
                "h1[itemprop=\"name\"]",
                "h1",
                "title"
            ];
            for (const selector of nameSelectors) {
                const el = $(selector);
                if (el.length) {
                    productName = el.attr("content") || el.text();
                    if (productName) {
                        productName = productName.trim().replace(/\s*\|\s*.*$/, "").replace(/\s*-\s*.*$/, ""); // Remove site name from title
                        break;
                    }
                }
            }

            let price = 0.00;
            const priceSelectors = [
                "meta[property=\"product:price:amount\"]",
                "meta[itemprop=\"price\"]",
                "meta[name=\"twitter:data1\"]", // Often contains price for Twitter cards
                ".price",
                ".product-price",
                "span[itemprop=\"price\"]",
                "div.price-display",
                "span.sales-price",
                "span.value",
                "b.price-tag",
                "strong.price-value"
            ];
            for (const selector of priceSelectors) {
                const el = $(selector);
                if (el.length) {
                    let priceText = el.attr("content") || el.text();
                    if (priceText) {
                        price = parseFloat(priceText.replace(/[^0-9,.]/g, "").replace(",", "."));
                        if (!isNaN(price) && price > 0) break;
                    }
                }
            }

            let description = "";
            const descriptionSelectors = [
                "meta[property=\"og:description\"]",
                "meta[name=\"description\"]",
                "meta[name=\"twitter:description\"]",
                ".description",
                ".product-description",
                "div[itemprop=\"description\"]",
                "#product-description",
                ".description-content",
                ".item-description"
            ];
            for (const selector of descriptionSelectors) {
                const el = $(selector);
                if (el.length) {
                    description = el.attr("content") || el.text();
                    if (description) {
                        description = description.trim();
                        break;
                    }
                }
            }

            let imageUrl = "";
            const imageSelectors = [
                "meta[property=\"og:image\"]",
                "meta[name=\"twitter:image\"]",
                "img.product-image",
                "img.main-image",
                "img[itemprop=\"image\"]",
                "img[src*=\"product\"]",
                "#product-image",
                ".product-gallery-image",
                ".item-image"
            ];
            for (const selector of imageSelectors) {
                const el = $(selector);
                if (el.length) {
                    imageUrl = el.attr("src");
                    if (imageUrl) break;
                }
            }

            const categoria_id = await detectCategory(productName || "", null, pool);

            return {
                nome: productName || "Nome do Produto Desconhecido",
                preco: price || 0.00,
                descricao: description || "Descrição não disponível.",
                imagem: imageUrl || "https://via.placeholder.com/400?text=Product",
                galeria_imagens: JSON.stringify(imageUrl ? [imageUrl] : []),
                marca: null,
                modelo: null,
                estoque: 0,
                categoria_id: categoria_id,
                link_original: url,
                preco_original: price || 0.00,
                ativo: 1
            };

        } catch (error) {
            console.error("Erro ao extrair genericamente:", error.message, error.response?.status, error.response?.data);
            throw error;
        }
    }
    
    return router;
};
