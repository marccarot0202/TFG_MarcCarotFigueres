# Evidencia de l'escenari H

Data: 18 de juliol de 2026.

## Prova amb Ollama no disponible

Es va tancar unicament el servei Ollama i es va iniciar una transaccio de prova des de la DApp. La DApp va continuar responent amb HTTP 200 i el backend seguia accessible, pero el seu endpoint `/health` va retornar 503 per indicar la indisponibilitat d'Ollama.

La peticio `/analyze` va acabar amb HTTP 500. MetaMask no va quedar bloquejat i el Snap va mostrar un resultat fallback controlat:

- veredicte `DESCONOCIDO`;
- accio `Revisar con cuidado`;
- font `fallback`;
- finding `No se pudo obtener analisis del backend`;
- explicacio `Error de conexion`.

La prova es valora com a parcialment complerta: la cartera va informar de l'error i va permetre cancel.lar l'operacio, pero el backend no va conservar el veredicte determinista. La causa es va localitzar en la generacio de l'explicacio, que no capturava l'error de connexio de la segona consulta a Ollama. Despres de la prova es va afegir un fallback local per generar una explicacio segura sense IA.

Captura: `H1-ollama-off-snap-fallback.png`.

## Repeticio despres de la correccio

Despres d'afegir el fallback local a la generacio de l'explicacio, es va reiniciar l'entorn, es va aturar novament Ollama i es va repetir la mateixa operacio. El resultat va quedar desat com a registre SQLite 48:

- risc determinista i final `BAJO`;
- puntuacio 10;
- accio `ALLOW`;
- revisio IA amb confianca baixa i `raw_response: null`;
- explicacio local coherent amb una transferencia simple;
- temps total del backend: 93 ms.

El sistema va conservar el resultat determinista, va informar que no hi havia observacions addicionals de la IA i va permetre gestionar la transaccio sense bloqueig. Aquesta repeticio verifica la correccio del problema observat a la primera prova.

Captures:

- `H2-ollama-off-deterministic-verdict.png`.
- `H3-ollama-off-local-fallback.png`.
