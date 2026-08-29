import {
  BarChart3,
  Database,
  History,
  ListFilter,
  RefreshCw,
  Search,
  ShieldCheck,
  Tag,
  TestTube2,
  X,
} from 'lucide-react';
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
import {
  getActionLabel,
  getAddressTypeLabel,
  getMetricLabel,
  getRiskLabel,
  getSourceLabel,
  isLocalSnap,
  shouldDisplayReconnectButton,
} from '../utils';

// /////////////////////////////////TIPOS//////////////////////////////////////////

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

/* eslint-disable @typescript-eslint/naming-convention --
 * These DTOs mirror the backend JSON contract, whose public keys use snake_case.
 */
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

type AnalysisDetail = AnalysisHistoryItem & {
  final_verdict?: unknown;
  findings?: unknown;
  decoded?: unknown;
  ai_review?: unknown;
  known_address_signals?: unknown;
  normalized_tx?: unknown;
  performance?: unknown;
  evaluation?: unknown;
};
/* eslint-enable @typescript-eslint/naming-convention */

type AnalysisDetailResponse = {
  success: boolean;
  detail: AnalysisDetail;
  timestamp: string;
};

type ActiveView = 'overview' | 'history' | 'addresses' | 'tests';

const getActionBadgeBackground = (action: string) => {
  if (action === 'ALLOW') {
    return 'rgba(26, 127, 55, 0.12)';
  }

  if (action === 'BLOCK') {
    return 'rgba(207, 34, 46, 0.12)';
  }

  return 'rgba(154, 103, 0, 0.14)';
};

const getRiskBarColor = (risk: string): string | undefined => {
  if (risk === 'ALTO') {
    return '#cf222e';
  }

  if (risk === 'MEDIO') {
    return '#9a6700';
  }

  if (risk === 'BAJO') {
    return '#1a7f37';
  }

  return undefined;
};

const getAddressRisk = (type?: string) => {
  const normalizedType = type ?? '';

  if (['scam', 'blacklist', 'blacklisted'].includes(normalizedType)) {
    return 'ALTO';
  }

  if (['warning', 'suspicious'].includes(normalizedType)) {
    return 'MEDIO';
  }

  return 'BAJO';
};

const reportUnexpectedError =
  (context: string) => (unexpectedError: unknown) => {
    console.error(`Error inesperat ${context}:`, unexpectedError);
  };

// ///////////////////////////////////////////////////////////////////////////////

// //////////////////////////////ESTILOS//////////////////////////////////////////

const Container = styled.div`
  flex: 1;
  width: 100%;
  max-width: 132rem;
  margin: 0 auto;
  padding: 3.2rem 3.2rem 6.4rem;

  ${({ theme }) => theme.mediaQueries.small} {
    padding: 2rem 1.6rem 4rem;
  }
`;

const Heading = styled.h1`
  margin: 0;
  font-size: 3.2rem;

  ${({ theme }) => theme.mediaQueries.small} {
    font-size: 2.6rem;
  }
`;

const Span = styled.span`
  color: ${(props) => props.theme.colors.primary?.default};
`;

const Subtitle = styled.p`
  color: ${({ theme }) => theme.colors.text?.alternative};
  margin: 0.4rem 0 0;
`;

const WorkspaceHeader = styled.div`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 2.4rem;
  margin-bottom: 2.4rem;

  ${({ theme }) => theme.mediaQueries.small} {
    align-items: flex-start;
    flex-direction: column;
    gap: 1.2rem;
  }
`;

const WorkspaceIdentity = styled.div`
  min-width: 0;
`;

const WorkspaceKicker = styled.div`
  display: flex;
  align-items: center;
  gap: 0.6rem;
  color: ${({ theme }) => theme.colors.text?.alternative};
  font-size: ${({ theme }) => theme.fontSizes.small};
  font-weight: 700;
  margin-bottom: 0.6rem;
  text-transform: uppercase;
`;

const HeaderMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 0.8rem;
  color: ${({ theme }) => theme.colors.text?.alternative};
  font-size: ${({ theme }) => theme.fontSizes.small};
`;

const HeaderStatusDot = styled.span<{ $status: 'ok' | 'error' }>`
  width: 0.8rem;
  height: 0.8rem;
  border-radius: 50%;
  background-color: ${({ $status }) =>
    $status === 'ok' ? '#1a7f37' : '#cf222e'};
`;

const SectionTabs = styled.div`
  display: flex;
  gap: 0.4rem;
  overflow-x: auto;
  padding: 0.4rem;
  margin-bottom: 3.2rem;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border?.default};

  ${({ theme }) => theme.mediaQueries.small} {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.2rem;
    overflow: visible;
    padding: 0.2rem 0;
    margin-bottom: 2.4rem;
  }
`;

const TabButton = styled.button<{ $active: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 0.8rem;
  min-height: 4rem;
  padding: 0.8rem 1.2rem;
  white-space: nowrap;
  border: 0;
  border-bottom: 2px solid
    ${({ $active, theme }) =>
      $active ? theme.colors.primary?.default : 'transparent'};
  border-radius: 0;
  background: transparent;
  color: ${({ $active, theme }) =>
    $active ? theme.colors.text?.default : theme.colors.text?.alternative};
  font-weight: ${({ $active }) => ($active ? 700 : 500)};

  &:hover {
    border-color: ${({ theme }) => theme.colors.border?.default};
    background-color: ${({ theme }) => theme.colors.background?.alternative};
    color: ${({ theme }) => theme.colors.text?.default};
  }

  ${({ theme }) => theme.mediaQueries.small} {
    justify-content: center;
    gap: 0.4rem;
    min-width: 0;
    padding: 0.8rem 0.4rem;
  }
`;

const ViewSection = styled.section`
  width: 100%;
`;

const ErrorMessage = styled.div`
  background-color: ${({ theme }) => theme.colors.error?.muted};
  border: 1px solid ${({ theme }) => theme.colors.error?.default};
  color: ${({ theme }) => theme.colors.error?.alternative};
  border-radius: ${({ theme }) => theme.radii.default};
  padding: 1.2rem 1.4rem;
  margin: 1.2rem 0;
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
`;

const DashboardTitle = styled.h2`
  margin: 0;
  font-size: 2rem;
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.6rem;
  margin-bottom: 1.6rem;

  ${({ theme }) => theme.mediaQueries.small} {
    flex-direction: column;
  }
`;

