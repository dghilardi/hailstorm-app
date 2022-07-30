import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { GRUVBOX } from 'theme/gruvbox';

const data = Array.from(new Array(1000).keys())
    .map(tick => tick * 3.6)
    .map(ts => ({ name: `${Math.floor(ts/60)}:${ts%60}`, uv: 1000*Math.pow(Math.sin(ts/100),2), pv: 2400, amt: 2400 }));

export function ChartPanel() {
    return <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <Line dot={false} isAnimationActive={false} type="monotone" dataKey="uv" stroke={GRUVBOX.AQUA_14} />
            <CartesianGrid stroke={GRUVBOX.GRAY_7} strokeDasharray="5 5" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
        </LineChart>
    </ResponsiveContainer>;
}