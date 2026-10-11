import * as React from 'react';
import Box from '@mui/material/Box';
import SimulationPage from './pages/simulation/simulation-page';
import { useEditorStore } from 'store/editor';
import { useEffect } from 'react';
import { Event, listen } from "@tauri-apps/api/event";
import { loadConfig } from 'services/config';
import { readParams } from 'params';
import { isDesktop } from 'services/platform';

export default function App() {
  const menuEventHandler = useEditorStore(store => store.handleMenuEvent);
  const configUpdater = useEditorStore(store => store.updateConfig);
  const loadFile = useEditorStore(store => store.loadSimulationFile);
  const openSnackbar = useEditorStore(store => store.openSnackbar);
  useEffect(() => {
    loadConfig().then(configUpdater).catch(error => openSnackbar(String(error), 'error'));
  }, [configUpdater, openSnackbar]);
  useEffect(() => {
    if (!isDesktop()) return;
    let unlistenPromise = listen("menu_event", (event: Event<string>) => {
      menuEventHandler(event.payload);
    });
    unlistenPromise.catch(error => openSnackbar(String(error), 'error'));
    return () => { unlistenPromise.then(unlistenFn => unlistenFn()).catch(() => {}) };
  }, [menuEventHandler, openSnackbar]);

  useEffect(() => {
    readParams().then(params => {
      if (params.projectPath) {
        loadFile(params.projectPath);
      }
    }).catch(error => openSnackbar(String(error), 'error'));
  }, [loadFile, openSnackbar]);

  return (
    <Box flexDirection="column" sx={{ display: 'flex', height: '100vh' }}>
      <SimulationPage />
    </Box>
  );
}
