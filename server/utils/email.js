const nodemailer = require('nodemailer');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'tallerdecomputadoras.it@gmail.com';

const getTransporter = () => {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return null;
};

/**
 * Notifica al administrador que un chofer ha marcado la transferencia como realizada
 */
const sendTransferNotification = async ({
  driverName,
  driverEmail,
  tripDate,
  carWearAmount,
  carReplacementAmount,
  totalTransferAmount,
  tripId,
}) => {
  const formattedDate = new Date(tripDate || Date.now()).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const subject = `🚗 [DriverControl] Transferencia informada por ${driverName} - Falta aprobación`;
  const text = `
Hola Administrador,

El chofer ${driverName} (${driverEmail}) ha informado que realizó la transferencia correspondiente al turno del ${formattedDate}.

Detalle de la retención:
- Desgaste del auto (10%): $${carWearAmount.toFixed(2)}
- Futuro cambio del auto (10%): $${carReplacementAmount.toFixed(2)}
---------------------------------------------
TOTAL TRANSFERENCIA: $${totalTransferAmount.toFixed(2)}

Estado actual: Falta aprobación.
Por favor ingresa al Panel de Administrador para confirmar la recepción de los fondos.

ID Turno: ${tripId}
  `;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; background: #0f172a; color: #f8fafc; padding: 24px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1);">
      <h2 style="color: #38bdf8; margin-top: 0;">🚗 Notificación de Transferencia de Turno</h2>
      <p style="font-size: 15px; color: #cbd5e1;">El conductor <strong>${driverName}</strong> (${driverEmail}) ha informado la transferencia correspondiente a su turno.</p>
      
      <div style="background: #1e293b; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
        <p style="margin: 4px 0; color: #94a3b8; font-size: 13px;">Fecha del turno: <strong style="color: #f1f5f9;">${formattedDate}</strong></p>
        <p style="margin: 8px 0; font-size: 14px;">🔧 Desgaste del auto (10%): <strong>$${carWearAmount.toFixed(2)}</strong></p>
        <p style="margin: 8px 0; font-size: 14px;">🚘 Futuro cambio del auto (10%): <strong>$${carReplacementAmount.toFixed(2)}</strong></p>
        <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.1); margin: 12px 0;">
        <p style="margin: 4px 0; font-size: 18px; font-weight: bold; color: #10b981;">TOTAL A TRANSFERIR: $${totalTransferAmount.toFixed(2)}</p>
      </div>

      <div style="background: rgba(245, 158, 11, 0.15); border: 1px solid #f59e0b; padding: 12px; border-radius: 8px; margin-bottom: 20px;">
        <strong style="color: #fbbf24;">Estado: Falta aprobación</strong>
        <p style="margin: 4px 0 0; font-size: 13px; color: #fef3c7;">Ingresa al panel del administrador para verificar la transferencia y confirmarla.</p>
      </div>

      <p style="font-size: 12px; color: #64748b; margin-bottom: 0;">ID Turno: ${tripId}</p>
    </div>
  `;

  try {
    const transporter = getTransporter();
    if (transporter) {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || `"DriverControl App" <${process.env.SMTP_USER}>`,
        to: ADMIN_EMAIL,
        subject,
        text,
        html,
      });
      console.log(`[Email] Notificación de transferencia enviada a ${ADMIN_EMAIL}`);
      return { success: true, simulated: false };
    } else {
      console.log(`[Email SIMULADO] Se enviaría notificación a ${ADMIN_EMAIL}:\n${text}`);
      return { success: true, simulated: true };
    }
  } catch (error) {
    console.error('[Email Error] Error enviando correo de transferencia:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Envía una contraseña provisoria al correo del usuario (reset antes del login)
 */
const sendPasswordResetEmail = async ({ toEmail, userName, tempPassword }) => {
  const subject = `🔑 [DriverControl] Tu nueva contraseña provisoria`;
  const text = `
Hola ${userName},

Has solicitado restablecer tu contraseña en DriverControl.
Tu nueva contraseña provisoria es:

${tempPassword}

Inicia sesión con esta contraseña y cámbiala inmediatamente desde tu perfil por motivos de seguridad.
  `;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto; background: #0f172a; color: #f8fafc; padding: 24px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1);">
      <h2 style="color: #38bdf8; margin-top: 0;">🔑 Restablecimiento de Contraseña</h2>
      <p style="font-size: 15px; color: #cbd5e1;">Hola <strong>${userName}</strong>,</p>
      <p style="font-size: 14px; color: #94a3b8;">Has solicitado restablecer tu acceso a DriverControl. Te hemos generado una nueva contraseña provisoria:</p>
      
      <div style="background: #1e293b; padding: 16px; border-radius: 8px; text-align: center; margin: 20px 0; border: 1px solid #38bdf8;">
        <span style="font-family: monospace; font-size: 24px; font-weight: bold; letter-spacing: 2px; color: #38bdf8;">${tempPassword}</span>
      </div>

      <p style="font-size: 13px; color: #facc15;">⚠️ Por seguridad, una vez que inicies sesión ve a tu perfil y cámbiala por una contraseña personal.</p>
    </div>
  `;

  try {
    const transporter = getTransporter();
    if (transporter) {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || `"DriverControl App" <${process.env.SMTP_USER}>`,
        to: toEmail,
        subject,
        text,
        html,
      });
      console.log(`[Email] Contraseña provisoria enviada a ${toEmail}`);
      return { success: true, simulated: false };
    } else {
      console.log(`[Email SIMULADO] Se enviaría contraseña provisoria a ${toEmail}: ${tempPassword}`);
      return { success: true, simulated: true, tempPassword };
    }
  } catch (error) {
    console.error('[Email Error] Error enviando correo de reseteo:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendTransferNotification,
  sendPasswordResetEmail,
};
