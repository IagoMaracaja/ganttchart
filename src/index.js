import date_utils from './date_utils';
import { $, createSVG } from './svg_utils';
import Bar from './bar';
import Popup from './popup';

import './gantt.scss';
import Filter from './filter';

export default class GanttChart {
    constructor(wrapper, tasks, options) {
        this.createVars();
        this.setup_wrapper(wrapper);
        this.setup_options(options);
        this.setup_tasks(tasks);
        // initialize with default view mode
        this.change_view_mode();
        this.bind_events();
    }

    createVars() {
        this.startPosition = 200;
        this.dateStartPosition = 210;
        this.taskLevelOneQty = 0;
    }

    setup_wrapper(element) {
        let svg_element, wrapper_element;

        // CSS Selector is passed
        if (typeof element === 'string') {
            element = document.querySelector(element);
        }

        // get the SVGElement
        if (element instanceof HTMLElement) {
            wrapper_element = element;
            svg_element = element.querySelector('svg');
        } else if (element instanceof SVGElement) {
            svg_element = element;
        } else {
            throw new TypeError(
                'Gantt only supports usage of a string CSS selector,' +
                ' HTML DOM element or SVG DOM element for the \'element\' parameter'
            );
        }

        // svg element
        if (!svg_element) {
            // create it
            this.$svg = createSVG('svg', {
                append_to: wrapper_element,
                class: 'gantt'
            });
        } else {
            this.$svg = svg_element;
            this.$svg.classList.add('gantt');
        }

        // wrapper element
        this.$container = document.createElement('div');
        this.$container.classList.add('gantt-container');

        const parent_element = this.$svg.parentElement;
        parent_element.appendChild(this.$container);
        this.$container.appendChild(this.$svg);

        // popup wrapper
        this.popup_wrapper = document.createElement('div');
        this.popup_wrapper.classList.add('popup-wrapper-color');
        this.$container.appendChild(this.popup_wrapper);
    }

    setup_options(options) {
        const default_options = {
            header_height: 65,
            column_width: 30,
            step: 24,
            view_modes: [
                'Quarter Day',
                'Half Day',
                'Day',
                'Week',
                'Month',
                'Year'
            ],
            bar_height: 50,
            bar_corner_radius: 10,
            arrow_curve: 5,
            padding: 10,
            view_mode: 'Day',
            date_format: 'YYYY-MM-DD',
            popup_trigger: 'click',
            custom_popup_html: null,
            language: 'en'
        };
        this.options = Object.assign({}, default_options, options);
    }

    setup_tasks(tasks) {
        this.allTasks = tasks;
        let allTasks = [];
        for (let tsk of tasks) {
            this.taskLevelOneQty += 1;
            const array = tsk.taskList;
            allTasks.push.apply(allTasks, array);
        }

        // prepare tasks
        this.tasks = allTasks.map((task, i) => {
            // convert to Date objects
            task._start = date_utils.parse(task.start);
            task._end = date_utils.parse(task.end);

            // make task invalid if duration too large
            if (date_utils.diff(task._end, task._start, 'year') > 10) {
                task.end = null;
            }

            // cache index
            task._index = i;

            // invalid dates
            if (!task.start && !task.end) {
                const today = date_utils.today();
                task._start = today;
                task._end = date_utils.add(today, 2, 'day');
            }

            if (!task.start && task.end) {
                task._start = date_utils.add(task._end, -2, 'day');
            }

            if (task.start && !task.end) {
                task._end = date_utils.add(task._start, 2, 'day');
            }

            // if hours is not set, assume the last day is full day
            // e.g: 2018-09-09 becomes 2018-09-09 23:59:59
            const task_end_values = date_utils.get_date_values(task._end);
            if (task_end_values.slice(3).every(d => d === 0)) {
                task._end = date_utils.add(task._end, 24, 'hour');
            }

            // invalid flag
            if (!task.start || !task.end) {
                task.invalid = true;
            }

            // dependencies
            if (typeof task.dependencies === 'string' || !task.dependencies) {
                let deps = [];
                if (task.dependencies) {
                    deps = task.dependencies
                        .split(',')
                        .map(d => d.trim())
                        .filter(d => d);
                }
                task.dependencies = deps;
            }

            // uids
            if (!task.id) {
                task.id = generate_id(task);
            }

            return task;
        });

        this.setup_dependencies();
    }

