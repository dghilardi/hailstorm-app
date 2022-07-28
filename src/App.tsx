import * as React from 'react';
import Box from '@mui/material/Box';
import Editor from './Editor';
import Button from '@mui/material/Button';
import SendIcon from '@mui/icons-material/Send';
import PublishIcon from '@mui/icons-material/Publish';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Grid from '@mui/material/Grid';

export default function App() {
  return (
    <Box flexDirection="column" sx={{ display: 'flex', height: '100vh' }}>
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
      <Grid container spacing={2} padding={2}>
        <Grid item xs={3}>
          <TextField fullWidth id="model-input" label="Model" variant="outlined" defaultValue="Hailstone" />
        </Grid>
        <Grid item xs={8}>
          <TextField fullWidth id="expression-input" label="Expression" variant="outlined" defaultValue="10*rect(t/120)" />
        </Grid>
      </Grid>
    </Box>
  );
}