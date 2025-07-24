import { Router } from "express";
import multer from "multer";
import { documentController } from "../controllers/documentController";
import { authenticateToken } from "../middleware/auth";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/markdown',
      'application/rtf',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not supported`));
    }
  }
});

const createDocumentRoutes = () => {
  const router = Router();

  router.use(authenticateToken);

  router.post('/upload', upload.single('file'), documentController.uploadDocument);
  router.get('/', documentController.getDocuments);
  router.get('/:id', documentController.getDocument);
  router.put('/:id', documentController.updateDocument);
  router.delete('/:id', documentController.deleteDocument);
  router.get('/:id/status', documentController.getDocumentStatus);

  return router;
};

export default createDocumentRoutes;
