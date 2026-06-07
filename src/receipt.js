/* ============================================================
   CUADRE — comprobantes (PDF + WhatsApp)
   Versión para el cliente: NO muestra ganancia ni tasa de costo.
   ============================================================ */
import { jsPDF } from "jspdf";
import { CHANNELS, accountById, clientById, fmt, fmtCur, getProfile } from "./store";

function opDate(op) {
  const d = op.date ? new Date(op.date) : new Date();
  return d.toLocaleString("es-VE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function folio(op) {
  return "CMB-" + String(op.id).replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 8);
}

/* ---- Datos comunes del comprobante ------------------------ */
function receiptData(op, s) {
  const cli = clientById(s, op.clientId);
  const inAcc = accountById(s, op.inId);
  const outAcc = accountById(s, op.outId);
  return {
    folio: folio(op),
    fecha: opDate(op),
    cliente: cli?.name || "Sin cliente",
    telefono: cli?.phone || "",
    recibido: fmtCur(op.inAmt, inAcc?.currency),
    recibidoCanal: CHANNELS[inAcc?.kind]?.label || "",
    entregado: fmtCur(op.outAmt, outAcc?.currency),
    entregadoCanal: CHANNELS[outAcc?.kind]?.label || "",
    tasa: fmt(op.rate, 2) + " Bs/$",
    negocio: getProfile()?.business || getProfile()?.name || "Cuadre",
  };
}

/* ---- Texto para WhatsApp ---------------------------------- */
export function whatsappText(op, s) {
  const d = receiptData(op, s);
  return (
    `🧾 *Comprobante de cambio*\n` +
    `${d.negocio}\n` +
    `————————————————\n` +
    `*Folio:* ${d.folio}\n` +
    `*Fecha:* ${d.fecha}\n` +
    `*Cliente:* ${d.cliente}\n\n` +
    `*Recibido:* ${d.recibido}\n_${d.recibidoCanal}_\n\n` +
    `*Entregado:* ${d.entregado}\n_${d.entregadoCanal}_\n\n` +
    `*Tasa aplicada:* ${d.tasa}\n` +
    `————————————————\n` +
    `Gracias por tu preferencia 🙌\n` +
    `_Generado con Cuadre_`
  );
}

function vePhone(raw) {
  let d = (raw || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("58")) return d;
  if (d.startsWith("0")) return "58" + d.slice(1);
  return "58" + d;
}

export function sendWhatsApp(op, s) {
  const d = receiptData(op, s);
  const text = encodeURIComponent(whatsappText(op, s));
  const phone = vePhone(d.telefono);
  const url = phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
  window.open(url, "_blank");
}

/* ---- PDF descargable -------------------------------------- */
export function downloadPDF(op, s) {
  const d = receiptData(op, s);
  const doc = new jsPDF({ unit: "pt", format: "a5" });
  const W = doc.internal.pageSize.getWidth();
  const M = 38;

  // Header verde
  doc.setFillColor(15, 21, 18);
  doc.rect(0, 0, W, 92, "F");
  doc.setFillColor(184, 242, 74);
  doc.rect(0, 88, W, 4, "F");

  doc.setTextColor(184, 242, 74);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text("Cuadre", M, 48);
  doc.setTextColor(235, 240, 236);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Comprobante de cambio", M, 68);

  doc.setTextColor(150, 160, 155);
  doc.setFontSize(9);
  doc.text(d.negocio, W - M, 48, { align: "right" });
  doc.text(d.folio, W - M, 64, { align: "right" });
  doc.text(d.fecha, W - M, 78, { align: "right" });

  let y = 130;
  doc.setTextColor(120, 130, 125);
  doc.setFontSize(9);
  doc.text("CLIENTE", M, y);
  doc.setTextColor(25, 30, 27);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  y += 20;
  doc.text(d.cliente, M, y);
  if (d.telefono) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(120, 130, 125);
    y += 16;
    doc.text(d.telefono, M, y);
  }

  // Bloques recibido / entregado
  y += 36;
  const row = (label, value, sub) => {
    doc.setDrawColor(225, 228, 226);
    doc.setLineWidth(0.6);
    doc.line(M, y, W - M, y);
    y += 22;
    doc.setTextColor(120, 130, 125);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(label.toUpperCase(), M, y);
    doc.setTextColor(25, 30, 27);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(value, W - M, y, { align: "right" });
    if (sub) {
      y += 14;
      doc.setTextColor(140, 150, 145);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(sub, W - M, y, { align: "right" });
    }
    y += 18;
  };
  row("Recibido del cliente", d.recibido, d.recibidoCanal);
  row("Entregado al cliente", d.entregado, d.entregadoCanal);
  row("Tasa aplicada", d.tasa);

  // Línea final + total destacado
  doc.setDrawColor(225, 228, 226);
  doc.line(M, y, W - M, y);

  // Footer
  const H = doc.internal.pageSize.getHeight();
  doc.setTextColor(150, 160, 155);
  doc.setFontSize(9);
  doc.text("Gracias por tu preferencia.", M, H - 46);
  doc.setTextColor(184, 200, 120);
  doc.setFont("helvetica", "bold");
  doc.text("Generado con Cuadre · control de cambios", M, H - 30);

  doc.save(`comprobante-${d.folio}.pdf`);
}
