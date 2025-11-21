import nodemailer from "nodemailer";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ObserverService {
  constructor() {
    this.subscribers = new Map();
    this.eventHandlers = new Map();
    this.initializeEventHandlers();
  }

  initializeEventHandlers() {
    this.eventHandlers.set("AVISTAMIENTO_CREADO", this.handleAvistamientoCreado.bind(this));
    this.eventHandlers.set("RETO_COMPLETADO", this.handleRetoCompletado.bind(this));
    this.eventHandlers.set("NUEVO_RETO", this.handleNuevoReto.bind(this));
  }

  subscribe(eventType, callback) {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, []);
    }
    this.subscribers.get(eventType).push(callback);
    console.log(`✅ Suscriptor agregado para: ${eventType}`);
  }

  unsubscribe(eventType, callback) {
    if (!this.subscribers.has(eventType)) return;
    
    const callbacks = this.subscribers.get(eventType);
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
      console.log(`❌ Suscriptor eliminado de: ${eventType}`);
    }
  }

  async notify(eventType, data) {
    console.log(`📢 Notificando evento: ${eventType}`);
    
    const handler = this.eventHandlers.get(eventType);
    if (handler) {
      await handler(data);
    }

    const callbacks = this.subscribers.get(eventType) || [];
    for (const callback of callbacks) {
      try {
        await callback(data);
      } catch (error) {
        console.error(`❌ Error ejecutando callback para ${eventType}:`, error);
      }
    }
  }

  async handleAvistamientoCreado(data) {
    console.log("🔍 Procesando nuevo avistamiento:", data);
  }

  async handleRetoCompletado(data) {
    console.log("🏆 Procesando reto completado:", data);
    try {
      await this.enviarCertificado(data);
    } catch (error) {
      console.error("❌ Error enviando certificado, pero el logro se guardó correctamente:", error);
    }
  }

  async handleNuevoReto(data) {
    console.log("🎯 Procesando nuevo reto:", data);
    await this.notificarNuevoReto(data);
  }

  async enviarCertificado({ usuario, reto }) {
    try {
      console.log(`📧 Generando certificado para ${usuario.nombre_usuario}`);
      
      const pdfPath = await this.generarCertificadoPDF(usuario, reto);
      
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD
        }
      });

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: usuario.email_usuario,
        subject: `🏆 ¡Felicidades! Has completado: ${reto.nombre_reto}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 2px solid #5C6445; border-radius: 10px;">
            <h1 style="color: #5C6445; text-align: center;">🌿 TerraScope</h1>
            <h2 style="color: #0F1D33; text-align: center;">¡Felicidades ${usuario.nombre_usuario}!</h2>
            <p style="font-size: 16px; color: #224275; text-align: center;">
              Has completado exitosamente el desafío:
            </p>
            <div style="background-color: #E0E0E0; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
              <h3 style="color: #5C6445; margin: 0;">${reto.nombre_reto}</h3>
              <p style="color: #224275; margin: 10px 0;">${reto.descripcion_reto}</p>
            </div>
            <p style="font-size: 14px; color: #224275; text-align: center;">
              Tu certificado está adjunto en este correo. ¡Sigue explorando y registrando la biodiversidad!
            </p>
            <div style="text-align: center; margin-top: 30px;">
              <p style="font-size: 12px; color: #939E69;">
                TerraScope - Monitoreo ambiental inteligente
              </p>
            </div>
          </div>
        `,
        attachments: [
          {
            filename: `Certificado_${reto.nombre_reto.replace(/\s/g, '_')}.pdf`,
            path: pdfPath
          }
        ]
      };

      await transporter.sendMail(mailOptions);
      
      fs.unlinkSync(pdfPath);
      
      console.log(`✅ Certificado enviado a ${usuario.email_usuario}`);
    } catch (error) {
      console.error("❌ Error enviando certificado:", error);
      throw error;
    }
  }

  async generarCertificadoPDF(usuario, reto) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          layout: 'landscape',
          margin: 50
        });

        const tempDir = path.join(__dirname, '../../temp');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        const filename = `certificado_${Date.now()}.pdf`;
        const filepath = path.join(tempDir, filename);
        const stream = fs.createWriteStream(filepath);

        doc.pipe(stream);

        // Fondo decorativo
        doc.rect(0, 0, doc.page.width, doc.page.height)
           .fill('#F5F5F5');

        // Marco decorativo
        doc.rect(30, 30, doc.page.width - 60, doc.page.height - 60)
           .stroke('#5C6445');
        doc.rect(35, 35, doc.page.width - 70, doc.page.height - 70)
           .stroke('#939E69');

        // Título
        doc.fontSize(48)
           .fillColor('#5C6445')
           .text('CERTIFICADO', 0, 80, { align: 'center', width: doc.page.width });

        doc.fontSize(24)
           .fillColor('#0F1D33')
           .text('de Logro', 0, 140, { align: 'center', width: doc.page.width });

        // Texto principal
        doc.fontSize(18)
           .fillColor('#224275')
           .text('Se otorga el presente certificado a:', 0, 200, { 
             align: 'center', 
             width: doc.page.width 
           });

        doc.fontSize(36)
           .fillColor('#5C6445')
           .font('Helvetica-Bold')
           .text(usuario.nombre_usuario, 0, 250, { 
             align: 'center', 
             width: doc.page.width 
           });

        doc.fontSize(16)
           .fillColor('#224275')
           .font('Helvetica')
           .text('Por haber completado exitosamente el desafío:', 0, 310, { 
             align: 'center', 
             width: doc.page.width 
           });

        doc.fontSize(28)
           .fillColor('#0F1D33')
           .font('Helvetica-Bold')
           .text(reto.nombre_reto, 0, 350, { 
             align: 'center', 
             width: doc.page.width 
           });

        doc.fontSize(14)
           .fillColor('#939E69')
           .font('Helvetica-Oblique')
           .text(reto.descripcion_reto, 100, 400, { 
             align: 'center', 
             width: doc.page.width - 200 
           });

        // Fecha
        const fecha = new Date().toLocaleDateString('es-ES', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });

        doc.fontSize(12)
           .fillColor('#224275')
           .font('Helvetica')
           .text(`Fecha de obtención: ${fecha}`, 0, 480, { 
             align: 'center', 
             width: doc.page.width 
           });

      
        doc.end();

        stream.on('finish', () => {
          resolve(filepath);
        });

        stream.on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  async notificarNuevoReto(data) {
    try {
      console.log(`📧 Notificando nuevo reto: ${data.nombre_reto}`);
    } catch (error) {
      console.error("❌ Error notificando nuevo reto:", error);
    }
  }
}

export default new ObserverService();
