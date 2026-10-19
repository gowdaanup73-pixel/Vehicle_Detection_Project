import React, { useEffect, useState } from 'react';
import { 
  deleteRun as apiDeleteRun,
  detectSample,
  fetchAnalyticsSummary, 
  fetchDatasetInfo, 
  fetchExperiments, 
  fetchHealth,
  fetchLosses, 
  fetchModelStatus, 
  listRuns, 
} from './api';
import { Sidebar } from './components/Sidebar';
import { 
  AnalyticsSummary, 
  DatasetInfo, 
  ExperimentItem, 
  LossPoint, 
  ModelStatus, 
  NavigationTab, 
  RunRecord 
} from './types';
import { DashboardView } from './views/DashboardView';
import { DetectionStudioView } from './views/DetectionStudioView';
import { TrafficAnalyticsView } from './views/TrafficAnalyticsView';
import { ModelLaboratoryView } from './views/ModelLaboratoryView';
import { DatasetRunsView } from './views/DatasetRunsView';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [selectedRun, setSelectedRun] = useState<RunRecord | null>(null);
  const [experiments, setExperiments] = useState<ExperimentItem[]>([]);
  const [losses, setLosses] = useState<LossPoint[]>([]);
  const [datasetInfo, setDatasetInfo] = useState<DatasetInfo | null>(null);

  const [isProcessingSample, setIsProcessingSample] = useState<boolean>(false);
  const [isBackendHealthy, setIsBackendHealthy] = useState<boolean>(true);
  const [dashboardStagedFile, setDashboardStagedFile] = useState<File | null>(null);

  // Synchronize backend telemetry and runs
  const loadData = async (isBackgroundPoll: boolean = false) => {
    try {
      const [healthData, statusData, summaryData, runsData] = await Promise.all([
        fetchHealth().catch(() => null),
        fetchModelStatus().catch(() => null),
        fetchAnalyticsSummary().catch(() => null),
        listRuns().catch(() => null),
      ]);

      setIsBackendHealthy(healthData?.status === 'healthy');
      if (statusData) setModelStatus(statusData);
      if (summaryData) setSummary(summaryData);
      if (runsData) setRuns(runsData);

      // Only fetch experiments & dataset on initial load, not every poll
      if (!isBackgroundPoll) {
        const [expData, lossData, dataInfo] = await Promise.all([
          fetchExperiments().catch(() => ({ experiments: [] })),
          fetchLosses().catch(() => []),
          fetchDatasetInfo().catch(() => null),
        ]);
        if (expData?.experiments) setExperiments(expData.experiments);
        if (lossData) setLosses(lossData);
        if (dataInfo) setDatasetInfo(dataInfo);
      }
    } catch (err) {
      console.error('Data loading error:', err);
      setIsBackendHealthy(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadData(false);
  }, []);

  // Periodic automatic polling (every 5 seconds) to refresh telemetry without manual page reload
  useEffect(() => {
    const timer = setInterval(() => {
      loadData(true);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Immediate test runner
  const handleRunSample = async (mediaType: 'image' | 'video') => {
    setIsProcessingSample(true);
    try {
      const res = await detectSample(mediaType);
      if (res.saved_run) {
        setRuns((prev) => [res.saved_run, ...prev]);
        setSelectedRun(res.saved_run);
      }
      const sum = await fetchAnalyticsSummary();
      setSummary(sum);
    } catch (err) {
      console.error('Sample processing error:', err);
    } finally {
      setIsProcessingSample(false);
    }
  };

  // Dropzone file on dashboard switches to studio
  const handleUploadFromDashboard = (file: File) => {
    setDashboardStagedFile(file);
    setActiveTab('detection_studio');
  };

  const handleRunCompleted = (newRun: RunRecord) => {
    setRuns((prev) => [newRun, ...prev]);
    setSelectedRun(newRun);
    fetchAnalyticsSummary().then((s) => setSummary(s)).catch(() => {});
  };

  const handleDeleteRun = async (runId: string) => {
    try {
      await apiDeleteRun(runId);
      setRuns((prev) => prev.filter((r) => r.id !== runId));
      if (selectedRun?.id === runId) setSelectedRun(null);
      const sum = await fetchAnalyticsSummary();
      setSummary(sum);
    } catch (err) {
      console.error('Delete run error:', err);
    }
  };

  const latestVideoRun = runs.find((r) => r.media_type === 'video') || null;

  return (
    <div className="platform-layout">
      {/* Clean Charcoal Left Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        modelStatus={modelStatus}
        onRefresh={() => loadData(false)}
        isBackendHealthy={isBackendHealthy}
      />

      {/* Main Content Area */}
      <main className="platform-main">
        <div className="content-container">
          {activeTab === 'dashboard' && (
            <DashboardView
              summary={summary}
              runs={runs}
              modelStatus={modelStatus}
              onNavigate={setActiveTab}
              onSelectRun={(run) => {
                setSelectedRun(run);
                setActiveTab('history_dataset');
              }}
              onRunSample={handleRunSample}
              onUploadFile={handleUploadFromDashboard}
              isProcessing={isProcessingSample}
              isBackendHealthy={isBackendHealthy}
            />
          )}

          {activeTab === 'detection_studio' && (
            <DetectionStudioView
              modelStatus={modelStatus}
              onRunCompleted={handleRunCompleted}
              preselectedFile={dashboardStagedFile}
            />
          )}

          {activeTab === 'traffic_analytics' && (
            <TrafficAnalyticsView
              summary={summary}
              latestVideoRun={latestVideoRun}
              allRuns={runs}
            />
          )}

          {activeTab === 'model_laboratory' && (
            <ModelLaboratoryView
              experiments={experiments}
              losses={losses}
              modelStatus={modelStatus}
              onRefreshStatus={() => loadData(false)}
            />
          )}

          {activeTab === 'history_dataset' && (
            <DatasetRunsView
              datasetInfo={datasetInfo}
              runs={runs}
              selectedRun={selectedRun}
              onSelectRun={setSelectedRun}
              onDeleteRun={handleDeleteRun}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
