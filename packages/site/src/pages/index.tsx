import { useEffect, useState } from 'react';
import styled from 'styled-components';

import {
  ConnectButton,
  InstallFlaskButton,
  ReconnectButton,
  SendHelloButton,
  AnalyzeButton,
  Card,
} from '../components';

import { defaultSnapOrigin } from '../config';

import {
  useMetaMask,
  useInvokeSnap,
  useMetaMaskContext,
  useRequestSnap,
} from '../hooks';

import { isLocalSnap, shouldDisplayReconnectButton } from '../utils';

///////////////////////////////////TIPOS//////////////////////////////////////////

type ServiceStatus = {
  status: 'ok' | 'error';
  message: string;
};

type HealthResponse = {
  backend: ServiceStatus;
  database: ServiceStatus;
  ollama: ServiceStatus;
  timestamp: string;
};

type DashboardStats = {
  total_analysis: number;
  low_risk: number;
  medium_risk: number;
  high_risk: number;
  known_addresses: number;
  cached_addresses: number;
};

type StatsResponse = {
  success: boolean;
  stats: DashboardStats;
  timestamp: string;
};

type AnalysisHistoryItem = {
  id: number;
  created_at?: number;
  chain_id?: string;
  from_address?: string;
  to_address?: string;
  method_selector?: string;
  decoded_method?: string;
  risk_level?: string;
  risk_score?: number;
  recommended_action?: string;
  origin?: string;
  explanation?: string;
};

type AnalysisHistoryResponse = {
  success: boolean;
  history: AnalysisHistoryItem[];
  timestamp: string;
};

type KnownAddressItem = {
  id: number;
  address: string;
  label?: string;
  type?: string;
  source?: string;
  added?: number;
};

type KnownAddressesResponse = {
  success: boolean;
  addresses: KnownAddressItem[];
  timestamp: string;
};

type ManualReportResponse = {
  success: boolean;
  message?: string;
  error?: string;
};

type MetricItem = {
  label: string;
  count: number;
};

type DashboardMetrics = {
  risk_distribution: MetricItem[];
  method_distribution: MetricItem[];
};

type DashboardMetricsResponse = {
  success: boolean;
  metrics: DashboardMetrics;
  timestamp: string;
};

/////////////////////////////////////////////////////////////////////////////////



////////////////////////////////ESTILOS//////////////////////////////////////////

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  margin-top: 7.6rem;
  margin-bottom: 7.6rem;
  ${({ theme }) => theme.mediaQueries.small} {
    padding-left: 2.4rem;
    padding-right: 2.4rem;
    margin-top: 2rem;
    margin-bottom: 2rem;
    width: auto;
  }
`;

const Heading = styled.h1`
  margin-top: 0;
  margin-bottom: 2.4rem;
  text-align: center;
`;

const Span = styled.span`
  color: ${(props) => props.theme.colors.primary?.default};
`;

const Subtitle = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.large};
  font-weight: 500;
  margin-top: 0;
  margin-bottom: 0;
  ${({ theme }) => theme.mediaQueries.small} {
    font-size: ${({ theme }) => theme.fontSizes.text};
  }
`;

const CardContainer = styled.div`
  width: 100%;
`;

const Notice = styled.div`
  background-color: ${({ theme }) => theme.colors.background?.alternative};
  border: 1px solid ${({ theme }) => theme.colors.border?.default};
  color: ${({ theme }) => theme.colors.text?.alternative};
  border-radius: ${({ theme }) => theme.radii.default};
  padding: 2.4rem;
  margin-top: 2.4rem;
  max-width: 60rem;
  width: 100%;

  & > * {
    margin: 0;
  }
  ${({ theme }) => theme.mediaQueries.small} {
    margin-top: 1.2rem;
    padding: 1.6rem;
  }
`;

const ErrorMessage = styled.div`
  background-color: ${({ theme }) => theme.colors.error?.muted};
  border: 1px solid ${({ theme }) => theme.colors.error?.default};
  color: ${({ theme }) => theme.colors.error?.alternative};
  border-radius: ${({ theme }) => theme.radii.default};
  padding: 2.4rem;
  margin-bottom: 2.4rem;
  margin-top: 2.4rem;
  max-width: 60rem;
  width: 100%;
  ${({ theme }) => theme.mediaQueries.small} {
    padding: 1.6rem;
    margin-bottom: 1.2rem;
    margin-top: 1.2rem;
    max-width: 100%;
  }
`;

