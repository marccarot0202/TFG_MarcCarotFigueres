# Evidencia de l'escenari A

Data: 18 de juliol de 2026, aproximadament entre les 17:50 i les 17:53 (Europe/Madrid).

- `A1-metamask-transaction.png`: pantalla de revisio de MetaMask abans de confirmar.
- `A2-snap-insight-verdict.png`: insight del Snap amb risc BAJO, accio Permitir i font determinista.
- `A3-snap-insight-explanation.png`: continuacio de l'insight amb revisio IA, explicacio, xarxa i origen.
- Registre SQLite associat: `analysis_history.id = 43`.
- Temps total del backend: 163.239 ms.
- Resultat funcional: el Snap es va activar i va mostrar el resultat abans de confirmar.
- Limitacio: MetaMask estava connectat a Ethereum (`eip155:1`), no a Sepolia.
- Incidencia semantica observada: l'explicacio va introduir una referencia incorrecta a un permis per moure tokens en una transferencia simple. La resposta es conserva com a evidencia i el filtre semantic es va ampliar despres de la prova.
