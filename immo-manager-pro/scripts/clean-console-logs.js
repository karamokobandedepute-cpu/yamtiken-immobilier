const fs = require('fs')
const path = require('path')

const excludedFiles = ['node_modules', 'dist', 'build']

function cleanFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8')
  let cleaned = false
  
  // Supprimer les console.log simples
  content = content.replace(/console\.log\([^)]*\);?\n?/g, (match) => {
    cleaned = true
    return ''
  })
  
  // Supprimer les console.warn simples
  content = content.replace(/console\.warn\([^)]*\);?\n?/g, (match) => {
    cleaned = true
    return ''
  })
  
  // Supprimer les console.error de debug (garder ceux dans les catch)
  content = content.replace(/(\s*)console\.error\('\[.*?\].*?'\);?\n?/g, (match, indent) => {
    cleaned = true
    return ''
  })
  
  if (cleaned) {
    fs.writeFileSync(filePath, content)
    console.log(`✅ Nettoyé: ${filePath}`)
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir)
  
  files.forEach(file => {
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)
    
    if (stat.isDirectory() && !excludedFiles.includes(file)) {
      walkDir(filePath)
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      cleanFile(filePath)
    }
  })
}

console.log('🧹 Nettoyage des console.log...')
walkDir('./client/src')
console.log('✅ Terminé!')
