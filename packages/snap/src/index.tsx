import type { OnRpcRequestHandler } from '@metamask/snaps-sdk';
import { Box, Text, Bold, Heading } from '@metamask/snaps-sdk/jsx';

/**
 * Llama al backend para analizar una transacción
 */

function formatBulletList(items: string[], maxItems = 5): string {
  if (!Array.isArray(items) || items.length === 0) {
    return 'Sin elementos';
  }

  return items
    .slice(0, maxItems)
    .map((item) => `• ${item}`)
    .join('\n');
}

function renderBulletTexts(items: string[], maxItems = 5, prefix = 'item') {
  if (!Array.isArray(items) || items.length === 0) {
    return <Text>• Sin elementos</Text>;
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
      throw new Error(`Backend error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error llamando al backend:', error);
    return {
      success: false,
      error: 'No se pudo conectar con el backend',
      risk: 'DESCONOCIDO',
      risk_score: 0,
      issues: ['No se pudo obtener análisis del backend'],
      findings: ['No se pudo obtener análisis del backend'],
      explanation: 'Error de conexión',
      verdict: {
        risk: 'DESCONOCIDO',
        risk_score: 0,
        recommended_action: 'REVIEW',
      },
      final_verdict: {
        risk_level: 'DESCONOCIDO',
        source: 'fallback',
        reason: 'No se pudo obtener veredicto final',
      },
      ai_review: {
        ai_risk_hint: 'DESCONOCIDO',
        confidence: 'baja',
        ai_flags: [],
        reviewer_summary: 'No se pudo obtener revisión IA',
      },
      local_memory_signals: {
        findings: [],
      },
    };
  }
}

/**
 * Emoji según riesgo
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
 * Riesgo principal mostrado en UI: usar el veredicto final si existe
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
  return analysis?.verdict?.recommended_action || 'REVIEW';
}

function getActionLabel(action: string): string {
  switch ((action || '').toUpperCase()) {
    case 'ALLOW':
      return 'Permitir';
    case 'REVIEW':
      return 'Revisar con cuidado';
    case 'BLOCK':
      return 'Bloquear';
    default:
      return 'Revisar';
  }
}

function getExplanation(analysis: any): string {
  return analysis?.explanation || 'No hay explicación disponible';
}

function getFindings(analysis: any): string[] {
  if (Array.isArray(analysis?.findings) && analysis.findings.length > 0) {
    return analysis.findings;
  }

  if (Array.isArray(analysis?.issues) && analysis.issues.length > 0) {
    return analysis.issues;
  }

  return ['No se detectaron hallazgos específicos'];
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
  if (Array.isArray(analysis?.ai_review?.ai_flags) && analysis.ai_review.ai_flags.length > 0) {
    return analysis.ai_review.ai_flags;
  }

  return [];
}

function getAiSummary(analysis: any): string {
  return analysis?.ai_review?.reviewer_summary || 'Sin observaciones adicionales de IA';
}

function getAiConfidence(analysis: any): string {
  return analysis?.ai_review?.confidence || 'baja';
}

function getFinalReason(analysis: any): string {
  return analysis?.final_verdict?.reason || 'Sin motivo adicional';
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

  const primaryFindings = allFindings.filter((finding: string) => !localSet.has(finding));

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
      text.includes('fuente de la etiqueta') ||
      text.includes('riesgo crítico conocido') ||
      text.includes('merece especial precaución') ||
      text.includes('base de datos') ||
      text.includes('darklist')
    );
  });

  const rest = findings.filter((finding) => !highPriority.includes(finding));

  return [...highPriority, ...rest];
}

function getSourceLabel(source: string): string {
  switch (source) {
    case 'deterministic_priority':
      return 'Reglas deterministas prioritarias';
    case 'hybrid_escalation':
      return 'Escalado híbrido';
    case 'ai_escalation':
      return 'Escalado por revisión IA';
    case 'deterministic_base':
      return 'Base determinista';
    default:
      return source || 'Desconocido';
  }
}

/**
 * UI principal de análisis
 */
function renderAnalysisCard(analysis: any, chainId: string, origin?: string) {
  const displayedRisk = getDisplayedRisk(analysis);
  const recommendedAction = getRecommendedAction(analysis);
  const explanation = getExplanation(analysis);
  const { primaryFindings, localContextFindings } = splitPrimaryAndLocalFindings(analysis);
  const orderedPrimaryFindings = prioritizeFindings(primaryFindings);
  const aiFlags = getAiFlags(analysis);
  const aiSummary = getAiSummary(analysis);
  const aiConfidence = getAiConfidence(analysis);
  const finalReason = getFinalReason(analysis);
  const finalSource = getFinalSource(analysis);

  return (
    <Box>
      <Heading>
        {getRiskEmoji(displayedRisk)} Análisis de Seguridad
      </Heading>

      <Text>
        <Bold>Veredicto final:</Bold> {displayedRisk}
      </Text>

      <Text>
        <Bold>Acción recomendada:</Bold> {getActionLabel(recommendedAction)}
      </Text>

      <Text>
        <Bold>Fuente del veredicto:</Bold> {getSourceLabel(finalSource)}
      </Text>

      <Text>
        <Bold>Motivo principal:</Bold> {finalReason}
      </Text>

      <Text>
        <Bold>Hallazgos principales:</Bold>
      </Text>
      {renderBulletTexts(primaryFindings, 8, 'primary')}

      {localContextFindings.length > 0 ? (
        <Box>
          <Text>
            <Bold>Contexto local:</Bold>
          </Text>
          {renderBulletTexts(localContextFindings, 3, 'local')}
        </Box>
      ) : null}

      <Text>
        <Bold>Revisión IA:</Bold>
      </Text>

      <Text>{aiSummary}</Text>

      <Text>
        <Bold>Confianza IA:</Bold> {aiConfidence}
      </Text>

      {aiFlags.length > 0 ? renderBulletTexts(aiFlags, 3, 'ai-flag') : null}

      <Text>
        <Bold>Explicación final:</Bold>
      </Text>

      <Text>{explanation}</Text>

      <Text>
        <Bold>Red:</Bold> {chainId}
      </Text>

      <Text>
        <Bold>Origen:</Bold> {origin || 'Desconocido'}
      </Text>
    </Box>
  );
}

/**
 * Hook automático de transacciones salientes
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
  console.log('🔍 Interceptando transacción real:', transaction);

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
 * Métodos RPC manuales
 */
export const onRpcRequest: OnRpcRequestHandler = async ({ origin, request }) => {
  switch (request.method) {
    case 'hello':
      return snap.request({
        method: 'snap_dialog',
        params: {
          type: 'confirmation',
          content: (
            <Box>
              <Text>
                Hello, <Bold>{origin}</Bold>!
              </Text>
              <Text>
                This custom confirmation is just for display purposes.
              </Text>
              <Text>
                But you can edit the snap source code to make it do something,
                if you want to!
              </Text>
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
            txData.chainId || 'Desconocida',
            origin,
          ),
        },
      });
    }

    default:
      throw new Error('Method not found.');
  }
};