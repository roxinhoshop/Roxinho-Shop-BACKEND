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
     */
    async function detectCategory(productName, mlCategoryId, pool) {
        try {
            const name = productName.toLowerCase();
            
            // Mapeamento de palavras-chave para categorias
            const categoryMap = {
                2: ["mouse", "teclado", "headset", "fone", "webcam", "microfone"],
                1: ["processador", "placa de vídeo", "memória ram", "ssd", "hd", "fonte"],
                3: ["notebook", "desktop", "pc", "computador", "all in one"],
                4: ["console", "playstation", "xbox", "nintendo", "controle", "joystick"],
                5: ["celular", "smartphone", "iphone", "galaxy", "xiaomi"],
                6: ["tv", "televisão", "smart tv", "soundbar", "home theater"],
                7: ["caixa de som", "alto-falante", "speaker", "jbl"],
                8: ["cadeira gamer", "mesa gamer", "suporte monitor"],
                9: ["alexa", "google home", "lâmpada inteligente", "tomada inteligente"],
                10: ["carregador", "bateria", "power bank", "fonte de alimentação"]
            };
            
            // Buscar categoria por palavra-chave
            for (const [catId, keywords] of Object.entries(categoryMap)) {
                for (const keyword of keywords) {
                    if (name.includes(keyword)) {
                        return parseInt(catId);
                    }
                }
            }
            
            // Categoria padrão: Periféricos
            return 2;
            
        } catch (error) {
            console.error("Erro ao detectar categoria:", error);
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
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
                }
            });
            const $ = cheerio.load(data);

            const productName = $("#productTitle").text().trim() || $("h1 span#title").text().trim() || $("meta[name=\"title\"]").attr("content");
            
            let price = 0.00;
            const priceWhole = $(".a-price-whole").first().text().trim();
            const priceFraction = $(".a-price-fraction").first().text().trim();
            const priceSymbol = $(".a-price-symbol").first().text().trim();

            if (priceWhole && priceFraction) {
                price = parseFloat(`${priceWhole}.${priceFraction}`.replace(/[^0-9.]/g, ""));
            } else {
                const priceText = $(".a-offscreen").first().text().trim();
                if (priceText) {
                    price = parseFloat(priceText.replace(/[^0-9,.]/g, "").replace(",", "."));
                }
            }

            const description = $("#productDescription p").first().text().trim() || $("#feature-bullets ul").text().trim() || $("meta[name=\"description\"]").attr("content");
            const imageUrl = $("#landingImage").attr("src") || $("#imgTagWrapperId img").attr("src") || $("meta[property=\"og:image\"]").attr("content");

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
            console.error("Erro ao extrair da Amazon:", error);
            throw error;
        }
    }

    /**
     * Extrai dados de um produto de forma genérica usando scraping
     */
    async function extractGeneric(url) {
        try {
            const { data } = await axios.get(url, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
                }
            });
            const $ = cheerio.load(data);

            // Tentativas de encontrar o nome do produto
            const productName = $("meta[property=\"og:title\"]").attr("content") ||
                                $("h1").first().text().trim() ||
                                $("title").text().trim().replace(/\s*\|\s*.*$/, ""); // Remove site name from title

            // Tentativas de encontrar o preço
            let price = 0.00;
            const priceText = $("meta[property=\"product:price:amount\"]").attr("content") ||
                              $("meta[itemprop=\"price\"]").attr("content") ||
                              $(".price").first().text().trim() ||
                              $(".product-price").first().text().trim() ||
                              $("[class*=\"price\"]").first().text().trim(); // More generic price selector
            if (priceText) {
                price = parseFloat(priceText.replace(/[^0-9,.]/g, "").replace(",", "."));
            }

            // Tentativas de encontrar a descrição
            const description = $("meta[property=\"og:description\"]").attr("content") ||
                                $("meta[name=\"description\"]").attr("content") ||
                                $(".description").first().text().trim() ||
                                $(".product-description").first().text().trim() ||
                                $("[class*=\"description\"]").first().text().trim(); // More generic description selector

            // Tentativas de encontrar a imagem
            const imageUrl = $("meta[property=\"og:image\"]").attr("content") ||
                             $("img.product-image").first().attr("src") ||
                             $("img.main-image").first().attr("src") ||
                             $("img[itemprop=\"image\"]").first().attr("src") ||
                             $("img[src*=\"product\"]").first().attr("src"); // More generic image selector

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
            console.error("Erro ao extrair genericamente:", error);
            throw error;
        }
    }
    
    return router;
};
