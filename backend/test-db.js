const { initDB, getStats, addKnownAddress, closeDB } = require('./services/database');

async function test() {
  try {
    console.log('🧪 Inicialitzant la base de dades...');
    await initDB();
    
    console.log('📊 Estadístiques inicials:');
    const stats = await getStats();
    console.log(stats);
    
    console.log('✅ Prova completada');
    await closeDB();
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

test();
