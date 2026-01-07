
import { toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';

// Dimensiones actualizadas para Carta Horizontal de alta resolución
const EXPORT_WIDTH = 3300;
const EXPORT_HEIGHT = 2550;

export const exportToImage = async (elementId: string, filename: string) => {
  const element = document.getElementById(elementId);
  if (!element) return;

  try {
    const dataUrl = await toJpeg(element, { 
      quality: 0.95, 
      pixelRatio: 1,
      backgroundColor: '#ffffff',
      width: EXPORT_WIDTH,
      height: EXPORT_HEIGHT
    });
    const link = document.createElement('a');
    link.download = `${filename}.jpg`;
    link.href = dataUrl;
    link.click();
  } catch (err) {
    console.error('Error al exportar imagen:', err);
  }
};

export const exportToPDF = async (elementId: string, filename: string) => {
  const element = document.getElementById(elementId);
  if (!element) return;

  try {
    const dataUrl = await toJpeg(element, { 
      quality: 0.95, 
      pixelRatio: 1,
      backgroundColor: '#ffffff',
      width: EXPORT_WIDTH,
      height: EXPORT_HEIGHT
    });
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'px',
      format: [EXPORT_WIDTH, EXPORT_HEIGHT]
    });
    pdf.addImage(dataUrl, 'JPEG', 0, 0, EXPORT_WIDTH, EXPORT_HEIGHT);
    pdf.save(`${filename}.pdf`);
  } catch (err) {
    console.error('Error al exportar PDF:', err);
  }
};
