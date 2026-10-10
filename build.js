const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('==============================================');
console.log('  UBER DRIVER APP - FULLSTACK BUILD SCRIPT    ');
console.log('==============================================');

// Determine root directory whether run from root or from server/
const currentDir = __dirname;
const isInsideServer = fs.existsSync(path.join(currentDir, 'models')) || path.basename(currentDir) === 'server';
const rootDir = isInsideServer ? path.resolve(currentDir, '..') : currentDir;

const serverDir = path.resolve(rootDir, 'server');
const clientDir = path.resolve(rootDir, 'client');

console.log(`Root dir:   ${rootDir}`);
console.log(`Server dir: ${serverDir}`);
console.log(`Client dir: ${clientDir}`);

try {
  console.log('\n>> [1/3] Instalando dependencias del backend...');
  execSync('npm install', { cwd: serverDir, stdio: 'inherit' });

  console.log('\n>> [2/3] Instalando dependencias del cliente (React)...');
  execSync('npm install', { cwd: clientDir, stdio: 'inherit' });

  console.log('\n>> [3/3] Compilando aplicación web React (Production Build)...');
  execSync('npm run build', {
    cwd: clientDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      CI: 'false',
      GENERATE_SOURCEMAP: 'false',
    },
  });

  const buildPath = path.resolve(clientDir, 'build');
  if (fs.existsSync(buildPath) && fs.existsSync(path.join(buildPath, 'index.html'))) {
    console.log('\n✅ COMPILACIÓN EXITOSA: React build generado correctamente en:', buildPath);
  } else {
    console.warn('\n⚠️ Advertencia: No se encontró client/build/index.html');
  }
} catch (error) {
  console.error('\n❌ ERROR DURANTE LA COMPILACIÓN:', error.message);
  process.exit(1);
}
