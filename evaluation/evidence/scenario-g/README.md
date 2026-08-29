# Evidencia de l'escenari G

Data: 18 de juliol de 2026.

- Origen: `https://sepolia.etherscan.io`.
- Xarxa: `eip155:11155111` (Sepolia).
- Contracte: `0xA32D1b3BE52922ffA5e65403d9378165c672a363`.
- Operacio: `approve(0x3333333333333333333333333333333333333333, 1)`.
- Selector: `0x095ea7b3`.
- Registre SQLite previ a la confirmacio: `analysis_history.id = 46`.
- Veredicte final: `BAJO`, puntuacio 20, accio `ALLOW`.
- Temps total del backend: 147.624 ms.
- Transaccio confirmada a Sepolia.
- Hash: `0x1246bec06978358d97cdaa1de079d6b2c01cea5a2053f61335e53d2b4a988d9c`.
- Etherscan: https://sepolia.etherscan.io/tx/0x1246bec06978358d97cdaa1de079d6b2c01cea5a2053f61335e53d2b4a988d9c
- Captura: `G1-etherscan-metamask-confirmed.png`.

La captura mostra simultaniament l'estat `Success` a Etherscan, el bloc 11299926, el contracte de destinacio, el hash complet i l'activitat confirmada a MetaMask Flask sobre la xarxa Sepolia.

El hash es registra com a evidencia separada perque el backend analitza la transaccio abans que l'usuari la confirmi i, per tant, encara no existeix cap hash en el moment de desar `analysis_history`.
