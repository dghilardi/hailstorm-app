import * as React from 'react';
import Box from '@mui/material/Box';
import SimulationPage from './pages/simulation/simulation-page';
import { useEditorStore } from 'store/editor';
import { useEffect } from 'react';
import { Event, listen } from "@tauri-apps/api/event";
import { loadConfig } from 'services/config';

export default function App() {
  const menuEventHandler = useEditorStore(store => store.handleMenuEvent);
  const configUpdater = useEditorStore(store => store.updateConfig);
  useEffect(() => { loadConfig().then(configUpdater) }, [configUpdater]);
  useEffect(() => {
    let unlistenPromise = listen("menu_event", (event: Event<string>) => {
      menuEventHandler(event.payload);
    });
    return () => { unlistenPromise.then(unlistenFn => unlistenFn()) };
  }, [menuEventHandler]);
  return (
    <Box flexDirection="column" sx={{ display: 'flex', height: '100vh' }}>
      <SimulationPage />
    </Box>
  );
}