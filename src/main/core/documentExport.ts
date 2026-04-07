/**
 * Gerki – Dokument-Export
 * Erstellt PDF, DOCX und TXT aus Markdown-Text
 */

import { dialog, BrowserWindow } from 'electron'
import { writeFileSync } from 'fs'
import PDFDocument from 'pdfkit'
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx'

export type DocFormat = 'pdf' | 'docx' | 'txt'

interface ExportResult {
  success: boolean
  path?: string
  error?: string
}

/** Bereinigt Markdown zu plain text */
function markdownToPlain(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, '')        // Headings
    .replace(/\*\*(.+?)\*\*/g, '$1')    // Bold
    .replace(/\*(.+?)\*/g, '$1')        // Italic
    .replace(/`{3}[\s\S]*?`{3}/g, '')   // Code blocks
    .replace(/`(.+?)`/g, '$1')          // Inline code
    .replace(/^\s*[-*]\s+/gm, '• ')     // Unordered list
    .replace(/^\s*\d+\.\s+/gm, '')      // Ordered list
    .replace(/\[(.+?)\]\(.+?\)/g, '$1') // Links
    .replace(/^>\s+/gm, '')             // Blockquote
    .replace(/---+/g, '─────────────')  // Horizontal rules
    .trim()
}

/** Parsed Markdown in strukturierte Zeilen */
function parseMarkdownLines(md: string): Array<{ type: 'h1'|'h2'|'h3'|'bullet'|'text'|'code'; content: string }> {
  const lines = md.split('\n')
  const result: Array<{ type: 'h1'|'h2'|'h3'|'bullet'|'text'|'code'; content: string }> = []
  let inCode = false

  for (const line of lines) {
    if (line.startsWith('```')) { inCode = !inCode; continue }
    if (inCode) { result.push({ type: 'code', content: line }); continue }

    if (line.startsWith('# '))   result.push({ type: 'h1', content: line.slice(2) })
    else if (line.startsWith('## ')) result.push({ type: 'h2', content: line.slice(3) })
    else if (line.startsWith('### ')) result.push({ type: 'h3', content: line.slice(4) })
    else if (/^\s*[-*]\s/.test(line)) result.push({ type: 'bullet', content: line.replace(/^\s*[-*]\s+/, '') })
    else result.push({ type: 'text', content: line })
  }
  return result
}

/** Entfernt inline Markdown-Markup */
function cleanInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
}

async function exportPDF(content: string, filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margin: 60,
      size: 'A4',
      info: { Title: 'Gerki Dokument', Creator: 'Gerki App' }
    })

    const chunks: Buffer[] = []
    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('end', () => {
      writeFileSync(filePath, Buffer.concat(chunks))
      resolve()
    })
    doc.on('error', reject)

    const lines = parseMarkdownLines(content)
    let firstItem = true

    for (const line of lines) {
      const text = cleanInline(line.content)

      if (line.type === 'h1') {
        if (!firstItem) doc.moveDown(0.5)
        doc.fontSize(22).font('Helvetica-Bold').fillColor('#1a1a2e').text(text)
        doc.moveDown(0.3)
        firstItem = false
      } else if (line.type === 'h2') {
        if (!firstItem) doc.moveDown(0.4)
        doc.fontSize(16).font('Helvetica-Bold').fillColor('#2d2d5e').text(text)
        doc.moveDown(0.2)
        firstItem = false
      } else if (line.type === 'h3') {
        if (!firstItem) doc.moveDown(0.3)
        doc.fontSize(13).font('Helvetica-Bold').fillColor('#3d3d7e').text(text)
        doc.moveDown(0.1)
        firstItem = false
      } else if (line.type === 'bullet') {
        doc.fontSize(11).font('Helvetica').fillColor('#222222')
          .text(`• ${text}`, { indent: 15 })
        firstItem = false
      } else if (line.type === 'code') {
        doc.fontSize(9).font('Courier').fillColor('#444444')
          .text(text, { indent: 20 })
        firstItem = false
      } else if (text.trim()) {
        doc.fontSize(11).font('Helvetica').fillColor('#222222').text(text)
        firstItem = false
      } else if (!firstItem) {
        doc.moveDown(0.3)
      }
    }

    doc.end()
  })
}

function exportDOCX(content: string): Promise<Buffer> {
  const lines = parseMarkdownLines(content)
  const paragraphs: Paragraph[] = []

  for (const line of lines) {
    const text = cleanInline(line.content)

    if (line.type === 'h1') {
      paragraphs.push(new Paragraph({ text, heading: HeadingLevel.HEADING_1 }))
    } else if (line.type === 'h2') {
      paragraphs.push(new Paragraph({ text, heading: HeadingLevel.HEADING_2 }))
    } else if (line.type === 'h3') {
      paragraphs.push(new Paragraph({ text, heading: HeadingLevel.HEADING_3 }))
    } else if (line.type === 'bullet') {
      paragraphs.push(new Paragraph({
        children: [new TextRun(text)],
        bullet: { level: 0 }
      }))
    } else if (line.type === 'code') {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text, font: 'Courier New', size: 18, color: '444444' })]
      }))
    } else {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text })]
      }))
    }
  }

  const doc = new Document({
    sections: [{
      properties: {},
      children: paragraphs
    }]
  })
  return Packer.toBuffer(doc)
}

export async function saveDocument(
  content: string,
  format: DocFormat,
  suggestedName: string,
  win: BrowserWindow
): Promise<ExportResult> {
  const ext = format === 'pdf' ? 'pdf' : format === 'docx' ? 'docx' : 'txt'
  const filterName = format === 'pdf' ? 'PDF Dokument' : format === 'docx' ? 'Word Dokument' : 'Textdatei'

  const { filePath, canceled } = await dialog.showSaveDialog(win, {
    title: 'Dokument speichern',
    defaultPath: `${suggestedName}.${ext}`,
    filters: [{ name: filterName, extensions: [ext] }]
  })

  if (canceled || !filePath) return { success: false }

  try {
    if (format === 'txt') {
      writeFileSync(filePath, markdownToPlain(content), 'utf-8')
    } else if (format === 'pdf') {
      await exportPDF(content, filePath)
    } else if (format === 'docx') {
      const buffer = await exportDOCX(content)
      writeFileSync(filePath, buffer)
    }
    return { success: true, path: filePath }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}