    setup_dependencies() {
        this.dependency_map = {};
        for (let t of this.tasks) {
            for (let d of t.dependencies) {
                this.dependency_map[d] = this.dependency_map[d] || [];
                this.dependency_map[d].push(t.id);
            }
        }
    }

    refresh(tasks) {
        this.setup_tasks(tasks);
        this.change_view_mode();
    }

    refreshByFilter(viewMode) {
        this.hide_popup();
        this.setup_tasks(this.allTasks);
        this.change_view_mode(viewMode);
    }

    change_view_mode(mode = this.options.view_mode) {
        this.update_view_scale(mode);
        this.setup_dates();
        this.render();
        // fire viewmode_change event
        this.trigger_event('view_change', [mode]);
    }

    update_view_scale(view_mode) {
        this.options.view_mode = view_mode;

        if (view_mode === 'Day') {
            this.options.step = 24;
            this.options.column_width = 38;
        } else if (view_mode === 'Half Day') {
            this.options.step = 24 / 2;
            this.options.column_width = 38;
        } else if (view_mode === 'Quarter Day') {
            this.options.step = 24 / 4;
            this.options.column_width = 38;
        } else if (view_mode === 'Week') {
            this.options.step = 24 * 7;
            this.options.column_width = 90;
        } else if (view_mode === 'Month') {
            this.options.step = 24 * 30;
            this.options.column_width = 90;
        } else if (view_mode === 'Year') {
            this.options.step = 24 * 365;
            this.options.column_width = 120;
        }
    }

    setup_dates() {
        this.setup_gantt_dates();
        this.setup_date_values();
    }

    setup_gantt_dates() {
        this.gantt_start = this.gantt_end = null;

        for (let task of this.tasks) {
            // set global start and end date
            if (!this.gantt_start || task._start < this.gantt_start) {
                this.gantt_start = task._start;
            }
            if (!this.gantt_end || task._end > this.gantt_end) {
                this.gantt_end = task._end;
            }
        }

        this.gantt_start = date_utils.start_of(this.gantt_start, 'day');
        this.gantt_end = date_utils.start_of(this.gantt_end, 'day');

        // add date padding on both sides
        if (this.view_is(['Quarter Day', 'Half Day'])) {
            this.gantt_start = date_utils.add(this.gantt_start, -7, 'day');
            this.gantt_end = date_utils.add(this.gantt_end, 7, 'day');
        } else if (this.view_is('Month')) {
            this.gantt_start = date_utils.start_of(this.gantt_start, 'year');
            this.gantt_end = date_utils.add(this.gantt_end, 1, 'year');
        } else if (this.view_is('Year')) {
            this.gantt_start = date_utils.add(this.gantt_start, -2, 'year');
            this.gantt_end = date_utils.add(this.gantt_end, 2, 'year');
        } else if (this.view_is('Week')) {
            this.gantt_start = date_utils.add(this.gantt_start, -5, 'day');
            this.gantt_end = date_utils.add(this.gantt_end, 2, 'month');
        } else {
            this.gantt_start = date_utils.add(this.gantt_start, -1, 'day');
            this.gantt_end = date_utils.add(this.gantt_end, 5, 'day');
        }
    }

    setup_date_values() {
        this.dates = [];
        let cur_date = null;

        while (cur_date === null || cur_date < this.gantt_end) {
            if (!cur_date) {
                cur_date = date_utils.clone(this.gantt_start);
            } else {
                if (this.view_is('Year')) {
                    cur_date = date_utils.add(cur_date, 1, 'year');
                } else if (this.view_is('Month')) {
                    cur_date = date_utils.add(cur_date, 1, 'month');
                } else {
                    cur_date = date_utils.add(
                        cur_date,
                        this.options.step,
                        'hour'
                    );
                }
            }
            this.dates.push(cur_date);
        }
    }

