const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('==============================================');
console.log('  UBER DRIVER APP - FULLSTACK BUILD SCRIPT    ');
console.log('==============================================');

try {
  console.log('>> [1/3] Instalando dependencias del servidor...');
  execSync('npm install --prefix server', { stdio: 'inherit' });

  console.log('\n>> [2/3] Instalando dependencias del cliente (React)...');
  execSync('npm install --prefix client', { stdio: 'inherit' });

  console.log('\n>> [3/3] Compilando aplicación web React (Production Build)...');
  execSync('npm run --prefix client build', {
    stdio: 'inherit',
    env: {
      ...process.env,
      CI: 'false',
      GENERATE_SOURCEMAP: 'false',
    },
  });

  const buildPath = path.resolve(__dirname, 'client/build');
  if (fs.existsSync(buildPath)) {
    console.log('\n✅ COMPILACIÓN EXITOSA: Archivos generados en client/build');
  } else {
    console.warn('\n⚠️ Advertencia: No se encontró la carpeta client/build');
  }
} catch (error) {
  console.error('\n❌ ERROR DURANTE LA COMPILACIÓN:', error.message);
  process.exit(1);
}
