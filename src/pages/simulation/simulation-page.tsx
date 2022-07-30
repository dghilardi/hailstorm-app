import * as React from 'react';
import Box from '@mui/material/Box';
import Editor from './components/Editor';
import Button from '@mui/material/Button';
import SendIcon from '@mui/icons-material/Send';
import SsidChartIcon from '@mui/icons-material/SsidChart';
import NotesIcon from '@mui/icons-material/Notes';
import PublishIcon from '@mui/icons-material/Publish';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Grid from '@mui/material/Grid';
import { ExpressionPanel } from './components/ExpressionPanel';
import { ButtonGroup } from '@mui/material';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { useEditorStore } from 'store/editor';
import ToggleButton from '@mui/material/ToggleButton';
import { ChartPanel } from './components/ChartPanel';

export default function App() {
  let view = useEditorStore(store => store.editorView);
  let setView = useEditorStore(store => store.updateEditorView);
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
        <Button variant="contained" endIcon={<PublishIcon />}>
          Load
        </Button>
        <Button variant="contained" endIcon={<SendIcon />}>
          Start
        </Button>
      </Stack>
      <Box sx={{ flexGrow: 1 }}>
        { view === 'editor'
            ? <Editor />
            : <ChartPanel />
        }
      </Box>
      <ExpressionPanel />
    </>
  );
}