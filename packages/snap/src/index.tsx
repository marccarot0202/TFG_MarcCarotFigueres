import type { OnRpcRequestHandler } from '@metamask/snaps-sdk';
import { Box, Text, Bold, Heading } from '@metamask/snaps-sdk/jsx';

/**
 * Llama al backend para analizar una transacción
 */
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
    };
  }
}

/**
 * Obtiene el emoji según el nivel de riesgo
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
 * Normaliza el riesgo desde la respuesta del backend
 */
function getRisk(analysis: any): string {
  return analysis?.risk || analysis?.verdict?.risk || 'DESCONOCIDO';
}

/**
 * Obtiene la acción recomendada
 */
function getRecommendedAction(analysis: any): string {
  return analysis?.verdict?.recommended_action || 'REVIEW';
}

/**
 * Obtiene la explicación
 */
function getExplanation(analysis: any): string {
  return analysis?.explanation || 'No hay explicación disponible';
}

/**
 * Obtiene la lista de hallazgos
 */
function getFindings(analysis: any): string[] {
  if (Array.isArray(analysis?.findings) && analysis.findings.length > 0) {
    return analysis.findings;
  }

  if (Array.isArray(analysis?.issues) && analysis.issues.length > 0) {
    return analysis.issues;
  }

  return ['No se detectaron hallazgos específicos'];
}

/**
 * Traduce la acción recomendada a texto humano
 */
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

/**
 * Renderiza la tarjeta de análisis
 */
function renderAnalysisCard(analysis: any, chainId: string, origin?: string) {
  const risk = getRisk(analysis);
  const findings = getFindings(analysis);
  const explanation = getExplanation(analysis);
  const recommendedAction = getRecommendedAction(analysis);

  return (
    <Box>
      <Heading>
        {getRiskEmoji(risk)} Análisis de Seguridad
      </Heading>

      <Text>
        <Bold>Nivel de Riesgo:</Bold> {risk}
      </Text>

      <Text>
        <Bold>Acción recomendada:</Bold> {getActionLabel(recommendedAction)}
      </Text>

      <Text>
        <Bold>Hallazgos:</Bold>
      </Text>

      <Box>
        {findings.map((finding: string, index: number) => (
          <Text key={`finding-${index}`}>• {finding}</Text>
        ))}
      </Box>

      <Text>
        <Bold>Explicación:</Bold>
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
 * 🔥 Handle outgoing transactions - se ejecuta automáticamente
 * Este hook se activa ANTES de que el usuario confirme cualquier transacción
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
 * Handle incoming JSON-RPC requests, sent through `wallet_invokeSnap`.
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