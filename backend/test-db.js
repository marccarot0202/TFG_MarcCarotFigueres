const { initDB, getStats, addKnownAddress, closeDB } = require('./services/database');

async function test() {
  try {
    console.log('🧪 Iniciando BD...');
    await initDB();
    
    console.log('📊 Estadísticas iniciales:');
    const stats = await getStats();
    console.log(stats);
    
    console.log('✅ Test completado');
    await closeDB();
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

test();