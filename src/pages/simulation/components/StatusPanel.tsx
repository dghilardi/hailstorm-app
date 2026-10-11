import { useEffect } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useEditorStore } from 'store/editor';

export function StatusPanel() {
    const status = useEditorStore(state => state.simulationStatus);
    const supported = useEditorStore(state => state.statusSupported);
    const error = useEditorStore(state => state.statusError);
    const phase = useEditorStore(state => state.legacyPhase);
    const epoch = useEditorStore(state => state.backendEpoch);
    const refreshStatus = useEditorStore(state => state.refreshStatus);

    useEffect(() => {
        let stopped = false;
        let timer: number;
        const refresh = async () => {
            const state = useEditorStore.getState();
            if (!state.operation && state.statusSupported !== false) await refreshStatus();
            if (!stopped) timer = window.setTimeout(refresh, 2000);
        };
        refresh();
        return () => { stopped = true; window.clearTimeout(timer); };
    }, [epoch, refreshStatus]);

    const labels = { idle: 'Idle', pending: 'Waiting for agents', ready: 'Ready', running: 'Running', failed: 'Failed' };
    return <Box sx={{ px: 2, pb: 1, overflowWrap: 'anywhere' }}>
        <Typography role="status" variant="body2">
            {error ? 'Backend unavailable' : supported === false
                ? `${phase === 'idle' ? 'Idle' : phase === 'ready' ? 'Loaded' : 'Start requested'} · Live status unavailable`
                : status ? labels[status.outcome] : 'Checking simulation status…'}
            {status?.simulation_id && ` · ${status.simulation_id}`}
        </Typography>
        {supported === false && <Typography variant="caption">This backend does not support live status or Stop. Load and Start remain available.</Typography>}
        {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
        {status?.agents.filter(agent => agent.error && agent.simulation_id === status.simulation_id).map(agent =>
            <Alert key={agent.agent_id} severity="error" sx={{ mt: 1 }}>Agent {agent.agent_id}: {agent.error}</Alert>)}
        {!!status?.agents.length && <details>
            <summary>{status.agents.length} agents · {status.agents.filter(agent => agent.simulation_id === status.simulation_id && agent.state === 'ready' && !agent.error).length} ready</summary>
            {status.agents.map(agent => <Typography key={agent.agent_id} variant="body2" sx={{ py: 0.5 }}>
                Agent {agent.agent_id}: {agent.state}
                {agent.simulation_id !== status.simulation_id && ' · Previous run'}
                {agent.error && ` · ${agent.error}`}
            </Typography>)}
        </details>}
    </Box>;
}