const SectionHeadingGroup = styled.div`
  min-width: 0;
`;

const SectionDescription = styled.p`
  margin: 0.4rem 0 0;
  color: ${({ theme }) => theme.colors.text?.alternative};
`;

const StatusGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1.2rem;
  width: 100%;
  margin-bottom: 2.4rem;

  ${({ theme }) => theme.mediaQueries.small} {
    grid-template-columns: 1fr;
  }
`;

const StatusCard = styled.div`
  background-color: ${({ theme }) => theme.colors.background?.alternative};
  border: 1px solid ${({ theme }) => theme.colors.border?.default};
  border-radius: ${({ theme }) => theme.radii.default};
  padding: 1.4rem 1.6rem;
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
    $status === 'ok' ? '#1a7f37' : '#cf222e'};
`;

const StatusMessage = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.colors.text?.alternative};
  font-size: ${({ theme }) => theme.fontSizes.small};
`;

const SmallButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.7rem;
  border: 1px solid ${({ theme }) => theme.colors.border?.default};
  background-color: ${({ theme }) => theme.colors.card?.default};
  color: ${({ theme }) => theme.colors.text?.default};
  border-radius: ${({ theme }) => theme.radii.default};
  padding: 0.9rem 1.4rem;
  cursor: pointer;
  font-weight: 700;

  &:hover {
    background-color: ${({ theme }) => theme.colors.background?.alternative};
    border-color: ${({ theme }) => theme.colors.text?.muted};
    color: ${({ theme }) => theme.colors.text?.default};
  }
`;

const IconButton = styled(SmallButton)`
  width: 4rem;
  min-width: 4rem;
  padding: 0.8rem;
`;

const LastCheck = styled.p`
  margin: 1.2rem 0 0 0;
  color: ${({ theme }) => theme.colors.text?.alternative};
  font-size: ${({ theme }) => theme.fontSizes.small};
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 1rem;
  width: 100%;
  margin-bottom: 2.4rem;

  ${({ theme }) => theme.mediaQueries.small} {
    grid-template-columns: 1fr 1fr;
  }
`;

const HistorySection = styled.div`
  width: 100%;
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
  min-width: 76rem;
`;

const TableHead = styled.thead`
  background-color: ${({ theme }) => theme.colors.background?.default};
`;

const TableHeader = styled.th`
  text-align: left;
  padding: 1rem 1.2rem;
  font-size: ${({ theme }) => theme.fontSizes.small};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border?.default};
`;

const TableCell = styled.td`
  padding: 1rem 1.2rem;
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
    if ($risk === 'ALTO' || $risk === 'HIGH') {
      return '#cf222e';
    }
    if ($risk === 'MEDIO' || $risk === 'MEDIUM') {
      return '#9a6700';
    }
    if ($risk === 'BAJO' || $risk === 'LOW') {
      return '#1a7f37';
    }
    return '#57606a';
  }};
  color: white;
`;

const ActionBadge = styled.span<{ $action: string }>`
  display: inline-block;
  padding: 0.35rem 0.7rem;
  border-radius: 4px;
  background-color: ${({ $action }) => getActionBadgeBackground($action)};
  color: ${({ $action, theme }) =>
    $action ? theme.colors.text?.default : theme.colors.text?.alternative};
  font-size: 1.2rem;
  font-weight: 700;
`;

const EmptyState = styled.div`
  padding: 1.6rem;
  color: ${({ theme }) => theme.colors.text?.alternative};
`;

const StatCard = styled.div`
  background-color: ${({ theme }) => theme.colors.background?.alternative};
  border: 1px solid ${({ theme }) => theme.colors.border?.default};
  border-radius: ${({ theme }) => theme.radii.default};
  min-width: 0;
  padding: 1.4rem;
`;

const StatValue = styled.div`
  font-size: 2.2rem;
  font-weight: 800;
  margin-bottom: 0.4rem;
`;

const StatLabel = styled.div`
  color: ${({ theme }) => theme.colors.text?.alternative};
  font-size: ${({ theme }) => theme.fontSizes.small};
`;

const QuickActionsSection = styled.div`
  width: 100%;
`;

const QuickActionsHeader = styled.div`
  margin-bottom: 1.6rem;
`;

const QuickActionsTitle = styled.h2`
  margin: 0;
  font-size: 2rem;
`;

const QuickActionsDescription = styled.p`
  margin: 0.8rem 0 0 0;
  color: ${({ theme }) => theme.colors.text?.alternative};
`;

const QuickActionsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.2rem;
  width: 100%;

  ${({ theme }) => theme.mediaQueries.small} {
    grid-template-columns: 1fr;
  }
`;

const KnownAddressesSection = styled.div`
  width: 100%;
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
  min-height: 4.2rem;
`;

const SelectInput = styled.select`
  border: 1px solid ${({ theme }) => theme.colors.border?.default};
  background-color: ${({ theme }) => theme.colors.background?.alternative};
  color: ${({ theme }) => theme.colors.text?.default};
  border-radius: ${({ theme }) => theme.radii.default};
  padding: 0.9rem 1.2rem;
  min-height: 4.2rem;
`;

const ManualReportSection = styled.div`
  width: 100%;
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
  font-size: 1.7rem;
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
  border-radius: 3px;
  background-color: ${({ theme }) => theme.colors.background?.default};
  overflow: hidden;
`;

const BarFill = styled.div<{
  $width: number;
  $color?: string | undefined;
}>`
  width: ${({ $width }) => `${$width}%`};
  height: 100%;
  border-radius: 3px;
  background-color: ${({ $color, theme }) =>
    $color ?? theme.colors.primary?.default ?? '#0969da'};
`;

const ChartEmptyState = styled.div`
  color: ${({ theme }) => theme.colors.text?.alternative};
  font-size: ${({ theme }) => theme.fontSizes.small};
`;

const DetailPanel = styled.div`
  min-width: 0;
  background-color: ${({ theme }) => theme.colors.background?.alternative};
  border: 1px solid ${({ theme }) => theme.colors.border?.default};
  border-radius: ${({ theme }) => theme.radii.default};
  padding: 1.8rem;
`;

const DetailHeader = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 1.2rem;
  align-items: flex-start;
  margin-bottom: 1.6rem;

  ${({ theme }) => theme.mediaQueries.small} {
    flex-direction: column;
  }
`;

const DetailTitle = styled.h3`
  margin: 0;
  font-size: 2rem;
