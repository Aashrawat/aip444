const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');


const envPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  console.error('Error: OPENROUTER_API_KEY not found');
  process.exit(1);
}

console.log("git-cm:Developed by: Aashrawat Shrestha-179413232");

const pad = (value) => String(value).padStart(2, '0');
const now = new Date();
const formatted = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
console.log(`Run Date:${formatted}`);