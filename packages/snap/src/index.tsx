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

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error llamando al backend:', error);
    return {
      success: false,
      error: 'No se pudo conectar con el backend',
      risk: 'DESCONOCIDO',
      explanation: 'Error de conexión',
    };
  }
}

/**
 * Obtiene el emoji según el nivel de riesgo
 */
function getRiskEmoji(risk: string): string {
  switch (risk.toUpperCase()) {
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
 * 🔥 Handle outgoing transactions - se ejecuta automáticamente
 * Este hook se activa ANTES de que el usuario confirme cualquier transacción
 */
export const onTransaction = async ({ 
  transaction, 
  chainId, 
  transactionOrigin 
}: {
  transaction: any;
  chainId: string;
  transactionOrigin?: string;
}) => {
  console.log('🔍 Interceptando transacción real:', transaction);

  // Preparar datos para el backend
  const txData = {
    type: 'transaction',
    chainId: chainId,
    from: transaction.from,
    to: transaction.to,
    value: transaction.value || '0',
    data: transaction.data || '0x',
    origin: transactionOrigin,
  };

  // Analizar con el backend
  const analysis = await analyzeTransaction(txData);

  // Mostrar insights en la interfaz de confirmación de MetaMask
  return {
    content: (
      <Box>
        <Heading>
          {getRiskEmoji(analysis.risk)} Análisis de Seguridad
        </Heading>
        
        <Text>
          <Bold>Nivel de Riesgo:</Bold> {analysis.risk}
        </Text>
        
        <Text>
          <Bold>Explicación:</Bold>
        </Text>
        <Text>{analysis.explanation}</Text>
        
        <Text>
          <Bold>Red:</Bold> {chainId}
        </Text>
        
        <Text>
          <Bold>Origen:</Bold> {transactionOrigin || 'Desconocido'}
        </Text>
      </Box>
    ),
  };
};

/**
 * Handle incoming JSON-RPC requests, sent through `wallet_invokeSnap`.
 *
 * @param args - The request handler args as object.
 * @param args.origin - The origin of the request, e.g., the website that
 * invoked the snap.
 * @param args.request - A validated JSON-RPC request object.
 * @returns The result of `snap_dialog`.
 * @throws If the request method is not valid for this snap.
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

    case 'analyzeTransaction':
      // Extraer datos de la transacción del request
      const txData = (request as any).params?.transaction || {
        type: 'approve',
        contract: '0x1234...',
        amount: 'unlimited',
      };

      // Llamar al backend
      const analysis = await analyzeTransaction(txData);

      // Mostrar resultado en MetaMask
      return snap.request({
        method: 'snap_dialog',
        params: {
          type: 'alert',
          content: (
            <Box>
              <Heading>
                {getRiskEmoji(analysis.risk)} Análisis de Seguridad
              </Heading>
              
              <Text>
                <Bold>Nivel de Riesgo:</Bold> {analysis.risk}
              </Text>
              
              <Text>
                <Bold>Explicación:</Bold>
              </Text>
              <Text>{analysis.explanation}</Text>
              
              <Text>
                <Bold>Origen:</Bold> {origin}
              </Text>
            </Box>
          ),
        },
      });

    default:
      throw new Error('Method not found.');
  }
};