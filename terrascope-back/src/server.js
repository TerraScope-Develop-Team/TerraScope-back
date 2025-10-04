import dotenv from "dotenv";
import app from './app.js';

dotenv.config();
console.log("Mongo URI:", process.env.MONGO_URI);
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});