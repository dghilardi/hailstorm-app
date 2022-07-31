import * as React from 'react';
import Box from '@mui/material/Box';
import SimulationPage from './pages/simulation/simulation-page';
import { useEditorStore } from 'store/editor';
import { useEffect } from 'react';
import { Event, listen } from "@tauri-apps/api/event";

export default function App() {
  const menuEventHandler = useEditorStore(store => store.handleMenuEvent);
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