    bind_events() {
        this.bind_grid_click();
        //this.bind_bar_events();
    }

    /* CODE TO CHANGE BELLOW*/

    render() {
        this.clear();
        this.setup_layers();
        this.make_grid();
        this.make_dates();
        this.make_bars();
        this.set_width();
        this.set_scroll_position();
        this.make_filter();
    }

    setup_layers() {
        this.layers = {};
        const layers = ['filter', 'tasks', 'grid', 'bar'];
        // make group layers
        for (let layer of layers) {
            this.layers[layer] = createSVG('g', {
                class: layer,
                append_to: this.$svg
            });
        }
    }

    make_filter() {
        const filter_height = this.options.header_height;
        const filter = new Filter(this);
        const filterLayer = createSVG('svg', {
            x: 0,
            y: 0,
            width: this.startPosition,
            height: filter_height,
            class: 'filter',
            append_to: this.layers.grid
        });

        createSVG('foreignObject', {
            x: 0,
            y: 0,
            width: this.startPosition,
            height: filter_height,
            innerHTML: filter.getFilter(),
            class: 'filter',
            append_to: filterLayer
        });
        filter.checkDefault(this.getFilterType());
        filter.setClick(this);
    }

    getFilterType() {
        if (this.view_is('Day')) {
            return 1;
        } else if (this.view_is('Week')) {
            return 2;
        } else {
            return 3;
        }
    }

    make_grid() {
        this.make_grid_background();
        this.make_grid_rows();
        this.make_grid_header();
        this.make_grid_ticks();
        if (
            this.todayXCoord ||
            this.highlightMonthXCoords ||
            this.highlightWeekXCoords
        ) {
            this.make_grid_highlights();
        }

    }

    make_grid_background() {
        const grid_width =
            this.dates.length * this.options.column_width + this.startPosition;
        const grid_height =
            this.options.header_height +
            this.options.padding +
            (this.options.bar_height + this.options.padding) *
            this.tasks.length;

        createSVG('rect', {
            x: 0,
            y: 0,
            width: grid_width,
            height: grid_height,
            class: 'grid-background',
            append_to: this.layers.grid
        });
        // Setting width as default value until calculates the total area
        this.changeGridAttr(grid_height, grid_width);
        if (grid_width < screen.width) {
            GanttChart.changeGanttContainerWidth(grid_width);
        }
    }

    changeGridAttr(grid_height, grid_width) {
        $.attr(this.$svg, {
            height: grid_height,
            width: grid_width
        });
    }

    make_grid_rows() {
        const rows_layer = createSVG('g', { append_to: this.layers.grid });
        const lines_layer = createSVG('g', { append_to: this.layers.grid });

        let row_width = this.dates.length * this.options.column_width;
        //row_width += this.startPosition;
        const row_height = this.options.bar_height + this.options.padding * 2;
        const line_row_width = row_width + this.startPosition;

        //let row_y = this.options.header_height + this.options.padding / 2;
        let row_y = this.options.header_height;
        for (let tsk of this.allTasks) {
            let pos = 0;
            let lineClass = 'row-line';
            for (let task of tsk.taskList) {
                createSVG('rect', {
                    x: this.startPosition,
                    y: row_y,
                    width: row_width,
                    height: row_height,
                    class: 'grid-row',
                    append_to: rows_layer
                });

                if (pos === tsk.taskList.length - 1) {
                    lineClass = 'last-row-line';
                    //row_width += this.startPosition;
                }

                createSVG('line', {
                    x1: this.startPosition,
                    y1: row_y + row_height,
                    x2: line_row_width,
                    y2: row_y + row_height,
                    class: lineClass,
                    append_to: lines_layer
                });
                pos++;
                //row_y += this.options.bar_height + this.options.padding;
                row_y += row_height;
            }
        }
    }