const DashboardWrapper = styled.div`
  width: 100%;
  max-width: 110rem;
  margin-top: 2.4rem;
`;

const DashboardTitle = styled.h2`
  margin: 0 0 1.6rem 0;
  font-size: ${({ theme }) => theme.fontSizes.large};
`;

const StatusGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1.6rem;
  width: 100%;

  ${({ theme }) => theme.mediaQueries.small} {
    grid-template-columns: 1fr;
  }
`;

const StatusCard = styled.div`
  background-color: ${({ theme }) => theme.colors.background?.alternative};
  border: 1px solid ${({ theme }) => theme.colors.border?.default};
  border-radius: ${({ theme }) => theme.radii.default};
  padding: 1.6rem;
`;

const StatusHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.8rem;
  font-weight: 700;
  margin-bottom: 0.8rem;
`;

const StatusDot = styled.span<{ $status: 'ok' | 'error' }>`
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  background-color: ${({ $status }) =>
    $status === 'ok' ? '#22c55e' : '#ef4444'};
`;

const StatusMessage = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.colors.text?.alternative};
  font-size: ${({ theme }) => theme.fontSizes.small};
`;

const DashboardActions = styled.div`
  display: flex;
  gap: 1.2rem;
  margin-top: 1.6rem;
  flex-wrap: wrap;
`;

const SmallButton = styled.button`
  border: 1px solid ${({ theme }) => theme.colors.border?.default};
  background-color: ${({ theme }) => theme.colors.background?.alternative};
  color: ${({ theme }) => theme.colors.text?.default};
  border-radius: ${({ theme }) => theme.radii.default};
  padding: 0.9rem 1.4rem;
  cursor: pointer;
  font-weight: 700;

  &:hover {
    opacity: 0.85;
  }
`;

const LastCheck = styled.p`
  margin: 1.2rem 0 0 0;
  color: ${({ theme }) => theme.colors.text?.alternative};
  font-size: ${({ theme }) => theme.fontSizes.small};
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 1.2rem;
  width: 100%;
  margin-top: 2.4rem;

  ${({ theme }) => theme.mediaQueries.small} {
    grid-template-columns: 1fr 1fr;
  }
`;

const HistorySection = styled.div`
  width: 100%;
  margin-top: 2.4rem;
`;

const TableWrapper = styled.div`
  width: 100%;
  overflow-x: auto;
  background-color: ${({ theme }) => theme.colors.background?.alternative};
  border: 1px solid ${({ theme }) => theme.colors.border?.default};
  border-radius: ${({ theme }) => theme.radii.default};
`;

const HistoryTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  min-width: 90rem;
`;

const TableHead = styled.thead`
  background-color: ${({ theme }) => theme.colors.background?.default};
`;

const TableHeader = styled.th`
  text-align: left;
  padding: 1.2rem;
  font-size: ${({ theme }) => theme.fontSizes.small};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border?.default};
`;

const TableCell = styled.td`
  padding: 1.2rem;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border?.default};
  font-size: ${({ theme }) => theme.fontSizes.small};
  vertical-align: top;
`;

const RiskBadge = styled.span<{ $risk: string }>`
  display: inline-block;
  padding: 0.4rem 0.8rem;
  border-radius: 999px;
  font-weight: 700;
  font-size: 1.2rem;
  background-color: ${({ $risk }) => {
    if ($risk === 'ALTO') return '#7f1d1d';
    if ($risk === 'MEDIO') return '#78350f';
    if ($risk === 'BAJO') return '#14532d';
    return '#374151';
  }};
  color: white;
`;

const EmptyState = styled.div`
  padding: 1.6rem;
  color: ${({ theme }) => theme.colors.text?.alternative};
`;

const StatCard = styled.div`
  background-color: ${({ theme }) => theme.colors.background?.alternative};
  border: 1px solid ${({ theme }) => theme.colors.border?.default};
  border-radius: ${({ theme }) => theme.radii.default};
  padding: 1.6rem;
`;

const StatValue = styled.div`
  font-size: 2.4rem;
  font-weight: 800;
  margin-bottom: 0.4rem;
`;

