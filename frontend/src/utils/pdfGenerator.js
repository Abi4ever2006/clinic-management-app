import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export const generatePrescriptionPDFBase64 = async (elementId) => {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error('Prescription preview element not found');
  }

  console.log('Element found:', element);
  console.log('Element dimensions:', element.scrollWidth, element.scrollHeight);
  console.log('Element visible:', element.offsetWidth, element.offsetHeight);

  // Wait for element to be fully rendered
  await new Promise(resolve => setTimeout(resolve, 500));

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    logging: false,
    backgroundColor: '#ffffff',
    width: element.scrollWidth,
    height: element.scrollHeight,
  });

  if (!canvas.width || !canvas.height) {
    throw new Error('Canvas has invalid dimensions');
  }

  const imgData = canvas.toDataURL('image/jpeg', 0.85);

  if (!imgData || imgData === 'data:,') {
    throw new Error('Failed to generate canvas image');
  }

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

  pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);

  const dataUriString = pdf.output('datauristring');
  const base64String = dataUriString.split(',')[1];

  return base64String;
};

export const downloadPrescriptionPDF = async (elementId, filename = 'prescription.pdf') => {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error('Prescription preview element not found');
  }

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    logging: false,
    backgroundColor: '#ffffff',
    width: element.scrollWidth,
    height: element.scrollHeight,
  });

  const imgData = canvas.toDataURL('image/jpeg', 0.85);
  
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });
  
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
  
  pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
  pdf.save(filename);
};