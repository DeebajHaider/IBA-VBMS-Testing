const dotenv = require('dotenv');
const path = require('path');

// Signal to ConfigModule which env file to load
process.env.NODE_ENV = 'test';

// Load test values with override:true so they win
// even if something else already touched process.env
dotenv.config({
  path: path.resolve(__dirname, '../../../iba-backend/.env.test'),
  override: true,
});