const StatLabel = styled.div`
  color: ${({ theme }) => theme.colors.text?.alternative};
  font-size: ${({ theme }) => theme.fontSizes.small};
`;

const QuickActionsSection = styled.div`
  width: 100%;
  max-width: 110rem;
  margin-top: 3.2rem;
`;

const QuickActionsHeader = styled.div`
  margin-bottom: 1.6rem;
`;

const QuickActionsTitle = styled.h2`
  margin: 0;
  font-size: ${({ theme }) => theme.fontSizes.large};
`;

const QuickActionsDescription = styled.p`
  margin: 0.8rem 0 0 0;
  color: ${({ theme }) => theme.colors.text?.alternative};
`;

const QuickActionsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.6rem;
  width: 100%;

  ${({ theme }) => theme.mediaQueries.small} {
    grid-template-columns: 1fr;
  }
`;

const KnownAddressesSection = styled.div`
  width: 100%;
  margin-top: 2.4rem;
`;

const FilterBar = styled.div`
  display: flex;
  gap: 1.2rem;
  flex-wrap: wrap;
  margin-bottom: 1.2rem;
`;

const SearchInput = styled.input`
  flex: 1;
  min-width: 24rem;
  border: 1px solid ${({ theme }) => theme.colors.border?.default};
  background-color: ${({ theme }) => theme.colors.background?.alternative};
  color: ${({ theme }) => theme.colors.text?.default};
  border-radius: ${({ theme }) => theme.radii.default};
  padding: 0.9rem 1.2rem;
`;

const SelectInput = styled.select`
  border: 1px solid ${({ theme }) => theme.colors.border?.default};
  background-color: ${({ theme }) => theme.colors.background?.alternative};
  color: ${({ theme }) => theme.colors.text?.default};
  border-radius: ${({ theme }) => theme.radii.default};
  padding: 0.9rem 1.2rem;
`;

const ManualReportSection = styled.div`
  width: 100%;
  margin-top: 2.4rem;
`;

const FormGrid = styled.div`
  display: grid;
  grid-template-columns: 2fr 2fr 1fr;
  gap: 1.2rem;
  width: 100%;

  ${({ theme }) => theme.mediaQueries.small} {
    grid-template-columns: 1fr;
  }
`;

const FormMessage = styled.div<{ $success: boolean }>`
  margin-top: 1.2rem;
  padding: 1.2rem;
  border-radius: ${({ theme }) => theme.radii.default};
  border: 1px solid ${({ $success }) => ($success ? '#22c55e' : '#ef4444')};
  color: ${({ $success }) => ($success ? '#22c55e' : '#ef4444')};
`;

const ChartsSection = styled.div`
  width: 100%;
  margin-top: 2.4rem;
`;

const ChartsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.6rem;
  width: 100%;

  ${({ theme }) => theme.mediaQueries.small} {
    grid-template-columns: 1fr;
  }
`;

const ChartCard = styled.div`
  background-color: ${({ theme }) => theme.colors.background?.alternative};
  border: 1px solid ${({ theme }) => theme.colors.border?.default};
  border-radius: ${({ theme }) => theme.radii.default};
  padding: 1.6rem;
`;

const ChartTitle = styled.h3`
  margin: 0 0 1.4rem 0;
`;

const BarRow = styled.div`
  margin-bottom: 1.2rem;
`;

const BarHeader = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 1.2rem;
  margin-bottom: 0.4rem;
  font-size: ${({ theme }) => theme.fontSizes.small};
`;

const BarTrack = styled.div`
  width: 100%;
  height: 1rem;
  border-radius: 999px;
  background-color: ${({ theme }) => theme.colors.background?.default};
  overflow: hidden;
`;

const BarFill = styled.div<{ $width: number }>`
  width: ${({ $width }) => `${$width}%`};
  height: 100%;
  border-radius: 999px;
  background-color: ${({ theme }) => theme.colors.primary?.default || '#0376c9'};
`;

const ChartEmptyState = styled.div`
  color: ${({ theme }) => theme.colors.text?.alternative};
  font-size: ${({ theme }) => theme.fontSizes.small};
