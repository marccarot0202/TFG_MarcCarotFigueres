const hre = require("hardhat");

async function main() {
  const SecurityTestNFT = await hre.ethers.getContractFactory("SecurityTestNFT");
  const nft = await SecurityTestNFT.deploy();

  await nft.waitForDeployment();

  const address = await nft.getAddress();
  console.log("✅ SecurityTestNFT desplegado en:", address);
}

main().catch((error) => {
  console.error("❌ Error en el despliegue:", error);
  process.exitCode = 1;
});