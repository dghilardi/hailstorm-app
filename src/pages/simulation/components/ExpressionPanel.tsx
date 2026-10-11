import AddCircleIcon from "@mui/icons-material/AddCircle";
import DeleteIcon from "@mui/icons-material/Delete";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import { useEditorStore } from "store/editor";

interface ExpressionLineParams {
    idx: number,
    showAddIcon: boolean,
    showDeleteIcon: boolean,
}

export function ExpressionLine(p: ExpressionLineParams) {
    const expressionIncrementer = useEditorStore(store => store.addExpression);
    const expressionRemover = useEditorStore(store => store.remExpression);
    const modelName = useEditorStore(store => store.expressions[p.idx].model);
    const modelExpr = useEditorStore(store => store.expressions[p.idx].expression);
    const setModelExpression = useEditorStore(store => store.updateModelExpression);
    const setModelName = useEditorStore(store => store.updateModelName);
    
    return <>
        <Grid item xs={12} sm={3}>
            <TextField fullWidth id={`model-input-${p.idx}`} label="Model" variant="outlined" value={modelName} onChange={e => setModelName(p.idx, e.target.value)} />
        </Grid>
        <Grid item xs={12} sm={9} sx={{display: 'flex'}}>
            <TextField fullWidth id={`expression-input-${p.idx}`} label="Expression" variant="outlined" value={modelExpr} onChange={e => setModelExpression(p.idx, e.target.value)} />
            {p.showAddIcon? <IconButton color="primary" aria-label="Add model" size="large" onClick={expressionIncrementer}>
                <AddCircleIcon />
            </IconButton>: <></>}
            {p.showDeleteIcon ? <IconButton color="primary" aria-label={`Remove model ${p.idx + 1}`} size="large" onClick={() => expressionRemover(p.idx)}>
                <DeleteIcon />
            </IconButton>: <></>}
        </Grid>
    </>;
}

export function ExpressionPanel() {
    let expressionCount = useEditorStore((store) => store.expressions.length);
    return <Grid container spacing={2} padding={2}>
        {Array.from(new Array(expressionCount).keys()).map(idx => <ExpressionLine key={`expr-item-${idx}`} idx={idx} showAddIcon={idx===expressionCount-1} showDeleteIcon={expressionCount>1} />)}
    </Grid>;
}
