const multer = require('multer');
const path = require('path');

// Configuração do multer com limite de 50MB
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// Filtro para tipos de arquivo permitidos
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Apenas imagens são permitidas (JPEG, JPG, PNG, GIF, WEBP)'));
    }
};

// Configuração do multer com limite de 50MB (52428800 bytes)
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 52428800, // 50MB em bytes
        files: 10 // Máximo 10 arquivos por upload
    },
    fileFilter: fileFilter
});

// Middleware de tratamento de erros de upload
const handleUploadError = (error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                error: 'Arquivo muito grande. O limite é de 50MB por arquivo.',
                code: 'FILE_TOO_LARGE'
            });
        }
        if (error.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
                success: false,
                error: 'Muitos arquivos. O limite é de 10 arquivos por upload.',
                code: 'TOO_MANY_FILES'
            });
        }
        if (error.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({
                success: false,
                error: 'Campo de arquivo inesperado.',
                code: 'UNEXPECTED_FIELD'
            });
        }
    }
    
    if (error.message.includes('Apenas imagens são permitidas')) {
        return res.status(400).json({
            success: false,
            error: error.message,
            code: 'INVALID_FILE_TYPE'
        });
    }

    return res.status(500).json({
        success: false,
        error: 'Erro interno no upload do arquivo.',
        code: 'UPLOAD_ERROR'
    });
};

module.exports = {
    upload,
    handleUploadError
};