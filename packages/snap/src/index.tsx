import type { OnRpcRequestHandler } from '@metamask/snaps-sdk';
import { Box, Text, Bold, Heading } from '@metamask/snaps-sdk/jsx';

/**
 * Crida el backend per analitzar una transacció.
 */

function formatBulletList(items: string[], maxItems = 5): string {
  if (!Array.isArray(items) || items.length === 0) {
    return 'Sense elements';
  }

  return items
    .slice(0, maxItems)
    .map((item) => `• ${item}`)
    .join('\n');
}

function renderBulletTexts(items: string[], maxItems = 5, prefix = 'item') {
  if (!Array.isArray(items) || items.length === 0) {
    return <Text>• Sense elements</Text>;
  }

  return (
    <Box>
      {items.slice(0, maxItems).map((item, index) => (
        <Text key={`${prefix}-${index}`}>• {item}</Text>
      ))}
    </Box>
  );
}

async function analyzeTransaction(txData: any) {
  try {
    const response = await fetch('http://localhost:3000/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(txData),
    });

    if (!response.ok) {
      throw new Error(`Error del backend: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error cridant el backend:', error);
    return {
      success: false,
      error: "No s'ha pogut connectar amb el backend",
      risk: 'DESCONOCIDO',
      risk_score: 0,
      issues: ["No s'ha pogut obtenir l'anàlisi del backend"],
      findings: ["No s'ha pogut obtenir l'anàlisi del backend"],
      explanation: 'Error de connexió',
      verdict: {
        risk: 'DESCONOCIDO',
        risk_score: 0,
        recommended_action: 'REVIEW',
      },
      final_verdict: {
        risk_level: 'DESCONOCIDO',
        source: 'fallback',
        reason: "No s'ha pogut obtenir el veredicte final",
      },
      ai_review: {
        ai_risk_hint: 'DESCONOCIDO',
        confidence: 'baja',
        ai_flags: [],
        reviewer_summary: "No s'ha pogut obtenir la revisió de la IA",
      },
      local_memory_signals: {
        findings: [],
      },
    };
  }
}

/**
 * Emoji segons el risc.
 */
function getRiskEmoji(risk: string): string {
  switch ((risk || '').toUpperCase()) {
    case 'BAJO':
      return '✅';
    case 'MEDIO':
      return '⚠️';
    case 'ALTO':
      return '🔴';
    default:
      return '❓';
  }
}

/**
 * Risc principal que es mostra a la interfície: prioritza el veredicte final.
 */
function getDisplayedRisk(analysis: any): string {
  return (
    analysis?.final_verdict?.risk_level ||
    analysis?.verdict?.risk ||
    analysis?.risk ||
    'DESCONOCIDO'
  );
}

function getRecommendedAction(analysis: any): string {
  const finalRisk =
    analysis?.final_verdict?.risk_level ||
    analysis?.verdict?.risk ||
    analysis?.risk ||
    'DESCONOCIDO';

  if (finalRisk === 'ALTO' || finalRisk === 'MEDIO') {
    return 'REVIEW';
  }

  if (finalRisk === 'BAJO') {
    return analysis?.verdict?.recommended_action || 'ALLOW';
  }

  return 'REVIEW';
}

function getRiskLabel(risk: string): string {
  switch ((risk || '').toUpperCase()) {
    case 'BAJO':
      return 'BAIX';
    case 'MEDIO':
      return 'MITJÀ';
    case 'ALTO':
      return 'ALT';
    case 'DESCONOCIDO':
      return 'DESCONEGUT';
    default:
      return risk || 'DESCONEGUT';
  }
}

function getActionLabel(action: string): string {
  switch ((action || '').toUpperCase()) {
    case 'ALLOW':
      return 'Permetre';
    case 'REVIEW':
      return 'Revisar amb atenció';
    case 'BLOCK':
      return 'Bloquejar';
    default:
      return 'Revisar';
  }
}

function getExplanation(analysis: any): string {
  return analysis?.explanation || 'No hi ha cap explicació disponible';
}

function getFindings(analysis: any): string[] {
  if (Array.isArray(analysis?.findings) && analysis.findings.length > 0) {
    return analysis.findings;
  }

  if (Array.isArray(analysis?.issues) && analysis.issues.length > 0) {
    return analysis.issues;
  }

  return ["No s'han detectat indicis específics"];
}

function getLocalContextFindings(analysis: any): string[] {
  if (
    Array.isArray(analysis?.local_memory_signals?.findings) &&
    analysis.local_memory_signals.findings.length > 0
  ) {
    return analysis.local_memory_signals.findings;
  }

  return [];
}

function getAiFlags(analysis: any): string[] {
  if (
    Array.isArray(analysis?.ai_review?.ai_flags) &&
    analysis.ai_review.ai_flags.length > 0
  ) {
    return analysis.ai_review.ai_flags;
  }

  return [];
}

function getAiSummary(analysis: any): string {
  return (
    analysis?.ai_review?.reviewer_summary ||
    'Sense observacions addicionals de la IA'
  );
}

function getAiConfidence(analysis: any): string {
  return analysis?.ai_review?.confidence || 'baja';
}

function getConfidenceLabel(confidence: string): string {
  switch ((confidence || '').toLowerCase()) {
    case 'baja':
    case 'baixa':
      return 'baixa';
    case 'media':
    case 'medio':
    case 'mitjana':
      return 'mitjana';
    case 'alta':
      return 'alta';
    default:
      return confidence || 'baixa';
  }
}

function getFinalReason(analysis: any): string {
  return analysis?.final_verdict?.reason || 'Sense cap motiu addicional';
}

function getFinalSource(analysis: any): string {
  return analysis?.final_verdict?.source || 'deterministic_base';
}

function splitPrimaryAndLocalFindings(analysis: any): {
  primaryFindings: string[];
  localContextFindings: string[];
} {
  const allFindings = getFindings(analysis);
  const localContextFindings = getLocalContextFindings(analysis);

  const localSet = new Set(localContextFindings);

  const primaryFindings = allFindings.filter(
    (finding: string) => !localSet.has(finding),
  );

  return {
    primaryFindings,
    localContextFindings,
  };
}

function prioritizeFindings(findings: string[]): string[] {
  const highPriority = findings.filter((finding) => {
    const text = finding.toLowerCase();

    return (
      text.includes('está etiquetada como') ||
      text.includes('està etiquetada com') ||
      text.includes('fuente de la etiqueta') ||
      text.includes("font de l'etiqueta") ||
      text.includes('riesgo crítico conocido') ||
      text.includes('risc crític conegut') ||
      text.includes('merece especial precaución') ||
      text.includes('requereix una precaució especial') ||
      text.includes('base de datos') ||
      text.includes('base de dades') ||
      text.includes('llista fosca') ||
      text.includes('darklist')
    );
  });

  const rest = findings.filter((finding) => !highPriority.includes(finding));

  return [...highPriority, ...rest];
}

function getSourceLabel(source: string): string {
  switch (source) {
    case 'deterministic_priority':
      return 'Regles deterministes prioritàries';
    case 'hybrid_escalation':
      return 'Escalat híbrid';
    case 'ai_escalation':
      return 'Escalat per revisió de la IA';
    case 'deterministic_base':
      return 'Base determinista';
    case 'fallback':
      return 'Mode alternatiu';
    default:
      return source || 'Desconegut';
  }
}

/**
 * Interfície principal d'anàlisi.
 */
function renderAnalysisCard(analysis: any, chainId: string, origin?: string) {
  const displayedRisk = getDisplayedRisk(analysis);
  const recommendedAction = getRecommendedAction(analysis);
  const explanation = getExplanation(analysis);
  const { primaryFindings, localContextFindings } =
    splitPrimaryAndLocalFindings(analysis);
  const orderedPrimaryFindings = prioritizeFindings(primaryFindings);
  const aiFlags = getAiFlags(analysis);
  const aiSummary = getAiSummary(analysis);
  const aiConfidence = getAiConfidence(analysis);
  const finalReason = getFinalReason(analysis);
  const finalSource = getFinalSource(analysis);

  return (
    <Box>
      <Heading>{getRiskEmoji(displayedRisk)} Anàlisi de seguretat</Heading>

      <Text>
        <Bold>Veredicte final:</Bold> {getRiskLabel(displayedRisk)}
      </Text>

      <Text>
        <Bold>Acció recomanada:</Bold> {getActionLabel(recommendedAction)}
      </Text>

      <Text>
        <Bold>Font del veredicte:</Bold> {getSourceLabel(finalSource)}
      </Text>

      <Text>
        <Bold>Motiu principal:</Bold> {finalReason}
      </Text>

      <Text>
        <Bold>Indicis principals:</Bold>
      </Text>
      {renderBulletTexts(orderedPrimaryFindings, 8, 'primary')}

      {localContextFindings.length > 0 ? (
        <Box>
          <Text>
            <Bold>Context local:</Bold>
          </Text>
          {renderBulletTexts(localContextFindings, 3, 'local')}
        </Box>
      ) : null}

      <Text>
        <Bold>Revisió de la IA:</Bold>
      </Text>

      <Text>{aiSummary}</Text>

      <Text>
        <Bold>Confiança de la IA:</Bold> {getConfidenceLabel(aiConfidence)}
      </Text>

      {aiFlags.length > 0 ? renderBulletTexts(aiFlags, 3, 'ai-flag') : null}

      <Text>
        <Bold>Explicació final:</Bold>
      </Text>

      <Text>{explanation}</Text>

      <Text>
        <Bold>Xarxa:</Bold> {chainId}
      </Text>

      <Text>
        <Bold>Origen:</Bold> {origin || 'Desconegut'}
      </Text>
    </Box>
  );
}

/**
 * Hook automàtic de transaccions sortints.
 */
export const onTransaction = async ({
  transaction,
  chainId,
  transactionOrigin,
}: {
  transaction: any;
  chainId: string;
  transactionOrigin?: string;
}) => {
  console.log('🔍 Interceptant una transacció real:', transaction);

  const txData = {
    type: 'transaction',
    chainId,
    from: transaction.from,
    to: transaction.to,
    value: transaction.value || '0',
    data: transaction.data || '0x',
    origin: transactionOrigin,
  };

  const analysis = await analyzeTransaction(txData);

  return {
    content: renderAnalysisCard(analysis, chainId, transactionOrigin),
  };
};

/**
 * Mètodes RPC manuals.
 */
export const onRpcRequest: OnRpcRequestHandler = async ({
  origin,
  request,
}) => {
  switch (request.method) {
    case 'hello':
      return snap.request({
        method: 'snap_dialog',
        params: {
          type: 'confirmation',
          content: (
            <Box>
              <Text>
                Hola, <Bold>{origin}</Bold>!
              </Text>
              <Text>
                Aquesta confirmació comprova la comunicació amb el Snap.
              </Text>
              <Text>La connexió funciona correctament.</Text>
            </Box>
          ),
        },
      });

    case 'analyzeTransaction': {
      const txData = (request as any).params?.transaction || {
        type: 'approve',
        contract: '0x1234...',
        amount: 'unlimited',
      };

      const analysis = await analyzeTransaction(txData);

      return snap.request({
        method: 'snap_dialog',
        params: {
          type: 'alert',
          content: renderAnalysisCard(
            analysis,
            txData.chainId || 'Desconeguda',
            origin,
          ),
        },
      });
    }

    default:
      throw new Error('Mètode no trobat.');
  }
};
