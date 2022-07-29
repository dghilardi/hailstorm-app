import * as React from 'react';
import Box from '@mui/material/Box';
import SimulationPage from './pages/simulation/simulation-page';

export default function App() {
  return (
    <Box flexDirection="column" sx={{ display: 'flex', height: '100vh' }}>
      <SimulationPage />
    </Box>
  );
}