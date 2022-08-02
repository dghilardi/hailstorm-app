import { MenuItem } from "@mui/material";
import Select, { SelectChangeEvent } from "@mui/material/Select";
import { useEditorStore } from "store/editor";

export function BackendSelect() {
    const backends = useEditorStore(store => store.backends);
    const selectedBackend = useEditorStore(store => store.selectedBackend);
    const updateSelectedBackend = useEditorStore(store => store.updateSelectedBackend);

    const handleChangeBackend = (event: SelectChangeEvent<number>) => {
        updateSelectedBackend(event.target.value as number);
    };

    if (backends.length <= 1) {
        return <></>;
    }
    return <Select value={selectedBackend} onChange={handleChangeBackend}>
        {backends.map((backend, idx) => <MenuItem value={idx}>{backend.name}</MenuItem>)}
    </Select>;
}