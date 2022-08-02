import * as React from 'react';
import Box from '@mui/material/Box';
import Editor from './components/Editor';
import Button from '@mui/material/Button';
import SendIcon from '@mui/icons-material/Send';
import SsidChartIcon from '@mui/icons-material/SsidChart';
import NotesIcon from '@mui/icons-material/Notes';
import PublishIcon from '@mui/icons-material/Publish';
import Stack from '@mui/material/Stack';
import { ExpressionPanel } from './components/ExpressionPanel';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { useEditorStore } from 'store/editor';
import ToggleButton from '@mui/material/ToggleButton';
import { ChartPanel } from './components/ChartPanel';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';

export default function App() {
  let view = useEditorStore(store => store.editorView);
  let setView = useEditorStore(store => store.updateEditorView);
  let snackbarParams = useEditorStore(store => store.snackbar);
  let closeSnackbar = useEditorStore(store => store.closeSnackbar);
  let openSnackbar = useEditorStore(store => store.openSnackbar);
  let loadSimulation = useEditorStore(store => store.loadSimulation);
  let launchSimulation = useEditorStore(store => store.launchSimulation);

  let handleSimulationLoad = () => {
    loadSimulation()
    .then(res => { 
      if (res.outcome === 'ok') {
        openSnackbar('Simulation loaded', 'info');
      } else {
        openSnackbar('Error loading simulation', 'error')
      }
    })
      .catch(err => openSnackbar('Error loading simulation', 'error'));
  };

  let handleSimulationStart = () => {
    launchSimulation()
      .then(res => { 
        if (res.outcome === 'ok') {
          openSnackbar('Simulation started', 'info');
        } else {
          openSnackbar('Error starting simulation', 'error')
        }
      })
      .catch(err => openSnackbar('Error starting simulation', 'error'));
  };
  return (
    <>
      <Stack direction="row" justifyContent="flex-end" spacing={2} padding={2}>
        <ToggleButtonGroup
          value={view}
          exclusive
          onChange={(_, view) => setView(view)}
          aria-label="editor view"
        >
          <ToggleButton value="editor" aria-label="editor">
            <NotesIcon />
          </ToggleButton>
          <ToggleButton value="chart" aria-label="chart">
            <SsidChartIcon />
          </ToggleButton>
        </ToggleButtonGroup>
        <Box sx={{ flex: 1 }} />
        <Button variant="contained" endIcon={<PublishIcon />} onClick={handleSimulationLoad}>
          Load
        </Button>
        <Button variant="contained" endIcon={<SendIcon />} onClick={handleSimulationStart}>
          Start
        </Button>
      </Stack>
      <Box sx={{ flexGrow: 1 }}>
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