`;

//////////////////////////////////////////////////////////////////////////////////


////////////////////////////ESTADOS DENTRO DE INDEX///////////////////////////////

const Index = () => {
  const { error } = useMetaMaskContext();
  const { isFlask, snapsDetected, installedSnap } = useMetaMask();
  const requestSnap = useRequestSnap();
  const invokeSnap = useInvokeSnap();

  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [isLoadingHealth, setIsLoadingHealth] = useState(false);

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  const [history, setHistory] = useState<AnalysisHistoryItem[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const [knownAddresses, setKnownAddresses] = useState<KnownAddressItem[]>([]);
  const [knownAddressesError, setKnownAddressesError] = useState<string | null>(null);
  const [isLoadingKnownAddresses, setIsLoadingKnownAddresses] = useState(false);
  const [knownAddressSearch, setKnownAddressSearch] = useState('');
  const [knownAddressType, setKnownAddressType] = useState('all');


  const [manualAddress, setManualAddress] = useState('');
  const [manualLabel, setManualLabel] = useState('');
  const [manualType, setManualType] = useState('warning');
  const [manualReportMessage, setManualReportMessage] = useState<string | null>(null);
  const [manualReportSuccess, setManualReportSuccess] = useState(false);
  const [isSubmittingManualReport, setIsSubmittingManualReport] = useState(false);


  const [dashboardMetrics, setDashboardMetrics] =
    useState<DashboardMetrics | null>(null);
  const [dashboardMetricsError, setDashboardMetricsError] =
    useState<string | null>(null);
  const [isLoadingDashboardMetrics, setIsLoadingDashboardMetrics] =
    useState(false);

/////////////////////////////FUNCIONES///////////////////////////////////////////

  const loadHealth = async () => {
    try {
      setIsLoadingHealth(true);

      const response = await fetch('http://localhost:3000/health');
      const data = await response.json();

      setHealth(data);
      setHealthError(null);
    } catch (loadError) {
      console.error('Error consultant /health:', loadError);
      setHealth(null);
      setHealthError('No si ha pogut conectar amb el backend');
    } finally {
      setIsLoadingHealth(false);
    }
  };

  const loadStats = async () => {
    try {
        setIsLoadingStats(true);

        const response = await fetch('http://localhost:3000/stats');
        const data: StatsResponse = await response.json();

        if (!data.success) {
          throw new Error('Resposta invàlida de /stats');
        }

        setStats(data.stats);
        setStatsError(null);
      } catch (loadError) {
        console.error('Error consultant /stats:', loadError);
        setStats(null);
        setStatsError('No si han pogut carregar les estadístiques');
      } finally {
        setIsLoadingStats(false);
      }
  };

  const loadHistory = async () => {
    try {
      setIsLoadingHistory(true);

      const response = await fetch('http://localhost:3000/analysis-history?limit=10');
      const data: AnalysisHistoryResponse = await response.json();

      if (!data.success) {
        throw new Error('Respuesta inválida de /analysis-history');
      }

      setHistory(data.history || []);
      setHistoryError(null);
    } catch (loadError) {
      console.error('Error consultando /analysis-history:', loadError);
      setHistory([]);
      setHistoryError('No se pudo cargar el histórico de análisis');
    } finally {
      setIsLoadingHistory(false);
    }
  };

const loadKnownAddresses = async () => {
  try {
    setIsLoadingKnownAddresses(true);

    const params = new URLSearchParams();
    params.set('limit', '20');

    if (knownAddressType && knownAddressType !== 'all') {
      params.set('type', knownAddressType);
    }

    if (knownAddressSearch.trim()) {
      params.set('search', knownAddressSearch.trim());
    }

    const response = await fetch(
      `http://localhost:3000/known-addresses?${params.toString()}`,
    );

    const data: KnownAddressesResponse = await response.json();

    if (!data.success) {
      throw new Error('Resposta invàlida de /known-addresses');
    }

    setKnownAddresses(data.addresses || []);
    setKnownAddressesError(null);
  } catch (loadError) {
    console.error('Error consultant /known-addresses:', loadError);
    setKnownAddresses([]);
    setKnownAddressesError('No s’han pogut carregar les direccions conegudes');
  } finally {
    setIsLoadingKnownAddresses(false);
  }
};

