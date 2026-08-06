import { Router } from 'express';
import sessionRoutes from './sessions.js';
import memorySpanRoutes from './memorySpan.js';
//import patternRecognitionRoutes from './patternRecognition.js';
//import processingSpeedRoutes from './processingSpeed.js';
//import verbalFluencyRoutes from './verbalFluency.js';

const router = Router();
router.use('/session', sessionRoutes);
router.use('/tasks/memory-span', memorySpanRoutes);
//router.use('/tasks/pattern-recognition', patternRecognitionRoutes);
//router.use('/tasks/processing-speed', processingSpeedRoutes);
//router.use('/tasks/verbal-fluency', verbalFluencyRoutes);

export default router;