`;

const DetailSubtitle = styled.p`
  margin: 0.4rem 0 0 0;
  color: ${({ theme }) => theme.colors.text?.alternative};
  font-size: ${({ theme }) => theme.fontSizes.small};
`;

const DetailGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0;
  margin-bottom: 1.6rem;
  border-top: 1px solid ${({ theme }) => theme.colors.border?.default};
  border-left: 1px solid ${({ theme }) => theme.colors.border?.default};

  ${({ theme }) => theme.mediaQueries.small} {
    grid-template-columns: 1fr;
  }
`;

const DetailBox = styled.div`
  min-width: 0;
  border-right: 1px solid ${({ theme }) => theme.colors.border?.default};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border?.default};
  padding: 1.2rem;
`;

const DetailLabel = styled.div`
  color: ${({ theme }) => theme.colors.text?.alternative};
  font-size: ${({ theme }) => theme.fontSizes.small};
  margin-bottom: 0.4rem;
`;

const DetailValue = styled.div`
  font-weight: 700;
  word-break: break-word;
`;

const DetailSectionTitle = styled.h4`
  margin: 1.6rem 0 0.8rem 0;
  font-size: 1.6rem;
`;

const JsonBlock = styled.pre`
  margin: 0;
  padding: 1.2rem;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
  border-radius: ${({ theme }) => theme.radii.default};
  background-color: ${({ theme }) => theme.colors.background?.default};
  border: 1px solid ${({ theme }) => theme.colors.border?.default};
  font-size: ${({ theme }) => theme.fontSizes.small};
`;

const FindingsList = styled.ul`
  margin: 0;
  padding-left: 2rem;

  li + li {
    margin-top: 0.5rem;
  }
`;

const ClickableRow = styled.tr<{ $selected: boolean }>`
  cursor: pointer;
  background-color: ${({ $selected, theme }) =>
    $selected ? theme.colors.background?.default : 'transparent'};

  &:hover {
    background-color: ${({ theme }) => theme.colors.background?.default};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.primary?.default};
    outline-offset: -2px;
  }
`;

const HistoryLayout = styled.div<{ $hasDetail: boolean }>`
  display: grid;
  grid-template-columns: ${({ $hasDetail }) =>
    $hasDetail ? 'minmax(52rem, 1.2fr) minmax(38rem, 0.8fr)' : '1fr'};
  gap: 1.6rem;
  align-items: start;

  @media screen and (max-width: 1050px) {
    grid-template-columns: 1fr;
  }
`;

const TechnicalDetails = styled.details`
  border-top: 1px solid ${({ theme }) => theme.colors.border?.default};

  &:last-child {
    border-bottom: 1px solid ${({ theme }) => theme.colors.border?.default};
  }
`;

const TechnicalSummary = styled.summary`
  cursor: pointer;
  padding: 1.1rem 0;
  font-weight: 700;
`;

const TechnicalContent = styled.div`
  padding-bottom: 1.2rem;
`;

const AddressWorkspace = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(30rem, 0.8fr);
  gap: 2.4rem;
  align-items: start;

  @media screen and (max-width: 950px) {
    grid-template-columns: 1fr;
  }
`;

const FormPanel = styled.div`
  padding-left: 2.4rem;
  border-left: 1px solid ${({ theme }) => theme.colors.border?.default};

  @media screen and (max-width: 950px) {
    padding-left: 0;
    padding-top: 2.4rem;
    border-left: 0;
    border-top: 1px solid ${({ theme }) => theme.colors.border?.default};
  }
`;

const FieldLabel = styled.label`
  display: block;
  margin-bottom: 0.5rem;
  font-size: ${({ theme }) => theme.fontSizes.small};
  font-weight: 700;
`;

const FormField = styled.div`
  margin-bottom: 1.2rem;
