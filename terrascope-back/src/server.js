import "dotenv/config";
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import app from "./app.js";

const isProduction = process.env.NODE_ENV === "production";
const httpsPort = Number(process.env.HTTPS_PORT || process.env.PORT || 443);

if (!process.env.JWT_SECRET) {
  throw new Error("Falta la variable JWT_SECRET");
}

if (isProduction) {
  const requiredVariables = ["HTTPS_KEY_PATH", "HTTPS_CERT_PATH"];
  const missingVariables = requiredVariables.filter((name) => !process.env[name]);

  if (missingVariables.length > 0) {
    throw new Error(`Faltan variables de producción: ${missingVariables.join(", ")}`);
  }

  const secureServer = https.createServer({
    key: fs.readFileSync(process.env.HTTPS_KEY_PATH),
    cert: fs.readFileSync(process.env.HTTPS_CERT_PATH)
  }, app);

  secureServer.listen(httpsPort, () => {
    console.log(`Servidor HTTPS corriendo en puerto ${httpsPort}`);
  });

  const httpPort = Number(process.env.HTTP_PORT || 80);
  http.createServer((req, res) => {
    const hostname = (req.headers.host || "").split(":")[0];
    const portSuffix = httpsPort === 443 ? "" : `:${httpsPort}`;
    res.writeHead(308, {
      Location: `https://${hostname}${portSuffix}${req.url}`
    });
    res.end();
  }).listen(httpPort, () => {
    console.log(`Redirección HTTP a HTTPS activa en puerto ${httpPort}`);
  });
} else {
  app.listen(httpsPort, () => {
    console.log(`Servidor HTTP de desarrollo corriendo en puerto ${httpsPort}`);
  });
}