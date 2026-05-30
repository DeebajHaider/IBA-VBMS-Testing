import * as dotenv from 'dotenv';
import * as path from 'path';

export default async function globalSetup() {
  dotenv.config({
    path: path.resolve(__dirname, '../../../../iba-backend/.env.test'),
  });
}
