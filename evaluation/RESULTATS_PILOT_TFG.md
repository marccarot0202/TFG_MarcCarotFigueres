# Resultats pilot de l'avaluacio

Data d'execucio: 17 de juliol de 2026.

## Abast i limitacions

S'ha executat una prova pilot amb una repeticio independent per a cadascun dels set casos quantificables A1, B1, B2, C1, D1, D2 i E1. Aquesta execucio permet aportar resultats preliminars reals, pero no substitueix el protocol de deu repeticions descrit a la memoria. Per tant, les metriques s'han d'identificar com a resultats pilot i no com a resultats definitius generalitzables.

Les operacions s'han enviat directament a l'endpoint local `/analyze` per validar el motor determinista, la revisio de la IA, la fusio dels veredictes i la persistencia. Aquesta prova no valida per si sola la interceptacio visual del Snap dins de MetaMask. Els escenaris A i G encara requereixen captures manuals de MetaMask i, en el cas de G, una operacio real a Sepolia. La part de tolerancia a errors de l'escenari H tampoc s'ha executat.

## Entorn d'execucio

| Element | Configuracio utilitzada |
|---|---|
| Processador | AMD Ryzen 7 3700U with Radeon Vega Mobile Gfx |
| Memoria RAM | 13,9 GB disponibles segons el sistema |
| Targeta grafica | AMD Radeon RX Vega 10 Graphics |
| Sistema operatiu | Microsoft Windows 10 Home 10.0.19045 |
| Navegador | Google Chrome 149.0.7827.200 |
| Node.js | v20.11.1 |
| npm | 10.2.4 |
| Backend | Servei local al port 3000 |
| Base de dades | SQLite local |
| Ollama | 0.16.1, servei local al port 11434 |
| Model | llama3.2:latest |
| DApp | Gatsby, servei local al port 8000 |
| MetaMask Flask | 13.39.2-flask.0 (development build) |

## Resultats per cas

| Cas | Operacio | Classe real | Determinista | Puntuacio | Revisio IA | Final | Resultat | Temps backend |
|---|---|---|---|---:|---|---|---|---:|
| A1 | Transaccio simple sense indicadors | Negativa | BAJO | 10 | BAJO | BAJO | VN | 163.664 ms |
| B1 | Aprovacio ERC20 limitada | Negativa | BAJO | 20 | BAJO | BAJO | VN | 164.189 ms |
| B2 | Revocacio ERC20 amb `approve(spender, 0)` | Negativa | BAJO | 5 | BAJO | BAJO | VN | 162.262 ms |
| C1 | Aprovacio ERC20 amb `MaxUint256` | Positiva | ALTO | 90 | ALTO | ALTO | VP | 169.892 ms |
| D1 | `setApprovalForAll(operator, true)` | Positiva | ALTO | 95 | ALTO | ALTO | VP | 135.419 ms |
| D2 | `setApprovalForAll(operator, false)` | Negativa | BAJO | 5 | BAJO | BAJO | VN | 168.847 ms |
| E1 | Interaccio amb una adreca etiquetada com a `scam` | Positiva | ALTO | 60 | ALTO | ALTO | VP | 142.504 ms |

Els registres complets corresponen als identificadors 35 a 41 de `analysis_history`. La resposta estructurada completa i els camps de rendiment es conserven a SQLite i al fitxer JSON de l'execucio.

## Matriu de confusio pilot

| | Prediccio positiva | Prediccio negativa |
|---|---:|---:|
| Classe real positiva | VP = 3 | FN = 0 |
| Classe real negativa | FP = 0 | VN = 4 |

| Metrica | Resultat pilot |
|---|---:|
| Exactitud | 1,00 (100 %) |
| Precisio | 1,00 (100 %) |
| Sensibilitat o recall | 1,00 (100 %) |
| Especificitat | 1,00 (100 %) |
| F1 | 1,00 (100 %) |

Aquest resultat mostra que el prototip va classificar correctament els set casos controlats de l'execucio pilot. La mida reduida de la mostra i l'us d'una sola repeticio per cas impedeixen interpretar el 100 % com una estimacio general del rendiment del sistema davant de transaccions Web3 no contemplades.

## Rendiment pilot

| Mesura | Temps |
|---|---:|
| Minim | 135.419 ms (135,4 s) |
| Maxim | 169.892 ms (169,9 s) |
| Mitjana | 158.111 ms (158,1 s) |

La persistencia a SQLite representa una part molt petita del temps total. La major part de la latencia correspon a les dues consultes consecutives al model local: la revisio de risc i la generacio de l'explicacio. El sistema completa el flux sense errors, pero una espera mitjana superior als dos minuts no es pot considerar fluida. En aquesta configuracio, RNF1 s'ha de valorar com a parcialment complert i assenyalar l'optimitzacio de les consultes a Ollama com a treball futur.

