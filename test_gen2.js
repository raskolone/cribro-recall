import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const configStr = fs.readFileSync('firebase-applet-config.json', 'utf8');
const config = JSON.parse(configStr);

const app = initializeApp(config);
const db = getFirestore(app);

// Mock browser env
global.window = {};

import * as geminiService from './services/geminiService.ts';

// Let's run it with esbuild first
