import multer from 'multer';

const uploadOrderPhotos = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024,
        files: 30,
        fields: 8,
        fieldSize: 32 * 1024,
    },
}).any();

export default uploadOrderPhotos;