    make_grid_header() {
        const header_width = this.dates.length * this.options.column_width;
        const header_height = this.options.header_height;
        createSVG('rect', {
            x: this.startPosition,
            y: 0,
            width: header_width,
            height: header_height,
            class: 'grid-header',
            append_to: this.layers.grid
        });
    }

    /*
       This method creates a white box on left side (Task Level One)
     */
    make_task_header() {
        let y = this.options.header_height;
        const header_width = this.startPosition;
        const fixedValueForSum = y;
        let totalHeight = fixedValueForSum;
        let newSVGHeight = fixedValueForSum;
        let header_height = 0;
        for (let tsk of this.allTasks) {
            header_height =
                (this.options.bar_height + this.options.padding * 2) *
                tsk.taskList.length;
            const taskGroup = createSVG('g', {
                x: 0,
                y: y,
                width: header_width,
                height: header_height,
                class: 'task-header-group',
                append_to: this.layers.bar
            });
            createSVG('rect', {
                x: 0,
                y: y,
                width: header_width,
                height: header_height,
                class: 'task-header',
                append_to: taskGroup
            });
            const nameTest = tsk.name;
            const labelPosX = header_width / 2;
            const labelPosY = totalHeight + header_height / 2;
            createSVG('text', {
                x: labelPosX,
                y: labelPosY,
                innerHTML: nameTest,
                class: 'task-name',
                append_to: taskGroup
            });
            if (tsk.overdue) {
                const overdue = '(overdue)';
                const overdueY = labelPosY + 15;
                createSVG('text', {
                    x: labelPosX,
                    y: overdueY,
                    innerHTML: overdue,
                    class: 'overdue-label',
                    append_to: taskGroup
                });
            }
            totalHeight += header_height;
            y = y + header_height;
            newSVGHeight += header_height;
        }
        $.attr(this.$svg, {
            height: newSVGHeight
        });
    }

    make_grid_ticks() {
        let tick_x = this.dateStartPosition;
        let tick_y = this.options.header_height + this.options.padding / 2;
        let tick_height =
            (this.options.bar_height + this.options.padding) *
            this.tasks.length;

        let weekReference = 0;
        const todayDate = date_utils.today();
        const currentDay = todayDate.getDate();
        for (let date of this.dates) {
            let tick_class = 'tick';

            if (this.view_is('Day')) {
                if (
                    date.getDate() === currentDay &&
                    date.getMonth() === todayDate.getMonth() &&
                    date.getFullYear() === todayDate.getFullYear()
                ) {
                    this.todayXCoord = tick_x + this.options.column_width / 2;
                }
                if (date.getDate() === 1) {
                    tick_class += ' thick';
                }
            }

            if (this.view_is('Month')) {
                const currentMonth = date.getUTCMonth();
                const qtyDaysInMonth = date_utils.get_days_in_month(date);
                if (
                    currentMonth === todayDate.getUTCMonth() &&
                    date.getFullYear() === todayDate.getFullYear()
                ) {
                    if (currentDay === qtyDaysInMonth) {
                        /*highlight begin of Month*/
                        this.highlightMonthXCoords =
                            tick_x + this.options.column_width;
                    } else {
                        let monthDivisor = qtyDaysInMonth / currentDay;
                        monthDivisor += 1; // to adjust on current day
                        /*highlight day of Month*/
                        this.highlightMonthXCoords =
                            tick_x + this.options.column_width / monthDivisor;
                    }
                    /* The Month name must be highlighted */
                    this.highlightMonthNameXCoords =
                        tick_x + this.options.column_width / 2;
                }
                if (date.getMonth() === 1) {
                    tick_class += ' thick';
                }

            }
            if (this.view_is('Week')) {
                if (
                    date_utils.getNumberOfWeek(date) ===
                    date_utils.getNumberOfWeek(todayDate) &&
                    date.getFullYear() === todayDate.getFullYear()
                ) {
                    if (todayDate.getDay() === 6) {
                        /*highlight end of week*/
                        this.highlightWeekXCoords = tick_x;
                    } else {
                        const weekDaysCount = 6;
                        let weekDay = todayDate.getDay();
                        weekDay -= 1;
                        //weekDay = 0;
                        /*if (weekDay === 0) {
                            weekDay = 1;
                        }*/
                        let weekDivisor = weekDaysCount / weekDay;
                        /*highlight day of week*/
                        this.highlightWeekXCoords =
                            tick_x + this.options.column_width / weekDivisor;
                    }
                }

                if (weekReference === 0 || weekReference === 5) {
                    tick_class += ' thick';
                    weekReference = 0;
                }
                weekReference++;
            }

            if (tick_class.includes('thick')) {
                this.make_divisor_highlights(tick_x);
            }

            createSVG('path', {
                d: `M ${tick_x} ${tick_y} v ${tick_height}`,
                class: tick_class,
                append_to: this.layers.grid
            });
            tick_x += this.options.column_width;
        }
    }

