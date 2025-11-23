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
        margin: 0
      });

      const tempDir = path.join(__dirname, '../../temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const filename = `certificado_${Date.now()}.pdf`;
      const filepath = path.join(tempDir, filename);
      const stream = fs.createWriteStream(filepath);

      doc.pipe(stream);

      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;

      // ========== FONDO BLANCO ==========
      doc.rect(0, 0, pageWidth, pageHeight).fill('#FFFFFF');

      // ========== FORMAS DECORATIVAS LADO IZQUIERDO ==========
      
      // Forma ondulada verde oscuro (fondo)
      doc.moveTo(0, 0)
         .lineTo(280, 0)
         .bezierCurveTo(240, pageHeight * 0.3, 220, pageHeight * 0.5, 200, pageHeight * 0.7)
         .bezierCurveTo(190, pageHeight * 0.85, 180, pageHeight * 0.95, 180, pageHeight)
         .lineTo(0, pageHeight)
         .closePath()
         .fill('#0F3D3E');

      // Forma ondulada verde medio
      doc.moveTo(0, 0)
         .lineTo(240, 0)
         .bezierCurveTo(200, pageHeight * 0.3, 180, pageHeight * 0.5, 160, pageHeight * 0.7)
         .bezierCurveTo(150, pageHeight * 0.85, 140, pageHeight * 0.95, 140, pageHeight)
         .lineTo(0, pageHeight)
         .closePath()
         .fill('#5C6445');

      // Forma ondulada gris claro
      doc.moveTo(0, 0)
         .lineTo(200, 0)
         .bezierCurveTo(160, pageHeight * 0.3, 140, pageHeight * 0.5, 120, pageHeight * 0.7)
         .bezierCurveTo(110, pageHeight * 0.85, 100, pageHeight * 0.95, 100, pageHeight)
         .lineTo(0, pageHeight)
         .closePath()
         .fill('#939e69');

      // ========== FRANJAS DORADAS VERTICALES LADO DERECHO ==========
      
      const stripeWidth = 8;
      const stripeSpacing = 15;
      const startX = pageWidth - 60;
      
      doc.opacity(0.4);
      for (let i = 0; i < 4; i++) {
        doc.rect(startX + (i * stripeSpacing), 0, stripeWidth, pageHeight)
           .fill('#D4AF37');
      }
      doc.opacity(1);


      // ========== MEDALLÓN DORADO CON LISTONES ==========
      const medalX = 110;
      const medalY = 140;

      // Listones del medallón
      doc.polygon(
        [medalX - 25, medalY + 55],
        [medalX - 15, medalY + 55],
        [medalX - 20, medalY + 100],
        [medalX - 35, medalY + 100]
      ).fill('#D4AF37');

      doc.polygon(
        [medalX + 25, medalY + 55],
        [medalX + 15, medalY + 55],
        [medalX + 20, medalY + 100],
        [medalX + 35, medalY + 100]
      ).fill('#C9A961');

      // Círculo exterior del medallón (serrado)
      const numPoints = 24;
      const outerRadius = 50;
      const innerRadius = 45;
      const points = [];
      
      for (let i = 0; i < numPoints * 2; i++) {
        const angle = (i * Math.PI) / numPoints;
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        points.push([
          medalX + Math.cos(angle) * radius,
          medalY + Math.sin(angle) * radius
        ]);
      }
      doc.polygon(...points).fill('#D4AF37');

      // Círculo interior brillante
      doc.circle(medalX, medalY, 40)
         .fill('#F4E4C1');
      
      // Efecto de brillo radial
      doc.circle(medalX, medalY, 35)
         .fill('#E8D7A6');

      // Estrella central
      const starRadius = 20;
      const starInnerRadius = 10;
      const starPoints = [];
      for (let i = 0; i < 10; i++) {
        const angle = (i * Math.PI) / 5 - Math.PI / 2;
        const radius = i % 2 === 0 ? starRadius : starInnerRadius;
        starPoints.push([
          medalX + Math.cos(angle) * radius,
          medalY + Math.sin(angle) * radius
        ]);
      }
      doc.polygon(...starPoints).fill('#FFFFFF');

      // ========== CONTENIDO PRINCIPAL ==========

      // Título "CERTIFICADO"
      doc.fontSize(64)
         .fillColor('#2C3E50')
         .font('Helvetica-Bold')
         .text('CERTIFICADO', 320, 80, { 
           width: pageWidth - 380,
           characterSpacing: 2
         });

      // Subtítulo dorado
      doc.fontSize(20)
         .fillColor('#C9A961')
         .font('Helvetica')
         .text('DE RECONOCIMIENTO', 320, 155, { 
           width: pageWidth - 380,
           characterSpacing: 3
         });

      // Texto "Otorgado a"
      doc.fontSize(13)
         .fillColor('#6B7280')
         .font('Helvetica')
         .text('Otorgado a', 320, 210, { 
           width: pageWidth - 380
         });

      // Nombre del usuario (cursiva elegante simulada)
      doc.fontSize(48)
         .fillColor('#2C3E50')
         .font('Helvetica-BoldOblique')
         .text(usuario.nombre_usuario, 320, 235, { 
           width: pageWidth - 380
         });

      // Línea dorada bajo el nombre
      doc.moveTo(320, 295)
         .lineTo(pageWidth - 80, 295)
         .lineWidth(2)
         .stroke('#C9A961');

      // Descripción del logro
      doc.fontSize(12)
         .fillColor('#4B5563')
         .font('Helvetica')
         .text('Por haber completado satisfactoriamente el desafío', 320, 320, { 
           width: pageWidth - 380,
           align: 'left'
         });

      // Nombre del reto
      doc.fontSize(14)
         .fillColor('#2C3E50')
         .font('Helvetica-Bold')
         .text(reto.nombre_reto, 320, 345, { 
           width: pageWidth - 380,
           align: 'left'
         });

      // Descripción del reto
      if (reto.descripcion_reto && reto.descripcion_reto.length > 0) {
        doc.fontSize(11)
           .fillColor('#6B7280')
           .font('Helvetica-Oblique')
           .text(reto.descripcion_reto, 320, 368, { 
             width: pageWidth - 380,
             align: 'left',
             lineGap: 2
           });
      }

      // ========== FECHA ==========
      const fecha = new Date().toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });

      doc.fontSize(13)
         .fillColor('#C9A961')
         .font('Helvetica-Bold')
         .text(fecha, 320, pageHeight - 150, { 
           width: pageWidth - 380,
           align: 'left'
         });



      // ========== LÍNEAS DE FIRMA ==========
      const sigY = pageHeight - 85;
      const sig1X = 340;
      const sig2X = 560;
      const sigWidth = 150;

      // Firma manuscrita simulada 1
      doc.fontSize(12)
         .fillColor('#2C3E50')
         .font('Helvetica-BoldOblique')
         .text('Equipo TerraScope', sig1X, sigY - 25, { 
           width: sigWidth,
           align: 'center'
         });

      // Línea firma 1
      doc.moveTo(sig1X, sigY)
         .lineTo(sig1X + sigWidth, sigY)
         .lineWidth(1)
         .stroke('#C9A961');

      // Texto descriptivo bajo firma 1
      doc.fontSize(9)
         .fillColor('#6B7280')
         .font('Helvetica')
         .text('Equipo de Desarrollo', sig1X, sigY + 8, { 
           width: sigWidth,
           align: 'center'
         });

      doc.fontSize(8)
         .fillColor('#939E69')
         .font('Helvetica-Oblique')
         .text('TerraScope', sig1X, sigY + 20, { 
           width: sigWidth,
           align: 'center'
         });

      // Firma manuscrita simulada 2
      doc.fontSize(12)
         .fillColor('#2C3E50')
         .font('Helvetica-BoldOblique')
         .text('Equipo TerraScope', sig2X, sigY - 25, { 
           width: sigWidth,
           align: 'center'
         });

      // Línea firma 2
      doc.moveTo(sig2X, sigY)
         .lineTo(sig2X + sigWidth, sigY)
         .lineWidth(1)
         .stroke('#C9A961');

      // Texto descriptivo bajo firma 2
      doc.fontSize(9)
         .fillColor('#6B7280')
         .font('Helvetica')
         .text('Equipo de Desarrollo', sig2X, sigY + 8, { 
           width: sigWidth,
           align: 'center'
         });

      doc.fontSize(8)
         .fillColor('#939E69')
         .font('Helvetica-Oblique')
         .text('TerraScope', sig2X, sigY + 20, { 
           width: sigWidth,
           align: 'center'
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
