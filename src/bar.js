import date_utils from './date_utils';
import { $, createSVG, animateSVG } from './svg_utils';

export default class Bar {
    constructor(gantt, task) {
        this.set_defaults(gantt, task);
        this.prepare();
        this.draw();
        this.bind();
    }

    set_defaults(gantt, task) {
        this.action_completed = false;
        this.gantt = gantt;
        this.task = task;
        this.gantt.options.project_overview
            ? (this.startPosition = 0)
            : (this.startPosition = 200);
    }

    prepare() {
        this.prepare_values();
        this.prepare_helpers();
    }

    prepare_values() {
        this.invalid = this.task.invalid;
        this.height = this.gantt.options.bar_height;
        this.x = this.compute_x() + this.startPosition;
        this.y = this.compute_y();
        this.corner_radius = this.gantt.options.bar_corner_radius;
        this.duration =
            date_utils.diff(this.task._end, this.task._start, 'hour') /
            this.gantt.options.step;
        this.width = this.gantt.options.column_width * this.duration;
        this.progress_width =
            this.gantt.options.column_width *
            this.duration *
            (this.task.progress / 100) || 0;
        this.group = createSVG('g', {
            class: 'bar-wrapper ' + (this.task.custom_class || ''),
            'data-id': this.task.id
        });
        this.bar_group = createSVG('g', {
            class: 'bar-group',
            append_to: this.group
        });
        this.handle_group = createSVG('g', {
            class: 'handle-group',
            append_to: this.group
        });
    }

    prepare_helpers() {
        SVGElement.prototype.getX = function() {
            return +this.getAttribute('x');
        };
        SVGElement.prototype.getY = function() {
            return +this.getAttribute('y');
        };
        SVGElement.prototype.getWidth = function() {
            return +this.getAttribute('width');
        };
        SVGElement.prototype.getHeight = function() {
            return +this.getAttribute('height');
        };
        SVGElement.prototype.getEndX = function() {
            return this.getX() + this.getWidth();
        };
    }

    draw() {
        this.draw_bar();
        this.draw_progress_bar();
        this.draw_label();
        this.draw_resize_handles();
    }

    draw_bar() {
        let barClass = 'bar ' + this.getTaskLevelColor();
        this.$bar = createSVG('rect', {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height,
            rx: this.corner_radius,
            ry: this.corner_radius,
            class: barClass,
            append_to: this.bar_group
        });

        animateSVG(this.$bar, 'width', 0, this.width);

        if (this.invalid) {
            this.$bar.classList.add('bar-invalid');
        }
    }

    draw_progress_bar() {
        if (this.invalid) return;
        let barProgressClass = 'bar ' + this.getTaskLevelProgressColor();

        let x = this.x;
        let y = this.y;
        let height = this.height;
        const strokeSize = 1;
        let width = this.progress_width;
        if (this.task.overdue) {
            x += strokeSize;
            y += strokeSize;
            height -= strokeSize + 1;
            if (this.task.progress === 100) {
                width -= 2;
            }
        }
        this.$bar_progress = createSVG('rect', {
            x: x,
            y: y,
            width: width,
            height: height,
            rx: this.corner_radius,
            ry: this.corner_radius,
            class: barProgressClass,
            append_to: this.bar_group
        });
        animateSVG(this.$bar_progress, 'width', 0, this.progress_width);
    }

    draw_label() {
        const textSVG = createSVG('text', {
            x: this.x + this.width / 2,
            y: this.y + this.height / 2,
            append_to: this.bar_group,
            class: 'bar-label'
        });
        const taskNameSVG = createSVG('tspan', {
            append_to: textSVG,
            innerHTML: this.task.name
        });
        const taskProgressSVG = createSVG('tspan', {
            append_to: this.bar_group,
            innerHTML: ' ' + this.task.progress + '%',
            class: 'bar-label-progress'
        });
        taskNameSVG.appendChild(taskProgressSVG);
        // labels get BBox in the next tick
        requestAnimationFrame(() => this.update_label_position());
    }

    draw_label_just_progress() {
        const textSVG = createSVG('text', {
            x: this.x + this.width / 2,
            y: this.y + this.height / 2,
            append_to: this.bar_group,
            class: 'bar-label'
        });
        createSVG('tspan', {
            append_to: textSVG,
            innerHTML: ' ' + this.task.progress + '%',
            class: 'bar-label-progress'
        });
        // labels get BBox in the next tick
        requestAnimationFrame(() => this.update_label_position());
    }

