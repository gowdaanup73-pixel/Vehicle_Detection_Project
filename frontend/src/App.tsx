import React, { useEffect, useState } from 'react';
import { 
  fetchAnalyticsSummary, 
  fetchDatasetInfo, 
  fetchExperiments, 
  fetchLosses, 
  fetchModelStatus, 
  listRuns, 
  deleteRun as apiDeleteRun,
  detectSample,
} from './api';
import { Header } from './components/Header';
import { 
  AnalyticsSummary, 
  DatasetInfo, 
  ExperimentItem, 
  LossPoint, 
  ModelStatus, 
  NavigationTab, 
  RunRecord 
} from './types';
import { CommandCenterView } from './views/CommandCenterView';
import { DetectionStudioView } from './views/DetectionStudioView';
import { TrafficAnalyticsView } from './views/TrafficAnalyticsView';
import { ModelLaboratoryView } from './views/ModelLaboratoryView';
import { DatasetRunsView } from './views/DatasetRunsView';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavigationTab>('command_center');
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [selectedRun, setSelectedRun] = useState<RunRecord | null>(null);
  const [experiments, setExperiments] = useState<ExperimentItem[]>([]);
  const [losses, setLosses] = useState<LossPoint[]>([]);
  const [datasetInfo, setDatasetInfo] = useState<DatasetInfo | null>(null);
  const [isProcessingSample, setIsProcessingSample] = useState<boolean>(false);

  const loadData = async () => {
    try {
      const [statusData, summaryData, runsData, expData, lossData, dataInfo] = await Promise.all([
        fetchModelStatus().catch(() => null),
        fetchAnalyticsSummary().catch(() => null),
        listRuns().catch(() => []),
        fetchExperiments().catch(() => ({ experiments: [] })),
        fetchLosses().catch(() => []),
        fetchDatasetInfo().catch(() => null),
      ]);

      if (statusData) setModelStatus(statusData);
      if (summaryData) setSummary(summaryData);
      if (runsData) setRuns(runsData);
      if (expData?.experiments) setExperiments(expData.experiments);
      if (lossData) setLosses(lossData);
      if (dataInfo) setDatasetInfo(dataInfo);
    } catch (err) {
      console.error('Initial data loading error:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRunSample = async (mediaType: 'image' | 'video') => {
    setIsProcessingSample(true);
    try {
      const res = await detectSample(mediaType);
      if (res.saved_run) {
        setRuns((prev) => [res.saved_run, ...prev]);
        setSelectedRun(res.saved_run);
      }
      // Refresh summary
      const sum = await fetchAnalyticsSummary();
      setSummary(sum);
    } catch (err) {
      console.error('Error running sample:', err);
    } finally {
      setIsProcessingSample(false);
    }
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
    <div className="app-shell">
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        modelStatus={modelStatus}
        onRefresh={loadData}
      />

      <main className="main-content">
        {activeTab === 'command_center' && (
          <CommandCenterView
            summary={summary}
            runs={runs}
            modelStatus={modelStatus}
            onNavigate={setActiveTab}
            onSelectRun={(run) => setSelectedRun(run)}
            onRunSample={handleRunSample}
            isProcessing={isProcessingSample}
          />
        )}

        {activeTab === 'detection_studio' && (
          <DetectionStudioView
            modelStatus={modelStatus}
            onRunCompleted={handleRunCompleted}
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
            onRefreshStatus={loadData}
          />
        )}

        {activeTab === 'dataset_runs' && (
          <DatasetRunsView
            datasetInfo={datasetInfo}
            runs={runs}
            selectedRun={selectedRun}
            onSelectRun={setSelectedRun}
            onDeleteRun={handleDeleteRun}
          />
        )}
      </main>
    </div>
  );
};

export default App;