const loadDashboardMetrics = async () => {
  try {
    setIsLoadingDashboardMetrics(true);

    const response = await fetch('http://localhost:3000/dashboard-metrics');
    const data: DashboardMetricsResponse = await response.json();

    if (!data.success) {
      throw new Error('Resposta invàlida de /dashboard-metrics');
    }

    setDashboardMetrics(data.metrics);
    setDashboardMetricsError(null);
  } catch (loadError) {
    console.error('Error consultant /dashboard-metrics:', loadError);
    setDashboardMetrics(null);
    setDashboardMetricsError('No s’han pogut carregar els gràfics del dashboard');
  } finally {
    setIsLoadingDashboardMetrics(false);
  }
};


const submitManualReport = async () => {
  try {
    setIsSubmittingManualReport(true);
    setManualReportMessage(null);

    const response = await fetch('http://localhost:3000/known-addresses/manual', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        address: manualAddress,
        label: manualLabel,
        type: manualType,
      }),
    });

    const data: ManualReportResponse = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'No s’ha pogut guardar el reporte manual');
    }

    setManualReportSuccess(true);
    setManualReportMessage('Direcció afegida correctament al dataset local.');

    setManualAddress('');
    setManualLabel('');
    setManualType('warning');

    loadKnownAddresses();
    loadStats();
  } catch (submitError) {
    console.error('Error enviant reporte manual:', submitError);

    setManualReportSuccess(false);
    setManualReportMessage(
      submitError instanceof Error
        ? submitError.message
        : 'Error desconegut enviant el reporte manual',
    );
  } finally {
    setIsSubmittingManualReport(false);
  }
};

  useEffect(() => {
    loadHealth();
    loadStats();
    loadHistory();
    loadKnownAddresses();
    loadDashboardMetrics();
  }, []);

  const shortenAddress = (address?: string) => {
  if (!address) {
    return '—';
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatHistoryDate = (timestamp?: number) => {
    if (!timestamp) {
      return '—';
    }

    const date = new Date(timestamp < 1000000000000 ? timestamp * 1000 : timestamp);

    return date.toLocaleString();
  };

  const getMethodLabel = (item: AnalysisHistoryItem) => {
    return item.decoded_method || item.method_selector || 'desconocido';
  };

  const renderStatusCard = (
    title: string,
    service?: ServiceStatus,
    fallbackMessage = 'Sense informació',
  ) => {
    const status = service?.status || 'error';
    const message = service?.message || fallbackMessage;

    return (
      <StatusCard>
        <StatusHeader>
          <StatusDot $status={status} />
          <span>{title}</span>
        </StatusHeader>
        <StatusMessage>{message}</StatusMessage>
      </StatusCard>
    );
  };

  const renderStatCard = (label: string, value?: number) => {
      return (
        <StatCard>
          <StatValue>{value ?? 0}</StatValue>
          <StatLabel>{label}</StatLabel>
        </StatCard>
      );
    };

  const isMetaMaskReady = isLocalSnap(defaultSnapOrigin)
    ? isFlask
    : snapsDetected;

  const handleSendHelloClick = async () => {
    await invokeSnap({ method: 'hello' });
  };

  // Handler para analizar transacciones con IA
  const handleAnalyzeTransaction = async () => {
    await invokeSnap({ 
      method: 'analyzeTransaction',
      params: {
        transaction: {
          type: 'approve',
          contract: '0x1234567890abcdef',
          amount: 'unlimited',
        },
      },
    });
  };

  // 🔥 Simular transacción real para probar onTransaction
  const handleSendTransaction = async () => {
    try {
      // Obtener la cuenta actual
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      }) as string[];

      if (!accounts || accounts.length === 0) {
        console.error('No accounts found');
        return;
      }

      const from = accounts[0];

      // Enviar transacción de prueba (0 ETH a dirección nula)
      await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{
          from: from,
          to: '0x0000000000000000000000000000000000000000',
          value: '0x0', // 0 ETH
          data: '0x', // Sin datos
        }],
      });
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const renderBarChart = (items: MetricItem[] = []) => {
    const maxValue = Math.max(...items.map((item) => item.count), 0);

    if (!items.length || maxValue === 0) {
      return <ChartEmptyState>No hi ha dades suficients.</ChartEmptyState>;
    }

    return items.map((item) => {
      const width = Math.round((item.count / maxValue) * 100);

      return (
        <BarRow key={item.label}>
          <BarHeader>
            <span>{item.label || 'desconegut'}</span>
            <strong>{item.count}</strong>
          </BarHeader>
          <BarTrack>
            <BarFill $width={width} />
          </BarTrack>
        </BarRow>
      );
    });
  };