## Resultats observats dels escenaris

- **Escenari A, parcialment validat.** El 18 de juliol de 2026 MetaMask va activar el Snap i va mostrar l'insight abans de confirmar. El registre 43 va obtenir risc baix, puntuacio 10 i accio `ALLOW`. L'execucio es va fer accidentalment a Ethereum (`eip155:1`) en lloc de Sepolia, de manera que conve repetir-la a la xarxa de proves per complir estrictament el protocol.
- **Escenari B, complert en el pilot.** L'aprovacio limitada va obtenir risc baix amb puntuacio 20, mentre que la revocacio va obtenir risc baix amb puntuacio 5. El sistema va identificar correctament el destinatari i la quantitat.
- **Escenari C, complert en el pilot.** `approve(spender, MaxUint256)` es va identificar com una aprovacio il.limitada, amb risc alt, puntuacio 90 i recomanacio de revisio.
- **Escenari D, complert en el pilot.** L'activacio del permis global va obtenir risc alt i puntuacio 95; la revocacio va obtenir risc baix i puntuacio 5.
- **Escenari E, complert en el pilot.** La direccio controlada etiquetada com a `scam` es va incorporar als findings i va forcar un veredicte de risc alt.
- **Escenari F, parcialment validat.** Les explicacions i revisions es van generar i es van conservar. En l'execucio manual 43, la IA va descriure correctament una transferencia simple, pero va afegir una frase incorrecta sobre un permis per moure tokens. La incidencia es va conservar com a evidencia i va motivar l'ampliacio posterior del filtre semantic.
- **Escenari G, complert.** Es va iniciar un `approve` limitat des d'Etherscan, MetaMask va activar el Snap abans de confirmar, el backend el va registrar com a analisi 46 i la transaccio es va confirmar a Sepolia amb el hash `0x1246bec06978358d97cdaa1de079d6b2c01cea5a2053f61335e53d2b4a988d9c`.
- **Escenari H, complert per a la indisponibilitat d'Ollama.** Amb els serveis actius es van mesurar temps entre 135,4 i 169,9 segons. La primera prova amb Ollama aturat va revelar un HTTP 500 en la generacio de l'explicacio, mentre el Snap mostrava un fallback controlat. Despres de corregir-lo, la repeticio va conservar el veredicte determinista `BAJO`, va generar una explicacio local segura i va completar el backend en 93 ms. El registre corresponent es el 48.

## Valoracio preliminar dels requisits

| Requisit | Estat pilot | Justificacio breu |
|---|---|---|
| RF1 | Parcialment complert | El backend rep i analitza operacions; falta evidencia visual de la interceptacio automatica del Snap. |
| RF2 | Complert dins del pilot | Els patrons B1, B2, C1, D1, D2 i E1 es diferencien correctament. |
| RF3 | Complert dins del pilot | Es generen explicacions i s'apliquen controls semantics coherents amb els fets. |
| RF4 | Parcialment complert | La integracio existeix, pero falta incorporar la captura final de MetaMask com a evidencia. |
| RNF1 | Parcialment complert | El flux acaba sense errors, pero la mitjana de 158,1 s no es fluida. |
| RNF2 | Complert dins de l'abast revisat | Backend, SQLite i Ollama s'executen localment. |
| RNF3 | Complert per a Ollama | El Snap informa de la indisponibilitat, no bloqueja la gestio i, despres de la correccio, el backend conserva el veredicte determinista sense dependre de la IA. |
| RNF4 | Complert | Les capes de descodificacio, regles, memoria, IA i persistencia estan separades. |
| RNF5 | Parcialment complert | La informacio es comprensible, pero el temps d'espera perjudica l'experiencia. |

## Evidencia generada

- Informe estructurat: `evaluation/results/evaluation-1x-2026-07-17T10-03-04-812Z.json`.
- Registres SQLite: analisis 35, 36, 37, 38, 39, 40 i 41.
- Evidencia manual de l'escenari A: `evaluation/evidence/scenario-a/` i registre SQLite 43.
- Evidencia manual B1 des d'Etherscan Sepolia: `evaluation/evidence/scenario-b/B1-limited-approval/` i registre SQLite 45.
- Versio de MetaMask Flask: `evaluation/evidence/environment/metamask-flask-version.png`.
- Evidencia del flux complet a Sepolia: `evaluation/evidence/scenario-g/` i registre SQLite 46.
- Evidencia d'indisponibilitat d'Ollama: `evaluation/evidence/scenario-h/`.
- Pilot diagnostic anterior a la correccio semantica: `evaluation/results/evaluation-1x-2026-07-17T09-26-24-486Z.json`. No s'ha d'utilitzar com a resultat final, pero documenta el problema de falsos positius detectat durant la preparacio.
