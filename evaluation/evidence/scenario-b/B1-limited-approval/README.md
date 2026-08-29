# Evidencia B1: aprovacio ERC20 limitada

Data: 18 de juliol de 2026.

- Contracte Sepolia: `0xA32D1b3BE52922ffA5e65403d9378165c672a363`.
- Origen: `https://sepolia.etherscan.io`.
- Xarxa: `eip155:11155111` (Sepolia).
- Operacio: `approve(0x3333333333333333333333333333333333333333, 1000000000000000000)`.
- Selector: `0x095ea7b3`.
- Registre SQLite: `analysis_history.id = 45`.
- Veredicte determinista i final: `BAJO`.
- Puntuacio: 20.
- Accio recomanada: `ALLOW`.
- Temps total del backend: 145.417 ms.
- Resultat: vertader negatiu (VN).

La resposta bruta d'Ollama va proposar `ALTO`, pero el control semantic la va limitar a `BAJO` perque no existia cap permis il.limitat, permis global actiu ni etiqueta objectiva de risc. La resposta bruta es conserva a SQLite per garantir la tracabilitat.

Fitxers:

- `B1-metamask-transaction.png`: peticio de limit de despesa a Sepolia.
- `B2-snap-insight-verdict.png`: veredicte i accio recomanada abans de confirmar.
- `B3-snap-insight-findings.png`: quantitat, spender, origen i context local.