    draw_resize_handles() {
        if (this.invalid) return;

        const bar = this.$bar;
        const handle_width = 8;

        createSVG('rect', {
            x: bar.getX() + bar.getWidth() - 9,
            y: bar.getY() + 1,
            width: handle_width,
            height: this.height - 2,
            rx: this.corner_radius,
            ry: this.corner_radius,
            class: 'handle right',
            append_to: this.handle_group
        });

        createSVG('rect', {
            x: bar.getX() + 1,
            y: bar.getY() + 1,
            width: handle_width,
            height: this.height - 2,
            rx: this.corner_radius,
            ry: this.corner_radius,
            class: 'handle left',
            append_to: this.handle_group
        });

        if (this.task.progress && this.task.progress < 100) {
            this.$handle_progress = createSVG('polygon', {
                points: this.get_progress_polygon_points().join(','),
                class: 'handle progress',
                append_to: this.handle_group
            });
        }
    }

    get_progress_polygon_points() {
        const bar_progress = this.$bar_progress;
        return [
            bar_progress.getEndX() - 5,
            bar_progress.getY() + bar_progress.getHeight(),
            bar_progress.getEndX() + 5,
            bar_progress.getY() + bar_progress.getHeight(),
            bar_progress.getEndX(),
            bar_progress.getY() + bar_progress.getHeight() - 8.66
        ];
    }

    bind() {
        if (this.invalid) return;
        /*if (this.task.overdue) {
            this.setup_click_event();
        }*/
    }

    setup_click_event() {
        $.on(this.group, 'focus ' + this.gantt.options.popup_trigger, e => {
            if (this.action_completed) {
                // just finished a move action, wait for a few seconds
                return;
            }

            if (e.type === 'click') {
                this.gantt.trigger_event('click', [this.task]);
            }

            this.gantt.unselect_all();
            this.group.classList.toggle('active');

            this.show_popup();
        });
    }

    show_popup() {
        if (this.gantt.bar_being_dragged) return;

        const start_date = date_utils.format(this.task._start, 'MMM D', this.gantt.options.language);
        const end_date = date_utils.format(
            date_utils.add(this.task._end, -1, 'second'),
            'MMM D',
            this.gantt.options.language
        );
        const subtitle = start_date + ' - ' + end_date;

        this.gantt.show_popup({
            target_element: this.$bar,
            title: this.task.name,
            subtitle: subtitle,
            task: this.task
        });
    }

    update_bar_position({ x = null, width = null }) {
        const bar = this.$bar;
        if (x) {
            // get all x values of parent task
            const xs = this.task.dependencies.map(dep => {
                return this.gantt.get_bar(dep).$bar.getX();
            });
            // child task must not go before parent
            const valid_x = xs.reduce((prev, curr) => {
                return x >= curr;
            }, x);
            if (!valid_x) {
                width = null;
                return;
            }
            this.update_attr(bar, 'x', x);
        }
        if (width && width >= this.gantt.options.column_width) {
            this.update_attr(bar, 'width', width);
        }
        this.update_label_position();
        this.update_handle_position();
        this.update_progressbar_position();
        this.update_arrow_position();
    }

    date_changed() {
        let changed = false;
        const { new_start_date, new_end_date } = this.compute_start_end_date();

        if (Number(this.task._start) !== Number(new_start_date)) {
            changed = true;
            this.task._start = new_start_date;
        }

        if (Number(this.task._end) !== Number(new_end_date)) {
            changed = true;
            this.task._end = new_end_date;
        }

        if (!changed) return;

        this.gantt.trigger_event('date_change', [
            this.task,
            new_start_date,
            date_utils.add(new_end_date, -1, 'second')
        ]);
    }

    progress_changed() {
        const new_progress = this.compute_progress();
        this.task.progress = new_progress;
        this.gantt.trigger_event('progress_change', [this.task, new_progress]);
    }

    set_action_completed() {
        this.action_completed = true;
        setTimeout(() => (this.action_completed = false), 1000);
    }

    compute_start_end_date() {
        const bar = this.$bar;
        const x_in_units = bar.getX() / this.gantt.options.column_width;
        const new_start_date = date_utils.add(
            this.gantt.gantt_start,
            x_in_units * this.gantt.options.step,
            'hour'
        );
        const width_in_units = bar.getWidth() / this.gantt.options.column_width;
        const new_end_date = date_utils.add(
            new_start_date,
            width_in_units * this.gantt.options.step,
            'hour'
        );

        return { new_start_date, new_end_date };
    }

    compute_progress() {
        const progress =
            this.$bar_progress.getWidth() / this.$bar.getWidth() * 100;
        return parseInt(progress, 10);
    }

    compute_x() {
        const { step, column_width } = this.gantt.options;
        const task_start = this.task._start;
        const gantt_start = this.gantt.gantt_start;

        const diff = date_utils.diff(task_start, gantt_start, 'hour');
        let x = diff / step * column_width;

        if (this.gantt.view_is('Month')) {
            const diff = date_utils.diff(task_start, gantt_start, 'day');
            x = diff * column_width / 30;
        }
        return x;
    }

    compute_y() {
        return (
            this.gantt.options.header_height +
            this.gantt.options.padding +
            this.task._index * (this.height + this.gantt.options.padding * 2)
        );
    }