//////////////////////////////////////////////////////////////////////////////////

  return (
    <Container>
      <Heading>
        Assistent de <Span>Seguretat Web3</Span>
      </Heading>
      <Subtitle>
        Panell local de monitorització, anàlisi i suport per al Snap.
      </Subtitle>
          <DashboardWrapper>
      <DashboardTitle>Estat del sistema</DashboardTitle>

      {healthError ? (
        <ErrorMessage>
          <b>Backend desconectat:</b> {healthError}
        </ErrorMessage>
      ) : null}

      <StatusGrid>
        {renderStatusCard(
          'Backend',
          health?.backend,
          isLoadingHealth ? 'Comprovant backend...' : 'Sense resposta',
        )}

        {renderStatusCard(
          'Base de dades',
          health?.database,
          isLoadingHealth ? 'Comprovant base de dades...' : 'Sense resposta',
        )}

        {renderStatusCard(
          'Ollama',
          health?.ollama,
          isLoadingHealth ? 'Comprovant Ollama...' : 'Sense resposta',
        )}
      </StatusGrid>
      
      <DashboardTitle style={{ marginTop: '2.4rem' }}>
        Resum local
      </DashboardTitle>

      {statsError ? (
        <ErrorMessage>
          <b>Error carregant estadístiques:</b> {statsError}
        </ErrorMessage>
      ) : null}

      <StatsGrid>
        {renderStatCard('Anàlisis totals', stats?.total_analysis)}
        {renderStatCard('Risc baix', stats?.low_risk)}
        {renderStatCard('Risc mitjà', stats?.medium_risk)}
        {renderStatCard('Risc alt', stats?.high_risk)}
        {renderStatCard('Direccions conegudes', stats?.known_addresses)}
        {renderStatCard('Direccions en memoria', stats?.cached_addresses)}
      </StatsGrid>

      <ChartsSection>
        <DashboardTitle style={{ marginTop: '2.4rem' }}>
          Gràfics del dashboard
        </DashboardTitle>

        {dashboardMetricsError ? (
          <ErrorMessage>
            <b>Error carregant gràfics:</b> {dashboardMetricsError}
          </ErrorMessage>
        ) : null}

        <ChartsGrid>
          <ChartCard>
            <ChartTitle>Distribució de risc</ChartTitle>
            {isLoadingDashboardMetrics ? (
              <ChartEmptyState>Carregant dades...</ChartEmptyState>
            ) : (
              renderBarChart(dashboardMetrics?.risk_distribution || [])
            )}
          </ChartCard>

          <ChartCard>
            <ChartTitle>Mètodes més detectats</ChartTitle>
            {isLoadingDashboardMetrics ? (
              <ChartEmptyState>Carregant dades...</ChartEmptyState>
            ) : (
              renderBarChart(dashboardMetrics?.method_distribution || [])
            )}
          </ChartCard>
        </ChartsGrid>
      </ChartsSection>

      <HistorySection>
        <DashboardTitle style={{ marginTop: '2.4rem' }}>
          Últims anàlisis
        </DashboardTitle>

        {historyError ? (
          <ErrorMessage>
            <b>Error carregant històric:</b> {historyError}
          </ErrorMessage>
        ) : null}

        <TableWrapper>
          {history.length === 0 ? (
            <EmptyState>
              {isLoadingHistory
                ? 'Carregant últims anàlisis...'
                : 'Encara no hi ha anàlisis guardats.'}
            </EmptyState>
          ) : (
            <HistoryTable>
              <TableHead>
                <tr>
                  <TableHeader>Fecha</TableHeader>
                  <TableHeader>Riesgo</TableHeader>
                  <TableHeader>Score</TableHeader>
                  <TableHeader>Método</TableHeader>
                  <TableHeader>Destino</TableHeader>
                  <TableHeader>Origen</TableHeader>
                  <TableHeader>Acción</TableHeader>
                </tr>
              </TableHead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id}>
                    <TableCell>{formatHistoryDate(item.created_at)}</TableCell>
                    <TableCell>
                      <RiskBadge $risk={item.risk_level || 'DESCONOCIDO'}>
                        {item.risk_level || '—'}
                      </RiskBadge>
                    </TableCell>
                    <TableCell>{item.risk_score ?? '—'}</TableCell>
                    <TableCell>{getMethodLabel(item)}</TableCell>
                    <TableCell title={item.to_address || ''}>
                      {shortenAddress(item.to_address)}
                    </TableCell>
                    <TableCell>{item.origin || '—'}</TableCell>
                    <TableCell>{item.recommended_action || '—'}</TableCell>
                  </tr>
                ))}
              </tbody>
            </HistoryTable>
          )}
        </TableWrapper>
      </HistorySection>

      <KnownAddressesSection>
        <DashboardTitle style={{ marginTop: '2.4rem' }}>
          Direccions conegudes
        </DashboardTitle>

        <FilterBar>
          <SearchInput
            value={knownAddressSearch}
            onChange={(event) => setKnownAddressSearch(event.target.value)}
            placeholder="Cercar per adreça, etiqueta o font"
          />

          <SelectInput
            value={knownAddressType}
            onChange={(event) => setKnownAddressType(event.target.value)}
          >
            <option value="all">Tots els tipus</option>
            <option value="warning">Warning</option>
            <option value="suspicious">Suspicious</option>
            <option value="scam">Scam</option>
            <option value="blacklisted">Blacklisted</option>
            <option value="trusted">Trusted</option>
            <option value="test_contract">Test contract</option>
            <option value="own_contract">Own contract</option>
          </SelectInput>

          <SmallButton
            onClick={loadKnownAddresses}
            disabled={isLoadingKnownAddresses}
          >
            {isLoadingKnownAddresses ? 'Cercant...' : 'Aplicar filtres'}
          </SmallButton>
        </FilterBar>

        {knownAddressesError ? (
          <ErrorMessage>
            <b>Error carregant direccions:</b> {knownAddressesError}
          </ErrorMessage>
        ) : null}

        <TableWrapper>
          {knownAddresses.length === 0 ? (
            <EmptyState>
              {isLoadingKnownAddresses
                ? 'Carregant direccions conegudes...'
                : 'No hi ha direccions conegudes per mostrar.'}
            </EmptyState>
          ) : (
            <HistoryTable>
              <TableHead>
                <tr>
                  <TableHeader>Direcció</TableHeader>
                  <TableHeader>Etiqueta</TableHeader>
                  <TableHeader>Tipus</TableHeader>
                  <TableHeader>Font</TableHeader>
                  <TableHeader>Afegida</TableHeader>
                </tr>
              </TableHead>
              <tbody>
                {knownAddresses.map((item) => (
                  <tr key={item.id}>
                    <TableCell title={item.address}>
                      {shortenAddress(item.address)}
                    </TableCell>
                    <TableCell>{item.label || '—'}</TableCell>
                    <TableCell>
                      <RiskBadge $risk={item.type === 'warning' ? 'MEDIO' : 'BAJO'}>
                        {item.type || '—'}
                      </RiskBadge>
                    </TableCell>
                    <TableCell>{item.source || '—'}</TableCell>
                    <TableCell>{formatHistoryDate(item.added)}</TableCell>
                  </tr>
                ))}
              </tbody>
            </HistoryTable>
          )}
        </TableWrapper>
      </KnownAddressesSection>

      <ManualReportSection>
        <DashboardTitle style={{ marginTop: '2.4rem' }}>
          Report manual de direccions
        </DashboardTitle>

        <QuickActionsDescription>
          Permet afegir direccions al dataset local per marcar-les com a sospitoses,
          de confiança o pròpies de l’entorn de proves.
        </QuickActionsDescription>

        <FormGrid>
          <SearchInput
            value={manualAddress}
            onChange={(event) => setManualAddress(event.target.value)}
            placeholder="Adreça Ethereum: 0x..."
          />

          <SearchInput
            value={manualLabel}
            onChange={(event) => setManualLabel(event.target.value)}
            placeholder="Etiqueta o descripció"
          />

          <SelectInput
            value={manualType}
            onChange={(event) => setManualType(event.target.value)}
          >
            <option value="warning">Warning</option>
            <option value="suspicious">Suspicious</option>
            <option value="scam">Scam</option>
            <option value="blacklisted">Blacklisted</option>
            <option value="trusted">Trusted</option>
            <option value="test_contract">Test contract</option>
            <option value="own_contract">Own contract</option>
          </SelectInput>
        </FormGrid>

        <DashboardActions>
          <SmallButton
            onClick={submitManualReport}
            disabled={isSubmittingManualReport}
          >
            {isSubmittingManualReport
              ? 'Guardant...'
              : 'Afegir al dataset local'}
          </SmallButton>
        </DashboardActions>

        {manualReportMessage ? (
          <FormMessage $success={manualReportSuccess}>
            {manualReportMessage}
          </FormMessage>
        ) : null}
      </ManualReportSection>

      <DashboardActions>
        <SmallButton
          onClick={() => {
            loadHealth();
            loadStats();
            loadHistory();
            loadKnownAddresses();
            loadDashboardMetrics();
          }}
          disabled={
            isLoadingHealth ||
            isLoadingStats ||
            isLoadingHistory ||
            isLoadingKnownAddresses ||
            isLoadingDashboardMetrics
          }
        >
          {isLoadingHealth ||
          isLoadingStats ||
          isLoadingHistory ||
          isLoadingKnownAddresses ||
          isLoadingDashboardMetrics
            ? 'Actualitzant...'
            : 'Actualitzar panell'}
        </SmallButton>
      </DashboardActions>

      {health?.timestamp ? (
        <LastCheck>
          Última comprovació : {new Date(health.timestamp).toLocaleString()}
        </LastCheck>
      ) : null}
    </DashboardWrapper>
      <QuickActionsSection>
  <QuickActionsHeader>
    <QuickActionsTitle>Accions ràpides</QuickActionsTitle>
    <QuickActionsDescription>
      Eines de connexió, proves manuals i validació del Snap durant el desenvolupament.
    </QuickActionsDescription>
  </QuickActionsHeader>

  <CardContainer>
    {error && (
      <ErrorMessage>
        <b>S'ha produït un error:</b> {error.message}
      </ErrorMessage>
    )}

    <QuickActionsGrid>
      {!isMetaMaskReady && (
        <Card
          content={{
            title: 'Instal·lar MetaMask Flask',
            description:
              'MetaMask Snaps requereix MetaMask Flask o una versió compatible amb Snaps durant el desenvolupament.',
            button: <InstallFlaskButton />,
          }}
          disabled={false}
        />
      )}

      {!installedSnap && (
        <Card
          content={{
            title: 'Connectar el Snap',
            description:
              'Instal·la i connecta el Snap local per poder analitzar transaccions des de MetaMask.',
            button: (
              <ConnectButton
                onClick={requestSnap}
                disabled={!isMetaMaskReady}
              />
            ),
          }}
          disabled={!isMetaMaskReady}
        />
      )}

      {shouldDisplayReconnectButton(installedSnap) && (
        <Card
          content={{
            title: 'Reconnectar el Snap',
            description:
              'Actualitza la connexió amb el Snap local després de canvis en el codi o reinicis de l’entorn.',
            button: (
              <ReconnectButton
                onClick={requestSnap}
                disabled={!installedSnap}
              />
            ),
          }}
          disabled={!installedSnap}
        />
      )}

      <Card
        content={{
          title: 'Provar el diàleg del Snap',
          description:
            'Envia un missatge simple al Snap per comprovar la comunicació DApp → MetaMask → Snap.',
          button: (
            <SendHelloButton
              onClick={handleSendHelloClick}
              disabled={!installedSnap}
            />
          ),
        }}
        disabled={!installedSnap}
      />

      <Card
        content={{
          title: 'Anàlisi manual de prova',
          description:
            'Envia una transacció simulada al Snap per validar el flux d’anàlisi amb el backend.',
          button: (
            <AnalyzeButton
              onClick={handleAnalyzeTransaction}
              disabled={!installedSnap}
            />
          ),
        }}
        disabled={!installedSnap}
      />

      <Card
        content={{
          title: 'Transacció real de prova',
          description:
            'Llança una transacció des de la DApp per comprovar que el hook onTransaction s’activa dins de MetaMask.',
          button: (
            <SendHelloButton
              onClick={handleSendTransaction}
              disabled={!installedSnap}
            />
          ),
        }}
        disabled={!installedSnap}
      />
    </QuickActionsGrid>
  </CardContainer>
</QuickActionsSection>




    </Container>
  );
};

export default Index;