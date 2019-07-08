import sass from 'rollup-plugin-sass';
import uglify from 'rollup-plugin-uglify';
import merge from 'deepmerge';

const dev = {
    input: 'src/index.js',
    output: {
        name: 'GanttChart',
        file: 'dist/gantt-chart.js',
        format: 'umd'
    },
    plugins: [
        sass({
            output: 'dist/gantt-chart.css'
        })
    ]
};
const prod = merge(dev, {
    output: {
        file: 'dist/gantt-chart.min.js'
    },
    plugins: [uglify()]
});

export default [dev, prod];