    make_grid_highlights() {
        // highlight today's date
        let boxXCoords = 0;
        if (this.view_is('Day')) {
            boxXCoords = this.todayXCoord;
        } else if (this.view_is('Month')) {
            boxXCoords = this.highlightMonthXCoords;
        } else if (this.view_is('Week')) {
            boxXCoords = this.highlightWeekXCoords;
        }
        let x =
            date_utils.diff(date_utils.today(), this.gantt_start, 'hour') /
            this.options.step *
            this.options.column_width +
            this.startPosition;

        let y = this.options.header_height;

        let width = this.options.column_width;
        let height =
            (this.options.bar_height + this.options.padding * 2) *
            this.tasks.length +
            this.options.header_height +
            this.options.padding / 2;
        createSVG('path', {
            d: `M ${boxXCoords} ${y} v ${height}`,
            id: 'td',
            class: 'today-divisor',
            append_to: this.layers.grid
        });
        createSVG('use', {
            id: 'use',
            href: '#td',
            append_to: this.$svg
        });

        if (this.view_is('Day') || this.view_is('Month')) {
            // change values for square.
            height = 20;
            width = 30;
            y = this.options.header_height - 30;
            if (this.view_is('Month')) {
                x = this.highlightMonthNameXCoords - 15;
            } else {
                x = boxXCoords - 15;
            }

            createSVG('rect', {
                x,
                y,
                width,
                height,
                class: 'today-highlight',
                append_to: this.layers.grid
            });
        }

    }

    make_divisor_highlights(x) {
        const y = 0;
        const height =
            (this.options.bar_height + this.options.padding * 2) *
            this.tasks.length +
            this.options.header_height +
            this.options.padding / 2;
        createSVG('path', {
            d: `M ${x} ${y} v ${height}`,
            class: 'month-divisor',
            append_to: this.layers.grid
        });
    }

    make_dates() {
        const calendarLayer = createSVG('g', {
            x: this.dateStartPosition,
            y: 0,
            class: 'date',
            append_to: this.layers.grid
        });

        for (let date of this.get_dates_to_draw()) {
            createSVG('text', {
                x: date.lower_x,
                y: date.lower_y,
                innerHTML: date.lower_text,
                class: 'lower-text',
                append_to: calendarLayer
            });

            if (date.upper_text) {
                const $upper_text = createSVG('text', {
                    x: date.upper_x,
                    y: date.upper_y,
                    innerHTML: date.upper_text,
                    class: 'upper-text',
                    append_to: calendarLayer
                });
                // remove out-of-bound dates
                if (
                    $upper_text.getBBox().x2 > this.layers.grid.getBBox().width
                ) {
                    $upper_text.remove();
                }
            }
        }
    }

    get_dates_to_draw() {
        let last_date = null;
        const dates = this.dates.map((date, i) => {
            const d = this.get_date_info(date, last_date, i);
            last_date = date;
            return d;
        });
        return dates;
    }

