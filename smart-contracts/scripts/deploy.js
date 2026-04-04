const hre = require("hardhat");

async function main() {
  console.log("🚀 Desplegando SecurityTestContract...");

  // Obtenemos el contrato
  const SecurityTestContract = await hre.ethers.getContractFactory("SecurityTestContract");
  
  // Iniciamos el despliegue
  const contract = await SecurityTestContract.deploy();

  // Esperamos a que se confirme
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("✅ Contrato desplegado en:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});