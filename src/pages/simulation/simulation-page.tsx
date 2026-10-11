import * as React from 'react';
import Box from '@mui/material/Box';
import Editor from './components/Editor';
import Button from '@mui/material/Button';
import SendIcon from '@mui/icons-material/Send';
import SsidChartIcon from '@mui/icons-material/SsidChart';
import NotesIcon from '@mui/icons-material/Notes';
import PublishIcon from '@mui/icons-material/Publish';
import StopIcon from '@mui/icons-material/Stop';
import Stack from '@mui/material/Stack';
import { ExpressionPanel } from './components/ExpressionPanel';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { canLoadSimulation, canStartSimulation, canStopSimulation, useEditorStore } from 'store/editor';
import ToggleButton from '@mui/material/ToggleButton';
import { ChartPanel } from './components/ChartPanel';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { BackendSelect } from './components/BackendSelect';
import { StatusPanel } from './components/StatusPanel';
import { isDesktop } from 'services/platform';

export default function App() {
  let view = useEditorStore(store => store.editorView);
  let setView = useEditorStore(store => store.updateEditorView);
  let snackbarParams = useEditorStore(store => store.snackbar);
  let closeSnackbar = useEditorStore(store => store.closeSnackbar);
  let openSnackbar = useEditorStore(store => store.openSnackbar);
  let loadSimulation = useEditorStore(store => store.loadSimulation);
  let launchSimulation = useEditorStore(store => store.launchSimulation);
  const stopSimulation = useEditorStore(store => store.stopSimulation);
  const handleMenuEvent = useEditorStore(store => store.handleMenuEvent);
  const canLoad = useEditorStore(canLoadSimulation);
  const canStart = useEditorStore(canStartSimulation);
  const canStop = useEditorStore(canStopSimulation);
  const operation = useEditorStore(store => store.operation);

  let handleSimulationLoad = () => {
    loadSimulation()
    .then(res => { 
      if (res.outcome === 'ok') {
        openSnackbar(res.simulation_id ? 'Simulation sent to agents' : 'Simulation loaded', 'info');
      } else {
        console.error(`loadSimulation outcome is not ok -> ${res.message}`);
        openSnackbar(res.message || 'Error loading simulation', 'error')
      }
    })
      .catch(err => {
        console.error(`Error during loadSimulation ${err}`);
        openSnackbar(err instanceof Error ? err.message : 'Error loading simulation', 'error')
      });
  };

  let handleSimulationStart = () => {
    launchSimulation()
      .then(res => { 
        if (res.outcome === 'ok') {
          openSnackbar('Start requested', 'info');
        } else {
          console.error(`launchSimulation outcome is not ok -> ${res.message}`);
          openSnackbar('Error starting simulation', 'error')
        }
      })
      .catch(err => {
        console.error(`Error during launchSimulation ${err}`);
        openSnackbar(err instanceof Error ? err.message : 'Error starting simulation', 'error')
      });
  };
  const handleSimulationStop = () => {
    stopSimulation()
      .then(() => openSnackbar('Stop requested', 'info'))
      .catch(error => openSnackbar(error instanceof Error ? error.message : 'Error stopping simulation', 'error'));
  };
  return (
    <>
      {!isDesktop() && <Stack direction="row" spacing={1} sx={{ px: 2, pt: 1 }}>
        <Button onClick={() => handleMenuEvent('new')}>New</Button>
        <Button onClick={() => handleMenuEvent('open')}>Import</Button>
        <Button onClick={() => handleMenuEvent('save')}>Export</Button>
      </Stack>}
      <Stack direction="row" justifyContent="flex-end" gap={2} padding={2} sx={{ flexWrap: 'wrap' }}>
        <ToggleButtonGroup
          value={view}
          exclusive
          onChange={(_, view) => { if (view) setView(view); }}
          aria-label="editor view"
        >
          <ToggleButton value="editor" aria-label="editor">
            <NotesIcon />
          </ToggleButton>
          <ToggleButton value="chart" aria-label="chart">
            <SsidChartIcon />
          </ToggleButton>
        </ToggleButtonGroup>
        <BackendSelect />
        <Box sx={{ flex: 1 }} />
        <Button variant="contained" endIcon={<PublishIcon />} onClick={handleSimulationLoad} disabled={!canLoad}>
          {operation === 'load' ? 'Loading…' : 'Load'}
        </Button>
        <Button variant="contained" endIcon={<SendIcon />} onClick={handleSimulationStart} disabled={!canStart}>
          {operation === 'start' ? 'Starting…' : 'Start'}
        </Button>
        <Button variant="outlined" endIcon={<StopIcon />} onClick={handleSimulationStop} disabled={!canStop}>
          {operation === 'stop' ? 'Stopping…' : 'Stop'}
        </Button>
      </Stack>
      <StatusPanel />
      <Box sx={{ flexGrow: 1, minHeight: 240 }}>
        {view === 'editor'
          ? <Editor />
          : <ChartPanel />
        }
      </Box>
      <ExpressionPanel />
      <Snackbar anchorOrigin={{ vertical: 'top', horizontal: 'center' }} open={snackbarParams.open} autoHideDuration={6000} onClose={closeSnackbar}>
        <Alert severity={snackbarParams.severity} sx={{ width: '100%' }} onClose={closeSnackbar}>
          {snackbarParams.message}
        </Alert>
      </Snackbar>
    </>
  );
}