    get_date_info(date, last_date, i) {
        if (!last_date) {
            last_date = date_utils.add(date, 1, 'year');
        }
        const date_text = {
            'Quarter Day_lower': date_utils.format(
                date,
                'HH',
                this.options.language
            ),
            'Half Day_lower': date_utils.format(
                date,
                'HH',
                this.options.language
            ),
            Day_lower:
                date.getDate() !== last_date.getDate()
                    ? date_utils.format(date, 'D', this.options.language)
                    : '',
            Week_lower:
            /*date.getMonth() !== last_date.getMonth()
            ? date_utils.format(date, 'D MMM', this.options.language)
            : date_utils.format(date, 'D', this.options.language)*/
                date_utils.getNumberOfWeek(date),
            Month_lower: date_utils.format(date, 'MMMM', this.options.language),
            Year_lower: date_utils.format(date, 'YYYY', this.options.language),
            'Quarter Day_upper':
                date.getDate() !== last_date.getDate()
                    ? date_utils.format(date, 'D MMM', this.options.language)
                    : '',
            'Half Day_upper':
                date.getDate() !== last_date.getDate()
                    ? date.getMonth() !== last_date.getMonth()
                    ? date_utils.format(date, 'D MMM', this.options.language)
                    : date_utils.format(date, 'D', this.options.language)
                    : '',
            Day_upper:
                date.getMonth() !== last_date.getMonth()
                    ? date_utils.format(date, 'MMMM', this.options.language)
                    : '',
            Week_upper:
                date.getMonth() !== last_date.getMonth()
                    ? date_utils.format(
                    date,
                    'MMMM YYYY',
                    this.options.language
                    )
                    : '',
            Month_upper:
                date.getFullYear() !== last_date.getFullYear()
                    ? date_utils.format(date, 'YYYY', this.options.language)
                    : '',
            Year_upper:
                date.getFullYear() !== last_date.getFullYear()
                    ? date_utils.format(date, 'YYYY', this.options.language)
                    : ''
        };

        const base_pos = {
            x: i * this.options.column_width + this.dateStartPosition,
            lower_y: this.options.header_height - 15,
            upper_y: this.options.header_height - 35
        };

        const x_pos = {
            'Quarter Day_lower': this.options.column_width * 4 / 2,
            'Quarter Day_upper': 0,
            'Half Day_lower': this.options.column_width * 2 / 2,
            'Half Day_upper': 0,
            Day_lower: this.options.column_width / 2,
            Day_upper: this.options.column_width * 30 / 2,
            Week_lower: 0,
            Week_upper: this.options.column_width * 4 / 2,
            Month_lower: this.options.column_width / 2,
            Month_upper: this.options.column_width * 12 / 2,
            Year_lower: this.options.column_width / 2,
            Year_upper: this.options.column_width * 30 / 2
        };

        return {
            upper_text: date_text[`${this.options.view_mode}_upper`],
            lower_text: date_text[`${this.options.view_mode}_lower`],
            upper_x: base_pos.x + x_pos[`${this.options.view_mode}_upper`],
            upper_y: base_pos.upper_y,
            lower_x: base_pos.x + x_pos[`${this.options.view_mode}_lower`],
            lower_y: base_pos.lower_y
        };
    }

    make_bars() {
        this.make_task_header(this.taskLevelOneQty);
        this.bars = this.tasks.map(task => {
            const bar = new Bar(this, task);
            this.layers.bar.appendChild(bar.group);
            return bar;
        });
    }

    set_width() {
        const cur_width = this.$svg.getBoundingClientRect().width;
        const actual_width = this.$svg
            .querySelector('.grid .grid-row')
            .getAttribute('width');
        if (cur_width < actual_width) {
            this.$svg.setAttribute('width', actual_width);
        }
    }

    /*
     Scroll screen to content.
     */
    set_scroll_position() {
        const parent_element = this.$svg.parentElement;
        if (!parent_element) return;

        const hours_before_first_task = date_utils.diff(
            this.get_oldest_starting_date(),
            this.gantt_start,
            'hour'
        );

        const scroll_pos =
            hours_before_first_task /
            this.options.step *
            this.options.column_width -
            this.options.column_width;

        parent_element.scrollLeft = scroll_pos;
    }

