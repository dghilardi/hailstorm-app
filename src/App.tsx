import * as React from 'react';
import Box from '@mui/material/Box';
import Editor from './Editor';
import Button from '@mui/material/Button';
import SendIcon from '@mui/icons-material/Send';
import PublishIcon from '@mui/icons-material/Publish';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';

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
      <Box sx={{ height: 'calc(80vh - 68.5px)' }}>
        <Editor />
      </Box>
    </>
  );
}