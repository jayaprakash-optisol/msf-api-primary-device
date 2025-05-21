import { Router } from 'express';

import { FileUploadController } from '../controllers/fileUpload.controller';
import { upload } from '../services/fileUpload.service';

const router = Router();
const fileUploadController = new FileUploadController();

router.post('/upload', upload.single('file'), fileUploadController.uploadFile);

export default router;