    bind_grid_click() {
        $.on(
            this.$svg,
            this.options.popup_trigger,
            '.grid-row, .grid-header',
            () => {
                this.unselect_all();
                this.hide_popup();
            }
        );
    }

    bind_bar_events() {
        let is_dragging = false;
        let x_on_start = 0;
        let y_on_start = 0;
        let is_resizing_left = false;
        let is_resizing_right = false;
        let parent_bar_id = null;
        let bars = []; // instanceof Bar
        this.bar_being_dragged = null;

        function action_in_progress() {
            return is_dragging || is_resizing_left || is_resizing_right;
        }

        $.on(this.$svg, 'mousedown', '.bar-wrapper, .handle', (e, element) => {
            const bar_wrapper = $.closest('.bar-wrapper', element);

            if (element.classList.contains('left')) {
                is_resizing_left = true;
            } else if (element.classList.contains('right')) {
                is_resizing_right = true;
            } else if (element.classList.contains('bar-wrapper')) {
                is_dragging = true;
            }

            bar_wrapper.classList.add('active');

            x_on_start = e.offsetX;
            y_on_start = e.offsetY;

            parent_bar_id = bar_wrapper.getAttribute('data-id');
            const ids = [
                parent_bar_id,
                ...this.get_all_dependent_tasks(parent_bar_id)
            ];
            bars = ids.map(id => this.get_bar(id));

            this.bar_being_dragged = parent_bar_id;

            bars.forEach(bar => {
                const $bar = bar.$bar;
                $bar.ox = $bar.getX();
                $bar.oy = $bar.getY();
                $bar.owidth = $bar.getWidth();
                $bar.finaldx = 0;
            });
        });

        $.on(this.$svg, 'mousemove', e => {
            if (!action_in_progress()) return;
            const dx = e.offsetX - x_on_start;
            const dy = e.offsetY - y_on_start;

            bars.forEach(bar => {
                const $bar = bar.$bar;
                $bar.finaldx = this.get_snap_position(dx);

                if (is_resizing_left) {
                    if (parent_bar_id === bar.task.id) {
                        bar.update_bar_position({
                            x: $bar.ox + $bar.finaldx,
                            width: $bar.owidth - $bar.finaldx
                        });
                    } else {
                        bar.update_bar_position({
                            x: $bar.ox + $bar.finaldx
                        });
                    }
                } else if (is_resizing_right) {
                    if (parent_bar_id === bar.task.id) {
                        bar.update_bar_position({
                            width: $bar.owidth + $bar.finaldx
                        });
                    }
                } else if (is_dragging) {
                    bar.update_bar_position({ x: $bar.ox + $bar.finaldx });
                }
            });
        });

        document.addEventListener('mouseup', e => {
            if (is_dragging || is_resizing_left || is_resizing_right) {
                bars.forEach(bar => bar.group.classList.remove('active'));
            }

            is_dragging = false;
            is_resizing_left = false;
            is_resizing_right = false;
        });

        $.on(this.$svg, 'mouseup', e => {
            this.bar_being_dragged = null;
            bars.forEach(bar => {
                const $bar = bar.$bar;
                if (!$bar.finaldx) return;
                bar.date_changed();
                bar.set_action_completed();
            });
        });

        this.bind_bar_progress();
    }

