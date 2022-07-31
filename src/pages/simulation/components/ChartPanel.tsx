import { useEffect } from 'react';
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useEditorStore } from 'store/editor';
import { GRUVBOX } from 'theme/gruvbox';

const CHART_COLORS = [
    GRUVBOX.RED_1,
    GRUVBOX.GREEN_2,
    GRUVBOX.YELLOW_3,
    GRUVBOX.BLUE_4,
    GRUVBOX.PURPLE_5,
    GRUVBOX.AQUA_6,
    GRUVBOX.RED_9,
    GRUVBOX.GREEN_10,
    GRUVBOX.YELLOW_11,
    GRUVBOX.BLUE_12,
    GRUVBOX.PURPLE_13,
    GRUVBOX.AQUA_14,
    GRUVBOX.ORANGE,
    GRUVBOX.ORANGE_BRIGHT,
];

export function ChartPanel() {
    const expressions = useEditorStore(store => store.expressions);
    const fetchChartData = useEditorStore(store => store.fetchChartData);
    const chartData = useEditorStore(store => store.chartData);
    useEffect(() => { fetchChartData(); }, [expressions, fetchChartData]);

    const data = chartData.xs.map((v, idx) => ({
        name: fmtTimestamp(v),
        ...chartData.models.reduce((acc, model) => ({...acc, [model.name]: model.ys[idx]}), {}),
    }));

    const modelNames = chartData.models.map(model => model.name);

    return <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            { modelNames.map((name, idx) =>
                <Line key={`chart-line-${idx}`} dot={false} isAnimationActive={false} type="monotone" dataKey={name} stroke={CHART_COLORS[idx]} />
            )}
            <CartesianGrid stroke={GRUVBOX.GRAY_7} strokeDasharray="5 5" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip contentStyle={{backgroundColor: GRUVBOX.BG0_H }} />
        </LineChart>
    </ResponsiveContainer>;
}

function fmtTimestamp(sec_num: number) {
    var hours   = Math.floor(sec_num / 3600);
    var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
    var seconds = sec_num - (hours * 3600) - (minutes * 60);

    if (hours > 0) {
        return `${padded(hours)}:${padded(minutes)}:${padded(seconds)}`;
    } else {
        return `${padded(minutes)}:${padded(seconds)}`;
    }
}

function padded(num: number): string {
    if (num < 10) {
        return `0${num}`;
    } else {
        return `${num}`;
    }
}