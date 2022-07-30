import * as React from 'react';
import Box from '@mui/material/Box';
import Editor from './components/Editor';
import Button from '@mui/material/Button';
import SendIcon from '@mui/icons-material/Send';
import PublishIcon from '@mui/icons-material/Publish';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Grid from '@mui/material/Grid';
import { ExpressionPanel } from './components/ExpressionPanel';

export default function App() {
  return (
    <>
      <Stack direction="row" justifyContent="flex-end" spacing={2} padding={2}>
        <Button variant="contained" endIcon={<PublishIcon />}>
          Load
        </Button>
        <Button variant="contained" endIcon={<SendIcon />}>
          Start
        </Button>
      </Stack>
      <Box sx={{ flexGrow: 1 }}>
        <Editor />
      </Box>
      <ExpressionPanel />
    </>
  );
}