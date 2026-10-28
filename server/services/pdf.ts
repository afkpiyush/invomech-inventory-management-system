import PDFDocument from 'pdfkit'

export const buildPurchaseOrderPdf = (input: {
  number: string
  supplier: string
  items: Array<{ name: string; quantity: number; unitPrice: number }>
}) => {
  const document = new PDFDocument({ margin: 48 })
  const chunks: Buffer[] = []
  document.on('data', (chunk) => chunks.push(chunk))
  document.fontSize(22).fillColor('#2563eb').text('INVOMECH PVT. LTD.')
  document.fontSize(10).fillColor('#5b6678').text('Manufacturer of all kind of packaging machines and Engineering solutions provider.')
  document.moveDown().fontSize(16).fillColor('#172033').text(`Purchase Order ${input.number}`)
  document.fontSize(11).text(`Supplier: ${input.supplier}`)
  document.moveDown()
  let total = 0
  input.items.forEach((item) => {
    const line = item.quantity * item.unitPrice
    total += line
    document.fontSize(10).text(`${item.name} — ${item.quantity} x INR ${item.unitPrice.toFixed(2)} = INR ${line.toFixed(2)}`)
  })
  document.moveDown().fontSize(13).text(`Total: INR ${total.toFixed(2)}`)
  return new Promise<Buffer>((resolve, reject) => {
    document.on('error', reject)
    document.on('end', () => resolve(Buffer.concat(chunks)))
    document.end()
  })
}
