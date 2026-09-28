import dotenv from "dotenv";
import app from './app.js';

dotenv.config();
console.log("Database URL:", process.env.DATABASE_URL);
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});