`;

// ////////////////////////////////////////////////////////////////////////////////

// //////////////////////////ESTADOS DENTRO DE INDEX///////////////////////////////

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
  const [historySearch, setHistorySearch] = useState('');
  const [historyRisk, setHistoryRisk] = useState('all');

  const [knownAddresses, setKnownAddresses] = useState<KnownAddressItem[]>([]);
  const [knownAddressesError, setKnownAddressesError] = useState<string | null>(
    null,
  );
  const [isLoadingKnownAddresses, setIsLoadingKnownAddresses] = useState(false);
  const [knownAddressSearch, setKnownAddressSearch] = useState('');
  const [knownAddressType, setKnownAddressType] = useState('all');

  const [manualAddress, setManualAddress] = useState('');
  const [manualLabel, setManualLabel] = useState('');
  const [manualType, setManualType] = useState('warning');
  const [manualReportMessage, setManualReportMessage] = useState<string | null>(
    null,
  );
  const [manualReportSuccess, setManualReportSuccess] = useState(false);
  const [isSubmittingManualReport, setIsSubmittingManualReport] =
    useState(false);

  const [dashboardMetrics, setDashboardMetrics] =
    useState<DashboardMetrics | null>(null);
  const [dashboardMetricsError, setDashboardMetricsError] = useState<
    string | null
  >(null);
  const [isLoadingDashboardMetrics, setIsLoadingDashboardMetrics] =
    useState(false);

  const [selectedAnalysisId, setSelectedAnalysisId] = useState<number | null>(
    null,
  );
  const [selectedAnalysisDetail, setSelectedAnalysisDetail] =
    useState<AnalysisDetail | null>(null);
  const [analysisDetailError, setAnalysisDetailError] = useState<string | null>(
    null,
  );
  const [isLoadingAnalysisDetail, setIsLoadingAnalysisDetail] = useState(false);
  const [activeView, setActiveView] = useState<ActiveView>('overview');

  // ///////////////////////////FUNCIONES///////////////////////////////////////////

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
      setHealthError('No s’ha pogut connectar amb el backend');
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
      setStatsError('No s’han pogut carregar les estadístiques');
    } finally {
      setIsLoadingStats(false);
    }
  };

  const loadHistory = async () => {
    try {
      setIsLoadingHistory(true);

      const response = await fetch(
        'http://localhost:3000/analysis-history?limit=10',
      );
      const data: AnalysisHistoryResponse = await response.json();

      if (!data.success) {
        throw new Error('Resposta invàlida de /analysis-history');
      }

      setHistory(data.history || []);
      setHistoryError(null);
    } catch (loadError) {
      console.error('Error consultant /analysis-history:', loadError);
      setHistory([]);
      setHistoryError('No s’ha pogut carregar l’historial d’anàlisis');
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
      setKnownAddressesError(
        'No s’han pogut carregar les direccions conegudes',
      );
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
      setDashboardMetricsError(
        'No s’han pogut carregar els gràfics del panell',
      );
    } finally {
      setIsLoadingDashboardMetrics(false);
    }
  };

  const submitManualReport = async () => {
    try {
      setIsSubmittingManualReport(true);
      setManualReportMessage(null);

      const response = await fetch(
        'http://localhost:3000/known-addresses/manual',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            address: manualAddress,
            label: manualLabel,
            type: manualType,
          }),
        },
      );

      const data: ManualReportResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error ?? 'No s’ha pogut guardar l’informe manual');
      }

      setManualReportSuccess(true);
      setManualReportMessage('Direcció afegida correctament al dataset local.');

      setManualAddress('');
      setManualLabel('');
      setManualType('warning');

      await Promise.all([loadKnownAddresses(), loadStats()]);
    } catch (submitError) {
      console.error('Error enviant l’informe manual:', submitError);

      setManualReportSuccess(false);
      setManualReportMessage(
        submitError instanceof Error
          ? submitError.message
          : 'Error desconegut enviant l’informe manual',
      );
    } finally {
      setIsSubmittingManualReport(false);
    }
  };

  useEffect(() => {
    Promise.all([
      loadHealth(),
      loadStats(),
      loadHistory(),
      loadKnownAddresses(),
      loadDashboardMetrics(),
    ]).catch(reportUnexpectedError('durant la càrrega inicial'));
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

    const date = new Date(
      timestamp < 1000000000000 ? timestamp * 1000 : timestamp,
    );

    return date.toLocaleString('ca-ES');
  };

  const getMethodLabel = (item: AnalysisHistoryItem) => {
    if (item.decoded_method) {
      return item.decoded_method;
    }

    if (item.method_selector) {
      return item.method_selector;
    }

    return 'desconegut';
  };

  const renderStatusCard = (
    title: string,
    service?: ServiceStatus,
    fallbackMessage = 'Sense informació',
  ) => {
    const status = service?.status ?? 'error';
    const message = service?.message ?? fallbackMessage;

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

  // Analitza una transacció simulada mitjançant el Snap.
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

  // Simula una transacció real per comprovar el hook onTransaction.
  const handleSendTransaction = async () => {
    try {
      // Obté el compte actiu de MetaMask.
      const accounts = (await window.ethereum.request({
        method: 'eth_requestAccounts',
      })) as string[];

      if (!accounts || accounts.length === 0) {
        console.error('No accounts found');
        return;
      }

      const from = accounts[0];

      // Envia una transacció de prova de 0 ETH a l'adreça nul·la.
      await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from,
            to: '0x0000000000000000000000000000000000000000',
            value: '0x0', // 0 ETH
            data: '0x', // Sin datos
          },
        ],
      });
    } catch (requestError) {
      console.error('Error:', requestError);
    }
  };

  const renderBarChart = (items: MetricItem[] = []) => {
    const maxValue = Math.max(...items.map((item) => item.count), 0);

    if (!items.length || maxValue === 0) {
      return <ChartEmptyState>No hi ha dades suficients.</ChartEmptyState>;
    }

    return items.map((item) => {
      const width = Math.round((item.count / maxValue) * 100);
      const normalizedLabel = item.label.toUpperCase();
      const color = getRiskBarColor(normalizedLabel);

      return (
        <BarRow key={item.label}>
          <BarHeader>
            <span>{getMetricLabel(item.label)}</span>
            <strong>{item.count}</strong>
          </BarHeader>
          <BarTrack>
            <BarFill $width={width} $color={color} />
          </BarTrack>
        </BarRow>
      );
    });
  };

  const loadAnalysisDetail = async (id: number) => {
    try {
      setSelectedAnalysisId(id);
      setIsLoadingAnalysisDetail(true);
      setAnalysisDetailError(null);

      const response = await fetch(
        `http://localhost:3000/analysis-history/${id}`,
      );
      const data: AnalysisDetailResponse = await response.json();

      if (!data.success) {
        throw new Error('Resposta invàlida de /analysis-history/:id');
      }

      setSelectedAnalysisDetail(data.detail);
    } catch (loadError) {
      console.error('Error carregant el detall de l’anàlisi:', loadError);

      setSelectedAnalysisDetail(null);
      setAnalysisDetailError(
        'No s’ha pogut carregar el detall de l’anàlisi seleccionada',
      );
    } finally {
      setIsLoadingAnalysisDetail(false);
    }
  };

  const formatUnknownValue = (value: unknown) => {
    if (value === null || value === undefined || value === '') {
      return 'No disponible';
    }

    if (typeof value === 'string') {
      return value;
    }

    return JSON.stringify(value, null, 2);
  };

  const getObjectField = (
    value: unknown,
    field: string,
    fallback = '—',
  ): string => {
    if (!value || typeof value !== 'object') {
      return fallback;
    }

    const objectValue = value as Record<string, unknown>;
    const fieldValue = objectValue[field];

    if (fieldValue === null || fieldValue === undefined || fieldValue === '') {
      return fallback;
    }

    if (
      typeof fieldValue === 'string' ||
      typeof fieldValue === 'number' ||
      typeof fieldValue === 'boolean' ||
      typeof fieldValue === 'bigint'
    ) {
      return String(fieldValue);
    }

    return JSON.stringify(fieldValue) ?? fallback;
  };

  const normalizeFindings = (value: unknown): string[] => {
    if (!value) {
      return [];
    }

    if (Array.isArray(value)) {
      return value.map((item) => String(item));
    }

    if (typeof value === 'string') {
      return [value];
    }

    return [JSON.stringify(value, null, 2)];
  };

  const getDetailRisk = (detail: AnalysisDetail) => {
    const riskLevel = getObjectField(detail.final_verdict, 'risk_level', '');

    if (riskLevel) {
      return riskLevel;
    }

    const risk = getObjectField(detail.final_verdict, 'risk', '');

    if (risk) {
      return risk;
    }

    return detail.risk_level ?? '—';
  };

  const getDetailScore = (detail: AnalysisDetail) => {
    const score = getObjectField(detail.final_verdict, 'risk_score', '');

    if (score) {
      return score;
    }

    return String(detail.risk_score ?? '—');
  };

  const getDetailAction = (detail: AnalysisDetail) => {
    const action = getObjectField(
      detail.final_verdict,
      'recommended_action',
      '',
    );

    if (action) {
      return action;
    }

    return detail.recommended_action ?? '—';
  };

  const filteredHistory = history.filter((item) => {
    const query = historySearch.trim().toLowerCase();
    const matchesRisk =
      historyRisk === 'all' || item.risk_level === historyRisk;
    const matchesQuery =
      !query ||
      [
        item.decoded_method,
        item.method_selector,
        item.to_address,
        item.origin,
      ].some((value) => value?.toLowerCase().includes(query));

    return matchesRisk && matchesQuery;
  });

  // ////////////////////////////////////////////////////////////////////////////////

  const closeAnalysisDetail = () => {
    setSelectedAnalysisId(null);
    setSelectedAnalysisDetail(null);
    setAnalysisDetailError(null);
  };

  const refreshDashboard = () => {
    Promise.all([
      loadHealth(),
      loadStats(),
      loadHistory(),
      loadKnownAddresses(),
      loadDashboardMetrics(),
    ]).catch(reportUnexpectedError('actualitzant el panell'));
  };

  const isRefreshing =
    isLoadingHealth ||
    isLoadingStats ||
    isLoadingHistory ||
    isLoadingKnownAddresses ||
    isLoadingDashboardMetrics;

  const detailIsVisible =
    isLoadingAnalysisDetail ||
    Boolean(analysisDetailError) ||
    Boolean(selectedAnalysisDetail);

  const getHistoryEmptyMessage = () => {
    if (history.length === 0) {
      return isLoadingHistory
        ? 'Carregant l’historial...'
        : 'Encara no hi ha anàlisis desades.';
    }

    if (filteredHistory.length === 0) {
      return 'Cap anàlisi coincideix amb els filtres aplicats.';
    }

    return null;
  };

  const historyEmptyMessage = getHistoryEmptyMessage();

  return (
    <Container>
      <WorkspaceHeader>
        <WorkspaceIdentity>
          <WorkspaceKicker>
            <ShieldCheck size={16} aria-hidden="true" />
            Supervisió local
          </WorkspaceKicker>
          <Heading>
            Assistent de <Span>Seguretat Web3</Span>
          </Heading>
          <Subtitle>
            Monitorització del Snap, anàlisi de risc i memòria local.
          </Subtitle>
        </WorkspaceIdentity>

        <HeaderMeta>
          <HeaderStatusDot
            $status={health?.backend?.status === 'ok' ? 'ok' : 'error'}
          />
          {health?.backend?.status === 'ok'
            ? 'Sistema operatiu'
            : 'Sistema no disponible'}
        </HeaderMeta>
      </WorkspaceHeader>

      <SectionTabs role="tablist" aria-label="Vistes del panell">
        <TabButton
          id="overview-tab"
          type="button"
          role="tab"
          aria-controls="overview-panel"
          aria-selected={activeView === 'overview'}
          tabIndex={activeView === 'overview' ? 0 : -1}
          $active={activeView === 'overview'}
          onClick={() => setActiveView('overview')}
        >
          <BarChart3 size={17} aria-hidden="true" />
          Resum
        </TabButton>
        <TabButton
          id="history-tab"
          type="button"
          role="tab"
          aria-controls="history-panel"
          aria-selected={activeView === 'history'}
          tabIndex={activeView === 'history' ? 0 : -1}
          $active={activeView === 'history'}
          onClick={() => setActiveView('history')}
        >
          <History size={17} aria-hidden="true" />
          Historial
        </TabButton>
        <TabButton
          id="addresses-tab"
          type="button"
          role="tab"
          aria-controls="addresses-panel"
          aria-selected={activeView === 'addresses'}
          tabIndex={activeView === 'addresses' ? 0 : -1}
          $active={activeView === 'addresses'}
          onClick={() => setActiveView('addresses')}
        >
          <Tag size={17} aria-hidden="true" />
          Adreces
        </TabButton>
        <TabButton
          id="tests-tab"
          type="button"
          role="tab"
          aria-controls="tests-panel"
          aria-selected={activeView === 'tests'}
          tabIndex={activeView === 'tests' ? 0 : -1}
          $active={activeView === 'tests'}
          onClick={() => setActiveView('tests')}
        >
          <TestTube2 size={17} aria-hidden="true" />
          Proves
        </TabButton>
      </SectionTabs>

      {activeView === 'overview' ? (
        <ViewSection
          id="overview-panel"
          role="tabpanel"
          aria-labelledby="overview-tab"
        >
          <DashboardWrapper>
            <SectionHeader>
              <SectionHeadingGroup>
                <DashboardTitle id="overview-title">
                  Visió general
                </DashboardTitle>
                <SectionDescription>
                  Estat dels serveis i resum de l’activitat registrada.
                </SectionDescription>
              </SectionHeadingGroup>
              <SmallButton
                type="button"
                onClick={refreshDashboard}
                disabled={isRefreshing}
              >
                <RefreshCw size={16} aria-hidden="true" />
                {isRefreshing ? 'Actualitzant...' : 'Actualitzar'}
              </SmallButton>
            </SectionHeader>

            {healthError ? (
              <ErrorMessage>
                <b>Backend desconnectat:</b> {healthError}
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
                isLoadingHealth
                  ? 'Comprovant base de dades...'
                  : 'Sense resposta',
              )}
              {renderStatusCard(
                'Ollama',
                health?.ollama,
                isLoadingHealth ? 'Comprovant Ollama...' : 'Sense resposta',
              )}
            </StatusGrid>

            {statsError ? (
              <ErrorMessage>
                <b>Error carregant les estadístiques:</b> {statsError}
              </ErrorMessage>
            ) : null}

            <StatsGrid>
              {renderStatCard('Anàlisis totals', stats?.total_analysis)}
              {renderStatCard('Risc baix', stats?.low_risk)}
              {renderStatCard('Risc mitjà', stats?.medium_risk)}
              {renderStatCard('Risc alt', stats?.high_risk)}
              {renderStatCard('Adreces conegudes', stats?.known_addresses)}
              {renderStatCard('Adreces en memòria', stats?.cached_addresses)}
            </StatsGrid>

            <ChartsSection>
              {dashboardMetricsError ? (
                <ErrorMessage>
                  <b>Error carregant els gràfics:</b> {dashboardMetricsError}
                </ErrorMessage>
              ) : null}
              <ChartsGrid>
                <ChartCard>
                  <ChartTitle>Distribució del risc</ChartTitle>
                  {isLoadingDashboardMetrics ? (
                    <ChartEmptyState>Carregant dades...</ChartEmptyState>
                  ) : (
                    renderBarChart(dashboardMetrics?.risk_distribution ?? [])
                  )}
                </ChartCard>
                <ChartCard>
                  <ChartTitle>Mètodes més detectats</ChartTitle>
                  {isLoadingDashboardMetrics ? (
                    <ChartEmptyState>Carregant dades...</ChartEmptyState>
                  ) : (
                    renderBarChart(dashboardMetrics?.method_distribution ?? [])
                  )}
                </ChartCard>
              </ChartsGrid>
            </ChartsSection>

            {health?.timestamp ? (
              <LastCheck>
                Darrera comprovació:{' '}
                {new Date(health.timestamp).toLocaleString('ca-ES')}
              </LastCheck>
            ) : null}
          </DashboardWrapper>
        </ViewSection>
      ) : null}

      {activeView === 'history' ? (
        <ViewSection
          id="history-panel"
          role="tabpanel"
          aria-labelledby="history-tab"
        >
          <HistorySection>
            <SectionHeader>
              <SectionHeadingGroup>
                <DashboardTitle id="history-title">
                  Historial d’anàlisis
                </DashboardTitle>
                <SectionDescription>
                  Selecciona un registre per consultar-ne el veredicte i les
                  dades tècniques.
                </SectionDescription>
              </SectionHeadingGroup>
              <SmallButton
                type="button"
                onClick={() => {
                  loadHistory().catch(
                    reportUnexpectedError('actualitzant l’historial'),
                  );
                }}
                disabled={isLoadingHistory}
              >
                <RefreshCw size={16} aria-hidden="true" />
                {isLoadingHistory ? 'Actualitzant...' : 'Actualitzar'}
              </SmallButton>
            </SectionHeader>

            <FilterBar>
              <SearchInput
                value={historySearch}
                onChange={(event) => setHistorySearch(event.target.value)}
                placeholder="Cercar per mètode, adreça o origen"
                aria-label="Cercar a l’historial"
              />
              <SelectInput
                value={historyRisk}
                onChange={(event) => setHistoryRisk(event.target.value)}
                aria-label="Filtrar l’historial per risc"
              >
                <option value="all">Tots els nivells</option>
                <option value="BAJO">Risc baix</option>
                <option value="MEDIO">Risc mitjà</option>
                <option value="ALTO">Risc alt</option>
              </SelectInput>
              <SmallButton
                type="button"
                onClick={() => {
                  setHistorySearch('');
                  setHistoryRisk('all');
                }}
              >
                <ListFilter size={16} aria-hidden="true" />
                Netejar
              </SmallButton>
            </FilterBar>

            {historyError ? (
              <ErrorMessage>
                <b>Error carregant l’historial:</b> {historyError}
              </ErrorMessage>
            ) : null}

            <HistoryLayout $hasDetail={detailIsVisible}>
              <TableWrapper>
                {historyEmptyMessage ? (
                  <EmptyState>{historyEmptyMessage}</EmptyState>
                ) : (
                  <HistoryTable role="grid">
                    <TableHead>
                      <tr>
                        <TableHeader>Data</TableHeader>
                        <TableHeader>Risc</TableHeader>
                        <TableHeader>Mètode</TableHeader>
                        <TableHeader>Destinació</TableHeader>
                        <TableHeader>Acció</TableHeader>
                      </tr>
                    </TableHead>
                    <tbody>
                      {filteredHistory.map((item) => (
                        <ClickableRow
                          key={item.id}
                          $selected={selectedAnalysisId === item.id}
                          tabIndex={0}
                          role="row"
                          aria-selected={selectedAnalysisId === item.id}
                          aria-label={`Obrir el detall de l’anàlisi ${item.id}`}
                          onClick={() => {
                            loadAnalysisDetail(item.id).catch(
                              reportUnexpectedError(
                                'carregant el detall de l’anàlisi',
                              ),
                            );
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              loadAnalysisDetail(item.id).catch(
                                reportUnexpectedError(
                                  'carregant el detall de l’anàlisi',
                                ),
                              );
                            }
                          }}
                        >
                          <TableCell>
                            {formatHistoryDate(item.created_at)}
                          </TableCell>
                          <TableCell>
                            <RiskBadge $risk={item.risk_level ?? 'DESCONOCIDO'}>
                              {getRiskLabel(item.risk_level)}
                            </RiskBadge>
                          </TableCell>
                          <TableCell>{getMethodLabel(item)}</TableCell>
                          <TableCell title={item.to_address ?? ''}>
                            {shortenAddress(item.to_address)}
                          </TableCell>
                          <TableCell>
                            <ActionBadge
                              $action={item.recommended_action ?? ''}
                            >
                              {getActionLabel(item.recommended_action)}
                            </ActionBadge>
                          </TableCell>
                        </ClickableRow>
                      ))}
                    </tbody>
                  </HistoryTable>
                )}
              </TableWrapper>

              {isLoadingAnalysisDetail ? (
                <DetailPanel>
                  <DetailTitle>Carregant el detall...</DetailTitle>
                  <DetailSubtitle>
                    S’està recuperant la informació completa de l’anàlisi.
                  </DetailSubtitle>
                </DetailPanel>
              ) : null}

              {analysisDetailError ? (
                <ErrorMessage>
                  <b>Error carregant el detall:</b> {analysisDetailError}
                </ErrorMessage>
              ) : null}

              {selectedAnalysisDetail ? (
                <DetailPanel>
                  <DetailHeader>
                    <div>
                      <DetailTitle>Detall de l’anàlisi</DetailTitle>
                      <DetailSubtitle>
                        Anàlisi #{selectedAnalysisDetail.id} ·{' '}
                        {formatHistoryDate(selectedAnalysisDetail.created_at)}
                      </DetailSubtitle>
                    </div>
                    <IconButton
                      type="button"
                      onClick={closeAnalysisDetail}
                      aria-label="Tancar el detall"
                      title="Tancar el detall"
                    >
                      <X size={18} aria-hidden="true" />
                    </IconButton>
                  </DetailHeader>

                  <DetailGrid>
                    <DetailBox>
                      <DetailLabel>Veredicte final</DetailLabel>
                      <DetailValue>
                        <RiskBadge
                          $risk={getDetailRisk(selectedAnalysisDetail)}
                        >
                          {getRiskLabel(getDetailRisk(selectedAnalysisDetail))}
                        </RiskBadge>
                      </DetailValue>
                    </DetailBox>
                    <DetailBox>
                      <DetailLabel>Puntuació</DetailLabel>
                      <DetailValue>
                        {getDetailScore(selectedAnalysisDetail)}
                      </DetailValue>
                    </DetailBox>
                    <DetailBox>
                      <DetailLabel>Acció recomanada</DetailLabel>
                      <DetailValue>
                        {getActionLabel(
                          getDetailAction(selectedAnalysisDetail),
                        )}
                      </DetailValue>
                    </DetailBox>
                    <DetailBox>
                      <DetailLabel>Origen</DetailLabel>
                      <DetailValue>
                        {selectedAnalysisDetail.origin ?? '—'}
                      </DetailValue>
                    </DetailBox>
                    <DetailBox>
                      <DetailLabel>Remitent</DetailLabel>
                      <DetailValue>
                        {selectedAnalysisDetail.from_address ?? '—'}
                      </DetailValue>
                    </DetailBox>
                    <DetailBox>
                      <DetailLabel>Destinació</DetailLabel>
                      <DetailValue>
                        {selectedAnalysisDetail.to_address ?? '—'}
                      </DetailValue>
                    </DetailBox>
                  </DetailGrid>

                  <DetailSectionTitle>Explicació</DetailSectionTitle>
                  <DetailSubtitle>
                    {selectedAnalysisDetail.explanation ?? 'No disponible'}
                  </DetailSubtitle>

                  <DetailSectionTitle>Indicadors detectats</DetailSectionTitle>
                  {normalizeFindings(selectedAnalysisDetail.findings).length >
                  0 ? (
                    <FindingsList>
                      {normalizeFindings(selectedAnalysisDetail.findings).map(
                        (finding) => (
                          <li key={finding}>{finding}</li>
                        ),
                      )}
                    </FindingsList>
                  ) : (
                    <DetailSubtitle>
                      No hi ha indicadors desats per a aquesta anàlisi.
                    </DetailSubtitle>
                  )}

                  <DetailSectionTitle>Dades tècniques</DetailSectionTitle>
                  <TechnicalDetails>
                    <TechnicalSummary>
                      Transacció descodificada
                    </TechnicalSummary>
                    <TechnicalContent>
                      <JsonBlock>
                        {formatUnknownValue(selectedAnalysisDetail.decoded)}
                      </JsonBlock>
                    </TechnicalContent>
                  </TechnicalDetails>
                  <TechnicalDetails>
                    <TechnicalSummary>Revisió de la IA</TechnicalSummary>
                    <TechnicalContent>
                      <JsonBlock>
                        {formatUnknownValue(selectedAnalysisDetail.ai_review)}
                      </JsonBlock>
                    </TechnicalContent>
                  </TechnicalDetails>
                  <TechnicalDetails>
                    <TechnicalSummary>
                      Senyals d’adreces conegudes
                    </TechnicalSummary>
                    <TechnicalContent>
                      <JsonBlock>
                        {formatUnknownValue(
                          selectedAnalysisDetail.known_address_signals,
                        )}
                      </JsonBlock>
                    </TechnicalContent>
                  </TechnicalDetails>
                  <TechnicalDetails>
                    <TechnicalSummary>Veredicte complet</TechnicalSummary>
                    <TechnicalContent>
                      <JsonBlock>
                        {formatUnknownValue(
                          selectedAnalysisDetail.final_verdict,
                        )}
                      </JsonBlock>
                    </TechnicalContent>
                  </TechnicalDetails>
                  <TechnicalDetails>
                    <TechnicalSummary>Rendiment</TechnicalSummary>
                    <TechnicalContent>
                      <JsonBlock>
                        {formatUnknownValue(selectedAnalysisDetail.performance)}
                      </JsonBlock>
                    </TechnicalContent>
                  </TechnicalDetails>
                  <TechnicalDetails>
                    <TechnicalSummary>Metadades d’avaluació</TechnicalSummary>
                    <TechnicalContent>
                      <JsonBlock>
                        {formatUnknownValue(selectedAnalysisDetail.evaluation)}
                      </JsonBlock>
                    </TechnicalContent>
                  </TechnicalDetails>
                </DetailPanel>
              ) : null}
            </HistoryLayout>
          </HistorySection>
        </ViewSection>
      ) : null}

      {activeView === 'addresses' ? (
        <ViewSection
          id="addresses-panel"
          role="tabpanel"
          aria-labelledby="addresses-tab"
        >
          <SectionHeader>
            <SectionHeadingGroup>
              <DashboardTitle id="addresses-title">
                Adreces conegudes
              </DashboardTitle>
              <SectionDescription>
                Consulta les fonts de context i incorpora etiquetes locals.
              </SectionDescription>
            </SectionHeadingGroup>
            <SmallButton
              type="button"
              onClick={() => {
                loadKnownAddresses().catch(
                  reportUnexpectedError('actualitzant les adreces'),
                );
              }}
              disabled={isLoadingKnownAddresses}
            >
              <RefreshCw size={16} aria-hidden="true" />
              {isLoadingKnownAddresses ? 'Actualitzant...' : 'Actualitzar'}
            </SmallButton>
          </SectionHeader>

          <AddressWorkspace>
            <KnownAddressesSection>
              <FilterBar>
                <SearchInput
                  value={knownAddressSearch}
                  onChange={(event) =>
                    setKnownAddressSearch(event.target.value)
                  }
                  placeholder="Cercar per adreça, etiqueta o font"
                  aria-label="Cercar adreces conegudes"
                />
                <SelectInput
                  value={knownAddressType}
                  onChange={(event) => setKnownAddressType(event.target.value)}
                  aria-label="Filtrar les adreces per tipus"
                >
                  <option value="all">Tots els tipus</option>
                  <option value="warning">Advertiment</option>
                  <option value="suspicious">Sospitosa</option>
                  <option value="scam">Estafa</option>
                  <option value="blacklisted">Llista de bloqueig</option>
                  <option value="trusted">De confiança</option>
                  <option value="test_contract">Contracte de prova</option>
                  <option value="own_contract">Contracte propi</option>
                </SelectInput>
                <SmallButton
                  type="button"
                  onClick={() => {
                    loadKnownAddresses().catch(
                      reportUnexpectedError('filtrant les adreces'),
                    );
                  }}
                  disabled={isLoadingKnownAddresses}
                >
                  <Search size={16} aria-hidden="true" />
                  Aplicar
                </SmallButton>
              </FilterBar>

              {knownAddressesError ? (
                <ErrorMessage>
                  <b>Error carregant les adreces:</b> {knownAddressesError}
                </ErrorMessage>
              ) : null}

              <TableWrapper>
                {knownAddresses.length === 0 ? (
                  <EmptyState>
                    {isLoadingKnownAddresses
                      ? 'Carregant les adreces conegudes...'
                      : 'No hi ha adreces conegudes per mostrar.'}
                  </EmptyState>
                ) : (
                  <HistoryTable>
                    <TableHead>
                      <tr>
                        <TableHeader>Adreça</TableHeader>
                        <TableHeader>Etiqueta</TableHeader>
                        <TableHeader>Tipus</TableHeader>
                        <TableHeader>Font</TableHeader>
                        <TableHeader>Afegida</TableHeader>
                      </tr>
                    </TableHead>
                    <tbody>
                      {knownAddresses.map((item) => {
                        const addressRisk = getAddressRisk(item.type);

                        return (
                          <tr key={item.id}>
                            <TableCell title={item.address}>
                              {shortenAddress(item.address)}
                            </TableCell>
                            <TableCell>{item.label ?? '—'}</TableCell>
                            <TableCell>
                              <RiskBadge $risk={addressRisk}>
                                {getAddressTypeLabel(item.type)}
                              </RiskBadge>
                            </TableCell>
                            <TableCell>{getSourceLabel(item.source)}</TableCell>
                            <TableCell>
                              {formatHistoryDate(item.added)}
                            </TableCell>
                          </tr>
                        );
                      })}
                    </tbody>
                  </HistoryTable>
                )}
              </TableWrapper>
            </KnownAddressesSection>

            <FormPanel>
              <ManualReportSection>
                <DashboardTitle>Informe manual</DashboardTitle>
                <QuickActionsDescription>
                  Afegeix una adreça al conjunt de dades local per aportar
                  context a les anàlisis posteriors.
                </QuickActionsDescription>

                <FormField>
                  <FieldLabel htmlFor="manual-address">
                    Adreça Ethereum
                  </FieldLabel>
                  <SearchInput
                    id="manual-address"
                    value={manualAddress}
                    onChange={(event) => setManualAddress(event.target.value)}
                    placeholder="0x..."
                  />
                </FormField>
                <FormField>
                  <FieldLabel htmlFor="manual-label">
                    Etiqueta o descripció
                  </FieldLabel>
                  <SearchInput
                    id="manual-label"
                    value={manualLabel}
                    onChange={(event) => setManualLabel(event.target.value)}
                    placeholder="Context de l’adreça"
                  />
                </FormField>
                <FormField>
                  <FieldLabel htmlFor="manual-type">Tipus</FieldLabel>
                  <SelectInput
                    id="manual-type"
                    value={manualType}
                    onChange={(event) => setManualType(event.target.value)}
                  >
                    <option value="warning">Advertiment</option>
                    <option value="suspicious">Sospitosa</option>
                    <option value="scam">Estafa</option>
                    <option value="blacklisted">Llista de bloqueig</option>
                    <option value="trusted">De confiança</option>
                    <option value="test_contract">Contracte de prova</option>
                    <option value="own_contract">Contracte propi</option>
                  </SelectInput>
                </FormField>

                <SmallButton
                  type="button"
                  onClick={() => {
                    submitManualReport().catch(
                      reportUnexpectedError('desant l’informe manual'),
                    );
                  }}
                  disabled={isSubmittingManualReport}
                >
                  <Database size={16} aria-hidden="true" />
                  {isSubmittingManualReport
                    ? 'Desant...'
                    : 'Afegir al conjunt local'}
                </SmallButton>

                {manualReportMessage ? (
                  <FormMessage $success={manualReportSuccess}>
                    {manualReportMessage}
                  </FormMessage>
                ) : null}
              </ManualReportSection>
            </FormPanel>
          </AddressWorkspace>
        </ViewSection>
      ) : null}

      {activeView === 'tests' ? (
        <ViewSection
          id="tests-panel"
          role="tabpanel"
          aria-labelledby="tests-tab"
        >
          <QuickActionsSection>
            <QuickActionsHeader>
              <QuickActionsTitle id="tests-title">
                Eines de prova
              </QuickActionsTitle>
              <QuickActionsDescription>
                Connexió, comprovacions manuals i validació del Snap durant el
                desenvolupament.
              </QuickActionsDescription>
            </QuickActionsHeader>

            {error ? (
              <ErrorMessage>
                <b>S’ha produït un error:</b> {error.message}
              </ErrorMessage>
            ) : null}

            <QuickActionsGrid>
              {isMetaMaskReady ? null : (
                <Card
                  content={{
                    title: 'Instal·lar MetaMask Flask',
                    description:
                      'Instal·la una versió compatible amb Snaps per executar les proves locals.',
                    button: <InstallFlaskButton />,
                  }}
                  disabled={false}
                />
              )}

              {installedSnap ? null : (
                <Card
                  content={{
                    title: 'Connectar el Snap',
                    description:
                      'Instal·la i connecta el Snap local abans d’analitzar transaccions.',
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

              {shouldDisplayReconnectButton(installedSnap) ? (
                <Card
                  content={{
                    title: 'Reconnectar el Snap',
                    description:
                      'Actualitza la connexió després d’un canvi de codi o un reinici de l’entorn.',
                    button: (
                      <ReconnectButton
                        onClick={requestSnap}
                        disabled={!installedSnap}
                      />
                    ),
                  }}
                  disabled={!installedSnap}
                />
              ) : null}

              <Card
                content={{
                  title: 'Comprovar el diàleg',
                  description:
                    'Verifica la comunicació entre la DApp, MetaMask i el Snap.',
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
                  title: 'Executar una anàlisi manual',
                  description:
                    'Envia una operació simulada per validar el flux complet amb el backend.',
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
                  title: 'Provar una transacció real',
                  description:
                    'Obre una transacció de prova i comprova la intercepció automàtica de MetaMask.',
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
          </QuickActionsSection>
        </ViewSection>
      ) : null}
    </Container>
  );
};

export default Index;