    bind_bar_progress() {
        let x_on_start = 0;
        let y_on_start = 0;
        let is_resizing = null;
        let bar = null;
        let $bar_progress = null;
        let $bar = null;

        $.on(this.$svg, 'mousedown', '.handle.progress', (e, handle) => {
            is_resizing = true;
            x_on_start = e.offsetX;
            y_on_start = e.offsetY;

            const $bar_wrapper = $.closest('.bar-wrapper', handle);
            const id = $bar_wrapper.getAttribute('data-id');
            bar = this.get_bar(id);

            $bar_progress = bar.$bar_progress;
            $bar = bar.$bar;

            $bar_progress.finaldx = 0;
            $bar_progress.owidth = $bar_progress.getWidth();
            $bar_progress.min_dx = -$bar_progress.getWidth();
            $bar_progress.max_dx = $bar.getWidth() - $bar_progress.getWidth();
        });

        $.on(this.$svg, 'mousemove', e => {
            if (!is_resizing) return;
            let dx = e.offsetX - x_on_start;
            let dy = e.offsetY - y_on_start;

            if (dx > $bar_progress.max_dx) {
                dx = $bar_progress.max_dx;
            }
            if (dx < $bar_progress.min_dx) {
                dx = $bar_progress.min_dx;
            }

            const $handle = bar.$handle_progress;
            $.attr($bar_progress, 'width', $bar_progress.owidth + dx);
            $.attr($handle, 'points', bar.get_progress_polygon_points());
            $bar_progress.finaldx = dx;
        });

        $.on(this.$svg, 'mouseup', () => {
            is_resizing = false;
            if (!($bar_progress && $bar_progress.finaldx)) return;
            bar.progress_changed();
            bar.set_action_completed();
        });
    }

    get_all_dependent_tasks(task_id) {
        let out = [];
        let to_process = [task_id];
        while (to_process.length) {
            const deps = to_process.reduce((acc, curr) => {
                acc = acc.concat(this.dependency_map[curr]);
                return acc;
            }, []);

            out = out.concat(deps);
            to_process = Filter.filter(d => !to_process.includes(d));
        }

        return out.filter(Boolean);
    }

    get_snap_position(dx) {
        let odx = dx,
            rem,
            position;

        if (this.view_is('Week')) {
            rem = dx % (this.options.column_width / 7);
            position =
                odx -
                rem +
                (rem < this.options.column_width / 14
                    ? 0
                    : this.options.column_width / 7);
        } else if (this.view_is('Month')) {
            rem = dx % (this.options.column_width / 30);
            position =
                odx -
                rem +
                (rem < this.options.column_width / 60
                    ? 0
                    : this.options.column_width / 30);
        } else {
            rem = dx % this.options.column_width;
            position =
                odx -
                rem +
                (rem < this.options.column_width / 2
                    ? 0
                    : this.options.column_width);
        }
        return position;
    }

    unselect_all() {
        [...this.$svg.querySelectorAll('.bar-wrapper')].forEach(el => {
            el.classList.remove('active');
        });
    }

    view_is(modes) {
        if (typeof modes === 'string') {
            return this.options.view_mode === modes;
        }

        if (Array.isArray(modes)) {
            return modes.some(mode => this.options.view_mode === mode);
        }

        return false;
    }

    get_task(id) {
        return this.tasks.find(task => {
            return task.id === id;
        });
    }

    get_bar(id) {
        return this.bars.find(bar => {
            return bar.task.id === id;
        });
    }

    show_popup(options) {
        if (!this.popup) {
            this.popup = new Popup(
                this.popup_wrapper,
                this.options.custom_popup_html
            );
        }
        this.popup.show(options);
    }

    hide_popup() {
        this.popup && this.popup.hide();
    }

    trigger_event(event, args) {
        if (this.options['on_' + event]) {
            this.options['on_' + event].apply(null, args);
        }
    }

    /**
     * Gets the oldest starting date from the list of tasks
     *
     * @returns Date
     * @memberof Gantt
     */
    get_oldest_starting_date() {
        return this.tasks
            .map(task => task._start)
            .reduce(
                (prev_date, cur_date) =>
                    cur_date <= prev_date ? cur_date : prev_date
            );
    }

    /**
     * Clear all elements from the parent svg element
     *
     * @memberof Gantt
     */
    clear() {
        this.$svg.innerHTML = '';
    }

    static changeGanttContainerWidth(ganttWidth) {
        document.documentElement.style.setProperty(
            '--gantt-container-width',
            ganttWidth + 'px'
        );
    }
}

function generate_id(task) {
    return (
        task.name +
        '_' +
        Math.random()
            .toString(36)
            .slice(2, 12)
    );
}