    get_snap_position(dx) {
        let odx = dx,
            rem,
            position;

        if (this.gantt.view_is('Week')) {
            rem = dx % (this.gantt.options.column_width / 7);
            position =
                odx -
                rem +
                (rem < this.gantt.options.column_width / 14
                    ? 0
                    : this.gantt.options.column_width / 7);
        } else if (this.gantt.view_is('Month')) {
            rem = dx % (this.gantt.options.column_width / 30);
            position =
                odx -
                rem +
                (rem < this.gantt.options.column_width / 60
                    ? 0
                    : this.gantt.options.column_width / 30);
        } else {
            rem = dx % this.gantt.options.column_width;
            position =
                odx -
                rem +
                (rem < this.gantt.options.column_width / 2
                    ? 0
                    : this.gantt.options.column_width);
        }
        return position;
    }

    update_attr(element, attr, value) {
        value = +value;
        if (!isNaN(value)) {
            element.setAttribute(attr, value);
        }
        return element;
    }

    update_progressbar_position() {
        this.$bar_progress.setAttribute('x', this.$bar.getX());
        this.$bar_progress.setAttribute(
            'width',
            this.$bar.getWidth() * (this.task.progress / 100)
        );
    }

    update_label_position() {
        const bar = this.$bar,
            label = this.group.querySelector('.bar-label');

        if (this.task.overdue) {
            this.showTooltipToBigBar(true);
        }

        if (label.getBBox().width > bar.getWidth()) {
            label.classList.add('big');
            this.showTooltipToBigBar(false);
            label.remove();
            this.draw_label_just_progress();
        } else {
            label.classList.remove('big');
            label.setAttribute('x', bar.getX() + bar.getWidth() / 2);
        }
    }

    showTooltipToBigBar(overdue) {
        $.on(this.group, 'mouseover ' + this.gantt.options.popup_trigger, e => {
            if (this.action_completed) {
                // just finished a move action, wait for a few seconds
                return;
            }

            if (e.type === 'click') {
                this.gantt.trigger_event('click', [this.task]);
            }


            this.gantt.unselect_all();
            this.group.classList.toggle('active');

            this.addStyleForPopup();
            let title = '';
            if (overdue) {
                title = 100 - this.task.progress + '% overdue';
            } else {
                title = this.task.name;
            }

            this.gantt.show_popup({
                target_element: this.$bar,
                title: title,
                /* subtitle: subtitle,*/
                task: this.task
            });

        });
    }

    addStyleForPopup() {
        this.gantt.popup_wrapper.classList.add(this.getPopupClassByTaskLevel());

        for (let token of this.gantt.popup_wrapper.classList) {
            if (token !== 'popup-wrapper-color') {
                this.gantt.popup_wrapper.classList.remove(token);
            }
        }
        this.gantt.popup_wrapper.classList.add(this.getPopupClassByTaskLevel());

    }

    update_handle_position() {
        const bar = this.$bar;
        this.handle_group
            .querySelector('.handle.left')
            .setAttribute('x', bar.getX() + 1);
        this.handle_group
            .querySelector('.handle.right')
            .setAttribute('x', bar.getEndX() - 9);
        const handle = this.group.querySelector('.handle.progress');
        handle &&
        handle.setAttribute('points', this.get_progress_polygon_points());
    }

    update_arrow_position() {
        this.arrows = this.arrows || [];
        for (let arrow of this.arrows) {
            arrow.update();
        }
    }

    getTaskLevelProgressColor() {
        if (this.invalid) return;
        const overdueItem = this.task.overdue ? ' bar-progress-overdue' : '';
        switch (this.task.level) {
            case 0:
                return 'bar-progress-zero' + overdueItem;
            case 1:
                return 'bar-progress-one' + overdueItem;
            case 2:
                return 'bar-progress-two' + overdueItem;
            case 3:
                return 'bar-progress-three' + overdueItem;
            default:
                return 'bar-progress-one' + overdueItem;
        }
    }

    getTaskLevelColor() {
        if (this.invalid) return;
        const overdueItem = this.task.overdue ? ' bar-overdue' : '';
        switch (this.task.level) {
            case 0:
                return 'bar-level-zero' + overdueItem;
            case 1:
                return 'bar-level-one' + overdueItem;
            case 2:
                return 'bar-level-two' + overdueItem;
            case 3:
                return 'bar-level-three' + overdueItem;
            default:
                return 'bar-level-one' + overdueItem;
        }
    }

    getPopupClassByTaskLevel() {
        if (this.task.overdue) {
            return 'task-overdue';
        }
        switch (this.task.level) {
            case 0:
                return 'task-level-zero';
            case 1:
                return 'task-level-one';
            case 2:
                return 'task-level-two';
            case 3:
                return 'task-level-three';
            default:
                return 'task-level-one';
        }
    }
}

function isFunction(functionToCheck) {
    var getType = {};
    return (
        functionToCheck &&
        getType.toString.call(functionToCheck) === '[object Function]'
    );
}
